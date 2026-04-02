import { executeInOsa } from "jxa-run-compat";
import { outdent } from "outdent";

export function runJxaWithUtils(jxa: typeof import("../jxa/_.js"), fn: any, ...args: any[]) {
  const jxaEntries = Object.entries(jxa).filter(([, value]) => typeof value === "function");
  let jxaBlockContents = "";
  for (const [key, value] of jxaEntries) {
    jxaBlockContents += `var ${key} = ${value.toString()};\n`;
  }

  jxaBlockContents += jxaEntries.map(([key]) => `jxa[${JSON.stringify(key)}] = ${key};`).join("\n");

  const code = outdent`
    ObjC.import('stdlib');
    ObjC.import('Cocoa');
    ObjC.import('ApplicationServices');
      var args = JSON.parse($.getenv('OSA_ARGS'));
      var jxa = {};
    {
      ${jxaBlockContents}
    };
    var fn   = (${fn.toString()});
    var out  = fn.apply(null, args);
    JSON.stringify({ result: out });
  `;

  return executeInOsa(code, args);
}
