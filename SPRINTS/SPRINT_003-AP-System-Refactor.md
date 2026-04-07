# SPRINT 003: AP System Refactor — Persistent Pool & Shared Unlock

## Context

This sprint implements a design shift proposed across six pull requests by a contributor. The change is architectural: the round-based AP system is replaced with a persistent AP pool that only grows through cooperative "Shared Unlock" events.

**What changes:** The concept of a "round" is removed entirely. AP no longer resets on a timer or a Pass action. The only way to gain AP is to trigger a Shared Unlock — a specific node that requires both players to reach it simultaneously. Dead ends are a formal system state, not a design accident.

**What does NOT change:** The existing detailed content in `implementation_plan.md` (all sprint code, schemas, acceptance criteria) and `art_and_ui.md` (the Medical Macabre Diorama visual identity) must be preserved. Only the design-intent sections of each file are updated. Do not delete, rewrite, or replace any section that contains TypeScript code snippets, JSON schemas, or sprint-level acceptance criteria.

**Dependency:** After this sprint, `open_questions.md` Q1 must be updated to reflect the new decision. That update is included in Task 6 below.

---

## Task 1 — `docs/mechanics.md` 
* [x] Don


**Section 1 (Core Gameplay Loop) — update the Turn Structure paragraph:**

Remove this paragraph:
> "Turn Structure: Real-Time Shared Pool with Lockout. Players share a single AP pool each round. Both players may spend from it simultaneously, in any order, via verbal coordination ("I'm taking 2 AP to grab that conduit, okay?"). The round ends automatically when the pool is empty or when a player passes (see AP table). The system enforces a global lockout: if the pool reaches 0, no further actions can be queued until the next round begins and AP resets."

Replace with:
> "Turn Structure: Persistent Shared Pool with Cooperative Unlock. Players share a single AP pool with no round structure and no automatic reset. Both players may spend from it simultaneously, in any order, via verbal coordination ("I'm taking 2 AP to grab that conduit, okay?"). AP is only gained by triggering a Shared Unlock node — a special location that requires both players to be present simultaneously. The game has no Pass action and no round end. When AP reaches 0 and no Shared Unlock remains available, the system enters a Dead End state."

**Section 2 (Complete AP Cost Table) — apply the following changes:**

Remove this row entirely:
| Pass (declare round end) | Either | 0 | `RoundSystem` |

Change the `Insert Conduit` row System column from `MatrixInsertSystem` to `MatrixInsertSystem` (no change).

Add a new row at the bottom of the table:
| Trigger Shared Unlock (both players on node) | Either | +AP gained | `APUnlockSystem` |

Add this paragraph after the table:
> **Key rule:** AP is a finite resource that shrinks with use and only grows through cooperation. Shared Unlock nodes are the sole mechanism for gaining AP. When AP reaches 0, the game does not reset — it pauses in a Dead End state and allows a manual restart. There is no round, no turn, and no Pass action.

**Section 4 (The DNA Matrix) — update the ActionManager singleton description in architecture.md cross-reference note only. No change to Section 4 body text.**

**Section 7 (Failure Condition) — append a new paragraph after the existing soft-lock prevention paragraph:**

> **Dead End State:** A Dead End is triggered when `APPool.current === 0`, no Shared Unlock nodes remain untriggered, and neither avatar can reach their exit. This is distinct from soft-lock. In a soft-lock, a solution exists but is unreachable. In a Dead End, no solution is reachable with current resources. The system detects this automatically and displays a "Dead End" indicator, allowing players to manually restart without consuming their single retry.

---

## Task 2 — `docs/architecture.md`
* [x] don

**Section 2 (Entities) — no changes.**

**Section 3 (Components) — ActionManager singleton block:**

Replace the ActionManager paragraph:
> "**ActionManager (Singleton Entity):** A single entity holding the global AP state is created on level load and destroyed on level end. Its components are: `APPool { current: ui8, max: ui8 }` and `RoundState { phase: ui8 }` (0=Active, 1=RoundOver)."

With:
> "**ActionManager (Singleton Entity):** A single entity holding the global AP state is created on level load and destroyed on level end. Its components are: `APPool { current: ui8, max: ui8 }`. There is no `RoundState` component — the pool is persistent and has no round lifecycle. This entity is not rendered; it is queried by `APSystem` and `APUnlockSystem` each tick."

Add a new row to the Component List table after the `Threshold` row:

| `APUnlock` | `id: ui8, value: ui8, triggered: ui8` | Marks a Shared Unlock node; grants AP to both players when triggered; one-time activation |

**Section 4 (Systems) — update the system pipeline:**

Replace:
```
InputSystem → APSystem → RoundSystem → MovementSystem → CollectionSystem →
PushSystem → ThresholdSystem → MatrixInsertSystem →
MatrixRotateSystem → ScrapPoolSystem → MatrixRoutingSystem → AbilitySystem →
CollisionSystem → ExitSystem → LevelTransitionSystem → RenderSystem → NetworkSystem
```

With:
```
InputSystem → APSystem → MovementSystem → CollectionSystem →
PushSystem → ThresholdSystem → APUnlockSystem → MatrixInsertSystem →
MatrixRotateSystem → ScrapPoolSystem → MatrixRoutingSystem → AbilitySystem →
CollisionSystem → ExitSystem → LevelTransitionSystem → RenderSystem → NetworkSystem
```

In the System Responsibilities table:

Remove this row:
| `RoundSystem` | Detects AP=0 or Pass action; resets AP pool for next round |

Add this row after `ThresholdSystem`:
| `APUnlockSystem` | Detects when both avatars occupy their respective Shared Unlock nodes in the same tick; increments `APPool.current` by `APUnlock.value`; sets `APUnlock.triggered = 1`; creates no event entity — the AP change is the signal |

**Section 5 — no changes.**

---

## Task 3 — `docs/digital_implementation.md`

**Section 3 (Screen Layout) — update the HUD label in both ASCII diagrams:**

Replace `[Round: 3]` with `[AP: ●●●○○]` in both the Player 1 and Player 2 screen layout diagrams. The AP pool counter appears twice (once as the pool itself, once as the removed round counter). The round counter label is simply removed from both layouts, leaving only the AP pool display.

**Section 4 (Project File Structure) — apply the following changes:**

In `/src/components/`, remove:
- `RoundState.ts` (does not exist in the new design)

In `/src/components/`, add after `APPool.ts`:
- `APUnlock.ts           # { id: ui8, value: ui8, triggered: ui8 } — Shared Unlock node data`

In `/src/systems/`, remove:
- `RoundSystem.ts`

In `/src/systems/`, add after `ThresholdSystem.ts`:
- `APUnlockSystem.ts`

**Section 5.1 (Data-Oriented Components) — add after the existing Position example:**

```typescript
// src/components/APUnlock.ts
export const APUnlock = defineComponent({
  id:        Types.ui8, // unique identifier for this unlock node
  value:     Types.ui8, // AP granted when triggered
  triggered: Types.ui8  // 0 = available, 1 = consumed (one-time activation)
});
```

**Section 6 (Sprint Guidelines) — apply the following changes:**

In the canonical sprint sequence, remove step 4's reference to "Pass action":
- Old: "Movement + AP system (real-time shared pool, lockout, Pass action)"
- New: "Movement + AP system (persistent shared pool, no round lifecycle)"

Remove `RoundSystem` from all sprint references where it appears.

In Sprint 7, add `APUnlockSystem` to the file list for that sprint.

**After Section 6, add a new section:**

### Section 7 — Dead End Detection

The game must detect when no forward progress is possible with the current AP pool:

```typescript
// Dead End condition (evaluated after APUnlockSystem each tick):
function isDeadEnd(world: IWorld, state: GameStateData): boolean {
  const apEmpty = APPool.current[state.actionManagerEid] === 0;
  const noUnlocksRemain = apUnlockQuery(world).every(
    eid => APUnlock.triggered[eid] === 1
  );
  const noExitReachable = !canEitherAvatarReachExit(world, state);
  return apEmpty && noUnlocksRemain && noExitReachable;
}
```

When `isDeadEnd()` returns `true`, `LevelTransitionSystem` sets a `DeadEndState` flag. `RenderSystem` responds by dimming the UI and showing the Dead End indicator. This does not consume the retry — it allows a free manual restart.

---

## Task 4 — `docs/implementation_plan.md`

**IMPORTANT: Do not remove any existing content from this file.** The full sprint breakdown, all TypeScript code snippets, all JSON schemas, all acceptance criteria, and all design decisions must remain intact.

Apply only the following targeted additions and replacements:

**In the Foundational Design Decisions section — Decision 3:**

Replace:
> "AP lives in a plain TypeScript singleton `GameState` (`{ apPool: number, apMax: number }`). **Only the Host mutates this pool.** A dedicated `APPool` singleton entity (bitECS components: `APPool { current: ui8, max: ui8 }`) mirrors this state for HUD rendering on both clients."

With:
> "AP lives in a plain TypeScript singleton `GameState` (`{ apPool: number, apMax: number }`). **Only the Host mutates this pool.** A dedicated `APPool` singleton entity (bitECS components: `APPool { current: ui8, max: ui8 }`) mirrors this state for HUD rendering on both clients. There is no `apMax` reset behavior — the pool is persistent and modified only by player spend actions or `APUnlockSystem` grant events. AP gained through Shared Unlocks is the only mechanism for replenishment."

**In the system pipeline (Decision 2 and any other location it appears):**

Remove `RoundSystem` from the pipeline sequence. Replace every instance of:
```
InputSystem → APSystem → RoundSystem → MovementSystem
```
With:
```
InputSystem → APSystem → MovementSystem
```
And insert `APUnlockSystem` after `ThresholdSystem` in every pipeline listing.

**In the Component Definitions block — after `APPool`:**

Add:
```typescript
// src/components/APUnlock.ts
export const APUnlock = defineComponent({
  id:        Types.ui8,
  value:     Types.ui8,
  triggered: Types.ui8
});
```

**In the Network Message Schema — remove `PassMessage`:**

Remove this interface definition entirely:
```typescript
interface PassMessage {
  type: 'PASS';
  playerId: 0 | 1;
}
```

And remove `PassMessage` from the `GameMessage` union type.

**In Sprint 4 (Movement + AP System) — update the goal description only:**

Replace: "real-time shared pool, lockout, Pass action"
With: "persistent shared pool, no round reset, no Pass action"

The rest of Sprint 4 (all key logic, code examples, acceptance criteria) remains unchanged.

**After Sprint 4 — insert a new sprint:**

```markdown
### Sprint 4b — APUnlockSystem & Dead End Detection

**Goal**: Implement the Shared Unlock mechanic. Both avatars must stand on their respective `APUnlock` nodes in the same tick to trigger the unlock. Dead End detection is implemented as a read-only evaluation after each tick.

**Duration**: 1 day | **Depends on**: Sprint 4

**Files to Create**:
- `src/systems/APUnlockSystem.ts`
- `src/components/APUnlock.ts`

**Files to Modify**:
- `src/systems/LevelTransitionSystem.ts` (add dead end detection call)
- `src/ui/HUD.ts` (add dead end indicator)

**Key Logic**:

`APUnlockSystem.ts`:
```typescript
export function APUnlockSystem(world: IWorld, state: GameStateData): void {
  if (state.localPlayerId !== 0) return; // Host only

  const unlockNodes = apUnlockQuery(world); // defineQuery([APUnlock, Position])
  for (let i = 0; i < unlockNodes.length; i++) {
    const eid = unlockNodes[i];
    if (APUnlock.triggered[eid] === 1) continue;

    const q = Position.q[eid];
    const r = Position.r[eid];

    // Both players must be on this node's hex simultaneously
    const p1OnNode = isAvatarAt(world, 0, q, r);
    const p2OnNode = isAvatarAt(world, 1, q, r);

    if (p1OnNode && p2OnNode) {
      APPool.current[state.actionManagerEid] += APUnlock.value[eid];
      APUnlock.triggered[eid] = 1;
      state.outboundMessages.push({ type: 'AP_UNLOCK', unlockId: APUnlock.id[eid], newAP: APPool.current[state.actionManagerEid] });
    }
  }
}
```

**Acceptance Criteria**:
- [ ] Both avatars standing on the same Shared Unlock hex in the same tick increments `APPool.current` by the unlock's value
- [ ] A triggered unlock node cannot be activated again (`triggered === 1` guard)
- [ ] Guest client receives `AP_UNLOCK` message and updates HUD
- [ ] Dead End indicator appears when AP = 0, all unlocks triggered, no exit reachable
- [ ] Dead End allows free manual restart without consuming the retry
```

**In Sprint 8 (Threshold System) — no changes to the sprint content.** The Threshold mechanic is independent of the AP system change.

**Do not remove Sprints 3, 5, 6, 7, 9–13 or their content.**

---

## Task 5 — `docs/communication_rules.md`

**Section 1 — replace the opening paragraph:**

Replace:
> "To ensure genuine cooperation and eliminate the 'Alpha Player' dynamic, the game relies on strict Information Asymmetry."

With:
> "To ensure genuine cooperation and eliminate the 'Alpha Player' dynamic, the game relies on strict Information Asymmetry. The guiding principle is: **Talk about the goal. Stay silent about the method.**"

**Section 3.1 (Allowed Communication) — add two new bullet points:**

After "Players may negotiate the expenditure of the shared Action Point (AP) pool.", add:
- Players may confirm readiness at a Shared Unlock node ("I'm on the node — are you?")
- Players may coordinate AP spending timing ("Hold on, don't spend yet — I need 2 AP for an insert")
- Players may state the current AP level ("We're out of AP")

**Section 3.2 (Forbidden Communication) — no changes.**

**After Section 4, add a new Section 5:**

```markdown
## 5. Shared Unlock Coordination

Shared Unlock nodes are visible to both players in their respective dimensions. The existence and location of an unlock node is public — players may discuss when to trigger it and whether both are in position.

**Allowed:**
- Telling your partner you have reached the Shared Unlock node in your dimension
- Asking whether your partner is ready to trigger the unlock
- Confirming the unlock triggered and how much AP was gained

**Forbidden:**
- Describing how you reached the unlock node (inventory used, path taken)
- Describing what resources or conduits enabled your movement to the node
```

**Section 4 (Matrix Manipulation Integrity) — keep the Scrap Pool ejection silence rule intact.** The paragraph about a player being silenced when they eject an unintended piece is preserved as-is.

---

## Task 6 — `docs/open_questions.md`

**Q1 — replace the decision text only (one line):**

Replace:
> "Decision: Real-time shared pool with global lockout."

With:
> "Decision: Persistent shared pool with cooperative unlock — no round system."

Replace the description:
> "Both players spend from a single AP pool simultaneously, in any order, via verbal coordination. The round ends automatically when AP hits 0, or when a player declares a Pass (0 AP). AP resets at round start."

With:
> "Both players spend from a single AP pool simultaneously, in any order, via verbal coordination. AP does not reset. The only way to gain AP is through a Shared Unlock node (requires both players present simultaneously). When AP reaches 0 and no unlocks remain, the game enters a Dead End state allowing a free manual restart."

**Q2 — update the AP Cost Table:**

Remove the `Pass` row:
| Pass | 0 AP |

Add a new row:
| Trigger Shared Unlock (both players on node) | +AP (varies by node) |

---

## Task 7 — `docs/art_and_ui.md`

**IMPORTANT: Do not remove any of the existing visual identity content.** The Medical Macabre Diorama sections (Sections 1–6), the Dimension A/B descriptions, the Specimen Tray, the diegetic UI elements, and the Threshold animation all remain intact.

Apply only the following targeted additions:

**Section 5 (UI and HUD: Diegetic Integration) — update the AP Pool description:**

After the existing AP Pool description ("the AP pool is represented by a row of thick, glass medical vials"), add:

> **AP State Changes:**
> - *Spending AP:* The fluid drains with a heavy bubbling animation. The drain is proportional to the AP spent.
> - *Gaining AP (Shared Unlock):* The vials do not "refill" — they surge. A strong visual pulse emanates from both players' positions simultaneously, and a glowing connection effect bridges the two dimensions through the DNA Matrix. The AP increase animates as luminous fluid flooding into the vials from below, not from a reset.
> - *Dead End (AP = 0, no unlocks remain):* The entire UI dims slightly. The vials sit empty. A subtle "no progress" indicator appears — a single faint icon, no text. The board does not flash or alarm. The silence communicates the state.
>
> **Anti-patterns (never implement):**
> - ❌ Automatic AP refill on any timer
> - ❌ Periodic regeneration
> - ❌ Any animation suggesting a "round reset" — the vials never violently refill as in a round-based system

**Section 4 (The DNA Matrix) — add a note after the existing routing pipe description:**

> **Shared Unlock Node Visual:** When both players reach their respective Shared Unlock nodes simultaneously, the node glows with a distinct pulse that differs from a standard ability activation — both nodes light in sync, a luminous thread traces between them through the Matrix, and the AP vials respond with the surge animation described above.

---

## Acceptance Criteria (Sprint-Level)

After all tasks are applied:

- [ ] `mechanics.md` contains no reference to "round", "round reset", "Pass action", or "global lockout" except in historical context
- [ ] `mechanics.md` defines Shared Unlock and Dead End state
- [ ] `architecture.md` pipeline contains `APUnlockSystem` and does not contain `RoundSystem`
- [ ] `architecture.md` component table contains `APUnlock`; does not contain `RoundState`
- [ ] `digital_implementation.md` file structure contains `APUnlock.ts` and `APUnlockSystem.ts`; does not contain `RoundSystem.ts`
- [ ] `implementation_plan.md` retains all existing sprint content, code snippets, and acceptance criteria; adds Sprint 4b and `APUnlock` component definition; removes `PassMessage`
- [ ] `communication_rules.md` contains Section 5 (Shared Unlock Coordination); retains Scrap Pool ejection silence rule
- [ ] `open_questions.md` Q1 and Q2 reflect the persistent pool decision
- [ ] `art_and_ui.md` retains all Diorama visual content; adds AP state change spec and Dead End visual behavior; lists anti-patterns

---

## What This Sprint Does NOT Do

- Does not implement any code. This sprint is documentation-only.
- Does not delete the Medical Macabre visual identity from `art_and_ui.md`.
- Does not delete the sprint breakdown, TypeScript schemas, or acceptance criteria from `implementation_plan.md`.
- Does not touch `narrative.md`, `level_design.md` (the level design philosophy is compatible with persistent AP as-is and requires no changes at this stage), or `project_overview.md`.
- Does not close or merge the original pull requests — that is a manual step once the doc updates are verified.
