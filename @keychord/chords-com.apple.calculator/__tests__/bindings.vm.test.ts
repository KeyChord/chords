import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.calculator";
const modes = { vs: "Scientific", vp: "Programmer", vb: "Basic" };

test("every Calculator binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/calculator/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["vc", "vh", "vr", "vt", "cc", "cx", "cr", "cb", ...Object.keys(modes)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Calculator changes modes, formats results, and performs calculations",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        const view = (title: string) => probe.menu(bundle, "View", title);
        await waitFor(() => view("Basic").catch(() => undefined), 15_000);

        const nodes = async () => flattenAX(await probe.windows(bundle, 12));
        const control = async (label: RegExp) =>
          (await nodes()).find(
            (node) =>
              ["AXButton", "AXPopUpButton", "AXRadioButton"].includes(node.role ?? "") &&
              [node.title, node.description, node.id].some((value) => value && label.test(value)),
          );
        const scientific = () => control(/square root/i);
        const programmer = () => control(/^(?:show|hide) binary$/i);
        const mode = async () => {
          for (const title of Object.values(modes)) {
            if ((await view(title)).mark) return title;
          }
          if (await programmer()) return "Programmer";
          if (await scientific()) return "Scientific";
          const basic = await control(/^change (?:calculator )?mode$|^mode menu$/i);
          return basic ? "Basic" : undefined;
        };
        const originalMode = await waitFor(mode);
        await probe.press(bundle, "View", "Basic");
        await waitFor(async () => ((await mode()) === "Basic" ? true : undefined));
        const display = async () =>
          (await nodes()).find(
            ({ role, description }) => role === "AXStaticText" && description === "Edit field",
          )?.value;
        const clickButton = async (name: string) => {
          const button = await waitFor(async () =>
            (await nodes()).find(
              ({ role, id, position, size }) =>
                role === "AXButton" && id === name && position && size,
            ),
          );
          await probe.clickPoint(
            button.position![0] + button.size![0] / 2,
            button.position![1] + button.size![1] / 2,
          );
        };
        const copied = async () => (await runCommand(["/usr/bin/pbpaste"])).stdout.trim();
        const copy = async (expected: string) => {
          await probe.press(bundle, "Edit", "Copy");
          await waitFor(async () => ((await copied()) === expected ? true : undefined));
        };
        for (const [key, title] of Object.entries(modes)) {
          expect(await mode()).not.toBe(title);
          await app.runChecked(key);
          await waitFor(async () => ((await mode()) === title ? true : undefined));
          if (key === "vs") {
            if ((await display()) !== "0") await clickButton("Clear");
            await clickButton("Nine");
            await waitFor(async () => (await display()) === "9" || undefined);
            await app.runChecked("cr");
            await waitFor(async () => String(await display()).startsWith("√") || undefined);
            await clickButton("Equals");
            await waitFor(async () => (await display()) === "3" || undefined);
          } else if (key === "vp") {
            const base = async () => {
              const group = (await nodes()).find(({ id }) => id === "CurrentBase");
              return flattenAX(group ? [group] : []).find(
                ({ role, value }) => role === "AXRadioButton" && value === 1,
              )?.id;
            };
            const order = ["base8", "base10", "base16"];
            const initial = await waitFor(base);
            expect(order).toContain(initial);
            for (let step = 0; step < 3; step++) {
              const expected = order[(order.indexOf(initial) + step + 1) % order.length];
              await app.runChecked("cb");
              await waitFor(async () => ((await base()) === expected ? true : undefined));
            }
          }
        }

        const historyTitle = async () =>
          flattenAX([await probe.menu(bundle, "View")]).find((node) =>
            /^(?:Show|Hide) History$/.test(node.title ?? ""),
          )?.title;
        const titleFor = async (suffix: string) =>
          flattenAX([await probe.menu(bundle, "View")]).find((node) => node.title?.endsWith(suffix))
            ?.title;
        const toggleTitle = async (key: string, title: () => Promise<string | undefined>) => {
          const before = await waitFor(title);
          await app.runChecked(key);
          await waitFor(async () => {
            const after = await title();
            return after && after !== before ? true : undefined;
          });
          await app.runChecked(key);
          await waitFor(async () => ((await title()) === before ? true : undefined));
        };
        await toggleTitle("vh", historyTitle);
        await toggleTitle("vt", () => titleFor("Thousands Separator"));

        const rpn = () => control(/^(?:swap|drop|rotate stack)/i);
        const conversion = () => control(/^swap units$/i);
        for (const [key, toggle] of [
          ["vr", rpn],
          ["vc", conversion],
        ] as const) {
          const before = Boolean(await toggle());
          await app.runChecked(key);
          await waitFor(async () => (Boolean(await toggle()) !== before ? true : undefined));
          await app.runChecked(key);
          await waitFor(async () => (Boolean(await toggle()) === before ? true : undefined));
        }

        await probe.press(bundle, "View", "Basic");
        await waitFor(async () => (await mode()) === "Basic" || undefined);
        if ((await display()) !== "0") await clickButton("AllClear");
        for (const name of ["Two", "Add", "Three", "Equals"]) await clickButton(name);
        await waitFor(async () => (await display()) === "5" || undefined);
        const clipboard = Bun.spawn(["/usr/bin/pbcopy"], {
          stdin: new Blob(["placeholder"]),
          timeout: 5_000,
        });
        expect(await clipboard.exited).toBe(0);
        await app.runChecked("cc");
        await waitFor(async () => ((await copied()) === "5" ? true : undefined));
        await app.runChecked("cx");
        await copy("0");
        await probe.press(bundle, "View", originalMode);
      }),
    );
  },
  150_000,
);
