import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const id = "com.apple.TextEdit";
const escape = 53;
const command = 1 << 20;
const caseKeys = ["fn", "fo", "fs", "fe", "sf", "sr", "tp", "tr", "tv", "tw", "ta"] as const;

function behavior(
  app: ChordApp,
  probe: MacOSProbe,
): Record<(typeof caseKeys)[number], () => Promise<void>> {
  const window = (depth = 0) => probe.window(id, depth);
  const documents = async () =>
    (await probe.windows(id)).filter(({ subrole }) => subrole === "AXStandardWindow");
  const newDocument = async (open: () => Promise<void>) => {
    const count = (await documents()).length;
    await open();
    await waitFor(async () =>
      (await documents()).length === count + 1 && (await window()).title?.startsWith("Untitled")
        ? true
        : undefined,
    );
    return count;
  };
  const control = async (role: string, label: RegExp) =>
    flattenAX(await probe.windows(id, 6)).find(
      (node) => node.role === role && label.test(node.title ?? node.description ?? ""),
    );
  const closeNewDocument = async (before: number) => {
    const title = (await window()).title;
    expect(title).toMatch(/^Untitled/);
    await probe.closeWindow(id, title!);
    await waitFor(async () => {
      const document = (await probe.windows(id, 8)).find((node) => node.title === title);
      const sheet = document && flattenAX([document]).find((node) => node.role === "AXSheet");
      const discard =
        sheet &&
        flattenAX([sheet]).find(
          (node) => node.role === "AXButton" && /^(Delete|Don.t Save)$/.test(node.title ?? ""),
        );
      if (discard?.title) await probe.pressControl(id, "AXButton", discard.title);
      return (await documents()).length === before ? true : undefined;
    });
  };
  const panel = async (sequence: string, button: RegExp) => {
    expect(await control("AXButton", /^Cancel$/)).toBeUndefined();
    await app.runChecked(sequence);
    try {
      await waitFor(async () => {
        if (await control("AXButton", /^Cancel$/)) return control("AXButton", button);
      });
    } finally {
      if (await control("AXButton", /^Cancel$/)) await probe.pressControl(id, "AXButton", "Cancel");
      await waitFor(async () => (!(await control("AXButton", /^Cancel$/)) ? true : undefined));
    }
  };
  const replaceControls = async () => {
    const buttons = flattenAX(await probe.windows(id, 8)).filter(
      (node) => node.role === "AXButton" && node.subrole === "AXSegment",
    );
    return ["Replace", "All"].every((label) => buttons.some((node) => node.description === label));
  };
  const search = async (sequence: "sf" | "sr", ready: () => Promise<boolean>) => {
    expect(await control("AXButton", /^Done$/)).toBeUndefined();
    await app.runChecked(sequence);
    try {
      await waitFor(async () => ((await ready()) ? true : undefined));
    } finally {
      if (await control("AXButton", /^Done$/)) await probe.pressControl(id, "AXButton", "Done");
      await waitFor(async () => (!(await control("AXButton", /^Done$/)) ? true : undefined));
    }
  };
  const searchFocused = (node: AXNode) =>
    node.subrole === "AXSearchField" ||
    (node.role === "AXTextField" && /find|search/i.test(node.description ?? node.title ?? ""));
  const formatItem = (title: string) => probe.menu(id, "Format", title).catch(() => undefined);
  const setBefore = async (before: string, after: string) => {
    if (!(await formatItem(before))?.enabled) await probe.press(id, "Format", after);
    await waitFor(async () => ((await formatItem(before))?.enabled ? true : undefined));
  };
  const changeFormat = async (sequence: string, before: string, after: string) => {
    await setBefore(before, after);
    expect((await formatItem(after))?.enabled).toBeFalsy();
    try {
      await app.runChecked(sequence);
      await waitFor(async () => ((await formatItem(after))?.enabled ? true : undefined));
    } finally {
      await setBefore(before, after);
    }
  };
  const textMode = async (sequence: string, before: string, after: string) => {
    const count = await newDocument(() => probe.press(id, "File", "New"));
    try {
      await changeFormat(sequence, before, after);
    } finally {
      await closeNewDocument(count);
    }
  };

  return {
    fn: async () => {
      const count = await newDocument(() => app.runChecked("fn"));
      await closeNewDocument(count);
    },
    fo: () => panel("fo", /^Open$/),
    fs: async () => {
      const count = await newDocument(() => probe.press(id, "File", "New"));
      try {
        await panel("fs", /^Save$/);
      } finally {
        await closeNewDocument(count);
      }
    },
    fe: () => panel("fe", /^Save$/),
    sf: () => search("sf", async () => searchFocused(await probe.focus(id))),
    sr: () => search("sr", replaceControls),
    tp: () => textMode("tp", "Make Plain Text", "Make Rich Text"),
    tr: () => textMode("tr", "Make Rich Text", "Make Plain Text"),
    tv: () => changeFormat("tv", "Prevent Editing", "Allow Editing"),
    tw: () => changeFormat("tw", "Wrap to Window", "Wrap to Page"),
    ta: () => changeFormat("ta", "Wrap to Page", "Wrap to Window"),
  };
}

test("every TextEdit binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/TextEdit/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...caseKeys].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "TextEdit chords operate on a local document",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    const directory = await mkdtemp(join(tmpdir(), "chordtest-textedit-"));
    const fixture = join(directory, "Chordtest TextEdit.rtf");
    try {
      await Bun.write(fixture, String.raw`{\rtf1\ansi Chordtest document\par Second line\par}`);
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(id, fixture);
          await waitFor(
            async () =>
              (await probe.window(id)).title?.includes("Chordtest TextEdit") ? true : undefined,
            12_000,
          );
          try {
            for (const [sequence, run] of Object.entries(behavior(app, probe))) {
              try {
                await run();
                console.log(`TextEdit ${sequence} passed`);
              } catch (cause) {
                throw new Error(`TextEdit ${sequence} failed`, { cause });
              }
            }
          } finally {
            await probe.key(escape);
            await probe.key(13, command);
          }
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  300_000,
);
