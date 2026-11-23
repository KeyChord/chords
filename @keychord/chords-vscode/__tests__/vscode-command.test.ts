import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { tap } from "chord";
import { mocked } from "@keychord/chordtest/test";
import buildAction from "../src/js/vscode-command.ts";

const originalTmpDir = process.env.TMPDIR;
let tmp: string;
let server: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "chords-vscode-test-"));
  process.env.TMPDIR = tmp;
  const { uid } = userInfo();
  const suffix = uid < 0 ? "" : `-${uid}`;
  server = join(tmp, `vscode-command-server${suffix}`);
});

afterEach(async () => {
  if (originalTmpDir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = originalTmpDir;
  await rm(tmp, { recursive: true, force: true });
});

test("writes the command before sending its shortcut and waits for acknowledgment", async () => {
  await mkdir(server);
  const request = Bun.file(join(server, "request.json"));
  const response = Bun.file(join(server, "response.json"));
  await Bun.write(response, '{"uuid":"old","error":"stale"}\n');
  mocked(tap).mockImplementation(async (shortcut) => {
    expect(shortcut).toBe("ctrl+shift+alt+p");
    expect(await response.exists()).toBe(false);
    const sent = await request.json();
    expect(sent).toMatchObject({
      commandId: "workbench.action.reloadWindow",
      args: [],
      waitForFinish: false,
      returnCommandOutput: false,
    });
    await Bun.write(response, JSON.stringify({ uuid: sent.uuid, error: null }) + "\n");
  });

  await buildAction()("workbench.action.reloadWindow");
  expect(tap).toHaveBeenCalledTimes(1);
});

test("surfaces command errors from the extension", async () => {
  await mkdir(server);
  mocked(tap).mockImplementation(async () => {
    const { uuid } = await Bun.file(join(server, "request.json")).json();
    await Bun.write(
      join(server, "response.json"),
      JSON.stringify({ uuid, error: "Command refused" }) + "\n",
    );
  });

  await expect(buildAction()("workbench.action.reloadWindow")).rejects.toThrow("Command refused");
});

test("reports a missing extension before sending any keys", async () => {
  await expect(buildAction()("workbench.action.reloadWindow")).rejects.toThrow(
    "Enable the Command Server extension",
  );
  expect(tap).not.toHaveBeenCalled();
});
