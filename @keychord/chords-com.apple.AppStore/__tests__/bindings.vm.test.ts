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
        const ready = (label: string) =>
          waitFor(async () => {
            const sheets = flattenAX(await probe.windows(bundle, 10)).filter(
              (node) => node.role === "AXSheet",
            );
            for (const sheet of sheets) {
              const content = flattenAX(sheet.children ?? []);
              if (
                content.some(
                  ({ value }) =>
                    typeof value === "string" && /^Welcome to the App\sStore$/.test(value),
                )
              ) {
                await probe.clickControl(bundle, "AXButton", "Continue");
                return;
              }
              if (content.some(({ value }) => value === "Stay Up to Date with Notifications")) {
                await probe.clickControl(bundle, "AXStaticText", "Not Now");
                return;
              }
            }
            return (await probe.menu(bundle, "Store", label).catch(() => undefined))?.enabled
              ? true
              : undefined;
          }, 15_000);
        const goto = async (label: string) => {
          if (await selected(label)) return;
          await ready(label);
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
        await goto(sections.gd);
        for (const [sequence, target] of Object.entries(sections)) {
          if (await selected(target)) await goto(sections.ga);
          expect(await selected(target)).toBeUndefined();
          await ready(target);
          await app.runChecked(sequence);
          try {
            await waitFor(() => selected(target), 15_000);
          } catch (cause) {
            const controls = flattenAX(await probe.windows(bundle, 8)).filter(
              (node) => node.selected || node.role === "AXSheet" || node.role === "AXWindow",
            );
            console.error(
              "App Store navigation state",
              JSON.stringify(
                controls.map(({ role, title, description, value }) => ({
                  role,
                  title,
                  description,
                  value,
                })),
              ),
            );
            throw new Error(`Expected ${sequence} to show ${target}`, { cause });
          }
          await goto(sections.gd);
        }

        expect(await searchFocused()).toBeUndefined();
        await ready("Search");
        await app.runChecked("g/");
        await waitFor(searchFocused, 10_000);
        await probe.key(53);
        await goto(sections.gd);

        const previousWindows = await probe.windows(bundle);
        const settingsOpen = async () =>
          (await probe.windows(bundle)).find(
            (window) =>
              window.title && !previousWindows.some((previous) => previous.title === window.title),
          );
        await app.runChecked("g,");
        const settings = await waitFor(settingsOpen, 10_000);
        await probe.closeWindow(bundle, settings.title!);
        await waitFor(async () => (!(await settingsOpen()) ? true : undefined), 10_000);
      }),
    );
  },
  300_000,
);
