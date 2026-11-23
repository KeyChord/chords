import { test } from "bun:test";
import { macOSUITestsEnabled } from "@keychord/chordtest";
import { testSessionDialog } from "./session-dialog";

test.skipIf(!macOSUITestsEnabled)(
  ";blo opens the native Log Out confirmation",
  () => testSessionDialog(import.meta.url, ";blo", /Are you sure you want to (?:log|sign) out/i),
  90_000,
);
