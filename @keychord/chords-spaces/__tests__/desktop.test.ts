import { expect, test } from "bun:test";
import { selectWorkspace } from "../src/js/workspace";

const desktops = [
  "0  - DG: 1920x1080 VP: N/A WA: 0,0 1920x1080 First workspace",
  "1  * DG: 1920x1080 VP: 0,0 WA: 0,0 1920x1080 Second workspace",
  "2  - DG: 1920x1080 VP: N/A WA: 0,0 1920x1080 Third workspace",
].join("\n");

function fixture() {
  const commands: string[][] = [];
  const run = async (args: string[]) => {
    commands.push(args);
    if (args[0] === "-d") return desktops;
    if (args[0] === "-l") return "0x00a0000b 0 host Captured\n0x00a0000c -1 host Sticky\n";
    return "";
  };
  return { commands, run };
}

test("numbered and relative switches address existing X11 workspaces", async () => {
  const { commands, run } = fixture();
  await selectWorkspace("SWITCH", "1", null, run);
  await selectWorkspace("SWITCH", "NEXT", null, run);
  expect(commands).toEqual([["-d"], ["-s", "0"], ["-d"], ["-s", "2"]]);
});

test("moves target the captured window and use its workspace for relative movement", async () => {
  const { commands, run } = fixture();
  await selectWorkspace("MOVE", "NEXT", 0x00a0000b, run);
  await selectWorkspace("MOVE", "3", 0x00a0000b, run);
  expect(commands).toEqual([
    ["-d"],
    ["-l"],
    ["-i", "-r", "0xa0000b", "-t", "1"],
    ["-d"],
    ["-l"],
    ["-i", "-r", "0xa0000b", "-t", "2"],
  ]);
});

test("invalid targets, absent windows, and end-of-list moves leave workspaces unchanged", async () => {
  const { commands, run } = fixture();
  await expect(selectWorkspace("MOVE", "1", null, run)).rejects.toThrow("No window was focused");
  await expect(selectWorkspace("SWITCH", "4", null, run)).rejects.toThrow(
    "Workspace 4 does not exist",
  );
  await expect(selectWorkspace("MOVE", "NEXT", 0x00a0000c, run)).rejects.toThrow(
    "single workspace",
  );
  await selectWorkspace("MOVE", "PREVIOUS", 0x00a0000b, run);
  expect(commands).toEqual([["-d"], ["-d"], ["-l"], ["-d"], ["-l"]]);
});
