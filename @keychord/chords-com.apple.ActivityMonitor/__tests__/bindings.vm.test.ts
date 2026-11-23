import { expect, test } from "bun:test";
import {
  flattenAX,
  launchMacOSFixture,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const monitor = "com.apple.ActivityMonitor";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/ActivityMonitor/macos.toml", import.meta.url)).text(),
) as {
  chords: Record<string, { "@input:menu"?: ["BY_PATH", string[]] | ["FOCUS", string] }>;
};
const cases = Object.entries(definition.chords)
  .flatMap(([sequence, definition]) =>
    definition["@input:menu"]?.[0] === "BY_PATH"
      ? [[sequence, definition["@input:menu"][1]] as [string, string[]]]
      : [],
  )
  .sort(([left], [right]) => "vcpr".indexOf(left[0]) - "vcpr".indexOf(right[0]));

test("every Activity Monitor binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["pf", ...cases.map(([sequence]) => sequence)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "pf focuses Activity Monitor's process search",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(monitor);
        await waitFor(async () => {
          const window = await probe.window(monitor).catch(() => undefined);
          return window?.subrole === "AXStandardWindow" ? true : undefined;
        }, 12_000);
        const search = await waitFor(async () =>
          flattenAX([await probe.window(monitor, 4)]).find(
            (node) => node.subrole === "AXSearchField",
          ),
        );
        const searchFocused = async () => {
          const focus = await probe.focus(monitor).catch(() => undefined);
          return focus?.subrole === "AXSearchField" || (search.id && focus?.id === search.id);
        };
        expect(await searchFocused()).toBeFalsy();
        await app.runChecked("pf");
        await waitFor(async () => ((await searchFocused()) ? true : undefined), 10_000).catch(
          async (cause) => {
            throw new Error(
              `Process search did not receive focus. Current element ${JSON.stringify(await probe.focus(monitor))}`,
              { cause },
            );
          },
        );
        console.log("Activity Monitor pf focused the process search");
      }),
    );
  },
  90_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "Activity Monitor chords invoke the real View menu",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(monitor);
        const failures: string[] = [];
        const menu = (path: string[]) =>
          waitFor(() => probe.menu(monitor, ...path).catch(() => undefined), 15_000);
        await menu(["View"]);
        const fixture = await launchMacOSFixture(
          new URL("../../chordtest/src/fixtures/WindowFixture.swift", import.meta.url),
          "dev.keychord.activity-monitor-fixture",
        );
        const pid = (await Bun.file(`${fixture.output}.pid`).text()).trim();
        await probe.activate(monitor);
        const selectTestProcess = async () => {
          await probe.activate(monitor);
          await menu(["View"]);
          await probe.press(monitor, "View", "Windowed Processes");
          await waitFor(async () => {
            const selected = await probe
              .selectRow(monitor, pid)
              .catch(() => probe.selectRow(monitor, "WindowFixture"))
              .then(
                () => true,
                () => false,
              );
            return selected && (await menu(["View", "Inspect Process"])).enabled ? true : undefined;
          }, 12_000);
        };
        try {
          for (const [sequence, path] of cases) {
            try {
              if (sequence.startsWith("c")) {
                const mark = (await menu(path)).mark;
                await app.run(sequence);
                await waitFor(async () => ((await menu(path)).mark !== mark ? true : undefined));
                await app.run(sequence);
                await waitFor(async () => ((await menu(path)).mark === mark ? true : undefined));
              } else if (sequence.startsWith("v")) {
                if (sequence === "vs") await selectTestProcess();
                if (sequence === "vl") {
                  const energyTab = async () =>
                    flattenAX([await probe.window(monitor, 5)]).find(
                      (node) =>
                        node.role === "AXRadioButton" &&
                        [node.description, node.title].includes("Energy"),
                    );
                  const energy = await waitFor(energyTab, 12_000);
                  expect(energy.position && energy.size).toBeDefined();
                  await probe.clickPoint(
                    energy.position![0] + energy.size![0] / 2,
                    energy.position![1] + energy.size![1] / 2,
                  );
                  await waitFor(async () => {
                    const tab = await energyTab();
                    return tab?.value === 1 || tab?.value === true ? true : undefined;
                  }, 12_000);
                }
                if (sequence === "vp")
                  await probe.pressControl(monitor, "AXRadioButton", "CPU").catch(() => {});
                const item = await menu(path);
                if (!item.enabled && ["vl", "vp"].includes(sequence)) {
                  await app.expectFailure(sequence, /Menu item .*is disabled/);
                  console.log(`Activity Monitor ${sequence} reports an unavailable view`);
                  continue;
                }
                if (item.mark && sequence !== "vl") {
                  await probe.press(
                    monitor,
                    "View",
                    sequence === "va" ? "My Processes" : "All Processes",
                  );
                  await waitFor(async () => ((await menu(path)).mark ? undefined : true));
                }
                await app.run(sequence);
                await app.flush();
                await waitFor(async () => {
                  if ((await menu(path)).mark) return true;
                  if ((await probe.window(monitor)).title?.includes(path.at(-1)!)) return true;
                }, 10_000);
              } else {
                if (sequence.startsWith("p")) await selectTestProcess();
                const before = JSON.stringify(await probe.windows(monitor));
                const mark = (await menu(path)).mark;
                await app.run(sequence);
                await waitFor(
                  async () => {
                    const windows = await probe.windows(monitor, 1);
                    return JSON.stringify(await probe.windows(monitor)) !== before ||
                      flattenAX(windows).some((node) => node.role === "AXSheet") ||
                      (await menu(path)).mark !== mark
                      ? true
                      : undefined;
                  },
                  sequence === "ps" ? 15_000 : 5_000,
                );
                if (sequence === "pi" || sequence === "ps") await probe.key(13, 1 << 20);
                await probe.key(53);
              }
              console.log(`Activity Monitor ${sequence} passed`);
            } catch (error) {
              failures.push(`${sequence} [${path.join(" > ")}]: ${error}`);
              console.error(failures.at(-1));
            }
          }
          if (failures.length) throw new Error(failures.join("\n"));
        } finally {
          await probe.key(53);
          await fixture.close();
        }
      }),
    );
  },
  300_000,
);
