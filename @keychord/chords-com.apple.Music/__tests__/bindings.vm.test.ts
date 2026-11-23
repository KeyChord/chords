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
  const close = () => probe.key(13, 1 << 20);
  const escape = () => probe.key(53);
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
      await probe.key(alternate === "Songs" ? 21 : 19, (1 << 20) | (1 << 18));
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
      await escape();
      await waitFor(async () =>
        (await nodes()).some((node) => node.role === "AXButton" && node.title === "Cancel")
          ? undefined
          : true,
      );
    }
  };
  const newWindow = async (key: string, title: RegExp) => {
    expect((await windows()).some((window) => title.test(window.title ?? ""))).toBe(false);
    await app.runChecked(key);
    try {
      await waitFor(async () => (await windows()).find((window) => title.test(window.title ?? "")));
    } finally {
      await close();
      await waitFor(async () =>
        (await windows()).some((window) => title.test(window.title ?? "")) ? undefined : true,
      );
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
    await app.runChecked(key);
    try {
      await waitFor(async () => {
        const focus = await probe.focus(music);
        return focus.role === "AXTextField" && title.test(label(focus)) ? focus : undefined;
      });
    } finally {
      await escape();
    }
  };
  const playback = (title: string) => waitFor(() => menu("Controls", title).catch(() => undefined));
  const playingTitle = (title: string) =>
    waitFor(async () =>
      flattenAX((await nodes()).filter((node) => node.role === "AXToolbar")).find(
        (node) =>
          ["AXButton", "AXStaticText"].includes(node.role ?? "") &&
          [node.title, node.description, node.value].some(
            (text) => typeof text === "string" && text.includes(title),
          ),
      ),
    );
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
      await app.runChecked("ns");
      try {
        await control(/^Match .*(?:rule|music)|^Smart Playlist/);
        await control(/^Cancel(?: |$)/);
      } finally {
        await escape();
      }
    },
    nf: () => renamed("nf", /folder/i),
    fi: () => openPanel("fi", "Open"),
    fu: () => openPanel("fu", "Open"),
    fe: () => openPanel("fe", "Save"),
    vn: () => toggle("vn", /^(Show|Hide) Playing Next$/),
    vb: () => toggle("vb", /^(Show|Hide) Status Bar$/),
    ve: () => newWindow("ve", /^Equalizer$/),
    pp: async () => {
      await playback("Play");
      await app.runChecked("pp");
      await playback("Pause");
    },
    "p]": async () => {
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
        // Play consecutive local tracks with the song list out of the AX tree.
        await probe.activate(music);
        await waitFor(async () => {
          const dialog = flattenAX(await probe.windows(music, 8)).find(
            (node) =>
              node.role === "AXButton" &&
              [node.title, node.description].some((text) =>
                ["Continue", "Start Listening", "Get Started"].includes(text ?? ""),
              ),
          );
          if (dialog) {
            await probe.pressControl(music, "AXButton", dialog.title ?? dialog.description!);
            return;
          }
          return (await probe.menu(music, "File", "Import…").catch(() => undefined))?.enabled
            ? true
            : undefined;
        }, 20_000);

        const playbackKeys = ["pp", "p]", "p[", "ph", "pro", "pra", "pr1"];
        const runCase = async (key: keyof typeof behavior) => {
          try {
            await behavior[key]();
          } catch (cause) {
            throw new Error("Music " + key + " did not reach its expected state", { cause });
          }
        };
        for (const key of Object.keys(behavior) as (keyof typeof behavior)[]) {
          if (!playbackKeys.includes(key)) await runCase(key);
        }

        await probe.activate(music, track(first), track(second));
        await waitFor(() => probe.menu(music, "Controls", "Pause").catch(() => undefined), 12_000);
        await probe.press(music, "Controls", "Pause");
        await probe.key(18, (1 << 20) | (1 << 18));
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
