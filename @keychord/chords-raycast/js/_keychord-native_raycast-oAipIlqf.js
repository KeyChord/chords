import { t as __commonJSMin } from "./chunk-BYIdrdsR.js";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
//#region \0keychord-native:raycast
var require__keychord_native_raycast = /* @__PURE__ */ __commonJSMin((exports, module) => {
  const nativeRequire = createRequire(import.meta.url);
  const nativeFiles = {
    "darwin-arm64": new URL(
      "native/aarch64-apple-darwin/raycast/raycast-6100072539ac.node",
      import.meta.url,
    ).href,
  };
  const nativeTarget = process.platform + "-" + process.arch;
  const nativeFile = nativeFiles[nativeTarget];
  if (!nativeFile) throw new Error("[chord-native] raycast has no addon for " + nativeTarget);
  module.exports = nativeRequire(fileURLToPath(nativeFile));
});
//#endregion
export default require__keychord_native_raycast();
export {};
