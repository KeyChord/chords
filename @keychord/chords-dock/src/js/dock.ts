import { tap } from "chord";

export default function buildDockHandler() {
  return function dock(index: number) {
    tap("ctrl+f3");
  };
}
