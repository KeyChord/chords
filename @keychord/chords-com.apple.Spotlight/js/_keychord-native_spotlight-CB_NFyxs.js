import { t as __commonJSMin } from "./rolldown-runtime-DXIUcv95.js";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
//#region \0keychord-native:spotlight
var require__keychord_native_spotlight = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/spotlight/spotlight-b4fbba988456.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] spotlight has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
}));
//#endregion
export default require__keychord_native_spotlight();
export {};
