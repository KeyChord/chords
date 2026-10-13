import { tap } from "chord";
//#region src/js/keys.ts
const modifierKeys = {
	a: "alt",
	c: "ctrl",
	f: "fn",
	m: "cmd",
	s: "shift"
};
/** Preserve the former command grammar, with '-' separating modifiers from regular keys. */
function modifierShortcut(sequence) {
	const match = /^(a[cfms]*|c[fms]*|f[ms]*|ms*|s)-(.*)(?![\s\S])/.exec(sequence);
	if (!match) throw new TypeError("Expected modifier letters followed by '-' and regular keys");
	const [, letters, keys] = match;
	if (!/^[a-z0-9`\-=\[\]\\;',./]*$/.test(keys)) throw new TypeError("Expected literal regular keys after '-'");
	const modifiers = [...new Set(letters)].map((letter) => modifierKeys[letter]).join("+");
	return keys ? [...keys].map((key) => `${modifiers}+${key}`).join(" ") : modifiers;
}
function buildKeysHandler() {
	return function keys(sequence) {
		tap(modifierShortcut(sequence));
	};
}
//#endregion
export { buildKeysHandler as default, modifierShortcut };
