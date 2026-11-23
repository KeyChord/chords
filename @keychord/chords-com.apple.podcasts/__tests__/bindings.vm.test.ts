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

const podcasts = "com.apple.podcasts";
const name = "Chordtest Podcast";
const episodeTitle = "Chordtest Episode";
const command = 1 << 20;

async function startFeed() {
  const episode = Bun.file(new URL("./episode.mp3", import.meta.url));
  const length = (await episode.stat()).size;
  let feedRequests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/episode.mp3") {
        const headers = new Headers({ "Accept-Ranges": "bytes", "Content-Type": "audio/mpeg" });
        const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get("range") ?? "");
        if (range) {
          const start = Number(range[1]);
          const end = Math.min(range[2] ? Number(range[2]) : length - 1, length - 1);
          if (start > end) {
            headers.set("Content-Range", "bytes */" + length);
            return new Response(null, { status: 416, headers });
          }
          headers.set("Content-Range", "bytes " + start + "-" + end + "/" + length);
          headers.set("Content-Length", String(end - start + 1));
          return new Response(request.method === "HEAD" ? null : episode.slice(start, end + 1), {
            status: 206,
            headers,
          });
        }
        headers.set("Content-Length", String(length));
        return new Response(request.method === "HEAD" ? null : episode, { headers });
      }
      if (url.pathname !== "/feed.xml") return new Response(null, { status: 404 });
      feedRequests += 1;
      const feed = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
        "<channel><title>" + name + "</title><link>" + url.origin + "</link>",
        "<description>Local audio for Chord tests</description><language>en</language>",
        "<itunes:author>KeyChord</itunes:author><item><title>" + episodeTitle + "</title>",
        "<description>Local test episode</description><guid>keychord-podcast-fixture-v1</guid>",
        "<pubDate>" + new Date().toUTCString() + "</pubDate>",
        '<enclosure type="audio/mpeg" length="' +
          length +
          '" url="' +
          url.origin +
          '/episode.mp3"/>',
        "<itunes:duration>135</itunes:duration></item></channel></rss>",
      ].join("");
      return new Response(feed, {
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/rss+xml",
        },
      });
    },
  });
  return { server, url: new URL("/feed.xml", server.url).href, requests: () => feedRequests };
}

function podcastScenario(
  app: ChordApp,
  probe: MacOSProbe,
  feed: Awaited<ReturnType<typeof startFeed>>,
) {
  const nodes = async () => flattenAX(await probe.windows(podcasts, 10));
  const menu = (...path: string[]) => probe.menu(podcasts, ...path);
  const show = (match: RegExp, role?: string) =>
    waitFor(
      async () =>
        (await nodes()).find((node) => (!role || node.role === role) && match.test(label(node))),
      16_000,
    );
  const escape = () => probe.key(53);
  const press = async (match: RegExp) => {
    const node = await show(match, "AXButton");
    await probe.pressControl(
      podcasts,
      "AXButton",
      node.title ?? node.description ?? String(node.value),
    );
  };
  const settings = async () => {
    await app.runChecked("a,");
    try {
      await show(/^General(?: |$)/);
      await show(/^Playback(?: |$)/);
    } finally {
      await probe.key(13, command);
    }
  };
  const search = async () => {
    await app.runChecked("g/");
    try {
      await waitFor(async () => {
        const focus = await probe.focus(podcasts);
        return focus.subrole === "AXSearchField" ||
          (focus.role === "AXTextField" && /search|shows, episodes/i.test(label(focus)))
          ? focus
          : undefined;
      });
    } finally {
      await escape();
    }
  };
  const station = async () => {
    await app.runChecked("ns");
    try {
      await show(/Station Name|New Station|Create Station/);
      await show(/^Cancel(?: |$)/, "AXButton");
      await waitFor(async () => {
        const focus = await probe.focus(podcasts);
        return focus.role === "AXTextField" ? focus : undefined;
      });
    } finally {
      await escape();
    }
  };
  const follow = async () => {
    await app.runChecked("nf");
    try {
      await show(/follow a show by url|follow a show by url|feed url/i);
      await waitFor(async () => {
        const focus = await probe.focus(podcasts);
        return focus.role === "AXTextField" ? focus : undefined;
      });
      const pasteboard = Bun.spawn(["/usr/bin/pbcopy"], { stdin: feed.url, timeout: 5_000 });
      expect(await pasteboard.exited).toBe(0);
      await probe.key(9, command);
      await press(/^Follow(?: |$)/);
      await waitFor(async () => (feed.requests() ? true : undefined), 20_000);
      await show(/^Chordtest Podcast\b/);
    } finally {
      await escape();
    }
  };
  const refresh = async () => {
    const before = feed.requests();
    await app.runChecked("fr");
    await waitFor(async () => (feed.requests() > before ? true : undefined), 20_000);
  };
  const play = async () => {
    const episode = await show(/^Chordtest Episode\b/);
    expect(episode.position && episode.size).toBeDefined();
    await probe.clickPoint(
      episode.position![0] + episode.size![0] / 2,
      episode.position![1] + episode.size![1] / 2,
    );
    await waitFor(async () => ((await menu("Controls", "Play")).enabled ? true : undefined));
    await app.runChecked("pp");
    await show(/^Pause(?: |$)/, "AXButton");
  };
  const pause = async () => {
    await show(/^Pause(?: |$)/, "AXButton");
    await app.runChecked("ph");
    await waitFor(async () =>
      (await nodes()).some((node) => node.role === "AXButton" && /^Pause(?: |$)/.test(label(node)))
        ? undefined
        : true,
    );
    await show(/^Play(?: |$)/, "AXButton");
  };
  const elapsed = async () => {
    const seek = (await nodes()).find(
      (node) =>
        node.role === "AXSlider" && /elapsed|position|time|progress|scrub/i.test(label(node)),
    );
    if (!seek) return;
    if (typeof seek.value === "number") return seek.value;
    const match = /^(\d+):(\d{2})\b/.exec(String(seek.value));
    if (match) return 60 * Number(match[1]) + Number(match[2]);
  };
  const skip = async (key: string, direction: number) => {
    const before = await waitFor(elapsed);
    await app.runChecked(key);
    await waitFor(async () => {
      const after = await elapsed();
      return after !== undefined && direction * (after - before) > 0 ? true : undefined;
    });
  };
  const gotoShow = async () => {
    const showTitle = async () =>
      (await nodes()).find(
        (node) =>
          node.role === "AXHeading" && [node.title, node.description, node.value].includes(name),
      );
    const home = await show(/^Home(?: |$)/);
    expect(home.position && home.size).toBeDefined();
    await probe.clickPoint(
      home.position![0] + home.size![0] / 2,
      home.position![1] + home.size![1] / 2,
    );
    await waitFor(async () => ((await showTitle()) ? undefined : true));
    await app.runChecked("pg");
    await waitFor(showTitle);
    await show(/^Chordtest Episode\b/);
  };
  return { settings, search, station, follow, refresh, play, pause, skip, gotoShow };
}

type Scenario = ReturnType<typeof podcastScenario>;
const cases: Record<string, (scenario: Scenario) => Promise<void>> = {
  "a,": ({ settings }) => settings(),
  "g/": ({ search }) => search(),
  ns: ({ station }) => station(),
  nf: ({ follow }) => follow(),
  fr: ({ refresh }) => refresh(),
  pp: ({ play }) => play(),
  ph: ({ pause }) => pause(),
  pf: ({ skip }) => skip("pf", 1),
  pk: ({ skip }) => skip("pk", -1),
  pg: ({ gotoShow }) => gotoShow(),
};

test("every Podcasts binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/podcasts/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Podcasts chords change the native app",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
        console.log("guest macOS", guestVersion);
        expect(guestVersion).toMatch(/^27\./);

        const feed = await startFeed();
        try {
          await probe.activate(podcasts);
          await waitFor(async () => {
            const button = flattenAX(await probe.windows(podcasts, 10)).find(
              (node) =>
                node.role === "AXButton" &&
                [node.title, node.description].some((text) =>
                  ["Continue", "Get Started"].includes(text ?? ""),
                ),
            );
            if (button) {
              await probe.pressControl(podcasts, "AXButton", button.title ?? button.description!);
              return;
            }
            return flattenAX(await probe.windows(podcasts, 8)).some((node) =>
              [node.title, node.description, node.value].includes("Home"),
            )
              ? true
              : undefined;
          }, 25_000);
          const scenario = podcastScenario(app, probe, feed);
          for (const [key, verify] of Object.entries(cases)) {
            try {
              await verify(scenario);
            } catch (cause) {
              throw new Error("Podcasts " + key + " did not reach its expected state", { cause });
            }
          }
        } finally {
          feed.server.stop(true);
          await probe.key(53);
        }
      }),
    ),
  300_000,
);
