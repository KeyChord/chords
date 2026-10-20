import {
  parseClickSequence,
  resolveClickSequence,
  type ScreenBounds,
} from "@keychord/chords-click/sequence";
import {
  openScreenContinuityAddon,
  type ScreenContinuityAddon,
} from "./utils/screen-continuity-native";

let addon: ScreenContinuityAddon | undefined;
let pending = Promise.resolve();

export default function buildScreenContinuityHandler(mode: "TAP" | "HOVER" = "TAP") {
  return function click(sequence: string): Promise<void> {
    // Validate now, including the tail, before loading native code or requesting input.
    let positions: ReturnType<typeof parseClickSequence>;
    try {
      positions =
        mode === "HOVER"
          ? parseClickSequence(sequence, "MOVE", 36)
          : sequence.startsWith("-")
            ? parseClickSequence(sequence.slice(1), "DRAG", 36)
            : parseClickSequence(sequence, undefined, 36);
      if (mode === "HOVER" && positions.some((point) => point.click !== "MOVE" || point.hold)) {
        throw new TypeError("Hover accepts coordinate pairs without click, drag or hold modifiers");
      }
    } catch (error) {
      return Promise.reject(error);
    }

    const action = pending.then(async () => {
      addon ??= openScreenContinuityAddon();
      const bounds = JSON.parse(await addon.getScreenBounds()) as ScreenBounds;
      const points = resolveClickSequence(positions, bounds, mode !== "HOVER");
      await addon.clickPoints(
        JSON.stringify({ bounds, points, ...(mode === "HOVER" ? { hover: true } : {}) }),
      );
    });
    // A failed sequence must not prevent the next chord from running.
    pending = action.catch(() => {});
    return action;
  };
}
