export type RaycastFocus = {
  bundleId?: string;
  role?: string;
  placeholder?: string;
  description?: string;
  focused?: boolean;
};

type RaycastAddon = { readFocus(): Promise<string> };
let addon: RaycastAddon | undefined;

export async function readRaycastFocus(): Promise<RaycastFocus> {
  if (!addon) {
    const module = { exports: {} as RaycastAddon };
    process.dlopen(module, import.meta.chord.resolveNative("raycast"));
    addon = module.exports;
  }
  return JSON.parse(await addon.readFocus());
}
