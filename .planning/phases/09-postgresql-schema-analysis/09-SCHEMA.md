# Phase 9: PostgreSQL Schema Analysis

**Created:** 2026-03-04
**Phase:** 09-postgresql-schema-analysis
**Depends on:** Phase 3 (Data Overlap), Phase 6 (Data Integrity), Phase 7 (Removal Path)
**Purpose:** Complete PG schema specification for replacing all Firebase-owned data responsibilities

---

## Section 0: Executive Summary

This document specifies every PostgreSQL schema change needed to replace Firebase-owned data responsibilities, enabling the team to estimate the database work required for full Firebase removal. The specification covers all 7 active Firebase-only RTDB paths identified in Phase 6 (Section 2.1), ranging from P0 (highest priority) to P3 (lowest priority).

### Summary Table

| # | RTDB Path | Priority | Schema Action | Table Name | Status |
|---|-----------|----------|---------------|------------|--------|
| 1 | `user/{id}/history/{gid}` | P0 (HIGH) | CREATE TABLE | `game_history` | New table required |
| 2 | `user/{id}/history.solo` | P1 (MEDIUM) | Same table | `game_history` (migration variant) | Decision point: migrate vs deprecate |
| 3 | `game/{gid}/archivedEvents` | P2 (MEDIUM) | Conditional | Existing `game_events` | Conditional on LIVE-03 resolution |
| 4 | `counters/gid` | P2 (MEDIUM) | No Table Needed | Existing `gid_counter` sequence | Alignment check only |
| 5 | `user/{id}/names/{username}` | P3 (LOW) | No Table Needed | N/A | Accept data loss |
| 6 | `.info/serverTimeOffset` | P3 (LOW) | No Table Needed | N/A | Code change only |
| 7 | `game/{gid}/archivedEvents/unarchivedAt` | P3 (LOW) | No Table Needed | N/A | Removed with unarchive flow |

**Totals:**
- **1 new table:** `game_history` (covers P0 and P1)
- **1 conditional change:** `game_events` may need an archived-source indicator (P2, contingent on LIVE-03)
- **4 code-only resolutions:** counters/gid alignment check, names data loss acceptance, serverTimeOffset replacement with `Date.now()`, unarchivedAt removal

**Cross-phase references:** This specification responds directly to the Phase 6 Firebase-only data inventory (Section 2) and satisfies Phase 7 prerequisite P2 (Section 3, "Build game_history PG Table + API"). The Phase 3 overlap analysis (Section 1 Risk Matrix) established the severity ratings that drive the priority ordering above.

---

## Section 1: game_history Table (P0 -- Highest Priority)

This is the core deliverable of the schema specification. The `game_history` table replaces Firebase `user/{id}/history/{gid}` -- the highest-risk Firebase dependency with zero PG coverage, rated HIGH severity in Phase 3 (Section 3.1). Without this table, Firebase removal loses ALL game history for ALL users. Guests lose everything permanently; authenticated users lose pre-PG-era history and "started" game tracking.

### 1a. CREATE TABLE DDL

Following existing conventions from `server/sql/` schema files: `IF NOT EXISTS`, `dfacadmin` ownership, `GRANT ALL`, `timestamptz` for all new timestamp columns per CONTEXT.md decision.

```sql
-- server/sql/create_game_history.sql
--
-- Stores user game participation history, replacing Firebase user/{id}/history/{gid}.
-- Supports both authenticated users (user_id) and guests (local_id).

CREATE TABLE IF NOT EXISTS game_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gid TEXT NOT NULL,                                          -- game ID (matches game_events.gid format)
    pid TEXT NOT NULL,                                          -- puzzle ID (TEXT, matches puzzles.pid type)
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,        -- NULL for guests
    local_id TEXT,                                              -- localStorage dfac-id UUID for guest support
    solved BOOLEAN NOT NULL DEFAULT false,                      -- whether user has solved this game
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),               -- when user joined the game
    solved_at TIMESTAMPTZ,                                      -- when user solved (NULL if not solved)
    v2 BOOLEAN NOT NULL DEFAULT false,                          -- game format version flag

    -- At least one identity must be provided
    CONSTRAINT game_history_identity_check CHECK (
        user_id IS NOT NULL OR local_id IS NOT NULL
    )
);
```

**Column design rationale:**

| Column | Type | Rationale |
|--------|------|-----------|
| `id` | UUID (gen_random_uuid) | Follows `users` table pattern for UUID PKs |
| `gid` | TEXT | Matches `game_events.gid` and `game_snapshots.gid` types |
| `pid` | TEXT | Matches `puzzles.pid` type -- NOT INTEGER despite Firebase storing numeric pid (Research Pitfall 2) |
| `user_id` | UUID, nullable, FK | FK to `users(id)` with CASCADE delete; NULL for guest users |
| `local_id` | TEXT, nullable | Stores the `localStorage` `dfac-id` UUID from `src/localAuth.js`; TEXT not VARCHAR(36) for consistency with existing text columns |
| `solved` | BOOLEAN NOT NULL DEFAULT false | Boolean status with "started" inferred from row existence where `solved = false`; matches existing Firebase data model (Research Pitfall 3 status granularity discussion) |
| `joined_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Uses `timestamptz` per CONTEXT.md; maps to Firebase `time` field |
| `solved_at` | TIMESTAMPTZ, nullable | Records when solve occurred; NULL until solved; enables solve-time analytics |
| `v2` | BOOLEAN NOT NULL DEFAULT false | Preserves Firebase format version flag for migration completeness |
| CHECK constraint | -- | Ensures every row has at least one identity (user_id or local_id), preventing orphaned records |

### 1b. Indexes

Following the `puzzle_solves` partial unique index pattern (Research Pitfall 1) to handle nullable identity columns correctly. Standard SQL unique constraints treat NULLs as distinct values, so partial indexes are required to enforce one-row-per-user-per-game.

```sql
-- One history entry per authenticated user per game
CREATE UNIQUE INDEX IF NOT EXISTS game_history_user_game_idx
    ON game_history (user_id, gid) WHERE user_id IS NOT NULL;

-- One history entry per guest per game (keyed on local_id when no user_id)
CREATE UNIQUE INDEX IF NOT EXISTS game_history_guest_game_idx
    ON game_history (local_id, gid) WHERE user_id IS NULL;

-- Fast lookups by puzzle ID for puzzle-level history queries
CREATE INDEX IF NOT EXISTS game_history_pid_idx
    ON game_history (pid);

-- Fast lookups by local_id for guest history listing
CREATE INDEX IF NOT EXISTS game_history_local_id_idx
    ON game_history (local_id) WHERE local_id IS NOT NULL;
```

**Index rationale:**

| Index | Purpose | Pattern Source |
|-------|---------|---------------|
| `game_history_user_game_idx` | Prevents duplicate entries per authenticated user per game; enables O(1) conflict detection on INSERT | `puzzle_solves_user_game_idx` partial unique pattern |
| `game_history_guest_game_idx` | Prevents duplicate entries per guest per game; scoped to `user_id IS NULL` to avoid false conflicts | `puzzle_solves_anon_game_idx` partial unique pattern |
| `game_history_pid_idx` | Supports `GET /api/user/history` filtered by puzzle, and puzzle-level analytics queries | `game_snapshots_pid_idx` pattern |
| `game_history_local_id_idx` | Supports guest history listing via `WHERE local_id = $1`; partial to exclude rows where local_id is NULL | `puzzle_solves_user_id_idx` partial pattern |

### Ownership and Grants

```sql
ALTER TABLE public.game_history
    OWNER to dfacadmin;

GRANT ALL ON TABLE public.game_history TO dfacadmin;
```

### 1c. Guest Identity Design

The `local_id` column bridges the gap between Firebase's guest identity model and PostgreSQL. This is the critical design element that enables game history for unauthenticated users.

**How guest identity works today (from Phase 3 Section 4 and Phase 6 Section 2.3.4):**

1. `src/localAuth.js` generates a UUID v4 and stores it in `localStorage` under key `'dfac-id'`
2. `src/store/user.js` `get id()` returns `getLocalId()` when `disableFbLogin=true` (always true in production)
3. Firebase operations use this `localId` as the user identifier: `db.ref('user/' + localId + '/history')`
4. `user_identity_map` table maps `user_id` (UUID FK to users) to `dfac_id` (text, the localStorage UUID) -- but only for users who sign up

**The gap:** Guest users have no `users` row and no `user_identity_map` row. Firebase stores their history keyed by the localStorage UUID. PG has no table that accepts a `local_id` as a lookup key for game history.

**The bridge:** The `game_history.local_id` column stores the localStorage UUID directly, enabling:
- **Guest queries:** `SELECT * FROM game_history WHERE local_id = $1 AND user_id IS NULL ORDER BY joined_at DESC`
- **Authenticated queries:** `SELECT * FROM game_history WHERE user_id = $1 ORDER BY joined_at DESC`
- **Both-paths queries:** For users who signed up mid-session, both `user_id` and `local_id` are populated on the same row

**Guest-to-authenticated migration:**

When a guest user signs up, their existing game history needs to be linked to their new `users` row. This is triggered alongside the existing `linkDfacId()` call in `server/model/user.ts`:

```sql
-- Triggered alongside linkDfacId() in server/model/user.ts signup flow
UPDATE game_history
SET user_id = $1
WHERE local_id = $2 AND user_id IS NULL;
```

This UPDATE migrates all guest history rows to the authenticated user. The migration is idempotent: rows already linked to a `user_id` are excluded by the `WHERE user_id IS NULL` clause.

**Merge behavior decision:** Keep both IDs (`user_id` + `local_id`) on merged rows rather than clearing `local_id`. Rationale:
- **Audit trail:** Preserves the original guest identity for debugging and data verification
- **No functional impact:** Queries use `WHERE user_id = $1` for authenticated users, so the `local_id` presence on the same row is harmless
- **Rollback safety:** If a user account is deleted (`ON DELETE CASCADE` removes game_history rows), the `local_id` information is also cleaned up

**Status granularity decision:** Boolean `solved` with "started" inferred from row existence where `solved = false`. Rationale:
- Matches the existing Firebase data model where `{solved: true/false}` is the only status field
- Avoids enum migration complexity (adding an enum requires `CREATE TYPE` and handling future state transitions)
- The PuzzleList merge logic (Phase 3 Section 2) already uses this inference: row exists with `solved = false` means "started", row exists with `solved = true` means "solved", no row means "new"
- Consistent with Phase 3 finding: PG can only UPGRADE (started -> solved) or FILL, never DOWNGRADE

### 1d. Migration Outline

**Source:** Firebase `user/{id}/history/{gid}` entries (standard format: `{pid, solved, time, v2}`)

**Approach:**
1. Read all Firebase user history entries via `db.ref('user').once('value')` or paginated reads
2. For each user, iterate over their `history` object (excluding the `solo` key -- handled in Section 2)
3. Map fields:
   - `gid` from the Firebase entry key
   - `pid` cast to TEXT (Firebase stores as number, PG `puzzles.pid` is TEXT)
   - `user_id` resolved via `user_identity_map.dfac_id` lookup (NULL if no mapping exists -- user is a guest)
   - `local_id` set to the Firebase user path ID (the localStorage UUID)
   - `solved` directly from Firebase boolean
   - `joined_at` from Firebase `time` field (millisecond timestamp -> `to_timestamp(time / 1000.0)`)
   - `solved_at` set to `joined_at` if `solved = true` (Firebase does not store separate solve time)
   - `v2` directly from Firebase boolean
4. Bulk insert into `game_history` using `INSERT ... ON CONFLICT DO NOTHING` for idempotent migration runs

**Volume estimate:** One row per user per game joined. For an application with years of accumulated data, this could range from tens of thousands to hundreds of thousands of rows depending on user base size. Each row is small (~100-150 bytes) so even 1M rows would be ~100-150 MB -- well within PG operational norms.

**Solo key variant:** The `solo` nested format at `user/{id}/history/solo/{uid}/{pid}` requires separate handling. See Section 2 for the decision point on migrate vs deprecate.

---

## Section 2: Solo Key Variant Treatment (P1)

The `user/{id}/history` path contains a legacy nested structure under the `solo` key that has a completely different format from standard history entries. This was identified as the 4th decision-gate unknown in Phase 3 (Section 7, Unknown 4).

### Data Format Difference

| Aspect | Standard Format | Solo Key Format |
|--------|----------------|-----------------|
| Path | `user/{id}/history/{gid}` | `user/{id}/history/solo/{uid}/{pid}` |
| Key structure | `gid` -> `{pid, solved, time, v2}` | `uid` -> `pid` -> `{solved}` |
| Fields | `pid`, `solved`, `time`, `v2` | `solved` only |
| Written by | `joinGame()` in `user.js` (current code) | Unknown (no current code writes this format) |
| Read by | `PuzzleList.js:104-115` (standard iteration) | `PuzzleList.js:116-123` (`gid === 'solo'` branch) |
| PG equivalent | None (this spec creates `game_history`) | None |

### Code Reference

`PuzzleList.js` lines 116-123 handle the solo key:

```javascript
if (gid === 'solo') {
  _.keys(userHistory.solo).forEach((uid) => {
    const soloGames = userHistory.solo[uid];
    _.keys(soloGames).forEach((pid) => {
      const {solved} = soloGames[pid];
      setStatus(pid, solved);
    });
  });
}
```

### Treatment Options

The solo key variant is handled by the same `game_history` table. Two options exist:

**Option A: Migrate (preserve legacy solo badges)**
- Insert rows into `game_history` with a synthetic GID (e.g., `solo-{uid}-{pid}`) to maintain uniqueness
- Set `pid` from the solo entry key, `solved` from the solo entry value
- Set `joined_at` to migration time (Firebase solo entries have no `time` field)
- Set `v2 = false` (legacy format predates v2)
- Pros: Preserves all historical puzzle status badges for users with solo history
- Cons: Synthetic GIDs do not correspond to real games; `joined_at` is approximate

**Option B: Deprecate (accept loss of legacy solo badges)**
- Do not migrate solo entries
- Remove the `gid === 'solo'` branch from `PuzzleList.js`
- Pros: Simpler migration; removes legacy code path
- Cons: Users with pre-v2 solo history lose those "solved" badges

**Decision point:** Resolution requires a LIVE data query to determine prevalence: `db.ref('user').orderByChild('history/solo').limitToFirst(1).once('value')`. If few users have solo entries, Option B is preferable. If many users have them, Option A preserves data. This aligns with Phase 3's decision-gate Unknown 4.

**Recommendation:** Either option uses the same `game_history` table schema. No schema change is needed to support either path -- the difference is purely in the migration script logic and whether to generate synthetic GIDs.

---

## Section 3: archivedEvents Treatment (P2, Conditional)

This treatment is conditional on the resolution of LIVE-03: whether any production Firebase games have `archivedEvents` records that have not been unarchived. See Phase 7 Section 3 (P3, LIVE-03) and Phase 3 (Section 3.5, Game Page).

### If archivedEvents ARE Present in Production

Archived game events are stored at external URLs. The `checkArchive()` function in `game.js` detects archived games and triggers `unarchive()`, which fetches events from the external URL and replays them.

**Schema treatment:** No new table is needed. The existing `game_events` table already stores all game events. The migration approach is:

1. Identify all games with `archivedEvents` in Firebase
2. For each archived game, fetch the event data from the external URL
3. Parse the events and INSERT into the existing `game_events` table
4. Optionally add a `source` column or tag to distinguish migrated-from-archive events:

```sql
-- Optional: add source tracking to game_events (ALTER TABLE, not CREATE)
-- Only needed if archive provenance matters for debugging
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'live';
-- Migrated archive events would be inserted with source = 'archive'
```

**Risk:** External URLs may have expired, resulting in permanent data loss for those archived games. This is a pre-existing risk independent of Firebase removal.

### If archivedEvents Are NOT Present in Production

No schema change is needed. The `checkArchive()` and `unarchive()` code paths can be safely removed as dead code. The `unarchivedAt` timestamp write (Section 5, P3 item 3) is also removed.

### Resolution

Run the LIVE-03 query: `db.ref('game').orderByChild('archivedEvents').limitToFirst(1).once('value')` to determine which scenario applies.

---

## Section 4: counters/gid Alignment (P2)

The Firebase `counters/gid` path stores a single integer representing the maximum legacy game ID used for backward enumeration on the Replays page. PG already has a `gid_counter` sequence that serves a similar purpose for new games.

### Current State

From `server/sql/create_id_counters.sql`:

```sql
CREATE SEQUENCE IF NOT EXISTS gid_counter START 100000000;
```

The PG sequence starts at 100,000,000 and generates new composite-format GIDs (e.g., `100000042-vosk`). Legacy Firebase games used pure integer GIDs (e.g., `12345`). The two ID spaces are intentionally non-overlapping.

### Schema Treatment

**No new table is needed.** The `counters/gid` value is a single integer. Options for storing it in PG:

1. **Config constant in application code:** Store the legacy max GID as a constant in the Replays page code (simplest, appropriate if the value never changes)
2. **Environment variable:** Store as `LEGACY_MAX_GID` in the server environment
3. **PG row:** Insert into a simple key-value config table or use a `SELECT setval('legacy_gid_counter', <value>)` on a new sequence

**Alignment check required (LIVE-02):** Query Firebase `counters/gid` to get the current value. Compare with the PG sequence range to verify no overlap:
- If Firebase counter < 100,000,000: No overlap. The legacy and new ID spaces are cleanly separated.
- If Firebase counter >= 100,000,000: Overlap exists. A one-time `ALTER SEQUENCE gid_counter RESTART WITH <firebase_counter + 1>` ensures new PG-generated GIDs start above the legacy range.

**Impact:** The Replays page (`src/pages/Replays.js`) uses the counter as a starting point for backward enumeration through legacy integer-GID games. After Firebase removal, this starting value needs to come from PG or application config instead of a Firebase read. The Replays waterfall read pattern (Phase 4 Section 3) would also need conversion to PG queries against `game_events`, but that is a code change, not a schema change.

---

## Section 5: P3 Items (Low Priority -- No Table Needed)

These three Firebase-only paths require no PostgreSQL schema changes. Each is resolved through code changes only.

### 5.1 user/{id}/names/{username} -- Name Frequency Counter

**What it stores:** A per-username usage frequency counter, incremented via Firebase transaction each time a user sets their display name. Data structure: `user/{id}/names/{username_string}: <integer count>`.

**Why no table is needed:** This data is not surfaced in any UI (Phase 3 Section 3.8). The current display name is preserved in PG `users.display_name`. Only the historical frequency count (how many times each name was used) would be lost.

**Code change:** Remove the `recordUsername()` Firebase transaction in `user.js`. The display name update flow already writes to PG `users.display_name` -- no additional endpoint is needed.

**Data loss accepted:** Historical name frequency data is informational only and has no user-facing impact.

### 5.2 .info/serverTimeOffset -- Transient Runtime Value

**What it stores:** A transient client-server clock offset in milliseconds, calculated by Firebase and read once at page load via `.once('value')` at `firebase.js:34-38`. Not persisted data -- recalculated on every page load.

**Why no table is needed:** This is a runtime value, not stored data. Phase 6 (Section 1.2) confirmed all 6 `getTime()` consumer sites can safely be replaced with `Date.now()`. The typical offset is less than 1 second and becomes stale during long sessions, making `Date.now()` potentially more consistent.

**Code change:** Replace `getTime()` with `Date.now()` across 6 consumer sites (Phase 7 Step 1). Remove the `offset` variable, the `.info/serverTimeOffset` read, and the `getTime()` function from `firebase.js`. No `GET /api/time` endpoint is needed.

### 5.3 game/{gid}/archivedEvents/unarchivedAt -- Workflow Metadata

**What it stores:** A `SERVER_TIME` timestamp recording when a game was unarchived, written at `game.js:192`: `this.ref.child('archivedEvents/unarchivedAt').set(SERVER_TIME)`.

**Why no table is needed:** This is workflow metadata for the archive/unarchive flow, which is itself conditional on LIVE-03 (Section 3). If the unarchive flow is removed as part of Firebase cleanup, this write disappears with it. Even if preserved, the "when was this unarchived" timestamp is non-critical metadata.

**Code change:** Remove the `unarchivedAt` write alongside the `checkArchive()` / `unarchive()` flow removal (Phase 7 Step 8). If the unarchive flow is preserved (LIVE-03 confirms archived games exist), the timestamp could be stored as a column on the game_events metadata or as a simple application log entry.

---

## Section 6: API Endpoints

### 6a. game_history Endpoints (Detailed)

Four new endpoints for the `game_history` table, following existing `server/api/` route patterns. All use `optionalAuth` middleware from `server/auth/middleware.ts` since both authenticated users (JWT) and guests (local_id) need access.

---

#### GET /api/user/history -- List User's Game History

**Purpose:** Replaces Firebase `listUserHistory()` in `src/store/user.js:59-63`. Returns the user's game participation history for the Play page game list and PuzzleList status badges.

**Auth:** `optionalAuth` middleware (sets `req.authUser` if JWT present, continues either way)

**Query parameters:**
- `local_id` (string, optional) -- localStorage dfac-id UUID for guest users
- `limit` (integer, optional, default 100) -- pagination limit
- `offset` (integer, optional, default 0) -- pagination offset

**Query logic:**
```sql
-- Authenticated path (req.authUser exists)
SELECT gid, pid, solved, joined_at, solved_at, v2
FROM game_history
WHERE user_id = $1
ORDER BY joined_at DESC
LIMIT $2 OFFSET $3;

-- Guest path (no req.authUser, local_id provided in query params)
SELECT gid, pid, solved, joined_at, solved_at, v2
FROM game_history
WHERE local_id = $1 AND user_id IS NULL
ORDER BY joined_at DESC
LIMIT $2 OFFSET $3;
```

**Response shape:**
```json
{
  "history": [
    {
      "gid": "100000042-vosk",
      "pid": "12345",
      "solved": true,
      "joinedAt": "2026-01-15T14:22:10.000Z",
      "solvedAt": "2026-01-15T15:03:22.000Z",
      "v2": true
    }
  ],
  "total": 47
}
```

**Total count query:**
```sql
-- For pagination: count total rows matching the same WHERE clause
SELECT COUNT(*) FROM game_history WHERE user_id = $1;
-- or for guests:
SELECT COUNT(*) FROM game_history WHERE local_id = $1 AND user_id IS NULL;
```

**Reference:** Replaces Firebase `listUserHistory()` in `src/store/user.js`. The response shape provides all fields needed by both `PuzzleList.js` (for status badges) and the Play page (for game list display).

---

#### POST /api/user/history/:gid -- Record Game Join

**Purpose:** Replaces Firebase `joinGame()` in `src/store/user.js:66-76`. Creates a game history entry when a user enters a game. Called from `Game.js:140` and `Game.js:379`.

**Auth:** `optionalAuth`

**URL parameters:**
- `:gid` (string) -- game ID

**Request body:**
```json
{
  "pid": "12345",
  "localId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "v2": true
}
```

**Query logic:**
```sql
-- Authenticated user
INSERT INTO game_history (gid, pid, user_id, local_id, v2)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT DO NOTHING;

-- Guest user (no req.authUser)
INSERT INTO game_history (gid, pid, local_id, v2)
VALUES ($1, $2, $3, $4)
ON CONFLICT DO NOTHING;
```

The `ON CONFLICT DO NOTHING` makes the operation idempotent -- calling it multiple times for the same user+game has no effect. This matches the `game_dismissals` pattern in `server/model/game_dismissal.ts`.

**Response shape:**
```json
{
  "success": true
}
```

---

#### PUT /api/user/history/:gid/solve -- Mark Game as Solved

**Purpose:** Replaces Firebase `markSolved()` transaction in `src/store/user.js:82-96`. Updates a game history entry to `solved = true`. Called from `Game.js:426` after `recordSolve()` completes.

**Auth:** `optionalAuth`

**URL parameters:**
- `:gid` (string) -- game ID

**Request body:**
```json
{
  "localId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Query logic:**
```sql
-- Uses RETURNING * with rowCount check to preserve Firebase transaction null-guard
-- (Research Pitfall 5: if 0 rows returned, the game was not joined)
UPDATE game_history
SET solved = true, solved_at = NOW()
WHERE gid = $1
  AND (user_id = $2 OR (local_id = $3 AND user_id IS NULL))
RETURNING *;
```

**rowCount check:** If `result.rowCount === 0`, the game was not in the user's history (they never joined). This preserves the Firebase `.transaction()` null-guard behavior documented in Phase 6 Section 2.3.2: the Firebase transaction returns `null` to abort if the history item does not exist. The PG equivalent checks `rowCount` instead. This prevents phantom solved records for games the user never joined (Research Pitfall 5).

**Response shape:**
```json
{
  "success": true
}
```

If `rowCount === 0`: return `{ "success": false }` with HTTP 404 (game not in history).

---

#### POST /api/user/history/merge -- Merge Guest History to Authenticated User

**Purpose:** Merges guest game history to an authenticated user account when a guest signs up. Triggered alongside `linkDfacId()` in the existing signup flow (`server/model/user.ts`).

**Auth:** `requireAuth` (must be authenticated to merge)

**Request body:**
```json
{
  "localId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Query logic:**
```sql
-- Merge all guest history rows to the authenticated user
UPDATE game_history
SET user_id = $1
WHERE local_id = $2 AND user_id IS NULL;
```

This UPDATE sets `user_id` on all rows that match the `local_id` and have no existing `user_id`. The `WHERE user_id IS NULL` clause makes it idempotent and prevents overwriting rows already linked to another user.

**Merge behavior:** Both `user_id` and `local_id` are kept on merged rows (audit trail preservation). The `local_id` value remains on the row for debugging purposes but is no longer used for lookups since `WHERE user_id = $1` takes precedence for authenticated queries.

**Triggered alongside:** The existing `linkDfacId(userId, dfacId)` call in `server/model/user.ts`. The signup flow becomes:
1. Create user row in `users` table (existing)
2. `linkDfacId(userId, dfacId)` -- INSERT into `user_identity_map` (existing)
3. `mergeGameHistory(userId, dfacId)` -- UPDATE `game_history` (new)

**Response shape:**
```json
{
  "merged": 12
}
```

Where `merged` is the count of rows updated (`result.rowCount`).

### 6b. P2-P3 Items -- No New Endpoints Needed

**archivedEvents (P2):** If LIVE-03 confirms archived games exist, the migration is a one-time batch operation (fetch external URL events, insert into existing `game_events` table). No ongoing API endpoint is needed -- existing game event queries serve the data after migration.

**counters/gid (P2):** The legacy max GID value is stored as a config constant or environment variable. The Replays page reads it at initialization. No new endpoint is needed -- the value is static after migration.

**P3 items (names, serverTimeOffset, unarchivedAt):** These are code-only changes. The `names` frequency counter is removed (no endpoint), `serverTimeOffset` is replaced by `Date.now()` (no endpoint), and `unarchivedAt` is removed with the unarchive flow (no endpoint).

---

## Section 7: Load Impact Analysis

For each new table/endpoint, this section analyzes the query impact on existing pages. The key finding is that the new `game_history` PG queries **replace** existing Firebase reads -- they do not add to them. The net impact is neutral to positive because indexed PG queries replace Firebase RTDB reads.

### Per-Page Impact Analysis

#### Play Page (`/play`)

**Current behavior:** Fetches Firebase `user/{id}/history` via `listUserHistory()` + PG `puzzle_solves` via `getUserStats()` for status badges. Two data source reads per page load.

**After migration:** Single `GET /api/user/history` query replaces the Firebase read. The PG `getUserStats()` call may also be simplified or merged since `game_history` now provides both "started" and "solved" statuses.

**Query cost:** O(1) indexed lookup by `user_id` or `local_id` index. The `game_history_user_game_idx` (for authenticated) or `game_history_local_id_idx` (for guests) covers the WHERE clause. With pagination (`LIMIT 100`), the result set is bounded.

**Net impact:** **NEUTRAL to POSITIVE** -- replaces one Firebase RTDB read with one indexed PG query. Eliminates one data source entirely. The PuzzleList component switches from dual-read (Firebase + PG) to single PG read (Research Pitfall 4 confirms this is a replacement, not an addition).

#### Game Page (`/game/:gid`)

**Current behavior:** On game join, `joinGame()` writes to Firebase `user/{id}/history/{gid}`.

**After migration:** `POST /api/user/history/:gid` adds 1 INSERT per game join.

**Query cost:** O(1) upsert with `ON CONFLICT DO NOTHING`. The partial unique indexes handle conflict detection efficiently.

**Net impact:** **NEGLIGIBLE** -- replaces one Firebase `.set()` write with one PG INSERT. Firebase write was already happening on every game join; PG write is comparable.

#### Solve Flow

**Current behavior:** `markSolved()` Firebase transaction updates `user/{id}/history/{gid}` to `{solved: true}`.

**After migration:** `PUT /api/user/history/:gid/solve` executes an indexed UPDATE.

**Query cost:** O(1) indexed UPDATE using the partial unique indexes. `RETURNING *` adds negligible overhead.

**Net impact:** **NEGLIGIBLE** -- replaces one Firebase `.transaction()` with one PG UPDATE. The PG UPDATE is simpler (no read-modify-write cycle) and equally fast.

#### Signup Flow

**Current behavior:** `linkDfacId()` inserts into `user_identity_map`.

**After migration:** `POST /api/user/history/merge` adds a batch UPDATE.

**Query cost:** O(N) where N = number of games the guest has played. This is a one-time operation per user signup. The `game_history_local_id_idx` index on `local_id` makes the UPDATE efficient.

**Net impact:** **NEGLIGIBLE** -- one-time operation. Even for a user with 1,000 games, the batch UPDATE completes in milliseconds with the indexed scan. Signup is an infrequent operation.

#### PuzzleList Component

**Current behavior:** Reads Firebase `userHistory` (via prop from parent) + PG `pgStatuses` (via `getUserStats()` API). Merges both in `NewPuzzleList.tsx:56-64`.

**After migration:** Single PG read via `GET /api/user/history`. The merge logic simplifies because both "started" and "solved" come from the same source.

**Query cost:** Same O(1) indexed query as Play page (they share the same endpoint).

**Net impact:** **POSITIVE** -- eliminates one data source entirely. The dual-merge logic in `NewPuzzleList.tsx` can be simplified to a single-source status computation.

### Impact Summary Table

| Endpoint | Affected Page(s) | Query Type | Estimated Cost | Net Impact vs Current |
|----------|------------------|------------|----------------|----------------------|
| `GET /api/user/history` | Play page, PuzzleList | SELECT with WHERE on indexed column | O(1) by user_id/local_id index, bounded by LIMIT | **NEUTRAL to POSITIVE** (replaces Firebase read) |
| `POST /api/user/history/:gid` | Game page (on join) | INSERT with ON CONFLICT | O(1) upsert | **NEGLIGIBLE** (replaces Firebase write) |
| `PUT /api/user/history/:gid/solve` | Game page (on solve) | UPDATE with RETURNING | O(1) indexed update | **NEGLIGIBLE** (replaces Firebase transaction) |
| `POST /api/user/history/merge` | Signup flow | Batch UPDATE | O(N), one-time per signup | **NEGLIGIBLE** (new operation, infrequent) |

**Overall assessment:** No load regression is expected from the `game_history` table. All new PG queries replace existing Firebase operations of equal or greater cost. The Play page and PuzzleList actually benefit from eliminating one data source. The most expensive operation (merge on signup) is infrequent and bounded by the user's game count.

---

## Section 8: Cross-Phase References

This schema specification draws from and connects to findings across all prior phases of the Firebase audit.

### Input References

| Schema Decision | Source Phase | Specific Section | How It Informed This Spec |
|----------------|-------------|------------------|--------------------------|
| game_history table need | Phase 3 | Section 3.1 (User Game History -- HIGH severity) | Established that user history is the highest-risk Firebase dependency with zero PG coverage |
| local_id column design | Phase 3 | Section 4 (Guest vs Authenticated Impact) | Documented that guests have zero PG fallback; localStorage UUID is the only identity |
| PuzzleList merge precedence | Phase 3 | Section 2 (PuzzleList Merge Logic) | Confirmed PG can only UPGRADE or FILL, never DOWNGRADE -- informed boolean `solved` decision |
| Solo key variant | Phase 3 | Section 7, Unknown 4 | Identified the legacy format as a decision-gate unknown |
| 7 active Firebase-only paths | Phase 6 | Section 2.1 (Active Firebase-Only Paths) | Definitive input for which paths need PG schema treatment |
| user/{id}/history deep dive | Phase 6 | Section 2.3 (including 2.3.1-2.3.7) | Data structure, write/read paths, guest complications, migration priority |
| Initial game_history sketch | Phase 7 | Section 3, P2 | Starting point for full specification; refined pid type, id type, constraints |
| API endpoint outline | Phase 7 | Section 3, P2 | Initial endpoint list refined with request/response shapes and query logic |
| assignTimestamp ordering | Phase 6 | Section 1.4 | Informed that timestamp migration is a code change (not schema), excluded from this spec |
| getTime replacement | Phase 6 | Section 1.2, 1.5 | Confirmed no `GET /api/time` endpoint needed -- excluded from API spec |

### Refinements from Phase 7 Sketch

The Phase 7 prerequisite P2 sketch (Section 3) provided an initial `game_history` schema. This specification refines it:

| Aspect | Phase 7 Sketch | This Specification | Rationale |
|--------|---------------|-------------------|-----------|
| Primary key | `id SERIAL` | `id UUID DEFAULT gen_random_uuid()` | Matches `users` table UUID PK pattern |
| pid type | `INTEGER NOT NULL` | `TEXT NOT NULL` | Matches `puzzles.pid` TEXT type (Research Pitfall 2) |
| gid type | `VARCHAR NOT NULL` | `TEXT NOT NULL` | Consistency with `game_events.gid` TEXT type |
| local_id type | `VARCHAR(36)` | `TEXT` | Consistency with existing text columns; UUIDs can be longer than 36 chars in some formats |
| solved_at | Not included | `TIMESTAMPTZ, nullable` | Enables solve-time analytics without cross-table joins |
| CHECK constraint | Not included | `user_id IS NOT NULL OR local_id IS NOT NULL` | Prevents orphaned records with no identity |
| Indexes | Not specified | 4 indexes with partial unique pattern | Follows `puzzle_solves` convention for nullable columns |
| API verb for solve | `PATCH` | `PUT` | PUT is more appropriate for idempotent state change (solved is a final state) |

### Phase 7 Removal Steps Unblocked

This schema specification directly enables the following Phase 7 removal steps:

| Phase 7 Step | What This Spec Provides | Unblocked? |
|-------------|------------------------|------------|
| P2 (game_history table + API) | Full DDL, indexes, 4 API endpoints with request/response shapes | **Yes** -- implementable directly from this spec |
| Step 5 (Remove Firebase user history reads) | API endpoint design for `GET /api/user/history` that replaces `listUserHistory()` | **Yes** -- replacement endpoint fully specified |
| Step 6 (Remove Firebase user history writes) | API endpoints for join (`POST`), solve (`PUT`), merge (`POST /merge`) | **Yes** -- all write operations covered |
| Steps 10-12 (Final Firebase removal) | Confirmation that no new tables are needed for P3 items | **Yes** -- P3 items are code-only changes |

---

## Appendix: Validation

### ROADMAP Success Criteria Verification

**Criterion 1 (ROADMAP Phase 9, Item 1):** "Every Firebase RTDB path that has no PG equivalent has a corresponding proposed PG table or column design documented with schema (column names, types, nullable/not-null, indexes)"

- **Status: MET**
- All 7 active Firebase-only paths are addressed in the Summary Table (Section 0)
- Path 1 (user history): Full CREATE TABLE DDL with 9 columns, types, constraints, 4 indexes (Section 1a, 1b)
- Path 2 (solo variant): Handled by same `game_history` table with migration decision documented (Section 2)
- Path 3 (archivedEvents): Conditional treatment documented -- uses existing `game_events` table (Section 3)
- Path 4 (counters/gid): No new table needed -- alignment check documented (Section 4)
- Paths 5-7 (P3 items): Explicit "no table needed" rationale for each (Section 5)

**Criterion 2 (ROADMAP Phase 9, Item 2):** "The game_history table design explicitly addresses guest user support via local_id column with explanation of how it maps to the existing localId localStorage UUID"

- **Status: MET**
- `local_id` column exists in DDL (Section 1a)
- Explanation references `src/localAuth.js` and localStorage key `'dfac-id'` (Section 1c)
- Guest query path documented: `WHERE local_id = $1 AND user_id IS NULL` (Section 1c, Section 6a GET endpoint)
- Guest-to-authenticated migration path documented with SQL and signup flow integration (Section 1c, Section 6a POST /merge endpoint)

**Criterion 3 (ROADMAP Phase 9, Item 3):** "Each proposed schema change includes the new API endpoints needed to expose it (method, path, request/response shape)"

- **Status: MET**
- game_history has 4 endpoints: GET, POST, PUT, POST/merge (Section 6a)
- Each endpoint has: HTTP method, URL path, auth middleware, query parameters/request body, SQL query logic, response shape
- P2-P3 items have explicit "no new endpoints needed" notes (Section 6b)

**Criterion 4 (ROADMAP Phase 9, Item 4):** "Load impact of the new tables is estimated: which existing high-traffic endpoints would be affected and by how much (rough order-of-magnitude, not a benchmark)"

- **Status: MET**
- Play page, Game page, Solve flow, Signup flow, PuzzleList all analyzed (Section 7)
- Order-of-magnitude estimates present: O(1), O(N) (Section 7)
- Net impact assessment per page: NEUTRAL to POSITIVE, NEGLIGIBLE, POSITIVE (Section 7)
- Summary table with all endpoints, affected pages, query types, costs, and net impact (Section 7)

### Research Pitfall Cross-Check

| Pitfall | Status | Evidence |
|---------|--------|----------|
| Pitfall 1: Missing partial unique indexes | **Addressed** | Section 1b: `game_history_user_game_idx` (WHERE user_id IS NOT NULL) and `game_history_guest_game_idx` (WHERE user_id IS NULL) |
| Pitfall 2: PID type mismatch | **Addressed** | Section 1a: `pid TEXT NOT NULL` matches `puzzles.pid` type |
| Pitfall 3: Forgetting solo key variant | **Addressed** | Section 2: Full treatment with migrate vs deprecate options |
| Pitfall 4: Play page load regression | **Addressed** | Section 7: Net impact is NEUTRAL to POSITIVE -- replacement, not addition |
| Pitfall 5: markSolved transaction semantics | **Addressed** | Section 6a PUT endpoint: `RETURNING *` with `rowCount` check preserves null-guard |

### Schema Convention Cross-Check

| Convention | Status | Evidence |
|-----------|--------|----------|
| `IF NOT EXISTS` | Applied | CREATE TABLE and CREATE INDEX statements |
| `dfacadmin` ownership | Applied | ALTER TABLE OWNER and GRANT ALL |
| `timestamptz` for new columns | Applied | `joined_at` and `solved_at` use TIMESTAMPTZ |
| TEXT for pid | Applied | Matches `puzzles.pid` type |
| TEXT for gid | Applied | Matches `game_events.gid` type |
| UUID PK with gen_random_uuid() | Applied | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| FK with ON DELETE CASCADE | Applied | `user_id UUID REFERENCES users(id) ON DELETE CASCADE` |
| Partial unique indexes | Applied | Follows `puzzle_solves` pattern exactly |
| Separate CREATE INDEX statements | Applied | 4 separate CREATE INDEX statements after CREATE TABLE |

---

*Phase: 09-postgresql-schema-analysis*
*Created: 2026-03-04*
