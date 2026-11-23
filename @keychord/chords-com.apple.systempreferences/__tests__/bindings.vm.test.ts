import { expect, test } from "bun:test";
import {
  macOSUITestsEnabled,
  flattenAX,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const settings = "com.apple.systempreferences";
const panes: Record<string, RegExp> = {
  gaa: /Apple Account|Sign In/i,
  gwi: /^Wi-Fi$/,
  gbl: /^Bluetooth$/,
  gne: /^Network$/,
  gvp: /^VPN$/,
  gba: /^(Battery|Energy)$/,
  gge: /^General$/,
  gac: /^Accessibility$/,
  gap: /^Appearance$/,
  gai: /^(Apple Intelligence & )?Siri$/,
  gdd: /^Desktop & Dock$/,
  gdi: /^Displays$/,
  gmb: /^Menu Bar$|^Control Center$/,
  gsp: /^Spotlight$/,
  gwa: /^Wallpaper$/,
  gno: /^Notifications$/,
  gso: /^Sound$/,
  gfo: /^Focus$/,
  gst: /^Screen Time$/,
  gls: /^Lock Screen$/,
  gps: /^Privacy & Security$/,
  gtp: /^(Touch ID & )?Password$|^Login Password$/,
  gup: /^Users & Groups$/,
  gia: /^Internet Accounts$/,
  ggc: /^Game Center$/,
  gic: /iCloud|Apple Account|Sign In/i,
  gwp: /^Wallet & Apple Pay$/,
  gke: /^Keyboard$/,
  gtr: /^Trackpad$/,
  gpr: /^Printers & Scanners$/,
};

test("every System Settings binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/systempreferences/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...Object.keys(panes), "apa", "apd", "apl"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "System Settings chords open the requested panes",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const failures: string[] = [];
        async function check(sequence: string, body: () => Promise<void | false>) {
          try {
            if ((await body()) !== false) console.log(`System Settings ${sequence} passed`);
          } catch (error) {
            const current = await probe.windows(settings).catch(() => []);
            failures.push(`${sequence}: ${error}. Current window: ${JSON.stringify(current)}`);
          }
        }
        const windowTitle = async () =>
          ((await probe.windows(settings))[0]?.title ?? "")
            .normalize("NFKC")
            .replace(/[‐‑‒–]/g, "-");
        const settingsTree = async () => flattenAX(await probe.windows(settings, 8));
        const availablePane = async (pattern: RegExp) =>
          (await settingsTree()).some(
            (node) => node.id && pattern.test(node.id) && node.size?.every((length) => length > 0),
          );
        const hasSetting = async (pattern: RegExp) =>
          (await settingsTree()).some((node) =>
            [node.title, node.value, node.description, node.id].some(
              (value) => typeof value === "string" && pattern.test(value),
            ),
          );
        await check("/,", async () => {
          await probe.activate("com.apple.finder");
          await app.run("/,");
          await waitFor(async () => ((await probe.front()) === settings ? true : undefined));
        });
        for (const [sequence, title] of Object.entries(panes)) {
          await check(sequence, async () => {
            // Select a different pane before running the chord, including repeated Apple Account links.
            const other = sequence === "gap" ? "Sound" : "Appearance";
            const extension =
              other === "Sound"
                ? "com.apple.Sound-Settings.extension"
                : "com.apple.Appearance-Settings.extension";
            await probe.activate(settings, `x-apple.systempreferences:${extension}`);
            await waitFor(async () => ((await windowTitle()) === other ? true : undefined), 12_000);
            if (sequence === "gic" && !(await availablePane(/^com\.apple\.settings\.iCloud$/i))) {
              console.log("System Settings gic requires a guest signed in to Apple Account");
              return false;
            }
            if (sequence === "gtr" && !(await availablePane(/^com\.apple\.settings\.trackpad$/i))) {
              console.log("System Settings gtr requires a guest with the Trackpad pane");
              return false;
            }
            await app.run(sequence);
            await app.flush();
            await waitFor(async () => {
              if (title.test(await windowTitle())) return true;
              if (
                sequence === "gge" &&
                (await hasSetting(/^com\.apple\.systempreferences\.general\.featureDescription$/))
              ) {
                return true;
              }
            }, 10_000);
          });
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  240_000,
);
