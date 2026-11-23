import addon from "./spaces.node";

export default function buildSpaceHandler() {
  let previous = Promise.resolve();
  return (command: string) => {
    const action = previous.then(() => addon.switchSpace(command));
    previous = action.catch(() => {});
    return action;
  };
}
