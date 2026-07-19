# SPRINT 015: The Unplayable Proof — Scrap-Draw UI & the Action-Reachability Gate

**Status:** ✅ Completed 2026-07-19
**Trigger:** Till's playtest report — Level 3: "keiner der Spieler verfügt über Plates, ich sehe keinen Weg, in der Matrix etwas zu aktivieren." Suspicion: a systematic problem, not a level bug.

---

## 1. Diagnosis: "Rules-Solvable" Is Not "Playable"

Till was right, twice over.

**The concrete bug:** the Scrap-Pool draw existed in every layer *except the one players touch*. `mechanics.md §4.2` specifies it, `DrawScrapMessage` is defined, `ScrapPoolSystem` consumes it, the solver models it — but **no module in `src/input` or `src/ui` ever produced a `DRAW_SCRAP` message**, and the scrap pile was not even rendered. The action was mechanically real and humanly impossible.

**The systematic problem:** the SPRINT_007 solver proves solvability over the *rule set*, not over the *action set the UI can deliver*. Any future mechanic that gets rules + system + solver support but no input path would repeat this failure silently — and the proofer would keep certifying unplayable levels. With the long-term goal of generated levels stacking many mechanics and arbitrarily many player switches, the proof must be anchored to what players can actually do.

**Impact scan** (all 15 levels re-solved with DRAW disabled = the pre-fix reality):

- **level_03 "Scrap Pool": UNPLAYABLE** — empty inventories, no collectibles, matrix required, all 5 plates in the pool. Exactly Till's experience.
- **level_15 "Master Set Teaser": UNPLAYABLE** — its solution needs 3 blind draws.
- The other 13 levels were unaffected (draw-free solutions exist within budget).

## 2. Fix A — The Game: Scrap Pool Becomes Visible and Clickable

- **[MatrixRenderer](../src/rendering/MatrixRenderer.ts):** face-down pile below the Specimen Tray — stacked Bakelite plates, `?` face, public `×count` (count is public knowledge, contents never shown, `mechanics.md §4.3`), gold `⤒` affordance in the same visual language as the insert arrows. Pulses when the viewing player holds no plates and the pool could supply one — the Level-3 opening position.
- **[MatrixUI](../src/ui/MatrixUI.ts):** click on the pile → `DrawScrapMessage` (1 AP), Host-Authority dispatch identical to insert/rotate (Guest path verified: `NetworkSystem` routes all incoming messages into `pendingInputs`). Geometry comes from the exported `scrapPileRect()` — renderer and hit zone share one source of truth, so they cannot drift apart.
- **First-encounter teaching** (`tutorial_design.md` rule: every new mechanic must be explained): new `SCRAP_DRAW` Monitor popup, triggered by pool > 0 ∧ own inventory empty. Explains the blind draw and re-states the communication rule (you may say *that* you drew, never *what*).
- README controls table updated.

## 3. Fix B — The Proofer: Action-Reachability Gate

`validate:levels` now anchors every proof to the UI:

1. **Static producer scan:** all of `src/input` + `src/ui` are scanned for the message-type discriminants (`MOVE_AVATAR`, `INSERT_CONDUIT`, `ROTATE_CONDUIT`, `DRAW_SCRAP`). Systems only *consume* messages, so only these two directories count as producers.
2. **Restricted proof:** every solver call (main proof, matrix-required, ability-required) runs with `disabledKinds` = all solver actions lacking a producer (new `SolveOptions.disabledKinds` in [LevelSolver](../src/generation/LevelSolver.ts)). *Solvable* now means *solvable by things players can click or press*.
3. **Distinct failure class:** a level failing only under the restriction re-solves under full rules and is reported as `UI-REACHABILITY (needs: …)` — a **code** bug, not a level bug. No producer for `MOVE_AVATAR` aborts outright.

Had this gate existed, SPRINT_007's very first validation run would have failed L3 and L15 with `UI-REACHABILITY (needs: DRAW)`.

## 4. Verification

- Impact scan pre-fix (solver, `disabledKinds:['DRAW']`): L3 + L15 unsolvable, 13 others fine — reproduces Till's report exactly.
- Post-fix `validate:levels`: producer scan finds all four kinds; **15/15 proven under UI-reachable actions**; numbers unchanged from SPRINT_014 (L3: optimal 9, slack 6, draws=1; L15: optimal 15, slack 1, draws=3). `levelMeta.json` regenerated.
- `npm run build` (tsc strict + Vite): clean.

## 5. Why This Matters for the Generator (Till's stated goal)

The end state is a generator producing extremely hard levels that stack many mechanics with arbitrarily many player switches. That is only safe if the proof pipeline is *closed over playability*: every action class the solver may use must be certified producible by the input layer, automatically, on every run. The reachability gate is that closure for today's four action kinds. **Standing rule going forward: a new mechanic enters the solver only together with (a) its entry in the `KIND_TO_MESSAGE` capability map and (b) its UI producer — the gate then enforces the pairing forever.** Push and Threshold, currently absent from the solver, must follow exactly this route when their sprints land.

## 6. Open / Next

- **Solver–game closure has a second half:** the gate proves the solver uses only producible actions; it does not prove the *game* implements every action the solver assumes *with identical semantics* (e.g. the SPRINT_007 doc/code divergences). A replay harness — feeding solver witnesses through the real systems headlessly — would close that direction too. Worth a sprint when the generator work starts.
- Scrap-pile placement overlap check on small window sizes (pile sits below the bottom insert arrows) — visual QA pass alongside the next playtest.
- Unchanged from SPRINT_014: sync upper bounds on L7/14/15, slack-band drift for team review (🔢 Chris).
