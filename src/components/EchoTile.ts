import { defineComponent } from 'bitecs';

// Tag (mechanic_roadmap.md #3 "Echo Tiles"): standing on this hex briefly
// thins the dimensional split — EchoTileSystem reveals the far board's
// layout for a few seconds. Purely a local rendering concern; no gameplay
// effect, no network message (see EchoTileSystem.ts).
export const EchoTile = defineComponent({});
