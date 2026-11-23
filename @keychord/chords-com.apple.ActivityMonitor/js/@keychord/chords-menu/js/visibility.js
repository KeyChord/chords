//#region src/js/visibility.ts
const toggleMenuBar = "tell application \"System Events\" to tell dock preferences to set autohide menu bar to not autohide menu bar";
function buildVisibilityHandler() {
	return async function toggleVisibility() {
		const child = Bun.spawn([
			"/usr/bin/osascript",
			"-e",
			toggleMenuBar
		], {
			stdout: "ignore",
			stderr: "pipe",
			timeout: 1e4
		});
		const [diagnostics, code] = await Promise.all([new Response(child.stderr).text(), child.exited]);
		if (code !== 0) {
			const reason = diagnostics.trim() || (child.signalCode ? `terminated by ${child.signalCode}` : `exit code ${code}`);
			throw new Error(`Could not toggle menu bar visibility: ${reason}`);
		}
	};
}
//#endregion
export { buildVisibilityHandler as default };
