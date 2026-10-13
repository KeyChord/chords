export type RaycastState = {
  bundleId?: string;
  role?: string;
  placeholder?: string;
  description?: string;
  focused?: boolean;
  value?: string;
  rootSearchVisible?: boolean;
  busy?: boolean;
  fingerprint?: string;
};

// Direct command launches need neither a native addon nor Accessibility access.
let addon: Promise<typeof import("./raycast.node")> | undefined;
const native = async () => (await (addon ??= import("./raycast.node"))).default;

export async function readRaycastState(): Promise<RaycastState> {
  return JSON.parse(await (await native()).readState());
}

export async function setRaycastSearch(query: string): Promise<void> {
  await (await native()).setSearch(query);
}

export async function activateRaycastSearch(query: string, fingerprint: string): Promise<boolean> {
  return JSON.parse(await (await native()).activateSearch(query, fingerprint));
}
