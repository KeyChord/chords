/** Match literal chord keys surrounding parenthesized, JS-compatible regex sections. */
export function chordPattern(raw: string): RegExp {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let remaining = raw;
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
