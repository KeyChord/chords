import { flattenAX, waitFor, withChordPackage, withMacOSProbe } from "@keychord/chordtest";

export async function testSessionDialog(testURL: string, sequence: string, title: RegExp) {
  await withChordPackage(testURL, (app) =>
    withMacOSProbe(async (probe) => {
      await probe.activate("com.apple.finder");
      const loginWindow = "com.apple.loginwindow";
      const before = new Set((await probe.screenWindows()).map((window) => window.number));
      await app.runChecked(sequence);
      await waitFor(async () => {
        const nodes = flattenAX(await probe.windows(loginWindow, 4).catch(() => []));
        if (
          nodes.some((node) =>
            [node.title, node.description, node.value].some(
              (value) => typeof value === "string" && title.test(value),
            ),
          )
        )
          return true;
        return (await probe.screenWindows()).some(
          (window) =>
            !before.has(window.number) &&
            (title.test(window.title) || window.owner === "loginwindow"),
        )
          ? true
          : undefined;
      }, 15_000).catch(async (cause) => {
        throw new Error(
          `${sequence} did not open its system dialog. ${JSON.stringify(await probe.screenWindows())}`,
          { cause },
        );
      });
    }),
  );
}
