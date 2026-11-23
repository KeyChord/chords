import { expect, test } from "bun:test";
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

const bundleId = "com.apple.VoiceMemos";
const matches = (node: AXNode, text: string) =>
  [node.title, node.description, node.value].includes(text);

class VoiceMemos {
  constructor(
    readonly app: ChordApp,
    readonly probe: MacOSProbe,
  ) {}

  async nodes() {
    return flattenAX(await this.probe.windows(bundleId, 9));
  }

  async ready() {
    const { stdout } = await runCommand([
      "/usr/libexec/PlistBuddy",
      "-c",
      "Print :CFBundleShortVersionString",
      "/System/Applications/VoiceMemos.app/Contents/Info.plist",
    ]);
    await runCommand([
      "/usr/bin/defaults",
      "write",
      bundleId,
      "voicememos.welcome.last_completed",
      "-string",
      stdout.trim(),
    ]);
    await this.probe.activate(bundleId);
    await waitFor(async () => {
      const nodes = await this.nodes();
      if (
        nodes.some(
          (node) =>
            matches(node, "No Recordings") ||
            matches(node, "No Recording Selected") ||
            matches(node, "Click the Record button to start a Voice Memo"),
        )
      )
        return true;
      const button = ["Continue", "Not Now", "Don't Enable", "Don’t Enable"].find((text) =>
        nodes.some((node) => node.role === "AXButton" && node.enabled && matches(node, text)),
      );
      if (button) await this.probe.pressControl(bundleId, "AXButton", button);
    }, 15_000);
  }
}

// Tart runs with --no-audio. These commands require a selected recording, so
// assert each command reaches the exact disabled item on the empty library.
function requiresRecording(sequence: string, menu: string, item: string) {
  return async ({ app, probe }: VoiceMemos) => {
    expect((await probe.menu(bundleId, menu, item)).enabled).toBe(false);
    const name = item.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await app.expectFailure(sequence, new RegExp(`Menu item "${name}".*is disabled`));
  };
}

const cases: Record<string, (memos: VoiceMemos) => Promise<void>> = {
  rd: requiresRecording("rd", "File", "Duplicate"),
  rr: requiresRecording("rr", "File", "Rename…"),
  re: requiresRecording("re", "Edit", "Edit Recording"),
  rt: requiresRecording("rt", "Edit", "Trim Recording"),
  rx: requiresRecording("rx", "Edit", "Delete"),
  pp: requiresRecording("pp", "Controls", "Play/Pause Recording"),
  pk: requiresRecording("pk", "Controls", "Jump Backward 15s"),
  pf: requiresRecording("pf", "Controls", "Jump Forward 15s"),
  rn: async (memos) => {
    const { app, probe } = memos;
    const start = await probe.menu(bundleId, "File", "Start New Recording");
    if (start.enabled === false) {
      await app.expectFailure("rn", /Menu item "Start New Recording".*is disabled/);
      return;
    }
    const noMicrophone = async () =>
      (await memos.nodes()).find((node) => matches(node, "No Microphone Available"));
    expect(await noMicrophone()).toBeUndefined();
    try {
      await app.runChecked("rn");
      await waitFor(noMicrophone);
    } finally {
      if (await noMicrophone()) await probe.pressControl(bundleId, "AXButton", "OK");
      await waitFor(async () => ((await noMicrophone()) ? undefined : true));
    }
  },
  vs: async ({ app, probe }) => {
    const sidebarItem = async () =>
      flattenAX([await probe.menu(bundleId, "View")]).find((node) =>
        /^(Show|Hide) Sidebar$/.test(node.title ?? ""),
      )?.title;
    const before = await sidebarItem();
    expect(before).toMatch(/^(Show|Hide) Sidebar$/);
    const after = before === "Show Sidebar" ? "Hide Sidebar" : "Show Sidebar";
    await app.runChecked("vs");
    try {
      await waitFor(async () => (await sidebarItem()) === after || undefined);
    } finally {
      if ((await sidebarItem()) === after) await app.runChecked("vs");
      await waitFor(async () => (await sidebarItem()) === before || undefined);
    }
  },
  jf: async ({ app, probe }) => {
    const focused = async () => (await probe.focus(bundleId)).subrole === "AXSearchField";
    expect(await focused()).toBe(false);
    try {
      await app.runChecked("jf");
      await waitFor(async () => (await focused()) || undefined);
    } finally {
      await probe.key(53);
      await waitFor(async () => !(await focused()) || undefined);
    }
  },
  "s,": async (memos) => {
    const settings = async () =>
      (await memos.nodes()).find((node) => matches(node, "Audio Quality"));
    expect(await settings()).toBeUndefined();
    try {
      await memos.app.runChecked("s,");
      await waitFor(settings);
    } finally {
      if (await settings()) await memos.probe.key(13, 1 << 20);
      await waitFor(async () => ((await settings()) ? undefined : true));
    }
  },
};

test("every Voice Memos binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/VoiceMemos/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Voice Memos chords reach recording controls, search and settings",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const memos = new VoiceMemos(app, probe);
        await memos.ready();
        const failures: string[] = [];
        for (const [sequence, run] of Object.entries(cases)) {
          try {
            await run(memos);
            console.log(`Voice Memos ${sequence} passed`);
          } catch (error) {
            failures.push(`Voice Memos ${sequence}: ${error}`);
          }
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  240_000,
);
