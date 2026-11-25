import { expect, test } from "bun:test";
import { macOSUITestsEnabled } from "@keychord/chordtest";
import { markupSequences, verifyScreenshotMarkup } from "./markup-fixture";

test("every Screenshot binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/screencaptureui/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.values(markupSequences).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Screenshot Markup saves the image",
  () => verifyScreenshotMarkup(import.meta.url, "save"),
  150_000,
);
