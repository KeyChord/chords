/**
 * Safari handler for Chord's Bun runtime.
 *
 * Bun handles the small amount of `defaults`/application lifecycle work. Safari and the
 * Accessibility API are driven in-process by `Sources/KeychordChordsComAppleNativeSafari/safari.swift`, compiled by
 * `@keychord/config` to `target/<triple>/safari/safari.node`.
 */
import addon from "./safari.node";

const safariDomain = "com.apple.Safari";

export function runSafariJavaScript(source: string): void {
  addon.runJavaScript(source);
}

async function readBooleanDefault(domain: string, key: string): Promise<boolean> {
  const result = await runCommand(["/usr/bin/defaults", "read", domain, key], true);
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

export default function buildSafariHandler() {
  return async function safari() {
    if (!(await readBooleanDefault(safariDomain, "AllowJavaScriptFromAppleEvents"))) {
      await addon.openDeveloperSettings();
      return;
    }

    runSafariJavaScript("document.title;");
  };
}
