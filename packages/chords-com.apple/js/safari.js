import { resolveNativeModulePath } from "chord";
//#region src/js/safari.ts
/**
* Safari handler for Chord's Bun runtime.
*
* Bun handles the small amount of `defaults`/application lifecycle work. Safari and the
* Accessibility API are driven in-process by `src/swift/safari/safari.swift`, compiled by
* `@keychord/config` to `target/<triple>/safari/safari.node`.
*/
const safariDomain = "com.apple.Safari";
let addon;
function openSafariAddon() {
	const module = { exports: {} };
	process.dlopen(module, resolveNativeModulePath(import.meta, "safari"));
	return module.exports;
}
function runJavaScript(source) {
	addon ??= openSafariAddon();
	addon.runJavaScript(source);
}
function openDeveloperSettingsPane() {
	addon ??= openSafariAddon();
	addon.openDeveloperSettings();
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
		runJavaScript("document.title;");
	};
}
//#endregion
export { buildSafariHandler as default };
