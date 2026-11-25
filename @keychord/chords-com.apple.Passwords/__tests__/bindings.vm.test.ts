import { expect, test } from "bun:test";
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

const passwords = "com.apple.Passwords";
const command = 1 << 20;
const escape = 53;
const fixturePassword = "admin";
const sections = {
  ga: "All",
  gp: "Passkeys",
  gc: "Codes",
  gs: "Security",
  gd: "Deleted",
} as const;
const hasLabel = (node: AXNode, label: string) =>
  [node.title, node.description, node.value].includes(label);
const allNodes = async (probe: MacOSProbe) =>
  flattenAX(await probe.windows(passwords, 8).catch(() => []));
const onboarding = (nodes: AXNode[]) =>
  ["Welcome to the Passwords App", "Passwords App Notifications"].find((label) =>
    nodes.some((node) => node.role === "AXHeading" && hasLabel(node, label)),
  );

test("every Passwords binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Passwords/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["g,", "j/", "np", "ng", "fi", "fe", ...Object.keys(sections)].sort());
});

async function unlockPasswords(probe: MacOSProbe) {
  await runCommand(["/usr/bin/open", "-b", passwords]);
  const unlocked = async () =>
    (await probe.menu(passwords, "View", sections.ga).catch(() => undefined))?.enabled === true ||
    Boolean(onboarding(await allNodes(probe)));
  const agents = [passwords, "com.apple.SecurityAgent", "com.apple.LocalAuthentication.UIAgent"];
  const authField = async () => {
    if (!agents.includes(await probe.front())) return;
    for (const agent of agents) {
      const focus = await probe.focus(agent).catch(() => undefined);
      if (focus?.subrole === "AXSecureTextField" && focus.focused) return agent;
    }
  };
  const clicked = new Set<string>();
  try {
    const state = await waitFor(async () => {
      if (await unlocked()) return "unlocked";
      if (await authField()) return "authenticate";
      if ((await probe.front()) !== passwords) return;
      for (const [label, role] of [
        ["Get Started", "AXButton"],
        ["Unlock", "AXButton"],
        ["AXSecureTextField", "AXTextField"],
      ]) {
        if (clicked.has(label)) continue;
        const control = await probe.windowElement(passwords, label, role).catch(() => undefined);
        if (!control?.position || !control.size || control.enabled === false) continue;
        const [x, y] = control.position;
        const [width, height] = control.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
        clicked.add(label);
        return;
      }
    }, 25_000);
    if (state === "unlocked") return;

    const account = Bun.spawnSync(["/usr/bin/id", "-un"]).stdout.toString().trim();
    if (account !== "admin") throw new Error("Expected the disposable Tart test user");
    const credentialCheck = Bun.spawnSync(
      ["/usr/bin/dscl", ".", "-authonly", account, fixturePassword],
      { stdout: "ignore", stderr: "ignore", timeout: 5_000 },
    );
    if (credentialCheck.exitCode !== 0) {
      throw new Error("The pinned guest rejected the public fixture login");
    }

    // Type the public login password of the pinned Cirrus Tart fixture into the secure field.
    // Do this only after the VM-only helpers and focus check have both succeeded.
    let cause: unknown;
    const enteredCharacters = async (agent: string) => {
      const { value } = await probe.focus(agent);
      return typeof value === "string" ? value.length : undefined;
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await unlocked()) return;
      const agent = await authField();
      if (!agent) break;
      const field = await probe.focus(agent);
      if (field.position && field.size) {
        const [x, y] = field.position;
        const [width, height] = field.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
        await Bun.sleep(180);
        expect(await authField()).toBe(agent);
      }
      for (const deletion of [51, 117]) {
        const count = (await enteredCharacters(agent)) ?? fixturePassword.length;
        if (count > 24) throw new Error("The disposable Passwords login field was not empty");
        if (count > 0) await probe.keySequence(Array<number>(count).fill(deletion));
      }
      if ((await enteredCharacters(agent)) || (await authField()) !== agent) continue;
      if (attempt === 0) await probe.typeText(fixturePassword);
      else await probe.keySequence([0, 2, 46, 34, 45]);
      expect(await authField()).toBe(agent);
      const count = await enteredCharacters(agent);
      if (count !== undefined && count !== fixturePassword.length) continue;
      const unlock = await probe.windowElement(agent, "Unlock", "AXButton").catch(() => undefined);
      if (attempt === 2 && unlock?.enabled && unlock.position && unlock.size) {
        const [x, y] = unlock.position;
        const [width, height] = unlock.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
      } else {
        await probe.key(36);
      }
      try {
        await waitFor(async () => (await unlocked()) || undefined, 5_000);
        return;
      } catch (error) {
        cause = error;
      }
    }
    const window = await probe.window(passwords);
    const focus = await probe.focus(passwords);
    throw new Error(
      "The VM password vault did not unlock: " +
        JSON.stringify({
          front: await probe.front(),
          window,
          focusRole: focus.role,
          focusSubrole: focus.subrole,
          focused: focus.focused,
          charactersEntered: typeof focus.value === "string" ? focus.value.length : undefined,
          allEnabled: (await probe.menu(passwords, "View", sections.ga).catch(() => undefined))
            ?.enabled,
        }),
      { cause },
    );
  } catch (error) {
    if (await authField()) await probe.key(escape);
    throw error;
  }
}

test.skipIf(!macOSUITestsEnabled)(
  "Passwords chords switch sections, focus search, and open their sheets",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await unlockPasswords(probe);
        const dismissed = new Set<string>();
        await waitFor(async () => {
          const nodes = await allNodes(probe);
          const intro = onboarding(nodes);
          if (!intro) {
            return (
              (await probe.menu(passwords, "View", "All").catch(() => undefined))?.enabled ||
              undefined
            );
          }
          if (dismissed.has(intro)) return;
          const next = nodes.find(
            (node) =>
              node.role === "AXButton" &&
              node.enabled &&
              hasLabel(node, "Continue") &&
              node.position &&
              node.size,
          );
          if (next?.position && next.size) {
            const [x, y] = next.position;
            const [width, height] = next.size;
            await probe.clickPoint(x + width / 2, y + height / 2);
            dismissed.add(intro);
          }
        }, 15_000);
        const menu = (...path: string[]) =>
          waitFor(() => probe.menu(passwords, ...path).catch(() => undefined), 10_000);
        const visible = async (label: string) =>
          (await allNodes(probe)).some((node) => hasLabel(node, label));
        const importBanner = (await allNodes(probe)).find(
          (node) =>
            node.role === "AXGroup" &&
            (node.children ?? []).some(
              (child) => child.role === "AXButton" && hasLabel(child, "Import Passwords"),
            ) &&
            (node.children ?? []).some(
              (child) => child.role === "AXButton" && hasLabel(child, "Dismiss"),
            ),
        );
        const dismissBanner = (importBanner?.children ?? []).find(
          (child) => child.role === "AXButton" && hasLabel(child, "Dismiss"),
        );
        if (dismissBanner?.position && dismissBanner.size) {
          const [x, y] = dismissBanner.position;
          const [width, height] = dismissBanner.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
          await waitFor(async () => !(await visible("Import Passwords")) || undefined);
        }

        const failures: Error[] = [];
        const check = async (sequence: string, verify: () => Promise<void>) => {
          try {
            await verify();
            console.log("Passwords " + sequence + " passed");
          } catch (cause) {
            const failure = new Error("Passwords " + sequence + " failed", { cause });
            failures.push(failure);
            console.error(failure);
          }
        };

        await check("j/", async () => {
          const searchFocused = async () => {
            const field = await probe.focus(passwords);
            return (
              field.subrole === "AXSearchField" ||
              (field.role === "AXTextField" && hasLabel(field, "Search"))
            );
          };
          if (await searchFocused()) await probe.key(escape);
          if (await searchFocused()) await probe.key(48);
          await waitFor(async () => !(await searchFocused()) || undefined);
          await app.runChecked("j/");
          try {
            await waitFor(async () => ((await searchFocused()) ? true : undefined));
          } finally {
            await probe.key(escape);
          }
        });

        const windowKey = ({ title, id, subrole, position }: AXNode) =>
          JSON.stringify([title, id, subrole, position]);
        await check("g,", async () => {
          const existing = (await probe.windows(passwords)).map(windowKey);
          const settings = async () =>
            (await probe.windows(passwords)).find(
              (node) => node.title && !existing.includes(windowKey(node)),
            );
          await app.runChecked("g,");
          const opened = await waitFor(settings, 10_000).catch(async (cause) => {
            throw new Error(
              "Passwords did not open a settings window: " +
                JSON.stringify(await probe.windows(passwords)),
              { cause },
            );
          });
          const sameTitle = (await probe.windows(passwords)).filter(
            ({ title }) => title === opened.title,
          );
          if (sameTitle.length === 1) await probe.closeWindow(passwords, opened.title!);
          else {
            expect(windowKey(await probe.window(passwords))).toBe(windowKey(opened));
            await probe.key(13, command);
          }
          await waitFor(async () => !(await settings()) || undefined);
        });

        const surfaces = [
          {
            sequence: "np",
            path: ["File", "New Password…"],
            pattern: /^(?:NewPasswordView|WebsiteTextField|Website)$/i,
          },
          {
            sequence: "fi",
            path: ["File", "Import Passwords from File…"],
            pattern: /^ImportPasswordsConfirmationAlert$|^Choose File(?: to Import)?$/i,
          },
        ];
        for (const { sequence, path, pattern } of surfaces) {
          await check(sequence, async () => {
            const item = await menu(...path);
            if (item.enabled === false) {
              await app.expectFailure(
                sequence,
                new RegExp('Menu item "' + path.at(-1) + '".*is disabled'),
              );
              return;
            }
            const surface = async () =>
              (await allNodes(probe)).find(({ title, description, id }) =>
                [title, description, id].some((text) => pattern.test(text ?? "")),
              );
            expect(await surface()).toBeUndefined();
            await app.runChecked(sequence);
            try {
              await waitFor(surface, 10_000).catch(async (cause) => {
                const controls = (await allNodes(probe))
                  .filter(({ role }) =>
                    ["AXWindow", "AXButton", "AXSheet", "AXHeading", "AXTextField"].includes(
                      role ?? "",
                    ),
                  )
                  .map(({ role, title, description, id }) => ({ role, title, description, id }));
                throw new Error(
                  "Passwords did not show " +
                    path.at(-1) +
                    ": " +
                    JSON.stringify(controls.slice(0, 45)),
                  { cause },
                );
              });
            } finally {
              if (await surface()) {
                if ((await probe.front()) !== passwords) await probe.activate(passwords);
                const cancel = (await allNodes(probe)).find(
                  (node) =>
                    node.role === "AXButton" &&
                    hasLabel(node, "Cancel") &&
                    node.enabled &&
                    node.position &&
                    node.size,
                );
                if (cancel?.position && cancel.size) {
                  const [x, y] = cancel.position;
                  const [width, height] = cancel.size;
                  await probe.clickPoint(x + width / 2, y + height / 2);
                } else {
                  await probe.key(escape);
                }
                await waitFor(async () => !(await surface()) || undefined, 10_000);
              }
            }
          });
        }

        await check("ng", async () => {
          const group = flattenAX([await menu("File")]).find(
            (node) => node.role === "AXMenuItem" && node.title === "New Shared Group…",
          );
          if (!group) {
            await app.expectFailure(
              "ng",
              /Menu path "File > New Shared Group…".*has no component "New Shared Group…"/,
            );
            console.log("Passwords verified the missing signed-out Shared Group command");
            return;
          }
          expect(group.enabled).toBe(false);
          await app.expectFailure("ng", /Menu item "New Shared Group…".*is disabled/);
        });

        await check("fe", async () => {
          const exportItem = await menu("File", "Export All Passwords to File…");
          if (exportItem.enabled === false) {
            await app.expectFailure("fe", /Menu item "Export All Passwords to File…".*is disabled/);
          } else {
            const label = "Export Passwords";
            expect(await visible(label)).toBe(false);
            await app.runChecked("fe");
            try {
              await waitFor(async () => ((await visible(label)) ? true : undefined), 10_000);
            } finally {
              await probe.key(escape);
              await waitFor(async () => ((await visible(label)) ? undefined : true));
            }
          }
        });

        await check("navigation", async () => {
          const navigationNodes = async () =>
            flattenAX([
              await probe.window(passwords, 13),
              ...(await probe.visibleRows(passwords, 3)),
            ]);
          const selected = async (label: string) => {
            if ((await menu("View", label)).mark) return true;
            const identifies = (node: AXNode) =>
              [node.title, node.description, node.value].some(
                (text) =>
                  typeof text === "string" &&
                  (text === label || text.startsWith(label + ",") || text.startsWith(label + " ")),
              );
            return (await navigationNodes()).some(
              (node) =>
                (node.role === "AXHeading" && identifies(node)) ||
                (["AXRow", "AXCell", "AXRadioButton", "AXButton"].includes(node.role ?? "") &&
                  (node.selected || node.value === 1 || node.value === true) &&
                  (identifies(node) || flattenAX(node.children ?? []).some(identifies))),
            );
          };

          const names = Object.values(sections);
          let initial: string | undefined;
          for (const label of names) {
            if (await selected(label)) initial = label;
          }
          if (!initial) {
            await probe.press(passwords, "View", "All");
            await waitFor(async () => (await selected("All")) || undefined).catch(async (cause) => {
              const controls = (await navigationNodes())
                .filter(({ role }) =>
                  [
                    "AXRow",
                    "AXCell",
                    "AXRadioButton",
                    "AXButton",
                    "AXHeading",
                    "AXStaticText",
                  ].includes(role ?? ""),
                )
                .map(({ role, title, description, id, selected, value }) => ({
                  role,
                  title,
                  description,
                  id,
                  selected,
                  value,
                }));
              throw new Error(
                "Passwords did not show an active All section: " +
                  JSON.stringify(controls.slice(0, 45)),
                { cause },
              );
            });
            initial = "All";
          }
          try {
            for (const [sequence, label] of Object.entries(sections).reverse()) {
              if (await selected(label)) {
                const alternate = label === "All" ? "Security" : "All";
                await probe.press(passwords, "View", alternate);
                await waitFor(async () => ((await selected(alternate)) ? true : undefined));
                expect(await selected(label)).toBe(false);
              }
              await app.runChecked(sequence);
              await waitFor(async () => ((await selected(label)) ? true : undefined)).catch(
                async (cause) => {
                  throw new Error(
                    "Passwords did not select " +
                      label +
                      ": " +
                      JSON.stringify({
                        window: await probe.window(passwords),
                        menu: await menu("View", label),
                      }),
                    { cause },
                  );
                },
              );
              console.log("Passwords " + sequence + " selected " + label);
            }
          } finally {
            if (initial) await probe.press(passwords, "View", initial);
          }
        });
        if (failures.length) throw new AggregateError(failures, "Passwords behavior failures");
      }),
    );
  },
  220_000,
);
