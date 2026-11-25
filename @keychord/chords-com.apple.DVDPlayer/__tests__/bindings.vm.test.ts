import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const player = "com.apple.DVDPlayer";
const discCases = {
  pp: ["Controls", "Play"],
  ph: ["Controls", "Stop"],
  pf: ["Controls", "Scan Forward"],
  pk: ["Controls", "Scan Backwards"],
  pe: ["Controls", "Eject DVD"],
  "g[": ["Go", "Previous Chapter"],
  "g]": ["Go", "Next Chapter"],
  gk: ["Go", "Skip Back 5 seconds"],
  gf: ["Go", "Skip Ahead 5 seconds"],
  ga: ["Go", "Beginning of Disc"],
  gm: ["Go", "DVD Menu"],
};
const toggleCases = {
  vf: ["View", /^(Enter|Exit) Full Screen$/],
  vc: ["Features", /^Turn (On|Off) Closed Captioning$/],
} as const;

test("every DVD Player binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/DVDPlayer/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["fo", ...Object.keys(discCases), ...Object.keys(toggleCases)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "DVD Player opens the media picker and handles controls without a disc",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(player);
        try {
          const openMedia = () => probe.menu(player, "File", "Open DVD Media…");
          await waitFor(
            async () => (await openMedia().catch(() => undefined))?.enabled || undefined,
            15_000,
          );

          const picker = async () => {
            const nodes = flattenAX(await probe.windows(player, 7));
            return (
              nodes.find((node) => node.subrole === "AXOpenPanel") ??
              nodes.find((node) => node.role === "AXButton" && node.title === "Open")
            );
          };
          expect(await picker()).toBeUndefined();
          await app.runChecked("fo");
          await waitFor(picker, 10_000);
          const cancel = await waitFor(async () =>
            flattenAX(await probe.windows(player, 8)).find(
              ({ role, title, description, enabled, position, size }) =>
                role === "AXButton" &&
                [title, description].includes("Cancel") &&
                enabled &&
                position &&
                size,
            ),
          );
          const [x, y] = cancel.position!;
          const [width, height] = cancel.size!;
          await probe.clickPoint(x + width / 2, y + height / 2);
          await waitFor(async () => !(await picker()) || undefined);

          for (const [sequence, path] of Object.entries(discCases)) {
            const item = await probe.menu(player, ...path);
            expect(item.enabled).toBe(false);
            await app.expectFailure(sequence, /Menu item .* is disabled/);
          }

          for (const [sequence, [menu, pattern]] of Object.entries(toggleCases)) {
            const read = async () =>
              flattenAX([await probe.menu(player, menu)]).find((node) =>
                pattern.test(node.title ?? ""),
              );
            const before = await waitFor(read);
            if (before.enabled === false) {
              await app.expectFailure(sequence, /Menu item .* is disabled/);
              continue;
            }
            await app.runChecked(sequence);
            await waitFor(async () => {
              const after = await read();
              return after && (after.title !== before.title || after.mark !== before.mark)
                ? true
                : undefined;
            }, 12_000);
            await app.runChecked(sequence);
            await waitFor(async () => {
              const after = await read();
              return after?.title === before.title && after?.mark === before.mark
                ? true
                : undefined;
            }, 12_000);
          }
        } finally {
          await runCommand(["/usr/bin/killall", "DVD Player"]);
          await waitFor(async () => ((await probe.running(player)) ? undefined : true));
        }
      }),
    );
  },
  180_000,
);
