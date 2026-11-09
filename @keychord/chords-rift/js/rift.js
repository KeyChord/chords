//#region src/js/rift.ts
const FOCUS_MASTER = "FOCUS_MASTER";
/** Looks `rift-cli` up on the PATH Chord recovers from the login shell, like shell chords. */
function createRiftCli(timeout = 15e3) {
	return async (args) => {
		const binary = Bun.which("rift-cli");
		if (!binary) throw new Error("Install Rift, with rift-cli on your login shell's PATH");
		const child = Bun.spawn([binary, ...args], {
			stdout: "pipe",
			stderr: "pipe",
			timeout
		});
		const [stdout, stderr, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited
		]);
		if (code !== 0) {
			const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join("; ");
			throw new Error(`rift-cli ${args.join(" ")} failed${child.signalCode ? ` (terminated; timeout ${timeout}ms)` : ` (exit ${code})`}${detail ? `: ${detail}` : ""}`);
		}
		return stdout;
	};
}
const nodes = (node) => [node, ...node.children.flatMap(nodes)];
/**
* The first window in the master area that Rift gives space to. Hidden and minimized windows
* keep their slot with a 0×0 frame, and focusing one would show nothing. Undefined outside
* the master/stack layout, which is the only one with a master area.
*/
function masterWindow(layout) {
	const master = layout.container_tree && nodes(layout.container_tree).find((node) => node.role === "master");
	if (!master) return void 0;
	return nodes(master).find((node) => node.node_type === "window" && node.window_id && node.frame.size.width > 0 && node.frame.size.height > 0)?.window_id ?? void 0;
}
const focusArgs = ({ pid, idx }) => [
	"execute",
	"window",
	"focus",
	"--window-id",
	JSON.stringify({
		pid,
		idx
	})
];
function buildRiftHandler(cli = createRiftCli()) {
	return async function rift(action) {
		if (action !== "FOCUS_MASTER") throw new TypeError(`Unknown Rift action: ${String(action)}`);
		const window = masterWindow(JSON.parse(await cli(["query", "layout"])));
		if (window) await cli(focusArgs(window));
	};
}
//#endregion
export { FOCUS_MASTER, createRiftCli, buildRiftHandler as default, focusArgs, masterWindow };
