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
const initialPosition = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Variant</key><string>Normal</string>
  <key>WhiteType</key><string>human</string>
  <key>BlackType</key><string>human</string>
  <key>Position</key><string>${initialPosition}</string>
  <key>Holding</key><string></string>
  <key>Moves</key><string></string>
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
          const movePawn = async (color: string, from: string, to: string) => {
            await probe.pressControl(bundle, "AXButton", `${color} pawn, ${from}`);
            await probe.pressControl(bundle, "AXButton", to);
            await waitFor(() => pawn(color, to));
          };
          const closeSheet = async (visible: () => Promise<true | undefined>) => {
            await probe.key(53);
            await waitFor(async () => (!(await visible()) ? true : undefined));
          };
          await waitFor(() => pawn("white", "e2"), 15_000);

          const newSheet = () => has("AXButton", /^Start$/);
          expect(await newSheet()).toBeUndefined();
          await app.runChecked(sequences.newGame);
          await waitFor(newSheet);
          await closeSheet(newSheet);
          await waitFor(() => pawn("white", "e2"));

          const openPanel = () => has("AXButton", /^Open$/);
          expect(await openPanel()).toBeUndefined();
          await app.runChecked(sequences.open);
          await waitFor(openPanel);
          await closeSheet(openPanel);

          const savePanel = () => has("AXButton", /^Save$/);
          expect(await savePanel()).toBeUndefined();
          await app.runChecked(sequences.saveAs);
          await waitFor(savePanel);
          await closeSheet(savePanel);

          const settings = () =>
            has("AXCheckBox", /^(Speak (Human|Computer) Moves|Allow Player to Speak Moves)$/);
          expect(await settings()).toBeUndefined();
          await app.runChecked(sequences.settings);
          await waitFor(settings);
          await closeSheet(settings);

          for (const [sequence, path] of [
            [sequences.gameLog, ["Moves", "Game Log"]],
            [sequences.edgeNotation, ["View", "Edge Notation"]],
          ] as const) {
            const mark = async () => Boolean((await probe.menu(bundle, ...path)).mark);
            const before = await mark();
            await app.runChecked(sequence);
            await waitFor(async () => ((await mark()) !== before ? true : undefined));
            await app.runChecked(sequence);
            await waitFor(async () => ((await mark()) === before ? true : undefined));
          }

          await movePawn("white", "e2", "e4");
          await movePawn("black", "e7", "e5");
          expect(await pawn("white", "e2")).toBeUndefined();
          await app.runChecked(sequences.takeBack);
          await waitFor(() => pawn("white", "e2"));
          await waitFor(() => pawn("black", "e7"));
          expect(await pawn("white", "e4")).toBeUndefined();

          const windowCount = (await probe.windows(bundle)).length;
          await probe.press(bundle, "Game", "New…");
          await waitFor(newSheet);
          await probe.pressControl(bundle, "AXButton", "Start");
          await waitFor(async () => (!(await newSheet()) ? true : undefined));
          expect(await savePanel()).toBeUndefined();
          await app.runChecked(sequences.save);
          await waitFor(savePanel);
          await closeSheet(savePanel);
          await probe.key(13, 1 << 20);
          await waitFor(async () =>
            (await probe.windows(bundle)).length === windowCount ? true : undefined,
          );
          await probe.key(13, 1 << 20);
        }),
      );
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  },
  240_000,
);
