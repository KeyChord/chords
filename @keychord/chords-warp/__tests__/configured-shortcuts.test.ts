import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tap, type BuilderThis } from "chord";
import { mocked } from "@keychord/chordtest/test";
import buildWarpHandler from "../src/js/warp";

let directory: string;
let overrides: string;

beforeEach(async () => {
  mocked(tap).mockImplementation(() => {});
  directory = await mkdtemp(join(tmpdir(), "chords-warp-"));
  overrides = join(directory, "keybindings.yaml");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test("uses the packaged Warp default when there is no custom keybindings file", async () => {
  const bindings = Bun.TOML.parse(
    await Bun.file(new URL("../chords/dev/warp/Warp-Stable/desktop.toml", import.meta.url)).text(),
  ) as {
    on: { command: { args: ["configured"] } };
    chords: { tn: { "@input:command": [string, string] } };
  };
  const command = await buildWarpHandler.call(
    {} as BuilderThis,
    ...bindings.on.command.args,
    overrides,
  );
  expect(await command(...bindings.chords.tn["@input:command"])).toBe(true);
  expect(mocked(tap).mock.calls).toEqual([["ctrl+shift+t"]]);
  expect(await Bun.file(overrides).exists()).toBe(false);

  await Bun.write(overrides, "---\n# No overrides\n");
  expect(await command(...bindings.chords.tn["@input:command"])).toBe(true);
  expect(tap).toHaveBeenCalledTimes(2);
});

test("reads edits to Warp's shortcuts and sends one or more keystrokes", async () => {
  const command = await buildWarpHandler.call({} as BuilderThis, "configured", overrides);
  await Bun.write(overrides, '"workspace:decrease_font_size": ctrl--\n');
  await command("workspace:decrease_font_size", "ctrl+-");
  expect(tap).toHaveBeenCalledWith("ctrl+-");

  const edits = '"workspace:decrease_font_size": alt-shift-? ctrl-shift-F\n';
  await Bun.write(overrides, edits);
  await command("workspace:decrease_font_size", "ctrl+-");
  expect(tap).toHaveBeenLastCalledWith("alt+shift+/ ctrl+shift+f");
  expect(await Bun.file(overrides).text()).toBe(edits);
});

test("runs a native Warp action with no default after the user assigns it a shortcut", async () => {
  const command = await buildWarpHandler.call({} as BuilderThis, "configured", overrides);
  await expect(command("pane_group:resize_left")).rejects.toThrow("Assign a keyboard shortcut");
  expect(tap).not.toHaveBeenCalled();

  await Bun.write(overrides, '"pane_group:resize_left": ctrl-alt-left\n');
  await command("pane_group:resize_left");
  expect(mocked(tap).mock.calls).toEqual([["ctrl+alt+left"]]);
});

test("honors removed shortcuts and rejects invalid values without sending input", async () => {
  const command = await buildWarpHandler.call({} as BuilderThis, "configured", overrides);
  await Bun.write(
    overrides,
    '"workspace:new_tab": none\n"workspace:move_tab_left": [ctrl, left]\n',
  );
  await expect(command("workspace:new_tab", "ctrl+shift+t")).rejects.toThrow(
    "Assign a keyboard shortcut",
  );
  await expect(command("workspace:move_tab_left", "ctrl+shift+left")).rejects.toThrow(
    "Invalid Warp keybinding",
  );
  expect(tap).not.toHaveBeenCalled();
});
