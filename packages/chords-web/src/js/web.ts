import '@jxa/global-type';
import { run } from 'jxa-run-compat'
import jquery from 'jquery-as-string'

type FocusInputArgs = [via: 'placeholder', input: string]

export default function buildFocusInputHandler() {
  return async function handler(...args: FocusInputArgs) {
    await run(() => {
      // 1. Get System Events to find the currently active process
      const sysEvents = Application("System Events");
      const activeProcess = sysEvents.processes.whose({ frontmost: true })[0];
      const appName = activeProcess.name();

      // We need the current application to show macOS dialog boxes
      const currentApp = Application.currentApplication();
      currentApp.includeStandardAdditions = true;

      // 2. Define our supported browsers
      const supportedBrowsers = ["Google Chrome", "Brave Browser", "Microsoft Edge", "Arc"];

      // 3. Check if the active app is in our list
      if (supportedBrowsers.includes(appName)) {
          // Bind to the active browser dynamically
          const browser = Application(appName);

          // Execute the code in the frontmost tab of the frontmost window
          const result = browser.windows[0].activeTab.execute({
              javascript: "window.location.href;" // Grab the URL
          });

          // Show the result
          currentApp.displayDialog(`App: ${appName}\nURL: ${result}`);

      } else {
          currentApp.displayDialog(`The frontmost app (${appName}) is not a supported browser.`);
      }
    });
  }
}

function focusInput(...args: FocusInputArgs) {
  $(`input[placeholder="${args[1]}" i]`).focus();
}
