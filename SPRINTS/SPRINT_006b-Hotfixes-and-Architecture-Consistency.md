🎯 Sprint Goal
Address critical bugs in the matrix manipulation logic, synchronize the network protocol for inventory management, and resolve UI event memory leaks discovered after the implementation of Sprint 6.

📋 Task Breakdown
Task 1: Fix Matrix Column-Shift Logic

File: src/systems/MatrixInsertSystem.ts
Description: The current insertion logic ejects the wrong conduit when a column is not fully populated. It incorrectly assumes array bounds (colEntities.length - 1 or 0) correspond to the bottom/top matrix edges.
Action Items:

[ ] Refactor the ejection logic to evaluate the actual MatrixNode.row coordinate rather than the array index.

[ ] Ensure that only a conduit explicitly pushed out of the matrix bounds (e.g., row === MATRIX_ROWS - 1 when inserting from top) is sent to the Scrap Pool.

Task 2: Synchronize Scrap Pool Network Protocol

Files: src/systems/ScrapPoolSystem.ts, src/network/messages.ts
Description: The host generates full inventory data upon drawing a tile, but the guest only receives the drawnShape. The guest is subsequently unable to insert the tile because the InsertConduitMessage requires a sourceEntityId. Additionally, Date.now() is non-deterministic for ECS entity generation.
Action Items:

[ ] Update InventoryUpdateMessage in messages.ts to include entityId: string and rotation: number.

[ ] Replace Date.now() in entity generation with a deterministic ID counter tied to the game state (e.g., scrap_drawn_${GameState.outSeq}).

[ ] Ensure the guest properly registers the incoming entityId and rotation into their local inventory state.

Task 3: Resolve UI Event Memory Leak

File: src/ui/MatrixUI.ts
Description: Global window event listeners are bound in the constructor without a cleanup mechanism. When a level is reloaded and the ECS world/UI is rebuilt, these listeners compound, causing duplicate action dispatches.
Action Items:

[ ] Implement a destroy() or cleanup() method in the MatrixUI class.

[ ] Store event handler references securely so they can be removed via window.removeEventListener() during cleanup.

[ ] Hook the cleanup method into the level-transition or teardown lifecycle.

Task 4: Refactor Matrix Rotation Message Payload

Files: src/systems/MatrixRotateSystem.ts, src/network/messages.ts, src/ui/MatrixUI.ts
Description: The rotation system currently extracts matrix coordinates by performing a regex match on a stringified entityId ("matrix_col{C}_row{R}"). This bypasses the EntityRegistry and is fragile.
Action Items:

[ ] Redefine RotateConduitMessage to accept explicit column and row properties instead of an entityId string.

[ ] Update MatrixUI.ts to dispatch the message using the specific grid coordinates.

[ ] Update MatrixRotateSystem.ts to locate the target entity via grid coordinates instead of regex parsing.

Task 5: Add Inventory Validation to Pre-Rotation

File: src/ui/MatrixUI.ts
Description: Players can press "R" to rotate a drawn conduit before insertion (0 AP cost). Currently, there is no validation check to ensure the player actually holds a tile, which can lead to unexpected UI states.
Action Items:

[ ] Add a validation guard in the "R" keydown event handler.

[ ] Verify that InventoryState.players[localPlayerId].length > 0 before attempting to rotate the active inventory item.

✅ Acceptance Criteria
[ ] Inserting a tile into an empty or partially empty column correctly shifts existing tiles without falsely ejecting the bottom-most tile.

[ ] Guest players can successfully draw from the Scrap Pool and insert the drawn tile into the matrix without missing ID errors.

[ ] Reloading a level multiple times does not result in duplicate API calls or AP deductions when clicking the UI.

[ ] Conduit rotation uses strictly typed row/column coordinates over the network.

[ ] Pressing the rotate key with an empty inventory safely does nothing.