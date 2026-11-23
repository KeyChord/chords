import addon from "./menu.node";

type MediaKey = "BRIGHTNESS_UP" | "BRIGHTNESS_DOWN" | "VOLUME_UP" | "VOLUME_DOWN" | "VOLUME_MUTE";

export default function buildMediaKeyHandler() {
  return function media(key: MediaKey): Promise<void> {
    return addon.pressMediaKey(key);
  };
}
