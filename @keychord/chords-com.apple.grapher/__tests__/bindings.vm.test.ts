import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
} from "@keychord/chordtest";

const bundle = "com.apple.grapher";
const switches = { v3: "Switch to 2D View", v2: "Switch to 3D View" };
const dialogs = {
  fo: /^(?:Open|Choose)$/,
  fs: /^Save$/,
  fe: /^(?:Export|Export…|Save|Next)$/,
  et: /^OK$/,
  gt: /^(?:Choose|OK|Apply)$/,
  gl: /^(?:OK|Apply)$/,
};

test("every Grapher binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/grapher/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(
    [
      "fn",
      "en",
      "ed",
      "vi",
      "vo",
      "vf",
      "vp",
      ...Object.keys(switches),
      ...Object.keys(dialogs),
    ].sort(),
  );
});

test.skipIf(!macOSUITestsEnabled)(
  "Grapher creates a graph, edits its equations, and changes the view",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(() => probe.menu(bundle, "File", "New…").catch(() => undefined), 15_000);
        const nodes = async () => flattenAX(await probe.windows(bundle, 8));
        const button = async (label: RegExp) =>
          (await nodes()).find((node) => node.role === "AXButton" && label.test(node.title ?? ""));
        const dismiss = async () => {
          if (await button(/^Cancel$/)) {
            await probe.clickControl(bundle, "AXButton", "Cancel");
          } else {
            await probe.key(53);
          }
        };
        if (await button(/^Choose$/)) {
          await dismiss();
          await waitFor(async () => (!(await button(/^Choose$/)) ? true : undefined));
        }

        await app.runChecked("fn");
        await waitFor(() => button(/^Choose$/));
        await probe.clickControl(bundle, "AXButton", "Choose");
        const hasView = async (item: string) =>
          Boolean((await probe.menu(bundle, "View", item).catch(() => undefined))?.enabled);
        await waitFor(async () => ((await hasView(switches.v2)) ? true : undefined), 15_000);

        const equationRows = async () =>
          flattenAX([await probe.window(bundle, 8)]).filter((node) => node.role === "AXRow");
        const initial = (await equationRows()).length;
        await app.runChecked("en");
        await waitFor(async () =>
          (await equationRows()).length === initial + 1 ? true : undefined,
        );
        const rows = await equationRows();
        const row = rows.find((node) => node.selected);
        expect(row?.position).toBeDefined();
        if (!row?.position || !row.size) throw new Error("Grapher equation row has no AX bounds");
        await probe.clickPoint(
          row.position[0] + row.size[0] / 2,
          row.position[1] + row.size[1] / 2,
        );
        await waitFor(async () => (await probe.focus(bundle)).role === "AXOutline" || undefined);
        await app.runChecked("ed");
        await waitFor(async () => (await equationRows()).length === initial || undefined).catch(
          async (cause) => {
            throw new Error(
              "The selected equation was not removed: " +
                JSON.stringify({
                  initial,
                  focus: await probe.focus(bundle),
                  rows: await equationRows(),
                }),
              { cause },
            );
          },
        );

        for (const [key, label] of Object.entries(dialogs)) {
          if ((await probe.front()) !== bundle) await probe.activate(bundle);
          expect(await button(label)).toBeUndefined();
          await app.runChecked(key);
          try {
            await waitFor(() => button(label), 12_000);
          } finally {
            await dismiss();
          }
          await waitFor(async () => (!(await button(label)) ? true : undefined));
        }

        for (const [key, opposite] of Object.entries(switches)) {
          expect(await hasView(opposite)).toBe(false);
          await app.runChecked(key);
          await waitFor(async () => ((await hasView(opposite)) ? true : undefined));
        }

        const palette = async () =>
          (await probe.windows(bundle)).find((node) => node.title === "Equation Palette");
        const hasPalette = Boolean(await palette());
        await app.runChecked("vp");
        await waitFor(async () => (Boolean(await palette()) !== hasPalette ? true : undefined));
        await app.runChecked("vp");
        await waitFor(async () => (Boolean(await palette()) === hasPalette ? true : undefined));

        const numericFields = (controls: AXNode[]) =>
          controls.flatMap((node) => {
            if (node.role !== "AXTextField") return [];
            if (typeof node.value === "number") return [node.value];
            const text = typeof node.value === "string" ? node.value.replace("−", "-") : "";
            return /^[-+]?\d+(?:\.\d+)?$/.test(text) ? [Number(text)] : [];
          });
        const frameLimits = async () =>
          flattenAX([await probe.window(bundle, 8), ...(await probe.windows(bundle, 8))]).find(
            (node) => {
              if (!["AXWindow", "AXSheet", "AXDialog"].includes(node.role ?? "")) return false;
              if ([node.title, node.description].includes("Frame Limits")) return true;
              if (node.role !== "AXSheet") return false;
              const contents = flattenAX([node]);
              const buttons = contents.filter((element) => element.role === "AXButton");
              return (
                numericFields(contents).length === 8 &&
                ["OK", "Cancel"].every((title) => buttons.some((button) => button.title === title))
              );
            },
          );
        const readLimits = async (open: () => Promise<void>) => {
          expect(await frameLimits()).toBeUndefined();
          await open();
          try {
            return await waitFor(async () => {
              const limits = await frameLimits();
              if (!limits) return;
              const values = numericFields(flattenAX([limits]));
              return values.length >= 2 ? values : undefined;
            }, 10_000).catch(async (cause) => {
              const controls = (await nodes())
                .filter(({ role }) =>
                  ["AXWindow", "AXSheet", "AXTextField", "AXButton"].includes(role ?? ""),
                )
                .map(({ role, title, description, value }) => ({
                  role,
                  title,
                  description,
                  value,
                }));
              throw new Error(
                "Grapher did not expose numeric Frame Limits: " +
                  JSON.stringify(controls.slice(0, 45)),
                { cause },
              );
            });
          } finally {
            await dismiss();
            if (await frameLimits()) await probe.key(13, 1 << 20);
            await waitFor(async () => (!(await frameLimits()) ? true : undefined));
          }
        };
        const beforeZoom = await readLimits(() => app.runChecked("vf"));
        const limits = () => readLimits(() => probe.press(bundle, "View", "Frame Limits…"));
        await app.runChecked("vi");
        const zoomedIn = await limits();
        expect(zoomedIn).not.toEqual(beforeZoom);
        await app.runChecked("vo");
        const zoomedOut = await limits();
        expect(zoomedOut).not.toEqual(zoomedIn);
        expect(zoomedOut).toHaveLength(beforeZoom.length);
        for (const [index, value] of zoomedOut.entries()) {
          expect(value).toBeCloseTo(beforeZoom[index], 2);
        }

        await probe.key(13, 1 << 20);
        const deleteButton = await button(/^Delete$/);
        if (deleteButton) await probe.pressControl(bundle, "AXButton", "Delete");
      }),
    );
  },
  210_000,
);
