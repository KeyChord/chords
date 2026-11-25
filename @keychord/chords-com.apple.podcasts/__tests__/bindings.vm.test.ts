import { expect, test } from "bun:test";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
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

async function dismissIntro(probe: MacOSProbe) {
  const sheet = await probe.window(podcasts, 10);
  if (sheet.role !== "AXSheet") return false;
  const button = flattenAX([sheet]).find(
    (node) =>
      node.role === "AXButton" &&
      node.id === "amsui.onboarding.primaryButton" &&
      [node.title, node.description].includes("Continue") &&
      node.enabled !== false,
  );
  if (!button?.position || !button.size) return false;
  const [x, y] = button.position;
  const [width, height] = button.size;
  await probe.clickPoint(x + width / 2, y + height / 2);
  return true;
}

async function startFeed() {
  const episode = Bun.file(new URL("./episode.mp3", import.meta.url));
  const length = (await episode.stat()).size;
  let feedRequests = 0;
  let audioRequests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/") return new Response(name);
      if (url.pathname === "/episode.mp3") {
        if (request.method === "GET") audioRequests += 1;
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
        "<itunes:author>KeyChord</itunes:author><itunes:explicit>false</itunes:explicit>",
        "<item><title>" + episodeTitle + "</title>",
        '<description>Local test episode</description><guid isPermaLink="false">keychord-podcast-fixture-v1</guid>',
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
  return {
    server,
    url: new URL("/feed.xml", server.url).href,
    requests: () => feedRequests,
    audioRequests: () => audioRequests,
  };
}

function podcastScenario(
  app: ChordApp,
  probe: MacOSProbe,
  feed: Awaited<ReturnType<typeof startFeed>>,
) {
  const nodes = async () => {
    const current = await probe.window(podcasts, 10);
    const windows = await probe.windows(podcasts, 10);
    const controls = flattenAX([current, ...windows]);
    if (controls.some((node) => node.role !== "AXWindow")) return controls;
    // Storefront scenes can return their window without exposing its controls.
    return flattenAX([await probe.tree(podcasts, 12)]);
  };
  const menu = (...path: string[]) => probe.menu(podcasts, ...path);
  const show = (match: RegExp, role?: string) =>
    waitFor(
      async () =>
        (await nodes()).find((node) => (!role || node.role === role) && match.test(label(node))),
      16_000,
    );
  const escape = () => probe.key(53);
  const notificationPrompt = async () => {
    const sheet = await probe.window(podcasts, 10);
    if (sheet.role !== "AXSheet") return;
    const controls = flattenAX([sheet]);
    if (!controls.some((node) => label(node) === "Get Notified About New Episodes")) return;
    return controls.find(
      (node) =>
        node.role === "AXButton" &&
        node.id === "secondaryButton" &&
        label(node) === "Not Now" &&
        node.enabled !== false &&
        node.position &&
        node.size?.every((dimension) => dimension > 0),
    );
  };
  const dismissNotifications = async () => {
    const button = await notificationPrompt();
    if (!button) return false;
    const [x, y] = button.position!;
    const [width, height] = button.size!;
    await probe.clickPoint(x + width / 2, y + height / 2);
    await waitFor(async () => !(await notificationPrompt()) || undefined, 8_000);
    return true;
  };
  const press = async (match: RegExp) => {
    const node = await show(match, "AXButton");
    await probe.pressControl(
      podcasts,
      "AXButton",
      node.title ?? node.description ?? String(node.value),
    );
  };
  const settings = async () => {
    const before = new Set((await probe.windows(podcasts)).map(({ title }) => title));
    const settingsWindow = async () =>
      (await probe.windows(podcasts)).find(({ title }) => title && !before.has(title));
    await app.runChecked("a,");
    try {
      await waitFor(settingsWindow);
      await show(/^General(?: |$)/);
      await show(/^Playback(?: |$)/);
    } finally {
      const window = await settingsWindow();
      if (window?.title) {
        await probe.closeWindow(podcasts, window.title);
        if (
          !(await waitFor(async () => !(await settingsWindow()) || undefined, 2_000).catch(
            () => false,
          ))
        ) {
          await probe.raiseWindow(podcasts, window.title);
          await probe.key(13, 1 << 20);
        }
      }
      await waitFor(async () => !(await settingsWindow()) || undefined, 12_000);
      if ((await probe.front()) !== podcasts) await probe.activate(podcasts);
    }
  };
  const search = async () => {
    const searchField = async () => {
      const field = await probe.windowElement(podcasts, "podcasts.searchField", "AXTextField");
      return field?.enabled && field.size?.every((dimension) => dimension > 0) ? field : undefined;
    };
    if (await searchField()) {
      const home = await show(/^Home(?: |$)/);
      expect(home.position && home.size).toBeDefined();
      const [x, y] = home.position!;
      const [width, height] = home.size!;
      await probe.clickPoint(x + width / 2, y + height / 2);
      await waitFor(async () => !(await searchField()) || undefined);
    }
    await app.runChecked("g/");
    try {
      await waitFor(async () => {
        const sheet = await probe.window(podcasts, 10);
        const dismiss =
          sheet.role === "AXSheet"
            ? flattenAX([sheet]).find(
                (node) =>
                  node.role === "AXButton" &&
                  node.enabled &&
                  [node.description, node.title].some((label) =>
                    ["Continue", "Start Listening", "Get Started", "Not Now"].includes(label ?? ""),
                  ),
              )
            : undefined;
        if (dismiss?.position && dismiss.size) {
          const [x, y] = dismiss.position;
          const [width, height] = dismiss.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
          return;
        }
        const search = await searchField();
        if (search) return search;
        const focus = await probe.focus(podcasts);
        return focus.subrole === "AXSearchField" ||
          focus.role === "AXSearchField" ||
          (["AXTextField", "AXComboBox"].includes(focus.role ?? "") &&
            /search|shows, episodes/i.test(label(focus)))
          ? focus
          : undefined;
      }).catch(async (cause) => {
        const controls = (await nodes()).filter(
          ({ role, subrole }) =>
            role === "AXTextField" || role === "AXComboBox" || subrole === "AXSearchField",
        );
        throw new Error(
          "Podcast search did not receive focus: " +
            JSON.stringify({
              focus: await probe.focus(podcasts),
              controls,
            }),
          { cause },
        );
      });
    } finally {
      await escape();
    }
  };
  const station = async () => {
    await app.runChecked("ns");
    let cancel: AXNode | undefined;
    try {
      await show(/Station Name|New Station|Create Station/);
      cancel = await show(/^Cancel(?: |$)/, "AXButton");
      await waitFor(async () => {
        const focus = await probe.focus(podcasts);
        return focus.role === "AXTextField" ? focus : undefined;
      });
    } finally {
      if (cancel)
        await probe.pressControl(
          podcasts,
          "AXButton",
          cancel.title ?? cancel.description ?? "Cancel",
        );
      else await escape();
      await waitFor(async () => {
        const window = await probe.window(podcasts);
        return (window.role !== "AXSheet" && window.subrole !== "AXDialog") || undefined;
      });
    }
  };
  const selectShows = async () => {
    const showsID = "podcasts.tabBar.shows";
    const selected = async () =>
      (await probe.window(podcasts)).title === "Shows" ||
      (await nodes()).some((node) => node.id === showsID && node.selected) ||
      undefined;
    if (await selected()) return;
    const row = await waitFor(async () => {
      if (await dismissIntro(probe)) return;
      return (await nodes()).find(
        (node) =>
          node.id === showsID && node.position && node.size?.every((dimension) => dimension > 0),
      );
    }, 20_000);
    const scene = await probe.window(podcasts);
    if (scene.subrole === "AXStandardWindow" && scene.title) {
      await probe.raiseWindow(podcasts, scene.title);
    }
    const [x, y] = row.position!;
    const [width, height] = row.size!;
    // The AX row spans the sidebar, while the actual hit target is its icon and label.
    await probe.clickPoint(x + Math.min(56, width / 2), y + height / 2);
    await waitFor(selected, 6_000).catch(async (cause) => {
      throw new Error(
        "Podcasts could not select Shows: " +
          JSON.stringify({ front: await probe.front(), focus: await probe.focus(podcasts), row }),
        { cause },
      );
    });
  };
  const follow = async () => {
    const followButton = async () =>
      (await nodes()).find(
        (node) => node.role === "AXButton" && /^Follow(?: |$)/.test(label(node)),
      );
    await selectShows();
    expect(await followButton()).toBeUndefined();
    await app.runChecked("nf");
    let recoveredIntro = false;
    try {
      await waitFor(async () => {
        if (!recoveredIntro && (await dismissIntro(probe))) {
          recoveredIntro = true;
          await waitFor(async () => {
            const window = await probe.window(podcasts);
            if (window.subrole === "AXStandardWindow") return window;
          }, 12_000);
          if (!(await followButton())) await app.runChecked("nf");
          return;
        }
        const focus = await probe.focus(podcasts);
        return focus.role === "AXTextField" && (await followButton()) ? focus : undefined;
      }, 16_000).catch(async (cause) => {
        const controls = (await nodes())
          .filter(({ role }) =>
            ["AXWindow", "AXSheet", "AXTextField", "AXButton", "AXHeading"].includes(role ?? ""),
          )
          .map(({ role, title, description, id }) => ({ role, title, description, id }));
        throw new Error(
          "Follow a Show did not present its URL field: " + JSON.stringify(controls.slice(0, 48)),
          { cause },
        );
      });
      const pasteboard = Bun.spawn(["/usr/bin/pbcopy"], {
        stdin: new Blob([feed.url]),
        timeout: 5_000,
      });
      expect(await pasteboard.exited).toBe(0);
      await probe.key(9, command);
      const entered = async () => (await probe.focus(podcasts)).value === feed.url || undefined;
      if (!(await waitFor(entered, 1_500).catch(() => undefined))) {
        await probe.setFocusedText(podcasts, feed.url);
      }
      await waitFor(entered);
      await waitFor(async () => (await followButton())?.enabled || undefined);
      await press(/^Follow(?: |$)/);
      await waitFor(async () => (feed.requests() ? true : undefined), 20_000);
      const listedShow = async () => {
        if (await dismissNotifications()) return;
        return (await nodes()).find(
          (node) => node.role !== "AXTextField" && label(node).includes(name),
        );
      };
      const listed = await waitFor(listedShow, 20_000).catch(async (cause) => {
        const artifacts = process.env.CHORD_TESTING_ARTIFACTS;
        if (artifacts && (await probe.front()) === podcasts) {
          await runCommand([
            "/usr/sbin/screencapture",
            "-x",
            join(artifacts, "podcasts-local-feed.png"),
          ]);
        }
        const current = await nodes();
        const visible = current.map(label).filter(Boolean).slice(0, 50);
        const navigation = current
          .filter((node) => /^(Shows|Recently Updated)$/.test(label(node)))
          .map(({ role, id, position, size, selected }) => ({
            role,
            id,
            position,
            size,
            selected,
          }));
        throw new Error(
          "Podcasts fetched the feed but did not list the show: " +
            JSON.stringify({ window: await probe.window(podcasts), navigation, visible }),
          {
            cause,
          },
        );
      });
      console.log(
        "Podcasts local show appeared",
        JSON.stringify({
          role: listed.role,
          title: listed.title,
          description: listed.description,
          position: listed.position,
          size: listed.size,
        }),
      );
    } finally {
      if (await followButton()) await escape();
    }
  };
  const refresh = async () => {
    const before = feed.requests();
    await app.runChecked("fr");
    await waitFor(async () => (feed.requests() > before ? true : undefined), 20_000);
  };
  const episode = async () =>
    (await nodes()).find(
      (node) =>
        node.position &&
        node.size?.every((dimension) => dimension > 0) &&
        node.role !== "AXWindow" &&
        [node.title, node.description, node.value].some(
          (text) => typeof text === "string" && text.split(", ").includes(episodeTitle),
        ),
    );
  const transport = async (title: "Play" | "Pause") =>
    (await menu("Controls", title).catch(() => undefined))?.enabled || undefined;
  const play = async () => {
    await dismissNotifications();
    if (!(await episode())) {
      const showCard = await waitFor(async () => {
        if (await dismissNotifications()) return;
        const roleNames = ["AXButton", "AXCell", "AXRow", "AXUnknown", "AXStaticText", "AXLink"];
        const card = await probe.windowElement(podcasts, name, ...roleNames);
        if (card?.position && card.size?.every((dimension) => dimension > 0)) return card;
        return (await nodes()).find(
          (node) =>
            node.position &&
            node.size?.every((dimension) => dimension > 0) &&
            roleNames.includes(node.role ?? "") &&
            /^Chordtest Podcast(?:[, ]|$)/.test(label(node)),
        );
      }, 10_000).catch(async (cause) => {
        const controls = (await nodes())
          .filter((node) => label(node) || node.id)
          .map(({ role, title, description, value, position, id }) => ({
            role,
            title,
            description,
            value,
            position,
            id,
          }));
        throw new Error(
          "Podcasts could not open the downloaded show's card: " +
            JSON.stringify({
              window: await probe.window(podcasts),
              controls: controls.slice(0, 45),
            }),
          { cause },
        );
      });
      const [x, y] = showCard.position!;
      const [width, height] = showCard.size!;
      await probe.clickPoint(x + width / 2, y + height / 2);
    }
    const item = await waitFor(episode, 12_000).catch(async (cause) => {
      const visible = (await nodes()).map(label).filter(Boolean).slice(0, 40);
      throw new Error("Podcasts did not show the local episode: " + JSON.stringify(visible), {
        cause,
      });
    });
    const playButton = async () =>
      (await nodes()).find(
        (node) =>
          node.role === "AXButton" &&
          label(node).startsWith("Play, Remaining Time:") &&
          node.position &&
          node.size?.every((dimension) => dimension > 0),
      );
    const streamed = async () =>
      ((await transport("Pause")) && feed.audioRequests() > 0) || undefined;
    const button = await playButton();
    if (button) {
      const name = button.title ?? button.description ?? String(button.value);
      await probe.pressControl(podcasts, "AXButton", button.id ?? name).catch(() => undefined);
      if (!(await waitFor(streamed, 2_500).catch(() => false)) && feed.audioRequests() === 0) {
        const current = await playButton();
        if (current?.position && current.size) {
          const [x, y] = current.position;
          const [width, height] = current.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
        }
      }
    }
    if (!(await waitFor(streamed, 3_000).catch(() => false)) && feed.audioRequests() === 0) {
      const currentEpisode = (await episode()) ?? item;
      const [x, y] = currentEpisode.position!;
      const [width, height] = currentEpisode.size!;
      await probe.doubleClickPoint(x + width / 2, y + height / 2);
    }
    await waitFor(streamed, 15_000).catch(async (cause) => {
      const network = await runCommand(
        [
          "/usr/bin/log",
          "show",
          "--last",
          "40s",
          "--style",
          "compact",
          "--predicate",
          'process == "Podcasts" AND (eventMessage CONTAINS[c] "NSURLErrorDomain" OR eventMessage CONTAINS[c] "App Transport Security" OR eventMessage CONTAINS[c] "127.0.0.1")',
        ],
        { timeout: 8_000 },
      ).catch(() => undefined);
      throw new Error(
        "Podcasts did not load the selected episode: " +
          JSON.stringify({
            audioRequests: feed.audioRequests(),
            episode: { role: item.role, id: item.id, position: item.position, size: item.size },
            window: await probe.window(podcasts),
            playback: await menu("Controls", "Play").catch(() => undefined),
            currentPlayButton: await playButton(),
            network: network?.stdout.split("\n").slice(-12).join("\n"),
          }),
        { cause },
      );
    });
    console.log("Podcasts streamed the local episode", feed.audioRequests());
    await probe.press(podcasts, "Controls", "Pause");
    if (!(await waitFor(() => transport("Play"), 2_000).catch(() => false))) {
      const button = (await nodes()).find(
        (node) =>
          node.id === "podcasts.miniPlayer.playbackTransportControl" &&
          label(node).startsWith("Pause") &&
          node.position &&
          node.size,
      );
      if (button?.position && button.size) {
        const [x, y] = button.position;
        const [width, height] = button.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
      }
      await waitFor(() => transport("Play"), 10_000);
    }
    await app.runChecked("pp");
    await waitFor(() => transport("Pause"), 10_000);
  };
  const pause = async () => {
    await waitFor(() => transport("Pause"), 10_000);
    await app.runChecked("ph");
    await waitFor(() => transport("Play"), 10_000);
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
    if ((await elapsed()) === undefined) {
      const nowPlaying = await probe.windowElement(podcasts, "Show Now Playing", "AXButton");
      if (nowPlaying?.enabled && nowPlaying.position && nowPlaying.size) {
        const [x, y] = nowPlaying.position;
        const [width, height] = nowPlaying.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
      }
    }
    const before = await waitFor(elapsed);
    await app.runChecked(key);
    await waitFor(async () => {
      const after = await elapsed();
      return after !== undefined && direction * (after - before) > 0 ? true : undefined;
    });
  };
  const gotoShow = async () => {
    const showTitle = async () => {
      const window = await probe.window(podcasts);
      if (window.title === name) return window;
      return (await nodes()).find(
        (node) =>
          node.role === "AXHeading" && [node.title, node.description, node.value].includes(name),
      );
    };
    const home = await waitFor(async () =>
      (await nodes()).find(
        (node) => node.id === "podcasts.tabBar.listen" && node.position && node.size,
      ),
    );
    const [x, y] = home.position!;
    const [width, height] = home.size!;
    await probe.clickPoint(x + Math.min(56, width / 2), y + height / 2);
    await waitFor(
      async () =>
        (!(await showTitle()) &&
          (await nodes()).some((node) => node.id === home.id && node.selected)) ||
        undefined,
      10_000,
    );
    await app.runChecked("pg");
    await waitFor(showTitle, 12_000);
    await waitFor(episode);
  };
  return { settings, search, station, follow, refresh, play, pause, skip, gotoShow };
}

type Scenario = ReturnType<typeof podcastScenario>;
const cases: Record<string, (scenario: Scenario) => Promise<void>> = {
  nf: ({ follow }) => follow(),
  pp: ({ play }) => play(),
  ph: ({ pause }) => pause(),
  pf: ({ skip }) => skip("pf", 1),
  pk: ({ skip }) => skip("pk", -1),
  pg: ({ gotoShow }) => gotoShow(),
  fr: ({ refresh }) => refresh(),
  "g/": ({ search }) => search(),
  ns: ({ station }) => station(),
  "a,": ({ settings }) => settings(),
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
            if (await dismissIntro(probe)) return;
            const button = flattenAX(await probe.windows(podcasts, 10)).find(
              (node) =>
                node.role === "AXButton" &&
                [node.title, node.description].some((text) =>
                  ["Continue", "Get Started", "Start Listening", "Not Now"].includes(text ?? ""),
                ),
            );
            if (button?.position && button.size && button.enabled !== false) {
              const [x, y] = button.position;
              const [width, height] = button.size;
              await probe.clickPoint(x + width / 2, y + height / 2);
              return;
            }
            const station = await probe
              .menu(podcasts, "File", "Create Station")
              .catch(() => undefined);
            const scene = await probe.window(podcasts, 10);
            return (
              (station?.enabled &&
                scene.subrole === "AXStandardWindow" &&
                flattenAX([scene]).some((node) => node.id === "podcasts.tabBar.shows")) ||
              undefined
            );
          }, 25_000);
          const scenario = podcastScenario(app, probe, feed);
          const failures: Error[] = [];
          for (const [key, verify] of Object.entries(cases)) {
            try {
              if ((await probe.front()) !== podcasts) await probe.activate(podcasts);
              await verify(scenario);
              console.log("Podcasts " + key + " passed");
            } catch (cause) {
              const failure = new Error("Podcasts " + key + " did not reach its expected state", {
                cause,
              });
              failures.push(failure);
              console.error(failure);
            }
          }
          if (failures.length) throw new AggregateError(failures, "Podcasts behavior failures");
        } finally {
          feed.server.stop(true);
          await probe.key(53);
        }
      }),
    ),
  300_000,
);
