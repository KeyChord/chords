import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  requireMacOSVM,
  runCommand,
  waitFor,
  type AXNode,
  type MacOSProbe,
} from "@keychord/chordtest";

const obs = "com.obsproject.obs-studio";
const settings = "com.apple.systempreferences";
const notifications = "com.apple.UserNotificationCenter";
const securityAgent = "com.apple.SecurityAgent";
const extension = "com.obsproject.obs-studio.mac-camera-extension";
export const cameraName = "OBS Virtual Camera";
const application = "/Applications/OBS.app";
const imageURL =
  "https://github.com/obsproject/obs-studio/releases/download/33.0.3/OBS-Studio-33.0.3-macOS-Apple.dmg";
const imageDigest = "92212873b6f84c54285203cac3f846590ac00dfad76b312cf266100ff5edf0c8";

function label(node: AXNode) {
  return [node.title, node.description, node.value].filter((value) => typeof value === "string");
}

async function nodes(probe: MacOSProbe, bundle: string) {
  return flattenAX(await probe.windows(bundle, 12).catch(() => []));
}

async function click(probe: MacOSProbe, node?: AXNode) {
  if (!node?.position || !node.size?.every((length) => length > 0)) return false;
  const [x, y] = node.position;
  const [width, height] = node.size;
  await probe.clickPoint(x + width / 2, y + height / 2);
  return true;
}

async function pressOBS(probe: MacOSProbe, name: string, id?: string) {
  const button = (await nodes(probe, obs)).find(
    (node) =>
      node.role === "AXButton" &&
      node.enabled &&
      label(node).includes(name) &&
      (!id || node.id === id),
  );
  if (!button) return false;
  if ((await probe.front()) !== obs) await probe.activate(obs);
  return click(probe, button);
}

async function obsWelcome(probe: MacOSProbe) {
  if (await pressOBS(probe, "Continue", "OBSApp.OBSPermissions.continueButton")) return true;
  if (
    (await probe.windows(obs).catch(() => [])).some(
      (window) => window.title === "Auto-Configuration Wizard",
    )
  )
    return pressOBS(probe, "Cancel");
  return false;
}

async function dismissBlankOutputWarning(probe: MacOSProbe) {
  const warning = (await nodes(probe, obs)).some((node) =>
    label(node).some((text) => /you will only be outputting a blank screen/i.test(String(text))),
  );
  return warning && (await pressOBS(probe, "Yes"));
}

async function extensionStatus() {
  const { stdout } = await runCommand(["/usr/bin/systemextensionsctl", "list"]);
  return stdout.split("\n").find((line) => line.includes(extension));
}

async function installCamera() {
  const scratch = await mkdtemp(join(tmpdir(), "chordtest-camera-"));
  const image = join(scratch, "obs.dmg");
  const mount = join(scratch, "image");
  let attached = false;
  try {
    const response = await fetch(imageURL, { signal: AbortSignal.timeout(40_000) });
    if (!response.ok) throw new Error("OBS image download returned " + response.status);
    await Bun.write(image, response);
    const hash = new Bun.CryptoHasher("sha256");
    for await (const chunk of Bun.file(image).stream()) hash.update(chunk);
    if (hash.digest("hex") !== imageDigest) throw new Error("OBS image digest mismatch");
    await mkdir(mount);
    await runCommand([
      "/usr/bin/hdiutil",
      "attach",
      "-readonly",
      "-nobrowse",
      "-mountpoint",
      mount,
      image,
    ]);
    attached = true;
    const source = join(mount, "OBS.app");
    await runCommand(["/usr/bin/codesign", "--verify", "--strict", source]);
    await runCommand(["/usr/bin/ditto", source, application]);
  } finally {
    try {
      if (attached) await runCommand(["/usr/bin/hdiutil", "detach", mount]);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }
}

async function openOBS(startCamera = false) {
  await runCommand([
    "/usr/bin/open",
    application,
    "--args",
    "--only-bundled-plugins",
    "--disable-updater",
    ...(startCamera ? ["--startvirtualcam"] : []),
  ]);
}

async function approveCamera(probe: MacOSProbe) {
  const openSettings = () =>
    runCommand([
      "/usr/bin/open",
      "x-apple.systempreferences:com.apple.LoginItems-Settings.extension",
    ]);
  const notice = (await nodes(probe, notifications)).some((node) =>
    label(node).some((text) => /OBS.*would like to use a new camera extension/i.test(String(text))),
  );
  if (notice) {
    await probe.pressControl(notifications, "AXButton", "Open System Settings").catch(openSettings);
  } else {
    await openSettings();
  }

  const sheetIsOpen = (items: AXNode[]) =>
    items.some(
      (node) =>
        node.role === "AXStaticText" &&
        String(node.value ?? "").startsWith("Camera extensions allow you to connect and control"),
    );
  const loginItems = await waitFor(
    async () =>
      (await probe.windows(settings).catch(() => [])).find(
        (window) =>
          /^Login Items(?: & Extensions)?$/.test(window.title ?? "") &&
          window.position &&
          window.size,
      ),
    20_000,
  );
  const [left, top] = loginItems.position!;
  const [width, height] = loginItems.size!;
  if ((await probe.front()) !== settings) await probe.activate(settings);
  await waitFor(async () => {
    const items = await nodes(probe, settings);
    if (sheetIsOpen(items)) return true;
    const row = items.find(
      (node) =>
        node.role === "AXStaticText" &&
        node.value === "Camera Extensions" &&
        node.position &&
        node.size?.every((length) => length > 0) &&
        node.position[1] > top &&
        node.position[1] < top + height - 12,
    );
    if ((await probe.front()) !== settings) return;
    const details =
      row?.position && row.size
        ? items.filter(
            (node) =>
              node.role === "AXButton" &&
              node.description === "Show Detail" &&
              node.enabled &&
              node.position &&
              node.size?.every((length) => length > 0) &&
              node.position[0] > row.position![0] &&
              Math.abs(node.position[1] + node.size[1] / 2 - row.position![1] - row.size![1] / 2) <
                21,
          )
        : [];
    if (details.length === 1) {
      await click(probe, details[0]);
    } else {
      await probe.scrollAt(left + width * 0.65, top + height - 65, -8);
    }
    await Bun.sleep(500);
  }, 12_000);
  const switches = (await nodes(probe, settings))
    .filter((node) => node.role === "AXGroup" && node.size)
    .flatMap((group) => {
      const controls = flattenAX(group.children ?? []);
      if (
        !controls.some((node) => node.role === "AXStaticText" && node.value === "OBS") ||
        !controls.some((node) => node.role === "AXStaticText" && node.value === cameraName)
      )
        return [];
      const toggles = controls.filter(
        (node) =>
          ["AXCheckBox", "AXSwitch"].includes(node.role ?? "") &&
          node.enabled &&
          node.position &&
          node.size,
      );
      return toggles.length === 1 ? [{ toggle: toggles[0]!, height: group.size![1] }] : [];
    })
    .sort((left, right) => left.height - right.height);
  const toggle = switches[0]?.toggle;
  if (!toggle || (await probe.front()) !== settings)
    throw new Error("OBS camera switch unavailable");
  if (toggle.value === 0 || toggle.value === false) await click(probe, toggle);
  if ((await extensionStatus())?.includes("[activated enabled]")) return;

  const guestUser = (await runCommand(["/usr/bin/id", "-un"])).stdout.trim();
  if (guestUser !== "admin") throw new Error("Expected the disposable Tart test user");
  const dialog = await waitFor(async () => {
    if ((await probe.front()) !== securityAgent) return;
    const items = await nodes(probe, securityAgent);
    if (
      items.some(
        (node) =>
          node.role === "AXStaticText" &&
          String(node.value ?? "").includes(
            "System Extensions is trying to modify a System Extension.",
          ),
      )
    )
      return items;
  }, 10_000);
  const password = dialog.find((node) => node.subrole === "AXSecureTextField");
  const username = dialog.find(
    (node) => node.role === "AXTextField" && node.subrole !== "AXSecureTextField",
  );
  if (!username || !password) throw new Error("Camera approval requires both guest login fields");

  for (let attempt = 0; attempt < 3 && (await probe.front()) === securityAgent; attempt++) {
    for (const field of [username, password]) {
      if (!(await click(probe, field))) throw new Error("Guest login field is unavailable");
      await Bun.sleep(180);
      await probe.key(0, 1 << 20);
      await Bun.sleep(150);
      // Enter the documented public test account with paced native key events.
      await probe.keySequence([0, 2, 46, 34, 45]);
    }
    const supplied = await nodes(probe, securityAgent);
    const nameEntered = supplied.some(
      (node) => node.role === "AXTextField" && node.value === guestUser,
    );
    const secure = supplied.find((node) => node.subrole === "AXSecureTextField");
    if (nameEntered && typeof secure?.value === "string" && secure.value.length === 5) {
      await probe.key(36);
      if (
        await waitFor(
          async () => (await extensionStatus())?.includes("[activated enabled]") || undefined,
          3_000,
        ).catch(() => undefined)
      )
        return;
    }
  }
  throw new Error("macOS did not enable the signed OBS camera extension");
}

export async function startCamera(probe: MacOSProbe) {
  requireMacOSVM();
  await installCamera();
  await openOBS(true);
  let requested = false;
  await waitFor(async () => {
    if (await extensionStatus()) return true;
    if ((await obsWelcome(probe)) || (await dismissBlankOutputWarning(probe))) {
      await Bun.sleep(500);
      return;
    }
    if (!requested) requested = await pressOBS(probe, "Start Virtual Camera");
    await Bun.sleep(300);
  }, 25_000);
  await approveCamera(probe);

  await probe.activate(obs);
  if (
    (await nodes(probe, obs)).some((node) =>
      label(node).some((text) =>
        /could not find the virtual camera system process|virtual camera is not installed/i.test(
          String(text),
        ),
      ),
    )
  )
    await pressOBS(probe, "OK");
  if ((await probe.front()) !== obs) throw new Error("OBS could not regain focus");
  await probe.key(12, 1 << 20);
  const stopped = async () => !(await probe.running(obs)) || undefined;
  if (!(await waitFor(stopped, 8_000).catch(() => undefined))) {
    const result = Bun.spawnSync(
      ["/usr/bin/pkill", "-TERM", "-f", "^/Applications/OBS[.]app/Contents/MacOS/OBS( |$)"],
      { stdout: "ignore", stderr: "pipe", timeout: 5_000 },
    );
    if (result.exitCode !== 0 && (await probe.running(obs))) {
      throw new Error("The disposable OBS fixture did not stop: " + result.stderr.toString());
    }
    await waitFor(stopped, 10_000);
  }

  const logs = join(homedir(), "Library", "Application Support", "obs-studio", "logs");
  const earlierLogs = new Set(await readdir(logs).catch(() => []));
  await openOBS();
  let started = false;
  await waitFor(async () => {
    if (
      (await nodes(probe, obs)).some((node) => node.title === "Stop Virtual Camera" && node.enabled)
    )
      return true;
    if ((await obsWelcome(probe)) || (await dismissBlankOutputWarning(probe))) {
      await Bun.sleep(500);
      return;
    }
    const log = (await readdir(logs).catch(() => [])).find(
      (name) => name.endsWith(".txt") && !earlierLogs.has(name),
    );
    if (
      log &&
      !started &&
      (await Bun.file(join(logs, log)).text()).includes(
        "macOS Camera Extension activated successfully.",
      )
    )
      started = await pressOBS(probe, "Start Virtual Camera");
    await Bun.sleep(300);
  }, 28_000);
}
