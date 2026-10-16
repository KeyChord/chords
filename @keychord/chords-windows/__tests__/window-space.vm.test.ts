import { expect, test } from "bun:test";
import {
  launchMacOSFixture,
  macOSUITestsEnabled,
  requireMacOSVM,
  runCommand,
  runChordScript,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "window Space chords move only the captured window without switching desktops",
  async () => {
    requireMacOSVM();
    // Only this disposable guest is modified. The fixture presses Mission Control's
    // Add Desktop button to prepare real destinations for the production handler.
    await runCommand([
      "sudo",
      "sqlite3",
      "/Library/Application Support/com.apple.TCC/TCC.db",
      "INSERT OR REPLACE INTO access (service, client, client_type, auth_value, auth_reason, auth_version, csreq, policy_id, indirect_object_identifier_type, indirect_object_identifier, indirect_object_code_identity, flags, last_modified) VALUES ('kTCCServiceAccessibility', 'dev.keychord.window-space-fixture', 0, 2, 4, 1, NULL, NULL, 0, 'UNUSED', NULL, 0, strftime('%s','now'));",
    ]);
    await runCommand(["sudo", "killall", "tccd"]);
    const target = await launchMacOSFixture(
      new URL("./WindowSpaceFixture.swift", import.meta.url),
      "dev.keychord.window-space-fixture",
    );
    try {
      const cover = await launchMacOSFixture(
        new URL("./WindowFixture.swift", import.meta.url),
        "dev.keychord.window-space-cover",
      );
      try {
        const result = await runChordScript(
          new URL("./window-space.integration.ts", import.meta.url),
          [target.bundleId, target.output, cover.bundleId],
        );
        expect(result.stdout).toContain("window-space-ok");
      } finally {
        await cover.close();
      }
    } finally {
      await target.close();
    }
  },
  120_000,
);
