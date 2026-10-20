export type LiveSplitAction = "TOGGLE_MILLISECONDS";

const ACTIONS: readonly string[] = ["TOGGLE_MILLISECONDS"] satisfies LiveSplitAction[];

// Serialized into LiveSplit One's web view; keep every dependency inside this function.
async function runInPage(action: LiveSplitAction): Promise<string> {
  try {
    if (action !== "TOGGLE_MILLISECONDS") {
      throw new Error(`Unknown LiveSplit One action: ${String(action)}`);
    }
    const accuracies = ["Seconds", "Tenths", "Hundredths", "Milliseconds"];
    // Remembers the accuracies that milliseconds replaced, so toggling off restores them.
    const storageKey = "keychord.livesplit.accuracies";

    type Json = Record<string, unknown>;
    type Settings = { components: unknown[]; general: unknown };
    type Layout = { settingsAsJson(): Settings; [Symbol.dispose](): void };
    type LayoutClass = { parseJson(settings: Settings): Layout | null };
    type App = {
      state: {
        layout: Layout;
        layoutModified: boolean;
        menu?: { editor?: { addComponent?: unknown } };
      };
      setLayout(layout: Layout): void;
      saveLayout(): Promise<void>;
      setState(state: object, callback: () => void): void;
    };
    type Fiber = { stateNode?: Partial<App> | null; child?: Fiber | null; sibling?: Fiber | null };
    type Field = { component: number; type: string; path: string[]; value: string };

    // LiveSplit One keeps the live layout in its root class component's state.
    const base = document.getElementById("base") as (HTMLElement & Record<string, Fiber>) | null;
    const containerKey =
      base && Object.keys(base).find((key) => key.startsWith("__reactContainer$"));
    const fibers: (Fiber | null | undefined)[] = containerKey ? [base[containerKey]] : [];
    let found: App | undefined;
    while (fibers.length > 0 && !found) {
      const fiber = fibers.pop();
      if (!fiber) continue;
      const node = fiber.stateNode;
      if (
        typeof node?.saveLayout === "function" &&
        typeof node.setLayout === "function" &&
        node.state?.layout
      ) {
        found = node as App;
      } else {
        fibers.push(fiber.sibling, fiber.child);
      }
    }
    if (!found) throw new Error("LiveSplit One has not finished loading.");
    const app = found;
    // The layout editor edits a copy, which replaces the live layout when it closes.
    if (typeof app.state.menu?.editor?.addComponent === "function") {
      throw new Error("Close LiveSplit One's layout editor before toggling milliseconds.");
    }

    const isAccuracy = (value: unknown): value is string =>
      typeof value === "string" && accuracies.includes(value);
    const lookup = (node: unknown, path: string[]) =>
      path.reduce<unknown>(
        (value, key) => (value && typeof value === "object" ? (value as Json)[key] : undefined),
        node,
      );
    const sameField = (a: Field, b: Field) =>
      a.component === b.component && a.type === b.type && a.path.join("\0") === b.path.join("\0");

    // Every component stores its time accuracies as `accuracy` or `*_accuracy`, including the
    // Detailed Timer's nested timers.
    function accuracyFields(settings: Settings): Field[] {
      const fields: Field[] = [];
      settings.components.forEach((component, index) => {
        // Components without settings, such as the separator, serialize as plain strings.
        if (!component || typeof component !== "object") return;
        const [type, value] = Object.entries(component as Json)[0] ?? [];
        const visit = (node: unknown, path: string[]) => {
          if (!node || typeof node !== "object") return;
          for (const [key, child] of Object.entries(node as Json)) {
            if (/(?:^|_)accuracy$/.test(key) && isAccuracy(child)) {
              fields.push({ component: index, type: type!, path: [...path, key], value: child });
            } else {
              visit(child, [...path, key]);
            }
          }
        };
        if (type) visit(value, []);
      });
      return fields;
    }

    const current = app.state.layout;
    const Layout = current.constructor as unknown as LayoutClass;
    const settings = current.settingsAsJson();
    const fields = accuracyFields(settings);
    if (fields.length === 0) {
      throw new Error("The current LiveSplit One layout shows no times with an accuracy setting.");
    }
    const enable = fields.some((field) => field.value !== "Milliseconds");

    let saved: Field[] = [];
    if (!enable) {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(parsed)) saved = parsed;
      } catch {
        // Fall back to the defaults below.
      }
    }
    // Component settings deserialize with livesplit-core's defaults for missing fields.
    const defaults = new Map<string, unknown>();
    function defaultAccuracy(field: Field): unknown {
      if (!defaults.has(field.type)) {
        const parsed = Layout.parseJson({ components: [{ [field.type]: {} }], general: {} });
        defaults.set(field.type, (parsed?.settingsAsJson().components[0] as Json)?.[field.type]);
        parsed?.[Symbol.dispose]();
      }
      return lookup(defaults.get(field.type), field.path);
    }

    for (const field of fields) {
      let value: unknown = "Milliseconds";
      if (!enable) {
        value = saved.find((entry) => sameField(entry, field))?.value;
        if (!isAccuracy(value)) value = defaultAccuracy(field);
        if (!isAccuracy(value)) value = "Hundredths";
      }
      const component = (settings.components[field.component] as Json)[field.type];
      const parent = lookup(component, field.path.slice(0, -1)) as Json;
      parent[field.path.at(-1)!] = value;
    }

    const next = Layout.parseJson(settings);
    if (!next) throw new Error("LiveSplit One rejected the updated layout.");
    const hadUnsavedChanges = app.state.layoutModified;
    app.setLayout(next);
    // setLayout updates React state asynchronously, and saveLayout reads the new state.
    await new Promise<void>((resolve) => app.setState({}, resolve));
    // Persist the toggle, but never save other layout edits the user has not saved yet.
    if (!hadUnsavedChanges) await app.saveLayout();
    if (enable) localStorage.setItem(storageKey, JSON.stringify(fields));
    else localStorage.removeItem(storageKey);
    return JSON.stringify({ ok: true, milliseconds: enable });
  } catch (error) {
    return JSON.stringify({ ok: false, error: (error as Error).message });
  }
}

/** Returns the body of an async function, as WKWebView's callAsyncJavaScript expects. */
export function buildLiveSplitJavaScript(action: LiveSplitAction): string {
  if (!ACTIONS.includes(action)) throw new Error(`Unknown LiveSplit One action: ${action}`);
  return `return await (${runInPage.toString()})(${JSON.stringify(action)});`;
}
