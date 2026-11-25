import { expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.Photos";
const command = 1 << 20;
const dateViews = { gy: "Years", gm: "Months", ga: "All Photos" };
const dateLabels = Object.values(dateViews);
const objects = { na: "Album", nf: "Folder" };
const panels = { vi: "Info", vk: "Keywords" };
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
        const photo = `Chordtest Photos ${crypto.randomUUID()}`;
        const fixture = join(homedir(), "Documents", photo);
        const menu = (...path: string[]) => probe.menu(bundleId, ...path);
        const controls = async () => flattenAX(await probe.windows(bundleId, 9));
        const hasButton = async (label: string) =>
          (await controls()).find(
            (node) => node.role === "AXButton" && [node.title, node.description].includes(label),
          );
        const closeSheet = async () => {
          const cancel = await hasButton("Cancel");
          if (cancel?.position && cancel.size) {
            const [x, y] = cancel.position;
            const [width, height] = cancel.size;
            await probe.clickPoint(x + width / 2, y + height / 2);
          } else {
            await probe.key(53);
          }
          await waitFor(
            async () =>
              (await controls()).some((node) => node.role === "AXSheet") ? undefined : true,
            12_000,
          );
        };
        const selectedDate = async (label: string) => {
          const nodes = await controls();
          const popup = nodes.find(
            (node) => node.role === "AXPopUpButton" && dateLabels.includes(String(node.value)),
          );
          if (popup) {
            const options = flattenAX(popup.children ?? []).filter(
              (node) => node.role === "AXMenuItem" && dateLabels.includes(node.title ?? ""),
            );
            const checked = options.find(({ mark }) => mark)?.title;
            const selection = options.length ? checked : popup.value;
            return selection === label ? popup : undefined;
          }
          return nodes.find(
            (node) =>
              node.role === "AXRadioButton" &&
              [node.title, node.description].includes(label) &&
              (node.selected === true || node.value === 1 || node.value === true),
          );
        };

        try {
          await mkdir(fixture);
          await runCommand(
            [
              "/usr/bin/swift",
              Bun.fileURLToPath(new URL("./make-photos.swift", import.meta.url)),
              fixture,
            ],
            { timeout: 90_000 },
          );
          await probe.activate(bundleId);
          await waitFor(async () => {
            const firstRun = (await hasButton("Get Started")) ?? (await hasButton("Continue"));
            if (firstRun) {
              const label = firstRun.title ?? firstRun.description!;
              try {
                await probe.pressControl(bundleId, "AXButton", label);
              } catch {
                if (await hasButton(label)) await probe.clickControl(bundleId, "AXButton", label);
              }
              return;
            }
            const main = await probe.window(bundleId);
            if (
              main.subrole === "AXStandardWindow" &&
              (await menu("File", "Import…").catch(() => undefined))?.enabled
            )
              return true;
          }, 25_000);

          // Seed the fresh library before opening the other native panels.
          await waitFor(async () => {
            const window = await probe.window(bundleId);
            return (
              (window.id === "MainWindow" &&
                window.subrole === "AXStandardWindow" &&
                (await menu("File", "Import…")).enabled) ||
              undefined
            );
          }, 15_000);

          const names = ["Chordtest Photo 1.jpg", "Chordtest Photo 2.jpg", "Chordtest Photo 3.jpg"];
          const mediaCount = async () =>
            Number(
              await probe.runAppleScript("Photos", [
                'tell application id "com.apple.Photos" to return count of media items',
              ]),
            );
          expect(await mediaCount()).toBe(0);
          const imported = await probe
            .runAppleScript(
              "Photos",
              [
                "on run paths",
                "set imageFiles to {}",
                "repeat with imagePath in paths",
                "set end of imageFiles to (POSIX file (contents of imagePath) as alias)",
                "end repeat",
                "with timeout of 55 seconds",
                'tell application id "com.apple.Photos"',
                "set importedItems to import imageFiles skip check duplicates true",
                "return count of importedItems",
                "end tell",
                "end timeout",
                "end run",
              ],
              names.map((name) => join(fixture, name)),
              { timeout: 60_000 },
            )
            .catch(async (cause: unknown) => {
              if (cause instanceof Error && cause.message.includes("(-1712)")) {
                const count = await mediaCount().catch(() => undefined);
                if (count === names.length) return String(count);
              }
              const artifacts = process.env.CHORD_TESTING_ARTIFACTS;
              if (artifacts) {
                await runCommand([
                  "/usr/sbin/screencapture",
                  "-x",
                  join(artifacts, "photos-fixture-import.png"),
                ]).catch(() => undefined);
              }
              throw new Error(
                "Photos could not import the three fixture images: " +
                  JSON.stringify({
                    front: await probe.front(),
                    window: await probe.window(bundleId),
                  }),
                { cause },
              );
            });
          expect(Number(imported)).toBe(names.length);

          console.log("Photos imported the three fixture images");

          await probe.activate(bundleId);
          const sidebarItem = async () => {
            const view = await menu("View").catch((cause: unknown) => {
              if (cause instanceof Error && cause.message.includes("The app has no menu bar")) {
                return undefined;
              }
              throw cause;
            });
            return view
              ? flattenAX([view]).find((node) => /^(Hide|Show) Sidebar$/.test(node.title ?? ""))
              : undefined;
          };
          const initialSidebar = (await waitFor(sidebarItem, 15_000)).title;
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

          await app.runChecked("ns");
          await waitFor(async () => (await controls()).find((node) => node.role === "AXSheet"));
          await closeSheet();

          const picker = async () => {
            const review = (await hasButton("Review for Import")) ?? (await hasButton("Import"));
            return review && (await hasButton("Cancel")) ? review : undefined;
          };
          expect(await picker()).toBeUndefined();
          await app.runChecked("fi");
          await waitFor(picker);
          await closeSheet();

          const openLibrary = async () => {
            const isLibrary = async () => {
              const window = await probe.window(bundleId);
              return window.id === "MainWindow" && /^Library(?:$|[ –])/.test(window.title ?? "")
                ? window
                : undefined;
            };
            if (await isLibrary()) return;
            const label = await waitFor(async () =>
              (await controls()).find(
                (node) =>
                  node.role === "AXStaticText" &&
                  [node.title, node.description, node.value].includes("Library") &&
                  node.position &&
                  node.size?.every((dimension) => dimension > 0),
              ),
            );
            const [x, y] = label.position!;
            const [width, height] = label.size!;
            await probe.clickPoint(x + width / 2, y + height / 2);
            if (await waitFor(isLibrary, 2_000).catch(() => undefined)) return;
            await probe.selectRow(bundleId, "Library");
            await waitFor(isLibrary, 12_000).catch(async (cause) => {
              throw new Error(
                "Photos did not return to Library: " +
                  JSON.stringify({
                    window: await probe.window(bundleId),
                    focus: await probe.focus(bundleId),
                  }),
                { cause },
              );
            });
          };
          await openLibrary();
          const dates = async () =>
            (await controls()).filter((node) =>
              [node.title, node.description, node.value].some((name) =>
                dateLabels.includes(String(name)),
              ),
            );
          const dateControls = await waitFor(async () => {
            const items = await dates();
            return items.length >= dateLabels.length ||
              items.some((item) => item.role === "AXPopUpButton")
              ? items
              : undefined;
          }).catch(async (cause) => {
            const roles = ["AXButton", "AXRadioButton", "AXHeading", "AXPopUpButton", "AXGroup"];
            const nodes = (await controls())
              .filter((node) => roles.includes(node.role ?? ""))
              .map(({ role, title, description, id, value, selected }) => ({
                role,
                title,
                description,
                id,
                value,
                selected,
              }));
            throw new Error(
              "Photos Library date controls did not appear: " + JSON.stringify(nodes.slice(0, 50)),
              { cause },
            );
          });
          console.log(
            "Photos date selector",
            dateControls.some((node) => node.role === "AXPopUpButton") ? "popup" : "radio buttons",
          );
          const dateCases = Object.entries(dateViews);
          if (await selectedDate("Years"))
            [dateCases[0], dateCases[1]] = [dateCases[1], dateCases[0]];
          for (const [sequence, label] of dateCases) {
            expect(await selectedDate(label)).toBeUndefined();
            await app.runChecked(sequence).catch(async (cause) => {
              const window = await probe.window(bundleId);
              const available = (await dates()).map(
                ({ role, title, description, value, enabled, position, size }) => ({
                  role,
                  title,
                  description,
                  value,
                  enabled,
                  position,
                  size,
                }),
              );
              throw new Error(
                "Photos could not activate " + label + ": " + JSON.stringify({ window, available }),
                { cause },
              );
            });
            await waitFor(() => selectedDate(label), 10_000).catch(async (cause) => {
              const state = (await dates()).map(
                ({ role, title, description, value, selected }) => ({
                  role,
                  title,
                  description,
                  value,
                  selected,
                }),
              );
              throw new Error("Photos did not select " + label + ": " + JSON.stringify(state), {
                cause,
              });
            });
          }

          const titles = () => menu("View", "Metadata", "Titles");
          const beforeTitles = await waitFor(async () => {
            const item = await titles();
            return item.enabled ? item : undefined;
          });
          await app.runChecked("vt");
          await waitFor(async () =>
            (await titles()).mark !== beforeTitles.mark ? true : undefined,
          );
          await app.runChecked("vt");
          await waitFor(async () =>
            (await titles()).mark === beforeTitles.mark ? true : undefined,
          );

          const deleteSelected = async () =>
            flattenAX([await menu("Image")]).find(
              (node) => node.enabled && /^Delete (?:\d+ )?Photos?(?:…)?$/.test(node.title ?? ""),
            );
          const selectAllPhotos = async () => {
            const selected = async () => {
              const item = await deleteSelected();
              return item?.title === "Delete 3 Photos" ? item : undefined;
            };
            await probe.key(0, command);
            const first = await waitFor(selected, 1_500).catch(() => undefined);
            if (first) return first;

            const thumbnail = (await controls()).find(
              (node) =>
                node.position &&
                node.size?.every((dimension) => dimension > 0) &&
                ((node.role === "AXGroup" && node.id === "mediaKind_asset") ||
                  (["AXCell", "AXImage", "AXButton"].includes(node.role ?? "") &&
                    [node.title, node.description, node.value].some(
                      (text) => typeof text === "string" && /\bChordtest Photo [123]\b/.test(text),
                    ))),
            );
            if (thumbnail?.position && thumbnail.size) {
              const [x, y] = thumbnail.position;
              const [width, height] = thumbnail.size;
              await probe.clickPoint(x + width / 2, y + height / 2);
            } else {
              await probe.key(124);
            }
            await waitFor(async () => (await menu("Edit", "Select All")).enabled || undefined);
            await probe.press(bundleId, "Edit", "Select All");
            return waitFor(selected, 6_000).catch(async (cause) => {
              throw new Error(
                "Photos did not select all three fixture images: " +
                  JSON.stringify({
                    focused: await probe.focus(bundleId),
                    deleteCommand: await deleteSelected(),
                    thumbnail,
                  }),
                { cause },
              );
            });
          };
          await selectAllPhotos();

          for (const [sequence, title] of Object.entries(panels)) {
            const panel = async () =>
              (await probe.windows(bundleId)).find((node) => node.title === title);
            expect(await panel()).toBeUndefined();
            await app.runChecked(sequence);
            await waitFor(panel, 12_000).catch(async (cause) => {
              throw new Error(
                `Photos did not open ${title}: ${JSON.stringify(await probe.windows(bundleId, 2))}`,
                { cause },
              );
            });
            await probe.closeWindow(bundleId, title);
            await waitFor(async () => !(await panel()) || undefined);
            console.log("Photos " + title + " passed");
          }

          await app.runChecked("fe");
          await waitFor(
            async () => (await hasButton("Export Originals")) ?? (await hasButton("Export")),
          );
          await closeSheet();
          console.log("Photos Export passed");

          const createCollection = async (sequence: string, kind: string) => {
            const name = "Untitled " + kind;
            const exists = async () =>
              (await controls()).some((node) =>
                [node.title, node.value, node.description].includes(name),
              );
            expect(await exists()).toBe(false);
            await app.runChecked(sequence);
            await waitFor(async () => (await exists()) || undefined);
            if ((await probe.focus(bundleId)).role === "AXTextField") await probe.key(36);
            await waitFor(async () => (await exists()) || undefined);
            console.log("Photos created " + name);
          };

          await createCollection("nf", objects.nf);
          await openLibrary();
          await selectAllPhotos();
          await createCollection("na", objects.na);
          await openLibrary();
          const deleteCommand = await selectAllPhotos();
          expect(await mediaCount()).toBe(3);
          await app.runChecked("pd");
          await waitFor(async () => {
            const confirmation =
              (await hasButton("Delete")) ?? (await hasButton("Delete 3 Photos"));
            if (confirmation?.enabled) {
              const title = confirmation.title ?? confirmation.description!;
              await probe.pressControl(bundleId, "AXButton", title);
            }
            return (await mediaCount()) === 0 || undefined;
          }, 15_000).catch(async (cause) => {
            throw new Error(
              "Photos did not remove the three selected photos: " +
                JSON.stringify({ mediaCount: await mediaCount(), deleteCommand }),
              { cause },
            );
          });
          console.log("Photos deleted the three selected photos");

          if (initialSidebar === "Show Sidebar") await app.runChecked("vsh");
        } finally {
          await probe.key(53).catch(() => {});
          await rm(fixture, { recursive: true, force: true });
        }
      }),
    ),
  260_000,
);
