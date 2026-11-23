import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.Photos";
const command = 1 << 20;
const shift = 1 << 17;
const dateViews = { gy: "Years", gm: "Months", ga: "All Photos" };
const objects = { na: "Album", nf: "Folder" };
const panels = { vi: "Info", vk: "Keyword Manager" };
const caseKeys = [
  ...Object.keys(dateViews),
  ...Object.keys(objects),
  ...Object.keys(panels),
  "ns",
  "fi",
  "fe",
  "jf",
  "vss",
  "vsh",
  "vt",
  "pd",
];

// A locally generated 64-by-48 RGB photo for the disposable guest library.
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAZElEQVR4nO3PUQkAIBTAwFfNSuY0lCH8OITBAtzmrP11wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY8dgFGIvUA4YIaoAAAAABJRU5ErkJggg==";

test("every Photos binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Photos/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((sequence) => !sequence.startsWith("?"))
      .sort(),
  ).toEqual(caseKeys.sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Photos chords navigate and change a disposable photo library",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        const directory = await mkdtemp(join(tmpdir(), "chordtest-photos-"));
        const photo = "Chordtest visual photo.png";
        const menu = (...path: string[]) => probe.menu(bundleId, ...path);
        const controls = async () => flattenAX(await probe.windows(bundleId, 9));
        const hasButton = async (label: string) =>
          (await controls()).find(
            (node) => node.role === "AXButton" && [node.title, node.description].includes(label),
          );
        const closeSheet = async () => {
          await probe.key(53);
          await waitFor(async () =>
            (await controls()).some((node) => node.role === "AXSheet") ? undefined : true,
          );
        };
        const paste = async (value: string) => {
          const copy = Bun.spawn(["/usr/bin/pbcopy"], { stdin: "pipe" });
          copy.stdin.end(value);
          expect(await copy.exited).toBe(0);
          await probe.key(9, command);
        };
        const selectedDate = async (label: string) =>
          (await controls()).find(
            (node) =>
              [node.title, node.description, node.value].includes(label) &&
              (node.selected === true || node.value === 1),
          );

        try {
          await Bun.write(
            join(directory, photo),
            Uint8Array.from(atob(png), (byte) => byte.charCodeAt(0)),
          );
          await probe.activate(bundleId);
          await waitFor(async () => {
            const firstRun = (await hasButton("Get Started")) ?? (await hasButton("Continue"));
            if (firstRun) {
              await probe.pressControl(
                bundleId,
                "AXButton",
                firstRun.title ?? firstRun.description!,
              );
              return;
            }
            const main = await probe.window(bundleId);
            if (
              main.subrole === "AXStandardWindow" &&
              (await menu("File", "Import…").catch(() => undefined))?.enabled
            )
              return true;
          }, 25_000);

          const sidebarItem = async () =>
            flattenAX([await menu("View")]).find((node) =>
              /^(Hide|Show) Sidebar$/.test(node.title ?? ""),
            );
          const initialSidebar = (await waitFor(sidebarItem)).title;
          if (initialSidebar === "Show Sidebar") {
            await app.runChecked("vss");
            await waitFor(async () =>
              (await sidebarItem())?.title === "Hide Sidebar" ? true : undefined,
            );
          }
          await app.runChecked("vsh");
          await waitFor(async () =>
            (await sidebarItem())?.title === "Show Sidebar" ? true : undefined,
          );
          await app.runChecked("vss");
          await waitFor(async () =>
            (await sidebarItem())?.title === "Hide Sidebar" ? true : undefined,
          );

          await app.runChecked("jf");
          await waitFor(async () => {
            const focus = await probe.focus(bundleId);
            return focus.subrole === "AXSearchField" ||
              (focus.role === "AXTextField" && /search/i.test(focus.id ?? focus.description ?? ""))
              ? true
              : undefined;
          });
          await probe.key(53);

          const titles = () => menu("View", "Metadata", "Titles");
          const beforeMark = (await titles()).mark;
          await app.runChecked("vt");
          await waitFor(async () => ((await titles()).mark !== beforeMark ? true : undefined));
          await app.runChecked("vt");
          await waitFor(async () => ((await titles()).mark === beforeMark ? true : undefined));

          for (const [sequence, kind] of Object.entries(objects)) {
            const name = "Untitled " + kind;
            const exists = async () =>
              (await controls()).some((node) =>
                [node.title, node.value, node.description].includes(name),
              );
            expect(await exists()).toBe(false);
            await app.runChecked(sequence);
            await waitFor(async () => ((await exists()) ? true : undefined));
            if ((await probe.focus(bundleId)).role === "AXTextField") await probe.key(36);
            await probe.key(6, command);
            await waitFor(async () => ((await exists()) ? undefined : true));
          }

          await app.runChecked("ns");
          await waitFor(async () => (await controls()).find((node) => node.role === "AXSheet"));
          await closeSheet();

          await app.runChecked("fi");
          await waitFor(
            async () => (await hasButton("Review for Import")) ?? (await hasButton("Import")),
          );
          await probe.key(5, command | shift);
          await waitFor(async () => {
            const focus = await probe.focus(bundleId);
            return focus.role === "AXTextField" || focus.role === "AXComboBox" ? true : undefined;
          });
          await paste(directory);
          await probe.key(36);
          await waitFor(async () =>
            (await controls()).find((node) => node.value === photo || node.title === photo),
          );
          await probe.selectRow(bundleId, photo);
          const review = await waitFor(async () => {
            const button = (await hasButton("Review for Import")) ?? (await hasButton("Import"));
            return button?.enabled === true ? button : undefined;
          });
          await probe.pressControl(bundleId, "AXButton", review.title ?? review.description!);
          const importButton = await waitFor(async () => {
            const button =
              (await hasButton("Import All New Photos")) ??
              (await hasButton("Import 1 Selected")) ??
              (await hasButton("Import 1 Photo"));
            if (button) return button;
            if ((await menu("Image", "Delete Photo").catch(() => undefined))?.enabled) return null;
          }, 15_000);
          if (importButton) {
            await probe.pressControl(
              bundleId,
              "AXButton",
              importButton.title ?? importButton.description!,
            );
          }

          await waitFor(async () => {
            const candidate = (await controls()).find((node) =>
              [node.title, node.description, node.value].includes("Library"),
            );
            if (candidate) return candidate;
          }, 15_000);
          await probe.selectRow(bundleId, "Library");
          for (const [sequence, label] of Object.entries(dateViews)) {
            expect(await selectedDate(label)).toBeUndefined();
            await app.runChecked(sequence);
            await waitFor(() => selectedDate(label), 10_000);
          }
          await probe.key(0, command);
          await waitFor(
            async () => ((await menu("Image", "Delete Photo")).enabled ? true : undefined),
            10_000,
          );

          for (const [sequence, title] of Object.entries(panels)) {
            const panel = async () =>
              (await probe.windows(bundleId)).find((node) => node.title === title);
            expect(await panel()).toBeUndefined();
            await app.runChecked(sequence);
            await waitFor(panel);
            if ((await probe.window(bundleId)).title !== title)
              await probe.raiseWindow(bundleId, title);
            await probe.key(13, command);
            await waitFor(async () => ((await panel()) ? undefined : true));
          }

          await app.runChecked("fe");
          await waitFor(
            async () => (await hasButton("Export Originals")) ?? (await hasButton("Export")),
          );
          await closeSheet();

          await app.runChecked("pd");
          await waitFor(async () => {
            const confirmation = (await hasButton("Delete")) ?? (await hasButton("Delete Photo"));
            if (confirmation) {
              await probe.pressControl(
                bundleId,
                "AXButton",
                confirmation.title ?? confirmation.description!,
              );
            }
            const action = await menu("Image", "Delete Photo").catch(() => undefined);
            const edit = flattenAX([await menu("Edit")]);
            return action?.enabled !== true &&
              edit.some((node) => node.title?.startsWith("Undo Delete"))
              ? true
              : undefined;
          });
          if (initialSidebar === "Show Sidebar") await app.runChecked("vsh");
        } finally {
          await probe.key(53).catch(() => {});
          await rm(directory, { recursive: true, force: true });
        }
      }),
    ),
  260_000,
);
