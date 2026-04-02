import "@jxa/global-type";
import { run } from "jxa-run-compat";

declare global {
  // ObjC global
  const Ref: any;
}

/**
 * macOS doesn't expose an API for listing out the tray icons directly.
 * Instead, we use the Accessibility API to "scan" through the tray icons.
 */
export default function buildHandler() {
  return function tray(trayIndex: number, clickType: "left" | "right" = "left") {
    return run(
      (trayIndex: number, clickType: "left" | "right") => {
        ObjC.import("ApplicationServices");
        ObjC.import("CoreGraphics");

        const RE_SIZE_NAMED = /w:\s*([-0-9.]+)\s*h:\s*([-0-9.]+)/i;
        const RE_POINT_NAMED = /x:\s*([-0-9.]+)\s*y:\s*([-0-9.]+)/i;
        const RE_BRACED_PAIR = /\{\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*\}/;
        const RE_DOUBLE_BRACED_PAIR = /\{\s*\{\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*\}\s*\}/;

        function copyAttrRaw(el: any, attr: string) {
          const ref = Ref();
          const err = $.AXUIElementCopyAttributeValue(el, $(attr), ref);
          if (err !== 0 || !ref[0]) return null;
          return ref[0];
        }

        function cfTypeDescription(value: any) {
          if (!value) return null;
          try {
            return ObjC.unwrap(ObjC.castRefToObject(value).description);
          } catch (e) {
            try {
              return String(value);
            } catch (e2) {
              return null;
            }
          }
        }

        function getAttr(el: any, attr: string) {
          const raw = copyAttrRaw(el, attr);
          return cfTypeDescription(raw);
        }

        function parsePair(s: string, namedRegexp: RegExp): [number, number] | null {
          let m = s.match(namedRegexp) || s.match(RE_BRACED_PAIR) || s.match(RE_DOUBLE_BRACED_PAIR);

          if (!m) return null;
          return [Number(m[1]), Number(m[2])];
        }

        function getWidth(el: any) {
          const raw = copyAttrRaw(el, "AXSize");
          if (!raw) return null;

          const s = cfTypeDescription(raw);
          if (!s) return null;

          const pair = parsePair(s, RE_SIZE_NAMED);
          if (!pair) return null;

          return pair[0];
        }

        function getX(el: any) {
          const raw = copyAttrRaw(el, "AXPosition");
          if (!raw) return null;

          const s = cfTypeDescription(raw);
          if (!s) return null;

          const pair = parsePair(s, RE_POINT_NAMED);
          if (!pair) return null;

          return pair[0];
        }

        const display = $.CGMainDisplayID();
        const bounds = $.CGDisplayBounds(display);

        function getElementAtCoordinate(x: number, y: number) {
          const systemWide = $.AXUIElementCreateSystemWide();
          const elemRef = Ref();
          const axErr = $.AXUIElementCopyElementAtPosition(systemWide, x, y, elemRef);

          if (axErr !== 0) {
            return null;
          }

          const el = elemRef[0];
          if (!el) {
            return null;
          }

          return el;
        }

        function isMenuBar(el: any) {
          return el && getAttr(el, "AXRole") === "AXMenuBar";
        }

        const minX = bounds.origin.x;
        const maxX = bounds.origin.x + bounds.size.width;
        const centerX = bounds.origin.x + bounds.size.width / 2;
        const y = bounds.origin.y + 20;
        const INCREMENT = 10;

        const direction = trayIndex < 0 ? -1 : 1;
        const steps = trayIndex < 0 ? Math.abs(trayIndex) - 1 : trayIndex;

        function findStartElementFromLeft() {
          // Binary search to find the first menu bar item rightward of center
          let x = centerX;
          for (let b = bounds.size.width / 4; b >= 1; b /= 2) {
            while (isMenuBar(getElementAtCoordinate(x + b, y))) x += b;
          }

          x = x + 1;

          const el = getElementAtCoordinate(x, y);
          if (!el || isMenuBar(el)) return null;

          const elX = getX(el);
          if (elX === null) return null;

          return { el, x: elX };
        }

        function findStartElementFromRight() {
          let x = maxX - INCREMENT;

          while (x >= minX) {
            const el = getElementAtCoordinate(x, y);

            if (el !== null && !isMenuBar(el)) {
              const elX = getX(el);
              if (elX !== null) {
                return { el, x: elX };
              }
            }

            x -= INCREMENT;
          }

          return null;
        }

        const start = direction === 1 ? findStartElementFromLeft() : findStartElementFromRight();

        if (!start) {
          console.log(`Could not find starting tray item for trayIndex ${trayIndex}`);
          return;
        }

        let currentEl = start.el;
        let currentElX = start.x;
        let x = currentElX;

        for (let i = 0; i < steps; i++) {
          while (true) {
            x += direction * INCREMENT;

            if (x > maxX || x < minX) {
              console.log(
                `Reached end of menu bar while looking for tray index ${trayIndex} (tried up to x=${x})`,
              );
              return;
            }

            const newEl = getElementAtCoordinate(x, y);

            if (newEl === null || isMenuBar(newEl)) {
              continue;
            }

            const newElX = getX(newEl);
            if (newElX === null) {
              continue;
            }

            if (newElX !== currentElX) {
              currentEl = newEl;
              currentElX = newElX;
              break;
            }
          }
        }

        function clickAt(x: number, y: number, clickType: "left" | "right" = "left") {
          const point = $.CGPointMake(x, y);
          const isLeft = clickType === "left";

          const button = isLeft ? $.kCGMouseButtonLeft : $.kCGMouseButtonRight;

          const downType = isLeft ? $.kCGEventLeftMouseDown : $.kCGEventRightMouseDown;

          const upType = isLeft ? $.kCGEventLeftMouseUp : $.kCGEventRightMouseUp;

          $.CGWarpMouseCursorPosition(point);
          delay(0.02);

          const move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, button);
          $.CGEventPost($.kCGHIDEventTap, move);

          delay(0.03);

          const down = $.CGEventCreateMouseEvent(null, downType, point, button);

          const up = $.CGEventCreateMouseEvent(null, upType, point, button);

          $.CGEventPost($.kCGHIDEventTap, down);
          delay(0.06);
          $.CGEventPost($.kCGHIDEventTap, up);
        }

        function copyActionNames(el: any): string[] {
          const ref = Ref();
          const err = $.AXUIElementCopyActionNames(el, ref);
          if (err !== 0 || !ref[0]) return [];

          const arr = ref[0];
          const count = $.CFArrayGetCount(arr);
          const out: string[] = [];

          for (let i = 0; i < count; i++) {
            const raw = $.CFArrayGetValueAtIndex(arr, i);

            try {
              out.push(ObjC.unwrap(ObjC.castRefToObject(raw)));
            } catch (e) {
              try {
                out.push(String(raw));
              } catch (e2) {
                // ignore unparseable action names
              }
            }
          }

          return out;
        }

        function hasAction(el: any, actionName: string) {
          return copyActionNames(el).some((a) => a === actionName);
        }

        function performPress(el: any) {
          return $.AXUIElementPerformAction(el, $("AXPress"));
        }

        function activateTrayElement(el: any, elX: number, y: number, clickType: "left" | "right") {
          if (clickType === "left" && hasAction(el, "AXPress")) {
            const pressErr = performPress(el);
            console.log("AXPress:", pressErr);

            // if (pressErr === 0) {
              return;
            // }

            // console.log("AXPress failed, falling back to cursor click");
          } else if (clickType === "left") {
            console.log("AXPress not available, falling back to cursor click");
          } else {
            console.log("Right click requested, using cursor click");
          }

          const width = getWidth(el);
          if (width === null) {
            console.log(`Could not determine width for fallback click at x=${elX}`);
            return;
          }

          clickAt(elX + width / 2, y, clickType);
        }

        activateTrayElement(currentEl, currentElX, y, clickType);
      },
      trayIndex,
      clickType,
    );
  };
}
