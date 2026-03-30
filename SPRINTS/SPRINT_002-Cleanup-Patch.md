# SPRINT 002: Architectural Cleanup & Consistency Patch

This sprint focuses on purging deprecated design artifacts (Teleportation, Baba-Is-You logic) and patching the Host Authority network protocol. 

Apply the following modifications across the `docs/` folder.

## 1. Updates to `docs/architecture.md`

**A. Component List Updates:**
* **Remove:** `TeleporterComponent` entirely.
* **Modify:** `Resistances` should now only be `{ fire: ui8, laser: ui8 }`. (Remove `void` and `phase`).
* **Add:** Insert `Events` into the table to match `implementation_plan.md`:
    * `Events` | *(tags)* | Ephemeral signals: `BoardFlipEvent`, `LevelCompleteEvent`, `AvatarDestroyedEvent`, `P1ExitedEvent`.

**B. System List Updates:**
* **Remove:** `TeleportSystem` and `RuleParsingSystem` from the Game Loop sequence and the System Responsibilities table.

**C. Section 5 Purge:**
* **Remove:** Section 5.2 (Dimensional Teleportation) entirely.
* **Remove:** Section 5.3 (Rule Modification / Baba Is You Style) entirely. The DNA Matrix is the sole method of rule alteration.

## 2. Updates to `docs/digital_implementation.md`

**A. File Structure (`Section 4`):**
* **Remove:** `TeleporterComponent.ts`
* **Remove:** `TeleportSystem.ts` and `RuleParsingSystem.ts`
* **Remove:** `TeleporterFactory.ts`

**B. Claude Code Sprint Guidelines (`Section 6`):**
* **Modify Sprint 7:** Remove references to "Teleport".
* **Modify Sprint 8:** Rename to "Collision System & Threshold System". Remove all references to "Teleport" and "Rule parsing".

## 3. Updates to `docs/implementation_plan.md`

**A. Data Schemas:**
* **Remove:** `TeleporterComponent` from Component Definitions.
* **Modify:** `Resistances` to `{ fire: Types.ui8, laser: Types.ui8 }`.
* **Modify JSON Schema:** Remove `{ "id": "teleporter_a1"...}` from `dimensionA` entities. Remove `"rules": [...]` array entirely from the JSON schema.

**B. Network Message Schema Expansion:**
Expand the `GameMessage` union and define two new Host-to-Guest state updates to fix the Matrix desync:
```typescript
interface MatrixStateUpdateMessage {
  type: 'MATRIX_STATE_UPDATE';
  // Simplified array of the 5x5 grid state
  grid: { shape: number, rotation: number, active: boolean }[][]; 
}

interface InventoryUpdateMessage {
  type: 'INVENTORY_UPDATE';
  playerId: 0 | 1;
  // Tells the client what shape they drew blind from the Scrap Pool
  drawnShape: number; 
}

// Add these to the GameMessage union.
```

**C. Sprint 6: Matrix & Scrap Pool (Host Authority Fix):**
Update MatrixInsertSystem.ts, MatrixRotateSystem.ts, and ScrapPoolSystem.ts.

Logic Rule: These systems must run strictly on the Host (if (state.localPlayerId !== 0) return;).

Guest clients send InsertConduitMessage, RotateConduitMessage, and DrawScrapMessage to the Host.

After mutating the ECS, the Host broadcasts a MATRIX_STATE_UPDATE back to the Guest. For DrawScrapMessage, the Host also sends an INVENTORY_UPDATE.

**D. Sprint 7: Push System AP Clarification:**
Update the PUSH ability logic:

When MovementSystem encounters a Pushable entity and PUSH is active, MovementSystem aborts the avatar's coordinate change, deducts 1 AP, and pushes a PUSH_ATTEMPT data object to an array. PushSystem runs next to execute the entity movement.

**E. Sprint 8: Threshold Synchronization Fix:**
Update ThresholdSystem.ts:

Stepping on the Threshold hex does not instantly flip the board. It enables a "Ready" toggle in the UI.

The system only emits BoardFlipEvent if: Avatar 1 is on hex AND Avatar 2 is on hex AND GameState.thresholdState.p1Ready === true AND p2Ready === true.

**F. Sprint 9: Sequential Exit Visibility:**
Update ExitSystem.ts:

When Player 1 enters the exit, in addition to removing Movable, the system must set Renderable.visible[eid] = 0 so the wisp physically disappears from the board, cementing their transition to a pure spectator.

Level Progression: Update the descriptions for Level 3 and Level 9 to replace "Teleporter" puzzles with "Scrap Pool / Forced Rotation" puzzles.

## 4. Updates to docs/level_design.md
A. Inefficient Routes (Section 3, Step 2):

Remove the reference to routing the "Teleport" ability. Change the example to: "...forcing players to figure out how to route the 'Phase Shift' ability for a shortcut."