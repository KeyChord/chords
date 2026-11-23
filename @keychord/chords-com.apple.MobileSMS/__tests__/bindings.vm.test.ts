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
  ga: "All Messages",
  gk: "Known Senders",
  gu: "Unknown Senders",
  gn: "Unread Messages",
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
        const firstWindow = await waitFor(
          async () => (await nodes()).find((node) => node.role === "AXWindow"),
          15_000,
        );
        const initialNodes = flattenAX([firstWindow]);
        const dismiss = initialNodes.find(
          (node) => node.role === "AXButton" && hasLabel(node, "Not Now"),
        );
        if (dismiss) {
          await probe.pressControl(messages, "AXButton", "Not Now");
          await waitFor(async () =>
            (await nodes()).some((node) => node.role === "AXButton" && hasLabel(node, "Not Now"))
              ? undefined
              : true,
          );
        }

        const menu = (...path: string[]) =>
          waitFor(() => probe.menu(messages, ...path).catch(() => undefined), 10_000);
        const settings = await menu("Messages", "Settings…");
        if (settings.enabled === false) {
          await app.expectFailure("g,", /Menu item "Settings…".*is disabled/);
        } else {
          const settingsVisible = async () =>
            (await probe.windows(messages)).some((window) =>
              ["Settings", "General", "iMessage"].includes(window.title ?? ""),
            );
          expect(await settingsVisible()).toBe(false);
          await app.runChecked("g,");
          try {
            await waitFor(async () => ((await settingsVisible()) ? true : undefined));
          } finally {
            await probe.key(closeWindow, command);
            await waitFor(async () => ((await settingsVisible()) ? undefined : true));
          }
        }

        const compose = await menu("File", "New Message");
        if (compose.enabled === false) {
          await app.expectFailure("nm", /Menu item "New Message".*is disabled/);
        } else {
          const recipientField = async () =>
            (await nodes()).find(
              (node) =>
                node.role === "AXTextField" &&
                /^(To|Recipients):?$/.test(node.title ?? node.description ?? ""),
            );
          expect(await recipientField()).toBeUndefined();
          await app.runChecked("nm");
          try {
            await waitFor(recipientField, 10_000);
          } finally {
            await probe.key(escape);
            await waitFor(async () => ((await recipientField()) ? undefined : true));
          }
        }

        const find = await menu("Edit", "Find…");
        if (find.enabled === false) {
          await app.expectFailure("j/", /Menu item "Find…".*is disabled/);
        } else {
          const searchFocused = async () =>
            (await probe.focus(messages)).subrole === "AXSearchField";
          expect(await searchFocused()).toBe(false);
          await app.runChecked("j/");
          try {
            await waitFor(async () => ((await searchFocused()) ? true : undefined));
          } finally {
            await probe.key(escape);
          }
        }

        const marked = async (label: string) => Boolean((await menu("View", label)).mark);
        const restore = Object.values(filters);
        let initial: string | undefined;
        for (const label of restore) {
          const item = await probe.menu(messages, "View", label).catch(() => undefined);
          if (item?.mark) initial = label;
        }
        try {
          for (const [sequence, label] of Object.entries(filters)) {
            const item = await menu("View", label);
            if (item.enabled === false) {
              await app.expectFailure(sequence, /Menu item .*is disabled/);
              continue;
            }
            if (item.mark) {
              const alternate = await waitFor(async () => {
                for (const other of restore) {
                  if (other === label) continue;
                  const candidate = await probe
                    .menu(messages, "View", other)
                    .catch(() => undefined);
                  if (candidate?.enabled) return other;
                }
              });
              await probe.press(messages, "View", alternate);
              await waitFor(async () => ((await marked(label)) ? undefined : true));
            }
            await app.runChecked(sequence);
            await waitFor(async () => ((await marked(label)) ? true : undefined));
          }
        } finally {
          if (initial) await probe.press(messages, "View", initial);
        }

        expect((await menu("Conversation", "Delete Conversation…")).enabled).toBe(false);
        await app.expectFailure("cd", /Menu item "Delete Conversation…".*is disabled/);
        expect((await menu("Conversation", "Hide Alerts")).enabled).toBe(false);
        await app.expectFailure("cv", /Menu item "Hide Alerts".*is disabled/);
      }),
    );
  },
  200_000,
);
