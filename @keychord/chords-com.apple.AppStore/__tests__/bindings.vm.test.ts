import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.AppStore";
const sections = {
  gd: "Discover",
  ga: "Arcade",
  gc: "Create",
  gw: "Work",
  gp: "Play",
  ge: "Develop",
  gg: "Categories",
  gu: "Updates",
};

test("every App Store binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/AppStore/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...Object.keys(sections), "g/", "g,"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "App Store chords change sections, focus search, and open settings",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);

        const selected = async (label: string) => {
          const main = await probe.window(bundle, 8).catch(() => undefined);
          if (!main) return;
          if (main.title === label) return true;
          return flattenAX([main]).some(
            (node) =>
              (node.selected === true || (node.role === "AXRadioButton" && node.value === 1)) &&
              flattenAX([node]).some((item) =>
                [item.title, item.description, item.value].includes(label),
              ),
          )
            ? true
            : undefined;
        };
        const goto = async (label: string) => {
          await probe.press(bundle, "Store", label);
          await waitFor(() => selected(label), 15_000);
        };
        const searchFocused = async () => {
          const focus = await probe.focus(bundle).catch(() => undefined);
          return focus?.subrole === "AXSearchField" ||
            (focus?.role === "AXTextField" &&
              [focus.description, focus.title].some((label) => /search/i.test(label ?? "")))
            ? true
            : undefined;
        };
        const settingsOpen = async () =>
          (await probe.windows(bundle)).some((window) => window.title === "App Store Settings")
            ? true
            : undefined;

        await waitFor(() => probe.menu(bundle, "Store", "Search").catch(() => undefined), 15_000);
        await goto(sections.gd);
        for (const [sequence, target] of Object.entries(sections)) {
          if (await selected(target)) await goto(sections.ga);
          expect(await selected(target)).toBeUndefined();
          await app.runChecked(sequence);
          await waitFor(() => selected(target), 15_000);
          await goto(sections.gd);
        }

        expect(await searchFocused()).toBeUndefined();
        await app.runChecked("g/");
        await waitFor(searchFocused, 10_000);
        await probe.key(53);
        await goto(sections.gd);

        expect(await settingsOpen()).toBeUndefined();
        await app.runChecked("g,");
        await waitFor(settingsOpen, 10_000);
        await probe.key(13, 1 << 20);
        await waitFor(async () => (!(await settingsOpen()) ? true : undefined), 10_000);
      }),
    );
  },
  300_000,
);
