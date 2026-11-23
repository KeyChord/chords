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
  const movie = () => probe.window(quickTime, 8);
  const nodes = async () => flattenAX(await probe.windows(quickTime, 8));
  const menu = (...path: string[]) => probe.menu(quickTime, ...path);
  const show = (title: RegExp, role?: string) =>
    waitFor(
      async () =>
        (await nodes()).find((node) => (!role || node.role === role) && title.test(label(node))),
      12_000,
    );
  const namedMenuItem = async (parent: string, title: RegExp) =>
    flattenAX([await menu(parent)]).find(
      (node) => node.role === "AXMenuItem" && title.test(node.title ?? ""),
    );
  const escape = () => probe.key(53);

  const dialog = async (key: string, name: RegExp, confirm: RegExp) => {
    await app.runChecked(key);
    try {
      await show(name);
      await show(confirm, "AXButton");
    } finally {
      await escape();
      await waitFor(async () =>
        (await nodes()).some((node) => node.role === "AXButton" && confirm.test(label(node)))
          ? undefined
          : true,
      );
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
  };

  const movieSize = async () => {
    const window = (await windows()).find((node) => movieName.test(node.title ?? ""));
    return window?.size;
  };
  const actualSize = async () => {
    const original = await waitFor(movieSize);
    await probe.press(quickTime, "View", "Zoom In");
    const larger = await waitFor(async () => {
      const size = await movieSize();
      return size && size[0] > original[0] ? size : undefined;
    });
    await app.runChecked("va");
    await waitFor(async () => {
      const size = await movieSize();
      return size && size[0] < larger[0] ? size : undefined;
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
  const playbackButton = (action: string) =>
    waitFor(async () =>
      flattenAX([await movie()]).find(
        (node) =>
          node.role === "AXButton" && new RegExp("^" + action + "(?: |$)", "i").test(label(node)),
      ),
    );
  const playPause = async () => {
    await playbackButton("Play");
    await app.runChecked("pv");
    try {
      await playbackButton("Pause");
    } finally {
      await app.runChecked("pv");
      await playbackButton("Play");
    }
  };
  const seek = async (key: string, atEnd: boolean) => {
    const timer = async () =>
      flattenAX([await movie()]).find(
        (node) => node.role === "AXSlider" && /time|progress|playhead|scrub/i.test(label(node)),
      )?.value;
    const before = await waitFor(timer);
    await app.runChecked(key);
    await waitFor(async () => {
      const after = await timer();
      if (after === before || after === undefined) return;
      if (typeof after === "number")
        return (atEnd ? after === 1 || after >= 39 : after === 0) ? true : undefined;
      return (atEnd ? /(?:0:40\b|100%)/ : /^(?:0:00\b|0%(?:\s|$))/).test(after) ? true : undefined;
    });
  };
  return { dialog, menuToggle, rotate, actualSize, showInspector, playPause, seek };
}

type Scenario = ReturnType<typeof quickTimeScenario>;
const cases: Record<string, (scenario: Scenario) => Promise<void>> = {
  fo: ({ dialog }) => dialog("fo", /^Cancel(?: |$)/, /^Open(?: |$)/),
  fu: ({ dialog }) => dialog("fu", /(?:location|url)/i, /^Open(?: |$)/),
  et: ({ dialog }) => dialog("et", /^Cancel(?: |$)/, /^Trim(?: |$)/),
  el: ({ rotate }) => rotate("el", "Left"),
  er: ({ rotate }) => rotate("er", "Right"),
  vi: ({ showInspector }) => showInspector(),
  vc: ({ menuToggle }) => menuToggle("vc", /^(Show|Hide) Clips$/),
  vf: ({ menuToggle }) => menuToggle("vf", /^Float on Top$/),
  va: ({ actualSize }) => actualSize(),
  pv: ({ playPause }) => playPause(),
  pz: ({ seek }) => seek("pz", true),
  pa: ({ seek }) => seek("pa", false),
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
        // Make the movie controls visible with a click derived from its AX window bounds.
        const window = await waitFor(loaded);
        if (window.position && window.size) {
          await probe.clickPoint(
            window.position[0] + window.size[0] / 2,
            window.position[1] + window.size[1] / 2,
          );
        }
        const scenario = quickTimeScenario(app, probe);
        try {
          for (const [key, verify] of Object.entries(cases)) {
            try {
              await verify(scenario);
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
