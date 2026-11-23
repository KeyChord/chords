import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.PhotoBooth";
const unavailableWithoutMedia = {
  cn: ["File", "Take Photo"],
  ef: ["Edit", "Flip Photo"],
  et: ["Edit", "Trim Movie…"],
  ed: ["Edit", "Delete"],
  fe: ["File", "Export..."],
  fo: ["File", "Export Original..."],
};

const effects = {
  vp: ["Show Photo", "live"],
  ve: ["Show Effects", "effects"],
  "v]": ["Next Page of Effects", "next"],
  "v[": ["Previous Page of Effects", "previous"],
} as const;

const caseKeys = ["ea", ...Object.keys(unavailableWithoutMedia), ...Object.keys(effects)];

test("every Photo Booth binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/PhotoBooth/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((sequence) => !sequence.startsWith("?"))
      .sort(),
  ).toEqual(caseKeys.sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Photo Booth changes auto-flip and resolves capture, effects and media commands",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await probe.activate(bundleId);
        const controls = async () => flattenAX(await probe.windows(bundleId, 8));
        const noCamera = await waitFor(
          async () =>
            (await controls()).find((node) =>
              [node.title, node.description, node.value].includes("No Camera Available"),
            ),
          15_000,
        );
        expect(noCamera).toBeDefined();

        const autoFlip = () => probe.menu(bundleId, "Edit", "Auto Flip New Items");
        const originalMark = (await autoFlip()).mark;
        await app.runChecked("ea");
        await waitFor(async () => ((await autoFlip()).mark !== originalMark ? true : undefined));
        await app.runChecked("ea");
        await waitFor(async () => ((await autoFlip()).mark === originalMark ? true : undefined));

        for (const [sequence, path] of Object.entries(unavailableWithoutMedia)) {
          expect((await probe.menu(bundleId, ...path)).enabled).toBe(false);
          await app.expectFailure(sequence, /Menu item .*is disabled/);
        }

        const effectsPage = async () =>
          (await controls())
            .filter((node) => node.role === "AXRadioButton" && (node.selected || node.value === 1))
            .map((node) => node.title ?? node.description ?? node.id)
            .join(",");
        const inEffects = async () =>
          (await controls()).some((node) =>
            /^(Normal|Sepia|Black & White)$/.test(node.title ?? node.description ?? ""),
          );
        for (const sequence of ["ve", "v]", "v[", "vp"] as const) {
          const [title, destination] = effects[sequence];
          const item = await probe.menu(bundleId, "View", title);
          if (item.enabled === false) {
            await app.expectFailure(sequence, /Menu item .*is disabled/);
            continue;
          }
          const beforePage = await effectsPage();
          const beforeEffects = await inEffects();
          await app.runChecked(sequence);
          await waitFor(async () => {
            if (destination === "live" && beforeEffects && !(await inEffects())) return true;
            if (destination === "effects" && !beforeEffects && (await inEffects())) return true;
            if (destination === "next" || destination === "previous") {
              const afterPage = await effectsPage();
              if (afterPage && afterPage !== beforePage) return true;
            }
            if ((await probe.menu(bundleId, "View", title)).mark !== item.mark) return true;
          });
        }
      }),
    ),
  120_000,
);
