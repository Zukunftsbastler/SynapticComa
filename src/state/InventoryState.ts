import { ConduitShape } from '@/types';

export interface CollectedConduit {
  entityId: string;   // designer-facing key (e.g. "conduit_a2") for network messages
  shape:    ConduitShape;
  rotation: number;   // 0–3
}

// Private per-player inventories. Only the owning player sees their own contents.
// Contents are never sent over the network as-is; the Guest learns about new items
// only via INVENTORY_UPDATE messages from the Host (Scrap Pool draws) or by
// collecting conduits locally (which the Host then confirms via STATE_UPDATE).
export const inventory = {
  player0: [] as CollectedConduit[],
  player1: [] as CollectedConduit[],
};

export function clearInventory(): void {
  inventory.player0 = [];
  inventory.player1 = [];
}
