import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.Chess";
const savedPosition = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Variant</key><string>Normal</string>
  <key>WhiteType</key><string>human</string>
  <key>BlackType</key><string>human</string>
  <key>Position</key><string>${savedPosition}</string>
  <key>Holding</key><string></string>
  <key>Moves</key><string>e2e4
e7e5
</string>
</dict>
</plist>
`;

const sequences = {
  newGame: "gn",
  open: "go",
  save: "gs",
  saveAs: "ge",
  settings: "g,",
  takeBack: "mk",
  gameLog: "ml",
  edgeNotation: "ve",
};

test("every Chess binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Chess/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.values(sequences).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Chess chords operate on a local two-player game",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    const scratch = await mkdtemp(join(tmpdir(), "chordtest-chess-"));
    const game = join(scratch, "Chordtest.game");
    try {
      await Bun.write(game, fixture);
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(bundle, game);
          const nodes = async () => flattenAX(await probe.windows(bundle, 8).catch(() => []));
          const has = async (role: string, label: RegExp) =>
            (await nodes()).some(
              (node) =>
                node.role === role &&
                [node.title, node.description, node.value].some(
                  (value) => typeof value === "string" && label.test(value),
                ),
            )
              ? true
              : undefined;
          const pawn = (color: string, square: string) =>
            has("AXButton", new RegExp(`^${color} pawn, ${square}$`, "i"));
          const dismissGameCenter = async () => {
            const skip = (await nodes()).find(
              ({ id, enabled, position, size }) =>
                id === "GameOverlayViewService.onboarding.secondaryButton" &&
                enabled &&
                position &&
                size,
            );
            if (!skip?.position || !skip.size) return false;
            await probe.clickPoint(
              skip.position[0] + skip.size[0] / 2,
              skip.position[1] + skip.size[1] / 2,
            );
            return true;
          };
          const closeSheet = async (confirm: string, visible: () => Promise<true | undefined>) => {
            const cancel = await waitFor(async () => {
              if (await dismissGameCenter()) return;
              if (!(await visible())) return false;
              const windows = await nodes();
              for (const panel of windows
                .filter(({ role }) => ["AXSheet", "AXWindow", "AXDialog"].includes(role ?? ""))
                .reverse()) {
                const buttons = flattenAX(panel.children ?? []).filter(
                  ({ role }) => role === "AXButton",
                );
                if (
                  !buttons.some(({ title, description, value }) =>
                    [title, description, value].includes(confirm),
                  )
                )
                  continue;
                const button = buttons.find(
                  ({ title, description, value, enabled, position, size }) =>
                    [title, description, value].includes("Cancel") && enabled && position && size,
                );
                if (button) return button;
              }
            }, 10_000).catch(async (cause) => {
              const buttons = (await nodes()).filter(
                ({ role, title, description, id }) =>
                  role === "AXButton" &&
                  (["Open", "Save", "Start", "Cancel"].some((label) =>
                    [title, description].includes(label),
                  ) ||
                    id?.startsWith("GameOverlayViewService")),
              );
              throw new Error(
                `Could not locate the Chess ${confirm} panel cancel button: ` +
                  JSON.stringify(buttons),
                { cause },
              );
            });
            if (cancel) {
              await probe.clickPoint(
                cancel.position![0] + cancel.size![0] / 2,
                cancel.position![1] + cancel.size![1] / 2,
              );
            }
            await waitFor(async () => {
              if (await dismissGameCenter()) return;
              return !(await visible()) || undefined;
            }).catch(async (cause) => {
              const windows = await probe.windows(bundle);
              const focus = await probe.focus(bundle).catch(() => undefined);
              throw new Error(
                `Could not dismiss Chess ${confirm} panel: ${JSON.stringify({ windows, focus })}`,
                { cause },
              );
            });
            if ((await probe.front()) !== bundle) await probe.activate(bundle);
          };
          const loadedPosition = async () => {
            if (await dismissGameCenter()) return;
            return pawn("white", "e4");
          };
          try {
            await waitFor(loadedPosition, 12_000);
          } catch (cause) {
            if (!(await probe.windows(bundle)).length) await probe.activate(bundle, game);
            await waitFor(loadedPosition, 15_000).catch(async () => {
              const windows = await probe.windows(bundle);
              const focus = await probe.focus(bundle).catch(() => undefined);
              throw new Error(
                "Chess did not open its saved position: " + JSON.stringify({ windows, focus }),
                { cause },
              );
            });
          }
          await waitFor(() => pawn("black", "e5"));
          const ready = () =>
            waitFor(async () => {
              if (await dismissGameCenter()) return;
              return (await probe.menu(bundle, "Game", "New…").catch(() => undefined))?.enabled
                ? true
                : undefined;
            }, 15_000);
          const runGameChord = async (sequence: string) => {
            await ready();
            try {
              await app.runChecked(sequence);
            } catch (cause) {
              if (!/Menu path "Game > [^"]+".*Available items: \[\]/.test(String(cause)))
                throw cause;
              await ready();
              await app.runChecked(sequence);
            }
          };
          await ready();

          for (const [sequence, path] of [
            [sequences.gameLog, ["Moves", "Game Log"]],
            [sequences.edgeNotation, ["View", "Edge Notation"]],
          ] as const) {
            const item = () => probe.menu(bundle, ...path).catch(() => undefined);
            const mark = async () => {
              const current = await item();
              if (current) return Boolean(current.mark);
            };
            const before = await waitFor(async () =>
              (await item())?.enabled ? mark() : undefined,
            );
            await app.runChecked(sequence);
            await waitFor(async () => {
              const current = await mark();
              return (current !== undefined && current !== before) || undefined;
            });
            await app.runChecked(sequence);
            await waitFor(async () => (await mark()) === before || undefined);
          }

          await app.runChecked(sequences.takeBack);
          await waitFor(() => pawn("black", "e7"));
          expect(await pawn("black", "e5")).toBeUndefined();

          const savePanel = () => has("AXButton", /^Save$/);
          await ready();
          const save = await waitFor(
            () => probe.menu(bundle, "Game", "Save").catch(() => undefined),
            10_000,
          );
          if (save.enabled === false) {
            await app.expectFailure(sequences.save, /Menu item "Save".*is disabled/);
            console.log("Chess verified the disabled Save command for the loaded game");
          } else {
            const position = () => {
              const result = Bun.spawnSync([
                "/usr/bin/plutil",
                "-extract",
                "Position",
                "raw",
                "-o",
                "-",
                game,
              ]);
              if (result.exitCode === 0) return result.stdout.toString().trim();
            };
            const beforeSave = position();
            await runGameChord(sequences.save);
            const outcome = await waitFor(async () => {
              if (await savePanel()) return "panel";
              const afterSave = position();
              if (afterSave && afterSave !== beforeSave && afterSave !== savedPosition)
                return "file";
            });
            if (outcome === "panel") await closeSheet("Save", savePanel);
          }

          const newSheet = () => has("AXButton", /^Start$/);
          expect(await newSheet()).toBeUndefined();
          await runGameChord(sequences.newGame);
          await waitFor(newSheet);
          await closeSheet("Start", newSheet);
          await ready();
          await waitFor(() => pawn("black", "e7"));

          const openPanel = () => has("AXButton", /^Open$/);
          expect(await openPanel()).toBeUndefined();
          await runGameChord(sequences.open);
          await waitFor(openPanel);
          await closeSheet("Open", openPanel);
          await ready();

          expect(await savePanel()).toBeUndefined();
          await runGameChord(sequences.saveAs);
          await waitFor(savePanel);
          await closeSheet("Save", savePanel);
          await ready();

          const settings = async () =>
            (await probe.windows(bundle, 6)).find((window) =>
              flattenAX([window]).some(
                (node) =>
                  node.role === "AXCheckBox" &&
                  [node.title, node.description].some((label) =>
                    /^(Speak (Human|Computer) Moves|Allow Player to Speak Moves)$/.test(
                      label ?? "",
                    ),
                  ),
              ),
            );
          expect(await settings()).toBeUndefined();
          await app.runChecked(sequences.settings);
          const preferences = await waitFor(settings);
          expect(preferences.title).toBeTruthy();
          await probe.closeWindow(bundle, preferences.title!);
          await waitFor(async () =>
            (await probe.window(bundle)).title !== preferences.title ? true : undefined,
          );
          await ready();
        }),
      );
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  },
  240_000,
);
