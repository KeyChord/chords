import fs from "fs";
import { outdent } from "outdent";
import path from "path";
import spawn from "nano-spawn-compat";

export default function buildAction(ideBinPath: string) {
  if (!ideBinPath) {
    throw new Error("IDE binpath must be provided");
  }

  const tmp = process.env.TMPDIR ?? "/tmp";

  // This function makes it possible to programmatically execute IntelliJ commands
  return async function action(commandId: string) {
    const id = Math.random();
    const scriptPath = path.join(tmp, `jetbrains_action_${id}.groovy`);
    const resultPath = path.join(tmp, `jetbrains_action_${id}.txt`);

    const script = outdent`
      import com.intellij.openapi.actionSystem.ActionManager

      def actionManager = ActionManager.getInstance()
      def resultFile = new File(${JSON.stringify(resultPath)})

      IDE.application.invokeAndWait {
        try {
          def action = actionManager.getAction(${JSON.stringify(commandId)})
          if (action == null) {
            resultFile.text = "0"
            return
          }

          def result = actionManager.tryToExecute(action, null, null, null, false)
          resultFile.text = result.rejected ? "0" : "1"
        } catch (Throwable ignored) {
          resultFile.text = "0"
        }
      }
    `;

    fs.writeFileSync(scriptPath, script);
    const process = spawn(ideBinPath, ["ideScript", scriptPath]);
    // const nodeChildProcess = await process.nodeChildProcess
    // this.controller.signal.addEventListener("abort", () => {
    //   nodeChildProcess.kill()
    // });
    await process;

    const result = fs.readFileSync(resultPath, "utf8");
    fs.rmSync(scriptPath);
    fs.rmSync(resultPath);

    return result == "1";
  };
}
