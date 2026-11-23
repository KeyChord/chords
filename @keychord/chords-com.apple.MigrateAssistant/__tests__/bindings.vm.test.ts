import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.MigrateAssistant";
const helpApps = ["com.apple.helpviewer", "com.apple.tips", "com.apple.Safari"];

test("every Migration Assistant binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/MigrateAssistant/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["ga", "gh"]);
});

test.skipIf(!macOSUITestsEnabled)(
  "Migration Assistant chords show version information and open its help",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        const welcome = async () =>
          flattenAX(await probe.windows(bundle, 8)).find(
            (node) =>
              node.role === "AXButton" && [node.title, node.description].includes("Continue"),
          );
        await waitFor(welcome, 15_000);

        const about = async () =>
          (await probe.windows(bundle, 5)).find((window) =>
            flattenAX([window]).some((node) =>
              [node.title, node.value, node.description].some(
                (text) => typeof text === "string" && /^Version\s+\d/i.test(text),
              ),
            ),
          );
        expect(await about()).toBeUndefined();
        try {
          await app.runChecked("ga");
          await waitFor(about, 12_000);
        } finally {
          if (await about()) await probe.key(13, 1 << 20);
          await waitFor(async () => ((await about()) ? undefined : true));
        }

        try {
          await app.runChecked("gh");
          await waitFor(async () => {
            const front = await probe.front();
            return helpApps.includes(front) && (await probe.windows(front)).length
              ? true
              : undefined;
          }, 15_000);
        } finally {
          if (helpApps.includes(await probe.front())) await probe.key(13, 1 << 20);
          await probe.activate(bundle);
          await waitFor(welcome);
        }
      }),
    );
  },
  120_000,
);
