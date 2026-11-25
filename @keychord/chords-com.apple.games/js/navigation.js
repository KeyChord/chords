//#region src/js/navigation.ts
const bundleId = "com.apple.games";
const menuModule = new URL("@keychord/chords-menu/js/menu.js", import.meta.url);
const destinations = {
	HOME: "games:///play-now?popToRoot=true",
	LIBRARY: "games:///library?popToRoot=true",
	ARCADE: "https://games.apple.com/arcade"
};
async function navigate(destination) {
	const url = destinations[destination];
	if (!url) throw new Error(`Unknown Games destination "${destination}"`);
	const { default: buildMenuHandler } = await import(menuModule.href);
	await buildMenuHandler(bundleId)("REQUIRE_CONTROL_ABSENT", ["games.onboarding.signInView", "Sign in to Game Center in Games before switching sections."]);
	const open = Bun.spawn([
		"/usr/bin/open",
		"-b",
		bundleId,
		url
	], {
		stdout: "ignore",
		stderr: "pipe",
		timeout: 1e4
	});
	const [code, stderr] = await Promise.all([open.exited, new Response(open.stderr).text()]);
	if (code !== 0) throw new Error(`Could not open Games (${code}): ${stderr.trim()}`);
}
function buildNavigationHandler() {
	return navigate;
}
//#endregion
export { buildNavigationHandler as default };
