import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.VoiceOverUtility";
const panes = {
  gg: "General",
  gv: "Verbosity",
  gs: "Speech",
  gn: "Navigation",
  gw: "Web",
  gu: "Sound",
  gi: "Visuals",
  gc: "Commands",
  gb: "Braille",
  ga: "Activities",
  gr: "Recognition",
  gh: "Screen Sharing",
};
const dialogs = {
  fi: { item: "Import Preferences…", label: /^(Open|Import)$/ },
  fe: { item: "Export Preferences…", label: /^Save$/ },
  fp: {
    item: "Set Up Portable Preferences…",
    label: /^(Choose|Select|Create|Set Up|Set Up Portable Preferences.*)$/,
  },
};

test("every VoiceOver Utility binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/VoiceOverUtility/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...Object.keys(panes), ...Object.keys(dialogs), "js"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "VoiceOver Utility chords select each settings category",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(() => probe.menu(bundle, "View", "General").catch(() => undefined), 15_000);
        const selected = async (label: string) => {
          const marked =
            label === "Sound" ? undefined : (await probe.menu(bundle, "View", label)).mark;
          if (marked) return true;
          const category = label === "Recognition" ? "VoiceOver Recognition" : label;
          const nodes = flattenAX(await probe.windows(bundle, 9));
          return nodes.some(
            (node) =>
              node.selected === true &&
              flattenAX([node]).some((child) =>
                [child.title, child.description, child.value].includes(category),
              ),
          )
            ? true
            : undefined;
        };
        const select = async (label: string) => {
          await probe.press(bundle, "View", label);
          await waitFor(() => selected(label), 12_000);
        };
        try {
          for (const [sequence, label] of Object.entries(panes)) {
            const item = label === "Sound" ? undefined : await probe.menu(bundle, "View", label);
            if (item?.enabled === false && ["gr", "gh"].includes(sequence)) {
              await app.expectFailure(sequence, /Menu item .* is disabled/);
              continue;
            }
            await select(label === panes.gg ? panes.gv : panes.gg);
            expect(await selected(label)).toBeUndefined();
            await app.runChecked(sequence);
            await waitFor(() => selected(label), 12_000).catch((cause) => {
              throw new Error(`VoiceOver Utility did not select ${label}`, { cause });
            });
          }
        } finally {
          await select(panes.gg);
        }
      }),
    );
  },
  240_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "VoiceOver Utility chords open preference dialogs and focus search",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(
          () => probe.menu(bundle, "File", "Import Preferences…").catch(() => undefined),
          15_000,
        );
        for (const [sequence, { item, label }] of Object.entries(dialogs)) {
          if (sequence === "fp" && (await probe.menu(bundle, "File", item)).enabled === false) {
            await app.expectFailure(sequence, /Menu item .* is disabled/);
            continue;
          }
          const dialog = async () => {
            const nodes = flattenAX(await probe.windows(bundle, 10));
            if (sequence === "fp") {
              return nodes.find((node) => {
                if (node.role !== "AXSheet") return false;
                const buttons = new Set(
                  flattenAX([node])
                    .filter(({ role }) => role === "AXButton")
                    .map(({ title }) => title),
                );
                return buttons.has("OK") && buttons.has("Cancel");
              });
            }
            return nodes.find(
              (node) =>
                ["AXButton", "AXWindow", "AXStaticText"].includes(node.role ?? "") &&
                [node.title, node.description, node.value].some(
                  (text) => typeof text === "string" && label.test(text),
                ),
            );
          };
          expect(await dialog()).toBeUndefined();
          try {
            await app.runChecked(sequence);
            await waitFor(dialog, 12_000).catch(async (cause) => {
              const nodes = flattenAX(await probe.windows(bundle, 10)).filter(({ role }) =>
                ["AXWindow", "AXSheet", "AXButton", "AXTextField"].includes(role ?? ""),
              );
              const controls = nodes.map(({ role, title, description, id }) => ({
                role,
                title,
                description,
                id,
              }));
              throw new Error(
                `VoiceOver Utility ${sequence} did not open its dialog: ` +
                  JSON.stringify(controls.slice(0, 40)),
                { cause },
              );
            });
          } finally {
            const cancel = flattenAX(await probe.windows(bundle, 10)).find(
              ({ role, title, description }) =>
                role === "AXButton" && [title, description].includes("Cancel"),
            );
            if (cancel?.position && cancel.size) {
              await probe.clickPoint(
                cancel.position[0] + cancel.size[0] / 2,
                cancel.position[1] + cancel.size[1] / 2,
              );
            } else await probe.key(53);
            await waitFor(async () => ((await dialog()) ? undefined : true));
          }
        }

        const searchFocused = async () => {
          const focus = await probe.focus(bundle).catch(() => undefined);
          return (
            focus?.subrole === "AXSearchField" ||
            (focus?.role === "AXTextField" && [focus.title, focus.description].includes("Search"))
          );
        };
        await probe.press(bundle, "View", panes.gg);
        expect(await searchFocused()).toBe(false);
        try {
          await app.runChecked("js");
          await waitFor(async () => ((await searchFocused()) ? true : undefined), 12_000);
        } finally {
          await probe.key(53);
          await probe.press(bundle, "View", panes.gv);
          await probe.press(bundle, "View", panes.gg);
        }
      }),
    );
  },
  120_000,
);
