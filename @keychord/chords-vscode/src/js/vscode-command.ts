import { lstat } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { tap } from "chord";

const SERVER_SHORTCUT = "ctrl+shift+alt+p";
const RESPONSE_TIMEOUT_MS = 2_000;

interface CommandResponse {
  uuid: string;
  error: string | null;
}

function missingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** The current Command Server extension delegates this path convention to talon-rpc. */
function serverDirectory(uid: number): string {
  const { TMPDIR, TEMP, TMP } = process.env;
  const suffix = uid < 0 ? "" : `-${uid}`;
  return join(TMPDIR || TEMP || TMP || tmpdir(), `vscode-command-server${suffix}`);
}

export default function buildAction() {
  const { uid } = userInfo();
  const directory = serverDirectory(uid);
  const request = Bun.file(join(directory, "request.json"));
  const response = Bun.file(join(directory, "response.json"));

  return async function runCommand(commandId: string): Promise<void> {
    const stats = await lstat(directory).catch((error: unknown) => {
      if (!missingFile(error)) throw error;
      throw new Error("Enable the Command Server extension in VS Code or Cursor for this chord.");
    });
    if (!stats.isDirectory() || (uid >= 0 && (stats.uid !== uid || (stats.mode & 0o002) !== 0))) {
      throw new Error(`Invalid VS Code Command Server directory: ${directory}`);
    }

    const uuid = crypto.randomUUID();
    await response.delete().catch((error: unknown) => {
      if (!missingFile(error)) throw error;
    });
    await Bun.write(
      request,
      JSON.stringify({
        uuid,
        commandId,
        args: [],
        waitForFinish: false,
        returnCommandOutput: false,
      }),
    );
    await tap(SERVER_SHORTCUT);

    const deadline = performance.now() + RESPONSE_TIMEOUT_MS;
    while (performance.now() < deadline) {
      const text = await response.text().catch((error: unknown) => {
        if (!missingFile(error)) throw error;
        return "";
      });
      if (text.endsWith("\n")) {
        const result = JSON.parse(text) as CommandResponse;
        if (result.uuid === uuid) {
          if (result.error) throw new Error(result.error);
          return;
        }
      }
      await Bun.sleep(20);
    }
    throw new Error(`VS Code Command Server did not acknowledge ${commandId}`);
  };
}
