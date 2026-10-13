import { expect, test } from "bun:test";
import { realpath } from "node:fs/promises";
import {
  launchMacOSFixture,
  macOSUITestsEnabled,
  requireMacOSVM,
  runCommand,
  runChordScript,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "tray and menu selections stay separate while searching menus and toggling visibility",
  async () => {
    requireMacOSVM();
    // This permission belongs only to the disposable guest, like its existing AX grants.
    // System Events controls menu-bar auto-hide through Apple events.
    // macOS attributes descendants launched by Tart to its guest agent, rather than osascript.
    const processes = await runCommand(["/bin/ps", "-axo", "comm="]);
    const agent = processes.stdout
      .split("\n")
      .map((line) => line.trim())
      .find((path) => path.endsWith("/tart-guest-agent"));
    if (!agent) throw new Error("Could not identify the Tart guest agent for Automation access");
    const clients = [await realpath(agent)];
    const grants = clients
      .map(
        (client) =>
          `INSERT OR REPLACE INTO access (service, client, client_type, auth_value, auth_reason, auth_version, csreq, policy_id, indirect_object_identifier_type, indirect_object_identifier, indirect_object_code_identity, flags, last_modified) VALUES ('kTCCServiceAppleEvents', '${client.replaceAll("'", "''")}', 1, 2, 4, 1, NULL, NULL, 0, 'com.apple.systemevents', NULL, 0, strftime('%s','now'));`,
      )
      .join("\n");
    await runCommand([
      "/usr/bin/sudo",
      "/usr/bin/sqlite3",
      `${process.env.HOME}/Library/Application Support/com.apple.TCC/TCC.db`,
      grants,
    ]);
    await runCommand(["/usr/bin/sudo", "/usr/bin/killall", "tccd"]);
    const fixture = await launchMacOSFixture(
      new URL("./MenuFixture.swift", import.meta.url),
      "dev.keychord.menu-bar-fixture",
    );
    try {
      const result = await runChordScript(
        new URL("./menu-bar.integration.ts", import.meta.url),
        [],
        {
          MENU_FIXTURE_OUTPUT: fixture.output,
          MENU_BAR_FIXTURE_APP: fixture.bundleId,
          MENU_BAR_PROBE: `${fixture.directory}/menu-bar-probe`,
        },
      );
      expect(result.stdout).toContain("menu bar integration passed");
    } catch (error) {
      const { stdout } = await runCommand([
        "/usr/bin/log",
        "show",
        "--info",
        "--last",
        "1m",
        "--style",
        "compact",
        "--predicate",
        'subsystem == "com.apple.TCC"',
      ]);
      console.info(
        "Automation diagnostics",
        stdout
          .split("\n")
          .filter((line) => /AppleEvents|osascript|PROMPT/.test(line))
          .slice(-50)
          .join("\n"),
      );
      throw error;
    } finally {
      await fixture.close();
    }
  },
  60_000,
);
