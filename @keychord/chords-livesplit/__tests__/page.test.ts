import { Window } from "happy-dom";
import { beforeEach, expect, test } from "bun:test";
import { buildLiveSplitJavaScript, type LiveSplitAction } from "../src/js/livesplit/page";

type Json = Record<string, unknown>;
type Settings = { components: unknown[]; general: Json };

const storageKey = "keychord.livesplit.accuracies";
// livesplit-core fills missing fields with these defaults when it parses component settings.
const defaults: Json = {
  Splits: {
    split_time_accuracy: "Seconds",
    segment_time_accuracy: "Hundredths",
    delta_time_accuracy: "Tenths",
    columns: [{ name: "Time", update_with: "SplitTime" }],
  },
  Timer: { accuracy: "Hundredths", height: 60 },
  DetailedTimer: {
    timer: { accuracy: "Hundredths" },
    segment_timer: { accuracy: "Hundredths" },
    comparison_times_accuracy: "Hundredths",
  },
  PreviousSegment: { accuracy: "Tenths" },
  Title: { show_attempt_count: true },
};

let rejectLayouts: boolean;
class FakeLayout {
  disposed = false;
  constructor(readonly settings: Settings) {}
  static parseJson(settings: Settings): FakeLayout | null {
    if (rejectLayouts) return null;
    const components = settings.components.map((component) => {
      if (typeof component === "string") return component;
      const [type, value] = Object.entries(component as Json)[0]!;
      return { [type]: { ...structuredClone(defaults[type] as Json), ...(value as Json) } };
    });
    return new FakeLayout(structuredClone({ ...settings, components }));
  }
  settingsAsJson(): Settings {
    if (this.disposed) throw new Error("used a disposed layout");
    return structuredClone(this.settings);
  }
  [Symbol.dispose]() {
    this.disposed = true;
  }
}

// Mirrors LiveSplit One's root component: React applies setState asynchronously.
class FakeApp {
  state: { layout: FakeLayout; layoutModified: boolean; menu: Json };
  saved: Settings[] = [];
  constructor(settings: Settings) {
    this.state = {
      layout: FakeLayout.parseJson(settings)!,
      layoutModified: false,
      menu: { kind: 0 },
    };
  }
  setLayout(layout: FakeLayout) {
    this.state.layout[Symbol.dispose]();
    this.setState({ layout, layoutModified: true });
  }
  setState(update: Json, callback?: () => void) {
    queueMicrotask(() => {
      Object.assign(this.state, update);
      callback?.();
    });
  }
  async saveLayout() {
    this.saved.push(this.state.layout.settingsAsJson());
    this.setState({ layoutModified: false });
  }
}

let window: Window;
let app: FakeApp;

function layout(): Settings {
  return {
    components: [
      { Title: {} },
      { Splits: { split_time_accuracy: "Tenths" } },
      "Separator",
      { Timer: { accuracy: "Hundredths" } },
      { DetailedTimer: { timer: { accuracy: "Tenths" }, segment_timer: { accuracy: "Seconds" } } },
      { PreviousSegment: { accuracy: "Hundredths" } },
    ],
    general: { direction: "Vertical" },
  };
}

function mount(settings = layout()) {
  app = new FakeApp(settings);
  const base = window.document.createElement("div");
  base.id = "base";
  window.document.body.append(base);
  // React's HostRoot fiber, with unrelated components before the LiveSplit component.
  Object.assign(base, {
    __reactContainer$test: {
      stateNode: { containerInfo: base },
      child: {
        stateNode: null,
        child: { stateNode: { state: {} }, child: null, sibling: null },
        sibling: { stateNode: app, child: { stateNode: window.document.createElement("div") } },
      },
    },
  });
}

function accuracies(settings = app.state.layout.settingsAsJson()) {
  const found: Record<string, string> = {};
  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Json)) {
      if (key.endsWith("accuracy")) found[`${path}.${key}`] = value as string;
      else visit(value, `${path}.${key}`);
    }
  };
  settings.components.forEach((component, index) => visit(component, String(index)));
  return found;
}

async function run(action: LiveSplitAction = "TOGGLE_MILLISECONDS") {
  const body = buildLiveSplitJavaScript(action);
  return JSON.parse(await window.eval(`(async () => {${body}})()`)) as {
    ok: boolean;
    milliseconds?: boolean;
    error?: string;
  };
}

beforeEach(() => {
  window = new Window();
  rejectLayouts = false;
  mount();
});

test("shows every time in milliseconds, saves the layout and remembers prior accuracies", async () => {
  const before = app.state.layout;
  expect(await run()).toEqual({ ok: true, milliseconds: true });

  expect(accuracies()).toEqual({
    "1.Splits.split_time_accuracy": "Milliseconds",
    "1.Splits.segment_time_accuracy": "Milliseconds",
    "1.Splits.delta_time_accuracy": "Milliseconds",
    "3.Timer.accuracy": "Milliseconds",
    "4.DetailedTimer.timer.accuracy": "Milliseconds",
    "4.DetailedTimer.segment_timer.accuracy": "Milliseconds",
    "4.DetailedTimer.comparison_times_accuracy": "Milliseconds",
    "5.PreviousSegment.accuracy": "Milliseconds",
  });
  // Other settings, including settings-free components, survive unchanged.
  const settings = app.state.layout.settingsAsJson();
  expect(settings.components[2]).toBe("Separator");
  expect(settings.components[0]).toEqual({ Title: { show_attempt_count: true } });
  expect(settings.general).toEqual({ direction: "Vertical" });
  expect(before.disposed).toBe(true);
  expect(app.saved).toHaveLength(1);
  expect(accuracies(app.saved[0])).toEqual(accuracies());
  expect(app.state.layoutModified).toBe(false);
  expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toContainEqual({
    component: 1,
    type: "Splits",
    path: ["split_time_accuracy"],
    value: "Tenths",
  });
});

test("toggling again restores the remembered accuracies", async () => {
  const original = accuracies();
  await run();
  expect(await run()).toEqual({ ok: true, milliseconds: false });
  expect(accuracies()).toEqual(original);
  expect(app.saved).toHaveLength(2);
  expect(accuracies(app.saved[1])).toEqual(original);
  expect(window.localStorage.getItem(storageKey)).toBeNull();
});

test("a setting that was already in milliseconds stays in milliseconds after toggling back", async () => {
  const settings = layout();
  settings.components[3] = { Timer: { accuracy: "Milliseconds" } };
  window.document.getElementById("base")!.remove();
  mount(settings);
  await run();
  await run();
  expect(accuracies()["3.Timer.accuracy"]).toBe("Milliseconds");
  expect(accuracies()["1.Splits.split_time_accuracy"]).toBe("Tenths");
});

test("without remembered values, toggling back uses livesplit-core's defaults", async () => {
  const settings = FakeLayout.parseJson(layout())!.settingsAsJson();
  settings.components = settings.components.map((component) =>
    JSON.parse(
      JSON.stringify(component).replace(/"(Seconds|Tenths|Hundredths)"/g, '"Milliseconds"'),
    ),
  );
  window.document.getElementById("base")!.remove();
  mount(settings);
  window.localStorage.setItem(storageKey, "not json");

  expect(await run()).toEqual({ ok: true, milliseconds: false });
  expect(accuracies()).toEqual({
    "1.Splits.split_time_accuracy": "Seconds",
    "1.Splits.segment_time_accuracy": "Hundredths",
    "1.Splits.delta_time_accuracy": "Tenths",
    "3.Timer.accuracy": "Hundredths",
    "4.DetailedTimer.timer.accuracy": "Hundredths",
    "4.DetailedTimer.segment_timer.accuracy": "Hundredths",
    "4.DetailedTimer.comparison_times_accuracy": "Hundredths",
    "5.PreviousSegment.accuracy": "Tenths",
  });
});

test("applies the toggle without saving other unsaved layout edits", async () => {
  app.state.layoutModified = true;
  expect(await run()).toEqual({ ok: true, milliseconds: true });
  expect(accuracies()["3.Timer.accuracy"]).toBe("Milliseconds");
  expect(app.saved).toEqual([]);
  expect(app.state.layoutModified).toBe(true);
});

test("refuses to change the layout while the layout editor is open", async () => {
  const before = app.state.layout;
  app.state.menu = { kind: 4, editor: { addComponent() {} } };
  expect(await run()).toEqual({
    ok: false,
    error: "Close LiveSplit One's layout editor before toggling milliseconds.",
  });
  expect(app.state.layout).toBe(before);
  expect(app.saved).toEqual([]);
});

test("reports a page that has not loaded LiveSplit One", async () => {
  window.document.getElementById("base")!.remove();
  expect(await run()).toEqual({ ok: false, error: "LiveSplit One has not finished loading." });
});

test("reports a layout without accuracy settings", async () => {
  window.document.getElementById("base")!.remove();
  mount({ components: [{ Title: {} }, "Separator"], general: {} });
  expect(await run()).toEqual({
    ok: false,
    error: "The current LiveSplit One layout shows no times with an accuracy setting.",
  });
});

test("keeps the current layout when LiveSplit One rejects the update", async () => {
  const before = app.state.layout;
  rejectLayouts = true;
  expect(await run()).toEqual({ ok: false, error: "LiveSplit One rejected the updated layout." });
  expect(app.state.layout).toBe(before);
  expect(before.disposed).toBe(false);
  expect(window.localStorage.getItem(storageKey)).toBeNull();
});

test("rejects unknown actions before building the payload", () => {
  expect(() => buildLiveSplitJavaScript("RESET" as LiveSplitAction)).toThrow(
    "Unknown LiveSplit One action: RESET",
  );
});
