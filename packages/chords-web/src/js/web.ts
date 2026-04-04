import '@jxa/global-type';
import { run } from 'jxa-run-compat'
import jquery from 'jquery-as-string'
import outdent from 'outdent'

type Args = [type: 'placeholder', input: string] | [type: 'selection-start', input: string] | [type: 'selection-end', input: string] | [type: 'link', input: string] | [type: 'button', input: string] | [type: 'scroll', direction: 'north' | 'south' | 'east' | 'west']

export default function buildHandler() {
  return async function handler(...args: Args) {
    const javascript = jquery + ';\n' + getJavascript(...args);
    await run((javascript: string) => {
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
              javascript: `
                ${jquery};
                ${javascript}
              `,
          });

          console.log(result);
      } else {
          currentApp.displayDialog(`The frontmost app (${appName}) is not a supported browser.`);
      }
    }, javascript);
  }
}

function getJavascript(...args: Args) {
  const type = args[0];
  switch (type) {
    case 'scroll': {
      const direction = args[1];
      return outdent`
        window.scrollBy({
          top: ${direction === 'north' ? -100 : direction === 'south' ? 100 : 0},
          left: ${direction === 'east' ? 100 : direction === 'west' ? -100 : 0},
          behavior: 'smooth'
        });
      `
    }

    case 'placeholder': {
      const input = args[1];
      if (input.endsWith('.')) {
        return outdent`
          $('input[placeholder="${input}" i]').focus();
        `;
      }

      if (input.endsWith(',')) {
        // TODO: need to use AppleScript for true right click
        return ``
      }
    }

    default: {
      return `console.log('unhandled type ${type}')`
    }
  }
}
