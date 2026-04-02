import * as jxa from "./_.js";

export function dumpElement(el: any, depth = 0, maxDepth = 3) {
  if (!el || depth > maxDepth) return;

  const indent = "  ".repeat(depth);
  console.log(indent + jxa.labelFor(el));

  if (depth === maxDepth) return;

  const children = jxa.axElements(el, "AXChildren");
  for (const child of children) {
    dumpElement(child, depth + 1, maxDepth);
  }
}

export function dumpAppElement(app: any, depth = 1, maxDepth = 3) {
  if (!app || depth > maxDepth) return;

  dumpElement(app, depth, maxDepth);

  if (depth === maxDepth) return;

  const menuBar = jxa.axElement(app, "AXMenuBar");
  if (menuBar) {
    dumpElement(menuBar, depth + 1, maxDepth);
  }

  const windows = jxa.axElements(app, "AXWindows");
  for (const win of windows) {
    dumpElement(win, depth + 1, maxDepth);
  }
}

export function dumpFocusedApp(maxDepth = 3) {
  const system = $.AXUIElementCreateSystemWide();
  const trusted = jxa.axIsTrusted();

  console.log("AXSystemWide");
  console.log(`  trusted=${trusted}`);

  const attrs = jxa.axAttrNames(system);
  if (attrs.length > 0) {
    console.log(`  attrs=${JSON.stringify(attrs)}`);
  }

  if (!trusted) {
    console.log("  <Accessibility access is not granted to osascript/JXA>");
    return;
  }

  const info = jxa.frontmostAppInfo();
  const app = jxa.frontmostAppElement();
  if (info) {
    console.log(`  frontmost=${JSON.stringify(info.name)} pid=${info.pid}`);
  }

  if (!app) {
    console.log("  <Could not create AX application element for frontmost app>");
    return;
  }

  dumpAppElement(app, 1, maxDepth);
}

export function dumpFocusedElement(maxDepth = 3) {
  const system = $.AXUIElementCreateSystemWide();
  const trusted = jxa.axIsTrusted();

  console.log("AXSystemWide");
  console.log(`  trusted=${trusted}`);

  if (!trusted) {
    console.log("  <Accessibility access is not granted to osascript/JXA>");
    return;
  }

  const focusedEl = jxa.axElement(system, "AXFocusedUIElement");
  if (!focusedEl) {
    console.log("  <AXFocusedUIElement unavailable>");
    return;
  }

  dumpElement(focusedEl, 1, maxDepth);
}
