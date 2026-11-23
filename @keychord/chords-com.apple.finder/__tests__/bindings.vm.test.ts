import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
} from "@keychord/chordtest";

const finder = "com.apple.finder";
const locations = {
  gr: /Recents/i,
  gd: /Downloads/i,
  gdo: /Documents/i,
  gde: /Desktop/i,
  gh: new RegExp(`^${homedir().split("/").at(-1)}$`, "i"),
  gc: /Mac|Computer/i,
  gad: /AirDrop/i,
  gn: /Network/i,
  gid: /iCloud Drive|iCloud|Apple Account/i,
  gs: /Shared/i,
  ga: /Applications/i,
  gu: /Utilities/i,
  gt: /Trash/i,
};
const views = { ai: "as Icons", al: "as List", ac: "as Columns", ag: "as Gallery" };
const sorting = {
  sn: "Name",
  sk: "Kind",
  so: "Date Last Opened",
  sa: "Date Added",
  sm: "Date Modified",
  sc: "Date Created",
  ss: "Size",
  st: "Tags",
};
const cleanup = {
  cn: "Name",
  ck: "Kind",
  cm: "Date Modified",
  cc: "Date Created",
  cs: "Size",
  ct: "Tags",
};
const toggles: Record<string, RegExp> = {
  tg: /^(Use Groups|(?:Show|Hide) Groups)$/,
  tt: /Tab Bar/,
  ts: /Sidebar/,
  tp: /Preview$/,
  tb: /Status Bar/,
  to: /Toolbar$/,
  "t/": /Path Bar/,
};
const cases = [
  ...Object.keys(locations),
  ...Object.keys(views),
  ...Object.keys(sorting),
  ...Object.keys(cleanup),
  ...Object.keys(toggles),
  "gf",
  "du",
  "duw",
  "fa",
  "fe",
  "fc",
  "fr",
  "ft",
  "fd",
  "fq",
  "fo",
  "ta",
  "th",
  "te",
  "tef",
];

test("every Finder binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/finder/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...cases].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Finder chords change Finder's actual UI and files",
  async () => {
    await runCommand(["/usr/bin/defaults", "write", finder, "FinderSpawnTab", "-bool", "false"]);
    await runCommand(["/usr/bin/killall", "Finder"]);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const directory = await mkdtemp(join(tmpdir(), "chordtest-finder-"));
        const child = join(directory, "Child");
        const name = "Chordtest item.txt";
        const file = join(directory, name);
        const found: Error[] = [];
        const folderTitle = directory.split("/").at(-1);
        const windows = (depth = 0) => probe.windows(finder, depth);
        const items = async (depth = 7) =>
          flattenAX(
            await probe.window(finder, depth).then(
              (window) => [window],
              () => [],
            ),
          );
        const menuItem = (...path: string[]) =>
          waitFor(() => probe.menu(finder, ...path).catch(() => undefined), 9_000);
        const menu = async (title: string) => flattenAX([await menuItem(title)]);
        const open = (path: string, reveal = false) =>
          probe.activate(finder, ...(reveal ? ["-R", path] : [path]));
        const focusFolder = async () => {
          await open(directory);
          await shown(new RegExp(`^${folderTitle}$`));
        };
        const selectedFile = async () => {
          await Bun.write(file, "Finder chord test\n");
          await open(file, true);
          await waitFor(async () => {
            const window = await probe.window(finder);
            const rename = await menuItem("File", "Rename");
            return window.title === folderTitle && rename.enabled ? true : undefined;
          });
        };
        const shown = (pattern: RegExp) =>
          waitFor(async () => {
            const window = await probe.window(finder, 1).catch(() => undefined);
            return window &&
              (pattern.test(window.title ?? "") ||
                pattern.test(window.url ?? "") ||
                window.children?.some(
                  (child) => child.role === "AXSheet" && pattern.test(child.title ?? ""),
                ))
              ? true
              : undefined;
          }, 9_000);
        const check = async (sequence: string, action: () => Promise<unknown>) => {
          try {
            await action();
            console.log(`Finder ${sequence} passed`);
          } catch (error) {
            const snapshot = await probe.window(finder, 1).catch(() => ({}));
            console.error(`Finder ${sequence} failed: ${error}`);
            found.push(
              new Error(
                `Finder ${sequence}: ${error}\n${JSON.stringify(snapshot).slice(0, 1_200)}`,
              ),
            );
            await probe.key(53).catch(() => {});
          }
        };
        const start = async (sequence: string) => {
          await app.run(sequence);
          await app.flush();
        };
        const invoke = async (sequence: string, read: () => Promise<true | undefined>) => {
          await start(sequence);
          await waitFor(read, 9_000);
        };
        const fileState =
          (path: string, exists = true) =>
          async () =>
            (await Bun.file(path).exists()) === exists ? true : undefined;
        try {
          await mkdir(child);
          await check("/f", async () => {
            await probe.activate("com.apple.TextEdit");
            await invoke("/f", async () => ((await probe.front()) === finder ? true : undefined));
          });
          for (const [sequence, title] of Object.entries(locations)) {
            await check(sequence, async () => {
              await focusFolder();
              await start(sequence);
              await shown(title);
              if (sequence === "gid") await probe.key(53);
            });
          }
          await check("gf", async () => {
            await focusFolder();
            const goToFolder = async () =>
              flattenAX(await windows(4)).some(
                (node) => node.role === "AXStaticText" && node.value === "Go to Folder",
              );
            try {
              await invoke("gf", async () => ((await goToFolder()) ? true : undefined));
            } finally {
              if (await goToFolder()) {
                await probe.pressControl(finder, "AXButton", "Close").catch(() => probe.key(53));
                await waitFor(async () => ((await goToFolder()) ? undefined : true));
              }
            }
          });
          for (const sequence of ["du", "duw"]) {
            await check(sequence, async () => {
              const parent =
                sequence === "du" ? directory : join(directory, "Enclosing test folder");
              const target = sequence === "du" ? child : join(parent, "Nested folder");
              const targetTitle = target.split("/").at(-1);
              const parentTitle = parent.split("/").at(-1);
              await mkdir(target, { recursive: true });
              await open(target);
              await shown(new RegExp(`^${targetTitle}$`));
              if (sequence === "duw") {
                expect(
                  (await windows()).some((window) => window.title === parentTitle),
                ).toBeFalse();
              }
              const finderWindows = async () =>
                (await probe.screenWindows()).filter(({ owner }) => owner === "Finder");
              const original = new Set(
                sequence === "duw" ? (await finderWindows()).map(({ number }) => number) : [],
              );
              if (sequence === "duw") expect(original.size).toBeGreaterThan(0);
              await invoke(sequence, async () => {
                const focused = await probe.window(finder).catch(() => ({}) as AXNode);
                if (focused.title !== parentTitle) return;
                if (sequence === "du") return true;
                return (await finderWindows()).some(({ number }) => !original.has(number))
                  ? true
                  : undefined;
              });
            });
          }
          await check("fa", async () => {
            await selectedFile();
            await invoke("fa", async () =>
              (await Array.fromAsync(new Bun.Glob("*alias*").scan({ cwd: directory }))).length > 0
                ? true
                : undefined,
            );
          });
          await check("fd", async () => {
            await selectedFile();
            await invoke("fd", fileState(join(directory, "Chordtest item copy.txt")));
          });
          await check("fc", async () => {
            await selectedFile();
            await invoke("fc", async () =>
              (await Array.fromAsync(new Bun.Glob("Chordtest item*.zip").scan({ cwd: directory })))
                .length > 0
                ? true
                : undefined,
            );
          });
          await check("fr", async () => {
            const folder = join(directory, "Rename fixture");
            const originalName = "Rename this item";
            const original = join(folder, originalName);
            await mkdir(folder);
            await Bun.write(original, "Finder rename test\n");
            await open(original, true);
            await shown(/^Rename fixture$/);
            await waitFor(async () =>
              (await menuItem("File", "Rename")).enabled ? true : undefined,
            );
            await app.runChecked("fr");
            await waitFor(async () => {
              const focus = await probe.focus(finder).catch(() => undefined);
              return focus?.role === "AXTextField" && focus.value === originalName
                ? true
                : undefined;
            }, 8_000).catch(async (error) => {
              const focus = await probe.focus(finder).catch(() => undefined);
              throw new Error(
                `Rename did not focus the filename editor. ${JSON.stringify(focus)}`,
                {
                  cause: error,
                },
              );
            });
            await probe.key(53);
            await waitFor(async () => {
              const field = await probe.focus(finder).catch(() => undefined);
              return field?.role === "AXTextField" && field.value === originalName
                ? undefined
                : true;
            });
          });
          await check("fq", async () => {
            await selectedFile();
            const panelOpen = async () =>
              (await windows(1)).some(
                (window) =>
                  window.subrole === "Quick Look" &&
                  window.children?.some((node) => node.id === "close panel button"),
              );
            try {
              await invoke("fq", async () => ((await panelOpen()) ? true : undefined));
            } finally {
              if (await panelOpen()) {
                await probe
                  .pressControl(finder, "AXButton", "close panel button")
                  .catch(async () => {
                    const close = (await windows(1))
                      .find((window) => window.subrole === "Quick Look")
                      ?.children?.find((node) => node.id === "close panel button");
                    if (!close?.position || !close.size)
                      throw new Error("Quick Look has no close button");
                    await probe.clickPoint(
                      close.position[0] + close.size[0] / 2,
                      close.position[1] + close.size[1] / 2,
                    );
                  });
                await waitFor(async () => ((await panelOpen()) ? undefined : true));
              }
            }
          });
          await check("fo", async () => {
            await open(child, true);
            await app.run("fo");
            await shown(/^Child$/);
          });
          await check("fe", async () => {
            const image = join(directory, "Eject.dmg");
            await runCommand([
              "/usr/bin/hdiutil",
              "create",
              "-size",
              "16m",
              "-fs",
              "HFS+",
              "-volname",
              "Chordtest Eject",
              image,
            ]);
            const mount = "/Volumes/Chordtest Eject";
            await runCommand(["/usr/bin/hdiutil", "attach", image]);
            try {
              await open(mount, true);
              await probe.clickControl(finder, "AXImage", "Chordtest Eject").catch(() => {});
              await waitFor(async () =>
                (await menuItem("File", "Eject")).enabled ? true : undefined,
              );
              await app.runChecked("fe");
              await waitFor(async () => {
                const volumes = await runCommand(["/usr/bin/hdiutil", "info"]);
                return !volumes.stdout.includes(mount) ? true : undefined;
              }, 12_000);
            } finally {
              if (Bun.spawnSync(["/bin/test", "-d", mount]).exitCode === 0) {
                await runCommand(["/usr/bin/hdiutil", "detach", mount]).catch(() => {});
              }
            }
          });
          await check("ft", async () => {
            await selectedFile();
            await invoke("ft", fileState(file, false));
            await waitFor(fileState(join(homedir(), ".Trash", name)));
          });
          for (const sequence of ["te", "tef"]) {
            await check(sequence, async () => {
              const title = sequence === "te" ? name : `Chordtest ${sequence}.txt`;
              const seed = join(directory, title);
              const trashFile = join(homedir(), ".Trash", title);
              if (!(await Bun.file(trashFile).exists())) {
                await Bun.write(seed, "Trash chord test\n");
                await open(seed, true);
                await waitFor(async () =>
                  (await menuItem("File", "Move to Trash")).enabled ? true : undefined,
                );
                await probe.press(finder, "File", "Move to Trash");
                await waitFor(fileState(trashFile), 12_000);
              }
              if ((await probe.front()) !== finder) await probe.activate(finder);
              const item = sequence === "te" ? "Empty Trash…" : "Empty Trash";
              await waitFor(
                async () => ((await menuItem("Finder", item)).enabled ? true : undefined),
                12_000,
              );
              await app.runChecked(sequence);
              if (sequence === "te") {
                const result = await waitFor(async () => {
                  if (!(await Bun.file(trashFile).exists())) return "emptied";
                  return flattenAX(await windows(5)).some(
                    (node) => node.role === "AXButton" && /Empty Trash/.test(node.title ?? ""),
                  )
                    ? "confirmation"
                    : undefined;
                }, 12_000);
                if (result === "confirmation") {
                  await probe.pressControl(finder, "AXButton", "Empty Trash");
                }
              }
              await waitFor(fileState(trashFile, false), 12_000);
            });
          }
          await focusFolder();
          const mark = async (path: string[]) => (await menuItem(...path)).mark;
          for (const [sequence, view] of Object.entries(views)) {
            await check(sequence, async () => {
              if (await mark(["View", view])) {
                await probe.press(finder, "View", view === "as List" ? "as Icons" : "as List");
                await waitFor(async () => (!(await mark(["View", view])) ? true : undefined));
              }
              await invoke(sequence, async () => ((await mark(["View", view])) ? true : undefined));
            });
          }
          await probe.press(finder, "View", "as Icons");
          for (const [sequence, target] of Object.entries(sorting)) {
            await check(sequence, async () => {
              const path = ["View", "Sort By", target];
              if (await mark(path)) {
                await probe.press(finder, "View", "Sort By", target === "Name" ? "Kind" : "Name");
                await waitFor(async () => (!(await mark(path)) ? true : undefined));
              }
              await invoke(sequence, async () => ((await mark(path)) ? true : undefined));
            });
          }
          for (const [sequence, title] of Object.entries(toggles)) {
            await check(sequence, async () => {
              const read = async (): Promise<AXNode | undefined> =>
                (await menu("View").catch(() => [])).find(
                  (node) => title.test(node.title ?? "") && node.enabled,
                );
              const initial = await read();
              expect(initial, title.source).toBeDefined();
              await invoke(sequence, async () => {
                const after = await read();
                return after && (after.title !== initial!.title || after.mark !== initial!.mark)
                  ? true
                  : undefined;
              });
              await app.run(sequence);
              await waitFor(async () => {
                const after = await read();
                return after?.title === initial!.title && after?.mark === initial!.mark
                  ? true
                  : undefined;
              });
            });
          }
          await check("ta", async () => {
            await probe.key(17, 1 << 20); // Command–T to prepare two Finder tabs.
            await waitFor(async () =>
              (await probe.menu(finder, "View", "Show All Tabs")).enabled ? true : undefined,
            );
            await invoke("ta", async () => {
              const window = await probe.window(finder, 1);
              return window.id !== "FinderWindow" &&
                window.children?.some((node) => node.role === "AXScrollArea")
                ? true
                : undefined;
            });
            await probe.key(53);
          });
          await check("th", async () => {
            await Bun.write(join(directory, ".chordtest-hidden"), "");
            await focusFolder();
            const visible = async () =>
              (await items()).some((node) =>
                [node.title, node.description, node.value].includes(".chordtest-hidden"),
              );
            const initial = await visible();
            await invoke("th", async () => ((await visible()) !== initial ? true : undefined));
            await invoke("th", async () => ((await visible()) === initial ? true : undefined));
          });
          for (const [sequence] of Object.entries(cleanup)) {
            await check(sequence, async () => {
              await selectedFile();
              await probe.press(finder, "View", "as Icons");
              await probe.press(finder, "View", "Sort By", "None");
              const position = async () =>
                (await items()).find((node) => node.role === "AXImage" && node.title === name)
                  ?.position;
              const before = await waitFor(position, 10_000);
              await probe.moveIcon(finder, name, before[0] + 40, before[1] + 40);
              const moved = await waitFor(async () => {
                const point = await position();
                return point && Math.hypot(point[0] - before[0], point[1] - before[1]) > 10
                  ? point
                  : undefined;
              });
              await invoke(sequence, async () => {
                const current = await position();
                return current && current.join() !== moved.join() ? true : undefined;
              });
            });
          }
          if (found.length) throw new Error(found.map((error) => error.message).join("\n"));
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      }),
    );
  },
  300_000,
);
