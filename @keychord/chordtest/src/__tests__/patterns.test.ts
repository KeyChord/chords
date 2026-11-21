import { expect, test } from "bun:test";
import { chordPattern, expandPlaceholders } from "../patterns";

test("literal punctuation around regex captures follows Chord's key grammar", () => {
  expect(chordPattern(".(.+)").exec(".b20l.5")?.[1]).toBe("b20l.5");
  expect(chordPattern(".(.+)").test("xb20l.5")).toBe(false);
  expect(chordPattern("t.(.+)").test("t,b20l.5")).toBe(false);
  expect(chordPattern("pa.").test("pax")).toBe(false);
  expect(chordPattern("x.(\\d+).").exec("x.42.")?.[1]).toBe("42");
});

test("nested groups, escaped parentheses, and strict full-string matches", () => {
  expect(chordPattern("x((?:a|b)+)(\\d+)").exec("xab3")?.slice(1)).toEqual(["ab", "3"]);
  expect(chordPattern("x(\\))").exec("x)")?.[1]).toBe(")");
  expect(chordPattern("pa.").test("pa.\n")).toBe(false);
  expect(chordPattern("pa.").test("zpa.")).toBe(false);
  expect(() => chordPattern("x([abc)")).toThrow("Invalid parenthesized regex");
});

test("declared placeholders expand to their defaults before matching", () => {
  const placeholders = {
    "<>": { name: "Prefix", default: "=w" },
    "<p>": ";",
    "<mode>": { default: "M" },
    "<letter>": "k",
  };
  expect(expandPlaceholders("?<>d", placeholders)).toBe("?=wd");
  expect(expandPlaceholders("<p>x<>", placeholders)).toBe(";x=w");
  expect(expandPlaceholders("<>(?<n>\\d+)<z>", placeholders)).toBe("=w(?<n>\\d+)<z>");
  expect(expandPlaceholders("?<mode>d", placeholders)).toBe("?;md");
  expect(expandPlaceholders("dm<letter>", placeholders)).toBe("dmk");
  expect(chordPattern("<>s(\\d+)", placeholders).exec("=ws12")?.[1]).toBe("12");
  expect(chordPattern("<>s(\\d+)").test("=ws12")).toBe(false);
  expect(() => expandPlaceholders("<>q", { p: ";" })).toThrow("Invalid placeholder name");
});
