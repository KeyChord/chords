import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.freeform";
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
            (node) =>
              node.enabled && (node.title === "Show " + label || node.title === "Hide " + label),
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
            ["AXStaticText", "AXCell", "AXRow"].includes(node.role ?? "")
              ? [node.title, node.value, node.description].filter(
                  (value): value is string => typeof value === "string",
                )
              : [],
          );
        const selectBoard = async (name: string, action: string) => {
          const item = await waitFor(async () =>
            (await controls()).find(
              (node) =>
                ["AXStaticText", "AXCell", "AXRow", "AXButton"].includes(node.role ?? "") &&
                node.position &&
                node.size?.every((amount) => amount > 0) &&
                [node.title, node.value, node.description].includes(name),
            ),
          ).catch(async (cause) => {
            throw new Error(
              `Freeform did not list ${name}: ${JSON.stringify(await boardNames())}`,
              { cause },
            );
          });
          const [x, y] = item.position!;
          const [width, height] = item.size!;
          await probe.clickPoint(x + width / 2, y + height / 2);
          await waitFor(async () => (await menu("File", action)).enabled || undefined);
        };
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
          await waitFor(() => button("Go Back"));
          await probe.clickControl(bundleId, "AXButton", "Go Back");
          await waitFor(async () => ((await isBrowser()) ? true : undefined), 12_000);
        };

        await probe.activate(bundleId);
        await waitFor(async () => {
          const windows = await probe.windows(bundleId, 12);
          const controls = flattenAX(windows);
          const welcome = controls.find(({ id }) => id === "WelcomeWindow");
          const onboarding = flattenAX(welcome ? [welcome] : windows).find(
            ({ role, id, title, enabled }) =>
              role === "AXButton" &&
              enabled &&
              (id === "Primary Button" ||
                id === "onboarding.primary.button" ||
                (welcome && title === "Continue")),
          );
          if (onboarding?.position && onboarding.size) {
            const [x, y] = onboarding.position;
            const [width, height] = onboarding.size;
            await probe.clickPoint(x + width / 2, y + height / 2);
            return;
          }
          const iCloud = controls.some(
            ({ role, title }) => role === "AXButton" && title === "Go to System Settings",
          );
          const dismiss = iCloud
            ? controls.find(
                ({ role, title, enabled }) => role === "AXButton" && title === "Not Now" && enabled,
              )
            : undefined;
          if (dismiss?.position && dismiss.size) {
            await probe.clickPoint(
              dismiss.position[0] + dismiss.size[0] / 2,
              dismiss.position[1] + dismiss.size[1] / 2,
            );
            return;
          }
          if (await isBrowser()) return true;
          const returnToBrowser = await button("Go Back");
          if (returnToBrowser?.enabled && returnToBrowser.position && returnToBrowser.size) {
            await probe.clickPoint(
              returnToBrowser.position[0] + returnToBrowser.size[0] / 2,
              returnToBrowser.position[1] + returnToBrowser.size[1] / 2,
            );
          }
        }, 20_000).catch(async (cause) => {
          const context = (await controls())
            .filter(
              ({ role, title, description, id }) =>
                role === "AXSheet" || (role === "AXButton" && (title || description || id)),
            )
            .map(({ role, title, description, id, enabled }) => ({
              role,
              title,
              description,
              id,
              enabled,
            }));
          throw new Error(
            "Freeform board browser did not become available: " +
              JSON.stringify({ front: await probe.front(), context }),
            { cause },
          );
        });

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

        const gridWasVisible = (await waitFor(() => itemTitle("Grid"))) === "Hide Grid";
        if (gridWasVisible) {
          await app.runChecked("vgh");
          await waitFor(async () => ((await itemTitle("Grid")) === "Show Grid" ? true : undefined));
        }
        await app.runChecked("vgs");
        await waitFor(async () => ((await itemTitle("Grid")) === "Hide Grid" ? true : undefined));
        if (!gridWasVisible) {
          await app.runChecked("vgh");
          await waitFor(async () => ((await itemTitle("Grid")) === "Show Grid" ? true : undefined));
        }

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

        const undo = async () =>
          flattenAX([await menu("Edit")]).find((node) => /^Undo\b/.test(node.title ?? ""));
        for (const [sequence, object] of Object.entries(insert)) {
          const before = (await undo())?.title;
          await app.runChecked(sequence);
          const inserted = await waitFor(async () => {
            const item = await undo();
            const action = item?.title ?? "";
            return item?.enabled &&
              action !== before &&
              (/^Undo (Insert|Add|Create)/i.test(action) || action.includes(object))
              ? action
              : undefined;
          }).catch(async (cause) => {
            const item = await undo();
            throw new Error(`Freeform ${object} left Undo at ${item?.title} (before ${before})`, {
              cause,
            });
          });
          console.log("Freeform inserted " + object, inserted);
          await probe.key(53);
          await probe.press(bundleId, "Edit", inserted);
          await waitFor(async () => ((await undo())?.title === before ? true : undefined));
        }

        await probe.press(bundleId, "Insert", "Sticky Note");
        await waitFor(async () => {
          const item = await undo();
          return item?.enabled && /^Undo (Insert|Add|Create)/i.test(item.title ?? "")
            ? item
            : undefined;
        });
        await probe.key(53);
        const beforeFind = await probe.focus(bundleId);
        await app.runChecked("jf");
        await waitFor(async () => {
          const focus = await probe.focus(bundleId);
          if (focus.subrole === "AXSearchField") return focus;
          if (focus.role !== "AXTextField") return;
          const searchLabel = [focus.title, focus.description, focus.id].some((value) =>
            /find|search/i.test(value ?? ""),
          );
          const changed =
            focus.id !== beforeFind.id ||
            (focus.position &&
              beforeFind.position &&
              focus.position.some((value, index) => value !== beforeFind.position![index]));
          if (searchLabel || (changed && focus.value === "")) return focus;
        }).catch(async (cause) => {
          const fields = (await controls()).filter(
            ({ role, subrole }) =>
              ["AXTextField", "AXComboBox"].includes(role ?? "") || subrole === "AXSearchField",
          );
          throw new Error(
            "Freeform did not focus board search: " +
              JSON.stringify({
                beforeFind,
                focus: await probe.focus(bundleId),
                fields,
              }),
            { cause },
          );
        });
        await probe.key(53);

        await app.runChecked("be");
        await waitFor(() => button("Export"));
        await probe.key(53);
        await waitFor(async () => ((await button("Export")) ? undefined : true));
        await back();

        await probe.press(bundleId, "View", "as List");
        await waitFor(async () => (await menu("View", "as List")).mark || undefined);
        await selectBoard(board, "Duplicate");
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
          await selectBoard(name, "Delete");
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
