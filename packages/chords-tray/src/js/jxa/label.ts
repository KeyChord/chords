import "@jxa/global-type";
import * as jxa from "./_.js";

export function oneLine(x: any) {
  return String(x).replace(/\s+/g, " ").trim();
}

export function summarizeElement(el: any, label?: string) {
  const role = jxa.getAttr(el, "AXRole");
  const subrole = jxa.getAttr(el, "AXSubrole");
  const title = jxa.getAttr(el, "AXTitle");
  const desc = jxa.getAttr(el, "AXDescription");

  const parts = [];
  if (label) parts.push(label);
  parts.push(role || "AXUIElement");

  if (subrole) parts.push(`subrole=${JSON.stringify(oneLine(subrole))}`);
  if (title) parts.push(`title=${JSON.stringify(oneLine(title))}`);
  if (desc && desc !== title) parts.push(`desc=${JSON.stringify(oneLine(desc))}`);

  return parts.join(" ");
}

export function labelFor(el: any) {
  const role = jxa.axString(el, "AXRole") || "AXUIElement";
  const subrole = jxa.axString(el, "AXSubrole");
  const title = jxa.axString(el, "AXTitle");
  const desc = jxa.axString(el, "AXDescription");
  const value = jxa.axString(el, "AXValue");

  const parts = [role];
  if (subrole) parts.push(`subrole=${JSON.stringify(subrole)}`);
  if (title) parts.push(`title=${JSON.stringify(title)}`);
  else if (desc) parts.push(`desc=${JSON.stringify(desc)}`);
  else if (value) parts.push(`value=${JSON.stringify(value)}`);

  return parts.join(" ");
}
