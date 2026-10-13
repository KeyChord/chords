import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region src/js/safari.ts
var import__keychord_native_safari = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/safari/safari-c968d20c13fb.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] safari has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
const safariDomain = "com.apple.Safari";
function runSafariJavaScript(source) {
	import__keychord_native_safari.default.runJavaScript(source);
}
function openDeveloperSettingsPane() {
	import__keychord_native_safari.default.openDeveloperSettings();
}
async function readBooleanDefault(domain, key) {
	const result = await runCommand([
		"defaults",
		"read",
		domain,
		key
	], true);
	return result.exitCode === 0 && result.stdout.trim() === "1";
}
async function runCommand(command, allowFailure = false) {
	const subprocess = Bun.spawn(command, {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe"
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		subprocess.exited,
		new Response(subprocess.stdout).text(),
		new Response(subprocess.stderr).text()
	]);
	if (exitCode !== 0 && !allowFailure) {
		const detail = stderr.trim();
		throw new Error(`Command failed with exit code ${exitCode}: ${command.join(" ")}${detail ? `\n${detail}` : ""}`);
	}
	return {
		exitCode,
		stdout
	};
}
async function enableDevelopMenu() {
	await runCommand([
		"defaults",
		"write",
		safariDomain,
		"IncludeDevelopMenu",
		"-bool",
		"true"
	]);
	await runCommand([
		"defaults",
		"write",
		"com.apple.Safari.SandboxBroker",
		"ShowDevelopMenu",
		"-bool",
		"true"
	]);
	await runCommand([
		"defaults",
		"write",
		safariDomain,
		"WebKitDeveloperExtrasEnabledPreferenceKey",
		"-bool",
		"true"
	]);
	await runCommand([
		"defaults",
		"write",
		safariDomain,
		"com.apple.Safari.ContentPageGroupIdentifier.WebKit2DeveloperExtrasEnabled",
		"-bool",
		"true"
	]);
}
async function buildSafariHandler() {
	const [isDevelopMenuEnabled, isAllowJavaScriptFromAppleEventsEnabled] = await Promise.all([readBooleanDefault(safariDomain, "IncludeDevelopMenu"), readBooleanDefault(safariDomain, "AllowJavaScriptFromAppleEvents")]);
	return async function safari() {
		if (!isAllowJavaScriptFromAppleEventsEnabled) {
			if (!isDevelopMenuEnabled) {
				await enableDevelopMenu();
				await runCommand([
					"killall",
					"-w",
					"Safari"
				]);
				await runCommand([
					"open",
					"-a",
					"Safari"
				]);
			}
			openDeveloperSettingsPane();
			return;
		}
		runSafariJavaScript("document.title;");
	};
}
//#endregion
export { buildSafariHandler as default, runSafariJavaScript };
