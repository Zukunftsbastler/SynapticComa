// CLI entry point for The Generator (docs/generative_levels.md §3).
// Usage:
//   npm run generate:level -- --difficulty=6 --mechanics=UNLOCK_RED,RESONANCE --seed=42 [--out=path.json]
//
// Pipeline: LevelGenerator.ts's solver-only retry loop produces ONE candidate
// (it already retries internally against fresh sub-seeds — see its own file
// header) — THIS script then runs the two checks Till specifically asked
// for and that LevelGenerator.ts itself doesn't run: WitnessReplay.ts's
// headless ECS truth-check (same gate validate:levels uses) and the real-
// browser Playwright gate (e2e/verifyLevel.spec.ts) added alongside this
// generator. Only a candidate that clears all three is written out as real.
//
// Deliberately ONE candidate per invocation, not an inner retry-on-e2e-
// failure loop: `_candidate.json` is loaded via a dynamic import() cached by
// Node's ESM loader (LevelLoaderSystem.ts's LEVEL_MODULES), so regenerating
// and re-importing the same path within one process would silently return
// the FIRST import's stale module. Re-run the CLI (a fresh process) with a
// different --seed if a candidate is rejected — simpler and safer than
// fighting the module cache.

import { writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { generateLevel } from '@/generation/LevelGenerator';
import type { MechanicId } from '@/generation/LevelGenerator';
import { replayWitness } from '@/generation/WitnessReplay';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidatePath = join(repoRoot, 'src/levels/_candidate.json');

function parseArgs(): { difficulty: number; mechanics: MechanicId[]; seed: number; out: string | null } {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) args.set(m[1], m[2]);
  }
  const difficulty = Number(args.get('difficulty'));
  const seed = Number(args.get('seed'));
  const mechanics = (args.get('mechanics') ?? '').split(',').map(s => s.trim()).filter(Boolean) as MechanicId[];
  if (!Number.isFinite(difficulty) || !Number.isFinite(seed) || mechanics.length === 0) {
    console.error(
      'Usage: npm run generate:level -- --difficulty=<number> --mechanics=<comma-separated> --seed=<number> [--out=path.json]\n' +
      '  mechanics: UNLOCK_RED, UNLOCK_BLUE, FIRE_IMMUNITY (need at least one), ' +
      'plus optional RESONANCE, FOCUS_VAULT, ECHO_TILE',
    );
    process.exit(1);
  }
  return { difficulty, mechanics, seed, out: args.get('out') ?? null };
}

async function main(): Promise<void> {
  const { difficulty, mechanics, seed, out } = parseArgs();
  console.log(`Generating: difficulty=${difficulty} mechanics=[${mechanics.join(',')}] seed=${seed}`);

  const result = generateLevel({ difficulty, mechanics, seed });
  if (!result.ok) {
    console.error(`REJECTED — ${result.reason}`);
    process.exit(1);
  }
  console.log(
    `Solver-verified candidate on attempt ${result.attempt}: ` +
    `optimal=${result.optimalCost} initialAP=${result.initialAP} slack=${result.slack} ` +
    `sync=${result.minSwitches} coord=${result.coordinationSteps} difficulty=${result.difficultyScore}`,
  );

  writeFileSync(candidatePath, JSON.stringify(result.def, null, 2) + '\n');
  console.log(`Wrote candidate to ${candidatePath}`);

  console.log('Running headless witness-replay (WitnessReplay.ts)...');
  const replay = await replayWitness('_candidate', result.solutionPath);
  if (!replay.ok) {
    console.error(`REJECTED — witness replay failed at step ${replay.step} (${replay.action.kind}): ${replay.reason}`);
    process.exit(1);
  }
  console.log(`Witness replay OK (${replay.ticks} ticks).`);

  console.log('Running real-browser verification (Playwright, e2e/verifyLevel.spec.ts)...');
  try {
    execFileSync('npx', ['playwright', 'test', '-g', '_candidate'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, E2E_LEVEL: '_candidate' },
    });
  } catch {
    console.error('REJECTED — the real browser did not complete the level via the solver\'s witness (see Playwright output above).');
    process.exit(1);
  }
  console.log('Real-browser verification OK.');

  if (out) {
    copyFileSync(candidatePath, out);
    console.log(`Copied verified level to ${out}`);
  }
  console.log('ACCEPTED.');
}

main().catch(err => { console.error(err); process.exit(1); });
