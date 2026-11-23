import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.Console";
const toggles = {
  ln: ["Action", "Now Mode"],
  vs: ["View", "Sources"],
  va: ["View", "Activities View"],
};
const filters = { li: "Include Info Messages", ld: "Include Debug Messages" };

test("every Console binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Console/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["fo", "js", "ls", "lc", ...Object.keys(toggles), ...Object.keys(filters)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Console opens logs, streams local messages, and changes its filters and views",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(async () => {
          const window = await probe.window(bundle);
          return window.subrole === "AXStandardWindow" ? window : undefined;
        }, 15_000);
        const nodes = async () => flattenAX(await probe.windows(bundle, 8));
        const openPanel = async () =>
          (await nodes()).find((node) => node.role === "AXButton" && node.title === "Open");
        await app.runChecked("fo");
        await waitFor(openPanel);
        await probe.key(53); // Escape the file picker.
        await waitFor(async () => (!(await openPanel()) ? true : undefined));

        const menuTitle = async (menu: string, text: string) => {
          const root = await probe.menu(bundle, menu);
          return flattenAX([root]).find((node) => node.title?.endsWith(text))?.title;
        };
        const streaming = async () => {
          for (const title of ["Start Streaming", "Pause Streaming"]) {
            const item = await probe.menu(bundle, "Action", title).catch(() => undefined);
            if (item?.enabled) return title === "Pause Streaming";
          }
        };
        const wasStreaming = await waitFor(streaming);
        if (wasStreaming) {
          await probe.press(bundle, "Action", "Pause Streaming");
          await waitFor(async () => ((await streaming()) === false ? true : undefined));
        }
        await app.runChecked("ls");
        await waitFor(async () => ((await streaming()) === true ? true : undefined));
        try {
          await app.runChecked("js");
          await waitFor(async () => {
            const focus = await probe.focus(bundle);
            return focus.subrole === "AXSearchField" ||
              (focus.role === "AXTextField" && /search/i.test(focus.description ?? ""))
              ? true
              : undefined;
          });
          await probe.key(53);

          for (const [key, title] of Object.entries(filters)) {
            const mark = async () => (await probe.menu(bundle, "Action", title)).mark;
            const before = await mark();
            await app.runChecked(key);
            await waitFor(async () => ((await mark()) !== before ? true : undefined));
            await app.runChecked(key);
            await waitFor(async () => ((await mark()) === before ? true : undefined));
          }

          for (const [key, [menu, text]] of Object.entries(toggles)) {
            const title = () => menuTitle(menu, text);
            const before = await waitFor(title);
            await app.runChecked(key);
            await waitFor(async () => {
              const after = await title();
              return after && after !== before ? true : undefined;
            });
            await app.runChecked(key);
            await waitFor(async () => ((await title()) === before ? true : undefined));
          }

          // Search for a unique guest-generated message so a busy stream cannot bury it.
          const marker = "chordtestconsole" + Date.now();
          await app.runChecked("js");
          await runCommand([
            "/bin/sh",
            "-c",
            'printf %s "$1" | /usr/bin/pbcopy',
            "chordtest",
            marker,
          ]);
          await probe.key(9, 1 << 20); // Command-V
          await probe.key(36);
          await runCommand(["/usr/bin/logger", "-p", "user.notice", marker]);
          const message = async () =>
            (await nodes()).find(
              (node) =>
                node.role === "AXStaticText" && (node.value === marker || node.title === marker),
            );
          await waitFor(message, 12_000);
          await app.runChecked("lc");
          await waitFor(async () => (!(await message()) ? true : undefined));
        } finally {
          if ((await streaming()) === true) {
            await app.runChecked("ls");
            await waitFor(async () => ((await streaming()) === false ? true : undefined));
          }
          if (wasStreaming) await probe.press(bundle, "Action", "Start Streaming");
        }
      }),
    );
  },
  150_000,
);
