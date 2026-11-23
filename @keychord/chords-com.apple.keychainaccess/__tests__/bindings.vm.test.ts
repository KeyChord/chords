import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.keychainaccess";
const ticketViewer = "com.apple.Ticket-Viewer";
const fileDialogs = {
  fp: "Add",
  fk: "Create",
  fa: "Open",
  fi: "Open",
};
const toggles = {
  vs: "Sidebar",
  vm: "Summary",
  ve: "Expired Certificates",
  vi: "Invisible Items",
};
const sortTitles = {
  sn: "Name",
  sk: "Kind",
  sd: "Date Modified",
  se: "Expires",
  sc: "Keychain",
};

test("every Keychain Access binding has a behavior case", async () => {
  const file = Bun.file(new URL("../chords/com/apple/keychainaccess/macos.toml", import.meta.url));
  const definition = Bun.TOML.parse(await file.text()) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(
    [
      ...Object.keys(fileDialogs),
      ...Object.keys(toggles),
      ...Object.keys(sortTitles),
      "gf",
      "gv",
      "gt",
      "gc",
      "gi",
      "fe",
    ].sort(),
  );
});

test.skipIf(!macOSUITestsEnabled)(
  "Keychain Access opens its command dialogs, focuses search, and changes the viewer",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    for (const key of [
      "User Has Acknowledged Passwords App Dialog",
      "User Has Acknowledged Passwords App Dialog For New Item",
    ]) {
      await runCommand(["/usr/bin/defaults", "write", bundleId, key, "-bool", "true"]);
    }
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const viewerTitle = "Keychain Access";
        const windows = async () => flattenAX(await probe.windows(bundleId, 7));
        const viewer = async () =>
          (await probe.windows(bundleId)).find((window) => window.title === viewerTitle);
        const button = async (title: string) =>
          (await windows()).find((node) => node.role === "AXButton" && node.title === title);
        const dismissPasswordPrompt = async () => {
          if (await button("Open Keychain Access")) {
            await probe.pressControl(bundleId, "AXButton", "Open Keychain Access");
          }
        };
        await probe.activate(bundleId);
        await waitFor(async () => {
          await dismissPasswordPrompt();
          return viewer();
        }, 15_000);

        for (const [sequence, title] of Object.entries(fileDialogs)) {
          expect(await button(title)).toBeUndefined();
          await app.runChecked(sequence);
          await waitFor(async () => {
            await dismissPasswordPrompt();
            return button(title);
          }, 12_000);
          await probe.pressControl(bundleId, "AXButton", "Cancel");
          await waitFor(async () => (!(await button(title)) ? true : undefined));
        }

        await app.runChecked("gc");
        await waitFor(() => button("Reset Default Keychains…"), 10_000);
        await probe.key(13, 1 << 20); // Command-W
        await waitFor(async () => (!(await button("Reset Default Keychains…")) ? true : undefined));

        await probe.key(46, 1 << 20); // Command-M
        await waitFor(async () => ((await viewer())?.minimized ? true : undefined));
        await app.runChecked("gv");
        await waitFor(async () => {
          const window = await probe.window(bundleId);
          return window.title === viewerTitle && !window.minimized ? true : undefined;
        }, 12_000);

        const focus = async () => (await probe.focus(bundleId)).subrole === "AXSearchField";
        expect(await focus()).toBe(false);
        await app.runChecked("gf");
        await waitFor(async () => ((await focus()) ? true : undefined));

        const viewMenu = async () => flattenAX([await probe.menu(bundleId, "View")]);
        for (const [sequence, suffix] of Object.entries(toggles)) {
          const item = async () =>
            (await viewMenu()).find(
              (node) => node.title === "Show " + suffix || node.title === "Hide " + suffix,
            );
          const initial = await waitFor(item);
          await app.runChecked(sequence);
          await waitFor(async () => {
            const current = await item();
            return current && current.title !== initial.title ? current : undefined;
          });
          await app.runChecked(sequence);
          await waitFor(async () => ((await item())?.title === initial.title ? true : undefined));
        }

        const sortItem = (title: string) => probe.menu(bundleId, "View", "Sort By", title);
        const titles = Object.values(sortTitles);
        const selected = (await Promise.all(titles.map(sortItem))).find((item) => item.mark)?.title;
        try {
          for (const [sequence, title] of Object.entries(sortTitles)) {
            if ((await sortItem(title)).mark) {
              const other = titles.find((candidate) => candidate !== title)!;
              await probe.press(bundleId, "View", "Sort By", other);
              await waitFor(async () => ((await sortItem(title)).mark ? undefined : true));
            }
            await app.runChecked(sequence);
            await waitFor(async () => ((await sortItem(title)).mark ? true : undefined));
          }
        } finally {
          if (selected) await probe.press(bundleId, "View", "Sort By", selected);
        }

        expect(await probe.front()).toBe(bundleId);
        await app.runChecked("gt");
        await waitFor(async () => ((await probe.front()) === ticketViewer ? true : undefined));
        await probe.key(12, 1 << 20); // Command-Q closes the auxiliary app.
        await waitFor(async () => (!(await probe.running(ticketViewer)) ? true : undefined));
      }),
    );
  },
  240_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "Keychain Access inspects and offers export for a disposable certificate",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    const scratch = await mkdtemp(join(tmpdir(), "chordtest-keychain-"));
    const keychain = join(scratch, "Chordtest.keychain-db");
    const item = "Chordtest Certificate";
    const certificate = join(scratch, "certificate.pem");
    try {
      await runCommand([
        "/usr/bin/openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-subj",
        "/CN=" + item,
        "-keyout",
        join(scratch, "key.pem"),
        "-out",
        certificate,
      ]);
      await runCommand(["/usr/bin/security", "create-keychain", "-p", "chordtest", keychain]);
      await runCommand(["/usr/bin/security", "add-certificates", "-k", keychain, certificate]);

      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(bundleId, keychain);
          const select = async () => {
            await waitFor(async () => {
              try {
                await probe.selectRow(bundleId, "Chordtest");
                await probe.selectRow(bundleId, item);
                return (await probe.menu(bundleId, "File", "Get Info")).enabled ? true : undefined;
              } catch {
                return undefined;
              }
            }, 15_000);
          };
          await select();
          await app.runChecked("gi");
          await waitFor(async () =>
            (await probe.windows(bundleId)).find((window) => window.title?.includes(item)),
          );
          await probe.key(13, 1 << 20); // Command-W
          await waitFor(async () =>
            (await probe.windows(bundleId)).some((window) => window.title?.includes(item))
              ? undefined
              : true,
          );

          await select();
          await app.runChecked("fe");
          await waitFor(async () =>
            flattenAX(await probe.windows(bundleId, 8)).find(
              (node) =>
                node.role === "AXButton" && (node.title === "Save" || node.title === "Export"),
            ),
          );
          await probe.pressControl(bundleId, "AXButton", "Cancel");
        }),
      );
    } finally {
      try {
        if (await Bun.file(keychain).exists()) {
          await runCommand(["/usr/bin/security", "delete-keychain", keychain]);
        }
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    }
  },
  120_000,
);
