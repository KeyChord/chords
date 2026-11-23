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

const label = (node: AXNode) =>
  [node.title, node.description, node.value].filter(Boolean).join(" ");

const tv = "com.apple.TV";
const finder = "com.apple.finder";
const fixture = Bun.fileURLToPath(new URL("./Chordtest Film.mp4", import.meta.url));
const command = 1 << 20;

function tvScenario(app: ChordApp, probe: MacOSProbe) {
  const nodes = async () => flattenAX(await probe.windows(tv, 9));
  const menu = (...path: string[]) => probe.menu(tv, ...path);
  const show = (match: RegExp, role?: string) =>
    waitFor(
      async () =>
        (await nodes()).find((node) => (!role || node.role === role) && match.test(label(node))),
      12_000,
    );
  const escape = () => probe.key(53);
  const close = () => probe.key(13, command);
  const openWindow = async (key: string, title: RegExp) => {
    const find = async () => (await probe.windows(tv)).find((node) => title.test(node.title ?? ""));
    expect(await find()).toBeUndefined();
    await app.runChecked(key);
    try {
      await waitFor(find);
    } finally {
      await close();
      await waitFor(async () => ((await find()) ? undefined : true));
    }
  };
  const findSearch = async () => {
    await app.runChecked("g/");
    try {
      await waitFor(async () => {
        const focus = await probe.focus(tv);
        return focus.subrole === "AXSearchField" ||
          (focus.role === "AXTextField" && /search/i.test(label(focus)))
          ? focus
          : undefined;
      });
    } finally {
      await escape();
    }
  };
  const playlist = async () => {
    await app.runChecked("np");
    try {
      await waitFor(async () => {
        const focus = await probe.focus(tv);
        return focus.role === "AXTextField" && /playlist/i.test(label(focus)) ? focus : undefined;
      });
    } finally {
      await escape();
    }
  };
  const smartPlaylist = async () => {
    await app.runChecked("ns");
    try {
      await show(/^Match\b|^Smart Playlist\b/);
      await show(/^Cancel(?: |$)/, "AXButton");
    } finally {
      await escape();
    }
  };
  const importFilm = async () => {
    await app.runChecked("fi");
    await show(/^Open(?: |$)/, "AXButton");
    await show(/^Cancel(?: |$)/, "AXButton");
    // The app's file chooser imports the test movie without a network or a TV subscription.
    await probe.key(5, command | (1 << 17));
    await waitFor(async () => {
      const focus = await probe.focus(tv);
      return focus.role === "AXTextField" || focus.role === "AXComboBox" ? focus : undefined;
    });
    const pasteboard = Bun.spawn(["/usr/bin/pbcopy"], { stdin: fixture, timeout: 5_000 });
    expect(await pasteboard.exited).toBe(0);
    await probe.key(9, command);
    await probe.key(36);
    await show(/^Open(?: |$)/, "AXButton");
    await probe.pressControl(tv, "AXButton", "Open");
    await show(/^Home Videos(?: |$)/);
    const homeVideos = await show(/^Home Videos(?: |$)/);
    expect(homeVideos.position && homeVideos.size).toBeDefined();
    await probe.clickPoint(
      homeVideos.position![0] + homeVideos.size![0] / 2,
      homeVideos.position![1] + homeVideos.size![1] / 2,
    );
    await show(/^Chordtest Film\b/);
  };
  const selectFilm = async () => {
    const film = await show(/^Chordtest Film\b/);
    expect(film.position && film.size).toBeDefined();
    await probe.clickPoint(
      film.position![0] + film.size![0] / 2,
      film.position![1] + film.size![1] / 2,
    );
    await waitFor(async () => ((await menu("Actions", "Get Info…")).enabled ? true : undefined));
  };
  const toggle = async (key: string, match: RegExp) => {
    const item = async () =>
      flattenAX([await menu("View")]).find(
        (node) => node.role === "AXMenuItem" && match.test(node.title ?? ""),
      )?.title;
    const before = await waitFor(item);
    await app.runChecked(key);
    try {
      await waitFor(async () => {
        const after = await item();
        return after && after !== before ? after : undefined;
      });
    } finally {
      await app.runChecked(key);
      await waitFor(async () => ((await item()) === before ? true : undefined));
    }
  };
  const info = async () => {
    await selectFilm();
    await app.runChecked("ii");
    try {
      await show(/^Details(?: |$)/);
      await show(/^Artwork(?: |$)/);
    } finally {
      await escape();
      await waitFor(async () =>
        (await nodes()).some((node) => /^Artwork(?: |$)/.test(label(node))) ? undefined : true,
      );
    }
  };
  const reveal = async () => {
    await selectFilm();
    try {
      await app.runChecked("ff");
      await waitFor(async () => ((await probe.front()) === finder ? true : undefined));
      await waitFor(async () =>
        flattenAX(await probe.windows(finder, 6)).find((node) =>
          /Chordtest Film/.test(label(node)),
        ),
      );
    } finally {
      await probe.activate(tv);
    }
  };
  const playback = async (key: string, before: string, after: string) => {
    await waitFor(() => menu("Controls", before).catch(() => undefined));
    await app.runChecked(key);
    await waitFor(() => menu("Controls", after).catch(() => undefined));
  };
  return {
    openWindow,
    findSearch,
    playlist,
    smartPlaylist,
    importFilm,
    selectFilm,
    toggle,
    info,
    reveal,
    playback,
  };
}

type Scenario = ReturnType<typeof tvScenario>;
const cases: Record<string, (scenario: Scenario) => Promise<void>> = {
  "a,": ({ openWindow }) => openWindow("a,", /^(General|TV Settings|Settings)$/),
  "g/": ({ findSearch }) => findSearch(),
  np: ({ playlist }) => playlist(),
  ns: ({ smartPlaylist }) => smartPlaylist(),
  va: ({ openWindow }) => openWindow("va", /^Activity$/),
  fi: ({ importFilm }) => importFilm(),
  ii: ({ info }) => info(),
  ff: ({ reveal }) => reveal(),
  vo: ({ toggle }) => toggle("vo", /^(Show|Hide) View Options$/),
  vb: ({ toggle }) => toggle("vb", /^(Show|Hide) Status Bar$/),
  pp: async ({ selectFilm, playback }) => {
    await selectFilm();
    await playback("pp", "Play", "Pause");
  },
  ph: ({ playback }) => playback("ph", "Pause", "Play"),
};

test("every TV binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/TV/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "TV chords change the native app",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
        console.log("guest macOS", guestVersion);
        expect(guestVersion).toMatch(/^27\./);

        await probe.activate(tv);
        await waitFor(async () => {
          const button = flattenAX(await probe.windows(tv, 8)).find(
            (node) =>
              node.role === "AXButton" &&
              [node.title, node.description].some((text) =>
                ["Continue", "Get Started", "Start Watching"].includes(text ?? ""),
              ),
          );
          if (button) {
            await probe.pressControl(tv, "AXButton", button.title ?? button.description!);
            return;
          }
          return (await probe.menu(tv, "File", "Import…").catch(() => undefined))?.enabled
            ? true
            : undefined;
        }, 20_000);
        const scenario = tvScenario(app, probe);
        try {
          for (const [key, verify] of Object.entries(cases)) {
            try {
              await verify(scenario);
            } catch (cause) {
              throw new Error("TV " + key + " did not reach its expected state", { cause });
            }
          }
        } finally {
          await probe.key(53);
        }
      }),
    ),
  300_000,
);
