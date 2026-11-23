import { test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const safari = "com.apple.Safari";

test.skipIf(!macOSUITestsEnabled)(
  "Safari JavaScript chord opens Developer settings on first use",
  async () => {
    await runCommand([
      "/usr/bin/defaults",
      "write",
      safari,
      "AllowJavaScriptFromAppleEvents",
      "-bool",
      "false",
    ]);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(safari, "about:blank");
        await app.flush();
        await app.runChecked("js");
        await waitFor(async () => {
          const nodes = flattenAX(await probe.windows(safari, 7));
          return nodes.some((node) =>
            [node.title, node.description].some((text) =>
              /Allow JavaScript from Apple Events/i.test(text ?? ""),
            ),
          )
            ? true
            : undefined;
        }, 30_000);
      }),
    );
  },
  90_000,
);
