# Dependency Audit - Cross with Friends

**Date**: 2026-03-01

## CRITICAL - Act Now

### ~~Node.js 20 EOL in April 2026 (one month away)~~ DONE
- ~~**Current**: `"node": "^20.0.0"` (running v20.20.0)~~
- Done: Bumped to `>=22.12.0` (PR #329, tightened in PR #332)

---

## Major Version Upgrades Available

### 1. Firebase SDK: v7 -> v11 (HUGE gap)
- **Current**: `firebase@^7.8.1` (circa 2020)
- **Latest**: `firebase@11.x` (modular SDK)
- **Impact**: This is the single most outdated dependency. Firebase v7 uses the legacy namespaced API (`firebase.database()`, `firebase.auth()`). The modern SDK (v9+) uses a modular tree-shakeable API that dramatically reduces bundle size.
- **Usage**: Only Realtime Database is actively used (auth is disabled with `disableFbLogin = true`). ~11 files import Firebase. All usage is frontend-only.
- **Note**: Given the backend has already migrated to PostgreSQL + Socket.IO, this may be a candidate for full removal rather than upgrade if the migration is complete.

### ~~2. Vite: v5 -> v7~~ DONE
- Done: Upgraded to ^7 (7.3.1) with @vitejs/plugin-react ^5, esbuild as explicit devDep (PR #332)

### ~~3. Vitest: v2 -> v4~~ DONE
- Done: Upgraded to ^4 (4.0.18), no config changes needed (PR #332)

### ~~4. Express: v4 -> v5~~ DONE
- Done: Upgraded to `^5.1.0` with `@types/express@^5`. No code changes needed — codebase used no deprecated APIs.

### 5. React Router: v6 -> v7
- **Current**: `react-router-dom@^6`
- **Latest**: `react-router@7.13.1`
- **Migration**: In v7, everything moves to `react-router` (no more `react-router-dom`). Designed for gradual upgrade via future flags in v6 first.

### 6. ESLint: v9 -> v10
- **Current**: `^9`
- **Latest**: `10.0.2`
- **Note**: Already on flat config, so migration should be moderate. Requires Node >= 20.19.

---

## Minor/Patch Upgrades

| Package | Current | Latest | Notes |
|---|---|---|---|
| ~~**TypeScript**~~ | ~~`~5.4.0`~~ | `~5.8.0` | DONE (PR #332). Bumped for @vitejs/plugin-react 5.x compatibility |
| ~~**@types/node**~~ | ~~`^14.14.14`~~ | `^22.0.0` | DONE (PR #329) |
| **@types/pg** | `^7.14.7` | `8.18.0` | Major behind, should be `^8` to match `pg@^8` |
| ~~**@types/express**~~ | ~~`^4.17.11`~~ | `^5.0.0` | DONE (upgraded with Express 5) |
| **@types/uuid** | `^8.3.0` | `11.0.0` | 3 majors behind |
| **uuid** | `^8.3.2` | `13.0.0` | 5 majors behind |
| **clsx** | `^1.1.0` | `2.1.1` | Major behind |
| **lint-staged** | `^10.5.3` | `16.3.1` | 6 majors behind |
| **react-dropzone** | `^14` | `15.0.0` | Major behind |
| **argparse** | `^1.0.10` | `2.0.1` | Major behind |

---

## Packages to Remove

| Package | Reason |
|---|---|
| ~~**left-pad**~~ | ~~**Deprecated**. Replaced with `String.padStart()`~~ DONE (PR #333) |
| ~~**querystringify** + **@types/querystringify**~~ | ~~**Never imported anywhere**. Dead dependency~~ DONE (PR #333) |
| ~~**gaussian**~~ | ~~**Never imported anywhere**. Dead dependency~~ DONE (PR #333) |
| **bluebird** | Promise library, used once in `src/pages/Replays.js`. Replace with native `Promise.all()` |
| **classnames** | Redundant - `clsx` is already a dependency and does the same thing. 4 files use `classnames` |
| ~~**body-parser**~~ | ~~Replaced with Express built-in `express.json()`~~ DONE (PR #333) |

---

## ~~Packages to Move to devDependencies~~ DONE (PR #334)

~~These were in `dependencies` but only used at dev time — all moved to `devDependencies`:~~

| Package | Used In |
|---|---|
| ~~**nodemon**~~ | ~~Dev scripts only (`devbackend`)~~ |
| ~~**cross-env**~~ | ~~Dev/test scripts only~~ |
| ~~**@types/lodash**~~ | ~~Type definitions~~ |
| ~~**@types/morgan**~~ | ~~Type definitions~~ |
| ~~**@types/node**~~ | ~~Type definitions~~ |
| ~~**@types/querystringify**~~ | ~~Type definitions (removed in PR #333)~~ |
| ~~**@types/react**~~ | ~~Type definitions~~ |
| ~~**@types/react-dom**~~ | ~~Type definitions~~ |

---

## Packages with Low Usage (Consider Replacing)

| Package | Usage | Alternative |
|---|---|---|
| **async** | 2 call sites in `src/store/battle.js` | `Promise.all()` + async/await |
| **react-use** | 4 hooks across 5 files (`useAsync`, `useUpdateEffect`, `usePrevious`, `useToggle`) | Small custom hooks |
| **utility-types** | Only `Brand` type used in 1 file | Inline type definition (2 lines) |
| **lodash** | Widely used, but many functions have native equivalents | Gradual migration to native JS |

---

## TypeScript Config Improvements

- **`tsconfig.base.json`**: `"target": "es2015"` is very conservative. Modern browsers support ES2020+. Bumping to `"es2020"` or `"es2022"` enables optional chaining, nullish coalescing, and other features natively.
- **`server/tsconfig.json`**: Missing `"target"` — inherits nothing since it doesn't extend `tsconfig.base.json`. Should set an explicit target.

---

## Server Build Step (ts-node in production)

The production scripts (`servebackendprod`, `servebackendstaging`) run `ts-node` directly, which adds startup overhead and keeps `typescript` + `ts-node` as runtime dependencies. A better approach:
- Add a `build:server` script that compiles server TypeScript to JavaScript (e.g., `tsc -p server/tsconfig.json`)
- Update `servebackend*` scripts to run the compiled JS with `node`
- Move `typescript` and `ts-node` to `devDependencies`

This would improve production startup time and simplify the dependency footprint.

---

## Recommended Upgrade Priority

1. ~~**Node.js 20 -> 22**~~ DONE (PR #329)
2. ~~**Remove dead deps**~~ DONE (PR #333) — removed left-pad, querystringify, gaussian, body-parser
3. ~~**Fix dependency categorization**~~ DONE (PR #334) — moved dev-only packages to devDependencies
4. ~~**TypeScript 5.4 -> 5.8**~~ DONE (PR #332) + ~~update `@types/node`~~ DONE (PR #329)
5. ~~**Vite 5 -> 7 + Vitest 2 -> 4**~~ DONE (PR #332)
6. **Firebase v7 -> remove or v11** (biggest effort, biggest payoff)
7. ~~**Express 4 -> 5**~~ DONE
8. **React Router v6 -> v7**
9. **ESLint v9 -> v10**
10. **Remaining minor upgrades** (uuid, clsx, lint-staged, react-dropzone, etc.)
11. **Server build step** — replace ts-node in production with compiled JS
