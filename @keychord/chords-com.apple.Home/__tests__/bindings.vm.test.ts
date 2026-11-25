import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
} from "@keychord/chordtest";

const bundle = "com.apple.Home";
const destinations = [
  { sequence: "gd", title: "Discover", label: /^Discover$/ },
  { sequence: "ga", title: "Automation", label: /^Automation$/ },
  { sequence: "gh", title: "Home", label: /^(My )?Home$/ },
];
const editors = [
  {
    sequence: "na",
    path: ["File", "Add Automation"],
    label: /^(New Automation|A Time of Day Occurs)$/i,
  },
  { sequence: "ns", path: ["File", "Add Scene"], label: /^New Scene$/ },
  { sequence: "eh", path: ["Edit", "Edit Home…"], label: /^(Home Settings|Remove Home)$/ },
  { sequence: "er", path: ["Edit", "Edit Room…"], label: /^(Room Settings|Remove Room)$/ },
];

test("every Home binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Home/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...destinations, ...editors].map(({ sequence }) => sequence).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Home chords switch views, open editors, or report disabled menu items",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        const nodes = async () => flattenAX(await probe.windows(bundle, 10).catch(() => []));
        const matches = (node: AXNode, label: RegExp) =>
          [node.title, node.description, node.value].some(
            (value) => typeof value === "string" && label.test(value),
          );
        const contains = async (label: RegExp) =>
          (await nodes()).some((node) => node.role !== "AXMenuItem" && matches(node, label))
            ? true
            : undefined;

        await waitFor(() => probe.window(bundle).catch(() => undefined), 20_000);
        if (await contains(/^Welcome to Home$/)) {
          await probe.pressControl(bundle, "AXButton", "Continue");
          await waitFor(
            async () => (!(await contains(/^Welcome to Home$/)) ? true : undefined),
            20_000,
          );
        }

        const disabled = async (sequence: string, path: string[]) => {
          const item = await probe.menu(bundle, ...path);
          if (item.enabled !== false) return false;
          await app.expectFailure(sequence, /Menu item .* is disabled/);
          console.log(`Home ${sequence} reported disabled [${path.join(" > ")}]`);
          return true;
        };
        const selected = async (label: RegExp) =>
          (await nodes()).some((node) => {
            if (node.role === "AXHeading") return matches(node, label);
            return node.selected && flattenAX([node]).some((item) => matches(item, label));
          })
            ? true
            : undefined;

        await waitFor(() => probe.menu(bundle, "View", "Home").catch(() => undefined), 15_000);
        for (const { sequence, title, label } of destinations) {
          if (await disabled(sequence, ["View", title])) continue;
          if (await selected(label)) {
            await probe.press(bundle, "View", title === "Home" ? "Discover" : "Home");
            await waitFor(async () => (!(await selected(label)) ? true : undefined));
          }
          await app.runChecked(sequence);
          await waitFor(() => selected(label), 12_000);
        }

        for (const { sequence, path, label } of editors) {
          if (await disabled(sequence, path)) continue;
          expect(await contains(label)).toBeUndefined();
          await app.runChecked(sequence);
          await waitFor(() => contains(label), 12_000);
          await probe.key(53);
          await waitFor(async () => (!(await contains(label)) ? true : undefined), 12_000);
        }
      }),
    );
  },
  180_000,
);
