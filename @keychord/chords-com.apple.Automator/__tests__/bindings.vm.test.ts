import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const id = "com.apple.Automator";
const command = 1 << 20;
const escape = 53;
const fixtureTitle = "Chordtest Automator";
const sortModes = { aa: "Application", ac: "Category" };

const pauseWorkflow = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>AMApplicationVersion</key><string>2.4</string>
  <key>AMDocumentVersion</key><string>2</string>
  <key>actions</key>
  <array><dict>
    <key>action</key><dict>
      <key>AMActionVersion</key><string>2.0.2</string>
      <key>AMApplication</key><array><string>Automator</string></array>
      <key>ActionBundlePath</key><string>/System/Library/Automator/Pause.action</string>
      <key>ActionName</key><string>Pause</string>
      <key>ActionParameters</key><dict>
        <key>pauseDuration</key><integer>30</integer>
        <key>pauseUnit</key><integer>0</integer>
      </dict>
      <key>BundleIdentifier</key><string>com.apple.Automator.Pause</string>
      <key>CFBundleVersion</key><string>2.0.2</string>
      <key>Class Name</key><string>PauseAction</string>
      <key>InputUUID</key><string>4268C60E-56EA-4031-8718-F5775E999DF0</string>
      <key>OutputUUID</key><string>D9BF2E47-B7E8-46FD-8C3F-A277C3BB35BB</string>
      <key>UUID</key><string>97AFF94E-6DB2-4608-A28A-BF2B2AE9EDD4</string>
      <key>isViewVisible</key><true/>
    </dict>
    <key>isViewVisible</key><true/>
  </dict></array>
  <key>connectors</key><dict/>
  <key>workflowMetaData</key><dict>
    <key>workflowTypeIdentifier</key><string>com.apple.Automator.workflow</string>
  </dict>
</dict>
</plist>
`;

function behavior(app: ChordApp, probe: MacOSProbe) {
  const menu = (...path: string[]) => probe.menu(id, ...path);
  const nodes = async () => flattenAX(await probe.windows(id, 8));
  const button = async (title: RegExp) =>
    (await nodes()).find((node) => node.role === "AXButton" && title.test(node.title ?? ""));
  const templateChooser = async () =>
    (await nodes()).find((node) =>
      [node.title, node.description, node.value].some(
        (label) =>
          typeof label === "string" && /workflow type chooser|choose a template/i.test(label),
      ),
    );
  const panel = async (sequence: string, target: () => Promise<unknown>) => {
    expect(await button(/^Cancel$/)).toBeUndefined();
    await app.runChecked(sequence);
    try {
      await waitFor(async () => {
        if (await button(/^Cancel$/)) return (await target()) || undefined;
      });
    } finally {
      await probe.key(escape);
      await waitFor(async () => (!(await button(/^Cancel$/)) ? true : undefined));
    }
  };
  const libraryShown = () => menu("View", "Hide Library").catch(() => undefined);
  const setLibrary = async (show: boolean) => {
    if (Boolean(await libraryShown()) !== show)
      await probe.press(id, "View", show ? "Show Library" : "Hide Library");
    await waitFor(async () => (Boolean(await libraryShown()) === show ? true : undefined));
  };
  const toggleLibrary = async (sequence: string, show: boolean) => {
    await setLibrary(!show);
    try {
      await app.runChecked(sequence);
      await waitFor(async () => (Boolean(await libraryShown()) === show ? true : undefined));
    } finally {
      await setLibrary(!show);
    }
  };
  const togglePane = async (sequence: string, label: string) => {
    const mark = (await menu("View", label)).mark;
    try {
      await app.runChecked(sequence);
      await waitFor(async () => ((await menu("View", label)).mark !== mark ? true : undefined));
    } finally {
      if ((await menu("View", label)).mark !== mark) await probe.press(id, "View", label);
      await waitFor(async () => ((await menu("View", label)).mark === mark ? true : undefined));
    }
  };
  const arrange = async (sequence: string, target: string) => {
    await setLibrary(true);
    const path = ["View", "Arrange Actions by"];
    const before = target === "Application" ? "Category" : "Application";
    const selected = async (name: string) => Boolean((await menu(...path, name)).mark);
    if (!(await selected(before))) await probe.press(id, ...path, before);
    await waitFor(async () => ((await selected(before)) ? true : undefined));
    try {
      await app.runChecked(sequence);
      await waitFor(async () => ((await selected(target)) ? true : undefined));
    } finally {
      await probe.press(id, ...path, before);
      await waitFor(async () => ((await selected(before)) ? true : undefined));
    }
  };
  const running = async () => (await menu("Workflow", "Stop")).enabled === true;
  const waitForRunning = (value: boolean) =>
    waitFor(async () => ((await running()) === value ? true : undefined));
  const stop = async () => {
    if (await running()) await probe.press(id, "Workflow", "Stop");
    await waitForRunning(false);
  };

  return {
    fn: async () => {
      const before = (await probe.windows(id)).length;
      await app.runChecked("fn");
      try {
        await waitFor(templateChooser);
        const choose = await waitFor(() => button(/^Choose$/));
        await probe.pressControl(id, "AXButton", choose.title!);
        await waitFor(async () =>
          (await probe.windows(id)).length === before + 1 &&
          (await probe.window(id)).title?.startsWith("Untitled")
            ? true
            : undefined,
        );
      } finally {
        if (await templateChooser()) await probe.key(escape);
        if ((await probe.window(id)).title?.startsWith("Untitled")) await probe.key(13, command);
        await waitFor(async () => ((await probe.windows(id)).length === before ? true : undefined));
      }
    },
    fo: () => panel("fo", () => button(/^Open$/)),
    fe: () => panel("fe", () => button(/^(Save|Export)$/)),
    fc: () => panel("fc", templateChooser),
    sl: async () => {
      await setLibrary(true);
      expect((await probe.focus(id)).subrole).not.toBe("AXSearchField");
      try {
        await app.runChecked("sl");
        await waitFor(async () =>
          (await probe.focus(id)).subrole === "AXSearchField" ? true : undefined,
        );
      } finally {
        await setLibrary(false);
        await setLibrary(true);
        await waitFor(async () =>
          (await probe.focus(id)).subrole !== "AXSearchField" ? true : undefined,
        );
      }
    },
    vl: () => toggleLibrary("vl", true),
    vh: () => toggleLibrary("vh", false),
    vg: () => togglePane("vg", "Log"),
    vv: () => togglePane("vv", "Variables"),
    ...Object.fromEntries(
      Object.entries(sortModes).map(([key, mode]) => [key, () => arrange(key, mode)]),
    ),
    wr: async () => {
      expect(await running()).toBe(false);
      try {
        await app.runChecked("wr");
        await waitForRunning(true);
        expect((await menu("Workflow", "Run")).enabled).toBe(false);
      } finally {
        await stop();
      }
    },
    ws: async () => {
      await probe.press(id, "Workflow", "Run");
      await waitForRunning(true);
      try {
        await app.runChecked("ws");
        await waitForRunning(false);
        expect((await menu("Workflow", "Run")).enabled).toBe(true);
      } finally {
        await stop();
      }
    },
  };
}

const caseKeys = [
  "fn",
  "fo",
  "fe",
  "fc",
  "sl",
  "vl",
  "vh",
  "vg",
  "vv",
  "wr",
  "ws",
  ...Object.keys(sortModes),
];

test("every Automator binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Automator/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...caseKeys].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Automator chords manage and run a local Pause workflow",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    const directory = await mkdtemp(join(tmpdir(), "chordtest-automator-"));
    const fixture = join(directory, `${fixtureTitle}.workflow`);
    try {
      const contents = join(fixture, "Contents");
      await mkdir(contents, { recursive: true });
      await Bun.write(join(contents, "document.wflow"), pauseWorkflow);
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(id, fixture);
          await waitFor(
            async () => ((await probe.window(id)).title?.includes(fixtureTitle) ? true : undefined),
            15_000,
          );
          try {
            const cases = behavior(app, probe);
            expect(Object.keys(cases).sort()).toEqual([...caseKeys].sort());
            for (const [sequence, run] of Object.entries(cases)) {
              try {
                await run();
                console.log(`Automator ${sequence} passed`);
              } catch (cause) {
                throw new Error(`Automator ${sequence} failed`, { cause });
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
