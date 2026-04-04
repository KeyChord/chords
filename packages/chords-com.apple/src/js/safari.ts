import '@jxa/global-type'
import { run } from 'jxa-run-compat'
import spawn from 'nano-spawn-compat'

export default async function buildSafariHandler() {
  const { stdout } = await spawn('defaults', ['read', 'com.apple.Safari', 'IncludeDevelopMenu']);
  const isDevelopMenuEnabled = stdout === '1';

  let isAllowJavaScriptFromAppleEventsEnabled: boolean;
  try {
    const { stdout } = await spawn('defaults', ['read', 'com.apple.Safari', 'AllowJavaScriptFromAppleEvents']);
    isAllowJavaScriptFromAppleEventsEnabled = stdout === '1'
  } catch {
    isAllowJavaScriptFromAppleEventsEnabled = false;
  }

  const enableDevelopMenu = async () => {
    await spawn('defaults', ['write', 'com.apple.Safari', 'IncludeDevelopMenu', '-bool', 'true']);
    await spawn('defaults', ['write', 'com.apple.Safari.SandboxBroker', 'ShowDevelopMenu', '-bool', 'true']);
    await spawn('defaults', ['write', 'com.apple.Safari', 'WebKitDeveloperExtrasEnabledPreferenceKey', '-bool', 'true']);
    await spawn('defaults', ['write', 'com.apple.Safari', 'com.apple.Safari.ContentPageGroupIdentifier.WebKit2DeveloperExtrasEnabled', '-bool', 'true']);
  };

  return async function safari() {
    if (!isAllowJavaScriptFromAppleEventsEnabled) {
      if (isDevelopMenuEnabled) {
        await openDeveloperSettingsPane();
      } else {
        await enableDevelopMenu();
        await spawn('killall', ['-w', 'Safari'])
        await spawn('open', ['-a', 'Safari'])
        await openDeveloperSettingsPane();
      }

      return;
    }

    await run(() => {
      var safariApp = Application('Safari');

      // The JavaScript you want to execute on the webpage
      var myScript = "document.title;";

      // Run the script in the currently active tab of the frontmost window
      var result = safariApp.doJavaScript(myScript, { in: safariApp.windows[0].currentTab() });

      console.log("The title of the page is: " + result);
    });
  }
}

async function openDeveloperSettingsPane() {
  await run(() => {
    // 1. Target Safari and bring it to the front
    var safariApp = Application('Safari');
    safariApp.activate();

    // 2. Target System Events to control the UI
    var systemEvents = Application('System Events');
    var safariProcess = systemEvents.processes['Safari'];

    // 3. Wait until Safari is fully active
    while (!safariProcess.frontmost()) {
        delay(0.1);
    }

    // 4. Press "Cmd + ," to open the Settings/Preferences window.
    // This is safer than clicking the menu item, as the menu name changed
    // from "Preferences..." to "Settings..." in recent macOS versions.
    systemEvents.keystroke(',', { using: 'command down' });

    // 5. Dynamically wait for the Settings window to open.
    // We identify the Settings window by checking if it has a toolbar.
    while (true) {
        try {
            if (safariProcess.windows[0].toolbars.length > 0) {
                break;
            }
        } catch(e) {
            // Ignore errors while the window is still rendering
        }
        delay(0.1);
    }

    // 6. Click the "Developer" button in the Settings window toolbar
    safariProcess.windows[0].toolbars[0].buttons['Developer'].click();
  });
}
