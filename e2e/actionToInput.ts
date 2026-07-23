// Translates one SolverAction (src/generation/LevelSolver.ts's witness format)
// into real Playwright input — actual mouse clicks and keydown events against
// the real rendered page, through the real listeners in src/input/*.ts and
// src/ui/MatrixUI.ts. This is the piece neither existing solvability gate
// covers (validateLevels.ts's static UI-producer scan, WitnessReplay.ts's
// headless ECS replay — both explicitly disclaim touching the DOM). Nothing
// here bypasses a listener: every action is a real event Playwright dispatches
// against the page, exactly as a player's click/keypress would arrive.
//
// window.__e2e (main.ts, debugLevel-gated only) is read-only introspection so
// this script can decide WHAT to click next (which player currently holds a
// matching plate, where the matrix origin is) — it is never used to bypass an
// input listener or mutate state directly.

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { SolverAction } from '../src/generation/LevelSolver';
import { ConduitShape } from '../src/types';
import { cellRect, insertArrowRect, scrapPileRect } from '../src/rendering/MatrixRenderer';

const SHAPE_BY_NAME: Record<string, number> = Object.fromEntries(
  Object.entries(ConduitShape).filter(([k]) => Number.isNaN(Number(k))).map(([k, v]) => [k, v as number]),
);

/** Monitor tutorial boxes now require an explicit dismissal (no auto-timeout,
 * per Till's ask — TutorialDirector.ts) and can appear reactively at ANY point
 * mid-action (e.g. a MATRIX_ROTATE tip firing the instant a rotatable plate
 * exists), not just between actions — its box has pointer-events:auto and can
 * sit directly over the element the next click needs to hit (InventoryPanel
 * included), silently swallowing that click. Enter dismisses a non-blocking
 * box; a blocking one ignores Enter by design (doc §3.5 — it waits for the
 * real described action) and could otherwise sit there forever if the
 * witness's own next step never happens to be that exact action, so a
 * blocking box gets skipped via hold-Escape instead, the same documented
 * escape hatch (doc §3.6, TutorialDirector.ts's SKIP_HOLD_MS) a real stuck
 * player has. Checked via TutorialDirector's own isActive getter, not DOM
 * sniffing. Called before every discrete click/keypress below. */
export async function dismissTutorial(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    const active = await page.evaluate(() => window.__e2e!.tutorials.isActive);
    if (!active) return;
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Enter');
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(50);
    // eslint-disable-next-line no-await-in-loop
    const stillActive = await page.evaluate(() => window.__e2e!.tutorials.isActive);
    if (!stillActive) continue; // dismissed — loop once more in case another is queued
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.down('Escape');
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(1100); // > SKIP_HOLD_MS (1000ms), TutorialDirector.ts
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.up('Escape');
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(50);
  }
}

async function click(page: Page, x: number, y: number): Promise<void> {
  await dismissTutorial(page);
  await page.mouse.click(x, y);
}

async function press(page: Page, key: string): Promise<void> {
  await dismissTutorial(page);
  await page.keyboard.press(key);
}

async function currentViewPlayer(page: Page): Promise<0 | 1> {
  return page.evaluate(() => window.__e2e!.GameState.viewPlayerId as 0 | 1);
}

async function switchToPlayer(page: Page, target: 0 | 1): Promise<void> {
  if ((await currentViewPlayer(page)) === target) return;
  await press(page, target === 0 ? '1' : '2');
  await waitForQuiescence(page);
}

async function matrixOrigin(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => window.__e2e!.driver.getMatrixOrigin());
}

async function hexScreen(page: Page, playerIdx: 0 | 1, q: number, r: number): Promise<{ x: number; y: number }> {
  // Convention held by every level/entity in this codebase: avatar_p1 is
  // always dimension A (z=0), avatar_p2 always dimension B (z=1) — never
  // swapped (PlayerFactory.ts), so this is safe to hardcode.
  return page.evaluate(
    ([pIdx, hq, hr]) => (pIdx === 0 ? window.__e2e!.driver.hexToScreenA(hq, hr) : window.__e2e!.driver.hexToScreenB(hq, hr)),
    [playerIdx, q, r] as const,
  );
}

/** Computes a selector's center point via getBoundingClientRect() inside a
 * single page.evaluate() call. Several panels in this codebase (InventoryPanel
 * included) replace their innerHTML every render frame — Playwright's own
 * Locator.boundingBox() resolves the element and measures it as two separate
 * round trips, and consistently loses that race against a ~16ms re-render,
 * returning null every time. A single evaluate() runs query+measure
 * atomically in the page's own JS turn, so it never sees the gap. */
async function elementCenter(page: Page, selector: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
}

/** Waits for the message queue to drain and one render tick to settle — a
 * real synchronization point (GameState.pendingInputs), not an arbitrary sleep. */
export async function waitForQuiescence(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__e2e!.GameState.pendingInputs.length === 0, undefined, { timeout: 5_000 });
  await page.waitForTimeout(80);
}

const MOVE_RE = /^P(\d)→\((-?\d+),(-?\d+)\)( jump)?$/;
const PUSH_RE = /^P(\d) Δ\((-?\d+),(-?\d+)\) block\((-?\d+),(-?\d+)\)→\((-?\d+),(-?\d+)\)$/;
const INSERT_RE = /^(\w+) r(\d) col(2|4) (top|bottom)$/;
const ROTATE_RE = /^col(2|4) row(\d)$/;
const DRAW_RE = /^worst-case (\w+)$/;

export async function performAction(page: Page, action: SolverAction): Promise<void> {
  switch (action.kind) {
    case 'MOVE': {
      const m = MOVE_RE.exec(action.detail);
      if (!m) throw new Error(`actionToInput: unparseable MOVE detail "${action.detail}"`);
      const playerIdx = (Number(m[1]) - 1) as 0 | 1;
      await switchToPlayer(page, playerIdx);
      const { x, y } = await hexScreen(page, playerIdx, Number(m[2]), Number(m[3]));
      await click(page, x, y);
      break;
    }
    case 'PUSH': {
      const m = PUSH_RE.exec(action.detail);
      if (!m) throw new Error(`actionToInput: unparseable PUSH detail "${action.detail}"`);
      const playerIdx = (Number(m[1]) - 1) as 0 | 1;
      await switchToPlayer(page, playerIdx);
      // Click target = the block's current hex (m[4],m[5]) — same as a plain
      // adjacent move; MouseInput.ts dispatches MOVE_AVATAR either way, and
      // PushSystem decides server-side that a pushable occupies the target.
      const { x, y } = await hexScreen(page, playerIdx, Number(m[4]), Number(m[5]));
      await click(page, x, y);
      break;
    }
    case 'INSERT': {
      const m = INSERT_RE.exec(action.detail);
      if (!m) throw new Error(`actionToInput: unparseable INSERT detail "${action.detail}"`);
      const shape = SHAPE_BY_NAME[m[1]];
      const targetRotation = Number(m[2]);
      const column = Number(m[3]) as 2 | 4;
      const fromTop = m[4] === 'top';

      const { p0, p1 } = await page.evaluate(() => ({
        p0: window.__e2e!.inventory.player0,
        p1: window.__e2e!.inventory.player1,
      }));
      let owner: 0 | 1 | null = null;
      let slot = -1;
      const i0 = p0.findIndex(c => c.shape === shape);
      const i1 = p1.findIndex(c => c.shape === shape);
      if (i0 >= 0) { owner = 0; slot = i0; } else if (i1 >= 0) { owner = 1; slot = i1; }
      if (owner === null) throw new Error(`actionToInput: no player holds shape "${m[1]}" for INSERT`);

      await switchToPlayer(page, owner);
      const slotCenter = await elementCenter(page, `[data-slot="${slot}"]`);
      if (!slotCenter) throw new Error(`actionToInput: inventory slot ${slot} not found for player ${owner}`);
      await click(page, slotCenter.x, slotCenter.y);

      // uiState.pendingRotation is guaranteed null here: disarmInsert() resets
      // it unconditionally after every prior insert (MatrixUI.ts), and it
      // starts null. [R] cycles null→0→1→2→3, so reaching `targetRotation`
      // always takes exactly targetRotation+1 presses.
      for (let i = 0; i < targetRotation + 1; i++) {
        // eslint-disable-next-line no-await-in-loop
        await press(page, 'r');
      }

      const origin = await matrixOrigin(page);
      const arrow = insertArrowRect(origin.x, origin.y, column, fromTop);
      await click(page, arrow.x + arrow.w / 2, arrow.y + arrow.h / 2);
      break;
    }
    case 'ROTATE': {
      const m = ROTATE_RE.exec(action.detail);
      if (!m) throw new Error(`actionToInput: unparseable ROTATE detail "${action.detail}"`);
      const column = Number(m[1]) as 2 | 4;
      const row = Number(m[2]);
      const origin = await matrixOrigin(page);
      const rect = cellRect(origin.x, origin.y, column, row);
      await click(page, rect.x + rect.w / 2, rect.y + rect.h / 2);
      break;
    }
    case 'DRAW': {
      // Blind draws are adversarial in the solver's model (LevelSolver.ts) —
      // the witness names the worst-case shape, but the real ScrapPoolSystem
      // draw is genuinely random. WitnessReplay.ts (SPRINT_016) forces this by
      // monkey-patching Math.random right before the draw message; mirrored
      // here inside the page's own realm since it's the page's Math.random
      // (not Node's) that ScrapPoolSystem actually calls.
      const m = DRAW_RE.exec(action.detail);
      if (!m) throw new Error(`actionToInput: unparseable DRAW detail "${action.detail}"`);
      const shape = SHAPE_BY_NAME[m[1]];
      const patched = await page.evaluate((s) => {
        const plates = window.__e2e!.scrapPool.plates;
        const idx = plates.findIndex(p => p.shape === s);
        if (idx === -1) return false;
        window.__realRandom = window.__realRandom ?? Math.random;
        Math.random = () => (idx + 0.5) / plates.length;
        return true;
      }, shape);
      if (!patched) throw new Error(`actionToInput: scrap pool holds no shape matching "${m[1]}" for DRAW`);

      const origin = await matrixOrigin(page);
      const pile = scrapPileRect(origin.x, origin.y);
      await click(page, pile.x + pile.w / 2, pile.y + pile.h / 2);
      await waitForQuiescence(page);
      await page.evaluate(() => { Math.random = window.__realRandom!; });
      break;
    }
  }
  await waitForQuiescence(page);
}

export async function assertLevelComplete(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'NEXUS CLEARED' })).toBeVisible({ timeout: 10_000 });
}
