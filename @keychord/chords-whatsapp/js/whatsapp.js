import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { click, getAppWindows } from "chord";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region src/js/whatsapp.ts
var import__keychord_native_whatsapp = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/whatsapp/whatsapp-2fedddd301a1.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] whatsapp has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
const chat = "UIMenuChatListIdentifier";
const call = "com.whatsapp.menu.call";
const view = "com.apple.menu.view";
const file = "com.apple.menu.file";
const menu = (scope, ...identifiers) => ({
	kind: "MENU",
	scope,
	identifiers
});
const element = (identifier, role) => ({
	kind: "ELEMENT",
	identifiers: [identifier],
	...role ? { role } : {}
});
const info = {
	...menu(chat, "contact_info", "group_info"),
	unlessIdentifier: "contact-info-view-content-stack-view"
};
const infoControl = (description, role) => [info, {
	kind: "ELEMENT",
	scope: "contact-info-view-content-stack-view",
	scopeParent: true,
	description,
	...role ? { role } : {}
}];
const heading = (description) => ({
	description,
	role: "AXHeading"
});
const themePage = heading("Chat theme");
const bubblePage = heading("Chat bubble");
const wallpaperPage = heading("Wallpaper");
function themePath(destination) {
	const destinationPage = destination === "BUBBLE" ? bubblePage : destination === "WALLPAPER" ? wallpaperPage : void 0;
	return [
		{
			...info,
			unlessAny: [
				themePage,
				bubblePage,
				wallpaperPage
			]
		},
		{
			kind: "ELEMENT",
			identifiers: ["BackButton"],
			onlyIfAny: destination === "BUBBLE" ? [wallpaperPage] : destination === "WALLPAPER" ? [bubblePage] : [bubblePage, wallpaperPage]
		},
		{
			...infoControl("Chat theme", "AXStaticText")[1],
			unlessAny: [themePage, ...destinationPage ? [destinationPage] : []]
		},
		...destinationPage ? [{
			kind: "ELEMENT",
			description: destination === "BUBBLE" ? "Chat bubble" : "Wallpaper",
			role: "AXButton",
			unlessAny: [destinationPage]
		}] : []
	];
}
const actions = {
	CHAT_CLOSE: menu(chat, "close_chat"),
	CHAT_INFO: info,
	CHAT_INFO_AVATAR: [info, element("contact-info-header-profile-image", "AXButton")],
	CHAT_INFO_VOICE: infoControl("Audio call", "AXButton"),
	CHAT_INFO_VIDEO: infoControl("Video call", "AXButton"),
	CHAT_INFO_SEARCH: infoControl("Search", "AXButton"),
	CHAT_INFO_GALLERY: infoControl("Media, links and docs", "AXStaticText"),
	CHAT_INFO_STARRED: infoControl("Starred", "AXStaticText"),
	CHAT_INFO_MUTE_STATUS: infoControl("Mute status notifications", "AXButton"),
	CHAT_INFO_THEME: themePath(),
	CHAT_INFO_THEME_BUBBLE: themePath("BUBBLE"),
	CHAT_INFO_THEME_BUBBLE_RESET: [
		...themePath("BUBBLE"),
		{
			kind: "ELEMENT",
			description: "More",
			role: "AXButton",
			click: true
		},
		element("reset_chat_bubble")
	],
	CHAT_INFO_THEME_WALLPAPER: themePath("WALLPAPER"),
	CHAT_INFO_THEME_WALLPAPER_PHOTO: [...themePath("WALLPAPER"), {
		kind: "ELEMENT",
		description: "Choose photo",
		role: "AXButton"
	}],
	CHAT_INFO_THEME_WALLPAPER_COLOUR: [...themePath("WALLPAPER"), {
		kind: "ELEMENT",
		description: "Set a colour",
		role: "AXButton"
	}],
	CHAT_INFO_SAVE_DOWNLOADS: infoControl("More options", "AXButton"),
	CHAT_INFO_DISAPPEARING_MESSAGES: infoControl("Disappearing messages", "AXStaticText"),
	CHAT_INFO_PRIVACY: infoControl("Advanced chat privacy"),
	CHAT_INFO_ENCRYPTION: infoControl("Encryption"),
	CHAT_INFO_CONTACT_DETAILS: infoControl("Contact details"),
	CHAT_INFO_GROUP_CREATE: [info, {
		kind: "ELEMENT",
		scope: "contact-info-view-content-stack-view",
		scopeParent: true,
		descriptionPrefix: "Create group with ",
		role: "AXButton"
	}],
	CHAT_INFO_GROUP_ADD: infoControl("Add to group", "AXButton"),
	CHAT_INFO_SHARE_CONTACT: [info, element("Share_Contact", "AXButton")],
	CHAT_INFO_FAVOURITE: [info, element("Contact_Info_Favorite_Action", "AXButton")],
	CHAT_INFO_EXPORT: infoControl("Export chat", "AXButton"),
	CHAT_INFO_CLEAR: infoControl("Clear chat", "AXButton"),
	CHAT_INFO_BLOCK: [info, {
		kind: "ELEMENT",
		scope: "contact-info-view-content-stack-view",
		scopeParent: true,
		descriptionPrefix: "Block ",
		role: "AXButton"
	}],
	CHAT_INFO_REPORT: [info, {
		kind: "ELEMENT",
		scope: "contact-info-view-content-stack-view",
		scopeParent: true,
		descriptionPrefix: "Report ",
		role: "AXButton"
	}],
	CHAT_BLOCK: {
		kind: "MENU",
		scope: chat,
		titlePrefix: "Block"
	},
	CHAT_SEARCH: menu(chat, "search_chat"),
	CHAT_VIDEO_CALL: menu(chat, "video_call"),
	CHAT_VOICE_CALL: menu(chat, "voice_call"),
	CHAT_NEW: menu(file, "new_chat"),
	CHAT_PIN: menu(chat, "pin", "unpin"),
	CHAT_ARCHIVE: menu(chat, "archive", "unarchive"),
	CHAT_MUTE: infoControl("Mute", "AXButton"),
	CHAT_MUTE_8_HOURS: menu(chat, "8_hours"),
	CHAT_MUTE_1_WEEK: menu(chat, "1_week"),
	CHAT_UNREAD: menu(chat, "mark_as_unread", "mark_as_read"),
	CHAT_PREVIOUS: menu(view, "previous_chat"),
	CHAT_NEXT: menu(view, "next_chat"),
	CHAT_EXPORT: menu(chat, "export_chat"),
	CHAT_CLEAR: menu(chat, "clear_chat"),
	CHAT_DELETE: menu(chat, "delete_chat"),
	VIEW_CHATS: menu(view, "chats"),
	VIEW_CALLS: menu(view, "calls"),
	VIEW_UPDATES: menu(view, "updates"),
	VIEW_ARCHIVED: element("SidebarButton_Archived"),
	VIEW_STARRED: element("SidebarButton_Starred"),
	VIEW_SETTINGS: menu("com.apple.menu.application", "settings"),
	VIEW_PROFILE: [menu("com.apple.menu.application", "settings"), element("SettingsView_ProfileCell", "AXButton")],
	CALL_NEW: menu(file, "new_call..."),
	CALL_NEW_GROUP: menu(file, "new_group_call"),
	CALL_LINK: menu(file, "new_call_link"),
	CALL_CAMERA: menu(call, "turn_off_camera", "turn_on_camera"),
	CALL_MICROPHONE: menu(call, "mute_microphone", "unmute_microphone"),
	CALL_REACT: menu(call, "react"),
	CALL_HAND: menu(call, "raise_hand", "lower_hand"),
	CALL_SCREEN_SHARE: menu(call, "start_screen_sharing", "stop_screen_sharing"),
	CALL_PARTICIPANTS: menu(call, "show_participants", "hide_participants"),
	CALL_END: menu(call, "end_call"),
	CALL_ALWAYS_ON_TOP: menu(call, "always_on_top"),
	INPUT_EMOJI: menu(chat, "send_emoji"),
	INPUT_GIF: menu(chat, "send_gifs"),
	INPUT_STICKER: menu(chat, "send_stickers"),
	ZOOM_IN: menu(view, "make_text_bigger"),
	ZOOM_OUT: menu(view, "make_text_smaller"),
	ZOOM_RESET: menu(view, "make_text_normal_size")
};
function buildWhatsAppHandler(bundleId = "net.whatsapp.WhatsApp") {
	let previous = Promise.resolve();
	return function whatsapp(action, index) {
		let request;
		if (action === "CHAT_SWITCH") {
			if (!/^[1-9]$/.test(String(index))) return Promise.reject(/* @__PURE__ */ new TypeError("WhatsApp chat index must be between 1 and 9"));
			request = [
				menu("com.apple.menu.application", "open_main_window"),
				menu(view, "chats"),
				{
					kind: "CHAT",
					index: Number(index)
				}
			];
		} else if (action === "CHAT_INFO_THEME_BUBBLE_SELECT" || action === "CHAT_INFO_THEME_WALLPAPER_SELECT") {
			const coordinates = /^([1-9]),?([1-9])$/.exec(String(index));
			if (!coordinates) return Promise.reject(/* @__PURE__ */ new TypeError("WhatsApp palette position must be row,column (1–9)"));
			const bubble = action === "CHAT_INFO_THEME_BUBBLE_SELECT";
			request = [...themePath(bubble ? "BUBBLE" : "WALLPAPER"), {
				kind: "GRID",
				description: bubble ? "Chat bubble" : "Wallpaper",
				row: Number(coordinates[1]),
				column: Number(coordinates[2])
			}];
		} else if (Object.hasOwn(actions, action)) request = actions[action];
		else return Promise.reject(/* @__PURE__ */ new TypeError(`Unknown WhatsApp action: ${action}`));
		const result = previous.then(async () => {
			for (const step of Array.isArray(request) ? request : [request]) {
				const resolved = await import__keychord_native_whatsapp.default.perform(bundleId, JSON.stringify([step]));
				if (!resolved) continue;
				const target = JSON.parse(resolved);
				const windows = getAppWindows(bundleId).filter((window) => window.processId === target.processId && Object.keys(target.bounds).every((key) => Math.abs(window.bounds[key] - target.bounds[key]) < .5));
				if (windows.length !== 1) throw new Error("WhatsApp's target window moved or is unavailable; retry the action");
				await click({
					windowId: windows[0].windowId,
					x: target.point.x - target.bounds.x,
					y: target.point.y - target.bounds.y,
					expectedBounds: windows[0].bounds
				});
			}
		});
		previous = result.catch(() => void 0);
		return result;
	};
}
//#endregion
export { buildWhatsAppHandler as default };
