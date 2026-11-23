import { expect, test } from "bun:test";
import {
  flattenAX,
  launchMacOSFixture,
  macOSUITestsEnabled,
  runChordScript,
  testMacOSPackage,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-dock: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url, []),
  300_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "numbered Dock chords select, open, and show the context menu",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const dock = "com.apple.dock";
        await probe.activate("com.apple.TextEdit");
        const tree = () => probe.tree(dock, 5).then((root) => flattenAX([root]));
        const items = async () => (await tree()).filter((node) => node.role === "AXDockItem");
        const numbers = await items();
        const finder = numbers.findIndex((node) => node.title === "Finder") + 1;
        expect(finder).toBeGreaterThan(0);
        await app.run(`;d${finder}`);
        await app.flush();
        await waitFor(async () => {
          const item = (await items())[finder - 1];
          if (item?.focused) return true;
          if (!item?.position || !item.size) return undefined;
          const [x, y] = await probe.cursor();
          const [left, top] = item.position;
          return x >= left && x < left + item.size[0] && y >= top && y < top + item.size[1]
            ? true
            : undefined;
        });
        console.log("Dock numeric focus selected Finder");
        await app.run(`;d.${finder}.`);
        await waitFor(async () =>
          (await probe.front()) === "com.apple.finder" ? true : undefined,
        );
        console.log("Dock numeric click opened Finder");
        await app.run(`;d.,${finder}`);
        await waitFor(async () =>
          (await tree()).some(
            (node) =>
              node.role === "AXMenu" &&
              node.children?.some((item) => item.title === "New Finder Window"),
          )
            ? true
            : undefined,
        );
        console.log("Dock numeric right click opened the Finder context menu");
        await probe.key(53);
      }),
    );
  },
  90_000,
);

test.skipIf(!macOSUITestsEnabled)(
  ";dv sends the native keyboard shortcut for Dock focus",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const fixture = await launchMacOSFixture(
          new URL("../../chords-modifiers/__tests__/KeyFixture.swift", import.meta.url),
          "dev.keychord.dock-key-focus",
        );
        try {
          await waitFor(async () =>
            (await probe.front()) === fixture.bundleId ? true : undefined,
          );
          const events = async (): Promise<{ code: number; flags: number }[]> =>
            Bun.file(fixture.output).json();
          const before = (await events()).length;
          await app.runChecked(";dv");
          await waitFor(async () => {
            const focus = await probe.focus("com.apple.dock").catch(() => undefined);
            if (focus?.role === "AXDockItem") return true;
            if (
              (await events())
                .slice(before)
                .some(({ code, flags }) => code === 99 && (flags & (1 << 18)) !== 0)
            )
              return true;
          }, 10_000);
        } finally {
          await probe.key(53);
          await fixture.close();
        }
      }),
    );
  },
  90_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "application chords switch real apps using a stable native cycle",
  async () => {
    const fixtures = [];
    try {
      for (const name of ["first", "hidden", "current", "helper"]) {
        fixtures.push(
          await launchMacOSFixture(
            new URL("./ApplicationFixture.swift", import.meta.url),
            `dev.keychord.application-cycle-${name}`,
          ),
        );
      }
      const result = await runChordScript(
        new URL("./application.integration.ts", import.meta.url),
        [
          ...fixtures.slice(0, 3).flatMap((fixture) => [fixture.bundleId, fixture.output]),
          fixtures[3].bundleId,
        ],
      );
      expect(result.stdout).toContain("application-cycle-ok");
    } finally {
      for (const fixture of fixtures.reverse()) await fixture.close();
    }
  },
  180_000,
);
