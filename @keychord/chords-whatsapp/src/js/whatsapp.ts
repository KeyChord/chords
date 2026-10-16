import addon from "./whatsapp.node";
import { click, getAppWindows, type WindowBounds } from "chord";

type Selector = { identifiers?: string[]; description?: string; role?: string };
type Request = {
  kind: "MENU" | "ELEMENT" | "CHAT" | "GRID" | "DEVICE" | "DISMISS_POPOVER";
  scope?: string;
  identifiers?: string[];
  titlePrefix?: string;
  description?: string;
  descriptionPrefix?: string;
  unlessIdentifier?: string;
  unlessAny?: Selector[];
  onlyIfAny?: Selector[];
  scopeParent?: boolean;
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
const infoControl = (description: string, role?: string): Request[] => [
  info,
  {
    kind: "ELEMENT",
    scope: "contact-info-view-content-stack-view",
    scopeParent: true,
    description,
    ...(role ? { role } : {}),
  },
];
const heading = (description: string): Selector => ({ description, role: "AXHeading" });
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
  CHAT_INFO_GROUP_CREATE: [
    info,
    {
      kind: "ELEMENT",
      scope: "contact-info-view-content-stack-view",
      scopeParent: true,
      descriptionPrefix: "Create group with ",
      role: "AXButton",
    },
  ],
  CHAT_INFO_GROUP_ADD: infoControl("Add to group", "AXButton"),
  CHAT_INFO_SHARE_CONTACT: [info, element("Share_Contact", "AXButton")],
  CHAT_INFO_FAVOURITE: [info, element("Contact_Info_Favorite_Action", "AXButton")],
  CHAT_INFO_EXPORT: infoControl("Export chat", "AXButton"),
  CHAT_INFO_CLEAR: infoControl("Clear chat", "AXButton"),
  CHAT_INFO_BLOCK: [
    info,
    {
      kind: "ELEMENT",
      scope: "contact-info-view-content-stack-view",
      scopeParent: true,
      descriptionPrefix: "Block ",
      role: "AXButton",
    },
  ],
  CHAT_INFO_REPORT: [
    info,
    {
      kind: "ELEMENT",
      scope: "contact-info-view-content-stack-view",
      scopeParent: true,
      descriptionPrefix: "Report ",
      role: "AXButton",
    },
  ],
  CHAT_BLOCK: { kind: "MENU", scope: chat, titlePrefix: "Block" },
  CHAT_SEARCH: menu(chat, "search_chat"),
  CHAT_VIDEO_CALL: menu(chat, "video_call"),
  CHAT_VOICE_CALL: menu(chat, "voice_call"),
  CHAT_OPEN_WINDOW: [
    {
      ...element("NavigationBar_MoreButton", "AXButton"),
      click: true,
      unlessAny: [{ description: "Open in new window", role: "AXMenuItem" }],
    },
    { kind: "ELEMENT", description: "Open in new window", role: "AXMenuItem" },
  ],
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
  VIEW_PROFILE: [
    menu("com.apple.menu.application", "settings"),
    element("SettingsView_ProfileCell", "AXButton"),
  ],
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
    if (action === "CHAT_SWITCH") {
      let position: number;
      try {
        position = positiveIndex(index, "chat index");
      } catch (error) {
        return Promise.reject(error);
      }
      request = [
        menu("com.apple.menu.application", "open_main_window"),
        menu(view, "chats"),
        { kind: "CHAT", index: position },
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
      for (const step of Array.isArray(request) ? request : [request]) {
        const resolved = await addon.perform(bundleId, JSON.stringify([step]));
        if (!resolved) continue;
        const target = JSON.parse(resolved) as {
          processId: number;
          point: { x: number; y: number };
          bounds: WindowBounds;
        };
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
      }
    });
    previous = result.catch(() => undefined);
    return result;
  };
}
