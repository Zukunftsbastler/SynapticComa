// Narrative runtime tests (docs/narrative.md §5, decisions_needed.md D16,
// SPRINT_032).
//
// Covers the ECS half of the feature — the beat schedule, the event-entity
// hop, and the guarantee that a level WITHOUT a scheduled beat stays silent.
// The CutscenePlayer overlay is deliberately not unit-tested here: it is DOM
// presentation, verified end to end by e2e/narrative.spec.ts instead, the same
// split every other overlay in this project already uses.

import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld, addEntity, addComponent } from 'bitecs';
import type { IWorld } from 'bitecs';
import { loadLevel } from '@/systems/LevelLoaderSystem';
import { runCoreSystems } from '@/systems/pipeline';
import { NarrativeSystem } from '@/systems/NarrativeSystem';
import { GameState } from '@/state/GameState';
import { entityRegistry } from '@/registry/EntityRegistry';
import { NarrativeBeatEvent } from '@/components';
import { narrativeBeatQuery } from '@/queries';
import { beatAfterLevel, BEAT_AFTER_LEVEL } from '@/narrative/beatIndex';
import { BEATS, BeatId, BeatKind, monitorLine, STORY_VARIANT_COUNT } from '@/narrative/beats';
import { BodyRegion } from '@/narrative/regions';
import { BODY_REGION_COUNT, bodyProgressLabel } from '@/ui/BodyDiagram';
import type { MoveAvatarMessage } from '@/network/messages';

function tick(world: IWorld): void {
  runCoreSystems(world, GameState);
}

/** Walks a wisp one hex; used to drive a level to its exit. */
function move(entityId: string, dq: number, dr: number): MoveAvatarMessage {
  return {
    type: 'MOVE_AVATAR', entityId, dq, dr,
    seq: GameState.outSeq++, senderId: 0, tick: 0,
  };
}

beforeEach(() => {
  GameState.localPlayerId = 0;
  GameState.viewPlayerId  = 0;
  GameState.pendingBeats  = [];
  entityRegistry.clear();
});

describe('beat schedule', () => {
  it('maps a level to its scheduled beat and leaves unscheduled levels silent', () => {
    expect(beatAfterLevel('level_05')).toBe(BeatId.REGION_FINGERS);
    // level_12 carries no beat — most levels don't, and that must not throw.
    expect(beatAfterLevel('level_12')).toBeNull();
    expect(beatAfterLevel('level_99')).toBeNull();
  });

  it('gives every one of levels 1-10 a beat (D16: no silent gaps in the opening window)', () => {
    for (let n = 1; n <= 10; n++) {
      const id = `level_${String(n).padStart(2, '0')}`;
      expect(beatAfterLevel(id), `${id} must carry a beat`).not.toBeNull();
    }
  });

  it('resolves the Fork slot by the chosen track, without branching the level order', () => {
    expect(beatAfterLevel('level_75')).toBe(BeatId.REGION_LIMB_MOBILITY);
    expect(beatAfterLevel('level_75', 'motor')).toBe(BeatId.REGION_LIMB_MOBILITY);
    expect(beatAfterLevel('level_75', 'sense')).toBe(BeatId.REGION_LANGUAGE);
    // The choice must not leak into any other slot.
    expect(beatAfterLevel('level_05', 'sense')).toBe(BeatId.REGION_FINGERS);
  });

  it('is scheduled against the full 100-level campaign, not just the shipped 59', () => {
    const scheduled = Object.keys(BEAT_AFTER_LEVEL);
    expect(scheduled).toContain('level_100');
    expect(scheduled.some(id => Number(id.slice(6)) > 59)).toBe(true);
  });
});

describe('beat registry', () => {
  it('every scheduled beat exists, and every region beat names a region', () => {
    for (const beatId of Object.values(BEAT_AFTER_LEVEL)) {
      const def = BEATS[beatId];
      expect(def, `beat ${beatId} must be defined`).toBeDefined();
      expect(def.panels.length).toBeGreaterThan(0);
      if (def.kind === BeatKind.REGION_UNLOCK) {
        expect(Object.values(BodyRegion)).toContain(def.region);
      }
    }
  });

  it('uses unique persistence keys — a collision would silently swallow a beat', () => {
    const keys = Object.values(BEATS).map(b => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('falls back to variant 0 for beats not yet written per-variant', () => {
    const panel = BEATS[BeatId.PROLOGUE].panels[0];
    for (let v = 0; v < STORY_VARIANT_COUNT; v++) {
      expect(monitorLine(panel, v)).toBe(panel.monitor[0]);
    }
  });
});

describe('body diagram', () => {
  it('draws every region the campaign can wake', () => {
    // A region present in the enum but missing from the shape table would
    // silently never appear on the silhouette — its beat would fire and the
    // body would not change, which is exactly the failure a player would
    // notice and no other test would catch.
    expect(BODY_REGION_COUNT).toBe(Object.values(BodyRegion).length);
  });

  it('reports progress against the full region count', () => {
    expect(bodyProgressLabel(new Set())).toBe(`0 / ${BODY_REGION_COUNT} AWAKE`);
    expect(bodyProgressLabel(new Set([BodyRegion.EYES, BodyRegion.TORSO])))
      .toBe(`2 / ${BODY_REGION_COUNT} AWAKE`);
  });

  it('has a region-unlock beat for every region except the two Fork branches', () => {
    // Every region must be reachable, or it is dead content. The Fork's two
    // regions are the deliberate exception: only one wakes per playthrough
    // (body_awakening.md §4a), and beatAfterLevel resolves which.
    const woken = new Set(
      Object.values(BEATS).filter(b => b.region).map(b => b.region as BodyRegion),
    );
    for (const region of Object.values(BodyRegion)) {
      expect(woken.has(region), `${region} has no beat that wakes it`).toBe(true);
    }
  });
});

describe('NarrativeSystem', () => {
  it('drains a beat event into pendingBeats and destroys the entity', async () => {
    const world = await loadLevel(createWorld(), 'level_01');
    const eid = addEntity(world);
    addComponent(world, NarrativeBeatEvent, eid);
    NarrativeBeatEvent.beatId[eid] = BeatId.REGION_FINGERS;

    NarrativeSystem(world, GameState);

    expect(GameState.pendingBeats).toEqual([BeatId.REGION_FINGERS]);
    // Event entities must never survive their tick, or the beat replays forever.
    expect(narrativeBeatQuery(world).length).toBe(0);
  });
});

describe('level completion', () => {
  it('queues the scheduled beat when a level is actually completed', async () => {
    // level_01 is the tutorial: both wisps walk (0,2) → (0,-2) in a straight
    // line, no matrix work needed — the cheapest real completion in the
    // campaign, and its 8 AP covers exactly these 4+4 steps.
    const world = await loadLevel(createWorld(), 'level_01');
    GameState.pendingBeats = [];

    for (const wisp of ['avatar_p1', 'avatar_p2']) {
      for (let i = 0; i < 4; i++) {
        GameState.pendingInputs.push(move(wisp, 0, -1));
        tick(world);
      }
    }

    expect(GameState.phase).toBe('LEVEL_COMPLETE');
    expect(GameState.pendingBeats).toEqual([beatAfterLevel('level_01')]);
  });
});
