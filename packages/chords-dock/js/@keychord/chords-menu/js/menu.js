import { run } from "jxa-run-compat";
//#region src/js/menu.ts
const runMenuAction = (action, value) => run((actionArg, valueArg) => {
	const log = (...args) => console.log("[JXA]", ...args);
	const normalize = (s) => String(s).replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, "").trim().toLowerCase();
	const assertExists = (obj, label) => {
		if (!obj) throw new Error(`Failed at: ${label}`);
		return obj;
	};
	const safeCall = (fn, fallback) => {
		try {
			return fn();
		} catch {
			return fallback;
		}
	};
	const getName = (item) => normalize(safeCall(() => item.name(), ""));
	const getMenuBarItems = (menuBar) => {
		const items = safeCall(() => menuBar.menuBarItems(), []);
		return Array.from({ length: items.length }, (_, i) => items[i]);
	};
	const isRepeatedLettersQuery = (query) => {
		if (!/^[a-z]+$/.test(query)) return false;
		const first = query[0];
		return [...query].every((ch) => ch === first);
	};
	const parseExpandedItemQuery = (query) => {
		const m = query.match(/^([a-z-]+?)(\d+)?$/);
		if (!m) throw new Error(`Invalid menu query "${query}". Expected lowercase letters/hyphens with optional trailing number.`);
		const pattern = m[1];
		const ordinal = m[2] ? Number(m[2]) : 1;
		if (!pattern) throw new Error(`Missing pattern in "${query}"`);
		if (!Number.isInteger(ordinal) || ordinal < 1) throw new Error(`Invalid trailing number in "${query}"`);
		return {
			pattern,
			occurrence: ordinal
		};
	};
	const matchesWordAbbreviation = (name, pattern) => {
		const words = name.split(/[\s]+/).filter(Boolean);
		const parts = pattern.split("-").filter(Boolean);
		if (parts.length === 0) return false;
		if (parts.length > words.length) return false;
		for (let i = 0; i < parts.length; i++) if (!words[i] || !words[i].startsWith(parts[i])) return false;
		return true;
	};
	const matchesExpandedPattern = (name, pattern) => {
		if (pattern.includes("-")) return matchesWordAbbreviation(name, pattern);
		return name.startsWith(pattern);
	};
	const isMenuItemEnabled = (item) => safeCall(() => item.enabled(), true);
	const isSeparatorLike = (item) => {
		if (getName(item)) return false;
		return normalize(safeCall(() => item.roleDescription(), "")).includes("separator");
	};
	const collectMenuItemsDepthFirst = (menu) => {
		const out = [];
		const walkMenu = (menuRef) => {
			const items = safeCall(() => menuRef.menuItems(), []);
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (!item) continue;
				if (!isSeparatorLike(item)) out.push(item);
				const submenus = safeCall(() => item.menus(), []);
				if (submenus.length > 0 && submenus[0]) walkMenu(submenus[0]);
			}
		};
		walkMenu(menu);
		return out;
	};
	const getSelectedTopLevelMenu = (menuBarItems) => {
		for (const item of menuBarItems) {
			if (!safeCall(() => item.selected(), false)) continue;
			const menus = safeCall(() => item.menus(), []);
			if (menus.length > 0 && menus[0]) return {
				menuBarItem: item,
				menu: menus[0]
			};
		}
		return null;
	};
	const clickTopLevelMenuByIndex = (items, oneBasedIndex) => {
		if (!Number.isInteger(oneBasedIndex) || oneBasedIndex < 1) throw new Error(`Expected menuIndex to be a positive integer, got: ${oneBasedIndex}`);
		const zeroBasedIndex = oneBasedIndex - 1;
		if (zeroBasedIndex >= items.length) throw new Error(`menuIndex ${oneBasedIndex} out of range; found ${items.length} menu bar items`);
		const item = assertExists(items[zeroBasedIndex], `menuBarItems[${zeroBasedIndex}]`);
		log(`Clicking top-level menu #${oneBasedIndex}:`, safeCall(() => item.name(), "<unknown>"));
		item.click();
	};
	const clickTopLevelMenuByRepeatedLetters = (items, query) => {
		const prefix = query[0];
		const occurrence = query.length;
		const matches = items.filter((item) => getName(item).startsWith(prefix));
		log(`Top-level repeated-letter query "${query}" -> prefix "${prefix}", occurrence ${occurrence}`);
		log("Top-level matches:", matches.map((item) => safeCall(() => item.name(), "<unknown>")));
		if (matches.length < occurrence) throw new Error(`No top-level menu match #${occurrence} for prefix "${prefix}". Found ${matches.length}.`);
		const item = matches[occurrence - 1];
		log(`Clicking top-level menu:`, safeCall(() => item.name(), "<unknown>"));
		item.click();
	};
	const clickExpandedMenuItemByQuery = (items, query) => {
		const selected = getSelectedTopLevelMenu(items);
		if (!selected) throw new Error(`Query "${query}" targets expanded menu items, but no top-level menu appears to be expanded.`);
		const { pattern, occurrence } = parseExpandedItemQuery(query);
		log(`Expanded menu context: "${safeCall(() => selected.menuBarItem.name(), "<unknown>")}"`);
		log(`Expanded-item query "${query}" -> pattern "${pattern}", occurrence ${occurrence}`);
		const candidates = collectMenuItemsDepthFirst(selected.menu).filter((item) => {
			if (!isMenuItemEnabled(item)) return false;
			const name = getName(item);
			if (!name) return false;
			return matchesExpandedPattern(name, pattern);
		});
		log("Expanded matches:", candidates.map((item) => safeCall(() => item.name(), "<unknown>")));
		if (candidates.length < occurrence) throw new Error(`No expanded menu item match #${occurrence} for pattern "${pattern}". Found ${candidates.length}.`);
		const item = candidates[occurrence - 1];
		log(`Clicking expanded menu item:`, safeCall(() => item.name(), "<unknown>"));
		item.click();
	};
	const proc = assertExists(Application("System Events").processes.whose({ frontmost: true })[0], "frontmost process");
	log("Frontmost process:", safeCall(() => proc.name(), "<unknown>"));
	const items = getMenuBarItems(assertExists(proc.menuBars[0], "menuBars[0]"));
	if (actionArg === "by-index") {
		clickTopLevelMenuByIndex(items, Number(valueArg));
		log("Done");
		return;
	}
	const query = normalize(String(valueArg));
	if (!query) throw new Error("Expected a non-empty lowercase query");
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
}, action, value);
function menu(action, value) {
	runMenuAction(action, value);
}
//#endregion
export { menu as default };
