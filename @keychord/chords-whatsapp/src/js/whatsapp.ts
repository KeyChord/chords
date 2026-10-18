import addon from "./whatsapp.node";
import { click, getAppWindows, type WindowBounds } from "chord";

type Selector = { identifiers?: string[]; description?: string; role?: string };
type Request = {
  kind:
    | "MENU"
    | "ELEMENT"
    | "CHAT"
    | "PARTICIPANT"
    | "MEMBER"
    | "GRID"
    | "DEVICE"
    | "DISMISS_POPOVER"
    | "GROUP_PERMISSIONS"
    | "VERIFY"
    | "FILTER"
    | "FILTER_SELECTED"
    | "OPEN_CHAT"
    | "OPEN_WINDOW"
    | "SEARCH_CHAT"
    | "MAIN_WINDOW";
  scope?: string;
  identifiers?: string[];
  titlePrefixes?: string[];
  description?: string;
  descriptions?: string[];
  descriptionPrefix?: string;
  descriptionSuffix?: string;
  unlessIdentifier?: string;
  unlessAny?: Selector[];
  onlyIfAny?: Selector[];
  scopeParent?: boolean;
  scopeAncestor?: number;
  scopeAncestorRole?: string;
  scopeAncestorRoles?: string[];
  scroll?: boolean;
  optional?: boolean;
  missing?: string;
  role?: string;
  index?: number;
  row?: number;
  column?: number;
  click?: boolean;
};

const chat = "UIMenuChatListIdentifier";
const call = "com.whatsapp.menu.call";
const view = "com.apple.menu.view";
const file = "com.apple.menu.file";
const menu = (scope: string, ...identifiers: string[]): Request => ({
  kind: "MENU",
  scope,
  identifiers,
});
const element = (identifier: string, role?: string): Request => ({
  kind: "ELEMENT",
  identifiers: [identifier],
  ...(role ? { role } : {}),
});
const callButton = (description: string): Request => ({
  kind: "ELEMENT",
  description,
  role: "AXButton",
  click: true,
});
const reactionButtons = "ReactionsTray_ReactionButton";
const reactions: Request[] = [
  { kind: "DISMISS_POPOVER" },
  { ...callButton("reaction"), unlessIdentifier: reactionButtons },
];
function devicePath(section: "Camera" | "Microphone" | "Speaker", index: number): Request[] {
  const unlessAny = [{ description: section }];
  return [
    { kind: "DISMISS_POPOVER", unlessAny },
    {
      ...callButton(section === "Camera" ? "Video device selection" : "Audio device selection"),
      unlessAny,
    },
    { kind: "DEVICE", description: section, index },
  ];
}
function positiveIndex(value: number | string | undefined, label: string): number {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new TypeError(`WhatsApp ${label} must be a positive safe integer`);
  }
  return Number(value);
}
const info: Request = {
  ...menu(chat, "contact_info", "group_info"),
  unlessIdentifier: "contact-info-view-content-stack-view",
};
// Info's close button is in a navigation bar beside the list, several groups up.
const closeInfo: Request = {
  kind: "ELEMENT",
  scope: "contact-info-view-content-stack-view",
  scopeAncestorRole: "AXWindow",
  description: "close",
  role: "AXButton",
  onlyIfAny: [{ identifiers: ["contact-info-view-content-stack-view"] }],
};
// Info is a table that exposes only its on-screen rows. The native step pages
// through it and scrolls each control into view: WhatsApp presses by tapping the
// control's activation point, which does nothing off screen.
const infoRow = (request: Partial<Request>): Request => ({
  kind: "ELEMENT",
  scope: "contact-info-view-content-stack-view",
  scopeParent: true,
  scroll: true,
  ...request,
});
const infoControl = (description: string, role?: string): Request[] => [
  info,
  infoRow({ description, ...(role ? { role } : {}) }),
];
// Chat › Search Chat opens the chat's search bar with its field focused. It toggles,
// so it is skipped when the bar is already open, and Info, which is modal, disables
// it; Info's own Search button closes Info and opens the same bar instead. Either
// way SEARCH_CHAT waits until the bar's field has focus.
const infoOpen: Selector = { identifiers: ["contact-info-view-content-stack-view"] };
const searchChat: Request[] = [
  {
    ...menu(chat, "search_chat"),
    unlessAny: [infoOpen, { description: "Search", role: "AXTextField" }],
  },
  { ...infoRow({ description: "Search", role: "AXButton" }), onlyIfAny: [infoOpen] },
  { kind: "SEARCH_CHAT" },
];
const heading = (description: string): Selector => ({ description, role: "AXHeading" });
const participantPicker = "ParticipantPicker_TableView";
const newGroup: Request = {
  ...menu(file, "new_group"),
  unlessAny: [{ identifiers: [participantPicker] }, heading("New group")],
};
const groupControl = (request: Partial<Request>): Request[] => [info, infoRow(request)];
// Member options and confirmations are action sheets: popovers whose title has
// this identifier. Its parent holds only the title, so scope to the popover.
const actionSheet = { scope: "ActionSheet_TitleLabel", scopeAncestorRole: "AXPopover" };
const actionSheetOpen: Selector = { identifiers: ["ActionSheet_TitleLabel"] };
const actionSheetButton = (description: string): Request => ({
  kind: "ELEMENT",
  ...actionSheet,
  description,
  role: "AXButton",
});
const memberOption = (request: Partial<Request>): Request => ({
  kind: "ELEMENT",
  ...actionSheet,
  role: "AXButton",
  missing: "Group member options (open them with igm.<number>)",
  ...request,
});
const blockDialog: Selector[] = [
  { description: "Block", role: "AXButton" },
  { description: "Block and report", role: "AXButton" },
];
// A blocked contact's chat replaces the composer with Delete chat and Unblock.
const blocked: Selector = { description: "Unblock", role: "AXButton" };
// Chat › Block <name> and Chat › Unblock <name> are one toggle that acts on the
// contact's current state: blocked, it unblocks at once; otherwise it opens the block
// dialog as a sheet. WhatsApp retitles it only when it rebuilds the menu, on a chat
// switch, so either title can be shown, and the chat's footer tells the state.
const blockToggle: Request = {
  kind: "MENU",
  scope: chat,
  titlePrefixes: ["Block ", "Unblock "],
  missing: "Chat › Block (open a contact's chat)",
};
// The block dialog's buttons. Chat › Block opens the dialog as a sheet, Info's Block
// row as a popover.
const blockButton = (description: "Block" | "Block and report"): Request => ({
  kind: "ELEMENT",
  scope: "ActionSheet_TitleLabel",
  scopeAncestorRoles: ["AXPopover", "AXSheet"],
  description,
  role: "AXButton",
  unlessAny: [blocked],
});
// With Info closed, the toggle opens the block dialog at once. With Info open, which
// disables the menu, Info's Block row at the end of the list opens it as a popover.
// VERIFY waits for the menu's dialog so the Info steps see it. Every step is skipped
// for a contact that is already blocked, where the toggle would unblock.
const blockContact = (description: "Block" | "Block and report"): Request[] => [
  { ...blockToggle, unlessAny: [infoOpen, blocked, ...blockDialog] },
  { kind: "VERIFY", description: "Block", role: "AXButton", unlessAny: [infoOpen, blocked] },
  { ...info, unlessAny: [blocked, ...blockDialog] },
  {
    ...infoRow({ descriptionPrefix: "Block ", role: "AXButton" }),
    unlessAny: [blocked, ...blockDialog],
  },
  blockButton(description),
];
const settingsControl = (request: Partial<Request>): Request[] => [
  {
    ...menu("com.apple.menu.application", "settings"),
    unlessIdentifier: "SettingsView_CloseButton",
  },
  {
    kind: "ELEMENT",
    scope: "SettingsView_CloseButton",
    scopeAncestor: 2,
    role: "AXButton",
    scroll: true,
    ...request,
  },
];
// Chat list and view chords act in WhatsApp's main window. With a chat open in its
// own window in front, MAIN_WINDOW presses this menu command and waits until the
// main window has focus; it does nothing when the main window already has it.
const mainWindow: Request = {
  ...menu("com.apple.menu.application", "open_main_window"),
  kind: "MAIN_WINDOW",
};
// WhatsApp applies a filter about 75 ms after its chip is pressed. FILTER presses
// the chip unless it is already selected (pressing it again deselects it), and
// FILTER_SELECTED waits until the chip is selected.
const chatFilter = (description: string): Request[] => [
  mainWindow,
  menu(view, "chats"),
  { kind: "FILTER", description },
  { kind: "FILTER_SELECTED", description },
];
const sidebar = (request: Partial<Request>): Request[] => [
  mainWindow,
  { kind: "ELEMENT", ...request },
];
const themePage = heading("Chat theme");
const bubblePage = heading("Chat bubble");
const wallpaperPage = heading("Wallpaper");
function themePath(destination?: "BUBBLE" | "WALLPAPER"): Request[] {
  const destinationPage =
    destination === "BUBBLE" ? bubblePage : destination === "WALLPAPER" ? wallpaperPage : undefined;
  return [
    { ...info, unlessAny: [themePage, bubblePage, wallpaperPage] },
    {
      kind: "ELEMENT",
      identifiers: ["BackButton"],
      onlyIfAny:
        destination === "BUBBLE"
          ? [wallpaperPage]
          : destination === "WALLPAPER"
            ? [bubblePage]
            : [bubblePage, wallpaperPage],
    },
    {
      ...infoControl("Chat theme", "AXStaticText")[1],
      unlessAny: [themePage, ...(destinationPage ? [destinationPage] : [])],
    },
    ...(destinationPage
      ? [
          {
            kind: "ELEMENT" as const,
            description: destination === "BUBBLE" ? "Chat bubble" : "Wallpaper",
            role: "AXButton",
            unlessAny: [destinationPage],
          },
        ]
      : []),
  ];
}
const actions = {
  CHAT_CLOSE: menu(chat, "close_chat"),
  CHAT_INFO: info,
  // A group's avatar is an image, a contact's a button.
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
    { kind: "ELEMENT", description: "More", role: "AXButton", click: true },
    element("reset_chat_bubble"),
  ],
  CHAT_INFO_THEME_WALLPAPER: themePath("WALLPAPER"),
  CHAT_INFO_THEME_WALLPAPER_PHOTO: [
    ...themePath("WALLPAPER"),
    { kind: "ELEMENT", description: "Choose photo", role: "AXButton" },
  ],
  CHAT_INFO_THEME_WALLPAPER_COLOUR: [
    ...themePath("WALLPAPER"),
    { kind: "ELEMENT", description: "Set a colour", role: "AXButton" },
  ],
  CHAT_INFO_SAVE_DOWNLOADS: infoControl("More options", "AXButton"),
  CHAT_INFO_DISAPPEARING_MESSAGES: infoControl("Disappearing messages", "AXStaticText"),
  CHAT_INFO_PRIVACY: infoControl("Advanced chat privacy"),
  CHAT_INFO_ENCRYPTION: infoControl("Encryption"),
  CHAT_INFO_CONTACT_DETAILS: infoControl("Contact details"),
  CHAT_INFO_GROUP_CREATE: groupControl({
    descriptionPrefix: "Create group with ",
    role: "AXButton",
  }),
  CHAT_INFO_GROUP_ADD: infoControl("Add to group", "AXButton"),
  CHAT_INFO_SHARE_CONTACT: groupControl({ identifiers: ["Share_Contact"], role: "AXButton" }),
  CHAT_INFO_FAVOURITE: groupControl({
    identifiers: ["Contact_Info_Favorite_Action"],
    role: "AXButton",
  }),
  CHAT_INFO_EXPORT: infoControl("Export chat", "AXButton"),
  CHAT_INFO_CLEAR: infoControl("Clear chat", "AXButton"),
  CHAT_INFO_BLOCK: blockContact("Block"),
  CHAT_INFO_BLOCK_REPORT: blockContact("Block and report"),
  // With Info closed, the block toggle unblocks a blocked contact at once, without a
  // confirmation. Info disables the menu, so with Info open its Unblock row asks for
  // confirmation instead, which WhatsApp sometimes skips.
  CHAT_INFO_UNBLOCK: [
    { ...blockToggle, onlyIfAny: [blocked], unlessAny: [infoOpen] },
    {
      ...infoRow({ descriptionPrefix: "Unblock ", role: "AXButton" }),
      onlyIfAny: [infoOpen],
      unlessAny: [actionSheetOpen],
    },
    // An open action sheet hides Info from accessibility.
    { ...actionSheetButton("Unblock"), onlyIfAny: [infoOpen, actionSheetOpen], optional: true },
  ],
  CHAT_INFO_REPORT: groupControl({ descriptionPrefix: "Report ", role: "AXButton" }),
  // Chat › Block, then the dialog's Block. Info disables the menu, so it is closed first.
  CHAT_BLOCK: [
    closeInfo,
    { ...blockToggle, unlessAny: [blocked, ...blockDialog] },
    blockButton("Block"),
  ],
  CHAT_SEARCH: searchChat,
  CHAT_VIDEO_CALL: menu(chat, "video_call"),
  CHAT_VOICE_CALL: menu(chat, "voice_call"),
  // WhatsApp's ⌥⌘O, since its toolbar's More menu is hidden while the chat's
  // search bar is open.
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
  VIEW_ARCHIVED: [mainWindow, menu(view, "chats"), element("SidebarButton_Archived")],
  VIEW_CHATS_ALL: chatFilter("All"),
  VIEW_CHATS_UNREAD: chatFilter("Unread"),
  VIEW_CHATS_FAVOURITES: chatFilter("Favourites"),
  VIEW_CHATS_GROUPS: chatFilter("Groups"),
  VIEW_COMMUNITIES: sidebar({ identifiers: ["SidebarButton_Communities"] }),
  VIEW_AI: sidebar({ identifiers: ["SidebarButton_MetaAI"] }),
  VIEW_MEDIA: sidebar({ description: "Media", role: "AXStaticText" }),
  VIEW_STARRED: sidebar({ identifiers: ["SidebarButton_Starred"] }),
  VIEW_SETTINGS: menu("com.apple.menu.application", "settings"),
  VIEW_PROFILE: [
    menu("com.apple.menu.application", "settings"),
    element("SettingsView_ProfileCell", "AXButton"),
  ],
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
  GROUP_ADD: groupControl({ description: "Add", role: "AXButton" }),
  GROUP_DESCRIPTION: groupControl({ identifiers: ["group-description-row"], role: "AXButton" }),
  GROUP_MEMBERS: groupControl({ descriptionSuffix: " members", role: "AXLink" }),
  GROUP_MEMBER_CHANGES: groupControl({
    identifiers: ["Group_Info_Member_Changes"],
    role: "AXButton",
  }),
  GROUP_EXIT: groupControl({ description: "Exit group", role: "AXButton" }),
  GROUP_REPORT: groupControl({ description: "Report group", role: "AXButton" }),
  GROUP_CREATE_SIMILAR: groupControl({ description: "Create a similar group", role: "AXButton" }),
  GROUP_PERMISSIONS: [
    { ...info, unlessAny: [heading("Group permissions"), heading("Group settings")] },
    {
      // WhatsApp 26.38.74 exposes this row as text while it is on screen.
      ...infoRow({
        kind: "GROUP_PERMISSIONS",
        descriptions: ["Group permissions", "Group settings"],
      }),
      unlessAny: [heading("Group permissions"), heading("Group settings")],
    },
    {
      kind: "VERIFY",
      descriptions: ["Group permissions", "Group settings"],
      role: "AXHeading",
    },
  ],
  GROUP_NOTIFY: groupControl({ description: "Notify for", role: "AXButton" }),
  GROUP_MEMBER_INFO: memberOption({ description: "Info" }),
  GROUP_MEMBER_ADMIN: memberOption({ descriptions: ["Make group admin", "Dismiss as admin"] }),
  GROUP_MEMBER_REMOVE: [
    memberOption({ description: "Remove from group" }),
    actionSheetButton("Remove"),
  ],
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
  ZOOM_RESET: menu(view, "make_text_normal_size"),
} satisfies Record<string, Request | Request[]>;

export type WhatsAppAction =
  | keyof typeof actions
  | "CHAT_SWITCH"
  | "CHAT_INFO_AT"
  | "CHAT_GROUP_SELECT"
  | "GROUP_MEMBER_SELECT"
  | "CALL_CAMERA_SELECT"
  | "CALL_MICROPHONE_SELECT"
  | "CALL_SPEAKER_SELECT"
  | "CALL_REACTION_SELECT"
  | "CHAT_INFO_THEME_BUBBLE_SELECT"
  | "CHAT_INFO_THEME_WALLPAPER_SELECT";

export default function buildWhatsAppHandler(bundleId = "net.whatsapp.WhatsApp") {
  let previous: Promise<unknown> = Promise.resolve();
  return function whatsapp(action: WhatsAppAction, index?: number | string): Promise<void> {
    let request: Request | Request[];
    if (action === "CHAT_GROUP_SELECT") {
      let position: number;
      try {
        position = positiveIndex(index, "group member index");
      } catch (error) {
        return Promise.reject(error);
      }
      request = [newGroup, { kind: "PARTICIPANT", index: position }];
    } else if (
      action === "GROUP_MEMBER_SELECT" ||
      (action === "GROUP_MEMBER_REMOVE" && index !== undefined)
    ) {
      let position: number;
      try {
        position = positiveIndex(index, "group member index");
      } catch (error) {
        return Promise.reject(error);
      }
      // An open action sheet hides Group Info from accessibility; close it instead
      // of reopening Info, then press the numbered member to show its options. A
      // numbered removal then removes that member and confirms.
      request = [
        { ...info, unlessAny: [actionSheetOpen] },
        { kind: "DISMISS_POPOVER", ...actionSheet },
        infoRow({ kind: "MEMBER", index: position }),
        ...(action === "GROUP_MEMBER_REMOVE"
          ? [
              memberOption({
                description: "Remove from group",
                missing: `Group member #${position}'s options`,
              }),
              actionSheetButton("Remove"),
            ]
          : []),
      ];
    } else if (action === "CHAT_SWITCH" || action === "CHAT_INFO_AT") {
      let position: number;
      try {
        position = positiveIndex(index, "chat index");
      } catch (error) {
        return Promise.reject(error);
      }
      request = [
        closeInfo,
        mainWindow,
        menu(view, "chats"),
        { kind: "CHAT", index: position },
        ...(action === "CHAT_INFO_AT" ? [info] : []),
      ];
    } else if (
      index !== undefined &&
      (action === "VIEW_CHATS" ||
        action === "VIEW_ARCHIVED" ||
        action === "VIEW_CHATS_ALL" ||
        action === "VIEW_CHATS_UNREAD" ||
        action === "VIEW_CHATS_FAVOURITES" ||
        action === "VIEW_CHATS_GROUPS")
    ) {
      let position: number;
      try {
        position = positiveIndex(index, "chat index");
      } catch (error) {
        return Promise.reject(error);
      }
      const destination = actions[action];
      const filtered = action !== "VIEW_CHATS" && action !== "VIEW_ARCHIVED";
      request = [
        closeInfo,
        // Each destination brings the main window forward first.
        ...(Array.isArray(destination) ? destination : [destination]),
        // WhatsApp ignores row taps while a filter reload animates, and exposes the
        // new rows only after layout. OPEN_CHAT selects the position from WhatsApp's
        // filtered list with its chat shortcuts instead.
        { kind: filtered ? "OPEN_CHAT" : "CHAT", index: position },
      ];
    } else if (
      action === "CALL_CAMERA_SELECT" ||
      action === "CALL_MICROPHONE_SELECT" ||
      action === "CALL_SPEAKER_SELECT" ||
      action === "CALL_REACTION_SELECT"
    ) {
      let position: number;
      try {
        position = positiveIndex(index, "call choice");
      } catch (error) {
        return Promise.reject(error);
      }
      request =
        action === "CALL_REACTION_SELECT"
          ? [
              ...reactions,
              {
                ...element(reactionButtons, "AXButton"),
                identifiers: [reactionButtons, "ReactionsTray_PlusSign"],
                scope: "Calling_Window",
                index: position,
                click: true,
              },
            ]
          : devicePath(
              action === "CALL_CAMERA_SELECT"
                ? "Camera"
                : action === "CALL_MICROPHONE_SELECT"
                  ? "Microphone"
                  : "Speaker",
              position,
            );
    } else if (
      action === "CHAT_INFO_THEME_BUBBLE_SELECT" ||
      action === "CHAT_INFO_THEME_WALLPAPER_SELECT"
    ) {
      const coordinates = /^([1-9]),?([1-9])$/.exec(String(index));
      if (!coordinates)
        return Promise.reject(new TypeError("WhatsApp palette position must be row,column (1–9)"));
      const bubble = action === "CHAT_INFO_THEME_BUBBLE_SELECT";
      request = [
        ...themePath(bubble ? "BUBBLE" : "WALLPAPER"),
        {
          kind: "GRID",
          description: bubble ? "Chat bubble" : "Wallpaper",
          row: Number(coordinates[1]),
          column: Number(coordinates[2]),
        },
      ];
    } else if (Object.hasOwn(actions, action)) request = actions[action];
    else return Promise.reject(new TypeError(`Unknown WhatsApp action: ${action}`));

    // As in the Spotify and Dock handlers, complete each action before starting
    // the next one, including activation and multi-step accessibility work.
    const result = previous.then(async () => {
      // One native call runs the steps, so WhatsApp is activated once and a step can
      // reuse the accessibility tree read by the step before it. A step that needs a
      // window-targeted click returns it with the step to resume from.
      let steps = Array.isArray(request) ? request : [request];
      while (steps.length > 0) {
        const resolved = await addon.perform(bundleId, JSON.stringify(steps));
        if (!resolved) break;
        const target = JSON.parse(resolved) as {
          processId: number;
          next: number;
          point: { x: number; y: number };
          bounds: WindowBounds;
        };
        if (!Number.isSafeInteger(target.next) || target.next < 1 || target.next > steps.length)
          throw new Error("WhatsApp's native step did not report where to resume");
        const windows = getAppWindows(bundleId).filter(
          (window) =>
            window.processId === target.processId &&
            (Object.keys(target.bounds) as (keyof WindowBounds)[]).every(
              (key) => Math.abs(window.bounds[key] - target.bounds[key]) < 0.5,
            ),
        );
        if (windows.length !== 1)
          throw new Error("WhatsApp's target window moved or is unavailable; retry the action");
        await click({
          windowId: windows[0].windowId,
          x: target.point.x - target.bounds.x,
          y: target.point.y - target.bounds.y,
          expectedBounds: windows[0].bounds,
        });
        steps = steps.slice(target.next);
      }
    });
    previous = result.catch(() => undefined);
    return result;
  };
}
