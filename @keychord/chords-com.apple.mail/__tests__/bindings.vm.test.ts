import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const mail = "com.apple.mail";
const command = 1 << 20;
const escape = 53;
const closeWindow = 13;
const hasLabel = (node: AXNode, label: string) =>
  [node.title, node.description, node.value].includes(label);

const dialogs = {
  "g,": { path: ["Mail", "Settings…"], label: "Default email reader:", dismiss: closeWindow },
  nm: { path: ["File", "New Message"], label: "Subject:", dismiss: closeWindow },
  fi: { path: ["File", "Import Mailboxes…"], label: "Import data from:", dismiss: escape },
  wa: { path: ["Window", "Activity"], label: "Activity", dismiss: closeWindow },
  wc: { path: ["Window", "Connection Doctor"], label: "Connection Doctor", dismiss: closeWindow },
} as const;

const showHideItems = {
  vs: ["Show Sidebar", "Hide Sidebar"],
  vf: ["Show Favorites Bar", "Hide Favorites Bar"],
} as const;

const markedItems = {
  vc: ["View", "Use Column Layout"],
  vt: ["View", "Organize by Conversation"],
} as const;

const sortItems = {
  sd: "Date",
  sf: "From",
  ss: "Subject",
} as const;

const unavailableItems = {
  fe: ["File", "Export as PDF…"],
  mg: ["Mailbox", "Get New Mail"],
  mr: ["Message", "Reply"],
  ml: ["Message", "Reply All"],
  mf: ["Message", "Forward"],
  ma: ["Message", "Archive"],
  md: ["Edit", "Delete"],
} as const;

test("every Mail binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/mail/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  const cases = [
    "j/",
    "nb",
    "ns", // Covered in the configured account session.
    "nw",
    "vm",
    ...Object.keys(dialogs),
    ...Object.keys(showHideItems),
    ...Object.keys(markedItems),
    ...Object.keys(sortItems),
    ...Object.keys(unavailableItems),
  ];
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(cases.sort());
});

async function openViewer(probe: MacOSProbe) {
  await probe.activate(mail);
  await waitFor(async () => {
    if (!(await probe.running(mail))) {
      await probe.activate(mail);
      return;
    }
    const windows = await probe.windows(mail, 9);
    const controls = flattenAX(windows);
    const privacy = controls.some((node) => hasLabel(node, "Mail Privacy Protection"));
    if (privacy) {
      const button = controls.find(
        (node) => node.role === "AXButton" && hasLabel(node, "Continue"),
      );
      if (button?.position && button.size) {
        const [x, y] = button.position;
        const [width, height] = button.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
        return;
      }
    }
    return windows.find(({ id, title }) => id?.startsWith("Mail.messageViewer.window.") && title);
  }, 20_000);
}

async function expectDisabled(
  app: ChordApp,
  probe: MacOSProbe,
  sequence: string,
  path: readonly string[],
) {
  const item = await probe.menu(mail, ...path);
  if (item.enabled !== false) return false;
  const title = path.at(-1)!;
  await app.expectFailure(
    sequence,
    new RegExp(`Menu item "${RegExp.escape(title)}".* is disabled`),
  );
  return true;
}

test.skipIf(!macOSUITestsEnabled)(
  "Mail chords open the viewer, compose, mailbox, import and diagnostic surfaces",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await openViewer(probe);
        const windowNodes = async () =>
          flattenAX([await probe.window(mail, 10), ...(await probe.windows(mail, 10))]);
        const failures: string[] = [];
        const check = async (sequence: string, behavior: () => Promise<void>) => {
          try {
            if (!(await probe.running(mail))) await openViewer(probe);
            await behavior();
            console.log(`Mail ${sequence} passed`);
          } catch (error) {
            const controls = await windowNodes().catch(() => []);
            const labels = controls
              .filter(({ role }) =>
                ["AXWindow", "AXSheet", "AXHeading", "AXButton", "AXStaticText"].includes(
                  role ?? "",
                ),
              )
              .map(({ title, description, value }) => title ?? description ?? value)
              .filter((label) => label !== undefined)
              .slice(0, 30);
            const failure = `Mail ${sequence}: ${error} (native window labels: ${JSON.stringify(labels)})`;
            console.error(failure);
            failures.push(failure);
          }
        };
        await check("nb", async () => {
          const path = ["Mailbox", "New Mailbox…"];
          if (await expectDisabled(app, probe, "nb", path)) return;
          const location = async () =>
            (await windowNodes()).find(
              (node) => node.role === "AXPopUpButton" && node.id === "location_value",
            );
          const mailbox = "Chordtest Local Mailbox " + crypto.randomUUID().slice(0, 8);
          const created = async () =>
            (await windowNodes()).find(
              (node) => node.role !== "AXTextField" && hasLabel(node, mailbox),
            );
          expect(await location()).toBeUndefined();
          expect(await created()).toBeUndefined();
          try {
            await app.runChecked("nb");
            const local = await waitFor(location, 10_000);
            expect(local.value).toBe("On My Mac");
            await waitFor(
              async () => (await probe.focus(mail)).role === "AXTextField" || undefined,
            );
            await probe.typeText(mailbox);
            await waitFor(async () => (await probe.focus(mail)).value === mailbox || undefined);
            await waitFor(async () =>
              (await windowNodes()).find(
                (node) => node.role === "AXButton" && node.id === "ok" && node.enabled,
              ),
            );
            await probe.pressControl(mail, "AXButton", "ok");
            await waitFor(created, 10_000);
          } finally {
            if (await location()) await probe.pressControl(mail, "AXButton", "cancel");
          }
        });

        for (const [sequence, { path, label, dismiss }] of Object.entries(dialogs)) {
          await check(sequence, async () => {
            if (await expectDisabled(app, probe, sequence, path)) return;
            const visible = async () => (await windowNodes()).some((node) => hasLabel(node, label));
            expect(await visible()).toBe(false);
            try {
              await app.runChecked(sequence);
              await waitFor(async () => (await visible()) || undefined, 10_000);
            } finally {
              if (await visible()) {
                await probe.key(dismiss, dismiss === closeWindow ? command : 0);
                await waitFor(async () => !(await visible()) || undefined, 10_000);
              }
            }
          });
        }

        await check("nw", async () => {
          if (await expectDisabled(app, probe, "nw", ["File", "New Viewer Window"])) return;
          const count = (await probe.windows(mail)).length;
          await app.runChecked("nw");
          try {
            await waitFor(async () =>
              (await probe.windows(mail)).length === count + 1 ? true : undefined,
            );
          } finally {
            if ((await probe.windows(mail)).length > count) await probe.key(closeWindow, command);
            await waitFor(async () =>
              (await probe.windows(mail)).length === count ? true : undefined,
            );
          }
        });

        await check("j/", async () => {
          if (await expectDisabled(app, probe, "j/", ["Edit", "Find", "Mailbox Search"])) return;
          const searchFocused = async () => {
            const focus = await probe.focus(mail).catch(() => undefined);
            return focus?.subrole === "AXSearchField";
          };
          expect(await searchFocused()).toBe(false);
          try {
            await app.runChecked("j/");
            await waitFor(async () => ((await searchFocused()) ? true : undefined), 10_000);
          } finally {
            if (await searchFocused()) await probe.key(escape);
          }
        });
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  180_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "Mail chords toggle the viewer settings and change the sort order",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await openViewer(probe);
        const viewMenu = async () => flattenAX([await probe.menu(mail, "View")]);
        for (const [sequence, labels] of Object.entries(showHideItems)) {
          const item = async () =>
            (await viewMenu()).find((node) => labels.some((label) => label === node.title));
          const initial = await waitFor(item);
          const before = initial.title!;
          if (await expectDisabled(app, probe, sequence, ["View", before])) continue;
          const title = async () => (await item())?.title;
          const opposite = labels.find((label) => label !== before);
          await app.runChecked(sequence);
          await waitFor(async () => ((await title()) === opposite ? true : undefined));
          await app.runChecked(sequence);
          await waitFor(async () => ((await title()) === before ? true : undefined));
        }

        for (const [sequence, path] of Object.entries(markedItems)) {
          if (await expectDisabled(app, probe, sequence, path)) continue;
          const marked = async () => Boolean((await probe.menu(mail, ...path)).mark);
          const before = await marked();
          await app.runChecked(sequence);
          await waitFor(async () => ((await marked()) !== before ? true : undefined));
          await app.runChecked(sequence);
          await waitFor(async () => ((await marked()) === before ? true : undefined));
        }

        const filter = async () =>
          (await viewMenu()).find((node) =>
            /^(Enable|Disable) Message Filter$/.test(node.title ?? ""),
          );
        const initialFilter = await waitFor(filter);
        if (initialFilter.enabled === false) {
          await app.expectFailure("vm", /Menu item ".* Message Filter".*is disabled/);
        } else {
          await app.runChecked("vm");
          await waitFor(async () => {
            const item = await filter();
            if (item && item.title !== initialFilter.title) return true;
          });
          await app.runChecked("vm");
          await waitFor(async () =>
            (await filter())?.title === initialFilter.title ? true : undefined,
          );
        }

        const sortPath = ["View", "Sort By"];
        const selectedSort = async () => {
          const entries = flattenAX([await probe.menu(mail, ...sortPath)]);
          return entries.find(
            (node) =>
              node.mark &&
              !["Ascending", "Descending", "Inbox Only", "All Mailboxes"].includes(
                node.title ?? "",
              ),
          )?.title;
        };
        const initialSort = await selectedSort();
        for (const [sequence, label] of Object.entries(sortItems)) {
          if (await expectDisabled(app, probe, sequence, [...sortPath, label])) continue;
          if ((await selectedSort()) === label) {
            const alternate = label === "Date" ? "From" : "Date";
            await probe.press(mail, ...sortPath, alternate);
            await waitFor(async () => ((await selectedSort()) === alternate ? true : undefined));
          }
          await app.runChecked(sequence);
          await waitFor(async () => ((await selectedSort()) === label ? true : undefined));
        }
        if (initialSort) {
          await probe.press(mail, ...sortPath, initialSort);
          await waitFor(async () => ((await selectedSort()) === initialSort ? true : undefined));
        }
      }),
    );
  },
  180_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "Mail reports unavailable actions in a fresh guest without accounts or selected mail",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await openViewer(probe);
        for (const [sequence, path] of Object.entries(unavailableItems)) {
          expect(await expectDisabled(app, probe, sequence, path)).toBe(true);
        }
      }),
    );
  },
  120_000,
);
