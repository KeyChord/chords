/**
 * Safari handler for Chord's Bun runtime.
 *
 * Bun handles the small amount of `defaults`/application lifecycle work. Safari and the
 * Accessibility API are driven in-process by `src/swift/safari/safari.swift`, compiled by
 * `@keychord/config` to `target/<triple>/safari/safari.node`.
 */
import { resolveNativeModulePath } from "chord";

const safariDomain = "com.apple.Safari";

type SafariAddon = {
  runJavaScript(source: string): void;
  openDeveloperSettings(): void;
};

let addon: SafariAddon | undefined;

function openSafariAddon(): SafariAddon {
  const module = { exports: {} as SafariAddon };
  process.dlopen(module, resolveNativeModulePath(import.meta, "safari"));
  return module.exports;
}

function runJavaScript(source: string): void {
  addon ??= openSafariAddon();
  addon.runJavaScript(source);
}

function openDeveloperSettingsPane(): void {
  addon ??= openSafariAddon();
  addon.openDeveloperSettings();
}

async function readBooleanDefault(domain: string, key: string): Promise<boolean> {
  const result = await runCommand(["defaults", "read", domain, key], true);
  return result.exitCode === 0 && result.stdout.trim() === "1";
}

async function runCommand(
  command: string[],
  allowFailure = false,
): Promise<{ exitCode: number; stdout: string }> {
  const subprocess = Bun.spawn(command, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ]);

  if (exitCode !== 0 && !allowFailure) {
    const detail = stderr.trim();
    throw new Error(
      `Command failed with exit code ${exitCode}: ${command.join(" ")}${detail ? `\n${detail}` : ""}`,
    );
  }
  return { exitCode, stdout };
}

async function enableDevelopMenu(): Promise<void> {
  await runCommand(["defaults", "write", safariDomain, "IncludeDevelopMenu", "-bool", "true"]);
  await runCommand([
    "defaults",
    "write",
    "com.apple.Safari.SandboxBroker",
    "ShowDevelopMenu",
    "-bool",
    "true",
  ]);
  await runCommand([
    "defaults",
    "write",
    safariDomain,
    "WebKitDeveloperExtrasEnabledPreferenceKey",
    "-bool",
    "true",
  ]);
  await runCommand([
    "defaults",
    "write",
    safariDomain,
    "com.apple.Safari.ContentPageGroupIdentifier.WebKit2DeveloperExtrasEnabled",
    "-bool",
    "true",
  ]);
}

export default async function buildSafariHandler() {
  const [isDevelopMenuEnabled, isAllowJavaScriptFromAppleEventsEnabled] = await Promise.all([
    readBooleanDefault(safariDomain, "IncludeDevelopMenu"),
    readBooleanDefault(safariDomain, "AllowJavaScriptFromAppleEvents"),
  ]);

  return async function safari() {
    if (!isAllowJavaScriptFromAppleEventsEnabled) {
      if (!isDevelopMenuEnabled) {
        await enableDevelopMenu();
        await runCommand(["killall", "-w", "Safari"]);
        await runCommand(["open", "-a", "Safari"]);
      }

      openDeveloperSettingsPane();
      return;
    }

    runJavaScript("document.title;");
  };
}
