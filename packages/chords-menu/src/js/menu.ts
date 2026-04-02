import "@jxa/global-type";
import { run } from "jxa-run-compat";

type MenuHandler = {
  /**
   * 1-based, to match the chord rule:
   * 1 => first menu, 2 => second menu, etc.
   */
  (action: "by-index", menuIndex: number): ReturnType<typeof run>;

  /**
   * Lowercase-only query language:
   *
   * Top-level menus:
   * - "h"   => 1st menu starting with "h"
   * - "hh"  => 2nd menu starting with "h"
   * - "hhh" => 3rd menu starting with "h"
   *
   * Expanded menu items:
   * - "z"     => 1st expanded menu item starting with "z"
   * - "zo"    => 1st expanded menu item starting with "zo"
   * - "z2"    => 2nd expanded menu item starting with "z"
   * - "z-o"   => 1st expanded menu item matching word-prefixes "z" + "o"
   * - "z-o2"  => 2nd expanded menu item matching word-prefixes "z" + "o"
   */
  (action: "by-letters", query: string): ReturnType<typeof run>;
};

async function runMenuAction(processName: string | undefined, action: "by-index" | "by-letters", value: string) {
  await run(
    (processName, actionArg: "by-index" | "by-letters", valueArg: string) => {
      const log = (...args: any[]) => console.log("[JXA]", ...args);

      const normalize = (s: string) =>
        String(s)
          .replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, "")
          .trim()
          .toLowerCase();

      const assertExists = (obj: any, label: string) => {
        if (!obj) throw new Error(`Failed at: ${label}`);
        return obj;
      };

      const safeCall = <T>(fn: () => T, fallback: T): T => {
        try {
          return fn();
        } catch {
          return fallback;
        }
      };

      const getName = (item: any) => normalize(safeCall(() => item.name(), ""));

      const getMenuBarItems = (menuBar: any) => {
        const items = safeCall(() => menuBar.menuBarItems(), []);
        return Array.from({ length: items.length }, (_, i) => items[i]);
      };

      const isRepeatedLettersQuery = (query: string) => {
        if (!/^[a-z]+$/.test(query)) return false;
        const first = query[0];
        return [...query].every((ch) => ch === first);
      };

      const parseExpandedItemQuery = (query: string) => {
        const m = query.match(/^([a-z-]+?)(\d+)?$/);
        if (!m) {
          throw new Error(
            `Invalid menu query "${query}". Expected lowercase letters/hyphens with optional trailing number.`,
          );
        }

        const pattern = m[1]!;
        const ordinal = m[2] ? Number(m[2]) : 1;

        if (!pattern) {
          throw new Error(`Missing pattern in "${query}"`);
        }

        if (!Number.isInteger(ordinal) || ordinal < 1) {
          throw new Error(`Invalid trailing number in "${query}"`);
        }

        return {
          pattern,
          occurrence: ordinal,
        };
      };

      const matchesWordAbbreviation = (name: string, pattern: string) => {
        const words = name.split(/[\s]+/).filter(Boolean);
        const parts = pattern.split("-").filter(Boolean);

        if (parts.length === 0) return false;
        if (parts.length > words.length) return false;

        for (let i = 0; i < parts.length; i++) {
          if (!words[i] || !words[i].startsWith(parts[i]!)) {
            return false;
          }
        }

        return true;
      };

      const matchesExpandedPattern = (name: string, pattern: string) => {
        if (pattern.includes("-")) {
          return matchesWordAbbreviation(name, pattern);
        }

        return name.startsWith(pattern);
      };

      const isMenuItemEnabled = (item: any) => safeCall(() => item.enabled(), true);

      const isSeparatorLike = (item: any) => {
        const name = getName(item);
        if (name) return false;

        const roleDesc = normalize(safeCall(() => item.roleDescription(), ""));

        return roleDesc.includes("separator");
      };

      const collectMenuItemsDepthFirst = (menu: any) => {
        const out: any[] = [];

        const walkMenu = (menuRef: any) => {
          const items = safeCall(() => menuRef.menuItems(), []);
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;

            if (!isSeparatorLike(item)) {
              out.push(item);
            }

            const submenus = safeCall(() => item.menus(), []);
            if (submenus.length > 0 && submenus[0]) {
              walkMenu(submenus[0]);
            }
          }
        };

        walkMenu(menu);
        return out;
      };

      const getSelectedTopLevelMenu = (menuBarItems: any[]) => {
        for (const item of menuBarItems) {
          const selected = safeCall(() => item.selected(), false);
          if (!selected) continue;

          const menus = safeCall(() => item.menus(), []);
          if (menus.length > 0 && menus[0]) {
            return {
              menuBarItem: item,
              menu: menus[0],
            };
          }
        }

        return null;
      };

      const clickTopLevelMenuByIndex = (items: any[], zeroBasedIndex: number) => {
        if (zeroBasedIndex >= items.length) {
          throw new Error(
            `menuIndex ${zeroBasedIndex} out of range; found ${items.length} menu bar items`,
          );
        }

        const item = assertExists(items[zeroBasedIndex], `menuBarItems[${zeroBasedIndex}]`);

        log(
          `Clicking top-level menu #${zeroBasedIndex}:`,
          safeCall(() => item.name(), "<unknown>"),
        );
        item.click();
      };

      const clickTopLevelMenuByRepeatedLetters = (items: any[], query: string) => {
        const prefix = query[0]!;
        const occurrence = query.length;

        const matches = items.filter((item) => getName(item).startsWith(prefix));

        log(
          `Top-level repeated-letter query "${query}" -> prefix "${prefix}", occurrence ${occurrence}`,
        );
        log(
          "Top-level matches:",
          matches.map((item) => safeCall(() => item.name(), "<unknown>")),
        );

        if (matches.length < occurrence) {
          throw new Error(
            `No top-level menu match #${occurrence} for prefix "${prefix}". Found ${matches.length}.`,
          );
        }

        const item = matches[occurrence - 1]!;
        log(
          `Clicking top-level menu:`,
          safeCall(() => item.name(), "<unknown>"),
        );
        item.click();
      };

      const clickExpandedMenuItemByQuery = (items: any[], query: string) => {
        const selected = getSelectedTopLevelMenu(items);

        if (!selected) {
          throw new Error(
            `Query "${query}" targets expanded menu items, but no top-level menu appears to be expanded.`,
          );
        }

        const { pattern, occurrence } = parseExpandedItemQuery(query);
        const selectedMenuName = safeCall(() => selected.menuBarItem.name(), "<unknown>");

        log(`Expanded menu context: "${selectedMenuName}"`);
        log(`Expanded-item query "${query}" -> pattern "${pattern}", occurrence ${occurrence}`);

        const allItems = collectMenuItemsDepthFirst(selected.menu);

        const candidates = allItems.filter((item) => {
          if (!isMenuItemEnabled(item)) return false;
          const name = getName(item);
          if (!name) return false;
          return matchesExpandedPattern(name, pattern);
        });

        log(
          "Expanded matches:",
          candidates.map((item) => safeCall(() => item.name(), "<unknown>")),
        );

        if (candidates.length < occurrence) {
          throw new Error(
            `No expanded menu item match #${occurrence} for pattern "${pattern}". Found ${candidates.length}.`,
          );
        }

        const item = candidates[occurrence - 1]!;
        log(
          `Clicking expanded menu item:`,
          safeCall(() => item.name(), "<unknown>"),
        );
        item.click();
      };

      const se = Application("System Events");
      if (processName) {
        const app = Application(processName);
        log("Activating app:", processName);
        app.activate();
      }

      const proc = assertExists(se.processes.whose({ frontmost: true })[0], "frontmost process");

      log(
        "Frontmost process:",
        safeCall(() => proc.name(), "<unknown>"),
      );

      const menuBar = assertExists(proc.menuBars[0], "menuBars[0]");
      const items = getMenuBarItems(menuBar);

      if (actionArg === "by-index") {
        clickTopLevelMenuByIndex(items, Number(valueArg));
        log("Done");
        return;
      }

      const query = normalize(String(valueArg));
      if (!query) {
        throw new Error("Expected a non-empty lowercase query");
      }

      if (/^\d+$/.test(query)) {
        clickTopLevelMenuByIndex(items, Number(query));
        log("Done");
        return;
      }

      if (isRepeatedLettersQuery(query)) {
        clickTopLevelMenuByRepeatedLetters(items, query);
        log("Done");
        return;
      }

      clickExpandedMenuItemByQuery(items, query);
      log("Done");
    },
    processName,
    action,
    value,
  );
}

export default function buildMenuHandler(processName?: string) {
  return async function menu(action: "by-index" | "by-letters", value: string) {
    await runMenuAction(processName, action, value);
  }
}
