#!/usr/bin/env bun
/// <reference types="bun-types" />
import CDP from "chrome-remote-interface";
import jquerySource from "jquery-as-string";

const port = process.argv[2];
if (!port) {
  console.error("Usage: chrome-remote-interface <remote-debugging-port>");
  process.exit(1);
}

// const targets = await CDP.List({ port: Number(port) });
// const target = targets.find((t) => t.type === "page" && t.url.includes("index.html"));
// if (!target) throw new Error("No page target found");

const stdin = await Bun.stdin.text();
const client = await CDP();
const { Runtime } = client;
await Runtime.enable();

// inject + run
const { result, exceptionDetails } = await Runtime.evaluate({
  expression: `
    ${jquerySource}
    ;
    ${stdin}
  `,
  awaitPromise: true,
  returnByValue: true,
});

await client.close();
if (exceptionDetails) {
  console.error("Evaluation failed:", exceptionDetails);
  process.exit(1);
} else {
  // Bun.stdout.write(JSON.stringify(result.value));
  process.exit(0);
}
