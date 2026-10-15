import { runMenuBarAction, type MenuBarSelection } from "./tray";

/** Recompute from the edited buffer so Backspace also restores the previous selection. */
export function parseMenuBarSelection(sequence: string): MenuBarSelection | undefined {
  const match = /^([[\]]?)(-?)(0|[1-9][0-9]*)([lr]?)([[\]]*)([.,]?)$/.exec(sequence);
  if (!match) return;
  const [, prefix, fromEnd, digits, side, steps, click] = match;
  // Bare zero is the Apple shortcut, not a way to step from the tray into menus.
  const apple = !prefix && !fromEnd && digits === "0" && !side && !steps;
  const scope = prefix === "[" || apple ? "MENU" : "TRAY";
  const count = Number(side ? digits : digits.at(-1));
  const fromRight = side === "r" || (!side && !!fromEnd);
  if (!Number.isSafeInteger(count) || (count === 0 && (fromRight || scope === "TRAY"))) return;
  const index = fromRight ? -count : scope === "TRAY" ? count - 1 : count;
  return { scope, index, steps, ...(click ? { clickType: click === "." ? "LEFT" : "RIGHT" } : {}) };
}

type SelectionContext = {
  focusedAppId?: string;
  event?: { readonly key: string; readonly type: string; readonly repeat: boolean } | null;
};

export default function buildSelectionHandler() {
  return async function select(
    this: SelectionContext | void,
    trigger: "KEYDOWN" | "INPUT",
    sequence: string,
  ): Promise<void> {
    const event = this?.event;
    // CLI input has no keyboard event. Live input completion must not repeat a keydown click.
    if (trigger === "INPUT" && event) return;
    if (trigger === "KEYDOWN" && (event?.type !== "keydown" || event.repeat)) return;
    const selection = parseMenuBarSelection(sequence);
    if (!selection) {
      if (/[.,]$/.test(sequence)) {
        throw new RangeError("Select a valid menu bar index, or use a full index followed by l/r");
      }
      return;
    }
    if (selection.clickType) {
      // Modifiers and buffer edits can leave a final dot/comma in place; only its press clicks.
      if (trigger === "KEYDOWN" && event?.key !== sequence.at(-1)) return;
    } else if (trigger !== "KEYDOWN") return;
    await runMenuBarAction(selection, this?.focusedAppId);
  };
}
