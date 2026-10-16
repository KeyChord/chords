/**
 * Web chord handler for Chromium-family browsers. The generated JavaScript is sent to the
 * frontmost browser by `Sources/KeychordChordsWebNativeWeb/web.swift`; this file builds commands and calls its
 * NodeSwift addon through Node-API.
 */
import jquery from "jquery-as-string";
import outdent from "outdent";
import addon from "./web.node";

type Args =
  | [type: "PLACEHOLDER", input: string]
  | [type: "SELECTION_START", input: string]
  | [type: "SELECTION_END", input: string]
  | [type: "LINK", input: string]
  | [type: "BUTTON", input: string]
  | [type: "SCROLL", direction: "NORTH" | "SOUTH" | "EAST" | "WEST"];

export function runWebJavaScript(source: string): void {
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
    case "SCROLL": {
      const direction = args[1];
      return outdent`
        window.scrollBy({
          top: ${direction === "NORTH" ? -100 : direction === "SOUTH" ? 100 : 0},
          left: ${direction === "EAST" ? 100 : direction === "WEST" ? -100 : 0},
          behavior: 'smooth'
        });
      `;
    }

    case "PLACEHOLDER": {
      const input = args[1];
      if (input.endsWith(".")) {
        return outdent`
          $('input[placeholder="${input}" i]').focus();
        `;
      }

      if (input.endsWith(".,")) {
        // TODO: need a native event for a true right click.
        return "";
      }
    }

    default: {
      return `console.log('unhandled type ${type}')`;
    }
  }
}
