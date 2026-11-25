import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
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

async function dismissNotificationOffer(probe: MacOSProbe, nodes: AXNode[]) {
  if (!nodes.some((node) => node.value === "Keep Up with Your Shows and Sports")) return false;
  if (!nodes.some((node) => node.role === "AXStaticText" && node.value === "Not Now")) return false;
  await probe.clickControl(tv, "AXStaticText", "Not Now");
  return true;
}

function tvScenario(app: ChordApp, probe: MacOSProbe, movieFile: string) {
  const nodes = async () =>
    flattenAX([await probe.window(tv, 10), ...(await probe.windows(tv, 9))]);
  const menu = (...path: string[]) => probe.menu(tv, ...path);
  const show = (match: RegExp, role?: string) =>
    waitFor(
      async () =>
        (await nodes()).find((node) => (!role || node.role === role) && match.test(label(node))),
      12_000,
    );
  const film = async () =>
    (await nodes()).find(
      (node) =>
        ["AXButton", "AXCell", "AXRow", "AXStaticText", "AXGroup", "AXUnknown"].includes(
          node.role ?? "",
        ) &&
        node.position &&
        node.size &&
        [node.title, node.description, node.value].some(
          (value) => typeof value === "string" && /\bChordtest Film\b/.test(value),
        ),
    );
  const escape = () => probe.key(53);
  const openWindow = async (key: string, title: RegExp) => {
    const find = async () => (await probe.windows(tv)).find((node) => title.test(node.title ?? ""));
    expect(await find()).toBeUndefined();
    await app.runChecked(key);
    try {
      await waitFor(find);
    } finally {
      const window = await find();
      if (window?.subrole === "AXDialog") await probe.pressControl(tv, "AXButton", "Cancel");
      else if (window?.title) {
        await probe.closeWindow(tv, window.title);
        if (!(await waitFor(async () => !(await find()) || undefined, 2_000).catch(() => false))) {
          await probe.raiseWindow(tv, window.title);
          await probe.key(13, 1 << 20);
        }
      }
      await waitFor(async () => ((await find()) ? undefined : true), 12_000);
    }
  };
  const findSearch = async () => {
    const field = async () =>
      (await nodes()).find(
        (node) =>
          node.enabled &&
          node.position &&
          node.size?.every((dimension) => dimension > 0) &&
          (node.subrole === "AXSearchField" ||
            (node.role === "AXTextField" && /search/i.test(label(node) + " " + (node.id ?? "")))),
      );
    const before = await field();
    await app.runChecked("g/");
    try {
      await waitFor(async () => {
        const focus = await probe.focus(tv);
        const visible = await field();
        if (
          focus.subrole === "AXSearchField" ||
          (focus.role === "AXTextField" && /search/i.test(label(focus)))
        )
          return focus;
        if (visible && (!before || visible.focused)) return visible;
      }).catch(async (cause) => {
        throw new Error(
          "TV did not show search: " +
            JSON.stringify({ focus: await probe.focus(tv), field: await field() }),
          { cause },
        );
      });
    } finally {
      if (await field()) await escape();
    }
  };
  const playlist = async () => {
    await libraryFilm();
    const created = async () => {
      const focus = await probe.focus(tv);
      if (focus.role === "AXTextField" && /playlist/i.test(label(focus))) return focus;
      return (await nodes()).find(
        (node) =>
          ["AXCell", "AXTextField", "AXStaticText"].includes(node.role ?? "") &&
          [node.title, node.description, node.value].some(
            (text) =>
              typeof text === "string" && /^(untitled playlist|playlist)(?: \d+)?$/i.test(text),
          ),
      );
    };
    expect(await created()).toBeUndefined();
    await app.runChecked("np");
    try {
      await waitFor(created, 12_000).catch(async (cause) => {
        const labels = (await nodes()).filter((node) => /playlist|library/i.test(label(node)));
        throw new Error(
          "TV did not show a new playlist: " +
            JSON.stringify({ focus: await probe.focus(tv), labels }),
          { cause },
        );
      });
    } finally {
      await escape();
    }
  };
  const smartPlaylist = async () => {
    const dialog = async () =>
      (await probe.windows(tv, 7)).find((window) => window.title === "Smart Playlist");
    expect(await dialog()).toBeUndefined();
    await app.runChecked("ns");
    try {
      const window = await waitFor(dialog, 12_000);
      expect(
        flattenAX([window]).some(
          (node) => node.role === "AXButton" && node.enabled && node.title === "Cancel",
        ),
      ).toBe(true);
    } finally {
      const window = await dialog();
      if (window) {
        const cancel = flattenAX([window]).find(
          (node) => node.role === "AXButton" && node.enabled && node.title === "Cancel",
        );
        expect(cancel?.position && cancel.size).toBeDefined();
        const [x, y] = cancel!.position!;
        const [width, height] = cancel!.size!;
        await probe.clickPoint(x + width / 2, y + height / 2);
        await waitFor(async () => !(await dialog()) || undefined, 12_000);
      }
    }
  };
  const importFilm = async () => {
    await app.runChecked("fi");
    await show(/^Open(?: |$)/, "AXButton");
    await show(/^Cancel(?: |$)/, "AXButton");
    const location = async () => (await nodes()).find((node) => node.id === "where popup")?.value;
    if ((await location()) !== "Documents") {
      await probe.selectRow(tv, "Documents");
      await waitFor(async () => ((await location()) === "Documents" ? true : undefined));
    }
    const movie = await waitFor(async () =>
      (await nodes()).find(
        (node) => node.role && [node.title, node.description, node.value].includes(movieFile),
      ),
    );
    await probe.clickControl(tv, movie.role!, movieFile);
    await waitFor(async () =>
      (await nodes()).find(
        (node) => node.role === "AXButton" && node.title === "Open" && node.enabled,
      ),
    );
    await probe.pressControl(tv, "AXButton", "Open");
    await waitFor(
      async () =>
        !(await nodes()).some(
          (node) =>
            node.role === "AXSheet" &&
            flattenAX([node]).some(
              (control) => control.role === "AXButton" && control.title === "Open",
            ),
        ) || undefined,
      10_000,
    );
    await libraryFilm();
  };
  const libraryFilm = async () => {
    await waitFor(async () => !(await dismissNotificationOffer(probe, await nodes())) || undefined);
    const current = await film();
    if (current) return current;
    const related = async () =>
      (await nodes()).filter(({ role, position, size }) => role !== "AXWindow" && position && size);
    const librarySection = async (identifier: string) => {
      const section = await probe.windowElement(tv, identifier, "AXUnknown");
      return section?.position && section.size?.every((dimension) => dimension > 0)
        ? section
        : undefined;
    };
    const findHomeVideos = async () =>
      (await librarySection("UIA.TV.Tabs.library.home_videos")) ??
      (await related()).find((node) => /^Home Videos(?: |$)/.test(label(node)));
    if (!(await findHomeVideos())) {
      const library = (await related()).find(
        (node) =>
          ["AXButton", "AXRow", "AXStaticText", "AXRadioButton"].includes(node.role ?? "") &&
          [node.title, node.description, node.value].includes("Library"),
      );
      if (library?.position && library.size) {
        const [x, y] = library.position;
        const [width, height] = library.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
      }
    }
    const homeVideos = await waitFor(findHomeVideos, 12_000).catch(async (cause) => {
      const controls = (await related()).map(({ role, title, description, value, id }) => ({
        role,
        title,
        description,
        value,
        id,
      }));
      throw new Error(
        "TV did not show the imported video collection: " +
          JSON.stringify(
            controls.filter((node) => node.title || node.description || node.value).slice(0, 55),
          ),
        { cause },
      );
    });
    expect(homeVideos.position && homeVideos.size).toBeDefined();
    await probe.clickPoint(
      homeVideos.position![0] + homeVideos.size![0] / 2,
      homeVideos.position![1] + homeVideos.size![1] / 2,
    );
    const imported = await waitFor(film, 5_000).catch(() => undefined);
    if (imported) return imported;
    const recentlyAdded = await librarySection("UIA.TV.Tabs.library.recently_added");
    if (recentlyAdded) {
      const [x, y] = recentlyAdded.position!;
      const [width, height] = recentlyAdded.size!;
      await probe.clickPoint(x + width / 2, y + height / 2);
    }
    return waitFor(film, 15_000).catch(async (cause) => {
      const visible = (await related())
        .map(({ role, title, description, value, id }) => ({
          role,
          title,
          description,
          value,
          id,
        }))
        .filter((node) => node.title || node.description || node.value);
      throw new Error(
        "TV did not show the imported fixture: " +
          JSON.stringify({ focus: await probe.focus(tv), visible: visible.slice(-50) }),
        { cause },
      );
    });
  };
  const selectFilm = async () => {
    const item = await libraryFilm();
    expect(item.position && item.size).toBeDefined();
    await probe.clickPoint(
      item.position![0] + item.size![0] / 2,
      item.position![1] + item.size![1] / 2,
    );
    await waitFor(async () => ((await menu("Actions", "Get Info…")).enabled ? true : undefined));
  };
  const toggle = async (key: string, match: RegExp) => {
    const item = async () =>
      flattenAX([await menu("View")]).find(
        (node) => node.role === "AXMenuItem" && match.test(node.title ?? ""),
      );
    const before = await waitFor(item);
    if (before.enabled === false) {
      await app.expectFailure(key, new RegExp('Menu item "' + before.title + '".*is disabled'));
      console.log("TV verified the disabled " + before.title + " menu");
      return;
    }
    await app.runChecked(key);
    try {
      await waitFor(async () => {
        const after = (await item())?.title;
        return after && after !== before.title ? after : undefined;
      });
    } finally {
      if ((await item())?.title !== before.title) {
        await app.runChecked(key);
        await waitFor(async () => (await item())?.title === before.title || undefined);
      }
    }
  };
  const info = async () => {
    await selectFilm();
    const panel = async () => {
      const current = await probe.window(tv, 9);
      if (current.role !== "AXSheet" && current.subrole !== "AXDialog") return;
      const items = flattenAX([current]);
      const title = items.find(
        (node) => node.role === "AXTextField" && node.value === "Chordtest Film",
      );
      const close = items.find(
        (node) =>
          node.role === "AXButton" && node.enabled && /^(Cancel|OK)(?: |$)/.test(label(node)),
      );
      if (title && close) return close;
    };
    expect(await panel()).toBeUndefined();
    try {
      await app.runChecked("ii");
      await waitFor(panel, 10_000).catch(async (cause) => {
        const controls = (await nodes())
          .filter(({ role }) =>
            ["AXWindow", "AXSheet", "AXTextField", "AXButton"].includes(role ?? ""),
          )
          .map(({ role, title, description, id }) => ({ role, title, description, id }));
        throw new Error(
          "TV did not show movie information: " + JSON.stringify(controls.slice(0, 30)),
          { cause },
        );
      });
    } finally {
      const close = await panel();
      if (close) {
        const button = close.title ?? close.description!;
        await probe.pressControl(tv, "AXButton", button);
        await waitFor(async () => !(await panel()) || undefined);
      }
    }
  };
  const reveal = async () => {
    await selectFilm();
    try {
      await app.runChecked("ff");
      await waitFor(async () => ((await probe.front()) === finder ? true : undefined));
      await waitFor(async () => {
        const windows = await probe.windows(finder, 10);
        const rows = await probe.visibleRows(finder, 5).catch(() => []);
        return flattenAX([...windows, ...rows]).find((node) =>
          /Chordtest(?:%20| )Film/.test(label(node) + " " + (node.url ?? "")),
        );
      }, 15_000).catch(async (cause) => {
        throw new Error(
          "Finder did not reveal the disposable movie: " +
            JSON.stringify(await probe.windows(finder)),
          { cause },
        );
      });
    } finally {
      await probe.activate(tv);
    }
  };
  const readPlayer = async (openMovie = false) => {
    const state = await probe.runAppleScript(
      "TV",
      [
        "on run fixture",
        "with timeout of 10 seconds",
        'tell application id "com.apple.TV"',
        ...(openMovie
          ? [
              "set movieName to item 1 of fixture",
              "set localTrack to first file track of library playlist 1 whose name is movieName",
              "play localTrack",
            ]
          : []),
        "return player state as text",
        "end tell",
        "end timeout",
        "end run",
      ],
      ["Chordtest Film"],
    );
    expect(["stopped", "paused", "playing"]).toContain(state);
    return state;
  };
  const playerWindow = async () =>
    (await probe.windows(tv, 8)).find((window) =>
      flattenAX([window]).some(
        (node) => node.id === "Toggle Controls" && node.description === "Video",
      ),
    );
  const playerMenus = async () =>
    flattenAX([await menu("Controls")]).filter(
      (node) => node.role === "AXMenuItem" && ["Play", "Pause"].includes(node.title ?? ""),
    );
  const playbackState = async () => {
    if (!(await playerWindow())) return;
    const state = await readPlayer();
    if (state !== "stopped") return state;
    // TV can show a separate player window while its library scripting state stays stopped.
    const enabled = (await playerMenus()).filter((node) => node.enabled);
    if (enabled.length === 1) return enabled[0].title === "Pause" ? "playing" : "paused";
  };
  const startFilm = async () => {
    await readPlayer(true);
    try {
      await waitFor(playerWindow, 12_000);
      if ((await playbackState()) !== "playing") {
        const play = await menu("Controls", "Play").catch(() => undefined);
        if (play?.enabled) await probe.press(tv, "Controls", "Play");
      }
      await waitFor(async () => (await playbackState()) === "playing" || undefined, 12_000);
    } catch (cause) {
      const controls = (await nodes())
        .filter(({ role }) =>
          ["AXWindow", "AXSheet", "AXHeading", "AXButton", "AXSlider"].includes(role ?? ""),
        )
        .map(({ role, title, description, value, id }) => ({
          role,
          title,
          description,
          value,
          id,
        }));
      const artifacts = process.env.CHORD_TESTING_ARTIFACTS;
      if (artifacts && (await probe.front()) === tv) {
        await runCommand(["/usr/sbin/screencapture", "-x", join(artifacts, "tv-player.png")]);
      }
      throw new Error(
        "TV did not start the imported library track: " +
          JSON.stringify({
            state: await readPlayer(),
            menu: await playerMenus(),
            controls: controls.slice(0, 35),
          }),
        { cause },
      );
    }
  };
  const playback = async (key: string, before: string, after: string) => {
    await waitFor(async () => (await playbackState()) === before || undefined);
    await app.runChecked(key);
    await waitFor(async () => (await playbackState()) === after || undefined, 12_000);
  };
  return {
    openWindow,
    findSearch,
    playlist,
    smartPlaylist,
    importFilm,
    selectFilm,
    startFilm,
    toggle,
    info,
    reveal,
    playback,
  };
}

type Scenario = ReturnType<typeof tvScenario>;
const cases: Record<string, (scenario: Scenario) => Promise<void>> = {
  fi: ({ importFilm }) => importFilm(),
  np: ({ playlist }) => playlist(),
  ns: ({ smartPlaylist }) => smartPlaylist(),
  va: ({ openWindow }) => openWindow("va", /^Activity$/),
  ii: ({ info }) => info(),
  vo: async ({ selectFilm, toggle }) => {
    await selectFilm();
    await toggle("vo", /^(Show|Hide) View Options$/);
  },
  ff: ({ reveal }) => reveal(),
  vb: ({ toggle }) => toggle("vb", /^(Show|Hide) Status Bar$/),
  "g/": ({ findSearch }) => findSearch(),
  "a,": ({ openWindow }) => openWindow("a,", /^(General|TV Settings|Settings)$/),
  ph: async ({ startFilm, playback }) => {
    await startFilm();
    await playback("ph", "playing", "paused");
  },
  pp: ({ playback }) => playback("pp", "paused", "playing"),
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
        const ready = () =>
          waitFor(async () => {
            const nodes = flattenAX(await probe.windows(tv, 10));
            if (await dismissNotificationOffer(probe, nodes)) return;
            const button = nodes.find(
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
        await ready();
        const movieFile = `Chordtest Film ${crypto.randomUUID()}.mp4`;
        const moviePath = join(homedir(), "Documents", movieFile);
        const scenario = tvScenario(app, probe, movieFile);
        try {
          await Bun.write(moviePath, Bun.file(fixture));
          const failures: Error[] = [];
          for (const [key, verify] of Object.entries(cases)) {
            try {
              await verify(scenario);
              console.log("TV " + key + " passed");
              if (key === "a,") await ready();
            } catch (cause) {
              const failure = new Error("TV " + key + " did not reach its expected state", {
                cause,
              });
              failures.push(failure);
              console.error(failure);
            }
          }
          if (failures.length) throw new AggregateError(failures, "TV behavior failures");
        } finally {
          await probe.key(53);
          await rm(moviePath, { force: true });
        }
      }),
    ),
  300_000,
);
