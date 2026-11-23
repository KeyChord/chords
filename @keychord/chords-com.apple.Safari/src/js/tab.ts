import addon from "./safari.node";

export default function buildTabHandler() {
  let previous = Promise.resolve();
  return function tab(direction: "LEFT" | "RIGHT", target: "TAB" | "GROUP" = "TAB") {
    const action = previous.then(() =>
      target === "GROUP" ? addon.moveTabGroup(direction) : addon.moveTab(direction),
    );
    previous = action.catch(() => {});
    return action;
  };
}
