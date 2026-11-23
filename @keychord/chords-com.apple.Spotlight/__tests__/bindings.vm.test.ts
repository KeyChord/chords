import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  requireMacOSVM,
  runChordScript,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "the Spotlight fallback opens its query result",
  async () => {
    const { stdout: version } = await runCommand(["/usr/bin/sw_vers", "-productVersion"]);
    if (Number(version.split(".")[0]) < 27) {
      const result = await runChordScript(new URL("./unsupported.integration.ts", import.meta.url));
      expect(result.stdout).toContain("spotlight-unavailable-ok");
      return;
    }
    requireMacOSVM();
    const findTextEdit = async () => {
      const { stdout } = await runCommand(["/usr/bin/mdfind", "-name", "TextEdit"]);
      return stdout.split("\n").some((path) => path.endsWith("/TextEdit.app")) ? true : undefined;
    };
    // The Tart base image disables indexing. Spotlight needs the real application result.
    if (!(await findTextEdit())) {
      await runCommand(["/usr/bin/sudo", "/usr/bin/mdutil", "-i", "on", "/"]);
      await waitFor(findTextEdit, 90_000);
    }
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const panel = "com.apple.campo";
        const controls = async () => flattenAX(await probe.windows(panel, 8).catch(() => []));
        const panelVisible = async () =>
          (await controls()).some((node) => node.id === "SpotlightSearchField");
        const continuing = async () =>
          (await controls()).some(
            (node) =>
              node.role === "AXButton" && [node.title, node.description].includes("Continue"),
          );
        await probe.activate("com.apple.finder");
        await app.runChecked("/");
        await waitFor(async () => ((await panelVisible()) ? true : undefined), 12_000);
        console.log("Spotlight / opened the native search panel");
        // Complete the first-run Spotlight tour on the disposable guest.
        if (!(await panelVisible())) {
          await runCommand(["/usr/bin/open", "-b", panel, "spotlight://apps"]);
        }
        await waitFor(async () => ((await panelVisible()) ? true : undefined), 12_000);
        const scoped = async () =>
          (await controls()).some(
            (node) => node.role === "AXButton" && node.description === "Back",
          );
        if (await scoped()) {
          await probe.pressControl(panel, "AXButton", "Back");
          await waitFor(async () => ((await scoped()) ? undefined : true), 10_000);
        }
        if (await continuing()) {
          await probe.pressControl(panel, "AXButton", "Continue");
          await waitFor(async () => ((await continuing()) ? undefined : true), 12_000);
        }
        await app.runChecked("/textedit");
        await waitFor(
          async () => ((await probe.front()) === "com.apple.TextEdit" ? true : undefined),
          20_000,
        );
        console.log("Spotlight /textedit opened the native TextEdit result");
      }),
    );
  },
  150_000,
);
