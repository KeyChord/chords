import { expect, test } from "bun:test";
import { chordPattern } from "../patterns";

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
