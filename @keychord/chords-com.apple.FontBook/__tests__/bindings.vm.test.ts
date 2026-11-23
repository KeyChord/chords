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
  vv: "View as Specimen",
};

test("every Font Book binding has a behavior case", () => {
  expect(sequences).toEqual(
    ["gs", "jf", "fa", "fv", "ns", "nw", "vb", "vi", ...Object.keys(previewModes)].sort(),
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
        const nodes = async () => flattenAX(await probe.windows(bundleId, 10));

        // List view exposes a stock font as a selectable row regardless of the user's preview mode.
        const originalMode = (
          await Promise.all(
            Object.values(previewModes).map(async (title) => ({
              title,
              mark: (await menu(title)).mark,
            })),
          )
        ).find((item) => item.mark)?.title;
        expect(originalMode).toBeDefined();
        try {
          await probe.press(bundleId, "View", "View as List");
          await waitFor(async () => (await menu("View as List")).mark);
          await waitFor(
            () =>
              probe.selectRow(bundleId, "Helvetica").then(
                () => true,
                () => undefined,
              ),
            12_000,
          );

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

        const toggle = async (sequence: string, show: string, hide: string) => {
          const isShown = async () => Boolean(await menu(hide).catch(() => undefined));
          const before = await isShown();
          await app.runChecked(sequence);
          await waitFor(() => menu(before ? show : hide).catch(() => undefined));
          await app.runChecked(sequence);
          await waitFor(() => menu(before ? hide : show).catch(() => undefined));
        };
        await toggle("vi", "Show Info Pane", "Hide Info Pane");
        await toggle("vb", "Show Sidebar", "Hide Sidebar");

        await app.runChecked("jf");
        await waitFor(async () => {
          const focus = await probe.focus(bundleId);
          return focus.subrole === "AXSearchField" ? focus : undefined;
        });
        await probe.key(53);

        const hasButton = (elements: AXNode[], label: string) =>
          elements.some((element) => element.role === "AXButton" && element.title === label);
        const openPanel = async () => {
          const elements = await nodes();
          return hasButton(elements, "Cancel") && hasButton(elements, "Open");
        };
        for (const sequence of ["fa", "fv"]) {
          expect(await openPanel()).toBeFalse();
          await app.runChecked(sequence);
          await waitFor(async () => ((await openPanel()) ? true : undefined));
          await probe.key(53);
          await waitFor(async () => ((await openPanel()) ? undefined : true));
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
        await probe.key(53);
        await waitFor(async () => ((await smartCollection()) ? undefined : true));

        const before = (await standardWindows()).length;
        await app.runChecked("nw");
        await waitFor(async () => ((await standardWindows()).length > before ? true : undefined));
        await probe.key(13, 1 << 20);
        await waitFor(async () => ((await standardWindows()).length === before ? true : undefined));

        await app.runChecked("gs");
        await waitFor(async () =>
          (await probe.windows(bundleId)).find((window) =>
            /settings|preferences/i.test(window.title ?? ""),
          ),
        );
        await probe.key(13, 1 << 20);
      }),
    );
  },
  120_000,
);
