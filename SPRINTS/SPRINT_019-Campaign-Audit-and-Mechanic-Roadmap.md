# SPRINT 019: Campaign Audit & Mechanic Roadmap (Concept Only)

**Status:** ✅ Completed 2026-07-21
**Trigger:** Till's request: audit all 20 levels for difficulty progression and sensibility of mechanic introduction, then produce a concept — markdown only, not implemented — for ten new, maximally different, narratively-grounded, architecturally-compatible mechanics.

---

## 1. What Was Delivered

**[docs/mechanic_roadmap.md](../docs/mechanic_roadmap.md)** — the full deliverable. Two parts:

- **Part 1, the audit:** every level JSON (1–20) read against the solver's proof output (`levelMeta.json`) and the design docs. Nine findings (F1–F9), the two most consequential being genuinely new discoveries, not level-design opinions:
  - **F1:** Neuro-Resonance — claimed as "introduced" at level 6 in `level_design.md`'s own campaign table and fully specified in `mechanics.md §4.5` — does not exist in code at all. No `Conduit.base` field, no way to set one in level JSON, no `ResonanceSystem`. Verified directly against source, not just docs.
  - **F2:** the campaign table still described levels 11–14 as Threshold levels, two days after SPRINT_013 deliberately stripped Threshold from every level in the campaign. This audit corrects `level_design.md`'s table in place (a documentation-accuracy fix following an already-made decision, not a new design call — see §2 below on scope).
  - F3–F9 (dormant PUSH ability across all 20 levels, level 11's broken Fire-Immunity lesson silently starving both FIRE_IMMUNITY and PHASE_SHIFT of any working teaching moment before level 17/18, tutorial-popup coverage at 5 of 14 specified concepts, the difficulty envelope peaking at L15 and never being re-crossed by L16–20, low interaction depth through most of L1–12, and a few harmless duplicate-entity content bugs) — full detail in the doc.
- **Part 2, the roadmap:** ten new mechanic proposals (Synaptic Fatigue, Impulse Blocks, Echo Tiles, Pulse Gates, Scar Tissue, Bruised Fragments, Short Circuit, Focus Vault, Static Field, Convergence Nodes), each with a mechanical description, an explicit compatibility statement (what it combos with in the existing system), a narrative grounding in `narrative.md`, and a suggested campaign entry point. Deliberately spread across ten different axes of the system (economy, physical space, information, timing, persistence, risk, matrix topology, cooperative reward, communication itself, ability combinatorics) rather than ten variations on one idea, per the user's explicit "möglichst unterschiedliche" requirement.

## 2. Scope Discipline

Per Till's explicit instruction ("zunächst lediglich ein Konzept... nichts implementiert"), **no game code or level content changed.** The only edits outside the new doc:
- `level_design.md`'s campaign table rows 11–14 and the "Levels 11–15" MVP-scope paragraph, corrected to describe what those levels actually contain post-SPRINT_013 (F2). This is a factual correction of stale documentation following a decision the team already made (removing Threshold) — not a new design decision, so it did not trigger the `decisions_needed.md` consensus question raised in SPRINT_018.
- `README.md`'s docs table, linking the new file.

## 3. Verification

Documentation-only sprint — no build or solver re-run required (no level JSON, schema, or system file touched). `mechanic_roadmap.md`'s claims about missing code (F1, F3, absent tutorial popups) were verified directly against source (`grep` for `ResonanceSystem`/`Conduit.base`/`Pushable` entity types; read of `TutorialPopups.ts`'s concept list against `tutorial_design.md §2`'s registry), not inferred from docs alone.

## 4. Open / Next

- Part 1 recommends resolving F1 (Resonance) and F3 (Push) — build or formally descope — before picking from Part 2, since two of the ten proposals (Impulse Blocks, and indirectly Convergence Nodes) assume Push exists, and Synaptic Fatigue's strongest combo depends on Resonance.
- Part 1 recommends a level 11 redesign and a Phase-Shift teaching level as the most urgent fixes to the *existing* campaign (both are the kind of "UI/design blocks a real lesson" problem the last several sprints have been hunting).
- Part 2's mechanic selection is explicitly left as a team-taste call for Till, Andreas, and Chris together — not ranked beyond noting #2 (Impulse Blocks) and #8 (Focus Vault) as the cheapest, lowest-risk first picks.
