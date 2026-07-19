// validate:levels — proves every campaign level solvable and reports the AP
// economy (generative_levels.md §5). Exits non-zero if any level lacks a
// solvability proof, so it can gate CI/builds.
//
// Beyond the solvability proof, three design contracts are enforced as gates:
//   1. Fairness: apSlack ≥ 1 — a level where every single AP is spoken for
//      (slack 0) turns any wasted action into a Dead End; forbidden at all
//      campaign tiers (generative_levels.md §2.4).
//   2. Interaction: minSwitches ≥ 1 — solving must involve both players
//      acting; a level one player could clear alone is a design error.
//   3. UI reachability: every proof runs with only the actions the input/UI
//      layer can actually produce (static scan of src/input + src/ui for the
//      message-type literals). "Rules-solvable" is not "playable": DRAW_SCRAP
//      once had a system and solver support but no UI producer, which made
//      Level 3 provably solvable yet impossible to play. A level failing only
//      under this restriction is reported as a UI-REACHABILITY failure.
//   4. Witness replay: the solver's witness is replayed headless through the
//      REAL system pipeline (generation/WitnessReplay.ts) — every action must
//      be accepted at its exact AP cost and the run must end LEVEL_COMPLETE.
//      This closes the remaining gap: the solver's model of the rules vs.
//      what the shipped systems actually do.
//
// The run also exports src/levels/levelMeta.json — solver-derived metadata
// (optimal cost, slack, difficulty, interaction intensity) consumed by the
// game UI. The file is generated; never edit it by hand.
//
// Run: npm run validate:levels

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveLevel } from '@/generation/LevelSolver';
import { replayWitness } from '@/generation/WitnessReplay';
import { scoreDifficulty } from '@/generation/DifficultyModel';
import { AbilityType } from '@/types';
import type { LevelDef } from '@/levels/LevelSchema';
import type { LevelMeta } from '@/levels/levelMeta';

const ABILITY_SHORT: Record<number, string> = {
  1: 'JUMP', 2: 'PUSH', 3: 'RED', 4: 'BLUE', 5: 'PHASE', 6: 'FIRE',
};

// The switch-metric phase gets a raised node budget here: this script runs
// offline, and an exact minSwitches is worth minutes — the value ships to the
// UI via levelMeta.json. Levels that still exhaust it keep the witness bound.
const NODE_LIMIT          = 10_000_000;
const SWITCH_PHASE_BUDGET = 2_000_000;

const srcDir    = join(dirname(fileURLToPath(import.meta.url)), '../src');
const levelsDir = join(srcDir, 'levels');
const files = readdirSync(levelsDir).filter(f => /^level_\d+\.json$/.test(f)).sort();

// ── UI action-reachability scan ──────────────────────────────────────────────
// A solver action is only usable in a proof if some module in the input/UI
// layer constructs the corresponding GameMessage (object literal with the
// `type:` discriminant). Systems merely CONSUME messages, so only src/input
// and src/ui count as producers.
const KIND_TO_MESSAGE = {
  MOVE:   'MOVE_AVATAR',
  INSERT: 'INSERT_CONDUIT',
  ROTATE: 'ROTATE_CONDUIT',
  DRAW:   'DRAW_SCRAP',
} as const;
type SolverKind = keyof typeof KIND_TO_MESSAGE;

function scanUiProducers(): Set<SolverKind> {
  const producerDirs = [join(srcDir, 'input'), join(srcDir, 'ui')];
  let source = '';
  for (const dir of producerDirs) {
    for (const f of readdirSync(dir).filter(f => f.endsWith('.ts'))) {
      source += readFileSync(join(dir, f), 'utf8');
    }
  }
  const producible = new Set<SolverKind>();
  for (const [kind, msgType] of Object.entries(KIND_TO_MESSAGE)) {
    if (new RegExp(`type:\\s*['"]${msgType}['"]`).test(source)) {
      producible.add(kind as SolverKind);
    }
  }
  return producible;
}

const producibleKinds = scanUiProducers();
const unreachableKinds = (Object.keys(KIND_TO_MESSAGE) as SolverKind[])
  .filter(k => !producibleKinds.has(k));
if (unreachableKinds.includes('MOVE')) {
  console.error('FATAL: no UI producer for MOVE_AVATAR — the game is not playable at all.');
  process.exit(1);
}
const disabledKinds = unreachableKinds.filter(
  (k): k is 'INSERT' | 'ROTATE' | 'DRAW' => k !== 'MOVE',
);
if (disabledKinds.length > 0) {
  console.warn(
    `\n⚠ Solver actions without any UI producer: ${disabledKinds.join(', ')} — ` +
    'all proofs run WITHOUT them (playability, not just rules-solvability).',
  );
}

let failed = 0;
const rows: string[] = [];
const meta: Record<string, LevelMeta> = {};

for (const file of files) {
  const def = JSON.parse(readFileSync(join(levelsDir, file), 'utf8')) as LevelDef;
  const unlockTotal = def.apUnlockNodes.reduce((a, u) => a + u.value, 0);
  const t0 = performance.now();
  const result = solveLevel(def, NODE_LIMIT, {
    switchPhaseNodeBudget: SWITCH_PHASE_BUDGET,
    disabledKinds,
  });
  const ms = Math.round(performance.now() - t0);

  if (!result.solvable) {
    failed++;
    // Distinguish "rules allow no solution" from "the UI cannot deliver the
    // actions the solution needs" — the latter is a code bug, not a level bug.
    let uiOnly = false;
    if (disabledKinds.length > 0) {
      uiOnly = solveLevel(def, NODE_LIMIT, { skipSwitchMetric: true }).solvable;
    }
    rows.push(
      `${def.id.padEnd(10)} ✗ ${uiOnly ? `UI-REACHABILITY (needs: ${disabledKinds.join('/')})` : `UNSOLVABLE (${result.reason})`} ` +
      `nodes=${result.nodesExpanded} ${ms}ms  [${def.name}]`,
    );
    continue;
  }

  // Is the DNA Matrix mechanically required, or can the level be walked?
  const noMatrix = solveLevel(def, 2_000_000, { noMatrix: true, skipSwitchMetric: true });
  const matrixRequired = !noMatrix.solvable;

  // Which abilities are individually REQUIRED (level unsolvable without them)?
  const abilityTypes = [...new Set(def.matrix.nodes.map(n => n.abilityType).filter(t => t > 0))];
  const requiredAbilities: string[] = [];
  for (const t of abilityTypes) {
    const without = solveLevel(def, 1_500_000, {
      disabledAbility: t as AbilityType, skipSwitchMetric: true, disabledKinds,
    });
    if (!without.solvable) requiredAbilities.push(ABILITY_SHORT[t] ?? String(t));
  }

  const d = scoreDifficulty(result, def.initialAP, unlockTotal)!;

  // Gate 1 — fairness: slack 0 means one wasted AP is a Dead End.
  const gateErrors: string[] = [];
  if (d.apSlack < 1) gateErrors.push(`apSlack=${d.apSlack} < 1 (fairness)`);
  // Gate 2 — interaction: both players must act to solve.
  if (result.minSwitches < 1) gateErrors.push('minSwitches=0 (single-player solvable)');
  // Gate 4 — witness replay through the real system pipeline.
  const replay = await replayWitness(def.id, result.solutionPath);
  if (!replay.ok) {
    gateErrors.push(
      `WITNESS-REPLAY failed at step ${replay.step} ` +
      `[${replay.action.kind} ${replay.action.detail}]: ${replay.reason}`,
    );
  }
  if (gateErrors.length > 0) failed++;

  meta[def.id] = {
    optimalCost:       result.optimalCost,
    apSlack:           d.apSlack,
    difficulty:        d.score,
    minSwitches:       result.minSwitches,
    minSwitchesExact:  result.minSwitchesExact,
    coordinationSteps: result.coordinationSteps,
    drawSteps:         result.drawSteps,
    matrixRequired,
  };

  rows.push(
    `${def.id.padEnd(10)} ${gateErrors.length ? '✗' : '✓'} optimal=${String(result.optimalCost).padStart(2)} AP  ` +
    `slack=${String(d.apSlack).padStart(2)}  D=${d.score.toFixed(2).padStart(5)}  ` +
    `sync=${result.minSwitches}${result.minSwitchesExact ? '' : '≤'} ` +
    `coord=${result.coordinationSteps} draws=${result.drawSteps}  ` +
    `matrix=${matrixRequired ? 'REQ' : 'opt'}  ` +
    `needs=[${requiredAbilities.join(',') || '—'}]  ` +
    `${ms}ms  [${def.name}]` +
    (gateErrors.length ? `\n${''.padEnd(11)}   GATE: ${gateErrors.join('; ')}` : ''),
  );
}

console.log('\nSynaptic Coma — campaign solvability proof');
console.log('═'.repeat(100));
for (const r of rows) console.log(r);
console.log('═'.repeat(100));

if (failed > 0) {
  console.error(`\n${failed} level(s) failed (missing proof or design-contract gate).`);
  process.exit(1);
}

const metaPath = join(levelsDir, 'levelMeta.json');
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
console.log(`\nAll levels provably solvable (worst-case blind draws included).`);
console.log(`Metadata exported → ${metaPath}`);
