import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
} from "@keychord/chordtest";

const bundle = "com.apple.games";
const destinations = {
  gl: /^Library$/,
  ga: /^(?:Apple\s+|\uF8FF\s*)?Arcade$/,
  gh: /^Home$/,
};

test("every Games binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/games/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...Object.keys(destinations), "g,"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Games chords switch destinations and open settings",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        const elements = async () => flattenAX(await probe.windows(bundle, 9).catch(() => []));
        const matches = (node: AXNode, pattern: RegExp) =>
          [node.title, node.description, node.value].some(
            (label) => typeof label === "string" && pattern.test(label),
          );
        const selected = async (destination: RegExp) =>
          (await elements()).some((node) => {
            if (node.role === "AXWindow" || node.role === "AXHeading")
              return matches(node, destination);
            return (
              (node.selected === true ||
                (node.role === "AXRadioButton" && (node.value === 1 || node.value === true))) &&
              flattenAX([node]).some((item) => matches(item, destination))
            );
          })
            ? true
            : undefined;

        const signInRequired = async () =>
          (await elements()).some(
            ({ id, value }) =>
              id === "games.onboarding.title" && value === "Sign In to Game Center",
          );
        await waitFor(async () => {
          const nodes = await elements();
          if (await signInRequired()) return true;
          const welcome = nodes.find(
            ({ id, role, enabled }) =>
              role === "AXButton" && enabled && id === "games.onboarding.primaryButton",
          );
          if (welcome?.position && welcome.size) {
            const [x, y] = welcome.position;
            const [width, height] = welcome.size;
            await probe.clickPoint(x + width / 2, y + height / 2);
            return;
          }
          return selected(destinations.gh);
        }, 30_000).catch(async (cause) => {
          const nodes = (await elements()).filter(
            ({ id, role }) =>
              id?.startsWith("games.onboarding.") || role === "AXHeading" || role === "AXSheet",
          );
          throw new Error("Games did not open its Home view: " + JSON.stringify(nodes), { cause });
        });

        if (await signInRequired()) {
          for (const sequence of Object.keys(destinations)) {
            await app.expectFailure(
              sequence,
              /Sign in to Game Center in Games before switching sections/,
            );
            expect(await signInRequired()).toBe(true);
          }
        } else {
          for (const [sequence, destination] of Object.entries(destinations)) {
            expect(await selected(destination)).toBeUndefined();
            await app.runChecked(sequence);
            await waitFor(() => selected(destination), 25_000);
            expect(await probe.front()).toBe(bundle);
          }
        }

        const settingsItem = await probe.menu(bundle, "Games", "Settings…");
        if (settingsItem.enabled === false) {
          await app.expectFailure("g,", /Menu item "Settings…".*is disabled/);
          return;
        }
        const settingsOpen = async () =>
          (await elements()).some(
            (node) =>
              (node.role === "AXWindow" && node.title === "Games Settings") ||
              (node.role !== "AXWindow" && matches(node, /^Video Autoplay$/)),
          )
            ? true
            : undefined;
        expect(await settingsOpen()).toBeUndefined();
        await app.runChecked("g,");
        await waitFor(settingsOpen, 10_000);
        await probe.key(13, 1 << 20);
        await waitFor(async () => (!(await settingsOpen()) ? true : undefined), 10_000);
        await waitFor(
          async () => (await signInRequired()) || (await selected(destinations.gh)),
          15_000,
        );
      }),
    );
  },
  240_000,
);
