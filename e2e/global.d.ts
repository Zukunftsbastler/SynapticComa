// Ambient type for window.__e2e (src/main.ts, debugLevel-gated only) — the
// read-only introspection surface actionToInput.ts reads to decide what to
// click next. Declared separately here since e2e/ isn't part of the main
// tsconfig program (`include: ["src"]`) that main.ts's own inline
// `declare global` lives under.

import type { GameState } from '../src/state/GameState';
import type { inventory } from '../src/state/InventoryState';
import type { scrapPool } from '../src/state/ScrapPoolState';
import type { uiState } from '../src/ui/uiState';
import type { PixiDriver } from '../src/rendering/PixiDriver';
import type { TutorialDirector } from '../src/tutorial/TutorialDirector';

export {};

declare global {
  interface Window {
    __e2e?: {
      GameState: typeof GameState;
      inventory: typeof inventory;
      scrapPool: typeof scrapPool;
      uiState: typeof uiState;
      driver: PixiDriver;
      tutorials: TutorialDirector;
    };
    __realRandom?: () => number;
  }
}
