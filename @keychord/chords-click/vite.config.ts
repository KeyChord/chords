import { config } from "@keychord/config";
import { chordTestRuntime } from "@keychord/chordtest/vitest";

const base = config();
const runtime = chordTestRuntime();
export default { ...base, ...runtime, plugins: [...(base.plugins ?? []), ...runtime.plugins] };
