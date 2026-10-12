import { buildSpotifyJavaScript, type SpotifyTrackAction } from "./page";
import { runSpotifyJavaScript } from "./spotify/cdp";

export type SpotifyAction = SpotifyTrackAction | "liked-songs";

export default function buildHandler(port = 9223) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The Spotify debugging port must be an integer between 1 and 65535.");
  }
  // Menu commands must finish before the next chord changes the selected track.
  let previous: Promise<unknown> = Promise.resolve();
  return function handler(action: SpotifyAction, index?: string | number): Promise<boolean> {
    const pending = previous.then(async () => {
      if (action === "liked-songs") {
        const child = Bun.spawn(
          ["/usr/bin/open", "-b", "com.spotify.client", "spotify:collection:tracks"],
          { stdin: "ignore", stdout: "ignore", stderr: "pipe", timeout: 5000 },
        );
        const [exitCode, stderr] = await Promise.all([
          child.exited,
          new Response(child.stderr).text(),
        ]);
        if (exitCode !== 0) {
          throw new Error(stderr.trim() || `Could not open Spotify (exit ${exitCode}).`);
        }
      } else {
        const value = await runSpotifyJavaScript(buildSpotifyJavaScript(action, index), port);
        const result = JSON.parse(String(value)) as { ok: boolean; error?: string };
        if (result.ok !== true) throw new Error(result.error ?? "Spotify action failed.");
      }
      return true;
    });
    previous = pending.catch(() => undefined);
    return pending;
  };
}
