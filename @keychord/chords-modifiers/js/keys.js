import { tap } from "chord";
//#region src/js/keys.ts
const modifierKeys = {
  a: "alt",
  c: "ctrl",
  f: "fn",
  m: "cmd",
  s: "shift",
};
/** A modifier entry point, one regular key, then additional modifiers in any order. */
function modifierShortcut(sequence) {
  const match = /^([acfms])([a-z0-9`\-=[\]\\;',./])([acfms]*)(?![\s\S])/.exec(sequence);
  if (!match)
    throw new TypeError(
      "Expected a modifier letter, one regular key, and optional modifier letters",
    );
  const [, modifier, key, additionalModifiers] = match;
  return `${[...new Set(modifier + additionalModifiers)]
    .sort()
    .map((letter) => modifierKeys[letter])
    .join("+")}+${key}`;
}
function buildKeysHandler() {
  return function keys(sequence) {
    tap(modifierShortcut(sequence));
  };
}
//#endregion
export { buildKeysHandler as default, modifierShortcut };
