import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
  type MacOSProbe,
} from "@keychord/chordtest";

const mail = "com.apple.mail";
const command = 1 << 20;
const escape = 53;
const closeWindow = 13;
const hasLabel = (node: AXNode, label: string) =>
  [node.title, node.description, node.value].includes(label);

const dialogs = {
  "g,": { label: "Default email reader:", dismiss: closeWindow },
  nm: { label: "Subject:", dismiss: closeWindow },
  nb: { label: "Location:", dismiss: escape },
  ns: { label: "Smart Mailbox Name:", dismiss: escape },
  go: { label: "Open Mailbox Quickly", dismiss: escape },
  fi: { label: "Import data from:", dismiss: escape },
  wa: { label: "Activity", dismiss: closeWindow },
  wc: { label: "Connection Doctor", dismiss: closeWindow },
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
  const firstWindow = await waitFor(() => probe.window(mail, 6).catch(() => undefined), 15_000);
  const nodes = flattenAX([firstWindow]);
  if (nodes.some((node) => hasLabel(node, "Mail Privacy Protection"))) {
    await probe.pressControl(mail, "AXButton", "Continue");
  } else if (
    nodes.some((node) =>
      [node.title, node.description, node.value].some(
        (value) =>
          typeof value === "string" &&
          /choose a mail account provider|add (an? |your )?email account/i.test(value),
      ),
    ) &&
    nodes.some((node) => node.role === "AXButton" && hasLabel(node, "Cancel"))
  ) {
    await probe.pressControl(mail, "AXButton", "Cancel");
    if (!(await probe.running(mail))) await probe.activate(mail);
  }
  await waitFor(async () => {
    const item = await probe.menu(mail, "File", "New Viewer Window").catch(() => undefined);
    if (item?.enabled) return true;
  }, 15_000);
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
        const windowNodes = async () => flattenAX(await probe.windows(mail, 8));
        for (const [sequence, { label, dismiss }] of Object.entries(dialogs)) {
          const visible = async () => (await windowNodes()).some((node) => hasLabel(node, label));
          expect(await visible()).toBe(false);
          await app.runChecked(sequence);
          try {
            await waitFor(async () => ((await visible()) ? true : undefined), 10_000);
          } finally {
            await probe.key(dismiss, dismiss === closeWindow ? command : 0);
            await waitFor(async () => ((await visible()) ? undefined : true), 10_000);
          }
        }

        const count = (await probe.windows(mail)).length;
        await app.runChecked("nw");
        try {
          await waitFor(async () =>
            (await probe.windows(mail)).length === count + 1 ? true : undefined,
          );
        } finally {
          await probe.key(closeWindow, command);
          await waitFor(async () =>
            (await probe.windows(mail)).length === count ? true : undefined,
          );
        }

        const searchFocused = async () => {
          const focus = await probe.focus(mail).catch(() => undefined);
          return focus?.subrole === "AXSearchField";
        };
        expect(await searchFocused()).toBe(false);
        await app.runChecked("j/");
        try {
          await waitFor(async () => ((await searchFocused()) ? true : undefined), 10_000);
        } finally {
          await probe.key(escape);
        }
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
          const title = async () =>
            (await viewMenu()).find((node) => labels.some((label) => label === node.title))?.title;
          const before = await waitFor(title);
          const opposite = labels.find((label) => label !== before);
          await app.runChecked(sequence);
          await waitFor(async () => ((await title()) === opposite ? true : undefined));
          await app.runChecked(sequence);
          await waitFor(async () => ((await title()) === before ? true : undefined));
        }

        for (const [sequence, path] of Object.entries(markedItems)) {
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
        const initialSort = await waitFor(selectedSort);
        for (const [sequence, label] of Object.entries(sortItems)) {
          if ((await selectedSort()) === label) {
            const alternate = label === "Date" ? "From" : "Date";
            await probe.press(mail, ...sortPath, alternate);
            await waitFor(async () => ((await selectedSort()) === alternate ? true : undefined));
          }
          await app.runChecked(sequence);
          await waitFor(async () => ((await selectedSort()) === label ? true : undefined));
        }
        await probe.press(mail, ...sortPath, initialSort);
        await waitFor(async () => ((await selectedSort()) === initialSort ? true : undefined));
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
          expect((await probe.menu(mail, ...path)).enabled).toBe(false);
          await app.expectFailure(sequence, /Menu item .*is disabled/);
        }
      }),
    );
  },
  120_000,
);
