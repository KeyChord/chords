import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { waitFor } from "@keychord/chordtest/macos";
import buildApplicationHandler from "../js/application.js";

requireMacOSVM();
const [firstId, firstOutput, hiddenId, hiddenOutput, currentId, currentOutput, helperId] =
  process.argv.slice(2);
type State = { frontmostAppId: string; hidden: boolean; visible: boolean; keyEvents: number };
const state = (path = currentOutput): Promise<State> => Bun.file(path).json();
let phase = "activate current app";
async function observed<T>(read: () => Promise<T | undefined> | T | undefined) {
  try {
    return await waitFor(read);
  } catch (cause) {
    throw new Error(
      `${phase}: ${JSON.stringify(await Promise.all([firstOutput, hiddenOutput, currentOutput].map(state)))}`,
      { cause },
    );
  }
}
await Bun.write(currentOutput + ".command", "activate");
await observed(async () =>
  !(await Bun.file(currentOutput + ".command").exists()) &&
  (await state()).frontmostAppId === currentId
    ? true
    : undefined,
);
await Bun.write(hiddenOutput + ".command", "hide");
phase = "hide app";
await observed(async () => ((await state(hiddenOutput)).hidden ? true : undefined));
await Bun.write(firstOutput + ".command", "close");
phase = "close app window";
await observed(async () => (!(await state(firstOutput)).visible ? true : undefined));
const handler = buildApplicationHandler();
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as any;
async function step(input: "/dw[" | "/dw]", captured = true) {
  const before = (await state()).frontmostAppId;
  phase = `${input} from ${before}`;
  await handler.call(
    captured ? { focusedAppId: before } : undefined,
    definition.chords[input]["@input:application"][0],
  );
  const result = await observed(async () => {
    const current = await state();
    return current.frontmostAppId !== before ? current : undefined;
  });
  assert.notEqual(result.frontmostAppId, helperId);
  console.log(`${input}: ${before} -> ${result.frontmostAppId}`);
  return result.frontmostAppId;
}
const forward = [currentId];
for (let count = 0; count < 30; count++) {
  const next = await step("/dw]", count !== 0);
  if (next === currentId) break;
  assert.ok(!forward.includes(next), `App ${next} repeated before completing the cycle`);
  forward.push(next);
}
assert.equal((await state()).frontmostAppId, currentId, "Cycle must wrap around");
assert.ok(forward.includes(firstId), "An app without windows remains switchable");
assert.ok(forward.includes(hiddenId), "Hidden apps remain switchable");
assert.equal((await state(hiddenOutput)).hidden, false);
for (const expected of forward.slice(1).reverse().concat(currentId)) {
  assert.equal(await step("/dw["), expected);
}
// An ordinary activation starts a new cycle with that app at the front.
await Bun.write(currentOutput + ".command", "activate:" + firstId);
phase = "manually activate windowless app";
await observed(async () => ((await state()).frontmostAppId === firstId ? true : undefined));
assert.equal(await step("/dw]"), currentId);
assert.equal(await step("/dw["), firstId);
await assert.rejects(
  handler.call({ focusedAppId: "dev.keychord.nonexistent" }, "NEXT"),
  /not running/,
);
await step("/dw]");
const hiddenPID = Number(await Bun.file(hiddenOutput + ".pid").text());
await Bun.write(hiddenOutput + ".command", "quit");
phase = "wait for app exit";
await observed(() => {
  try {
    process.kill(hiddenPID, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return true;
    throw error;
  }
  return undefined;
});
const afterExit = (await state()).frontmostAppId;
for (let count = 0; count < 30; count++) {
  const next = await step("/dw]");
  assert.notEqual(next, hiddenId);
  if (next === afterExit) break;
}
assert.equal((await state()).frontmostAppId, afterExit);
for (const output of [firstOutput, hiddenOutput, currentOutput])
  assert.equal((await state(output)).keyEvents, 0);
console.log(
  "application-cycle-ok: three apps, both directions, wraparound, hidden and windowless apps, accessory exclusion, activation history, exited apps, recovery, no key events",
);
