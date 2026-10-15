import assert from "node:assert/strict";
import { createBetterDisplayCommand, createMonitorHandler } from "../src/js/monitor";

// This check temporarily changes the real desktop. It needs a running, licensed
// BetterDisplay and must be invoked explicitly, outside the ordinary unit suite.
if (process.env.CHORD_BETTERDISPLAY_LIVE_TEST !== "1") {
  throw new Error("Run with CHORD_BETTERDISPLAY_LIVE_TEST=1 to test the real display");
}
const { default: buildMonitorHandler } = await import(
  new URL("../js/monitor.js", import.meta.url).href
);
const command = createBetterDisplayCommand();
const target = await command(["get", "--type=Display", "--displayWithMouse", "--identifier=UUID"]);
assert.match(target, /^[0-9A-Fa-f-]{36}$/);
const display = ["--type=Display", `--UUID=${target}`];
const initial = await command(["get", ...display, "--resolution"]);
const resolution = () => command(["get", ...display, "--resolution"]);
try {
  for (const size of ["1440x1728", "720x864", "1600x1000"]) {
    // New factories exercise recognition of a managed source after package reload.
    await buildMonitorHandler()(size);
    assert.equal(await resolution(), size);
    console.log(`Applied ${size}`);
  }
  await assert.rejects(buildMonitorHandler()("1440x0"), TypeError);
  assert.equal(await resolution(), "1600x1000");
  await buildMonitorHandler()("0");
  assert.equal(await resolution(), initial);
  await buildMonitorHandler()("720x864");
  const failure = createMonitorHandler((args) => {
    if (
      args[0] === "set" &&
      args.includes("--mirror=on") &&
      args.some((arg) => arg.startsWith("--name="))
    ) {
      return Promise.reject(new Error("Simulated mirror failure"));
    }
    return command(args);
  });
  await assert.rejects(failure("1600x1000"), /Simulated mirror failure/);
  assert.equal(await resolution(), "720x864");
  await buildMonitorHandler()(initial);
  assert.equal(await resolution(), initial);
  console.log(
    "betterdisplay-macos-ok: custom sizes, reload, validation, reset, rollback, and native restoration",
  );
} finally {
  // Pin the original display even if a failed switch moved the pointer elsewhere.
  const cleanup = createMonitorHandler((args) =>
    args.includes("--displayWithMouse") && args.includes("--type=Display")
      ? Promise.resolve(target)
      : command(args),
  );
  try {
    await cleanup("0");
  } finally {
    if ((await resolution()) !== initial)
      await command(["set", ...display, `--resolution=${initial}`]);
  }
  assert.equal(await resolution(), initial);
}
