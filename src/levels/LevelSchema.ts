// TypeScript types for the level JSON schema.
// All level JSON files must conform to the LevelDef interface.

export type EntityType =
  | 'avatar' | 'exit' | 'threshold' | 'hazard'
  | 'phase_barrier' | 'collectible' | 'wall';

export interface AvatarDef {
  type: 'avatar';
  id: string;
  playerId: 0 | 1;
  q: number; r: number; z: number;
}

export interface ExitDef {
  type: 'exit';
  id: string;
  playerId: 0 | 1;
  q: number; r: number; z: number;
  /** P2's exit starts locked (Static) until P1ExitedEvent fires. */
  initiallyLocked?: boolean;
}

export interface ThresholdDef {
  type: 'threshold';
  id: string;
  q: number; r: number; z: number;
}

export interface HazardDef {
  type: 'hazard';
  id: string;
  /** HazardType enum value: 0=CHASM, 1=LOCKED_RED, 2=LOCKED_BLUE, 3=FIRE, 4=LASER */
  hazardType: number;
  q: number; r: number; z: number;
}

export interface PhaseBarrierDef {
  type: 'phase_barrier';
  id: string;
  q: number; r: number; z: number;
}

export interface CollectibleDef {
  type: 'collectible';
  id: string;
  /** ConduitShape enum value: 0=STRAIGHT, 1=CURVED, 2=T_JUNCTION, 3=CROSS, 4=SPLITTER */
  shape: number;
  rotation: number;
  q: number; r: number; z: number;
}

export interface WallDef {
  type: 'wall';
  id: string;
  q: number; r: number; z: number;
}

export type EntityDef =
  | AvatarDef | ExitDef | ThresholdDef | HazardDef
  | PhaseBarrierDef | CollectibleDef | WallDef;

export interface MatrixNodeDef {
  id: string;
  column: 1 | 3 | 5;
  row: number;
  /** AbilityType enum value (0 = NONE for source nodes) */
  abilityType: number;
}

export interface MatrixConduitDef {
  id: string;
  column: 2 | 4;
  row: number;
  shape: number;
  rotation: number;
}

export interface InventoryConduitDef {
  entityId: string;
  shape: number;
  rotation: number;
}

export interface ScrapPlateDef {
  shape: number;
  rotation: number;
}

export interface LevelDef {
  id: string;
  name: string;
  thresholdEnabled: boolean;
  initialInventory: {
    player0: InventoryConduitDef[];
    player1: InventoryConduitDef[];
  };
  scrapPool: ScrapPlateDef[];
  entities: EntityDef[];
  /** Matrix: source nodes (col1) created automatically by loader; specify col3/5 nodes + conduits. */
  matrix: {
    nodes: MatrixNodeDef[];
    conduits: MatrixConduitDef[];
  };
}
