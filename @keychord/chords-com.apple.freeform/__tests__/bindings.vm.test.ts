import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.freeform";
const command = 1 << 20;
const browserView = { vl: "as List", vi: "as Icons" };
const sortOrder = { sn: "Name", sd: "Date" };
const insert = { in: "Sticky Note", it: "Text Box", ir: "Rectangle" };
const caseKeys = [
  ...Object.keys(browserView),
  ...Object.keys(sortOrder),
  ...Object.keys(insert),
  "bn",
  "bu",
  "bd",
  "be",
  "jf",
  "vs",
  "vgs",
  "vgh",
  "z=",
  "z-",
  "za",
];

test("every Freeform binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/freeform/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((sequence) => !sequence.startsWith("?"))
      .sort(),
  ).toEqual(caseKeys.sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Freeform chords change the browser and edit a disposable board",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        const menu = (...path: string[]) => probe.menu(bundleId, ...path);
        const window = () => probe.window(bundleId, 9);
        const controls = async () => flattenAX([await window()]);
        const button = async (label: string) =>
          (await controls()).find(
            (node) => node.role === "AXButton" && [node.title, node.description].includes(label),
          );
        const itemTitle = async (label: string) =>
          flattenAX([await menu("View")]).find(
            (node) => node.title === "Show " + label || node.title === "Hide " + label,
          )?.title;
        const isBrowser = async () =>
          (await menu("View", "as List").catch(() => undefined))?.enabled;
        const changeMark = async (sequence: string, ...path: string[]) => {
          expect((await menu(...path)).mark).toBeUndefined();
          await app.runChecked(sequence);
          await waitFor(async () => (await menu(...path)).mark || undefined);
        };
        const boardNames = async () =>
          (await controls()).flatMap((node) =>
            node.role === "AXStaticText" && typeof node.value === "string" ? [node.value] : [],
          );
        const zoom = async () => {
          for (const node of await controls()) {
            for (const label of [node.title, node.description, node.value]) {
              if (typeof label !== "string") continue;
              const amount = label.match(/(?:^|Zoom(?: Level)?:? )(\d+)\s*%/i);
              if (amount) return Number(amount[1]);
            }
          }
        };
        const back = async () => {
          await waitFor(() => button("Back"));
          await probe.pressControl(bundleId, "AXButton", "Back");
          await waitFor(async () => ((await isBrowser()) ? true : undefined), 12_000);
        };

        await probe.activate(bundleId);
        await waitFor(async () => {
          const onboarding = (await button("Continue")) ?? (await button("Get Started"));
          if (onboarding) {
            await probe.pressControl(
              bundleId,
              "AXButton",
              onboarding.title ?? onboarding.description!,
            );
            return;
          }
          if (await isBrowser()) return true;
        }, 20_000);

        // Start each pair in the alternate mode so both chords must perform a transition.
        await probe.press(bundleId, "View", "as Icons");
        await waitFor(async () => (await menu("View", "as Icons")).mark || undefined);
        for (const [sequence, item] of Object.entries(browserView)) {
          await changeMark(sequence, "View", item);
        }
        await probe.press(bundleId, "View", "Sort By", "Date");
        await waitFor(async () => (await menu("View", "Sort By", "Date")).mark || undefined);
        for (const [sequence, item] of Object.entries(sortOrder)) {
          await changeMark(sequence, "View", "Sort By", item);
        }

        const sidebar = await waitFor(() => itemTitle("Sidebar"));
        await app.runChecked("vs");
        await waitFor(async () => {
          const title = await itemTitle("Sidebar");
          return title && title !== sidebar ? true : undefined;
        });
        await app.runChecked("vs");
        await waitFor(async () => ((await itemTitle("Sidebar")) === sidebar ? true : undefined));

        const existing = await boardNames();
        await app.runChecked("bn");
        const board = await waitFor(async () => {
          const title = (await window()).title;
          return title?.startsWith("Untitled") && !existing.includes(title) ? title : undefined;
        }, 12_000);
        await waitFor(async () =>
          (await menu("Insert", "Sticky Note")).enabled ? true : undefined,
        );
        await app.runChecked("jf");
        await waitFor(async () => {
          const focus = await probe.focus(bundleId);
          return focus.subrole === "AXSearchField" ||
            (focus.role === "AXTextField" &&
              /find|search/i.test(focus.description ?? focus.id ?? ""))
            ? true
            : undefined;
        });
        await probe.key(53);

        if ((await itemTitle("Grid")) === "Hide Grid") {
          await probe.press(bundleId, "View", "Hide Grid");
          await waitFor(async () => ((await itemTitle("Grid")) === "Show Grid" ? true : undefined));
        }
        await app.runChecked("vgs");
        await waitFor(async () => ((await itemTitle("Grid")) === "Hide Grid" ? true : undefined));
        await app.runChecked("vgh");
        await waitFor(async () => ((await itemTitle("Grid")) === "Show Grid" ? true : undefined));

        const originalZoom = await waitFor(zoom);
        await app.runChecked("z=");
        const zoomedIn = await waitFor(async () => {
          const amount = await zoom();
          return amount !== undefined && amount > originalZoom ? amount : undefined;
        });
        await app.runChecked("z-");
        await waitFor(async () => {
          const amount = await zoom();
          return amount !== undefined && amount < zoomedIn ? true : undefined;
        });
        if ((await zoom()) === 100) {
          await probe.press(bundleId, "View", "Zoom", "Zoom Out");
          await waitFor(async () => {
            const amount = await zoom();
            return amount !== undefined && amount < 100 ? true : undefined;
          });
        }
        await app.runChecked("za");
        await waitFor(async () => ((await zoom()) === 100 ? true : undefined));

        for (const [sequence, object] of Object.entries(insert)) {
          const undo = async () =>
            flattenAX([await menu("Edit")]).find((node) => /^Undo\b/.test(node.title ?? ""));
          const before = (await undo())?.title;
          await app.runChecked(sequence);
          await waitFor(async () => {
            const title = (await undo())?.title;
            return title !== before && /^Undo (Insert|Add|Create)/i.test(title ?? "")
              ? true
              : undefined;
          });
          console.log("Freeform inserted " + object);
          if (sequence !== "in") {
            await probe.key(53);
            await probe.key(6, command);
            await waitFor(async () => ((await undo())?.title === before ? true : undefined));
          }
        }

        await app.runChecked("be");
        await waitFor(() => button("Export"));
        await probe.key(53);
        await waitFor(async () => ((await button("Export")) ? undefined : true));
        await back();

        await probe.press(bundleId, "View", "as List");
        await waitFor(async () => (await menu("View", "as List")).mark || undefined);
        await probe.selectRow(bundleId, board);
        const originals = await boardNames();
        await app.runChecked("bu");
        const duplicate = await waitFor(async () => {
          const newWindow = (await window()).title;
          if (newWindow?.includes(board) && newWindow !== board && !originals.includes(newWindow))
            return newWindow;
          return (await boardNames()).find(
            (name) => name.includes(board) && !originals.includes(name),
          );
        }, 12_000);
        if (!(await isBrowser())) await back();
        for (const [name, chord] of [
          [duplicate, true],
          [board, false],
        ] as const) {
          await probe.selectRow(bundleId, name);
          if (chord) await app.runChecked("bd");
          else await probe.press(bundleId, "File", "Delete");
          await waitFor(async () => {
            if (await button("Delete")) await probe.pressControl(bundleId, "AXButton", "Delete");
            return (await boardNames()).includes(name) ? undefined : true;
          }, 12_000);
        }
      }),
    ),
  240_000,
);
