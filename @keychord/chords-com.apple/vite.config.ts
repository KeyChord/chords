import { config } from "@keychord/config";
import { chordTestRuntime } from "@keychord/chordtest/vitest";

const base = config({
  native: { scratchDir: "node_modules/.cache/chord/native" },
  vendor: ["@keychord/chords-menu"],
});

const runtime = chordTestRuntime();
export default { ...base, ...runtime, plugins: [...(base.plugins ?? []), ...runtime.plugins] };
