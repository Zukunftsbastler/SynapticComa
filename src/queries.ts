// All bitECS defineQuery calls are centralized here.
// Never call defineQuery inside a system function — queries must be created once
// at module load time and reused every tick for performance.
import { defineQuery } from 'bitecs';
import {
  Position, Renderable, Dimension,
  Avatar, Movable, Pushable,
  MatrixNode, Conduit,
  Collectible, Hazard, Lethal,
  Health, Resistances,
  Threshold, Static, PhaseBarrier,
  Exit,
  BoardFlipEvent, LevelCompleteEvent, AvatarDestroyedEvent, P1ExitedEvent,
  APPool,
} from '@/components';

export const renderableQuery    = defineQuery([Position, Renderable, Dimension]);
export const avatarQuery        = defineQuery([Avatar, Position, Dimension]);
export const matrixNodeQuery    = defineQuery([MatrixNode]);
export const conduitQuery       = defineQuery([Conduit, MatrixNode]);
export const movableAvatarQuery = defineQuery([Avatar, Position, Movable]);
export const collectibleQuery   = defineQuery([Collectible, Position, Dimension]);
export const hazardQuery        = defineQuery([Hazard, Position, Dimension]);
export const thresholdQuery     = defineQuery([Threshold, Position]);
export const staticQuery        = defineQuery([Static, Position]);
export const exitQuery          = defineQuery([Exit, Position]);
export const apPoolQuery        = defineQuery([APPool]);

export const pushableQuery       = defineQuery([Pushable, Position]);
export const lethalQuery         = defineQuery([Lethal, Position]);
export const healthQuery         = defineQuery([Health]);
export const phaseBarrierQuery   = defineQuery([PhaseBarrier, Position]);

// Event entity queries — used by LevelTransitionSystem to consume and destroy events.
export const boardFlipQuery         = defineQuery([BoardFlipEvent]);
export const levelCompleteQuery     = defineQuery([LevelCompleteEvent]);
export const avatarDestroyedQuery   = defineQuery([AvatarDestroyedEvent]);
export const p1ExitedQuery          = defineQuery([P1ExitedEvent]);
