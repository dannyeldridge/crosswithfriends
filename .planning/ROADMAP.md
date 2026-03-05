# Roadmap: Firebase Audit -- Cross With Friends

## Overview

This roadmap drives a comprehensive audit of Firebase usage in the Cross With Friends codebase. The project is analysis-only: no code is changed, no migrations are performed. Each phase produces a documented deliverable that contributes to the final remove-vs-upgrade decision brief. Phases run in dependency order -- the code inventory and path census must come first because every downstream phase (data flow tracing, feature mapping, migration assessment) depends on that enumerated inventory being complete and accurate.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Code Inventory** - Enumerate every Firebase reference in the codebase: imports, call sites, dead code, and SDK bundle cost
- [x] **Phase 2: Firebase Path Census** - Map every RTDB path to the product features that read or write it, establishing the Firebase x feature matrix
- [x] **Phase 3: Data Overlap Analysis** - Identify what exists in both Firebase and PostgreSQL, surface user-facing risk if Firebase is removed
- [x] **Phase 4: Read Path Tracing** - Trace every Firebase read end-to-end from trigger to UI rendering
- [x] **Phase 5: Write Path Tracing** - Trace every Firebase write end-to-end and identify all dual-write locations
- [x] **Phase 6: Data Integrity Analysis** - Analyze SERVER_TIME/getTime usage and inventory data that exists only in Firebase with no PostgreSQL equivalent
- [x] **Phase 7: Removal Path Assessment** - Produce the full Firebase removal analysis with effort estimates, risk ratings, and prerequisite work
- [x] **Phase 8: Upgrade Path Assessment** - Produce the Firebase SDK v7-to-v10 upgrade analysis including compat layer option and breaking changes
- [x] **Phase 9: PostgreSQL Schema Analysis** - Define the PG schema changes needed to replace Firebase-owned data responsibilities

## Phase Details

### Phase 1: Code Inventory
**Goal**: A complete, verifiable census of every Firebase touchpoint in the codebase -- every import, every method call, every config reference, every dead code path -- plus the SDK's measured cost to the production bundle
**Depends on**: Nothing (first phase)
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04
**Success Criteria** (what must be TRUE):
  1. A documented list of every file that imports from Firebase, with the specific symbols imported from each file
  2. Dead Firebase code (Auth flow, archivedEvents listener, unused RTDB paths) is identified and labeled with "dead" or "active" at the call-site level
  3. Call chains from at least three representative UI actions (e.g., joining a game, opening Play page, loading Clock) are traced through the store layer to their Firebase operations
  4. The Firebase SDK's contribution to the production bundle (bytes, percentage of total) is measured and documented
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- File inventory and dead/dormant/active classification (CODE-01, CODE-02)
- [x] 01-02-PLAN.md -- Call-chain traces and bundle size measurement (CODE-03, CODE-04)

### Phase 2: Firebase Path Census
**Goal**: A complete matrix showing which RTDB paths (`battle/`, `game/`, `puzzle/`, `puzzlelist/`, `stats/`, `counters/`, `user/`, `cursors/`, `history/`) are actively used, by which product features, and whether each path has a PostgreSQL equivalent
**Depends on**: Phase 1
**Requirements**: FEAT-01
**Success Criteria** (what must be TRUE):
  1. Every RTDB path documented in `database.rules.json` is accounted for -- active, unused, or unknown-without-live-data-query
  2. For each active path, the product feature(s) that depend on it are named (e.g., "Play page user history list", "Replays page GID enumeration")
  3. For each active path, whether a PostgreSQL equivalent already exists is documented with the specific PG table/column if applicable
  4. The matrix explicitly flags the three decision-gate unknowns: battle mode production status, `archivedEvents` presence in production, and GID counter alignment
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Build the RTDB path census document with path matrix, feature rollup, PG gap analysis, and decision-gate unknowns (FEAT-01)
- [x] 02-02-PLAN.md -- Cross-validate census completeness and consistency, then human review (FEAT-01)

### Phase 3: Data Overlap Analysis
**Goal**: A clear picture of which product features are Firebase-dependent, what data exists in both systems vs. only in Firebase, and what users would lose or see break if Firebase were removed today
**Depends on**: Phase 2
**Requirements**: FEAT-02, FEAT-03
**Success Criteria** (what must be TRUE):
  1. Every Firebase-dependent feature has a documented "what breaks for users" description if Firebase is removed without migration
  2. The `PuzzleList` dual-status merge (Firebase + PG statuses) is documented with a concrete example of which system wins in each case
  3. Data that exists only in Firebase with no PG equivalent is listed with an estimated loss impact (e.g., "user history for games played before PG migration: medium-high impact")
  4. Guest user (unauthenticated `localId`) reliance on Firebase for history is documented with the specific code paths involved
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md -- Build the data overlap analysis document with risk matrix, field-level diffs, guest vs authenticated impact, and validation (FEAT-02, FEAT-03)

### Phase 4: Read Path Tracing
**Goal**: Every Firebase read operation traced end-to-end -- what data is requested, what user action triggers it, how the data travels through the store, and where it surfaces in the UI
**Depends on**: Phase 1
**Requirements**: DATA-01
**Success Criteria** (what must be TRUE):
  1. Every `db.ref(...).on(...)` and `db.ref(...).once(...)` call is documented with: the RTDB path, the trigger condition, the store function that owns it, and the UI component(s) that consume the result
  2. The `GameModel.checkArchive()` read is traced with a clear note about its unconditional-on-every-game-load behavior and the production risk if `archivedEvents` data exists
  3. The `Replays.js` `counters/gid` enumeration read sequence is documented showing the waterfall of sequential Firebase reads it creates
  4. Real-time subscriptions (`.on()`) are distinguished from one-time reads (`.once()`) in the documentation
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md -- Trace all 21 Firebase read call sites end-to-end with cross-reference table, checkArchive deep-dive, Replays waterfall deep-dive, subscription lifecycle summary (DATA-01)

### Phase 5: Write Path Tracing
**Goal**: Every Firebase write operation traced end-to-end and all dual-write locations (where both Firebase and PostgreSQL receive the same data) explicitly identified
**Depends on**: Phase 1
**Requirements**: DATA-02, DATA-05
**Success Criteria** (what must be TRUE):
  1. Every `db.ref(...).set(...)`, `.push(...)`, `.update(...)`, and `.remove(...)` call is documented with: the RTDB path, the triggering action, and the store function that owns it
  2. Every location where the same logical write goes to both Firebase and PostgreSQL is identified and documented as a dual-write site
  3. The `PuzzleModel.logSolve()` Firebase stats write is documented alongside its PG equivalent to confirm it is genuinely redundant
  4. The `SocketManager.assignTimestamp()` function's role in intercepting `SERVER_TIME` sentinels before PG insert is documented as a system boundary
**Plans**: 1 plan

Plans:
- [x] 05-01-PLAN.md -- Source-verify all 21 Firebase write call sites, validate dual-write analysis, confirm assignTimestamp() system boundary, finalize 05-WRITES.md (DATA-02, DATA-05)

### Phase 6: Data Integrity Analysis
**Goal**: Complete analysis of the `getTime()`/`SERVER_TIME` dependency chain and a full inventory of data that lives only in Firebase with no PostgreSQL equivalent
**Depends on**: Phase 4, Phase 5
**Requirements**: DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. Every call site of `getTime()` and every use of the `SERVER_TIME` sentinel is listed with the component that uses it and the consequence if it were replaced with `Date.now()` or a `GET /api/time` endpoint
  2. The `SocketManager.assignTimestamp()` sentinel interception is documented as the downstream safeguard, with a clear statement of what breaks if it is removed before `SERVER_TIME` usages are replaced
  3. Data that exists only in Firebase (no PG equivalent) is inventoried with: RTDB path, data type, estimated record count if determinable from code, and risk level if that data is lost
  4. The `user/{id}/history` path is documented as the highest-priority Firebase-only data responsibility with the specific reasons guest user support complicates its migration
**Plans**: 1 plan

Plans:
- [x] 06-01-PLAN.md -- Build 06-INTEGRITY.md with timestamp dependency chain analysis (DATA-03) and Firebase-only data inventory with user history deep-dive (DATA-04)

### Phase 7: Removal Path Assessment
**Goal**: A complete, actionable Firebase removal analysis that gives the team everything needed to decide whether full removal is feasible and what it would take
**Depends on**: Phase 3, Phase 6
**Requirements**: MIGR-01, MIGR-04
**Success Criteria** (what must be TRUE):
  1. The removal is structured into ordered steps with a clear dependency graph -- no step appears before its prerequisites are documented
  2. Each removal step has an effort estimate (small/medium/large) and a risk rating (low/medium/high) with rationale
  3. Battle mode is analyzed as a fork: the "delete" path (if battle is dead in production) and the "migrate" path (if battle is live) are both documented with their respective effort and risk profiles
  4. Prerequisites that must be true before removal can begin are explicitly listed (e.g., "PG `game_history` table must exist", "`GET /api/time` must be deployed")
  5. The document ends with a single summarizing statement: "Full Firebase removal is [feasible/not feasible] with [N] weeks of prerequisite work, with the primary risk being [X]"
**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md -- Build 07-REMOVAL.md with ordered removal steps, effort/risk ratings, prerequisites, battle mode fork, and feasibility statement (MIGR-01, MIGR-04)

### Phase 8: Upgrade Path Assessment
**Goal**: A complete analysis of upgrading from Firebase SDK v7.24.0 to v10+ including the compat layer option, all breaking changes, and the full effort required
**Depends on**: Phase 1
**Requirements**: MIGR-02
**Success Criteria** (what must be TRUE):
  1. The breaking changes between the v7 namespaced API and the v9/v10 modular API are documented for every API surface the codebase actually uses (not a general SDK diff -- only the surfaces in the inventory)
  2. The compat layer option (`firebase/compat/*`) is evaluated: the 1-file `firebase.js` import change is documented alongside the known limitations and whether it buys meaningful time
  3. The upgrade path is structured into steps with effort estimates, parallel to the removal path format in Phase 7 for easy comparison
  4. The document ends with a direct comparison: upgrade vs. removal across three dimensions -- effort, risk, and long-term maintenance cost
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md -- Build 08-UPGRADE.md with compat evaluation, breaking changes, upgrade steps, summary table, dependency graph, and bundle analysis (MIGR-02)
- [x] 08-02-PLAN.md -- Add upgrade-vs-removal comparison section, cross-phase references, and validate all 4 ROADMAP success criteria (MIGR-02)

### Phase 9: PostgreSQL Schema Analysis
**Goal**: A complete specification of every PostgreSQL schema change needed to replace Firebase-owned data responsibilities, enabling the team to estimate the database work required for removal
**Depends on**: Phase 3, Phase 6
**Requirements**: MIGR-03
**Success Criteria** (what must be TRUE):
  1. Every Firebase RTDB path that has no PG equivalent has a corresponding proposed PG table or column design documented with schema (column names, types, nullable/not-null, indexes)
  2. The `game_history` table design explicitly addresses guest user support via `local_id` column with explanation of how it maps to the existing `localId` localStorage UUID
  3. Each proposed schema change includes the new API endpoints needed to expose it (method, path, request/response shape)
  4. Load impact of the new tables is estimated: which existing high-traffic endpoints would be affected and by how much (rough order-of-magnitude, not a benchmark)
**Plans**: 1 plan

Plans:
- [x] 09-01-PLAN.md -- Build 09-SCHEMA.md with game_history table design, guest identity support, API endpoints, P1-P3 path treatment, load impact analysis, and ROADMAP validation (MIGR-03)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

Note: Phases 4 and 5 depend only on Phase 1 (not each other) and can run in parallel. Phases 7 and 8 depend on different predecessors and can run in parallel. Phase 9 can run in parallel with Phase 7 and Phase 8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Code Inventory | 2/2 | Complete | 2026-03-04 |
| 2. Firebase Path Census | 2/2 | Complete | 2026-03-04 |
| 3. Data Overlap Analysis | 1/1 | Complete | 2026-03-04 |
| 4. Read Path Tracing | 1/1 | Complete | 2026-03-04 |
| 5. Write Path Tracing | 1/1 | Complete | 2026-03-04 |
| 6. Data Integrity Analysis | 1/1 | Complete | 2026-03-04 |
| 7. Removal Path Assessment | 1/1 | Complete | 2026-03-04 |
| 8. Upgrade Path Assessment | 2/2 | Complete | 2026-03-04 |
| 9. PostgreSQL Schema Analysis | 1/1 | Complete | 2026-03-04 |
