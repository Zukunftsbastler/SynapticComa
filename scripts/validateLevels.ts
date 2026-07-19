// validate:levels — proves every campaign level solvable and reports the AP
// economy (generative_levels.md §5). Exits non-zero if any level lacks a
// solvability proof, so it can gate CI/builds.
//
// Run: npm run validate:levels

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveLevel } from '@/generation/LevelSolver';
import { scoreDifficulty } from '@/generation/DifficultyModel';
import type { LevelDef } from '@/levels/LevelSchema';

const levelsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/levels');
const files = readdirSync(levelsDir).filter(f => /^level_\d+\.json$/.test(f)).sort();

let failed = 0;
const rows: string[] = [];

for (const file of files) {
  const def = JSON.parse(readFileSync(join(levelsDir, file), 'utf8')) as LevelDef;
  const unlockTotal = def.apUnlockNodes.reduce((a, u) => a + u.value, 0);
  const t0 = performance.now();
  const result = solveLevel(def);
  const ms = Math.round(performance.now() - t0);

  if (!result.solvable) {
    failed++;
    rows.push(
      `${def.id.padEnd(10)} ✗ UNSOLVABLE (${result.reason}) ` +
      `nodes=${result.nodesExpanded} ${ms}ms  [${def.name}]`,
    );
    continue;
  }

  // Is the DNA Matrix mechanically required, or can the level be walked?
  const noMatrix = solveLevel(def, 2_000_000, { noMatrix: true });
  const matrixRequired = !noMatrix.solvable;

  const d = scoreDifficulty(result, def.initialAP, unlockTotal)!;
  rows.push(
    `${def.id.padEnd(10)} ✓ optimal=${String(result.optimalCost).padStart(2)} AP  ` +
    `slack=${String(d.apSlack).padStart(2)}  tight=${d.tightness.toFixed(2)}  ` +
    `D=${d.score.toFixed(2).padStart(5)}  ` +
    `moves=${result.solutionPath.length} coord=${result.coordinationSteps} draws=${result.drawSteps}  ` +
    `matrix=${matrixRequired ? 'REQ' : 'opt'}  ` +
    `nodes=${result.nodesExpanded} ${ms}ms  [${def.name}]`,
  );
}

console.log('\nSynaptic Coma — campaign solvability proof');
console.log('═'.repeat(100));
for (const r of rows) console.log(r);
console.log('═'.repeat(100));

if (failed > 0) {
  console.error(`\n${failed} level(s) without a solvability proof.`);
  process.exit(1);
}
console.log('\nAll levels provably solvable (worst-case blind draws included).');
