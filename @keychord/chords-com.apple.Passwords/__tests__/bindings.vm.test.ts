import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
  type MacOSProbe,
} from "@keychord/chordtest";

const passwords = "com.apple.Passwords";
const closeWindow = 13;
const command = 1 << 20;
const escape = 53;
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
  await probe.activate(passwords);
  const ready = async () => {
    const nodes = await allNodes(probe);
    return nodes.some((node) => node.subrole === "AXSearchField") ||
      nodes.some((node) => node.role === "AXButton" && hasLabel(node, "Unlock"))
      ? nodes
      : undefined;
  };
  let nodes = await waitFor(async () => {
    const current = await allNodes(probe);
    if (current.some((node) => node.role === "AXButton" && hasLabel(node, "Get Started"))) {
      return current;
    }
    return ready();
  }, 15_000);
  if (nodes.some((node) => node.role === "AXButton" && hasLabel(node, "Get Started"))) {
    await probe.pressControl(passwords, "AXButton", "Get Started");
    nodes = await waitFor(ready, 15_000);
  }
  if (nodes.some((node) => node.role === "AXButton" && hasLabel(node, "Unlock"))) {
    await probe.pressControl(passwords, "AXButton", "Unlock");
    const agents = [passwords, "com.apple.SecurityAgent", "com.apple.LocalAuthentication.UIAgent"];
    await waitFor(async () => {
      for (const agent of agents) {
        const focus = await probe.focus(agent).catch(() => undefined);
        if (focus?.subrole === "AXSecureTextField") return true;
      }
    }, 10_000);
    // Type the public login password of the pinned Cirrus Tart fixture into the secure field.
    // Do this only after the VM-only helpers and focus check have both succeeded.
    for (const key of [0, 2, 46, 34, 45]) await probe.key(key);
    await probe.key(36);
  }
  await waitFor(async () => {
    if ((await allNodes(probe)).some((node) => node.subrole === "AXSearchField")) return true;
  }, 15_000);
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
        const menu = (...path: string[]) =>
          waitFor(() => probe.menu(passwords, ...path).catch(() => undefined), 10_000);
        const visible = async (label: string) =>
          (await allNodes(probe)).some((node) => hasLabel(node, label));
        const selected = async (label: string) => {
          if ((await menu("View", label)).mark) return true;
          return (await allNodes(probe)).some(
            (node) =>
              node.selected &&
              (hasLabel(node, label) ||
                flattenAX(node.children ?? []).some((child) => hasLabel(child, label))),
          );
        };

        const names = Object.values(sections);
        let initial: string | undefined;
        for (const label of names) {
          if (await selected(label)) initial = label;
        }
        expect(initial).toBeDefined();
        try {
          for (const [sequence, label] of Object.entries(sections)) {
            if (await selected(label)) {
              const alternate = label === "All" ? "Security" : "All";
              await probe.press(passwords, "View", alternate);
              await waitFor(async () => ((await selected(alternate)) ? true : undefined));
              expect(await selected(label)).toBe(false);
            }
            await app.runChecked(sequence);
            await waitFor(async () => ((await selected(label)) ? true : undefined));
          }
        } finally {
          if (initial) await probe.press(passwords, "View", initial);
        }

        const searchFocused = async () =>
          (await probe.focus(passwords)).subrole === "AXSearchField";
        expect(await searchFocused()).toBe(false);
        await app.runChecked("j/");
        try {
          await waitFor(async () => ((await searchFocused()) ? true : undefined));
        } finally {
          await probe.key(escape);
        }

        const surfaces = [
          { sequence: "g,", label: "Show Passwords in Menu Bar", dismiss: closeWindow },
          { sequence: "np", label: "Website", dismiss: escape },
          { sequence: "fi", label: "Choose File to Import", dismiss: escape },
        ];
        for (const { sequence, label, dismiss } of surfaces) {
          expect(await visible(label)).toBe(false);
          await app.runChecked(sequence);
          try {
            await waitFor(async () => ((await visible(label)) ? true : undefined), 10_000);
          } finally {
            await probe.key(dismiss, dismiss === closeWindow ? command : 0);
            await waitFor(async () => ((await visible(label)) ? undefined : true));
          }
        }

        const group = await menu("File", "New Shared Group…");
        expect(group.enabled).toBe(false);
        await app.expectFailure("ng", /Menu item "New Shared Group…".*is disabled/);

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
      }),
    );
  },
  220_000,
);
