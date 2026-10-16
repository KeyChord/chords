import pWaitFor from "p-wait-for";
import { v4 as uuidv4 } from "uuid";
import isUUID from "validator/lib/isUUID.js";

type Command = (args: string[]) => Promise<string>;

function managedTarget(name: string): string | undefined {
  // Recognize the old /ms marker so existing virtual screens can still be replaced or reset.
  const match = /^Chord \/m[ds] (\S+) [1-9]\d*x[1-9]\d* (\S+)$/.exec(name);
  return match && isUUID(match[1], "loose") && isUUID(match[2], "loose") ? match[1] : undefined;
}

export class BetterDisplayError extends Error {
  readonly missing: boolean;

  constructor(message: string, missing = false) {
    super(message);
    this.missing = missing;
  }
}

/** Use the app's bundled CLI when the optional Homebrew wrapper is unavailable. */
export function createBetterDisplayCommand(executable?: string, timeout = 10_000): Command {
  return async (args) => {
    let binary = executable ?? process.env.BETTERDISPLAY_CLI ?? Bun.which("betterdisplaycli");
    if (!binary) {
      for (const path of [
        "/Applications/BetterDisplay.app/Contents/MacOS/BetterDisplay",
        `${process.env.HOME}/Applications/BetterDisplay.app/Contents/MacOS/BetterDisplay`,
      ]) {
        if (await Bun.file(path).exists()) {
          binary = path;
          break;
        }
      }
    }
    if (!binary) throw new Error("Install and open BetterDisplay, then enable its CLI integration");
    const child = Bun.spawn([binary, ...args], { stdout: "pipe", stderr: "pipe", timeout });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) {
      const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join("; ");
      throw new BetterDisplayError(
        `BetterDisplay ${args[0]} failed${child.signalCode ? ` (terminated; timeout ${timeout}ms)` : ""}${detail ? `: ${detail}` : ""}`,
        code === 1 && detail === "Failed.",
      );
    }
    return stdout.trim();
  };
}

export function parseMonitorResolution(expression: string): string {
  const match = typeof expression === "string" && /^([1-9]\d*)x([1-9]\d*)$/.exec(expression.trim());
  if (!match) throw new TypeError("Expected an absolute monitor resolution such as 1440x1728");
  if (
    match.slice(1).some((value) => !Number.isSafeInteger(Number(value)) || Number(value) > 16384)
  ) {
    throw new RangeError("BetterDisplay resolution dimensions must not exceed 16384");
  }
  return `${Number(match[1])}x${Number(match[2])}`;
}

async function optional(command: Command, args: string[]): Promise<string | undefined> {
  try {
    return await command(args);
  } catch (error) {
    if (error instanceof BetterDisplayError && error.missing) return undefined;
    throw error;
  }
}

type VirtualScreen = { tagID: string; name: string; target: string };

async function managedScreens(command: Command): Promise<VirtualScreen[]> {
  const output = await optional(command, ["get", "--type=VirtualScreen", "--identifiers"]);
  if (!output) return [];
  // The CLI emits comma-separated JSON objects, without an enclosing array.
  const entries: unknown = JSON.parse(output.startsWith("[") ? output : `[${output}]`);
  if (!Array.isArray(entries)) throw new Error("Invalid BetterDisplay virtual-screen list");
  return entries.flatMap((entry) => {
    const target = typeof entry?.name === "string" && managedTarget(entry.name);
    return target && entry.deviceType === "VirtualScreen" && /^[1-9]\d*$/.test(entry.tagID)
      ? [{ tagID: entry.tagID, name: entry.name, target }]
      : [];
  });
}

async function pointerDisplay(command: Command): Promise<string> {
  const physical = await optional(command, [
    "get",
    "--type=Display",
    "--displayWithMouse",
    "--identifier=UUID",
  ]);
  if (physical && isUUID(physical, "loose")) return physical;
  const names = await command([
    "get",
    "--type=VirtualScreen",
    "--displayWithMouse",
    "--identifier=name",
  ]);
  // A mirrored source can be reported twice. Pin its physical UUID before any reconfiguration.
  const resolved = names.split(",").map(managedTarget);
  const targets = new Set(resolved);
  if (targets.size !== 1 || targets.has(undefined)) {
    throw new Error("Move the pointer to a physical display or a virtual screen created by /md");
  }
  return [...targets][0]!;
}

function singleValue(output: string): string {
  // The CLI can report both a virtual definition and its linked display.
  // Accept repeated identical values, but retain disagreements for validation.
  const values = output.split(",").map((value) => value.trim());
  return values.every((value) => value === values[0]) ? values[0] : output;
}

async function waitFor(
  command: Command,
  args: string[],
  expected: string | RegExp,
): Promise<string> {
  let actual: string | undefined;
  return pWaitFor(
    async () => {
      actual = await optional(command, args);
      if (actual !== undefined) actual = singleValue(actual);
      return actual !== undefined &&
        (typeof expected === "string" ? actual === expected : expected.test(actual))
        ? pWaitFor.resolveWith(actual)
        : false;
    },
    {
      interval: 100,
      timeout: {
        milliseconds: 5_000,
        fallback: () => {
          throw new Error(
            `BetterDisplay did not apply ${expected} (reported ${actual ?? "unavailable"})`,
          );
        },
      },
    },
  );
}

const screen = (tagID: string) => ["--type=VirtualScreen", `--tagID=${tagID}`];

async function selectVirtualResolution(
  command: Command,
  virtual: string[],
  resolution: string,
): Promise<void> {
  await waitFor(command, ["get", ...virtual, "--connected"], "on");
  // macOS can initially choose a pixel-doubled LoDPI mode instead of the
  // requested HiDPI desktop, particularly at smaller sizes such as 720x864.
  const initial = await waitFor(
    command,
    ["get", ...virtual, "--resolution"],
    /^[1-9]\d*x[1-9]\d*$/,
  );
  if (
    initial !== resolution ||
    singleValue(await command(["get", ...virtual, "--hiDPI"])) !== "on"
  ) {
    await command(["set", ...virtual, `--resolution=${resolution}`, "--hiDPI=on"]);
  }
  await waitFor(command, ["get", ...virtual, "--resolution"], resolution);
  await waitFor(command, ["get", ...virtual, "--hiDPI"], "on");
}

async function setResolution(command: Command, resolution: string): Promise<void> {
  const target = await pointerDisplay(command);
  const display = ["--type=Display", `--UUID=${target}`];
  const previous = (await managedScreens(command)).filter((entry) => entry.target === target);
  const current = await command(["get", ...display, "--resolution"]);
  if (resolution !== "reset" && current === resolution) return;

  const suspended: (VirtualScreen & { resolution: string })[] = [];
  let created: string | undefined;
  let nativeResolution: string | undefined;
  try {
    for (const entry of previous) {
      if (
        (await command(["get", ...screen(entry.tagID), "--mirror", `--targetUUID=${target}`])) ===
        "on"
      ) {
        suspended.push({
          ...entry,
          resolution: await command(["get", ...screen(entry.tagID), "--resolution"]),
        });
        await command(["set", ...screen(entry.tagID), "--connected=off"]);
        await waitFor(command, ["get", ...screen(entry.tagID), "--connected"], "off");
      }
    }
    if (resolution !== "reset") {
      nativeResolution = await command(["get", ...display, "--resolution"]);
      const modes = await command(["get", ...display, "--displayModeList"]);
      const available = modes
        .split("\n")
        .some((line) => line.match(/^\d+ - (\d+x\d+)\b/)?.[1] === resolution);
      if (available) {
        if (nativeResolution !== resolution)
          await command(["set", ...display, `--resolution=${resolution}`]);
      } else {
        if ((await command(["get", "--proAvailable"])) !== "on") {
          throw new Error("Custom resolutions require BetterDisplay Pro or its trial");
        }
        // Only definitions with our reserved name format are ever removed. A new screen
        // leaves the previous definition available for rollback until the switch succeeds.
        created = `Chord /md ${target} ${resolution} ${uuidv4()}`;
        const virtual = ["--type=VirtualScreen", `--name=${created}`];
        await command([
          "create",
          "--type=VirtualScreen",
          `--virtualScreenName=${created}`,
          "--useResolutionList=on",
          `--resolutionList=${resolution}`,
          "--virtualScreenHiDPI=on",
          "--connected=off",
        ]);
        await command(["set", ...virtual, "--connected=on"]);
        await selectVirtualResolution(command, virtual, resolution);
        await command(["set", ...virtual, "--mirror=on", `--targetUUID=${target}`]);
        await waitFor(command, ["get", ...virtual, "--mirror", `--targetUUID=${target}`], "on");
      }
      await waitFor(command, ["get", ...display, "--resolution"], resolution);
    }
  } catch (error) {
    const failures: unknown[] = [error];
    const restore = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (failure) {
        failures.push(failure);
      }
    };
    if (created)
      await restore(() =>
        optional(command, ["discard", "--type=VirtualScreen", `--name=${created}`]),
      );
    if (nativeResolution) {
      await restore(async () => {
        if ((await command(["get", ...display, "--resolution"])) !== nativeResolution) {
          await command(["set", ...display, `--resolution=${nativeResolution}`]);
        }
      });
    }
    for (const entry of suspended) {
      await restore(() => command(["set", ...screen(entry.tagID), "--connected=on"]));
      await restore(() => selectVirtualResolution(command, screen(entry.tagID), entry.resolution));
      await restore(() =>
        command(["set", ...screen(entry.tagID), "--mirror=on", `--targetUUID=${target}`]),
      );
      await restore(() =>
        waitFor(
          command,
          ["get", ...screen(entry.tagID), "--mirror", `--targetUUID=${target}`],
          "on",
        ),
      );
    }
    if (failures.length > 1) {
      throw new Error(
        `Could not change monitor resolution; rollback also failed: ${failures.map(String).join("; ")}`,
      );
    }
    throw error;
  }
  for (const entry of previous) {
    await command(["discard", ...screen(entry.tagID)]);
  }
}

/** Serialize changes so each command resolves the pointer after the previous switch settles. */
export function createMonitorHandler(command: Command) {
  let pending = Promise.resolve();
  return (expression: string): Promise<void> => {
    let resolution: string;
    try {
      resolution = expression === "0" ? "reset" : parseMonitorResolution(expression);
    } catch (error) {
      return Promise.reject(error);
    }
    const result = pending.then(() => setResolution(command, resolution));
    pending = result.catch(() => {});
    return result;
  };
}

export default function buildMonitorHandler() {
  return createMonitorHandler(createBetterDisplayCommand());
}
