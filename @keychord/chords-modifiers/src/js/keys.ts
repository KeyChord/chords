import { tap } from "chord";

const modifierKeys = { a: "alt", c: "ctrl", f: "fn", m: "cmd", s: "shift" } as const;

/** Preserve the former command grammar, with '-' separating modifiers from regular keys. */
export function modifierShortcut(sequence: string): string {
  const match = /^(a[cfms]*|c[fms]*|f[ms]*|ms*|s)-(.*)(?![\s\S])/.exec(sequence);
  if (!match) throw new TypeError("Expected modifier letters followed by '-' and regular keys");
  const [, letters, keys] = match;
  if (!/^[a-z0-9`\-=\[\]\\;',./]*$/.test(keys)) {
    throw new TypeError("Expected literal regular keys after '-'");
  }
  const modifiers = [...new Set(letters)]
    .map((letter) => modifierKeys[letter as keyof typeof modifierKeys])
    .join("+");
  return keys ? [...keys].map((key) => `${modifiers}+${key}`).join(" ") : modifiers;
}

export default function buildKeysHandler() {
  return function keys(sequence: string): void {
    // The native helper validates the entire shortcut sequence before sending any input.
    tap(modifierShortcut(sequence));
  };
}
