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

const id = "com.apple.ScriptEditor2";
const escape = 53;
const command = 1 << 20;
const resultText = "Chordtest execution result";

function behavior(app: ChordApp, probe: MacOSProbe) {
  const menu = (...path: string[]) => probe.menu(id, ...path);
  const nodes = async () => flattenAX(await probe.windows(id, 7));
  const button = async (title: RegExp) =>
    (await nodes()).find((node) => node.role === "AXButton" && title.test(node.title ?? ""));
  const editor = async () =>
    (await nodes()).find(
      (node) => node.role === "AXTextArea" && /script source/i.test(node.description ?? ""),
    );
  const newScript = async (open: () => Promise<void>) => {
    const before = (await probe.windows(id)).length;
    await open();
    await waitFor(async () =>
      (await probe.windows(id)).length === before + 1 &&
      (await probe.window(id)).title?.startsWith("Untitled")
        ? true
        : undefined,
    );
    return before;
  };
  const closeScript = async (before: number) => {
    await probe.key(13, command);
    await waitFor(async () => {
      const discard = await button(/^Don.t Save$/);
      if (discard?.title) await probe.pressControl(id, "AXButton", discard.title);
      return (await probe.windows(id)).length === before ? true : undefined;
    });
  };
  const replaceSource = async (text: string) => {
    const source = await waitFor(editor);
    await probe.clickControl(id, "AXTextArea", source.description!);
    await waitFor(async () =>
      (await probe.focus(id)).description === source.description ? true : undefined,
    );
    const copy = Bun.spawn(["/usr/bin/pbcopy"], { stdin: Buffer.from(text) });
    expect(await copy.exited).toBe(0);
    await probe.key(0, command);
    await probe.key(9, command);
    await waitFor(async () => ((await editor())?.value === text ? true : undefined));
  };
  const withScript = async (text: string, check: () => Promise<void>) => {
    const before = await newScript(() => probe.press(id, "File", "New"));
    try {
      await replaceSource(text);
      await check();
    } finally {
      if ((await menu("Script", "Stop")).enabled) await probe.press(id, "Script", "Stop");
      await closeScript(before);
    }
  };
  const panel = async (sequence: string, confirm: RegExp) => {
    expect(await button(/^Cancel$/)).toBeUndefined();
    await app.runChecked(sequence);
    try {
      await waitFor(async () => {
        if (await button(/^Cancel$/)) return button(confirm);
      });
    } finally {
      await probe.key(escape);
      await waitFor(async () => (!(await button(/^Cancel$/)) ? true : undefined));
    }
  };
  const findBar = (node: AXNode) =>
    node.subrole === "AXSearchField" ||
    (node.role === "AXTextField" && /find|search/i.test(node.description ?? node.title ?? ""));
  const search = async (sequence: string, replace = false) => {
    expect(findBar(await probe.focus(id))).toBe(false);
    await app.runChecked(sequence);
    try {
      await waitFor(async () => (findBar(await probe.focus(id)) ? true : undefined));
      if (replace) await waitFor(() => button(/^Replace All$/));
    } finally {
      if ((await menu("Edit", "Find", "Hide Find Bar").catch(() => undefined))?.enabled)
        await probe.press(id, "Edit", "Find", "Hide Find Bar");
      else await probe.key(escape);
      await waitFor(async () => (!findBar(await probe.focus(id)) ? true : undefined));
    }
  };
  const hide = (label: string) => menu("View", `Hide ${label}`).catch(() => undefined);
  const showView = async (sequence: string, label: string) => {
    if (await hide(label)) await probe.press(id, "View", `Hide ${label}`);
    await waitFor(async () => (!(await hide(label)) ? true : undefined));
    try {
      await app.runChecked(sequence);
      await waitFor(() => hide(label));
    } finally {
      if (await hide(label)) await probe.press(id, "View", `Hide ${label}`);
      await waitFor(async () => (!(await hide(label)) ? true : undefined));
    }
  };
  const running = async () => (await menu("Script", "Stop")).enabled === true;

  return {
    fn: async () => {
      const before = await newScript(() => app.runChecked("fn"));
      await closeScript(before);
    },
    fo: () => panel("fo", /^Open$/),
    fe: () => panel("fe", /^(Save|Export)$/),
    sf: () => search("sf"),
    sr: () => search("sr", true),
    rc: () =>
      withScript(`RETURN "${resultText}"`, async () => {
        await app.runChecked("rc");
        await waitFor(async () =>
          String((await editor())?.value).trim() === `return "${resultText}"` ? true : undefined,
        );
      }),
    rr: () =>
      withScript(`return "${resultText}"`, async () => {
        if (!(await hide("Result"))) await probe.press(id, "View", "Show Result");
        expect(
          (await nodes()).some(
            (node) =>
              String(node.value).includes(resultText) &&
              /script result/i.test(node.description ?? ""),
          ),
        ).toBe(false);
        await app.runChecked("rr");
        await waitFor(async () =>
          (await nodes()).find(
            (node) =>
              /script result/i.test(node.description ?? "") &&
              String(node.value).includes(resultText),
          ),
        );
      }),
    rs: () =>
      withScript("repeat\n  delay 1\nend repeat", async () => {
        await probe.press(id, "Script", "Run");
        await waitFor(async () => ((await running()) ? true : undefined));
        await app.runChecked("rs");
        await waitFor(async () => ((await running()) ? undefined : true));
        expect((await menu("Script", "Run")).enabled).toBe(true);
      }),
    vd: () => showView("vd", "Description"),
    vr: () => showView("vr", "Result"),
    vl: () => showView("vl", "Log"),
    vn: () => showView("vn", "Navigation Bar"),
  };
}

const caseKeys = ["fn", "fo", "fe", "sf", "sr", "rc", "rr", "rs", "vd", "vr", "vl", "vn"];

test("every Script Editor binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/ScriptEditor2/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...caseKeys].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Script Editor chords edit, compile and control local AppleScripts",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    const directory = await mkdtemp(join(tmpdir(), "chordtest-script-editor-"));
    const fixture = join(directory, "Chordtest Script Editor.applescript");
    try {
      await Bun.write(fixture, 'return "Chordtest baseline"\n');
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(id, fixture);
          await waitFor(
            async () =>
              (await probe.window(id)).title?.includes("Chordtest Script Editor")
                ? true
                : undefined,
            12_000,
          );
          try {
            const cases = behavior(app, probe);
            expect(Object.keys(cases).sort()).toEqual([...caseKeys].sort());
            for (const [sequence, run] of Object.entries(cases)) {
              try {
                await run();
                console.log(`Script Editor ${sequence} passed`);
              } catch (cause) {
                throw new Error(`Script Editor ${sequence} failed`, { cause });
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
