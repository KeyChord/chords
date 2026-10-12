import { existsSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, isAbsolute, join, parse, relative, sep } from "node:path";

/** Same package binding and vendored layout as Chord's import.meta hook. */
export function createModuleNamespace(modulePath: string) {
  let root = dirname(modulePath);
  while (!existsSync(join(root, "package.json"))) {
    const parent = dirname(root);
    if (parent === root) throw new Error(`${modulePath} is not inside a chord package`);
    root = parent;
  }
  const parts = relative(root, modulePath).split(sep);
  const vendor =
    parts.length >= 5 && parts[0] === "js" && parts[1].startsWith("@") && parts[3] === "js"
      ? [parts[1], parts[2]]
      : [];
  const triple = `${arch() === "arm64" ? "aarch64" : arch() === "x64" ? "x86_64" : arch()}-${platform() === "darwin" ? "apple-darwin" : platform() === "win32" ? "pc-windows-msvc" : "unknown-linux-gnu"}`;

  function resolvePackageFile(path: string): string {
    const components = path.split("/");
    if (
      !path ||
      isAbsolute(path) ||
      components.some((part) => !part || part === "." || part === "..")
    ) {
      throw new Error("Package-relative paths must not escape the calling package");
    }
    return vendor.length
      ? join(root, components[0], ...vendor, components[0], ...components.slice(1))
      : join(root, ...components);
  }

  return {
    resolvePackageFile,
    resolveNative(path: string): string {
      if (
        path
          .split("/")
          .some((part) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part) || part.endsWith(".node"))
      ) {
        throw new Error("Invalid native module relative path");
      }
      return resolvePackageFile(`target/${triple}/${path}/${parse(path).name}.node`);
    },
  };
}
