// One-shot tuning helper (SPRINT_007): for every level, compute
//   optNoUnlock — minimal AP cost ignoring the Shared Unlock (pair removed)
//   minAP       — smallest initialAP for which the level stays solvable
// and report what initialAP would make the unlock mandatory.
// Run: npx tsx --tsconfig tsconfig.json scripts/tuneInitialAP.ts

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveLevel } from '@/generation/LevelSolver';
import type { LevelDef } from '@/levels/LevelSchema';

const levelsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/levels');
const files = readdirSync(levelsDir).filter(f => /^level_\d+\.json$/.test(f)).sort();

for (const file of files) {
  const def = JSON.parse(readFileSync(join(levelsDir, file), 'utf8')) as LevelDef;

  // Optimal without any unlock available.
  const noUnlock: LevelDef = { ...def, apUnlockNodes: [] };
  const rNo = solveLevel(noUnlock);
  const optNo = rNo.solvable ? rNo.optimalCost : Infinity;

  // Scan initialAP downward to find the minimum that stays solvable (unlock allowed).
  let minAP = -1;
  for (let ap = 1; ap <= def.initialAP; ap++) {
    const r = solveLevel({ ...def, initialAP: ap });
    if (r.solvable) { minAP = ap; break; }
  }

  console.log(
    `${def.id}  optNoUnlock=${optNo === Infinity ? '∞' : optNo}  minInitialAP=${minAP}  ` +
    `(forced-coord range: initialAP ${minAP}..${optNo === Infinity ? '∞' : optNo - 1})  [${def.name}]`,
  );
}
