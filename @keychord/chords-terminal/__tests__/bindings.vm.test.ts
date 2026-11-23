import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const terminal = "com.apple.Terminal";
const tabs = Array.from({ length: 9 }, (_, index) => `t${index + 1}`);

test("all bindings imported by Apple Terminal have a tab case", async () => {
  const parse = async (path: string) =>
    Bun.TOML.parse(await Bun.file(new URL(`../chords/${path}`, import.meta.url)).text()) as {
      chords: Record<string, unknown>;
      import?: { file: string }[];
    };
  const app = await parse("com/apple/Terminal/macos.toml");
  const sources = [app, ...(await Promise.all((app.import ?? []).map(({ file }) => parse(file))))];
  expect(
    sources
      .flatMap((source) => Object.keys(source.chords))
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(tabs);
});

test.skipIf(!macOSUITestsEnabled)(
  "all nine Terminal chords select their numbered tabs",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await runCommand([
          "/usr/bin/defaults",
          "write",
          terminal,
          "Command1Through9SwitchesTabs",
          "-bool",
          "true",
        ]);
        await probe.activate(terminal);
        const window = () => probe.window(terminal, 6).catch(() => undefined);
        if (!(await window())?.role) await probe.key(45, 1 << 20); // Command–N opens a shell.
        await waitFor(async () => ((await window())?.children?.length ? true : undefined), 15_000);
        const tabButtons = async () =>
          flattenAX([(await window()) ?? {}]).filter((node) => node.subrole === "AXTabButton");
        const count = async () => Math.max(1, (await tabButtons()).length);
        const newTab = await waitFor(async () => {
          const menu = await probe.menu(terminal, "Shell", "New Tab").catch(() => undefined);
          return (
            menu &&
            flattenAX([menu]).find(
              (node) => node.key === "T" && node.keyModifiers === 0 && node.enabled,
            )?.title
          );
        }, 10_000);
        while ((await count()) < tabs.length) {
          const total = (await count()) + 1;
          await probe.press(terminal, "Shell", "New Tab", newTab);
          try {
            await waitFor(async () => ((await count()) === total ? true : undefined), 10_000);
          } catch (error) {
            throw new Error(
              `Could not prepare Terminal tab ${total}: ${JSON.stringify(await probe.window(terminal, 5)).slice(0, 4000)}`,
              { cause: error },
            );
          }
        }
        for (const [index, sequence] of tabs.entries()) {
          const selected = async () =>
            (await tabButtons()).findIndex(
              (node) => node.selected || node.value === true || node.value === 1,
            );
          expect(await selected(), sequence).not.toBe(index);
          await app.run(sequence);
          await app.flush();
          try {
            await waitFor(async () => ((await selected()) === index ? true : undefined));
          } catch (error) {
            throw new Error(`${sequence} did not select Terminal tab ${index + 1}`, {
              cause: error,
            });
          }
        }
      }),
    );
  },
  120_000,
);
