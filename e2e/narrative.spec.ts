// Real-browser verification of the narrative runtime (docs/narrative.md §5,
// decisions_needed.md D16, SPRINT_032).
//
// verifyLevel.spec.ts proves levels are completable; this proves the story
// layer wrapped around them actually appears, advances, and gets out of the
// way. Both halves matter for the same reason SPRINT_029 built this gate at
// all: neither the solver nor the headless witness replay touches the DOM, and
// a full-screen cutscene overlay is precisely the kind of thing that can
// silently swallow a real player's clicks.
//
// Narrative is suppressed under a bare ?debugLevel= (main.ts) so the 60
// level-verification runs stay untouched; ?narrative=1 opts back in, which is
// what the completion test below uses.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveLevel } from '../src/generation/LevelSolver';
import type { LevelDef } from '../src/levels/LevelSchema';
import { performAction, dismissTutorial } from './actionToInput';

const LEVELS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');

test('the opening sequence plays once, before the campaign is first entered', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-local').click();

  // Three panels: Flatline → Split → Wisps (narrative.md §5.1).
  const cutscene = page.locator('[data-cutscene="prologue"]');
  await expect(cutscene).toBeVisible({ timeout: 15_000 });
  await expect(cutscene.locator('[data-cutscene-monitor]')).toContainText('DAY 214');

  await expect(cutscene.locator('[data-cutscene-panel="0"]')).toBeVisible();
  await cutscene.locator('[data-cutscene-advance]').click();
  await expect(cutscene.locator('[data-cutscene-panel="1"]')).toBeVisible();
  await cutscene.locator('[data-cutscene-advance]').click();
  await expect(cutscene.locator('[data-cutscene-panel="2"]')).toBeVisible();
  await cutscene.locator('[data-cutscene-advance]').click();

  // Dismissed, and the campaign is reachable behind it.
  await expect(cutscene).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'SELECT DESCENT' })).toBeVisible();

  // Beats never auto-replay — a reload must go straight to the level select.
  await page.reload();
  await page.locator('#btn-local').click();
  await expect(page.getByRole('heading', { name: 'SELECT DESCENT' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-cutscene="prologue"]')).toHaveCount(0);
});

test('a level beat plays after the LevelComplete screen, not before it', async ({ page }) => {
  const def = JSON.parse(readFileSync(join(LEVELS_DIR, 'level_01.json'), 'utf-8')) as LevelDef;
  const result = solveLevel(def);
  expect(result.solvable).toBe(true);

  await page.goto('/?debugLevel=level_01&narrative=1');
  await page.waitForFunction(() => window.__e2e?.GameState.phase === 'PLAYING', undefined, { timeout: 15_000 });
  await dismissTutorial(page);

  for (const action of result.solutionPath) {
    // eslint-disable-next-line no-await-in-loop
    await performAction(page, action);
  }

  // D16's ordering: mechanical resolution first…
  await expect(page.getByRole('heading', { name: 'NEXUS CLEARED' })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-cutscene]')).toHaveCount(0);

  // …then the story beat.
  await page.getByRole('button', { name: 'NEXT LEVEL' }).click();
  const cutscene = page.locator('[data-cutscene="eeg_flicker"]');
  await expect(cutscene).toBeVisible();
  await expect(cutscene.locator('[data-cutscene-monitor]')).toContainText('EEG');

  // Skipping must close it and let the campaign continue into the next level.
  await cutscene.locator('[data-cutscene-skip]').click();
  await expect(cutscene).toHaveCount(0);
  await page.waitForFunction(
    () => window.__e2e?.GameState.currentLevel === 'level_02',
    undefined, { timeout: 15_000 },
  );
});
