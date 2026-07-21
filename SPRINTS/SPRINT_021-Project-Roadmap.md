# SPRINT 021: Project-Wide Roadmap

**Status:** ✅ Completed 2026-07-21
**Trigger:** Till: "Erstelle nun eine Roadmap sinnvoller nächster Schritte." Concept-only, same class of deliverable as SPRINT_019 — no code changed.

---

## What Was Delivered

**[docs/roadmap.md](../docs/roadmap.md)** — a project-wide view synthesizing every open thread accumulated across SPRINTS/001–020 and a fresh source-level sweep (not just re-reading docs) for anything not yet flagged:

- **§0, a new finding:** naming the recurring pattern behind three prior audit findings (Resonance, Threshold, and now a fourth and fifth) — a system fully specified in `docs/` with zero corresponding code. Newly confirmed by directly checking the source: the tutorial system (`tutorial_design.md`'s 5-file "Monitor" architecture — only 2 files exist; the scripted Level-1 guided intro was never built) and narrative panel delivery (`decisions_needed.md` D13 decided which levels get panels; no `CutsceneMod`/panel system exists at all, `public/cutscenes/` is empty). The Generator (`generative_levels.md §3`) is a fifth instance, already known but reframed here as part of the same pattern.
- **§1, foundational gaps confirmed by direct check:** zero automated tests anywhere in the project (`find . -iname "*.test.ts"` — no hits, no test-runner dependency in `package.json`); Guest-side networking remains unverified since SPRINT_016; zero real art assets beyond `.gitkeep` placeholders.
- **§2–3:** consolidated the standing team-decision backlog (D14, slack-band drift, difficulty-weight review, the Resonance/Threshold "deferred-not-decided" state) and the small no-decision-needed cleanup items, all with sprint provenance.
- **§4:** re-ranks `mechanic_roadmap.md`'s remaining eight mechanic proposals using real information from actually having built two of them (Focus Vault: solver-invisible, cheap; Impulse Blocks: needed a genuine solver extension, expensive) — sorts the remaining eight into "likely cheap" (Static Field, Echo Tiles, Short Circuit) vs. "genuinely need solver work" (Bruised Fragments, Pulse Gates, Synaptic Fatigue, Scar Tissue, Convergence Nodes), a distinction the original SPRINT_019 proposal couldn't make yet.
- **§5–6:** the larger structural initiatives (real Tutorial system or formal descope, the Threshold arc, narrative delivery, the Generator) and a closing five-item priority punch-list mixing urgency and effort.

## Scope Discipline

Planning document only, per precedent (SPRINT_019). No code, level, or existing-doc content changed — only `README.md`'s docs index gained one link.

## Open / Next

Whatever the team picks from §6 next; this document itself should get revisited once a few of its items land, the same way `mechanic_roadmap.md`'s Part 1 audit needed a follow-up after SPRINT_020's changes.
