// Seeded PRNG for the Generator (docs/generative_levels.md §3.1): "All
// randomness flows from a single PCG32 stream seeded by the level seed. The
// generator, base assignment, WFC decoration, and the Scrap Pool's blind-draw
// shuffle all draw from forked sub-streams (seed_child = pcg(seed, streamId))
// so that adding a new consumer never perturbs existing ones." No seeded RNG
// existed anywhere in this codebase before this file — everything else
// (DecalState.ts's scatterDecals, PixiDriver's cosmetic variance) uses raw
// Math.random(), which is fine for one-shot cosmetic scatter but wrong for a
// generator that must reproduce the exact same level from the exact same seed.
//
// Standard PCG32 (O'Neill, pcg-random.org, public domain) — 64-bit LCG state
// via BigInt (JS numbers can't hold 64-bit integers precisely), xorshift +
// rotate output. Not cryptographic; doesn't need to be.

const MULTIPLIER = 6364136223846793005n;
const MASK64 = 0xFFFFFFFFFFFFFFFFn;

export class PCG32 {
  private state: bigint;
  private readonly inc: bigint;

  constructor(seed: bigint, streamId: bigint = 1n) {
    this.inc = ((streamId << 1n) | 1n) & MASK64;
    this.state = 0n;
    this.nextUint32();
    this.state = (this.state + seed) & MASK64;
    this.nextUint32();
  }

  /** Uniform in [0, 2^32). */
  nextUint32(): number {
    const oldState = this.state;
    this.state = (oldState * MULTIPLIER + this.inc) & MASK64;
    const xorshifted = Number(((oldState >> 18n) ^ oldState) >> 27n) & 0xFFFFFFFF;
    const rot = Number(oldState >> 59n) & 31;
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  }

  /** Uniform float in [0, 1). */
  nextFloat(): number {
    return this.nextUint32() / 0x100000000;
  }

  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number {
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('PCG32.pick: empty array');
    return items[this.nextInt(items.length)];
  }

  /** Fisher-Yates, in place, returns the same array for convenience. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

/** Forks a sub-stream from a level seed + a stable stream id, per
 * generative_levels.md §3.1's `seed_child = pcg(seed, streamId)` — adding a
 * new consumer (a new streamId) never perturbs any existing one's sequence. */
export function forkStream(seed: number, streamId: number): PCG32 {
  return new PCG32(BigInt(seed >>> 0), BigInt(streamId >>> 0));
}
