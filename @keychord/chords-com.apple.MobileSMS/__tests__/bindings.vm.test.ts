import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
} from "@keychord/chordtest";

const messages = "com.apple.MobileSMS";
const closeWindow = 13;
const command = 1 << 20;
const escape = 53;
const filters = {
  ga: "Messages",
  gk: "Known Senders",
  gu: "Unknown Senders",
  gn: "Unread",
  gd: "Recently Deleted",
} as const;

const hasLabel = (node: AXNode, label: string) =>
  [node.title, node.description, node.value].includes(label);

test("every Messages binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/MobileSMS/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["g,", "j/", "nm", "cd", "cv", ...Object.keys(filters)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Messages chords focus search, show composer and settings, and switch filters",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await probe.activate(messages);
        const nodes = async () => flattenAX(await probe.windows(messages, 8));
        const dialogs = (await nodes()).filter(
          (node) => node.role === "AXSheet" || node.subrole === "AXDialog",
        );
        const dismiss = flattenAX(dialogs).find(
          (node) => node.role === "AXButton" && node.enabled && hasLabel(node, "Not Now"),
        );
        if (dismiss?.position && dismiss.size) {
          const [x, y] = dismiss.position;
          const [width, height] = dismiss.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
          await waitFor(async () => (await probe.front()) === messages || undefined);
        }

        const menu = (...path: string[]) =>
          waitFor(() => probe.menu(messages, ...path).catch(() => undefined), 10_000);
        const verifySettings = async () => {
          const settings = await menu("Messages", "Settings…");
          if (settings.enabled === false) {
            await app.expectFailure("g,", /Menu item "Settings…".*is disabled/);
            return;
          }
          const settingsWindow = async () =>
            (await probe.windows(messages)).find((window) =>
              ["Settings", "General", "iMessage"].includes(window.title ?? ""),
            );
          expect(await settingsWindow()).toBeUndefined();
          await app.runChecked("g,");
          try {
            await waitFor(async () => ((await settingsWindow()) ? true : undefined));
            const screening = () =>
              waitFor(async () =>
                (await nodes()).find(
                  (node) =>
                    node.role === "AXCheckBox" &&
                    node.title === "Screen unknown senders" &&
                    node.enabled &&
                    node.position &&
                    node.size,
                ),
              );
            const enabled = (node: AXNode) => node.value === true || node.value === 1;
            const control = await screening();
            if (!enabled(control)) {
              const [x, y] = control.position!;
              const [width, height] = control.size!;
              await probe.clickPoint(x + width / 2, y + height / 2);
              await waitFor(async () => enabled(await screening()) || undefined);
            }
          } finally {
            const opened = await settingsWindow();
            if (opened?.title) {
              await probe.closeWindow(messages, opened.title).catch(async () => {
                await probe.raiseWindow(messages, opened.title!);
                await probe.key(closeWindow, command);
              });
            }
            await waitFor(async () => !(await settingsWindow()) || undefined, 12_000);
          }
        };

        const openMessagesWindow = async () => {
          const scene = async () =>
            (await probe.windows(messages)).find(
              (window) => window.id === "SceneWindow" && window.title === "Messages",
            );
          if (await scene()) return;
          await probe.activate(messages);
          if (await scene()) return;
          const item = await menu("Window", "Messages");
          expect(item).toMatchObject({ enabled: true, key: "0", keyModifiers: 0 });
          await probe.key(29, command);
          await waitFor(scene, 12_000);
        };

        const failures: unknown[] = [];
        const check = async (name: string, verify: () => Promise<void>) => {
          try {
            await verify();
            console.log("Messages " + name + " passed");
          } catch (cause) {
            failures.push(new Error("Messages " + name + " failed", { cause }));
            console.error(failures.at(-1));
          }
        };
        const composeState = async () => {
          const window = await probe.window(messages, 9).catch(() => ({}));
          const controls = [...flattenAX([window]), ...(await nodes())];
          const recipient = controls.find(
            (node) =>
              node.role === "AXTextField" &&
              [node.id, node.title, node.description].some((label) =>
                /^(To|Recipients):?$/.test(label ?? ""),
              ),
          );
          if (recipient) return "composer";
          const signIn = controls.find(
            (node) =>
              node.role === "AXSheet" &&
              flattenAX([node]).some(
                (node) =>
                  node.role === "AXStaticText" &&
                  hasLabel(node, "Add an Email Address to Use iMessage"),
              ),
          );
          if (signIn) return "account alert";
        };
        const composeFocused = async () => {
          const field = await probe.focus(messages).catch(() => undefined);
          if (field?.role !== "AXTextField") return false;
          return [field.id, field.title, field.description].some((label) =>
            /^(To|Recipients):?$/.test(label ?? ""),
          );
        };
        await check("settings", verifySettings);
        await check("new message", async () => {
          await openMessagesWindow();
          if ((await composeState()) === "composer") {
            if (await composeFocused()) await probe.key(48);
            if (await composeFocused()) {
              const search = await probe.windowElement(messages, "Search", "AXTextField");
              if (search?.position && search.size) {
                const [x, y] = search.position;
                const [width, height] = search.size;
                await probe.clickPoint(x + width / 2, y + height / 2);
              }
            }
            await waitFor(async () => !(await composeFocused()) || undefined);
            expect(await composeState()).toBe("composer");
          }
          const newComposer = async () => {
            const current = await composeState();
            if (current === "account alert" || (current === "composer" && (await composeFocused())))
              return current;
          };
          await waitFor(async () => {
            const item = await probe.menu(messages, "File", "New Message").catch(() => undefined);
            return ((await probe.front()) === messages && item?.enabled) || undefined;
          }, 15_000);
          await app.runChecked("nm");
          try {
            const opened = await waitFor(newComposer, 15_000).catch(() => undefined);
            if (opened) {
              console.log("Messages nm opened its compose surface");
            } else {
              const focus = await probe.focus(messages).catch(() => undefined);
              const windows = await probe.windows(messages, 2);
              const front = await probe.front();
              const messageWindow = await probe
                .menu(messages, "Window", "Messages")
                .catch(() => undefined);
              await probe.key(45, command); // Native Command–N for a reference observation.
              const reference = await waitFor(newComposer, 10_000).catch(() => undefined);
              const failure = new Error(
                "Messages did not show the composer after nm: " +
                  JSON.stringify({ front, windows, focus, messageWindow, reference }),
              );
              throw failure;
            }
          } finally {
            const state = await composeState();
            if (state === "account alert") {
              await probe.pressControl(messages, "AXButton", "Cancel");
              await waitFor(async () => !(await composeState()) || undefined);
            }
          }
        });
        try {
          await check("main window", openMessagesWindow);
          await check("search", async () => {
            const find = await menu("Edit", "Search", "Find…");
            expect(find).toMatchObject({ enabled: true, key: "F", keyModifiers: 0 });
            const searchControl = async () =>
              (await nodes()).find(
                (node) => node.role === "AXTextField" && hasLabel(node, "Search"),
              );
            const searchFocused = async () => {
              const focus = await probe.focus(messages);
              return (
                focus.subrole === "AXSearchField" ||
                (focus.role === "AXTextField" && hasLabel(focus, "Search"))
              );
            };
            expect(await searchFocused()).toBe(false);
            await app.runChecked("j/");
            try {
              await waitFor(
                async () =>
                  (await searchFocused()) || (await searchControl())?.focused || undefined,
              ).catch(async (cause) => {
                throw new Error(
                  "Messages did not focus conversation search: " +
                    JSON.stringify({
                      item: find,
                      focus: await probe.focus(messages).catch(() => undefined),
                      search: await searchControl(),
                    }),
                  { cause },
                );
              });
            } finally {
              await probe.key(escape);
            }
          });
          await check("filters and conversation preconditions", async () => {
            const filterPath = async (label: string) => {
              const direct = ["View", label];
              if (await probe.menu(messages, ...direct).catch(() => undefined)) return direct;
              return ["View", "Filter By", label];
            };
            const filter = async (label: string) =>
              probe.menu(messages, ...(await filterPath(label)));
            const marked = async (label: string) => Boolean((await filter(label)).mark);
            const restore = Object.values(filters);
            let initial: string | undefined;
            for (const label of restore) {
              const item = await filter(label).catch(() => undefined);
              if (item?.mark) initial = label;
            }
            try {
              for (const [sequence, label] of Object.entries(filters)) {
                const item = await filter(label).catch(() => undefined);
                if (!item) {
                  const submenu = await probe.menu(messages, "View", "Filter By");
                  expect(submenu.enabled).toBe(false);
                  expect(["Known Senders", "Unknown Senders"]).toContain(label);
                  expect(
                    flattenAX([submenu]).some(
                      (node) => node.role === "AXMenuItem" && node.title === label,
                    ),
                  ).toBe(false);
                  await app.expectFailure(
                    sequence,
                    new RegExp(
                      `Menu path "View > ${RegExp.escape(label)}".*has no component "${RegExp.escape(label)}"`,
                    ),
                  );
                  console.log("Messages verified the missing signed-out " + label + " filter");
                  continue;
                }
                if (item.enabled === false) {
                  await app.expectFailure(sequence, /Menu item .*is disabled/);
                  continue;
                }
                if (item.mark) {
                  const alternate = await waitFor(async () => {
                    for (const other of restore) {
                      if (other === label) continue;
                      const candidate = await filter(other).catch(() => undefined);
                      if (candidate?.enabled) return other;
                    }
                  });
                  await probe.press(messages, ...(await filterPath(alternate)));
                  await waitFor(async () => ((await marked(label)) ? undefined : true));
                }
                await app.runChecked(sequence);
                await waitFor(async () => ((await marked(label)) ? true : undefined));
              }
            } finally {
              if (initial) await probe.press(messages, ...(await filterPath(initial)));
            }
          });
          await check("delete conversation precondition", async () => {
            const item = await menu("Conversation", "Delete Conversation…");
            if (item.enabled === false) {
              await app.expectFailure("cd", /Menu item "Delete Conversation…".*is disabled/);
              return;
            }
            const confirmation = async () =>
              (await nodes()).find(
                (node) =>
                  (node.role === "AXSheet" || node.subrole === "AXDialog") &&
                  flattenAX([node]).some(
                    (child) => child.role === "AXButton" && child.title === "Delete",
                  ),
              );
            const before = await composeState();
            await app.runChecked("cd");
            try {
              await waitFor(async () =>
                (before === "composer" && !(await composeState())) || (await confirmation())
                  ? true
                  : undefined,
              );
            } finally {
              if (await confirmation()) await probe.pressControl(messages, "AXButton", "Cancel");
            }
          });
          await check("alerts precondition", async () => {
            expect((await menu("Conversation", "Hide Alerts")).enabled).toBe(false);
            await app.expectFailure("cv", /Menu item "Hide Alerts".*is disabled/);
          });
          if (failures.length) throw new AggregateError(failures, "Messages behavior failures");
        } finally {
          if ((await composeState()) === "composer") {
            const main = (await probe.windows(messages)).find(
              (window) => window.id === "SceneWindow" && window.title === "Messages",
            );
            if (main?.title) await probe.closeWindow(messages, main.title);
          }
        }
      }),
    );
  },
  200_000,
);
