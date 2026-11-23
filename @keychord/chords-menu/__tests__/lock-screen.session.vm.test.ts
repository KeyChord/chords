import { expect, test } from "bun:test";
import {
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  ";bls locks the active macOS session",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate("com.apple.finder");
        expect(await probe.screenLocked()).toBeFalse();
        await app.run(";bls");
        await waitFor(async () => ((await probe.screenLocked()) ? true : undefined), 15_000);
      }),
    );
  },
  90_000,
);
