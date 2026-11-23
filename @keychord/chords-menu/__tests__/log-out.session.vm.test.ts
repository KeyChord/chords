import { expect, test } from "bun:test";
import {
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  ";blq ends the macOS session without confirmation",
  async () => {
    const currentUser = async () =>
      (await runCommand(["/usr/bin/stat", "-f", "%Su", "/dev/console"])).stdout.trim();
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate("com.apple.finder");
        const before = await currentUser();
        expect(before).not.toBe("root");
        await app.run(";blq");
        await waitFor(async () => ((await currentUser()) !== before ? true : undefined), 25_000);
      }),
    );
  },
  90_000,
);
