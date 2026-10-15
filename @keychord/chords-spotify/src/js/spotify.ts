import { buildSpotifyJavaScript, type SpotifyTrackAction } from "./page";
import { runSpotifyJavaScript } from "./spotify/cdp";
import { configureSpotifyDebugging } from "./spotify/app";
import type { SpotifyBarAction } from "./now-playing";
import type { SpotifyNowPlayingAction } from "./now-playing-view";

export type SpotifyAction =
  | SpotifyTrackAction
  | SpotifyBarAction
  | SpotifyNowPlayingAction
  | "LIKED_SONGS";

export default function buildHandler(port = 9223) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The Spotify debugging port must be an integer between 1 and 65535.");
  }
  let startup = configureSpotifyDebugging(port);
  // Surface setup failures through the first chord as well as Chord's runtime log.
  void startup.catch((error) => console.error("Could not enable Spotify debugging:", error));
  // Finish each command before the next chord changes the track or playback state.
  let previous: Promise<unknown> = Promise.resolve();
  return function handler(action: SpotifyAction, index?: string | number): Promise<boolean> {
    const pending = previous.then(async () => {
      const source = buildSpotifyJavaScript(action, index);
      const initializing = startup;
      startup = Promise.resolve();
      await initializing;
      const value = await runSpotifyJavaScript(source, port);
      const result = JSON.parse(String(value)) as { ok: boolean; error?: string };
      if (result.ok !== true) throw new Error(result.error ?? "Spotify action failed.");
      return true;
    });
    previous = pending.catch(() => undefined);
    return pending;
  };
}
