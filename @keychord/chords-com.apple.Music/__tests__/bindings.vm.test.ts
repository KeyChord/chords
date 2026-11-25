import { expect, test } from "bun:test";
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

const music = "com.apple.Music";
const first = "Chordtest Music 1";
const second = "Chordtest Music 2";
const track = (name: string) => Bun.fileURLToPath(new URL(name + ".m4a", import.meta.url));

const label = (node: AXNode) =>
  [node.title, node.description, node.value].filter(Boolean).join(" ");

const keys = [
  "a,",
  "gr",
  "ga",
  "gb",
  "gs",
  "g/",
  "np",
  "ns",
  "nf",
  "fi",
  "fu",
  "fe",
  "vn",
  "vb",
  "ve",
  "pp",
  "ph",
  "p[",
  "p]",
  "pro",
  "pra",
  "pr1",
] as const;

function cases(app: ChordApp, probe: MacOSProbe) {
  const nodes = async () => flattenAX(await probe.windows(music, 9));
  const control = (match: RegExp) =>
    waitFor(async () => (await nodes()).find((node) => match.test(label(node))), 12_000);
  const menu = (...path: string[]) => probe.menu(music, ...path);
  const windows = () => probe.windows(music);
  const escape = () => probe.key(53);
  const cancel = async () =>
    (await nodes()).find((node) => node.role === "AXButton" && /^Cancel(?: |$)/.test(label(node)));
  const closeDialog = async () => {
    const button = await cancel();
    if (button?.position && button.size) {
      await probe.clickPoint(
        button.position[0] + button.size[0] / 2,
        button.position[1] + button.size[1] / 2,
      );
    }
    await waitFor(async () => ((await cancel()) ? undefined : true));
  };
  const selection = async (section: string) =>
    (await nodes()).find(
      (node) =>
        (node.selected || node.value === 1) &&
        flattenAX([node]).some((child) =>
          [child.title, child.description, child.value].includes(section),
        ),
    );
  const goTo = async (key: string, expected: string) => {
    if (await selection(expected)) {
      const alternate = expected === "Songs" ? "Artists" : "Songs";
      await probe.selectRow(music, alternate);
      await waitFor(() => selection(alternate));
    }
    await app.runChecked(key);
    await waitFor(() => selection(expected));
  };
  const openPanel = async (key: string, button: string) => {
    await app.runChecked(key);
    try {
      await control(new RegExp("^" + button + "(?: |$)"));
      await control(/^Cancel(?: |$)/);
    } finally {
      await closeDialog();
    }
  };
  const newWindow = async (key: string, title: RegExp) => {
    const find = async () => (await windows()).find((window) => title.test(window.title ?? ""));
    expect(await find()).toBeUndefined();
    await app.runChecked(key);
    try {
      await waitFor(find);
    } finally {
      const window = await find();
      if (window?.subrole === "AXDialog") await probe.pressControl(music, "AXButton", "Cancel");
      else if (window?.title) await probe.closeWindow(music, window.title);
      await waitFor(async () => ((await find()) ? undefined : true));
    }
  };
  const toggle = async (key: string, title: RegExp) => {
    const read = async () =>
      flattenAX([await menu("View")]).find((node) => title.test(node.title ?? ""))?.title;
    const before = await waitFor(read);
    await app.runChecked(key);
    try {
      await waitFor(async () => {
        const after = await read();
        return after && after !== before ? after : undefined;
      });
    } finally {
      await app.runChecked(key);
      await waitFor(async () => ((await read()) === before ? true : undefined));
    }
  };
  const renamed = async (key: string, title: RegExp) => {
    const previousFocus = await probe.focus(music);
    await app.runChecked(key);
    try {
      await waitFor(async () => {
        const focus = await probe.focus(music);
        const namedField = focus.role === "AXTextField" && title.test(label(focus));
        const newEditor =
          focus.role === "AXTextArea" &&
          focus.value === "" &&
          focus.id &&
          focus.id !== previousFocus.id;
        return namedField || newEditor ? focus : undefined;
      });
    } finally {
      await closeDialog();
    }
  };
  const playback = (title: string) => waitFor(() => menu("Controls", title).catch(() => undefined));
  const player = async () =>
    (await nodes()).filter(
      ({ role, id }) => role === "AXToolbar" || id?.startsWith("Music.miniPlayer."),
    );
  const playingTitle = (title: string) =>
    waitFor(async () =>
      flattenAX(await player()).find(({ title: name, description, value }) =>
        [name, description, value].some((text) => typeof text === "string" && text.includes(title)),
      ),
    ).catch(async (cause) => {
      const controls = flattenAX(await player()).map(({ role, title, description, value, id }) => ({
        role,
        title,
        description,
        value,
        id,
      }));
      throw new Error(
        "Playback did not reach " + title + ": " + JSON.stringify(controls.slice(0, 40)),
        { cause },
      );
    });
  const repeat = async (key: string, state: string, other: string) => {
    const mark = (item: string) => menu("Controls", "Repeat", item).then((node) => node.mark);
    const prior = await waitFor(async () => {
      for (const item of ["Off", "One", "All"]) if (await mark(item)) return item;
    });
    await probe.press(music, "Controls", "Repeat", other);
    await waitFor(async () => ((await mark(other)) ? true : undefined));
    try {
      await app.runChecked(key);
      await waitFor(async () => ((await mark(state)) ? true : undefined));
    } finally {
      await probe.press(music, "Controls", "Repeat", prior);
    }
  };

  return {
    "a,": () => newWindow("a,", /^(General|Music Settings|Settings)$/),
    gr: () => goTo("gr", "Recently Added"),
    ga: () => goTo("ga", "Artists"),
    gb: () => goTo("gb", "Albums"),
    gs: () => goTo("gs", "Songs"),
    "g/": async () => {
      await app.runChecked("g/");
      try {
        await waitFor(async () => {
          const focus = await probe.focus(music);
          return focus.subrole === "AXSearchField" ||
            (focus.role === "AXTextField" && /search/i.test(label(focus)))
            ? focus
            : undefined;
        });
      } finally {
        await escape();
      }
    },
    np: () => renamed("np", /playlist/i),
    ns: async () => {
      expect(await cancel()).toBeUndefined();
      await app.runChecked("ns");
      try {
        await control(/^Match .*(?:rule|music)|^Smart Playlist/);
        await waitFor(cancel);
      } finally {
        await closeDialog();
      }
    },
    nf: () => renamed("nf", /folder/i),
    fi: () => openPanel("fi", "Open"),
    fu: () => openPanel("fu", "Open"),
    fe: () => openPanel("fe", "Save"),
    vn: () => toggle("vn", /^(Show|Hide) Playing Next$/),
    vb: async () => {
      await goTo("gs", "Songs");
      const statusTitle = /^(Show|Hide) Status Bar$/;
      const item = await waitFor(async () =>
        flattenAX([await menu("View")]).find(({ title }) => statusTitle.test(title ?? "")),
      );
      if (item.enabled === false)
        await app.expectFailure("vb", /Menu item .*Status Bar.* is disabled/);
      else await toggle("vb", statusTitle);
    },
    ve: () => newWindow("ve", /^Equalizer$/),
    pp: async () => {
      await playback("Play");
      await app.runChecked("pp");
      await playback("Pause");
    },
    "p]": async () => {
      await playingTitle(first);
      await app.runChecked("p]");
      await playingTitle(second);
    },
    "p[": async () => {
      await app.runChecked("p[");
      await playingTitle(first);
    },
    ph: async () => {
      await playback("Pause");
      await app.runChecked("ph");
      await playback("Play");
    },
    pro: () => repeat("pro", "Off", "One"),
    pra: () => repeat("pra", "All", "Off"),
    pr1: () => repeat("pr1", "One", "All"),
  } satisfies Record<(typeof keys)[number], () => Promise<unknown>>;
}

test("every Music binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Music/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...keys].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Music chords change the native app",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
        console.log("guest macOS", guestVersion);
        expect(guestVersion).toMatch(/^27\./);

        const behavior = cases(app, probe);
        await probe.activate(music);
        const ready = () =>
          waitFor(async () => {
            if ((await probe.front()) !== music) {
              await probe.activate(music);
              return;
            }
            const importItem = await probe.menu(music, "File", "Import…").catch(() => undefined);
            if (importItem?.enabled) return true;
            const active = await probe.window(music, 10);
            const dialog = flattenAX([active, ...(await probe.windows(music, 10))]).find(
              (node) =>
                node.role === "AXButton" &&
                node.enabled !== false &&
                node.position &&
                node.size?.every((dimension) => dimension > 0) &&
                [node.title, node.description].some((text) =>
                  ["Continue", "Start Listening", "Get Started"].includes(text ?? ""),
                ),
            );
            if (dialog?.position && dialog.size) {
              const [x, y] = dialog.position;
              const [width, height] = dialog.size;
              await probe.clickPoint(x + width / 2, y + height / 2);
            }
          }, 35_000).catch(async (cause) => {
            const visible = flattenAX(await probe.windows(music, 10))
              .filter(({ role }) =>
                ["AXWindow", "AXSheet", "AXHeading", "AXButton"].includes(role ?? ""),
              )
              .map(({ role, title, description, id }) => ({ role, title, description, id }));
            throw new Error(
              "Music did not make its native library ready: " +
                JSON.stringify(visible.slice(0, 25)),
              {
                cause,
              },
            );
          });
        await ready();

        const playbackKeys = ["pp", "p]", "p[", "ph", "pro", "pra", "pr1"];
        const runCase = async (key: keyof typeof behavior) => {
          try {
            await behavior[key]();
          } catch (cause) {
            throw new Error("Music " + key + " did not reach its expected state", { cause });
          }
        };
        for (const key of Object.keys(behavior) as (keyof typeof behavior)[]) {
          if (!playbackKeys.includes(key)) {
            await runCase(key);
            if (key === "a,") await ready();
          }
        }

        // Starting the first song from the library queues its neighboring track.
        await probe.activate(music, track(first), track(second));
        await probe.selectRow(music, "Songs");
        const shuffleOff = await probe
          .menu(music, "Controls", "Shuffle", "Off")
          .catch(() => undefined);
        if (shuffleOff?.enabled && !shuffleOff.mark) {
          await probe.press(music, "Controls", "Shuffle", "Off");
        }
        const titles = await waitFor(async () => {
          const nodes = flattenAX(await probe.visibleRows(music, 6));
          const cells = [first, second].map((title) =>
            nodes.find(
              (node) =>
                node.position &&
                node.size &&
                [node.title, node.description, node.value].includes(title),
            ),
          );
          return cells.every((cell) => cell !== undefined) ? cells : undefined;
        }, 12_000);
        const [x, y] = titles[0]!.position!;
        const [width, height] = titles[0]!.size!;
        await probe.clickPoint(x + width / 2, y + height / 2);
        await probe.key(36); // Return starts playback from the focused song row.
        await waitFor(
          async () => (await probe.menu(music, "Controls", "Next Track")).enabled || undefined,
        ).catch(async (cause) => {
          const focus = await probe.focus(music);
          const toolbar = flattenAX(
            flattenAX(await probe.windows(music, 8)).filter(({ role }) => role === "AXToolbar"),
          );
          throw new Error(
            "The songs did not form a playback queue: " +
              JSON.stringify({
                focus,
                toolbar: toolbar.map(({ title, description, value, enabled }) => ({
                  title,
                  description,
                  value,
                  enabled,
                })),
              }),
            { cause },
          );
        });
        await probe.press(music, "Controls", "Pause");
        await runCase("pp");
        await runCase("p]");
        await runCase("p[");
        await runCase("ph");
        await runCase("pro");
        await runCase("pra");
        await runCase("pr1");
      }),
    ),
  300_000,
);
