import * as jxa from "./_.js";

export function copyAttrRaw(el: any, attr: string) {
  return jxa.axCopy(el, attr).value;
}

export function getAttr(el: any, attr: string) {
  return jxa.coerceAxValue(copyAttrRaw(el, attr));
}
