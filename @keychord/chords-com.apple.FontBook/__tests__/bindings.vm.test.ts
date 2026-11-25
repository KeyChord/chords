import { expect, test } from "bun:test";
import {
  flattenAX,
  type AXNode,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.FontBook";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/FontBook/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };
const sequences = Object.keys(definition.chords)
  .filter((key) => !key.startsWith("?"))
  .sort();

const previewModes = {
  vg: "View as Grid",
  vl: "View as List",
  vs: "View as Samples",
};

test("every Font Book binding has a behavior case", () => {
  expect(sequences).toEqual(
    ["gs", "jf", "fa", "fv", "ns", "nw", "vb", "vi", "vv", ...Object.keys(previewModes)].sort(),
  );
});

test.skipIf(!macOSUITestsEnabled)(
  "Font Book switches previews, focuses search, and opens font and collection workflows",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        const standardWindows = async () =>
          (await probe.windows(bundleId)).filter((window) => window.subrole === "AXStandardWindow");
        await waitFor(async () => (await standardWindows())[0], 12_000);
        const menu = (title: string) => probe.menu(bundleId, "View", title);
        const nodes = async () =>
          flattenAX([await probe.window(bundleId, 8), ...(await probe.windows(bundleId, 8))]);

        const originalMode = await waitFor(async () => {
          const modes = await Promise.all(Object.values(previewModes).map(menu));
          return modes.find(({ mark }) => mark)?.title;
        }, 12_000);
        try {
          for (const [sequence, title] of Object.entries(previewModes)) {
            if ((await menu(title)).mark) {
              const alternative = title === "View as Grid" ? "View as List" : "View as Grid";
              await probe.press(bundleId, "View", alternative);
              await waitFor(async () => (await menu(alternative)).mark);
            }
            await app.runChecked(sequence);
            await waitFor(async () => (await menu(title)).mark);
          }
        } finally {
          if (originalMode) await probe.press(bundleId, "View", originalMode);
        }

        await probe.press(bundleId, "View", "View as List");
        await waitFor(async () => (await menu("View as List")).mark);
        const typeface = await waitFor(async () => {
          const elements = flattenAX(await probe.windows(bundleId, 15));
          return elements.find(
            (node) =>
              node.role === "AXGroup" &&
              node.position &&
              node.size &&
              node.size[1] < 85 &&
              flattenAX([node]).some(
                ({ role, value }) =>
                  role === "AXStaticText" &&
                  typeof value === "string" &&
                  /^\d+ styles?$/.test(value),
              ) &&
              flattenAX([node]).some(
                ({ role, description }) => role === "AXImage" && description === "Lock",
              ),
          );
        }, 12_000);
        const name = flattenAX([typeface]).find(
          (node) =>
            node.role === "AXStaticText" &&
            node.position &&
            node.size &&
            typeof node.value === "string" &&
            node.value.length > 0 &&
            !/^\d+ styles?$/.test(node.value),
        );
        const hit = name ?? typeface;
        const [x, y] = hit.position!;
        const [width, height] = hit.size!;
        const specimen = () => menu("View as Specimen").catch(() => undefined);
        const enabled = async () => {
          const item = await specimen();
          return item?.enabled ? item : undefined;
        };
        await probe.clickPoint(x + width / 2, y + height / 2);
        await probe.key(36);
        const entered = await waitFor(enabled, 2_000).catch(() => undefined);
        if (!entered) await probe.doubleClickPoint(x + width / 2, y + height / 2);
        const current =
          entered ??
          (await waitFor(enabled, 12_000).catch(async (cause) => {
            throw new Error(
              "Font Book did not open the selected typeface: " +
                JSON.stringify({ focus: await probe.focus(bundleId), name: name?.value }),
              { cause },
            );
          }));
        if (current.mark) {
          const options = flattenAX([await probe.menu(bundleId, "View")]);
          const alternate = options.find(
            ({ title, enabled }) =>
              enabled && title?.startsWith("View as ") && title !== "View as Specimen",
          );
          expect(alternate?.title).toBeDefined();
          await probe.press(bundleId, "View", alternate!.title!);
          await waitFor(async () => ((await specimen())?.mark ? undefined : true));
        }
        await app.runChecked("vv");
        await waitFor(async () => (await specimen())?.mark);
        await probe.press(bundleId, "View", "Back");
        await waitFor(async () => {
          if ((await probe.front()) !== bundleId) {
            await probe.activate(bundleId);
            return;
          }
          const list = await menu("View as List").catch((error: unknown) => {
            if (error instanceof Error && error.message.includes("The app has no menu bar")) return;
            throw error;
          });
          return list?.enabled || undefined;
        }, 12_000);
        if (originalMode !== "View as List") await probe.press(bundleId, "View", originalMode);

        const toggle = async (
          sequence: string,
          show: string,
          hide: string,
          current: () => Promise<string | undefined>,
        ) => {
          const before = await waitFor(current);
          for (const expected of [before === show ? hide : show, before]) {
            await app.runChecked(sequence);
            await waitFor(async () => (await current()) === expected || undefined).catch(
              async (cause) => {
                throw new Error(
                  `Font Book expected ${expected}, observed ${(await current()) ?? "no control"}`,
                  { cause },
                );
              },
            );
          }
        };
        await toggle("vi", "Show Info Pane", "Hide Info Pane", async () => {
          const view = flattenAX([await probe.menu(bundleId, "View")]);
          return view.find(
            ({ title, enabled }) => enabled && /^(Show|Hide) Info Pane$/.test(title ?? ""),
          )?.title;
        });
        await toggle("vb", "Show Sidebar", "Hide Sidebar", async () => {
          const toolbar = flattenAX([await probe.window(bundleId, 7)]).find(
            (node) => node.role === "AXToolbar",
          );
          return flattenAX(toolbar ? [toolbar] : []).find(
            ({ role, description, enabled }) =>
              role === "AXButton" && enabled && /^(Show|Hide) Sidebar$/.test(description ?? ""),
          )?.description;
        });

        await app.runChecked("jf");
        await waitFor(async () => {
          const focus = await probe.focus(bundleId);
          return focus.subrole === "AXSearchField" ? focus : undefined;
        });
        await probe.key(53);

        const hasButton = (elements: AXNode[], label: string) =>
          elements.some(
            (element) =>
              element.role === "AXButton" && [element.title, element.description].includes(label),
          );
        const openPanel = async () => {
          const elements = await nodes();
          return hasButton(elements, "Cancel") && hasButton(elements, "Open");
        };
        for (const sequence of ["fa", "fv"]) {
          expect(await openPanel()).toBeFalse();
          try {
            await app.runChecked(sequence);
            await waitFor(async () => ((await openPanel()) ? true : undefined));
          } finally {
            if (await openPanel()) {
              await probe.pressControl(bundleId, "AXButton", "Cancel");
              await waitFor(async () => ((await openPanel()) ? undefined : true), 12_000);
            }
          }
        }

        const smartCollection = async () =>
          (await nodes()).find((element) =>
            [element.title, element.description, element.value].some(
              (label) =>
                typeof label === "string" &&
                /^(new smart collection|collection name):?$/i.test(label),
            ),
          );
        await app.runChecked("ns");
        await waitFor(smartCollection);
        console.log("Font Book ns opened the Smart Collection dialog");
        await probe.pressControl(bundleId, "AXButton", "Cancel").catch(() => probe.key(53));
        await waitFor(async () => ((await smartCollection()) ? undefined : true), 12_000);

        const before = (await standardWindows()).length;
        await app.runChecked("nw");
        await waitFor(async () => ((await standardWindows()).length > before ? true : undefined));
        await probe.key(13, 1 << 20);
        await waitFor(async () => ((await standardWindows()).length === before ? true : undefined));

        const identity = ({ id, title, position }: AXNode) => JSON.stringify([id, title, position]);
        const prior = new Set((await probe.windows(bundleId)).map(identity));
        const settings = async () =>
          (await probe.windows(bundleId)).find(
            (window) => window.role === "AXWindow" && !prior.has(identity(window)),
          );
        await app.runChecked("gs");
        const opened = await waitFor(settings, 12_000).catch(async (cause) => {
          throw new Error(
            "Font Book did not open its Settings window: " +
              JSON.stringify(await probe.windows(bundleId)),
            { cause },
          );
        });
        if (opened.id || opened.title)
          await probe.closeWindow(bundleId, opened.id ?? opened.title!);
        else await probe.key(13, 1 << 20);
        await waitFor(async () => !(await settings()) || undefined);
      }),
    );
  },
  120_000,
);
