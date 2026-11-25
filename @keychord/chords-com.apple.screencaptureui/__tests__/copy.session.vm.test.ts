import { test } from "bun:test";
import { macOSUITestsEnabled } from "@keychord/chordtest";
import { verifyScreenshotMarkup } from "./markup-fixture";

test.skipIf(!macOSUITestsEnabled)(
  "Screenshot Markup copies the image to the clipboard and closes",
  () => verifyScreenshotMarkup(import.meta.url, "copy"),
  150_000,
);
