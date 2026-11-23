import { test } from "bun:test";
import { macOSUITestsEnabled } from "@keychord/chordtest";
import { testSessionDialog } from "./session-dialog";

test.skipIf(!macOSUITestsEnabled)(
  ";bq opens Force Quit Applications",
  () => testSessionDialog(import.meta.url, ";bq", /Force Quit Applications/i),
  90_000,
);
