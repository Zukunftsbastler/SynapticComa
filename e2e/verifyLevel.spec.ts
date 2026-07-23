// Real-browser verification gate (docs/generative_levels.md §3's acceptance
// gate). Neither validateLevels.ts's static UI-producer scan (SPRINT_015) nor
// WitnessReplay.ts's headless ECS replay (SPRINT_016) touch the DOM — both
// say so explicitly in their own sprint docs. This spec is the missing piece:
// it drives a real rendered page through the solver's own witness via real
// clicks/keys (actionToInput.ts) and asserts the level actually completes.
//
// Scope: one test per level id. By default, every id in LEVEL_ORDER plus the
// Generator's `_candidate` scratch slot. Set E2E_LEVEL=level_05,level_12 (or
// E2E_LEVEL=_candidate, what scripts/generateLevel.ts uses) to run a subset —
// solving+replaying the full campaign is slow by nature (some levels take
// 30-60s just to solve, matching validate:levels' own known runtime) and
// there's no need to pay that cost while iterating on one level or candidate.

import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveLevel } from '../src/generation/LevelSolver';
import type { LevelDef } from '../src/levels/LevelSchema';
import { LEVEL_ORDER } from '../src/levels/levelIndex';
import { performAction, assertLevelComplete, dismissTutorial } from './actionToInput';

const LEVELS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');

function loadLevelDef(id: string): LevelDef {
  return JSON.parse(readFileSync(join(LEVELS_DIR, `${id}.json`), 'utf-8')) as LevelDef;
}

const filter = process.env.E2E_LEVEL?.split(',').map(s => s.trim()).filter(Boolean);
const idsToRun = filter && filter.length > 0 ? filter : [...LEVEL_ORDER, '_candidate'];

for (const levelId of idsToRun) {
  test(`${levelId} completes via real browser replay of the solver's witness`, async ({ page }) => {
    const def = loadLevelDef(levelId);
    const result = solveLevel(def);
    if (!result.solvable) {
      throw new Error(`${levelId}: solver reports unsolvable (${result.reason}) — nothing to replay`);
    }

    await page.goto(`/?debugLevel=${levelId}`);
    await page.waitForFunction(() => window.__e2e?.GameState.phase === 'PLAYING', undefined, { timeout: 15_000 });
    await dismissTutorial(page); // clears any popup that fires immediately on load

    for (const action of result.solutionPath) {
      // eslint-disable-next-line no-await-in-loop
      await performAction(page, action);
    }

    await assertLevelComplete(page);
  });
}
