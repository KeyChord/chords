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
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region src/js/whatsapp.ts
var import__keychord_native_whatsapp = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/whatsapp/whatsapp-61e373c8961d.node", import.meta.url).href };
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
const callButton = (description) => ({
	kind: "ELEMENT",
	description,
	role: "AXButton",
	click: true
});
const reactionButtons = "ReactionsTray_ReactionButton";
const reactions = [{ kind: "DISMISS_POPOVER" }, {
	...callButton("reaction"),
	unlessIdentifier: reactionButtons
}];
function devicePath(section, index) {
	const unlessAny = [{ description: section }];
	return [
		{
			kind: "DISMISS_POPOVER",
			unlessAny
		},
		{
			...callButton(section === "Camera" ? "Video device selection" : "Audio device selection"),
			unlessAny
		},
		{
			kind: "DEVICE",
			description: section,
			index
		}
	];
}
function positiveIndex(value, label) {
	if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new TypeError(`WhatsApp ${label} must be a positive safe integer`);
	return Number(value);
}
const info = {
	...menu(chat, "contact_info", "group_info"),
	unlessIdentifier: "contact-info-view-content-stack-view"
};
const closeInfo = {
	kind: "ELEMENT",
	scope: "contact-info-view-content-stack-view",
	scopeAncestorRole: "AXWindow",
	description: "close",
	role: "AXButton",
	onlyIfAny: [{ identifiers: ["contact-info-view-content-stack-view"] }]
};
const infoRow = (request) => ({
	kind: "ELEMENT",
	scope: "contact-info-view-content-stack-view",
	scopeParent: true,
	scroll: true,
	...request
});
const infoControl = (description, role) => [info, infoRow({
	description,
	...role ? { role } : {}
})];
const infoOpen = { identifiers: ["contact-info-view-content-stack-view"] };
const searchChat = [
	{
		...menu(chat, "search_chat"),
		unlessAny: [infoOpen, {
			description: "Search",
			role: "AXTextField"
		}]
	},
	{
		...infoRow({
			description: "Search",
			role: "AXButton"
		}),
		onlyIfAny: [infoOpen]
	},
	{ kind: "SEARCH_CHAT" }
];
const heading = (description) => ({
	description,
	role: "AXHeading"
});
const participantPicker = "ParticipantPicker_TableView";
const newGroup = {
	...menu(file, "new_group"),
	unlessAny: [{ identifiers: [participantPicker] }, heading("New group")]
};
const groupControl = (request) => [info, infoRow(request)];
const actionSheet = {
	scope: "ActionSheet_TitleLabel",
	scopeAncestorRole: "AXPopover"
};
const actionSheetOpen = { identifiers: ["ActionSheet_TitleLabel"] };
const actionSheetButton = (description) => ({
	kind: "ELEMENT",
	...actionSheet,
	description,
	role: "AXButton"
});
const memberOption = (request) => ({
	kind: "ELEMENT",
	...actionSheet,
	role: "AXButton",
	missing: "Group member options (open them with igm.<number>)",
	...request
});
const blockDialog = [{
	description: "Block",
	role: "AXButton"
}, {
	description: "Block and report",
	role: "AXButton"
}];
const blocked = {
	description: "Unblock",
	role: "AXButton"
};
const blockToggle = {
	kind: "MENU",
	scope: chat,
	titlePrefixes: ["Block ", "Unblock "],
	missing: "Chat › Block (open a contact's chat)"
};
const blockButton = (description) => ({
	kind: "ELEMENT",
	scope: "ActionSheet_TitleLabel",
	scopeAncestorRoles: ["AXPopover", "AXSheet"],
	description,
	role: "AXButton",
	unlessAny: [blocked]
});
const blockContact = (description) => [
	{
		...blockToggle,
		unlessAny: [
			infoOpen,
			blocked,
			...blockDialog
		]
	},
	{
		kind: "VERIFY",
		description: "Block",
		role: "AXButton",
		unlessAny: [infoOpen, blocked]
	},
	{
		...info,
		unlessAny: [blocked, ...blockDialog]
	},
	{
		...infoRow({
			descriptionPrefix: "Block ",
			role: "AXButton"
		}),
		unlessAny: [blocked, ...blockDialog]
	},
	blockButton(description)
];
const settingsControl = (request) => [{
	...menu("com.apple.menu.application", "settings"),
	unlessIdentifier: "SettingsView_CloseButton"
}, {
	kind: "ELEMENT",
	scope: "SettingsView_CloseButton",
	scopeAncestor: 2,
	role: "AXButton",
	scroll: true,
	...request
}];
const mainWindow = {
	...menu("com.apple.menu.application", "open_main_window"),
	kind: "MAIN_WINDOW"
};
const chatFilter = (description) => [
	mainWindow,
	menu(view, "chats"),
	{
		kind: "FILTER",
		description
	},
	{
		kind: "FILTER_SELECTED",
		description
	}
];
const sidebar = (request) => [mainWindow, {
	kind: "ELEMENT",
	...request
}];
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
	CHAT_INFO_AVATAR: [info, infoRow({ identifiers: ["contact-info-header-profile-image"] })],
	CHAT_INFO_VOICE: infoControl("Audio call", "AXButton"),
	CHAT_INFO_VIDEO: infoControl("Video call", "AXButton"),
	CHAT_INFO_SEARCH: searchChat,
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
	CHAT_INFO_GROUP_CREATE: groupControl({
		descriptionPrefix: "Create group with ",
		role: "AXButton"
	}),
	CHAT_INFO_GROUP_ADD: infoControl("Add to group", "AXButton"),
	CHAT_INFO_SHARE_CONTACT: groupControl({
		identifiers: ["Share_Contact"],
		role: "AXButton"
	}),
	CHAT_INFO_FAVOURITE: groupControl({
		identifiers: ["Contact_Info_Favorite_Action"],
		role: "AXButton"
	}),
	CHAT_INFO_EXPORT: infoControl("Export chat", "AXButton"),
	CHAT_INFO_CLEAR: infoControl("Clear chat", "AXButton"),
	CHAT_INFO_BLOCK: blockContact("Block"),
	CHAT_INFO_BLOCK_REPORT: blockContact("Block and report"),
	CHAT_INFO_UNBLOCK: [
		{
			...blockToggle,
			onlyIfAny: [blocked],
			unlessAny: [infoOpen]
		},
		{
			...infoRow({
				descriptionPrefix: "Unblock ",
				role: "AXButton"
			}),
			onlyIfAny: [infoOpen],
			unlessAny: [actionSheetOpen]
		},
		{
			...actionSheetButton("Unblock"),
			onlyIfAny: [infoOpen, actionSheetOpen],
			optional: true
		}
	],
	CHAT_INFO_REPORT: groupControl({
		descriptionPrefix: "Report ",
		role: "AXButton"
	}),
	CHAT_BLOCK: [
		closeInfo,
		{
			...blockToggle,
			unlessAny: [blocked, ...blockDialog]
		},
		blockButton("Block")
	],
	CHAT_SEARCH: searchChat,
	CHAT_VIDEO_CALL: menu(chat, "video_call"),
	CHAT_VOICE_CALL: menu(chat, "voice_call"),
	CHAT_OPEN_WINDOW: { kind: "OPEN_WINDOW" },
	CHAT_NEW: menu(file, "new_chat"),
	CHAT_GROUP_CREATE: newGroup,
	CHAT_PIN: menu(chat, "pin", "unpin"),
	CHAT_ARCHIVE: menu(chat, "archive", "unarchive"),
	CHAT_MUTE: infoControl("Mute", "AXButton"),
	CHAT_MUTE_8_HOURS: menu(chat, "8_hours"),
	CHAT_MUTE_1_WEEK: menu(chat, "1_week"),
	CHAT_UNREAD: menu(chat, "mark_as_unread", "mark_as_read"),
	CHAT_PREVIOUS: [mainWindow, menu(view, "previous_chat")],
	CHAT_NEXT: [mainWindow, menu(view, "next_chat")],
	CHAT_EXPORT: menu(chat, "export_chat"),
	CHAT_CLEAR: menu(chat, "clear_chat"),
	CHAT_DELETE: menu(chat, "delete_chat"),
	VIEW_CHATS: [mainWindow, menu(view, "chats")],
	VIEW_CALLS: [mainWindow, menu(view, "calls")],
	VIEW_UPDATES: [mainWindow, menu(view, "updates")],
	VIEW_ARCHIVED: [
		mainWindow,
		menu(view, "chats"),
		element("SidebarButton_Archived")
	],
	VIEW_CHATS_ALL: chatFilter("All"),
	VIEW_CHATS_UNREAD: chatFilter("Unread"),
	VIEW_CHATS_FAVOURITES: chatFilter("Favourites"),
	VIEW_CHATS_GROUPS: chatFilter("Groups"),
	VIEW_COMMUNITIES: sidebar({ identifiers: ["SidebarButton_Communities"] }),
	VIEW_AI: sidebar({ identifiers: ["SidebarButton_MetaAI"] }),
	VIEW_MEDIA: sidebar({
		description: "Media",
		role: "AXStaticText"
	}),
	VIEW_STARRED: sidebar({ identifiers: ["SidebarButton_Starred"] }),
	VIEW_SETTINGS: menu("com.apple.menu.application", "settings"),
	VIEW_PROFILE: [menu("com.apple.menu.application", "settings"), element("SettingsView_ProfileCell", "AXButton")],
	SETTINGS_FAVOURITES: settingsControl({ identifiers: ["SettingsView_FavoritesCell"] }),
	SETTINGS_STARRED: settingsControl({ identifiers: ["SettingsView_StarredMessagesCell"] }),
	SETTINGS_HISTORY: settingsControl({ description: "Chat history" }),
	SETTINGS_ACCOUNT: settingsControl({ identifiers: ["SettingsView_AccountsCell"] }),
	SETTINGS_PRIVACY: settingsControl({ identifiers: ["SettingsView_PrivacyCell"] }),
	SETTINGS_CHATS: settingsControl({ identifiers: ["SettingsView_ChatsCell"] }),
	SETTINGS_APPEARANCE: settingsControl({ identifiers: ["SettingsView_AppearanceCell"] }),
	SETTINGS_NOTIFICATIONS: settingsControl({ identifiers: ["SettingsView_NotificationsCell"] }),
	SETTINGS_AGENTS: settingsControl({ identifiers: ["SettingsView_AgentsCell"] }),
	SETTINGS_STORAGE: settingsControl({ identifiers: ["SettingsView_DataAndStorageUsageCell"] }),
	SETTINGS_HELP: settingsControl({ identifiers: ["SettingsView_HelpCell"] }),
	GROUP_ADD: groupControl({
		description: "Add",
		role: "AXButton"
	}),
	GROUP_DESCRIPTION: groupControl({
		identifiers: ["group-description-row"],
		role: "AXButton"
	}),
	GROUP_MEMBERS: groupControl({
		descriptionSuffix: " members",
		role: "AXLink"
	}),
	GROUP_MEMBER_CHANGES: groupControl({
		identifiers: ["Group_Info_Member_Changes"],
		role: "AXButton"
	}),
	GROUP_EXIT: groupControl({
		description: "Exit group",
		role: "AXButton"
	}),
	GROUP_REPORT: groupControl({
		description: "Report group",
		role: "AXButton"
	}),
	GROUP_CREATE_SIMILAR: groupControl({
		description: "Create a similar group",
		role: "AXButton"
	}),
	GROUP_PERMISSIONS: [
		{
			...info,
			unlessAny: [heading("Group permissions"), heading("Group settings")]
		},
		{
			...infoRow({
				kind: "GROUP_PERMISSIONS",
				descriptions: ["Group permissions", "Group settings"]
			}),
			unlessAny: [heading("Group permissions"), heading("Group settings")]
		},
		{
			kind: "VERIFY",
			descriptions: ["Group permissions", "Group settings"],
			role: "AXHeading"
		}
	],
	GROUP_NOTIFY: groupControl({
		description: "Notify for",
		role: "AXButton"
	}),
	GROUP_MEMBER_INFO: memberOption({ description: "Info" }),
	GROUP_MEMBER_ADMIN: memberOption({ descriptions: ["Make group admin", "Dismiss as admin"] }),
	GROUP_MEMBER_REMOVE: [memberOption({ description: "Remove from group" }), actionSheetButton("Remove")],
	GROUP_QR: [info, element("NavigationBar_GroupInfoQRButton", "AXButton")],
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
	CALL_DECLINE: element("CallUI_DeclineButton", "AXButton"),
	CALL_ACCEPT: element("CallUI_AcceptButton", "AXButton"),
	CALL_REACTIONS: reactions,
	CALL_ADD_PEOPLE: callButton("Add people"),
	CALL_CHAT: callButton("Chat"),
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
		if (action === "CHAT_GROUP_SELECT") {
			let position;
			try {
				position = positiveIndex(index, "group member index");
			} catch (error) {
				return Promise.reject(error);
			}
			request = [newGroup, {
				kind: "PARTICIPANT",
				index: position
			}];
		} else if (action === "GROUP_MEMBER_SELECT" || action === "GROUP_MEMBER_REMOVE" && index !== void 0) {
			let position;
			try {
				position = positiveIndex(index, "group member index");
			} catch (error) {
				return Promise.reject(error);
			}
			request = [
				{
					...info,
					unlessAny: [actionSheetOpen]
				},
				{
					kind: "DISMISS_POPOVER",
					...actionSheet
				},
				infoRow({
					kind: "MEMBER",
					index: position
				}),
				...action === "GROUP_MEMBER_REMOVE" ? [memberOption({
					description: "Remove from group",
					missing: `Group member #${position}'s options`
				}), actionSheetButton("Remove")] : []
			];
		} else if (action === "CHAT_SWITCH" || action === "CHAT_INFO_AT") {
			let position;
			try {
				position = positiveIndex(index, "chat index");
			} catch (error) {
				return Promise.reject(error);
			}
			request = [
				closeInfo,
				mainWindow,
				menu(view, "chats"),
				{
					kind: "CHAT",
					index: position
				},
				...action === "CHAT_INFO_AT" ? [info] : []
			];
		} else if (index !== void 0 && (action === "VIEW_CHATS" || action === "VIEW_ARCHIVED" || action === "VIEW_CHATS_ALL" || action === "VIEW_CHATS_UNREAD" || action === "VIEW_CHATS_FAVOURITES" || action === "VIEW_CHATS_GROUPS")) {
			let position;
			try {
				position = positiveIndex(index, "chat index");
			} catch (error) {
				return Promise.reject(error);
			}
			const destination = actions[action];
			const filtered = action !== "VIEW_CHATS" && action !== "VIEW_ARCHIVED";
			request = [
				closeInfo,
				...Array.isArray(destination) ? destination : [destination],
				{
					kind: filtered ? "OPEN_CHAT" : "CHAT",
					index: position
				}
			];
		} else if (action === "CALL_CAMERA_SELECT" || action === "CALL_MICROPHONE_SELECT" || action === "CALL_SPEAKER_SELECT" || action === "CALL_REACTION_SELECT") {
			let position;
			try {
				position = positiveIndex(index, "call choice");
			} catch (error) {
				return Promise.reject(error);
			}
			request = action === "CALL_REACTION_SELECT" ? [...reactions, {
				...element(reactionButtons, "AXButton"),
				identifiers: [reactionButtons, "ReactionsTray_PlusSign"],
				scope: "Calling_Window",
				index: position,
				click: true
			}] : devicePath(action === "CALL_CAMERA_SELECT" ? "Camera" : action === "CALL_MICROPHONE_SELECT" ? "Microphone" : "Speaker", position);
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
			let steps = Array.isArray(request) ? request : [request];
			while (steps.length > 0) {
				const resolved = await import__keychord_native_whatsapp.default.perform(bundleId, JSON.stringify(steps));
				if (!resolved) break;
				const target = JSON.parse(resolved);
				if (!Number.isSafeInteger(target.next) || target.next < 1 || target.next > steps.length) throw new Error("WhatsApp's native step did not report where to resume");
				const windows = getAppWindows(bundleId).filter((window) => window.processId === target.processId && Object.keys(target.bounds).every((key) => Math.abs(window.bounds[key] - target.bounds[key]) < .5));
				if (windows.length !== 1) throw new Error("WhatsApp's target window moved or is unavailable; retry the action");
				await click({
					windowId: windows[0].windowId,
					x: target.point.x - target.bounds.x,
					y: target.point.y - target.bounds.y,
					expectedBounds: windows[0].bounds
				});
				steps = steps.slice(target.next);
			}
		});
		previous = result.catch(() => void 0);
		return result;
	};
}
//#endregion
export { buildWhatsAppHandler as default };
