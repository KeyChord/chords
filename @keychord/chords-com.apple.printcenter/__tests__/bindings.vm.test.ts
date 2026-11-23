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
                /Unknown destination|No destinations/i.test(error.message)
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

          await app.runChecked("gc");
          await window(/completed jobs/i);
          await probe.key(13, 1 << 20);

          await app.runChecked("pa");
          await window(/add printer/i);
          await probe.key(53);
          await waitFor(async () =>
            (await probe.windows(bundleId)).every(
              (element) => !/add printer/i.test(element.title ?? ""),
            )
              ? true
              : undefined,
          );

          await probe.activate(bundleId);
          await waitFor(
            () =>
              probe.selectRow(bundleId, label).then(
                () => true,
                () => undefined,
              ),
            12_000,
          );
          const infoVisible = async () =>
            flattenAX(await probe.windows(bundleId, 9)).some((element) =>
              /^(options|supply levels)$/i.test(element.title ?? ""),
            );
          await app.runChecked("pi");
          await waitFor(async () => ((await infoVisible()) ? true : undefined));
          await probe.key(53);
          if (await infoVisible()) await probe.key(13, 1 << 20);
          await waitFor(async () => ((await infoVisible()) ? undefined : true));

          expect(await defaultPrinter()).toBe(other);
          await app.runChecked("pd");
          await waitFor(async () => ((await defaultPrinter()) === name ? true : undefined));

          const jobs = async () => (await output("-W", "not-completed", "-o", name)).trim();
          expect(await jobs()).toBe("");
          await app.runChecked("pt");
          await waitFor(async () => ((await jobs()).startsWith(name + "-") ? true : undefined));

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
