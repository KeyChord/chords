import { expect, test } from "bun:test";
import {
  flattenAX,
  runCommand,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.printcenter";
const addPrinterApp = "com.apple.print.add";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/printcenter/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };
const sequences = Object.keys(definition.chords)
  .filter((key) => !key.startsWith("?"))
  .sort();

test("every Print Center binding has a behavior case", () => {
  expect(sequences).toEqual(["gc", "pa", "pd", "pi", "pt", "px"]);
});

test.skipIf(!macOSUITestsEnabled)(
  "Print Center opens its printer and jobs windows and manages a disposable print queue",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const name = "KeyChord-Q-" + process.pid;
        const other = name + "-default";
        const label = "KeyChord Test Printer";
        const printerAdmin = (args: string[]) =>
          runCommand(["/usr/bin/sudo", "-n", "/usr/sbin/lpadmin", ...args]);
        const output = async (...args: string[]) =>
          (await runCommand(["/usr/bin/lpstat", ...args])).stdout;
        const defaultPrinter = async () =>
          /^system default destination:\s*(\S+)/m.exec(await output("-d"))?.[1];
        const previousDefault = await defaultPrinter();
        const printQueueExists = async (printer: string) =>
          output("-p", printer).then(
            (status) => status.startsWith("printer " + printer + " "),
            (error: unknown) => {
              if (
                error instanceof Error &&
                /Unknown destination|No destinations|Invalid destination name in list/i.test(
                  error.message,
                )
              )
                return false;
              throw error;
            },
          );
        const createQueue = (printer: string, description: string) =>
          printerAdmin([
            "-p",
            printer,
            "-D",
            description,
            "-v",
            "socket://127.0.0.1:9",
            "-m",
            "drv:///sample.drv/generic.ppd",
            "-E",
          ]);

        // Keep a local queue paused so the test page never leaves the guest.
        try {
          await createQueue(name, label);
          await createQueue(other, "KeyChord Initial Default");
          await printerAdmin(["-d", other]);
          await runCommand(["/usr/bin/sudo", "-n", "/usr/sbin/cupsdisable", name]);
          await probe.activate(bundleId);
          const window = (pattern: RegExp) =>
            waitFor(
              async () =>
                (await probe.windows(bundleId)).find((element) =>
                  pattern.test(element.title ?? ""),
                ),
              12_000,
            );
          const readyMenu = (...path: string[]) =>
            waitFor(async () => {
              const item = await probe.menu(bundleId, ...path).catch(() => undefined);
              return item?.enabled || undefined;
            }, 12_000);

          await readyMenu("Window", "Completed Jobs");
          await app.runChecked("gc");
          const completed = await window(/completed jobs/i);
          console.log("Print Center gc passed");
          await probe.closeWindow(bundleId, completed.title!);
          await waitFor(
            async () =>
              (await probe.windows(bundleId)).every(({ title }) => title !== completed.title) ||
              undefined,
          );

          const addPrinter = async () => {
            const front = await probe.front();
            for (const app of new Set([addPrinterApp, bundleId, front])) {
              const dialog = (await probe.windows(app).catch(() => [])).find(({ title }) =>
                /add printer/i.test(title ?? ""),
              );
              if (dialog) return { app, dialog };
            }
          };
          expect(await addPrinter()).toBeUndefined();
          const windowsBefore = new Set((await probe.screenWindows()).map(({ number }) => number));
          await readyMenu("Printer", "Add Printer…");
          await app.runChecked("pa");
          let authorized = false;
          const panel = await waitFor(async () => {
            const dialog = await addPrinter();
            if (dialog) return dialog;
            if (authorized) return;
            const approval = (await probe.screenWindows()).some(
              ({ owner, number }) => owner === "coreautha" && !windowsBefore.has(number),
            );
            if (!approval) return;
            const focus = await probe
              .focus("com.apple.LocalAuthentication.UIAgent")
              .catch(() => undefined);
            if (focus?.subrole !== "AXSecureTextField" || !focus.focused) return;

            // This is the public credentials fixture for the disposable Tart guest.
            for (const key of [0, 2, 46, 34, 45]) await probe.key(key);
            await probe.key(36);
            authorized = true;
          }, 15_000).catch(async (cause) => {
            throw new Error(
              "Add Printer did not open a visible panel: " +
                JSON.stringify({
                  front: await probe.front(),
                  windows: await probe.screenWindows(),
                }),
              { cause },
            );
          });
          console.log("Print Center pa passed");
          try {
            await probe.pressControl(panel.app, "AXButton", "Cancel").catch(async () => {
              await probe.raiseWindow(panel.app, panel.dialog.title!);
              await probe.key(53);
            });
          } finally {
            if (await addPrinter()) await probe.closeWindow(panel.app, panel.dialog.title!);
            await waitFor(async () => !(await addPrinter()) || undefined);
          }

          await probe.activate(bundleId);
          const controls = async () => flattenAX(await probe.windows(bundleId, 9));
          if (
            (await controls()).some(
              (node) => node.role === "AXButton" && node.description === "Show Sidebar",
            )
          ) {
            await probe.press(bundleId, "View", "Toggle Sidebar");
          }
          const queue = async () => {
            const sidebar = (await controls()).find(
              (node) => node.role === "AXOutline" && node.description === "Sidebar",
            );
            return flattenAX(sidebar ? [sidebar] : []).find(
              (node) =>
                ["AXRow", "AXCell", "AXStaticText", "AXButton", "AXUnknown"].includes(
                  node.role ?? "",
                ) &&
                [node.title, node.description, node.value].some(
                  (value) =>
                    typeof value === "string" &&
                    (value === name || value === label || value.startsWith(label + ",")),
                ),
            );
          };
          const printer = await waitFor(queue, 12_000).catch(async (cause) => {
            const visible = (await controls())
              .map(({ role, title, description, value, position, size }) => ({
                role,
                title,
                description,
                value,
                position,
                size,
              }))
              .filter(({ title, description, value }) => title || description || value);
            throw new Error(
              "Print Center did not list the disposable queue: " +
                JSON.stringify(visible.slice(0, 55)),
              { cause },
            );
          });
          if (printer.position && printer.size?.every((dimension) => dimension > 0)) {
            const [x, y] = printer.position;
            const [width, height] = printer.size;
            await probe.clickPoint(x + width / 2, y + height / 2);
          } else {
            const nativeLabel = [printer.description, printer.title, printer.value].find(
              (value): value is string => typeof value === "string" && value.startsWith(label),
            );
            if (!nativeLabel) throw new Error("The disposable print queue has no visible control");
            await probe.pressControl(bundleId, printer.role!, nativeLabel);
          }
          await waitFor(async () => {
            const window = await probe.window(bundleId);
            const selected = (await queue())?.selected || window.title?.startsWith(label);
            return (
              (selected && (await probe.menu(bundleId, "Printer", "Printer Info…")).enabled) ||
              undefined
            );
          });
          const infoPanel = async () => {
            const windows = [
              await probe.window(bundleId, 8),
              ...(await probe.windows(bundleId, 8)),
            ];
            const sheets = flattenAX(windows).filter(({ role }) => role === "AXSheet");
            return [...sheets, ...windows].find((panel) =>
              flattenAX([panel]).some((element) =>
                [element.title, element.description, element.value].some(
                  (text) => typeof text === "string" && /^(options|supply levels)$/i.test(text),
                ),
              ),
            );
          };
          await app.runChecked("pi");
          const info = await waitFor(infoPanel);
          console.log("Print Center pi passed");
          const dismiss = flattenAX([info]).find(
            (item) =>
              item.role === "AXButton" &&
              item.enabled &&
              item.position &&
              item.size?.every((dimension) => dimension > 0) &&
              [item.title, item.description].some((text) => /^(OK|Done|Close)$/i.test(text ?? "")),
          );
          if (dismiss) {
            const [x, y] = dismiss.position!;
            const [width, height] = dismiss.size!;
            await probe.clickPoint(x + width / 2, y + height / 2);
          } else if (info.role === "AXWindow" && (info.id || info.title)) {
            await probe.closeWindow(bundleId, (info.id || info.title)!).catch(async () => {
              await probe.raiseWindow(bundleId, (info.id || info.title)!);
              await probe.key(13, 1 << 20);
            });
          } else {
            await probe.key(53);
          }
          await waitFor(async () => !(await infoPanel()) || undefined, 12_000).catch(
            async (cause) => {
              const remaining = await infoPanel();
              throw new Error(
                "Print Center did not dismiss Printer Info: " +
                  JSON.stringify(
                    remaining && { role: remaining.role, title: remaining.title, id: remaining.id },
                  ),
                { cause },
              );
            },
          );

          expect(await defaultPrinter()).toBe(other);
          await app.runChecked("pd");
          await waitFor(async () => ((await defaultPrinter()) === name ? true : undefined));
          console.log("Print Center pd passed");

          const jobs = async () => (await output("-W", "not-completed", "-o", name)).trim();
          expect(await jobs()).toBe("");
          await app.runChecked("pt");
          await waitFor(async () => ((await jobs()).startsWith(name + "-") ? true : undefined));
          console.log("Print Center pt passed");

          await app.runChecked("px");
          await waitFor(async () => {
            if (!(await printQueueExists(name))) return true;
            const button = flattenAX(await probe.windows(bundleId, 9)).find(
              (item) =>
                item.role === "AXButton" && /^(remove|delete)( printer)?$/i.test(item.title ?? ""),
            );
            if (button?.title) {
              await probe.pressControl(bundleId, "AXButton", button.title);
              return true;
            }
          });
          await waitFor(async () => (!(await printQueueExists(name)) ? true : undefined));
          console.log("Print Center px passed");
        } finally {
          for (const printer of [name, other]) {
            if (await printQueueExists(printer)) await printerAdmin(["-x", printer]);
          }
          if (previousDefault) await printerAdmin(["-d", previousDefault]);
        }
      }),
    );
  },
  150_000,
);
