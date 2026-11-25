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
const companionTitle = "Chordtest Library Companion";
const companion = Bun.fileURLToPath(new URL("./Chordtest Library Companion.epub", import.meta.url));
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
  const focusChapter = async (bookTitle = title) => {
    const chapter = await waitFor(async () => {
      const window = (await probe.windows(books, 12)).find((node) => node.title === bookTitle);
      if (!window) return;
      const controls = flattenAX([window]);
      const content = controls.find((node) => node.subrole === "iOSContentGroup");
      return (content ? flattenAX([content]) : controls).find(
        (node) =>
          (node.role === "AXHeading" || (content && node.role === "AXStaticText")) &&
          node.position &&
          node.size?.every((dimension) => dimension > 0) &&
          [node.title, node.description, node.value].some(
            (text) => typeof text === "string" && /^(First|Second) Test Chapter$/.test(text),
          ),
      );
    }, 18_000);
    const [x, y] = chapter.position!;
    const [width, height] = chapter.size!;
    await probe.clickPoint(x + width / 2, y + height / 2);
    await waitFor(async () => {
      const window = await probe.window(books);
      return (window.title === bookTitle && (await probe.front()) === books) || undefined;
    });
  };
  const closePopover = async () => {
    await escape();
    await focusChapter();
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
    const panel = async () =>
      (await nodes()).find(
        (node) =>
          node.role === "AXSheet" &&
          flattenAX([node]).some(
            (control) =>
              control.role === "AXButton" && /^(Import|Open)(?: |$)/.test(label(control)),
          ),
      );
    await app.runChecked("fi");
    try {
      await show(/^(Import|Open)(?: |$)/, "AXButton");
      await show(/^Cancel(?: |$)/, "AXButton");
    } finally {
      await probe.pressControl(books, "AXButton", "Cancel").catch(() => escape());
      await waitFor(async () => !(await panel()) || undefined);
    }
  };
  const newCollection = async () => {
    const collection = (node: AXNode) =>
      [node.title, node.description, node.value, node.id].some(
        (text) => typeof text === "string" && /^(?:New|Untitled) Collection(?: \d+)?$/.test(text),
      );
    const before = (await nodes()).filter(collection).length;
    await app.runChecked("fn");
    try {
      await waitFor(async () => {
        const focus = await probe.focus(books);
        if (focus.role === "AXTextField" && /collection/i.test(label(focus))) return true;
        return (await nodes()).filter(collection).length > before || undefined;
      }).catch(async (cause) => {
        const controls = (await nodes())
          .filter(({ role }) =>
            ["AXSheet", "AXRow", "AXTextField", "AXButton"].includes(role ?? ""),
          )
          .map(({ role, title, description, value, id }) => ({
            role,
            title,
            description,
            value,
            id,
          }));
        throw new Error(
          "Books did not show a new collection: " +
            JSON.stringify({ focus: await probe.focus(books), controls: controls.slice(0, 35) }),
          { cause },
        );
      });
    } finally {
      await escape();
    }
  };
  const chooseMarkedItem = async (key: string, item: string, alternative: string) => {
    const path = ["View"];
    const mark = (name: string) => menu(...path, name).then((node) => node.mark);
    const wasMarked = await mark(item);
    if (wasMarked) {
      await probe.press(books, ...path, alternative);
      await waitFor(async () => ((await mark(alternative)) ? true : undefined));
    }
    await waitFor(async () => (await menu(...path, item)).enabled || undefined);
    await app.runChecked(key);
    await waitFor(async () => ((await mark(item)) ? true : undefined));
    if (!wasMarked) await probe.press(books, ...path, alternative);
  };
  const chooseLibrarySort = async (key: string, title: string) => {
    const item = async (name: string) =>
      (await nodes()).find(
        (node) =>
          node.role === "AXMenuItem" &&
          node.title === name &&
          node.position &&
          node.size?.every((dimension) => dimension > 0),
      );
    const button = async () =>
      waitFor(() => probe.windowElement(books, "Library Actions", "AXMenuButton"));
    const clickButton = async () => {
      const control = await button();
      expect(control.position && control.size).toBeDefined();
      const [x, y] = control.position!;
      const [width, height] = control.size!;
      await probe.clickPoint(x + width / 2, y + height / 2);
    };
    const open = async () => {
      if (await item(title)) return;
      await probe.pressControl(books, "AXMenuButton", "Library Actions");
      if (!(await waitFor(() => item(title), 1_200).catch(() => undefined))) {
        await clickButton();
      }
      await waitFor(() => item(title));
    };
    const close = async () => {
      if (!(await item(title))) return;
      await escape();
      const closed = async () => !(await item(title)) || undefined;
      if (await waitFor(closed, 1_200).catch(() => false)) return;
      await clickButton();
      await waitFor(closed);
    };
    const marked = async () => {
      await open();
      try {
        return Boolean((await item(title))?.mark);
      } finally {
        await close();
      }
    };
    if (await marked()) {
      await open();
      await waitFor(() => item("Manual"));
      await probe.pressControl(books, "AXMenuItem", "Manual");
      expect(await marked()).toBe(false);
    }
    if ((await probe.front()) !== books) await probe.activate(books);
    await waitFor(async () => (await probe.front()) === books || undefined);
    await app.runChecked(key).catch(async (cause) => {
      throw new Error(
        "Books did not dispatch " +
          title +
          " sort: " +
          JSON.stringify({ front: await probe.front(), focusedWindow: await probe.window(books) }),
        { cause },
      );
    });
    await waitFor(async () => (await marked()) || undefined, 10_000).catch(async (cause) => {
      throw new Error("Books did not mark " + title + " as the active sort", { cause });
    });
  };
  const search = async () => {
    const searchControl = (node: AXNode) =>
      node.subrole === "AXSearchField" ||
      (node.role === "AXTextField" && /search|find/i.test(label(node) + " " + (node.id ?? "")));
    const before = (await reader()).filter(searchControl).length;
    const searchOpen = async () => {
      if (searchControl(await probe.focus(books))) return true;
      const fields = (await reader()).filter(searchControl);
      return fields.length > before || fields.some((field) => field.focused) || undefined;
    };
    try {
      await waitFor(
        async () =>
          (await menu("Edit", "Find", "Find…").catch(() => undefined))?.enabled || undefined,
      );
      await app.runChecked("g/");
      await waitFor(searchOpen);
    } catch (cause) {
      const controls = (await reader())
        .filter(({ role }) => ["AXPopover", "AXTextField", "AXButton"].includes(role ?? ""))
        .map(({ role, title, description, id }) => ({ role, title, description, id }));
      const search = await menu("Edit", "Find", "Find…").catch(() => undefined);
      const toolbarHasSearch = (await reader()).some(
        (node) =>
          node.role === "AXToolbar" &&
          flattenAX([node]).some((child) => child.role === "AXButton" && label(child) === "Search"),
      );
      throw new Error(
        "Books did not focus Find in Book: " +
          JSON.stringify({
            focus: await probe.focus(books),
            search,
            toolbarHasSearch,
            controls: controls.slice(0, 30),
          }),
        { cause },
      );
    } finally {
      await closePopover();
      await waitFor(async () => !searchControl(await probe.focus(books)) || undefined);
    }
  };
  const readingPanel = async (key: string, match: RegExp) => {
    await app.runChecked(key);
    try {
      await waitFor(async () => {
        const active = await reader();
        const panel = active.find(
          (node) =>
            ["AXPopover", "AXMenu", "AXSheet"].includes(node.role ?? "") &&
            flattenAX([node]).some((child) => match.test(label(child))),
        );
        if (panel) return panel;
        // Some versions expose the reader's accessory as a separate window.
        return (await nodes()).find(
          (node) => node.role === "AXWindow" && match.test(node.title ?? ""),
        );
      }, 10_000);
    } finally {
      const panel = (await probe.window(books).catch(() => undefined))?.title;
      if (panel && match.test(panel)) await close();
      await closePopover();
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
  const openBook = async (bookTitle = title, file = fixture) => {
    await probe.activate(books, file);
    const bookWindow = async () =>
      (await probe.windows(books)).find((window) => window.title === bookTitle);
    let openedLibrary = false;
    let pressedLibraryItem = false;
    await waitFor(async () => {
      const window = await bookWindow();
      if (window) return window;
      if (pressedLibraryItem) return;
      const item = await probe.windowElement(books, bookTitle, "AXButton", "AXCell", "AXRow");
      if (item?.role && item.position && item.size && item.enabled !== false) {
        pressedLibraryItem = true;
        await probe.pressControl(books, item.role, bookTitle).catch(async () => {
          const [x, y] = item.position!;
          const [width, height] = item.size!;
          await probe.clickPoint(x + width / 2, y + height / 2);
          await probe.key(36);
        });
      } else if (!openedLibrary) {
        const collection = (await nodes()).find(
          (node) =>
            node.role === "AXStaticText" &&
            node.position &&
            node.size &&
            [node.title, node.description, node.value].some(
              (name) => name === "Books" || name === "All Books",
            ),
        );
        if (collection?.position && collection.size) {
          openedLibrary = true;
          const [x, y] = collection.position;
          const [width, height] = collection.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
        }
      }
    }, 16_000).catch(async (cause) => {
      throw new Error(
        "Books did not finish opening its EPUB fixture: " +
          JSON.stringify({
            front: await probe.front(),
            windows: await probe.windows(books),
            pressedLibraryItem,
          }),
        { cause },
      );
    });
    await probe.raiseWindow(books, bookTitle);
    await focusChapter(bookTitle);
    await waitFor(async () => {
      const active = await probe.window(books, 12);
      return (
        (active.title === bookTitle &&
          flattenAX([active]).some(
            (node) =>
              node.role === "AXToolbar" &&
              flattenAX(node.children ?? []).some(
                (child) =>
                  child.role === "AXButton" &&
                  label(child) === "Search" &&
                  child.enabled !== false &&
                  child.size?.every((size) => size > 0),
              ),
          )) ||
        undefined
      );
    }, 12_000).catch(async (cause) => {
      throw new Error(
        "Books reader did not become ready: " +
          JSON.stringify({
            focused: await probe.window(books),
            windows: await probe.windows(books),
          }),
        { cause },
      );
    });
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
    chooseLibrarySort,
    search,
    readingPanel,
    bookmark,
    openBook,
    turn,
  };
}

type Scenario = ReturnType<typeof booksScenario>;
const libraryCases: Record<string, (scenario: Scenario) => Promise<void>> = {
  vg: ({ chooseMarkedItem }) => chooseMarkedItem("vg", "Grid", "List"),
  vl: ({ chooseMarkedItem }) => chooseMarkedItem("vl", "List", "Grid"),
  fn: ({ newCollection }) => newCollection(),
  "a,": ({ settings }) => settings(),
  fi: ({ importPanel }) => importPanel(),
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
const sortCases: Record<string, (scenario: Scenario) => Promise<void>> = {
  st: ({ chooseLibrarySort }) => chooseLibrarySort("st", "Title"),
  sa: ({ chooseLibrarySort }) => chooseLibrarySort("sa", "Author"),
  sr: ({ chooseLibrarySort }) => chooseLibrarySort("sr", "Recent"),
};
const cases = { ...libraryCases, ...readerCases, ...sortCases };

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
        const prepareLibrary = async () => {
          const attempts = new Map<string, number>();
          return waitFor(async () => {
            const focused = await probe.window(books, 9);
            const nodes = flattenAX([focused, ...(await probe.windows(books, 9))]);
            const button = nodes.find(
              (node) =>
                node.role === "AXButton" &&
                node.position &&
                node.size &&
                [node.title, node.description].some((text) =>
                  ["Continue", "Get Started", "Start Reading", "Not Now"].includes(text ?? ""),
                ),
            );
            if (button?.position && button.size) {
              const name = button.title ?? button.description!;
              const count = attempts.get(name) ?? 0;
              if (count < 2) {
                attempts.set(name, count + 1);
                if (count === 0) {
                  const [x, y] = button.position;
                  const [width, height] = button.size;
                  await probe.clickPoint(x + width / 2, y + height / 2);
                } else if (button.enabled) {
                  await probe.pressControl(books, "AXButton", name).catch(() => {});
                }
                return;
              }
            }
            const scene = nodes.find(
              (node) => node.id === "SceneWindow" && node.role === "AXWindow",
            );
            if (scene) return scene;
          }, 20_000).catch(async (cause) => {
            const views = (await library())
              .filter(({ role }) =>
                ["AXWindow", "AXSheet", "AXButton", "AXHeading"].includes(role ?? ""),
              )
              .map(({ role, title, description, id, enabled }) => ({
                role,
                title,
                description,
                id,
                enabled,
              }));
            throw new Error(
              "Books did not open its library window: " + JSON.stringify(views.slice(0, 32)),
              { cause },
            );
          });
        };
        await prepareLibrary();
        const scenario = booksScenario(app, probe);
        await scenario.openBook();
        await probe.closeWindow(books, title);
        const raiseLibrary = async () => {
          if ((await probe.front()) !== books) await probe.activate(books);
          const scene = await prepareLibrary();
          await probe.raiseWindow(books, scene.title ?? scene.id!);
        };
        await raiseLibrary();
        const viewMenuReady = async () => {
          const items = await Promise.all([
            probe.menu(books, "View", "Grid").catch(() => undefined),
            probe.menu(books, "View", "List").catch(() => undefined),
          ]);
          return items.some((item) => item?.enabled);
        };
        const selectLibrary = async () => {
          const showSidebar = await probe
            .menu(books, "View", "Show Sidebar")
            .catch(() => undefined);
          if (showSidebar?.enabled) await probe.press(books, "View", "Show Sidebar");
          const collection = await waitFor(async () => {
            return (await library()).find(
              (node) =>
                ["AXRow", "AXCell", "AXStaticText", "AXButton"].includes(node.role ?? "") &&
                node.position &&
                node.size &&
                node.size[0] > 0 &&
                node.size[1] > 0 &&
                node.size[1] < 55 &&
                [node.title, node.description, node.value].some(
                  (name) => name === "Books" || name === "All Books",
                ),
            );
          }, 12_000).catch(async (cause) => {
            const labels = (await library())
              .map(({ role, title, description, value, id }) => ({
                role,
                title,
                description,
                value,
                id,
              }))
              .filter(({ title, description, value, id }) => title || description || value || id);
            const view = flattenAX([await probe.menu(books, "View")]).map(({ title, enabled }) => ({
              title,
              enabled,
            }));
            throw new Error(
              "Books library collection is missing: " +
                JSON.stringify({ labels: labels.slice(0, 55), view }),
              { cause },
            );
          });
          const [x, y] = collection.position!;
          const [width, height] = collection.size!;
          await probe.clickPoint(x + width / 2, y + height / 2);
          await waitFor(async () => (await viewMenuReady()) || undefined).catch(async (cause) => {
            const view = flattenAX([await probe.menu(books, "View")]).map(
              ({ title, enabled, mark, id }) => ({ title, enabled, mark, id }),
            );
            throw new Error(
              "Books collection has no enabled layout menu: " +
                JSON.stringify({
                  focused: await probe.focus(books),
                  view,
                }),
              { cause },
            );
          });
        };
        if (!(await viewMenuReady())) await selectLibrary();
        const failures: Error[] = [];
        const run = async (group: typeof cases) => {
          for (const [key, verify] of Object.entries(group)) {
            try {
              await verify(scenario);
              console.log("Books " + key + " passed");
            } catch (cause) {
              const failure = new Error("Books " + key + " did not reach its expected state", {
                cause,
              });
              failures.push(failure);
              console.error(failure);
            }
          }
        };
        try {
          await run(libraryCases);
          await scenario.openBook();
          await run(readerCases);
          await probe.closeWindow(books, title);
          await scenario.openBook(companionTitle, companion);
          await probe.closeWindow(books, companionTitle);
          await raiseLibrary();
          await selectLibrary();
          await run(sortCases);
          if (failures.length) throw new AggregateError(failures, "Books behavior failures");
        } finally {
          await probe.key(53);
        }
      }),
    ),
  300_000,
);
