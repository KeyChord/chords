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
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const id = "com.apple.Preview";
const escape = 53;
const command = 1 << 20;
const sidebarModes = { vt: "Thumbnails", vc: "Contact Sheet" };
const layouts = { vs: "Single Page", vd: "Two Pages", vw: "Continuous Scroll" };
const pageWidth = 360;

function testPDF() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (const page of [1, 2, 3]) {
    const contents = `BT /F1 24 Tf 40 400 Td (Chordtest page ${page}) Tj ET\n`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 480] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objects.length + 2} 0 R >>`,
      `<< /Length ${contents.length} >>\nstream\n${contents}endstream`,
    );
  }
  let pdf = "%PDF-1.4\n";
  const offsets = ["0000000000 65535 f \n"];
  for (const [index, object] of objects.entries()) {
    offsets.push(`${String(pdf.length).padStart(10, "0")} 00000 n \n`);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  return (
    pdf +
    `xref\n0 ${offsets.length}\n${offsets.join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${pdf.length}\n%%EOF\n`
  );
}

const caseKeys = [
  "fo",
  "fe",
  "sf",
  "g[",
  "g]",
  "gp",
  "vh",
  "vm",
  "vi",
  "za",
  "z=",
  "z-",
  ...Object.keys(sidebarModes),
  ...Object.keys(layouts),
] as const;

function behavior(
  app: ChordApp,
  probe: MacOSProbe,
): Record<(typeof caseKeys)[number], () => Promise<void>> {
  const menu = (...path: string[]) => probe.menu(id, ...path);
  const nodes = async () => flattenAX(await probe.windows(id, 7));
  const button = async (title: RegExp) =>
    (await nodes()).find((node) => node.role === "AXButton" && title.test(node.title ?? ""));
  const panel = async (sequence: string, title: RegExp) => {
    await app.runChecked(sequence);
    try {
      await waitFor(async () => {
        if (await button(/^Cancel$/)) return button(title);
      });
    } finally {
      await probe.key(escape);
      await waitFor(async () => (!(await button(/^Cancel$/)) ? true : undefined));
    }
  };
  const setView = async (title: string) => {
    if (!(await menu("View", title)).mark) await probe.press(id, "View", title);
    await waitFor(async () => ((await menu("View", title)).mark ? true : undefined));
  };
  const selectView = async (sequence: string, title: string, start: string) => {
    await setView(start);
    expect((await menu("View", title)).mark).toBeFalsy();
    try {
      await app.runChecked(sequence);
      await waitFor(async () => ((await menu("View", title)).mark ? true : undefined));
    } finally {
      await setView(start);
    }
  };
  const navigation = async (sequence: string, direction: string, inverse: string) => {
    await setView("Single Page");
    await waitFor(async () => ((await menu("Go", direction)).enabled ? true : undefined));
    expect((await menu("Go", inverse)).enabled).toBe(false);
    try {
      await app.runChecked(sequence);
      await waitFor(async () => ((await menu("Go", inverse)).enabled ? true : undefined));
    } finally {
      if ((await menu("Go", inverse)).enabled) await probe.press(id, "Go", inverse);
      await waitFor(async () => ((await menu("Go", inverse)).enabled === false ? true : undefined));
    }
  };
  const pageSize = async () =>
    (await nodes()).find(({ role, size }) => role === "AXPage" && size && size[0] > 0)?.size?.[0];
  const zoom = async (sequence: string, changed: (before: number, after: number) => boolean) => {
    await setView("Single Page");
    await probe.press(id, "View", "Actual Size");
    const before = await waitFor(pageSize);
    try {
      await app.runChecked(sequence);
      await waitFor(async () => {
        const size = await pageSize();
        if (size !== undefined && changed(before, size)) return size;
      });
    } finally {
      await probe.press(id, "View", "Actual Size");
      await waitFor(async () => (Math.abs((await pageSize())! - before) < 1 ? true : undefined));
    }
  };
  const toggle = async (sequence: string, section: string, label: string) => {
    const shown = () => menu(section, `Hide ${label}`).catch(() => undefined);
    if (await shown()) await probe.press(id, section, `Hide ${label}`);
    await waitFor(async () => (!(await shown()) ? true : undefined));
    try {
      await app.runChecked(sequence);
      await waitFor(shown);
    } finally {
      if (await shown()) await probe.press(id, section, `Hide ${label}`);
      await waitFor(async () => (!(await shown()) ? true : undefined));
    }
  };

  return {
    fo: () => panel("fo", /^Open$/),
    fe: () => panel("fe", /^(Save|Export)$/),
    sf: async () => {
      expect((await probe.focus(id)).subrole).not.toBe("AXSearchField");
      await app.runChecked("sf");
      try {
        await waitFor(async () =>
          (await probe.focus(id)).subrole === "AXSearchField" ? true : undefined,
        );
      } finally {
        await probe.key(escape);
        await waitFor(async () =>
          (await probe.focus(id)).subrole !== "AXSearchField" ? true : undefined,
        );
      }
    },
    "g[": async () => {
      await setView("Single Page");
      await probe.press(id, "Go", "Next Page");
      await probe.press(id, "Go", "Next Page");
      await waitFor(async () =>
        (await menu("Go", "Next Page")).enabled === false ? true : undefined,
      );
      await navigation("g[", "Previous Page", "Next Page");
      await probe.press(id, "Go", "Previous Page");
      await probe.press(id, "Go", "Previous Page");
      await waitFor(async () =>
        (await menu("Go", "Previous Page")).enabled === false ? true : undefined,
      );
    },
    "g]": () => navigation("g]", "Next Page", "Previous Page"),
    gp: () => panel("gp", /^(OK|Go)$/),
    ...Object.fromEntries(
      Object.entries(sidebarModes).map(([key, title]) => [
        key,
        () => selectView(key, title, key === "vt" ? "Contact Sheet" : "Thumbnails"),
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(layouts).map(([key, title]) => [
        key,
        () => selectView(key, title, key === "vs" ? "Continuous Scroll" : "Single Page"),
      ]),
    ),
    vh: async () => {
      await setView("Thumbnails");
      try {
        await app.runChecked("vh");
        await waitFor(async () => ((await menu("View", "Thumbnails")).mark ? undefined : true));
      } finally {
        await setView("Thumbnails");
      }
    },
    vm: () => toggle("vm", "View", "Markup Toolbar"),
    vi: () => toggle("vi", "Tools", "Inspector"),
    za: async () => {
      await setView("Single Page");
      await probe.press(id, "View", "Actual Size");
      const actual = await waitFor(pageSize);
      await probe.press(id, "View", "Zoom In");
      try {
        await waitFor(async () => ((await pageSize())! > actual ? true : undefined));
        await app.runChecked("za");
        await waitFor(async () => (Math.abs((await pageSize())! - actual) < 1 ? true : undefined));
      } finally {
        await probe.press(id, "View", "Actual Size");
      }
    },
    "z=": () => zoom("z=", (before, after) => after > before),
    "z-": () => zoom("z-", (before, after) => after < before),
  };
}

test("every Preview binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Preview/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...caseKeys].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Preview chords navigate and display a three-page PDF",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    const directory = await mkdtemp(join(tmpdir(), "chordtest-preview-"));
    const fixture = join(directory, "Chordtest Preview.pdf");
    try {
      await Bun.write(fixture, testPDF());
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(id, fixture);
          await waitFor(
            async () =>
              (await probe.window(id)).title?.includes("Chordtest Preview") ? true : undefined,
            12_000,
          );
          try {
            const cases = behavior(app, probe);
            expect(Object.keys(cases).sort()).toEqual([...caseKeys].sort());
            for (const [sequence, run] of Object.entries(cases)) {
              try {
                await run();
                console.log(`Preview ${sequence} passed`);
              } catch (cause) {
                throw new Error(`Preview ${sequence} failed`, { cause });
              }
            }
          } finally {
            await probe.key(escape);
            await probe.key(13, command);
          }
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  300_000,
);
