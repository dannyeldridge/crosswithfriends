---
phase: 09-postgresql-schema-analysis
plan: 01
subsystem: database
tags: [postgresql, schema-design, game-history, guest-identity, api-design, firebase-migration]

# Dependency graph
requires:
  - phase: 03-data-overlap-analysis
    provides: Risk matrix, PuzzleList merge logic, guest vs authenticated impact
  - phase: 06-data-integrity-analysis
    provides: Firebase-only data inventory (7 active RTDB paths at P0-P3)
  - phase: 07-removal-path-assessment
    provides: Initial game_history table sketch and API endpoint outline (prerequisite P2)
provides:
  - Complete game_history table DDL with local_id guest support and partial unique indexes
  - 4 API endpoint specifications (GET/POST/PUT/POST-merge) with request/response shapes
  - Schema treatment for all 7 Firebase-only RTDB paths (P0-P3)
  - Load impact analysis showing neutral-to-positive net effect
affects: [firebase-removal-implementation, game-history-api, guest-identity]

# Tech tracking
tech-stack:
  added: []
  patterns: [partial-unique-indexes-for-nullable-columns, on-conflict-do-nothing-idempotent-inserts, returning-with-rowcount-for-null-guard]

key-files:
  created:
    - .planning/phases/09-postgresql-schema-analysis/09-SCHEMA.md
  modified: []

key-decisions:
  - "UUID primary key (gen_random_uuid) for game_history instead of SERIAL -- matches users table pattern"
  - "pid TEXT not INTEGER -- matches puzzles.pid type despite Firebase storing numeric pid"
  - "Boolean solved with started inferred from row existence -- matches Firebase data model, avoids enum complexity"
  - "Keep both user_id and local_id on merged rows -- audit trail preservation over data cleanup"
  - "PUT for solve endpoint (not PATCH) -- idempotent final state change"
  - "solved_at column added beyond Phase 7 sketch -- enables solve-time analytics without cross-table joins"
  - "CHECK constraint requiring at least one identity (user_id or local_id) -- prevents orphaned records"

patterns-established:
  - "game_history partial unique indexes: separate for user_id IS NOT NULL vs IS NULL (follows puzzle_solves pattern)"
  - "optionalAuth middleware for endpoints serving both authenticated and guest users"
  - "Guest identity via local_id column directly on domain table (not user_identity_map indirection)"

requirements-completed: [MIGR-03]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 9 Plan 01: PostgreSQL Schema Analysis Summary

**Complete PG schema specification covering game_history table with local_id guest support, 4 API endpoints, all 7 Firebase-only RTDB paths (P0-P3), and load impact analysis**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T02:16:45Z
- **Completed:** 2026-03-05T02:22:34Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Built the complete 09-SCHEMA.md (715 lines) covering all 7 active Firebase-only RTDB paths with schema treatment for each
- Designed the game_history CREATE TABLE DDL with 9 columns, CHECK constraint, and 4 indexes following existing puzzle_solves partial unique index pattern
- Specified 4 API endpoints with full request/response shapes, SQL query logic, and auth middleware selection
- Documented guest identity design via local_id column with guest-to-authenticated migration path triggered alongside existing linkDfacId()
- Analyzed load impact across 5 affected pages/flows with O(1)/O(N) cost estimates showing no regression
- Validated all 4 ROADMAP Phase 9 success criteria and all 5 Research pitfalls

## Task Commits

Each task was committed atomically:

1. **Task 1: Build 09-SCHEMA.md with game_history table design, P1-P3 path treatment, and API endpoints** - `1439984` (feat)
2. **Task 2: Validate 09-SCHEMA.md against all 4 ROADMAP success criteria and cross-check completeness** - verification-only task, no file changes (validation appendix was included in Task 1 document)

## Files Created/Modified
- `.planning/phases/09-postgresql-schema-analysis/09-SCHEMA.md` - Complete PG schema specification: executive summary, game_history DDL with indexes, guest identity design, solo key treatment, archivedEvents conditional, counters/gid alignment, P3 no-table items, 4 API endpoints, load impact analysis, cross-phase references, and validation appendix

## Decisions Made
- **UUID PK over SERIAL:** Matches `users` table `gen_random_uuid()` pattern rather than Phase 7 sketch's SERIAL
- **TEXT for pid/gid/local_id:** Consistency with existing PG schema (puzzles.pid, game_events.gid are TEXT)
- **Boolean solved (not enum):** Matches Firebase data model; "started" inferred from row existence with solved=false
- **Keep both IDs on merge:** local_id preserved alongside user_id after guest-to-auth migration for audit trail
- **PUT for solve (not PATCH):** Idempotent final-state change; solved is a terminal state
- **solved_at column:** Added beyond Phase 7 sketch to enable solve-time analytics without cross-table joins
- **CHECK constraint:** Prevents orphaned rows with no identity (neither user_id nor local_id)

## Deviations from Plan

None - plan executed exactly as written. The Validation appendix was included in the 09-SCHEMA.md document during Task 1 (as an integral part of the document structure) rather than added as a separate modification in Task 2.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 is the final phase of the Firebase audit milestone
- The game_history table specification is ready for implementation (Phase 7 prerequisite P2 is now fully specified)
- A developer can implement the table, indexes, and API endpoints directly from 09-SCHEMA.md without referencing Firebase data structures
- Three LIVE data queries (LIVE-02, LIVE-03, Solo prevalence) remain as decision-gate unknowns that affect migration scope but not schema design

## Self-Check: PASSED

- FOUND: .planning/phases/09-postgresql-schema-analysis/09-SCHEMA.md
- FOUND: .planning/phases/09-postgresql-schema-analysis/09-01-SUMMARY.md
- FOUND: 1439984 (Task 1 commit)

---
*Phase: 09-postgresql-schema-analysis*
*Completed: 2026-03-04*
