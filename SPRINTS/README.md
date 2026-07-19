# Sprint Log

**Convention:** Every completed sprint gets a document here, written at completion time, recording three things: **which decisions were made**, **why** (the reasoning and the alternatives set aside), and **what was actually implemented** (including what was deliberately deferred and what remains open for whom). The sprint documents — together with `docs/` — are the project's institutional memory: a new contributor (or AI assistant) should be able to reconstruct the project's current state and its reasoning from this directory alone.

| Sprint | Date | Summary |
|---|---|---|
| [001 — Update Implementation Plan](SPRINT_001-Update-implementation-plan.md) | pre-2026-04 | Host-Authority network pattern, AP singleton, event entities, tween separation |
| [002 — Cleanup Patch](SPRINT_002-Cleanup-Patch.md) | pre-2026-04 | Purged teleportation & Baba-Is-You rule parsing; network schema expansion |
| [003 — AP System Refactor](SPRINT_003-AP-System-Refactor.md) | 2026-04 → 2026-07-18 | Docs migrated to persistent AP pool + Shared Unlock + Dead End (curated from Andreas's six PRs; completed in SPRINT_004 session) |
| [004 — Design Integration](SPRINT_004-Design-Integration.md) | 2026-07-18 | D1–D13 resolved; Andreas's ordered base pairing → Neuro-Resonance; generative levels + solver spec; The Monitor tutorial spec; repo flattened; README de-duplicated |
| [005 — Code Refactor: Persistent AP](SPRINT_005-Code-Refactor-Persistent-AP.md) | 2026-07-18 | Round system removed from code; APUnlockSystem, Dead-End detection, level schema migration (all 15 levels) |
| [006 — Campaign Flow & Guest Sync](SPRINT_006-Campaign-Flow-and-Guest-Sync.md) | 2026-07-18 | Playable campaign (lobby → levels → win/fail/dead-end flows); GuestSyncSystem closes the host→guest gap; viewPlayerId local mode |
| [006b — Hotfixes & Architecture Consistency](SPRINT_006b-Hotfixes-and-Architecture-Consistency.md) | pre-2026-07 | Matrix column-shift fix, scrap protocol sync, UI listener leak, rotate-by-coordinates |
| [007 — Level Solver & Validation](SPRINT_007-Level-Solver-and-Validation.md) | 2026-07-19 | AND/OR solver with adversarial draws; `validate:levels` gate; data-driven AP retuning (unlocks now mandatory mid-campaign); doc/code divergences flagged |
| [008 — Playability Hotfixes](SPRINT_008-Playability-Hotfixes.md) | 2026-07-19 | First-playtest fixes: floor tiles, board edges, entity color code, Monitor status strip, deterministic room codes |
| [009 — Controls & Feedback](SPRINT_009-Controls-and-Feedback.md) | 2026-07-19 | On-board key hints, click-to-move, both boards visible in local mode, provable early Dead-End detection; P2's missing U/O keys |

**Next planned:** The Monitor (concept triggers, highlight framing, scripted "Calibration" intro) · Neuro-Resonance (`Conduit.base`, ResonanceSystem, solver extension) · Generator (Deep Coma endless mode, Daily Synapse).
