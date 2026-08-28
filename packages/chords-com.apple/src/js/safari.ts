/**
 * Safari handler for Chord's Bun runtime.
 *
 * Bun handles the small amount of `defaults`/application lifecycle work. Safari and the
 * Accessibility API are driven in-process by `src/ffi/safari/safari.swift`, compiled by
 * `@keychord/config` to `target/<triple>/safari/safari.dylib`.
 */
import { CString, dlopen, FFIType } from "bun:ffi";
import { resolveFfiPath } from "chord";

const safariDomain = "com.apple.Safari";

type SafariLibrary = ReturnType<typeof openSafariLibrary>;

let library: SafariLibrary | undefined;

function openSafariLibrary() {
  return dlopen(resolveFfiPath(import.meta, "safari"), {
    chordsSafariRunJavaScript: {
      args: [FFIType.cstring],
      returns: FFIType.ptr,
    },
    chordsSafariOpenDeveloperSettings: {
      args: [],
      returns: FFIType.ptr,
    },
    chordsSafariFree: {
      args: [FFIType.ptr],
      returns: FFIType.void,
    },
  });
}

/** NUL-terminated UTF-8 for a `cstring` argument. */
function cstr(value: string): Buffer {
  return Buffer.from(`${value}\0`, "utf8");
}

function throwNativeError(
  error: ReturnType<SafariLibrary["symbols"]["chordsSafariRunJavaScript"]>,
): void {
  if (!error) return;

  const message = new CString(error).toString();
  library!.symbols.chordsSafariFree(error);
  throw new Error(message);
}

function runJavaScript(source: string): void {
  library ??= openSafariLibrary();
  throwNativeError(library.symbols.chordsSafariRunJavaScript(cstr(source)));
}

function openDeveloperSettingsPane(): void {
  library ??= openSafariLibrary();
  throwNativeError(library.symbols.chordsSafariOpenDeveloperSettings());
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
