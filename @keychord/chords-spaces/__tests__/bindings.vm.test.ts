import { expect, test } from "bun:test";
import {
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const navigation: [string, number][] = [
  [";s2", 2],
  [";s]", 3],
  [";s[", 2],
  [";sr", 3],
  [";sl", 2],
  [";s1", 1],
  ...[3, 4, 5, 6, 7, 8, 9].map((number): [string, number] => [`;s${number}`, number]),
];

test.skipIf(!macOSUITestsEnabled)(
  "all 13 Space chords switch the real desktop",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.prepareDesktops(9);
        const read = () => probe.desktops();
        const { desktops } = await read();
        expect(desktops).toHaveLength(9);
        // First move away from the next case's destination so a no-op cannot pass.
        if ((await read()).activeSpace === desktops[1]) {
          await app.run(";s1");
          await waitFor(async () =>
            (await read()).activeSpace === desktops[0] ? true : undefined,
          );
        }
        for (const [sequence, desktop] of navigation) {
          expect((await read()).activeSpace, sequence).not.toBe(desktops[desktop - 1]);
          await app.run(sequence);
          try {
            await waitFor(
              async () => ((await read()).activeSpace === desktops[desktop - 1] ? true : undefined),
              12_000,
            );
          } catch (error) {
            throw new Error(
              `${sequence} did not select Desktop ${desktop}. State ${JSON.stringify(await read())}`,
              { cause: error },
            );
          }
          await app.flush();
          console.log(`Space ${sequence} selected Desktop ${desktop}`);
        }
      }),
    );
  },
  180_000,
);
