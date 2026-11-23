import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const safari = "com.apple.Safari";
const windowChords = ["wn", "wp", "wq", "wqa"];
const tabChords = [
  "tn",
  "tq",
  "tp",
  "td",
  "tw",
  "t]",
  "t[",
  "tl",
  "tr",
  ...Array.from({ length: 8 }, (_, index) => `t${index + 1}`),
];
const groupChords = ["tgn", "tgq", "tg]", "tg["];

test("every Safari binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Safari/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...windowChords, ...tabChords, ...groupChords, "js"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Safari chords navigate, create, and close actual tabs and windows",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await runCommand([
          "/usr/bin/defaults",
          "write",
          safari,
          "Command1Through9SwitchesTabs",
          "-bool",
          "true",
        ]);
        const files = await mkdtemp(join(tmpdir(), "chordtest-safari-"));
        const openPage = async (number: number) => {
          const file = join(files, `tab-${number}.html`);
          await Bun.write(
            file,
            `<!doctype html><title>Chordtest Tab ${number}</title><p>Test page</p>`,
          );
          await probe.activate(safari, file);
          await waitFor(async () => {
            const window = await probe.window(safari).catch(() => undefined);
            return window?.title?.includes(`Chordtest Tab ${number}`) ? true : undefined;
          }, 20_000);
        };
        const windowList = () => probe.windows(safari);
        const count = async () =>
          (await windowList()).filter((node) => node.subrole === "AXStandardWindow").length;
        const tabs = async () =>
          flattenAX([await probe.window(safari, 7)])
            .find(
              (node) =>
                (node.role === "AXTabGroup" || node.id?.startsWith("TabBar?")) &&
                node.children?.some((child) => child.role === "AXRadioButton"),
            )
            ?.children?.filter((node) => node.role === "AXRadioButton") ?? [];
        const selected = async () =>
          (await tabs()).findIndex(
            (node) => node.selected || node.value === true || node.value === 1,
          );
        const failures: unknown[] = [];
        const check = async (sequence: string, body: () => Promise<void>) => {
          try {
            await body();
          } catch (error) {
            console.error(`Safari ${sequence} failed`, error);
            failures.push(error);
          }
        };
        const invoke = async (sequence: string, predicate: () => Promise<boolean>) => {
          await waitFor(async () => ((await probe.front()) === safari ? true : undefined));
          await app.runChecked(sequence);
          try {
            await waitFor(async () => ((await predicate()) ? true : undefined), 12_000);
          } catch (error) {
            const state = await probe.windows(safari, 2).catch(() => []);
            throw new Error(
              `Safari chord ${sequence} did not change app state. Tabs ${JSON.stringify((await tabs().catch(() => [])).map((tab) => [tab.title, tab.selected, tab.value]))}. Windows ${JSON.stringify(state).slice(0, 2000)}`,
              { cause: error },
            );
          }
          console.log(`Safari ${sequence} passed`);
        };
        try {
          await openPage(1);
          await app.flush();
          const original = await count();
          await invoke("wn", async () => (await count()) === original + 1);
          await invoke("wp", async () => (await count()) === original + 2);
          expect(JSON.stringify(await probe.windows(safari, 4))).toMatch(/Private/i);
          await invoke("wq", async () => (await count()) === original + 1);
          // Verify the New Tab chord first, then seed distinct pages to test reordering.
          await invoke("tn", async () => (await tabs()).length === 2);
          await probe.key(13, 1 << 20); // Command–W closes the empty setup tab.
          await waitFor(async () => ((await tabs()).length < 2 ? true : undefined));
          await openPage(1);
          for (let number = 2; number <= 8; number++) {
            await openPage(number);
          }
          expect((await tabs()).length).toBeGreaterThanOrEqual(8);
          for (let index = 0; index < 8; index++) {
            await invoke(`t${index + 1}`, async () => (await selected()) === index);
          }
          await invoke("t[", async () => (await selected()) === 6);
          await invoke("t]", async () => (await selected()) === 7);
          const beforeClose = (await tabs()).length;
          await check("tq", () =>
            invoke("tq", async () => (await tabs()).length === beforeClose - 1),
          );
          const beforeDuplicate = (await tabs()).length;
          await check("td", () =>
            invoke("td", async () => (await tabs()).length === beforeDuplicate + 1),
          );
          const ownedTabs = await tabs();
          const startIndex = ownedTabs.findIndex(
            (tab, index) =>
              index > 0 &&
              index < 8 &&
              index < ownedTabs.length - 1 &&
              tab.title?.startsWith("Chordtest Tab ") &&
              ownedTabs.filter((candidate) => candidate.title === tab.title).length === 1,
          );
          expect(startIndex).toBeGreaterThan(0);
          await app.runChecked(`t${startIndex + 1}`);
          await waitFor(async () => ((await selected()) === startIndex ? true : undefined));
          const movedTitle = ownedTabs[startIndex].title;
          expect(movedTitle).toBeDefined();
          expect((await tabs()).filter((tab) => tab.title === movedTitle)).toHaveLength(1);
          const eighth = async (at: number) =>
            (await selected()) === at && (await tabs())[at]?.title === movedTitle;
          await check("tl", () => invoke("tl", () => eighth(startIndex - 1)));
          const beforeRight = await selected();
          const rightTitle = (await tabs())[beforeRight]?.title;
          await check("tr", () =>
            invoke(
              "tr",
              async () =>
                (await selected()) === beforeRight + 1 &&
                (await tabs())[beforeRight + 1]?.title === rightTitle,
            ),
          );
          const main = (await probe.window(safari)).id;
          const beforeMove = await count();
          await check("tw", () => invoke("tw", async () => (await count()) === beforeMove + 1));
          await check("tp", async () => {
            if (main && (await probe.window(safari)).id !== main) {
              await probe.raiseWindow(safari, main);
              await waitFor(async () =>
                (await probe.window(safari)).id === main ? true : undefined,
              );
            }
            const menuItem = () => probe.menu(safari, "Window", "Pin Tab").catch(() => undefined);
            await waitFor(async () => ((await menuItem())?.enabled ? true : undefined));
            await invoke(
              "tp",
              async () =>
                (await probe.menu(safari, "Window", "Unpin Tab").catch(() => undefined))
                  ?.enabled === true,
            );
          });
          await check("wqa", () => invoke("wqa", async () => (await count()) === 0));
          if (failures.length) throw new AggregateError(failures, "Safari binding failures");
        } finally {
          await rm(files, { recursive: true, force: true });
        }
      }),
    );
  },
  180_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "Safari tab group chords create, select and close groups",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(safari, "about:blank");
        await waitFor(async () => ((await probe.windows(safari)).length ? true : undefined));
        const groupNames = async () =>
          flattenAX([await probe.window(safari, 8)])
            .filter(
              (node) => node.id === "LibraryItemCellTextField" && typeof node.value === "string",
            )
            .map((node) => node.value as string);
        const selected = (name: string) => async () =>
          (await probe.window(safari).catch(() => undefined))?.title?.startsWith(`${name} —`)
            ? true
            : undefined;
        const names: string[] = [];
        for (let number = 1; number <= 2; number++) {
          const previousNames = new Set(await groupNames());
          await waitFor(async () => ((await probe.front()) === safari ? true : undefined));
          await app.runChecked("tgn");
          const name = await waitFor(
            async () =>
              (await groupNames()).find(
                (label) => label.startsWith("Untitled") && !previousNames.has(label),
              ),
            12_000,
          );
          await probe.key(36);
          await waitFor(selected(name));
          names.push(name);
          console.log(`Safari tgn created ${name}`);
        }
        const ordered = (await groupNames()).filter((name) => names.includes(name));
        expect(ordered).toHaveLength(2);
        const forward = ordered[0] === names[1] ? "tg]" : "tg[";
        const backward = forward === "tg]" ? "tg[" : "tg]";
        await app.runChecked(forward);
        await waitFor(selected(names[0]), 12_000);
        console.log(`Safari ${forward} selected ${names[0]}`);
        await app.runChecked(backward);
        await waitFor(selected(names[1]), 12_000);
        console.log(`Safari ${backward} selected ${names[1]}`);
        await app.runChecked("tgq");
        await waitFor(async () => {
          const dialog = flattenAX(await probe.windows(safari, 3)).some(
            (node) => node.role === "AXButton" && node.title === "Delete",
          );
          if (dialog) await probe.pressControl(safari, "AXButton", "Delete");
          const current = await groupNames();
          return current.includes(names[0]) && !current.includes(names[1]) ? true : undefined;
        }, 12_000);
        console.log("Safari tgq deleted the active test group");
      }),
    );
  },
  110_000,
);
