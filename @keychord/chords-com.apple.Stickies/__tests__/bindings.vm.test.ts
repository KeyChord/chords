import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const id = "com.apple.Stickies";
const escape = 53;
const command = 1 << 20;
const noteText = "Chordtest sticky";
const colors = {
  cy: "Yellow",
  cb: "Blue",
  cg: "Green",
  cp: "Pink",
  cu: "Purple",
  ca: "Gray",
};

function behavior(app: ChordApp, probe: MacOSProbe) {
  const menu = (...path: string[]) => probe.menu(id, ...path);
  const window = () => probe.window(id);
  const defaultDocuments = () => probe.windows(id);
  const button = async (title: RegExp) =>
    flattenAX([await probe.window(id, 12), ...(await probe.windows(id, 12))]).find(
      (node) =>
        node.role === "AXButton" &&
        [node.title, node.description].some((label) => title.test(label ?? "")),
    );
  const waitForNote = () =>
    waitFor(async () => ((await window()).title === noteText ? true : undefined));
  const makeNote = async (open: () => Promise<void>) => {
    const count = (await defaultDocuments()).length;
    await open();
    await waitFor(async () => {
      const current = await defaultDocuments();
      if (current.length !== count + 1) return;
      const [note, focus] = await Promise.all([window(), probe.focus(id)]);
      if (note.subrole === "AXStandardWindow" && focus.role === "AXTextArea" && !focus.value) {
        return note;
      }
    }).catch(async (cause) => {
      throw new Error(
        "Stickies did not focus a new empty note: " +
          JSON.stringify({
            count,
            windows: await defaultDocuments(),
            focus: await probe.focus(id),
          }),
        { cause },
      );
    });
    return count;
  };
  const countNotes = (count: number) =>
    waitFor(async () => ((await defaultDocuments()).length === count ? true : undefined));
  const pasteNote = async () => {
    const copy = Bun.spawn(["/usr/bin/pbcopy"], { stdin: Buffer.from(noteText) });
    expect(await copy.exited).toBe(0);
    await probe.press(id, "Edit", "Paste");
    await waitFor(async () => (await probe.focus(id)).value === noteText || undefined).catch(() =>
      probe.setFocusedText(id, noteText),
    );
    await waitForNote();
  };
  const deleteNote = async () => {
    await waitFor(() => button(/^Delete Note$/));
    await probe.pressControl(id, "AXButton", "Delete Note");
    await waitFor(async () =>
      (await defaultDocuments()).some((node) => node.title === noteText) ? undefined : true,
    );
  };
  const panel = async (sequence: string, confirm: RegExp) => {
    if ((await probe.front()) !== id) await probe.activate(id);
    await waitForNote();
    expect(await button(/^Cancel$/)).toBeUndefined();
    await app.runChecked(sequence);
    try {
      await waitFor(async () => {
        if (await button(/^Cancel$/)) return button(confirm);
      }, 15_000);
    } finally {
      await probe.key(escape);
      await waitFor(async () => (!(await button(/^Cancel$/)) ? true : undefined));
    }
  };
  const setColor = async (color: string) => {
    if (!(await menu("Color", color)).mark) await probe.press(id, "Color", color);
    await waitFor(async () => ((await menu("Color", color)).mark ? true : undefined));
  };
  const changeColor = async (sequence: string, color: string) => {
    const before = color === "Yellow" ? "Blue" : "Yellow";
    await setColor(before);
    expect((await menu("Color", color)).mark).toBeFalsy();
    try {
      await app.runChecked(sequence);
      await waitFor(async () => ((await menu("Color", color)).mark ? true : undefined));
    } finally {
      await setColor(before);
    }
  };
  const toggle = async (sequence: string, title: string) => {
    const mark = (await menu("Window", title)).mark;
    try {
      await app.runChecked(sequence);
      await waitFor(async () => ((await menu("Window", title)).mark !== mark ? true : undefined));
    } finally {
      if ((await menu("Window", title)).mark !== mark) await probe.press(id, "Window", title);
      await waitFor(async () => ((await menu("Window", title)).mark === mark ? true : undefined));
    }
  };
  const setCollapse = async (collapsed: boolean) => {
    const action = collapsed ? "Collapse" : "Expand";
    const other = collapsed ? "Expand" : "Collapse";
    const state = await waitFor(async () => {
      const current = await menu("Window", action).catch(() => undefined);
      if (current?.enabled) return "transition";
      const opposite = await menu("Window", other).catch(() => undefined);
      if (opposite?.enabled) return "already";
    }, 10_000);
    if (state === "transition") await probe.press(id, "Window", action);
    await waitFor(
      async () => (await menu("Window", other).catch(() => undefined))?.enabled || undefined,
    );
  };
  const changeCollapse = async (sequence: string, collapsed: boolean) => {
    if ((await probe.front()) !== id) await probe.activate(id);
    const note = async () => (await defaultDocuments()).find(({ title }) => title === noteText);
    const focusNote = async () => {
      if ((await window()).title !== noteText) await probe.raiseWindow(id, noteText);
      await waitFor(async () => (await window()).title === noteText || undefined);
    };
    const height = async () => (await note())?.size?.[1];
    if (collapsed) {
      await focusNote();
      await setCollapse(false);
    } else {
      const expand = () => menu("Window", "Expand").catch(() => undefined);
      if (!(await expand())?.enabled) {
        const current = await waitFor(note);
        if (current.position && current.size) {
          const [x, y] = current.position;
          const [width, height] = current.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
        }
      }
      await waitFor(async () => (await expand())?.enabled || undefined, 12_000).catch(
        async (cause) => {
          const commands = flattenAX([await menu("Window")])
            .filter((entry) => /^(Collapse|Expand)(?: All)?$/.test(entry.title ?? ""))
            .map(({ title, enabled, id, key, keyModifiers }) => ({
              title,
              enabled,
              id,
              key,
              keyModifiers,
            }));
          throw new Error(
            "Stickies did not enable Expand on the collapsed note: " +
              JSON.stringify({
                note: await note(),
                window: await window(),
                focus: await probe.focus(id),
                commands,
              }),
            { cause },
          );
        },
      );
    }
    const before = await waitFor(height);
    expect(before).toBeGreaterThan(0);
    await app.runChecked(sequence);
    await waitFor(async () => {
      const after = await height();
      if (after !== undefined && (collapsed ? after < before : after > before)) return after;
    });
  };

  return {
    prepare: async () => {
      await makeNote(() => probe.press(id, "File", "New Note"));
      await pasteNote();
    },
    cleanup: async () => {
      if (!(await defaultDocuments()).some((node) => node.title === noteText)) return;
      await probe.raiseWindow(id, noteText);
      await probe.press(id, "File", "Close");
      await deleteNote();
    },
    cases: {
      nn: async () => {
        const count = await makeNote(() => app.runChecked("nn"));
        await probe.press(id, "File", "Close");
        await countNotes(count);
        await probe.raiseWindow(id, noteText);
      },
      ni: () => panel("ni", /^(Open|Import)$/),
      ne: () => panel("ne", /^(Save|Export)$/),
      sf: async () => {
        const findPanel = async () =>
          (await probe.windows(id)).find(({ title }) =>
            /^(Find|Find and Replace)$/.test(title ?? ""),
          );
        expect(await findPanel()).toBeUndefined();
        await app.runChecked("sf");
        const panel = await waitFor(findPanel);
        try {
          expect(panel.title).toBeDefined();
          await waitFor(async () => {
            const focus = await probe.focus(id);
            if (focus.role === "AXTextField" || focus.subrole === "AXSearchField") return focus;
          });
        } finally {
          await probe.key(escape);
          if (await findPanel()) {
            await probe.raiseWindow(id, panel.title!);
            await probe.key(13, command);
          }
          await waitFor(async () => (!(await findPanel()) ? true : undefined));
          await probe.raiseWindow(id, noteText);
        }
      },
      ...Object.fromEntries(
        Object.entries(colors).map(([key, color]) => [key, () => changeColor(key, color)]),
      ),
      vf: () => toggle("vf", "Float on Top"),
      vt: () => toggle("vt", "Translucent"),
      vc: () => changeCollapse("vc", true),
      ve: () => changeCollapse("ve", false),
      nq: async () => {
        expect(await button(/^Delete Note$/)).toBeUndefined();
        await app.runChecked("nq");
        await deleteNote();
      },
    },
  };
}

const caseKeys = ["nn", "nq", "ni", "ne", "sf", "vf", "vt", "vc", "ve", ...Object.keys(colors)];

test("every Stickies binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Stickies/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...caseKeys].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Stickies chords create, style, find and delete notes",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(id);
        await waitFor(async () => {
          const item = await probe.menu(id, "File", "New Note").catch(() => undefined);
          if (!item?.enabled || (await probe.front()) !== id) return;
          const windows = await probe.windows(id);
          const focus = await probe.focus(id);
          if (
            windows.some((window) => window.subrole === "AXStandardWindow") &&
            focus.role === "AXTextArea"
          )
            return item;
        }, 12_000);
        const { cases, prepare, cleanup } = behavior(app, probe);
        expect(Object.keys(cases).sort()).toEqual([...caseKeys].sort());
        try {
          await prepare();
          for (const [sequence, run] of Object.entries(cases)) {
            try {
              await run();
              console.log(`Stickies ${sequence} passed`);
            } catch (cause) {
              throw new Error(`Stickies ${sequence} failed`, { cause });
            }
          }
        } finally {
          await probe.key(escape);
          await cleanup();
        }
      }),
    );
  },
  300_000,
);
