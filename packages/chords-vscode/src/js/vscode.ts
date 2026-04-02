import fs from "fs";
import { exists } from "./utils/file.ts";
import path from "path";
import { tap } from "chord";
import spawn from "nano-spawn-compat";

// TODO: make this work for Cursor
const uid = await spawn("id", ["-u"]);

export default function vscode(cmd: string) {
  const tmp = process.env.TMPDIR ?? "/tmp";
  const dir = path.join(tmp, `vscode-command-server-${uid.stdout}`);

  if (!exists(dir)) {
    return false;
  }

  const requestPath = path.join(dir, "request.json");
  const responsePath = path.join(dir, "response.json");

  const payload = JSON.stringify({
    commandId: cmd,
    args: [],
  });

  fs.writeFileSync(requestPath, payload);
  // We need to remove the previous response.json before continuing
  fs.rmSync(responsePath, { force: true });
  tap("cmd+shift+f17");

  return true;
};
