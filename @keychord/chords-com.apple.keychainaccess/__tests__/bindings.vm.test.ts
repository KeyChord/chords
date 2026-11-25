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
  type AXNode,
  type MacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.keychainaccess";
const ticketViewer = "com.apple.Ticket-Viewer";
const viewerTitle = "Keychain Access";
const fileDialogs = {
  fp: ["Add"],
  fk: ["Create…"],
  fa: ["Add", "Open"],
  fi: ["Open", "Import"],
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

async function dismissPasswordPrompt(probe: MacOSProbe) {
  const open = flattenAX(await probe.windows(bundleId, 7).catch(() => [])).find(
    ({ role, title }) => role === "AXButton" && title === "Open Keychain Access",
  );
  if (!open?.position || !open.size) return false;
  await probe.clickPoint(open.position[0] + open.size[0] / 2, open.position[1] + open.size[1] / 2);
  return true;
}

async function readyViewer(probe: MacOSProbe) {
  const hasViewer = async () =>
    (await probe.windows(bundleId).catch(() => [])).some(({ title }) => title === viewerTitle);
  await waitFor(async () => {
    if (await dismissPasswordPrompt(probe)) return;
    if (await hasViewer()) return true;
    return (
      (await probe.menu(bundleId, "Window", "Keychain Viewer").catch(() => undefined))?.enabled ||
      undefined
    );
  }, 15_000);
  if (!(await hasViewer())) await probe.press(bundleId, "Window", "Keychain Viewer");
  await waitFor(async () => (await hasViewer()) || undefined, 15_000);
  await probe.activate(bundleId);
  await probe.raiseWindow(bundleId, viewerTitle);
  await waitFor(
    async () => (await probe.window(bundleId)).title === viewerTitle || undefined,
    12_000,
  );
}

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
        const windows = async () => {
          const focused = await probe.window(bundleId, 8);
          const all = await probe.windows(bundleId, 8);
          return flattenAX(focused.title === viewerTitle ? all : [focused, ...all]);
        };
        const viewer = async () =>
          (await probe.windows(bundleId)).find((window) => window.title === viewerTitle);
        const button = async (...titles: string[]) =>
          (await windows()).find(
            (node) =>
              node.role === "AXButton" &&
              titles.some((title) => [node.title, node.description].includes(title)),
          );
        await runCommand(["/usr/bin/open", "-b", bundleId]);
        await readyViewer(probe);
        await probe.selectRow(bundleId, "login");
        await waitFor(
          async () =>
            (await probe.menu(bundleId, "File", "New Password Item…")).enabled || undefined,
        );

        for (const [sequence, titles] of Object.entries(fileDialogs)) {
          expect(await button(...titles)).toBeUndefined();
          try {
            await app.runChecked(sequence);
            await waitFor(async () => {
              await dismissPasswordPrompt(probe);
              return button(...titles);
            }, 12_000).catch(async (cause) => {
              const controls = (await windows())
                .filter(
                  ({ role, title, description, id }) =>
                    role === "AXWindow" ||
                    role === "AXSheet" ||
                    (["AXButton", "AXTextField"].includes(role ?? "") &&
                      (title || description || id)),
                )
                .map(({ role, title, description, id }) => ({ role, title, description, id }));
              throw new Error(
                `Keychain Access ${sequence} did not show its dialog: ` +
                  JSON.stringify(controls.slice(0, 35)),
                { cause },
              );
            });
          } finally {
            const cancel = await button("Cancel");
            if (cancel?.position && cancel.size) {
              await probe.pressControl(bundleId, "AXButton", "Cancel").catch(async () => {
                const [x, y] = cancel.position!;
                const [width, height] = cancel.size!;
                await probe.clickPoint(x + width / 2, y + height / 2);
              });
              await waitFor(async () => !(await button(...titles)) || undefined, 8_000).catch(
                async (cause) => {
                  const focused = await probe.window(bundleId);
                  throw new Error(
                    `Keychain Access ${sequence} dialog did not close: ${JSON.stringify(focused)}`,
                    { cause },
                  );
                },
              );
            }
          }
        }

        await app.runChecked("gc");
        await waitFor(() => button("Reset Default Keychains…"), 10_000);
        await probe.key(13, 1 << 20); // Command-W
        await waitFor(async () => (!(await button("Reset Default Keychains…")) ? true : undefined));

        await readyViewer(probe);
        await probe.press(bundleId, "Window", "Minimize");
        await waitFor(async () => ((await viewer())?.minimized ? true : undefined), 12_000);
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

        expect(await probe.front()).toBe(bundleId);
        await app.runChecked("gt");
        await waitFor(async () => ((await probe.front()) === ticketViewer ? true : undefined));
        const quit = ["Ticket Viewer", "Quit Ticket Viewer"];
        await waitFor(
          async () =>
            (await probe.menu(ticketViewer, ...quit).catch(() => undefined))?.enabled || undefined,
        );
        await probe.press(ticketViewer, ...quit);
        await waitFor(async () => !(await probe.running(ticketViewer)) || undefined);
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
    const listKeychains = ["/usr/bin/security", "list-keychains", "-d", "user"];
    const { stdout } = await runCommand(listKeychains);
    const originalKeychains = Array.from(stdout.matchAll(/"([^"]+)"/g), ([, path]) => path);
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
      await runCommand(["/usr/bin/security", "unlock-keychain", "-p", "chordtest", keychain]);
      await runCommand(["/usr/bin/security", "add-certificates", "-k", keychain, certificate]);
      await runCommand(["/usr/bin/security", "find-certificate", "-c", item, keychain]);
      await runCommand([...listKeychains, "-s", ...originalKeychains, keychain]);

      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          if (await probe.running(bundleId)) {
            await probe.press(bundleId, "Keychain Access", "Quit Keychain Access");
            await waitFor(async () => !(await probe.running(bundleId)) || undefined);
          }
          await probe.activate(bundleId);
          await readyViewer(probe);
          const select = async () => {
            const keychains = async () => flattenAX(await probe.windows(bundleId, 9));
            const isFixtureKeychain = (label: unknown): label is string =>
              typeof label === "string" && /^Chordtest(?:\.keychain-db)?$/.test(label);
            const fixtureRow = async () =>
              (await keychains()).find(
                (node) =>
                  node.role === "AXRow" &&
                  flattenAX([node]).some(({ title, description, value }) =>
                    [title, description, value].some(isFixtureKeychain),
                  ),
              );
            const fixtureKeychain = await waitFor(
              async () =>
                (await keychains()).find(
                  (node) =>
                    node.position &&
                    node.size &&
                    ["AXCell", "AXStaticText", "AXRow"].includes(node.role ?? "") &&
                    [node.title, node.description, node.value].some(isFixtureKeychain),
                ),
              12_000,
            ).catch(async (cause) => {
              const labels = (await keychains())
                .filter(({ role }) => ["AXOutline", "AXCell", "AXStaticText"].includes(role ?? ""))
                .map(({ role, title, description, value }) => ({
                  role,
                  title,
                  description,
                  value,
                }));
              throw new Error(
                "The disposable keychain did not appear: " + JSON.stringify(labels.slice(0, 35)),
                { cause },
              );
            });
            const [keychainX, keychainY] = fixtureKeychain.position!;
            const [keychainWidth, keychainHeight] = fixtureKeychain.size!;
            await probe.clickPoint(keychainX + keychainWidth / 2, keychainY + keychainHeight / 2);
            const selected = await fixtureRow();
            if (selected && !selected.selected) {
              const keychainLabel = [
                fixtureKeychain.title,
                fixtureKeychain.description,
                fixtureKeychain.value,
              ].find(isFixtureKeychain)!;
              await probe.selectRow(bundleId, keychainLabel);
            }
            const identifiesCertificate = (text: unknown) =>
              typeof text === "string" && text.replace(/^\uFFFC\s*/, "").trim() === item;
            const matches = ({ title, description, value, position, size }: AXNode) =>
              position && size && [title, description, value].some(identifiesCertificate);
            const findCertificate = async () => {
              const rows = flattenAX(await probe.visibleRows(bundleId, 5));
              return rows.find(matches) ?? (await keychains()).find(matches);
            };
            if (!(await findCertificate())) {
              const category = (await keychains()).find(
                (node) =>
                  ["AXRadioButton", "AXButton", "AXTab"].includes(node.role ?? "") &&
                  [node.title, node.description, node.value].includes("Certificates") &&
                  node.position &&
                  node.size,
              );
              if (category && !category.selected && category.value !== 1) {
                const [categoryX, categoryY] = category.position!;
                const [categoryWidth, categoryHeight] = category.size!;
                await probe.clickPoint(
                  categoryX + categoryWidth / 2,
                  categoryY + categoryHeight / 2,
                );
              }
            }
            const cell = await waitFor(findCertificate, 12_000).catch(async (cause) => {
              const labels = (await keychains()).filter(
                (node) =>
                  node.role === "AXRadioButton" ||
                  node.role === "AXTable" ||
                  (node.role === "AXCell" &&
                    [node.value, node.description, node.title].some(Boolean)),
              );
              const row = await fixtureRow();
              throw new Error(
                "Keychain Access did not display its disposable certificate: " +
                  JSON.stringify({
                    selected: row?.selected,
                    labels: labels.slice(0, 30).map(({ children: _children, ...node }) => node),
                  }),
                { cause },
              );
            });
            const [x, y] = cell.position!;
            const [width, height] = cell.size!;
            await probe.clickPoint(x + width / 2, y + height / 2);
            const itemInfoEnabled = async () =>
              (await probe.menu(bundleId, "File", "Get Info")).enabled || undefined;
            if (!(await itemInfoEnabled())) {
              const label = [cell.value, cell.title, cell.description].find(
                (value): value is string =>
                  typeof value === "string" && identifiesCertificate(value),
              );
              await probe.selectRow(bundleId, label!);
            }
            await waitFor(itemInfoEnabled);
          };
          await select();
          await app.runChecked("gi");
          const info = async () =>
            (await probe.windows(bundleId)).find((window) => window.title?.includes(item));
          const inspected = await waitFor(info, 12_000);
          console.log("Keychain Access gi passed");
          await probe.closeWindow(bundleId, inspected.title!);
          if (
            !(await waitFor(async () => !(await info()) || undefined, 2_000).catch(() => false))
          ) {
            await probe.raiseWindow(bundleId, inspected.title!);
            await probe.key(13, 1 << 20);
          }
          await waitFor(async () => !(await info()) || undefined, 12_000);

          await select();
          await app.runChecked("fe");
          const exportButton = async () =>
            flattenAX(await probe.windows(bundleId, 8)).find(
              (node) =>
                node.role === "AXButton" && (node.title === "Save" || node.title === "Export"),
            );
          await waitFor(exportButton);
          console.log("Keychain Access fe passed");
          await probe.pressControl(bundleId, "AXButton", "Cancel");
          await waitFor(async () => !(await exportButton()) || undefined, 12_000);
          await readyViewer(probe);

          const sortItem = (title: string) => probe.menu(bundleId, "View", "Sort By", title);
          const columns = async () =>
            flattenAX([await probe.window(bundleId, 9)]).filter(
              ({ sortDirection }) =>
                sortDirection === "AXAscendingSortDirection" ||
                sortDirection === "AXDescendingSortDirection",
            );
          const sortedBy = async (title: string) => {
            if ((await sortItem(title)).mark) return true;
            return (await columns()).some((column) =>
              [column.title, column.description, column.value].some(
                (label) =>
                  typeof label === "string" && (label === title || label.startsWith(title + " ")),
              ),
            );
          };
          const titles = Object.values(sortTitles);
          let selected: string | undefined;
          for (const title of titles) {
            if (await sortedBy(title)) {
              selected = title;
              break;
            }
          }
          try {
            for (const [sequence, title] of Object.entries(sortTitles)) {
              if (await sortedBy(title)) {
                const alternate = titles.find((candidate) => candidate !== title)!;
                await probe.press(bundleId, "View", "Sort By", alternate);
                await waitFor(async () => (await sortedBy(alternate)) || undefined);
              }
              await waitFor(async () => (await sortItem(title)).enabled || undefined);
              await app.runChecked(sequence);
              await waitFor(async () => (await sortedBy(title)) || undefined).catch(
                async (cause) => {
                  const state = {
                    menu: await Promise.all(titles.map(sortItem)),
                    columns: (await columns()).map(({ title, description, sortDirection }) => ({
                      title,
                      description,
                      sortDirection,
                    })),
                  };
                  throw new Error(
                    `Keychain Access did not sort by ${title}: ${JSON.stringify(state)}`,
                    { cause },
                  );
                },
              );
              console.log(`Keychain Access ${sequence} passed`);
            }
          } finally {
            if (selected) await probe.press(bundleId, "View", "Sort By", selected);
          }
        }),
      );
    } finally {
      try {
        await runCommand([...listKeychains, "-s", ...originalKeychains]);
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
