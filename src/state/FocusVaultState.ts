// Focus Vault specs (mechanic_roadmap.md #8), keyed by numeric pair id —
// what plate to spawn where when a pair triggers. Populated by
// LevelLoaderSystem alongside createFocusVaultPair; read by FocusVaultSystem
// at trigger time. Small dedicated state module, same shape as
// ScrapPoolState/InventoryState.
export interface VaultSpec {
  q: number; r: number; z: 0 | 1;
  shape: number; rotation: number;
  entityId: string;
}

export const focusVaults: Map<number, VaultSpec> = new Map();

export function clearFocusVaults(): void {
  focusVaults.clear();
}
