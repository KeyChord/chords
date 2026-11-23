import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
//#region src/js/attach.ts
function buildAttach() {
	return async function attach(directory) {
		const path = directory.startsWith("~/") ? join(homedir(), directory.slice(2)) : directory;
		if (!isAbsolute(path)) throw new Error("Enter an absolute folder path or a path starting with ~/.");
		if (!(await stat(path).catch((error) => {
			if (error.code === "ENOENT" || error.code === "ENOTDIR") return;
			throw error;
		}))?.isDirectory()) throw new Error(`Folder not found: ${path}`);
		const child = Bun.spawn([
			"/usr/bin/open",
			"-b",
			"com.apple.FolderActionsSetup",
			path
		], {
			stderr: "pipe",
			timeout: 1e4
		});
		const [error, code] = await Promise.all([child.stderr.text(), child.exited]);
		if (code !== 0) throw new Error(`Folder Actions Setup exited with ${code}: ${error.trim()}`);
	};
}
//#endregion
export { buildAttach as default };
