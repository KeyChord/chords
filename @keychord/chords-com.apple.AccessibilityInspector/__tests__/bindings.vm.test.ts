import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const inspector = "com.apple.AccessibilityInspector";
const application = "/Applications/Xcode.app/Contents/Applications/Accessibility Inspector.app";
const menuLabels: Record<string, RegExp> = {
  ir: /Refresh/,
  ip: /Point/,
  iu: /Parent/,
  id: /Child/,
  "i[": /Previous/,
  "i]": /Next/,
  va: /Auto-Interact/,
  vc: /Class Name/,
  vi: /Ignored Elements/,
};

test("every Accessibility Inspector binding has a native menu case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/AccessibilityInspector/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(menuLabels).sort());
});

const installed = await Bun.file(`${application}/Contents/Info.plist`).exists();
test.skipIf(!macOSUITestsEnabled || !installed)(
  "Accessibility Inspector chords reach the native Inspection controls",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await runCommand(["/usr/bin/open", "-a", application]);
        await waitFor(async () => ((await probe.front()) === inspector ? true : undefined), 15_000);
        const menu = () =>
          waitFor(() => probe.menu(inspector, "Inspection").catch(() => undefined), 15_000);
        await menu();
        for (const [sequence, pattern] of Object.entries(menuLabels)) {
          const read = async () =>
            flattenAX([await menu()]).find((node) => pattern.test(node.title ?? ""));
          const before = await read();
          expect(before, sequence).toBeDefined();
          if (before?.enabled === false) {
            await app.expectFailure(sequence, /Menu item .*is disabled/);
          } else if (sequence === "ip") {
            const scopeEnabled = async () =>
              flattenAX(await probe.windows(inspector, 5)).find((node) => node.id === "scope")
                ?.value;
            const initial = await scopeEnabled();
            expect(initial).toBeDefined();
            await app.run(sequence);
            await waitFor(async () => ((await scopeEnabled()) !== initial ? true : undefined));
            await app.run(sequence);
            await waitFor(async () => ((await scopeEnabled()) === initial ? true : undefined));
          } else if (sequence.startsWith("v")) {
            await app.runChecked(sequence);
            await waitFor(async () => {
              const after = await read();
              return after && (after.mark !== before?.mark || after.title !== before?.title)
                ? true
                : undefined;
            });
            await app.runChecked(sequence);
            await waitFor(async () => {
              const after = await read();
              return after?.title === before?.title && after?.mark === before?.mark
                ? true
                : undefined;
            });
          } else {
            await app.runChecked(sequence);
          }
          console.log(`Accessibility Inspector ${sequence} reached ${before?.title}`);
        }
      }),
    );
  },
  120_000,
);
