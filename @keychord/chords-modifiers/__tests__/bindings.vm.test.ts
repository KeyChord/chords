import { expect, test } from "bun:test";
import {
  launchMacOSFixture,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const combinations: Record<string, number> = {
  ";kmy": 1 << 20,
  ";kcy": 1 << 18,
  ";kay": 1 << 19,
  ";kfy": 1 << 23,
  ";ksy": 1 << 17,
  ";kmysa": (1 << 20) | (1 << 17) | (1 << 19),
};

test.skipIf(!macOSUITestsEnabled)(
  "all five modifier chords send the right key and modifier flags",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const fixture = await launchMacOSFixture(
          new URL("./KeyFixture.swift", import.meta.url),
          "dev.keychord.modifier-fixture",
        );
        try {
          await waitFor(async () =>
            (await probe.front()) === fixture.bundleId ? true : undefined,
          );
          const read = (): Promise<{ code: number; flags: number }[]> =>
            Bun.file(fixture.output).json();
          for (const [sequence, flags] of Object.entries(combinations)) {
            const initial = (await read()).length;
            await app.run(sequence);
            const keys = await waitFor(async () => {
              const keys = await read();
              return keys.length > initial ? keys : undefined;
            });
            expect(keys[initial]?.code, sequence).toBe(16); // ANSI Y.
            expect(keys[initial]?.flags & 0x009e0000, sequence).toBe(flags);
          }
        } finally {
          await fixture.close();
        }
      }),
    );
  },
  90_000,
);
