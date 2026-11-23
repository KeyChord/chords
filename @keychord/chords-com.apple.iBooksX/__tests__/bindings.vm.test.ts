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

const label = (node: AXNode) =>
  [node.title, node.description, node.value].filter(Boolean).join(" ");

const books = "com.apple.iBooksX";
const title = "Chordtest Book";
const fixture = Bun.fileURLToPath(new URL("./Chordtest Book.epub", import.meta.url));
const command = 1 << 20;

function booksScenario(app: ChordApp, probe: MacOSProbe) {
  const nodes = async () => flattenAX(await probe.windows(books, 10));
  const reader = async () => flattenAX([await probe.window(books, 12)]);
  const menu = (...path: string[]) => probe.menu(books, ...path);
  const escape = () => probe.key(53);
  const close = () => probe.key(13, command);
  const show = (match: RegExp, role?: string) =>
    waitFor(
      async () =>
        (await nodes()).find((node) => (!role || node.role === role) && match.test(label(node))),
      12_000,
    );
  const closePopover = async () => {
    const popover = async () => (await nodes()).some((node) => node.role === "AXPopover");
    if (!(await popover())) return;
    await escape();
    await waitFor(async () => (!(await popover()) ? true : undefined));
  };

  const settings = async () => {
    await app.runChecked("a,");
    try {
      await show(/^Reading(?: |$)/);
      await show(/^Playback(?: |$)/);
    } finally {
      await close();
    }
  };
  const importPanel = async () => {
    await app.runChecked("fi");
    try {
      await show(/^(Import|Open)(?: |$)/, "AXButton");
      await show(/^Cancel(?: |$)/, "AXButton");
    } finally {
      await escape();
    }
  };
  const newCollection = async () => {
    await app.runChecked("fn");
    try {
      await waitFor(async () => {
        const focus = await probe.focus(books);
        return focus.role === "AXTextField" && /collection/i.test(label(focus)) ? focus : undefined;
      });
    } finally {
      await escape();
    }
  };
  const chooseMarkedItem = async (
    key: string,
    group: string,
    item: string,
    alternative: string,
  ) => {
    const mark = (name: string) => menu("View", group, name).then((node) => node.mark);
    const wasMarked = await mark(item);
    if (wasMarked) {
      await probe.press(books, "View", group, alternative);
      await waitFor(async () => ((await mark(alternative)) ? true : undefined));
    }
    await app.runChecked(key);
    await waitFor(async () => ((await mark(item)) ? true : undefined));
    if (!wasMarked) await probe.press(books, "View", group, alternative);
  };
  const search = async () => {
    await app.runChecked("g/");
    try {
      await waitFor(async () => {
        const focus = await probe.focus(books);
        return focus.subrole === "AXSearchField" ||
          (focus.role === "AXTextField" && /search|find/i.test(label(focus)))
          ? focus
          : undefined;
      });
    } finally {
      await escape();
      await closePopover();
    }
  };
  const readingPanel = async (key: string, match: RegExp) => {
    await app.runChecked(key);
    try {
      await waitFor(async () => {
        const active = await reader();
        const panel = active.find(
          (node) =>
            node.role === "AXPopover" &&
            flattenAX([node]).some((child) => match.test(label(child))),
        );
        if (panel) return panel;
        // Some versions expose the reader's accessory as a separate window.
        return (await nodes()).find(
          (node) => node.role === "AXWindow" && match.test(node.title ?? ""),
        );
      }, 10_000);
    } finally {
      await closePopover();
      const panel = (await probe.window(books).catch(() => undefined))?.title;
      if (panel && match.test(panel)) await close();
    }
  };
  const bookmark = async (key: string, before: string, after: string) => {
    const item = async (title: string) =>
      flattenAX([await menu("Edit")]).find(
        (node) => node.role === "AXMenuItem" && node.title === title,
      );
    await waitFor(() => item(before));
    await app.runChecked(key);
    await waitFor(() => item(after));
  };
  const openBook = async () => {
    await probe.activate(books, fixture);
    await waitFor(async () => {
      const window = await probe.window(books).catch(() => undefined);
      return window?.title === title ? window : undefined;
    }, 16_000);
  };
  const page = async (heading: string) =>
    waitFor(
      async () =>
        (await reader()).find((node) =>
          [node.title, node.description, node.value].includes(heading),
        ),
      10_000,
    );
  const turn = async (key: string, from: string, to: string) => {
    await page(from);
    expect(
      (await reader()).some((node) => [node.title, node.description, node.value].includes(to)),
    ).toBe(false);
    await app.runChecked(key);
    await page(to);
  };
  return {
    settings,
    importPanel,
    newCollection,
    chooseMarkedItem,
    search,
    readingPanel,
    bookmark,
    openBook,
    turn,
  };
}

type Scenario = ReturnType<typeof booksScenario>;
const libraryCases: Record<string, (scenario: Scenario) => Promise<void>> = {
  "a,": ({ settings }) => settings(),
  fi: ({ importPanel }) => importPanel(),
  vg: ({ chooseMarkedItem }) => chooseMarkedItem("vg", "View As", "Grid", "List"),
  vl: ({ chooseMarkedItem }) => chooseMarkedItem("vl", "View As", "List", "Grid"),
  st: ({ chooseMarkedItem }) => chooseMarkedItem("st", "Sort By", "Title", "Recent"),
  sa: ({ chooseMarkedItem }) => chooseMarkedItem("sa", "Sort By", "Author", "Recent"),
  sr: ({ chooseMarkedItem }) => chooseMarkedItem("sr", "Sort By", "Recent", "Title"),
  fn: ({ newCollection }) => newCollection(),
};
const readerCases: Record<string, (scenario: Scenario) => Promise<void>> = {
  "g/": ({ search }) => search(),
  vc: ({ readingPanel }) => readingPanel("vc", /Table of Contents|First Test Chapter/),
  pb: ({ bookmark }) => bookmark("pb", "Bookmark Page", "Remove Bookmark"),
  vb: ({ readingPanel }) => readingPanel("vb", /Bookmarks|First Test Chapter/),
  pr: ({ bookmark }) => bookmark("pr", "Remove Bookmark", "Bookmark Page"),
  vn: ({ readingPanel }) => readingPanel("vn", /Highlight|Notes/),
  "p]": ({ turn }) => turn("p]", "First Test Chapter", "Second Test Chapter"),
  "p[": ({ turn }) => turn("p[", "Second Test Chapter", "First Test Chapter"),
};
const cases = { ...libraryCases, ...readerCases };

test("every Books binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/iBooksX/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Books chords change the native app",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
        console.log("guest macOS", guestVersion);
        expect(guestVersion).toMatch(/^27\./);

        await probe.activate(books);
        const library = async () => flattenAX(await probe.windows(books, 9));
        await waitFor(async () => {
          const nodes = await library();
          const button = nodes.find(
            (node) =>
              node.role === "AXButton" &&
              [node.title, node.description].some((text) =>
                ["Continue", "Get Started", "Start Reading", "Not Now"].includes(text ?? ""),
              ),
          );
          if (button) {
            await probe.pressControl(books, "AXButton", button.title ?? button.description!);
            return;
          }
          return nodes.some((node) =>
            [node.title, node.description, node.value].includes("Library"),
          )
            ? true
            : undefined;
        }, 20_000);
        const scenario = booksScenario(app, probe);
        await scenario.openBook();
        await probe.key(13, command);
        const collection = await waitFor(async () =>
          (await library()).find(
            (node) =>
              node.position &&
              node.size &&
              !["AXWindow", "AXStaticText"].includes(node.role ?? "") &&
              [node.title, node.description, node.value].includes("Books"),
          ),
        );
        expect(collection.position && collection.size).toBeDefined();
        await probe.clickPoint(
          collection.position![0] + collection.size![0] / 2,
          collection.position![1] + collection.size![1] / 2,
        );
        const run = async (group: typeof cases) => {
          for (const [key, verify] of Object.entries(group)) {
            try {
              await verify(scenario);
            } catch (cause) {
              throw new Error("Books " + key + " did not reach its expected state", { cause });
            }
          }
        };
        try {
          await run(libraryCases);
          await scenario.openBook();
          await run(readerCases);
        } finally {
          await probe.key(53);
        }
      }),
    ),
  300_000,
);
