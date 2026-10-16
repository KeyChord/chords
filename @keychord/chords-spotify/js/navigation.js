//#region src/js/navigation.ts
async function gotoLikedSongs() {
	try {
		if (location.hostname !== "xpui.app.spotify.com") throw new Error("The selected page is not the Spotify desktop app.");
		function* values(container) {
			const stack = [container.stateNode?.current ?? container];
			while (stack.length) {
				const fiber = stack.pop();
				if (fiber.sibling) stack.push(fiber.sibling);
				if (fiber.child) stack.push(fiber.child);
				if (fiber.memoizedProps?.value) yield fiber.memoizedProps.value;
			}
		}
		let container;
		let navigator;
		for (const element of document.querySelectorAll("*")) {
			const key = Object.keys(element).find((name) => name.startsWith("__reactContainer$"));
			if (!key) continue;
			const root = element[key];
			for (const value of values(root)) {
				const candidate = value.navigator;
				if (typeof candidate?.replace === "function" && candidate.location?.pathname) {
					container = root;
					navigator = candidate;
					break;
				}
			}
			if (navigator) break;
		}
		if (!navigator || !container) throw new Error("Spotify's navigation API is unavailable. Open the main Spotify window.");
		const previousKey = navigator.location.key;
		navigator.replace("/collection/tracks", {});
		const destination = navigator.location;
		if (destination.pathname !== "/collection/tracks" || destination.search || destination.hash || Object.keys(destination.state ?? {}).length || destination.key === previousKey) throw new Error("Spotify did not navigate to Liked Songs.");
		const deadline = Date.now() + 3e3;
		do {
			const committed = [...values(container)].some((value) => value.location?.key === destination.key);
			const playlist = document.querySelector("main [data-testid=\"playlist-page\"]");
			if (committed && playlist) return JSON.stringify({ ok: true });
			await new Promise((resolve) => setTimeout(resolve, 40));
		} while (Date.now() < deadline);
		throw new Error("Spotify did not finish opening Liked Songs.");
	} catch (error) {
		return JSON.stringify({
			ok: false,
			error: error.message
		});
	}
}
function buildSpotifyNavigationJavaScript() {
	return `(${gotoLikedSongs.toString()})()`;
}
//#endregion
export { buildSpotifyNavigationJavaScript };
