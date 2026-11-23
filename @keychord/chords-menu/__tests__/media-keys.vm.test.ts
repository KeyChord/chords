import { expect, test } from "bun:test";
import {
  launchMacOSFixture,
  macOSUITestsEnabled,
  requireMacOSVM,
  runCommand,
  waitFor,
  withChordPackage,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "brightness and volume chords send macOS media-key events",
  async () => {
    requireMacOSVM();
    const bundleId = "dev.keychord.media-key-fixture";
    await runCommand([
      "sudo",
      "sqlite3",
      "/Library/Application Support/com.apple.TCC/TCC.db",
      `INSERT OR REPLACE INTO access (service, client, client_type, auth_value, auth_reason, auth_version, csreq, policy_id, indirect_object_identifier_type, indirect_object_identifier, indirect_object_code_identity, flags, last_modified) VALUES ('kTCCServiceListenEvent', '${bundleId}', 0, 2, 4, 1, NULL, NULL, 0, 'UNUSED', NULL, 0, strftime('%s','now'));`,
    ]);
    await runCommand(["sudo", "killall", "tccd"]);
    await withChordPackage(import.meta.url, async (app) => {
      const fixture = await launchMacOSFixture(
        new URL("./MediaKeyFixture.swift", import.meta.url),
        bundleId,
      );
      try {
        const read = (): Promise<number[]> => Bun.file(fixture.output).json();
        for (const [sequence, key] of Object.entries({
          ";bvu": 0,
          ";bvd": 1,
          ";bbu": 2,
          ";bbd": 3,
          ";bvm": 7,
        })) {
          const before = (await read()).length;
          await app.run(sequence);
          const events = await waitFor(async () => {
            const values = await read();
            return values.length > before ? values.slice(before) : undefined;
          }, 10_000);
          expect(events, sequence).toContain(key);
        }
      } finally {
        await fixture.close();
      }
    });
  },
  120_000,
);
