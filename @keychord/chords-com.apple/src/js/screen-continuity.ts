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

export default function buildScreenContinuityHandler() {
  let pending = Promise.resolve();

  return function click(sequence: string): Promise<void> {
    // Validate now, including the tail, before loading native code or requesting input.
    let positions: ReturnType<typeof parseClickSequence>;
    try {
      positions = parseClickSequence(sequence);
    } catch (error) {
      return Promise.reject(error);
    }

    const action = pending.then(async () => {
      addon ??= openScreenContinuityAddon();
      const bounds = JSON.parse(await addon.getScreenBounds()) as ScreenBounds;
      const points = resolveClickSequence(positions, bounds);
      await addon.clickPoints(JSON.stringify({ bounds, points }));
    });
    // A failed sequence must not prevent the next chord from running.
    pending = action.catch(() => {});
    return action;
  };
}
