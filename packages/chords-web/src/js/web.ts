/**
 * Web chord handler for Chromium-family browsers. The generated JavaScript is sent to the
 * frontmost browser by `src/swift/web/web.swift`; this file builds commands and calls its
 * NodeSwift addon through Node-API.
 */
import { resolveNativeModulePath } from "chord";
import jquery from "jquery-as-string";
import outdent from "outdent";

type Args =
  | [type: "placeholder", input: string]
  | [type: "selection-start", input: string]
  | [type: "selection-end", input: string]
  | [type: "link", input: string]
  | [type: "button", input: string]
  | [type: "scroll", direction: "north" | "south" | "east" | "west"];

type WebAddon = {
  runJavaScript(source: string): void;
};

let addon: WebAddon | undefined;

function openWebAddon(): WebAddon {
  const module = { exports: {} as WebAddon };
  process.dlopen(module, resolveNativeModulePath(import.meta, "web"));
  return module.exports;
}

export function runWebJavaScript(source: string): void {
  addon ??= openWebAddon();
  addon.runJavaScript(source);
}

export default function buildHandler() {
  return async function handler(...args: Args) {
    const javascript = `${jquery};\n${getJavascript(...args)}`;

    // Preserve the previous handler's page environment: it injected jQuery once around the
    // generated payload and once inside it.
    runWebJavaScript(`${jquery};\n${javascript}`);
  };
}

function getJavascript(...args: Args): string {
  const type = args[0];
  switch (type) {
    case "scroll": {
      const direction = args[1];
      return outdent`
        window.scrollBy({
          top: ${direction === "north" ? -100 : direction === "south" ? 100 : 0},
          left: ${direction === "east" ? 100 : direction === "west" ? -100 : 0},
          behavior: 'smooth'
        });
      `;
    }

    case "placeholder": {
      const input = args[1];
      if (input.endsWith(".")) {
        return outdent`
          $('input[placeholder="${input}" i]').focus();
        `;
      }

      if (input.endsWith(",")) {
        // TODO: need a native event for a true right click.
        return "";
      }
    }

    default: {
      return `console.log('unhandled type ${type}')`;
    }
  }
}
