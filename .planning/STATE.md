---
gsd_state_version: 1.0
milestone: v7.24
milestone_name: milestone
current_phase: 9
current_plan: 1 of 1
status: complete
stopped_at: Completed 09-01-PLAN.md
last_updated: "2026-03-05T02:22:34Z"
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 12
  completed_plans: 12
---

# Execution State

## Position
- **Current Phase:** 9
- **Current Plan:** 1 of 1
- **Status:** Complete

## Progress
`[##########]` Phase 1: 2/2 plans complete
`[##########]` Phase 2: 2/2 plans complete
`[##########]` Phase 3: 1/1 plans complete
`[##########]` Phase 4: 1/1 plans complete
`[##########]` Phase 5: 1/1 plans complete
`[##########]` Phase 6: 1/1 plans complete
`[##########]` Phase 7: 1/1 plans complete
`[##########]` Phase 8: 2/2 plans complete
`[##########]` Phase 9: 1/1 plans complete

## Decisions
- Firebase Auth classified as dormant (not dead) -- SDK loads, firebase.auth() executes, onAuthStateChanged fires, but login is bypassed by disableFbLogin=true
- actions.js imports default firebase object then calls firebase.database() directly -- separate db instance pattern from firebase.js db export
- Upload.js confirmed as containing only a stale comment -- no db.ref() calls, createPuzzle is PG-only
- PuzzleList.js added as 18th file (indirect Firebase consumer via userHistory prop)
- Replays.js local getTime(game) is unrelated to Firebase getTime()
- [Phase 01]: Firebase Auth classified as dormant (not dead) -- SDK loads, firebase.auth() executes, but login is bypassed by disableFbLogin=true
- [Phase 01]: actions.js imports default firebase then calls firebase.database() directly -- separate db instance pattern from firebase.js db export
- [Phase 01]: Upload.js confirmed as stale comment only -- no db.ref() calls, createPuzzle is PG-only
- [Phase 01]: puzzle.logSolve() Firebase writes to stats/{pid} and puzzlelist/{pid} are dead -- puzzleModel never wired to Game store model
- [Phase 01]: Dual-write on solve is user.markSolved (Firebase) + recordSolve API (PostgreSQL) only -- puzzle stats not written to Firebase
- [Phase 01]: getTime() has 6 active call sites across 5 files; vendor-firebase chunk is 398 KB raw / 116 KB gzipped (23.8% of total JS)

- [Phase 02]: Battle paths placed in main matrix with warning flag -- not split into separate section
- [Phase 02]: User history identified as highest-priority PG gap -- feeds Play page AND Welcome/PuzzleList status badges
- [Phase 02]: Solve flow classified as LOW removal complexity -- only active Firebase write is user.markSolved boolean flip
- [Phase 02]: Dead code paths (stats/solves, puzzlelist/stats) included in matrix with Dead status for completeness
- [Phase 02]: Battle mode confirmed DEAD by project owner -- LIVE-01 decision gate resolved; removal in PR #352 (claude/pensive-bassi)
- [Phase 02]: Battle removal reduces migration surface by ~40% -- no PG battle tables needed, 7 RTDB paths being removed
- [Phase 02]: Only 2 decision-gate unknowns remain: archivedEvents (LIVE-03) and GID counter alignment (LIVE-02)
- [Phase 02]: Game page migration complexity downgraded from HIGH to MEDIUM with battleData being removed

- [Phase 03]: User game history rated HIGH severity -- highest-risk Firebase dependency with zero PG coverage affecting all users, especially guests
- [Phase 03]: PuzzleList merge precedence: PG can only UPGRADE (started->solved) or FILL a gap, never DOWNGRADE -- removing Firebase loses 'started' badges but cannot cause false 'solved' badges
- [Phase 03]: Guest users have zero PG fallback for history -- pgStatuses is always {} because user?.id is falsy in NewPuzzleList.tsx
- [Phase 03]: Solo game history format ('solo' key in PuzzleList.js) identified as 4th decision-gate unknown -- Firebase-only legacy data with no PG equivalent
- [Phase 03]: Battle mode confirmed dead -- NONE severity, reduces migration surface by ~40%
- [Phase 03]: Dead code paths (logSolve stats/puzzlelist writes) excluded from active risk -- only user.markSolved() is the active Firebase write on solve
- [Phase 03]: User game history rated HIGH severity -- highest-risk Firebase dependency with zero PG coverage affecting all users, especially guests

- [Phase 04]: game.js battleData subscription has a leak bug -- detach() does not call .off('value') on the battleData listener; low severity given battle removal
- [Phase 04]: After battle removal, only 1 active real-time subscription remains: puzzle/{pid} in puzzle.js
- [Phase 04]: Stats.tsx is a transitional consumer -- reads Firebase for GID index but renders PG data
- [Phase 04]: Replays.js waterfall is the most network-intensive Firebase read pattern: 1 + N round-trips (default N=20, can grow to 70+)
- [Phase 04]: puzzle.logSolve() stats read confirmed dead (puzzleModel never wired) -- consistent with Phase 1 finding

- [Phase 05]: All 21 Firebase write call sites verified against source code -- line numbers, code snippets, RTDB paths, and data shapes all confirmed accurate
- [Phase 05]: Executive Summary corrected from 20 to 21 writes (checkPickups has 2 writes) and from 5 to 4 operation types (no .update() exists)
- [Phase 05]: All 4 ROADMAP success criteria for Phase 5 confirmed met: write documentation, dual-write sites, logSolve comparison, assignTimestamp boundary
- [Phase 05]: Solve path is the only dual-write site -- Firebase gets stats/{pid} and puzzlelist/{pid}, PG gets puzzle_solves + puzzles.times_solved + game_snapshots with different fields

- [Phase 06]: All 6 getTime() consumer sites can safely be replaced with Date.now() -- no GET /api/time endpoint needed
- [Phase 06]: assignTimestamp() ordering constraint: client-side SERVER_TIME replacement MUST happen before assignTimestamp() removal -- reverse order corrupts PG data
- [Phase 06]: demoGame.js SERVER_TIME is client-side only (never reaches assignTimestamp) -- sentinel never resolved, replacing with Date.now() is an improvement
- [Phase 06]: user/{id}/history is highest-priority migration item for Phase 9 -- requires new game_history table with local_id column for guest support

- [Phase 07]: Firebase removal is feasible with 3-5 weeks of prerequisite work -- primary risk is guest user local_id mapping in game_history table
- [Phase 07]: 12 removal steps organized into 4 parallel tracks: Timestamps (A), User History (B), Feature Migration (C), Cleanup (D)
- [Phase 07]: Critical path runs through Track B (user history migration): P2 -> Step 5 -> Step 6 -> Steps 10-12 = 7-13 days
- [Phase 07]: PR #352 (battle removal, OPEN) listed as prerequisite P1 -- not assumed merged
- [Phase 07]: 3 quick wins identified for immediate execution: logSolve dead code removal, getTime()->Date.now(), serverTimeOffset listener removal
- [Phase 07]: assignTimestamp() removal (Step 3) rated Medium risk due to cached client deployment timing concern
- [Phase 08]: Compat layer (Option A) achievable in <1 day with 3 import path changes; zero bundle benefit but buys version currency
- [Phase 08]: Full modular migration (Option B) estimated at 5-10 dev-days; 58-81% Firebase bundle reduction; neither option resolves architectural concerns
- [Phase 08]: Only v9 breaking changes affect codebase APIs -- v10/v11 have zero impact; Step 5 (battle.js) eliminated if PR #352 merged
- [Phase 08]: Long-term maintenance cost is the decisive comparison dimension -- upgrading leaves all architecture concerns (dual-write, guest identity, real-time for static data) untouched
- [Phase 08]: Hybrid path (compat + removal) provides both immediate SDK currency (<1 day) and long-term architecture resolution (3-5 weeks per Phase 7)
- [Phase 08]: Comparison references Phase 7 findings directly rather than repeating them -- enables side-by-side reading of 07-REMOVAL.md and 08-UPGRADE.md
- [Phase 08]: All 4 ROADMAP Phase 8 success criteria verified met: breaking changes, compat evaluation, upgrade steps, and comparison section

- [Phase 09]: game_history table uses UUID PK (gen_random_uuid) not SERIAL -- matches users table pattern, refines Phase 7 sketch
- [Phase 09]: pid is TEXT not INTEGER throughout -- matches puzzles.pid type despite Firebase storing numeric pid
- [Phase 09]: Boolean solved with "started" inferred from row existence -- matches Firebase data model, avoids enum migration complexity
- [Phase 09]: Keep both user_id and local_id on merged rows -- audit trail preservation over data cleanup
- [Phase 09]: CHECK constraint requires at least one identity (user_id or local_id) -- prevents orphaned records
- [Phase 09]: solved_at column added beyond Phase 7 sketch -- enables solve-time analytics without cross-table joins
- [Phase 09]: All 4 ROADMAP Phase 9 success criteria verified met: schema coverage, local_id guest support, API endpoints, load impact

## Blockers
None

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 12min | 2 | 1 |
| Phase 01 P01 | 12min | 2 tasks | 1 files |
| 01 | 02 | 8min | 2 | 1 |
| 02 | 01 | 10min | 2 | 1 |
| 02 | 02 | 17min | 2 | 1 |
| 03 | 01 | 5min | 2 | 1 |
| Phase 03 P01 | 5min | 2 tasks | 1 files |
| 04 | 01 | 6min | 2 | 1 |
| 05 | 01 | 2min | 2 | 1 |
| Phase 05 P01 | 2min | 2 tasks | 1 files |
| 06 | 01 | 6min | 2 | 1 |
| 07 | 01 | 6min | 2 | 1 |
| Phase 07 P01 | 6min | 2 tasks | 1 files |
| Phase 08 P01 | 4min | 2 tasks | 1 files |
| 08 | 02 | 2min | 2 | 1 |
| 09 | 01 | 5min | 2 | 1 |

## Last Session
- **Timestamp:** 2026-03-05T02:22:34Z
- **Stopped at:** Completed 09-01-PLAN.md
