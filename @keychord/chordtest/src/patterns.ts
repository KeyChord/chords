/** Defaults may be literal key sequences or letters that inherit the global symbol. */
export type ChordPlaceholders = Record<string, string | { name?: string; default?: string }>;

/**
 * The key with each declared `<>` or `<name>` replaced by its default, as Chord expands it when
 * Settings sets no value. Undeclared tokens, such as a regex's named group, are left alone.
 */
export function expandPlaceholders(raw: string, placeholders: ChordPlaceholders = {}): string {
  let expanded = raw;
  for (const [name, declaration] of Object.entries(placeholders)) {
    if (!/^<[^<>]*>$/.test(name)) {
      throw new TypeError(`Invalid placeholder name ${JSON.stringify(name)}. Use the full token.`);
    }
    const value = typeof declaration === "string" ? declaration : declaration.default;
    if (value === undefined) continue;
    const sequence =
      typeof declaration !== "string" && /^[a-z]$/i.test(value) ? `;${value.toLowerCase()}` : value;
    expanded = expanded.replaceAll(name, () => sequence);
  }
  return expanded;
}

/**
 * Match literal chord keys surrounding parenthesized, JS-compatible regex sections. Pass the
 * file's `[placeholders]` to match the key as Chord binds it by default.
 */
export function chordPattern(raw: string, placeholders?: ChordPlaceholders): RegExp {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let remaining = expandPlaceholders(raw, placeholders);
  let pattern = "";
  while (remaining.includes("(")) {
    const start = remaining.indexOf("(");
    pattern += escape(remaining.slice(0, start));
    remaining = remaining.slice(start);
    let end = -1;
    for (let index = 0; index < remaining.length; index++) {
      if (remaining[index] !== ")") continue;
      try {
        new RegExp(remaining.slice(0, index + 1));
        end = index + 1;
        break;
      } catch {
        /* Find the end of a complete group. */
      }
    }
    if (end < 0) throw new TypeError(`Invalid parenthesized regex in chord ${JSON.stringify(raw)}`);
    pattern += `(?:${remaining.slice(0, end)})`;
    remaining = remaining.slice(end);
  }
  return new RegExp(`^(?:${pattern}${escape(remaining)})(?![\\s\\S])`);
}
