import { tap } from "chord";

const modifierKeys = { a: "alt", c: "ctrl", f: "fn", m: "cmd", s: "shift" } as const;

/** A modifier entry point, one regular key, then additional modifiers in any order. */
export function modifierShortcut(sequence: string): string {
  const match = /^([acfms])([a-z0-9`\-=[\]\\;',./])([acfms]*)(?![\s\S])/.exec(sequence);
  if (!match)
    throw new TypeError(
      "Expected a modifier letter, one regular key, and optional modifier letters",
    );
  const [, modifier, key, additionalModifiers] = match;
  const modifiers = [...new Set(modifier + additionalModifiers)]
    .sort()
    .map((letter) => modifierKeys[letter as keyof typeof modifierKeys])
    .join("+");
  return `${modifiers}+${key}`;
}

export default function buildKeysHandler() {
  return function keys(sequence: string): void {
    // The native helper validates the entire shortcut sequence before sending any input.
    tap(modifierShortcut(sequence));
  };
}
