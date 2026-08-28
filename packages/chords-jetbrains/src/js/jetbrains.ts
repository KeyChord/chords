import { outdent } from "outdent";

export default function buildAction(ideBinPath: string) {
  if (!ideBinPath) {
    throw new Error("IDE binpath must be provided");
  }

  const tmp = Bun.env.TMPDIR ?? "/tmp";

  // This function makes it possible to programmatically execute IntelliJ commands
  return async function action(commandId: string) {
    const id = Math.random();
    const scriptPath = `${tmp}/jetbrains_action_${id}.groovy`;
    const resultPath = `${tmp}/jetbrains_action_${id}.txt`;

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

    await Bun.write(scriptPath, script);
    const subprocess = Bun.spawn([ideBinPath, "ideScript", scriptPath]);
    // this.controller.signal.addEventListener("abort", () => {
    //   subprocess.kill();
    // });
    await subprocess.exited;

    const result = await Bun.file(resultPath).text();
    await Bun.file(scriptPath).delete();
    await Bun.file(resultPath).delete();

    return result == "1";
  };
}
