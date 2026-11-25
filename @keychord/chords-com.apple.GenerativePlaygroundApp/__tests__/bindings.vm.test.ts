import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.GenerativePlaygroundApp";
const caseKeys = ["ni", "vs"];

test("every Image Playground binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/GenerativePlaygroundApp/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((sequence) => !sequence.startsWith("?"))
      .sort(),
  ).toEqual(caseKeys.sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Image Playground opens its composer and toggles the sidebar when available",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await probe.activate(bundleId);
        const controls = async () => flattenAX(await probe.windows(bundleId, 8));
        const newImage = () => probe.menu(bundleId, "File", "New Image");
        await waitFor(async () => {
          const screen = await controls();
          const onboarding = screen.find(
            (node) =>
              node.role === "AXButton" &&
              [node.title, node.description].some(
                (label) => label === "Continue" || label === "Get Started",
              ),
          );
          if (onboarding) {
            await probe.pressControl(
              bundleId,
              "AXButton",
              onboarding.title ?? onboarding.description!,
            );
            return;
          }
          if (screen.length && (await newImage().catch(() => undefined))) return true;
        }, 15_000);

        const composer = async () =>
          (await controls()).find(
            (node) =>
              (node.role === "AXTextField" || node.role === "AXTextArea") &&
              [node.title, node.description, node.id].some((label) =>
                /describe|prompt/i.test(label ?? ""),
              ),
          );
        const unavailableAlert = async () =>
          (await controls()).find(
            (node) =>
              node.role === "AXSheet" &&
              flattenAX(node.children ?? []).some(
                (child) => child.value === "Image Playground Unavailable",
              ),
          );
        const item = await newImage();
        if (item.enabled === false) {
          await app.expectFailure("ni", /Menu item .*New Image.*is disabled/);
        } else {
          expect(await composer()).toBeUndefined();
          expect(await unavailableAlert()).toBeUndefined();
          await app.runChecked("ni");
          await waitFor(async () => (await composer()) ?? (await unavailableAlert()), 12_000);
          const alert = await unavailableAlert();
          if (alert) {
            expect(
              flattenAX([alert]).some(
                (node) =>
                  typeof node.value === "string" &&
                  /^Image Playground is not available when your Siri language is set to .+\.$/.test(
                    node.value,
                  ),
              ),
            ).toBe(true);
            await probe.pressControl(bundleId, "AXButton", "OK");
            await waitFor(async () => ((await unavailableAlert()) ? undefined : true));
          } else {
            await probe.key(53);
            await waitFor(async () => ((await composer()) ? undefined : true));
          }
        }

        const sidebar = async () =>
          flattenAX([await probe.menu(bundleId, "View")]).find(
            (node) => node.title === "Show Sidebar" || node.title === "Hide Sidebar",
          );
        const before = await waitFor(sidebar);
        if (before.enabled === false) {
          await app.expectFailure("vs", /Menu item .*Sidebar.*is disabled/);
        } else {
          await app.runChecked("vs");
          await waitFor(async () => {
            const after = await sidebar();
            return after && after.title !== before.title ? true : undefined;
          });
          await app.runChecked("vs");
          await waitFor(async () => ((await sidebar())?.title === before.title ? true : undefined));
        }
      }),
    ),
  90_000,
);
