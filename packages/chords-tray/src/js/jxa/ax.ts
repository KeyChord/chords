export function axIsTrusted() {
  return Boolean($.AXIsProcessTrusted());
}

export function axErrorName(err: number) {
  switch (err) {
    case 0:
      return "kAXErrorSuccess";
    case -25200:
      return "kAXErrorFailure";
    case -25201:
      return "kAXErrorIllegalArgument";
    case -25202:
      return "kAXErrorInvalidUIElement";
    case -25203:
      return "kAXErrorInvalidUIElementObserver";
    case -25204:
      return "kAXErrorCannotComplete";
    case -25205:
      return "kAXErrorAttributeUnsupported";
    case -25206:
      return "kAXErrorActionUnsupported";
    case -25207:
      return "kAXErrorNotificationUnsupported";
    case -25208:
      return "kAXErrorNotImplemented";
    case -25209:
      return "kAXErrorNotificationAlreadyRegistered";
    case -25210:
      return "kAXErrorNotificationNotRegistered";
    case -25211:
      return "kAXErrorAPIDisabled";
    case -25212:
      return "kAXErrorNoValue";
    case -25213:
      return "kAXErrorParameterizedAttributeUnsupported";
    case -25214:
      return "kAXErrorNotEnoughPrecision";
    default:
      return `AXError(${err})`;
  }
}

export function cfTypeDescription(value: any) {
  if (!value) return null;

  try {
    return ObjC.unwrap(ObjC.castRefToObject(value).description);
  } catch {
    try {
      return String(value);
    } catch {
      return null;
    }
  }
}

export function isObjCRef(value: any) {
  if (!value) return false;

  try {
    return String(value) === "[object Ref]";
  } catch {
    return false;
  }
}

export function normalizeCfValue(value: any) {
  if (!isObjCRef(value)) return value;

  try {
    return ObjC.castRefToObject(value);
  } catch {
    return value;
  }
}

export function cfString(value: any): string | null {
  if (!value) return null;

  try {
    if (value.js !== undefined && !Array.isArray(value.js)) {
      return String(value.js);
    }
  } catch {}

  try {
    return String(ObjC.unwrap(ObjC.castRefToObject(value)));
  } catch {}

  try {
    return String(ObjC.unwrap(value));
  } catch {}

  return null;
}

export function isAxElement(value: any) {
  if (!value) return false;

  try {
    return $.CFGetTypeID(value) === $.AXUIElementGetTypeID();
  } catch {
    return false;
  }
}

export function isAxValue(value: any) {
  if (!value) return false;

  try {
    return $.CFGetTypeID(value) === $.AXValueGetTypeID();
  } catch {
    return false;
  }
}

export function isCfArray(value: any) {
  if (!value) return false;

  try {
    return $.CFGetTypeID(value) === $.CFArrayGetTypeID();
  } catch {
    return false;
  }
}

export function cfArrayItems(value: any) {
  if (!value) return [];

  try {
    const count = $.CFArrayGetCount(value);
    const items = [];

    for (let i = 0; i < count; i++) {
      items.push(normalizeCfValue($.CFArrayGetValueAtIndex(value, i)));
    }

    return items;
  } catch {
    try {
      return Array.isArray(value.js) ? value.js : [];
    } catch {
      return [];
    }
  }
}

export function coerceAxValue(value: any): any {
  value = normalizeCfValue(value);
  if (!value) return null;
  if (isAxElement(value)) return value;
  if (isCfArray(value)) return cfArrayItems(value).map((item) => coerceAxValue(item));
  if (isAxValue(value)) return cfTypeDescription(value);

  const stringValue = cfString(value);
  if (stringValue !== null) return stringValue;

  return cfTypeDescription(value);
}

export function axCopy(el: any, attr: string) {
  el = normalizeCfValue(el);
  const out = Ref();
  const err = $.AXUIElementCopyAttributeValue(el, $(attr), out);
  return { err, value: normalizeCfValue(out[0] ?? null) };
}

export function axAttrNames(el: any) {
  const out = Ref();
  const err = $.AXUIElementCopyAttributeNames(el, out);
  if (err !== 0 || !out[0]) return [];

  try {
    if (Array.isArray(out[0].js)) {
      return out[0].js.map((item: any) => String(item));
    }
  } catch {}

  return cfArrayItems(out[0]).map((item) => cfString(item) ?? String(item));
}

export function axString(el: any, attr: string): string | null {
  const { err, value } = axCopy(el, attr);
  if (err !== 0 || !value) return null;
  return cfString(value) ?? cfTypeDescription(value);
}

export function axElements(el: any, attr: string) {
  const { err, value } = axCopy(el, attr);
  if (err !== 0 || !value || !isCfArray(value)) return [];

  try {
    if (Array.isArray(value.js)) {
      return value.js;
    }
  } catch {}

  return cfArrayItems(value);
}

export function axElement(el: any, attr: string): any | null {
  const { err, value } = axCopy(el, attr);
  if (err !== 0 || !value) return null;
  return value;
}

export function frontmostAppInfo() {
  const workspace = $.NSWorkspace.sharedWorkspace;
  const app = workspace.frontmostApplication;
  if (!app) return null;

  return {
    name: cfString(app.localizedName) ?? "Unknown",
    pid: Number(app.processIdentifier),
  };
}

export function frontmostAppElement() {
  const info = frontmostAppInfo();
  if (!info || !info.pid) return null;
  return $.AXUIElementCreateApplication(info.pid);
}
