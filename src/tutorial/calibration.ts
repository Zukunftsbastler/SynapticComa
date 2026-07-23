// calibration.ts: the Level-1 guided intro (tutorial_design.md §5), "Calibration"
// in Monitor fiction. A pure ordered list of ConceptIds — TutorialDirector
// looks each one up in concepts.ts's registry for its actual title/body/
// focus/blocking definition, so nothing here duplicates that content.
//
// Adapted to level_01.json's REAL layout rather than the doc's original
// script (which assumed a floor Collectible + an empty matrix slot — level 1
// has neither): move once, see the AP pool, learn the Shared Unlock, see the
// pre-routed JUMP node, learn the exit order. INSERT/ROTATE/COLLECT/INVENTORY
// stay purely reactive (as they already are) and fire naturally whenever a
// later level actually hands the player a plate or an empty slot.
import { ConceptId } from './TutorialState';

export const CALIBRATION_SEQUENCE: ConceptId[] = [
  ConceptId.MOVE,
  ConceptId.AP_POOL,
  ConceptId.UNLOCK_NODE,
  ConceptId.JUMP,
  ConceptId.EXIT_SEQUENCE,
];
