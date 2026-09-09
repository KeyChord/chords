import { config } from "@keychord/config";

const base = config();

// Chord attaches `import.meta.chord` as it loads each module; the test runner does not.
// `tests/setup.ts` stands the namespace up before any module is imported.
export default Object.assign(base, {
  test: { setupFiles: ["./tests/setup.ts"] },
});
