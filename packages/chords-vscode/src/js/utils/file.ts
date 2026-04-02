import fs from "fs";

export function exists(path: string) {
  try {
    fs.statSync(path);
    return true;
  } catch (err: any) {
    return false;
    // if (err.code === "ENOENT") return false;
    // throw err; // real error, don’t ignore
  }
}
