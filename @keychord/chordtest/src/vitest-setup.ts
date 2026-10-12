import * as chord from "./chord";
import { beforeEach, vi } from "vite-plus/test";

// Only reset Chord's exports; preserve other suites' independently configured mocks.
beforeEach(() => {
  for (const value of Object.values(chord)) {
    if (vi.isMockFunction(value)) value.mockReset();
  }
});
