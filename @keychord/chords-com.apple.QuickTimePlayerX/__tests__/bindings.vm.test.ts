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

const quickTime = "com.apple.QuickTimePlayerX";
const fixture = Bun.fileURLToPath(new URL("./Chordtest Film.mp4", import.meta.url));
const movieName = /^Chordtest Film(?:\.mp4)?$/;
const command = 1 << 20;

function quickTimeScenario(app: ChordApp, probe: MacOSProbe) {
  const windows = () => probe.windows(quickTime);
  const nodes = async () => flattenAX(await probe.windows(quickTime, 8));
  const menu = (...path: string[]) => probe.menu(quickTime, ...path);
  const namedMenuItem = async (parent: string, title: RegExp) =>
    flattenAX([await menu(parent)]).find(
      (node) => node.role === "AXMenuItem" && title.test(node.title ?? ""),
    );
  const escape = () => probe.key(53);
  const editing = async () =>
    (await nodes()).some((node) => node.role === "AXButton" && node.title === "Done");
  const finishEditing = async () => {
    if (await editing()) {
      await probe.pressControl(quickTime, "AXButton", "Done");
      await waitFor(async () => ((await editing()) ? undefined : true));
    }
  };

  const showClips = async () => {
    await finishEditing();
    await waitFor(async () => (await menu("View", "Show Clips")).enabled || undefined);
    await app.runChecked("vc");
    try {
      await waitFor(async () => {
        if (!(await editing())) return;
        return (await nodes()).find(
          (node) => node.role === "AXSlider" && node.description === "timeline",
        );
      });
    } finally {
      await finishEditing();
    }
  };

  const dialog = async (key: string, name: RegExp, confirm: RegExp) => {
    const dialogControls = async () => {
      const current = await probe.window(quickTime, 5);
      if (current.role === "AXSheet" || current.subrole === "AXDialog") return flattenAX([current]);
      return flattenAX([current, ...(await probe.windows(quickTime, 4))]);
    };
    const visible = async () => {
      const controls = await dialogControls();
      return (
        controls.some((node) => name.test(label(node))) &&
        controls.some((node) => node.role === "AXButton" && confirm.test(label(node)))
      );
    };
    expect(await visible()).toBe(false);
    await app.runChecked(key);
    try {
      await waitFor(async () => (await visible()) || undefined, 15_000);
    } finally {
      const cancel = (await dialogControls()).find(
        (node) => node.role === "AXButton" && /^Cancel(?: |$)/.test(label(node)),
      );
      const cancelLabel = cancel?.title ?? cancel?.description;
      if (cancelLabel) await probe.pressControl(quickTime, "AXButton", cancelLabel);
      else await escape();
      await waitFor(async () => !(await visible()) || undefined);
    }
  };

  const menuToggle = async (key: string, title: RegExp) => {
    const read = async () => {
      const item = await namedMenuItem("View", title);
      return item && { title: item.title, mark: item.mark ?? null };
    };
    const prior = await waitFor(read);
    await app.runChecked(key);
    try {
      await waitFor(async () => {
        const state = await read();
        return state && (state.title !== prior.title || state.mark !== prior.mark)
          ? state
          : undefined;
      });
    } finally {
      await app.runChecked(key);
      await waitFor(async () => {
        const state = await read();
        return state?.title === prior.title && state?.mark === prior.mark ? state : undefined;
      });
    }
  };

  const rotate = async (key: string, side: string) => {
    const undo = new RegExp("^Undo Rotate(?: " + side + ")?$");
    expect(await namedMenuItem("Edit", undo)).toBeUndefined();
    await app.runChecked(key);
    const action = await waitFor(() => namedMenuItem("Edit", undo));
    await probe.press(quickTime, "Edit", action.title!);
    await waitFor(async () => ((await namedMenuItem("Edit", undo)) ? undefined : true));
    await finishEditing();
  };

  const movieSize = async () => {
    const window = (await windows()).find((node) => movieName.test(node.title ?? ""));
    return window?.size;
  };
  const actualSize = async () => {
    const actualSizeMenu = () => probe.menu(quickTime, "View", "Actual Size");
    if ((await actualSizeMenu()).enabled) {
      await probe.press(quickTime, "View", "Actual Size");
      await waitFor(async () => (!(await actualSizeMenu()).enabled ? true : undefined));
    }
    const original = await waitFor(movieSize);
    await probe.press(quickTime, "View", "Zoom to Fit");
    const larger = async () => {
      const size = await movieSize();
      if (size && size[0] > original[0] && (await actualSizeMenu()).enabled) return size;
    };
    if (!(await waitFor(larger, 1_500).catch(() => undefined))) {
      const window = await waitFor(async () =>
        (await windows()).find(
          (node) => node.position && node.size && movieName.test(node.title ?? ""),
        ),
      );
      const [x, y] = window.position!;
      const [width, height] = window.size!;
      const bottomRight: [number, number] = [x + width - 2, y + height - 2];
      await probe.dragPoints(bottomRight, [bottomRight[0] + 160, bottomRight[1] + 90]);
      if (!movieName.test((await probe.window(quickTime)).title ?? "") && window.title)
        await probe.raiseWindow(quickTime, window.title);
    }
    if (!(await actualSizeMenu()).enabled) {
      await app.expectFailure("va", /Menu item "Actual Size".*is disabled/);
      return;
    }
    await waitFor(larger).catch(async (cause) => {
      throw new Error(
        "QuickTime Player could not leave Actual Size: " +
          JSON.stringify({ original, size: await movieSize(), menu: await actualSizeMenu() }),
        { cause },
      );
    });
    await app.runChecked("va");
    await waitFor(async () => {
      const size = await movieSize();
      return size && Math.abs(size[0] - original[0]) <= 1 && !(await actualSizeMenu()).enabled
        ? size
        : undefined;
    });
  };
  const inspector = /^Movie Inspector|^Inspector$/;
  const showInspector = async () => {
    const find = async () => (await windows()).find((node) => inspector.test(node.title ?? ""));
    expect(await find()).toBeUndefined();
    await app.runChecked("vi");
    try {
      await waitFor(find);
    } finally {
      await app.runChecked("vi");
      await waitFor(async () => ((await find()) ? undefined : true));
    }
  };
  const readPlayback = () =>
    probe.runAppleScript(
      "QuickTime Player",
      [
        "with timeout of 20 seconds",
        'tell application id "com.apple.QuickTimePlayerX" to tell front document to return {playing, current time, duration}',
        "end timeout",
      ],
      [],
      { timeout: 25_000 },
    );
  const playbackState = async () => {
    const output = await readPlayback().catch((error: unknown) => {
      if (!(error instanceof Error) || !error.message.includes("(-1712)")) throw error;
      return readPlayback();
    });
    const [playing, position, duration] = output.trim().split(/,\s*/);
    expect(["false", "true"]).toContain(playing);
    const time = Number(position);
    const length = Number(duration);
    expect(Number.isFinite(time)).toBe(true);
    expect(length).toBeGreaterThan(0);
    return { playing: playing === "true", time, length };
  };
  const playPause = async () => {
    expect((await playbackState()).playing).toBe(false);
    await app.runChecked("pv");
    try {
      await waitFor(async () => (await playbackState()).playing || undefined).catch(
        async (cause) => {
          const before = await playbackState();
          await probe.key(49);
          const reference = await waitFor(
            async () => (await playbackState()).playing || undefined,
          ).catch(() => false);
          if (reference) await probe.key(49);
          throw new Error(
            "QuickTime Player did not play after the chord: " +
              JSON.stringify({ before, reference }),
            { cause },
          );
        },
      );
    } finally {
      if ((await playbackState()).playing) {
        await app.runChecked("pv");
        await waitFor(async () => !(await playbackState()).playing || undefined);
      }
    }
  };
  const seek = async (key: string, atEnd: boolean) => {
    const before = await playbackState();
    await app.runChecked(key);
    await waitFor(async () => {
      const after = await playbackState();
      if (after.time === before.time) return;
      const target = atEnd ? after.length : 0;
      return Math.abs(after.time - target) < 0.1 || undefined;
    });
  };
  return { showClips, dialog, menuToggle, rotate, actualSize, showInspector, playPause, seek };
}

type Scenario = ReturnType<typeof quickTimeScenario>;
const cases: Record<string, (scenario: Scenario) => Promise<void>> = {
  va: ({ actualSize }) => actualSize(),
  pv: ({ playPause }) => playPause(),
  pz: ({ seek }) => seek("pz", true),
  pa: ({ seek }) => seek("pa", false),
  vc: ({ showClips }) => showClips(),
  fo: ({ dialog }) => dialog("fo", /^Cancel(?: |$)/, /^Open(?: |$)/),
  fu: ({ dialog }) => dialog("fu", /(?:location|url)/i, /^Open(?: |$)/),
  et: ({ dialog }) => dialog("et", /^Cancel(?: |$)/, /^Trim(?: |$)/),
  el: ({ rotate }) => rotate("el", "Left"),
  er: ({ rotate }) => rotate("er", "Right"),
  vi: ({ showInspector }) => showInspector(),
  vf: ({ menuToggle }) => menuToggle("vf", /^Float on Top$/),
  pl: ({ menuToggle }) => menuToggle("pl", /^Loop$/),
};

test("every QuickTime Player binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/QuickTimePlayerX/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "QuickTime Player chords change the native app",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
        console.log("guest macOS", guestVersion);
        expect(guestVersion).toMatch(/^27\./);

        await probe.activate(quickTime, fixture);
        const loaded = () =>
          probe
            .window(quickTime)
            .then((node) => (movieName.test(node.title ?? "") ? node : undefined))
            .catch(() => undefined);
        await waitFor(loaded, 12_000);
        const scenario = quickTimeScenario(app, probe);
        try {
          for (const [key, verify] of Object.entries(cases)) {
            try {
              await verify(scenario);
              console.log("QuickTime Player " + key + " passed");
            } catch (cause) {
              throw new Error("QuickTime Player " + key + " did not reach its expected state", {
                cause,
              });
            }
          }
        } finally {
          await probe.key(53);
          await probe.key(13, command);
        }
      }),
    ),
  300_000,
);
