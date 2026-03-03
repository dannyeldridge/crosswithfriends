# Dependency Audit — Cross with Friends

**Updated**: 2026-03-02

---

## Previously Completed

- [x] Node.js 20 -> 22
- [x] Vite 5 -> 7, Vitest 2 -> 4, TypeScript 5.4 -> 5.8 -> 5.9
- [x] Express 4 -> 5, @types/express -> v5
- [x] React Router v6 -> v7
- [x] Removed left-pad, body-parser, querystringify, gaussian, bluebird, classnames, @types/uuid, @types/react-color, @types/ws
- [x] Moved dev-only packages to devDependencies
- [x] Bumped clsx v2, lint-staged v16, nodemon v3, uuid v11, @types/pg v8, pg v8.19, and many more semver patches
- [x] HTML cleanup: removed fullscreen polyfill, XHTML namespace attrs, viewport zoom lock, window.process shim, Google Fonts v1->v2 (PR #338)
- [x] TypeScript target es2015->es2022 (frontend + server), Docker Postgres 16->18 (PR #339)
- [x] Removed `utility-types` — inlined `Brand` type in `src/shared/types.ts`
- [x] Removed `async` — replaced `async.map()` with `Promise.all()` in `src/store/battle.js`
- [x] Removed `react-use` — wrote custom hooks in `src/hooks/` (useUpdateEffect, usePrevious, useToggle); replaced `useAsync` with plain `useEffect`. Eliminated ~600KB transitive deps (141 packages removed)

---

## Remaining — Ordered Easiest to Hardest

### 3. Small Dependency Removals

| # | Package | Current | Usage | Replacement |
|---|---|---|---|---|
| 3c | **`events`** | `^3.3.0` | 4 files in `src/store/` (Battle, User, Game, Puzzle extend `EventEmitter`) | **Not a simple removal** — Vite does NOT auto-polyfill Node built-ins (that's webpack). Options: (a) keep as-is (tiny dep), (b) write a minimal EventEmitter, (c) add `vite-plugin-node-polyfills` |

### 4. Straightforward Major Bumps (drop-in or near-drop-in)

| # | Package | Current | Latest | Notes |
|---|---|---|---|---|
| 4a | **`uuid`** | `^11.1.0` | `13.0.0` | 2 majors. API is stable |
| 4b | **`joi`** | `^17.13.3` | `18.0.2` | 1 major. Check changelog for breaking validation changes |
| 4c | **`cross-env`** | `^7.0.3` | `10.1.0` | 3 majors. Dev scripts only |
| 4d | **`react-confetti`** | `^5.1.0` | `6.4.0` | 1 major |
| 4e | **`react-dropzone`** | `^14.4.1` | `15.0.0` | 1 major |
| 4f | **`react-simple-keyboard`** | `^1.26.6` | `3.8.165` | 2 majors. Mobile keyboard component |
| 4g | **`argparse`** + **`@types/argparse`** | `1.0.10` / `1.0.38` | `2.0.1` / remove | v2 ships own types. Only used in `utils/generate_stickers.ts` |
| 4h | **`esbuild`** | `^0.25.12` | `0.27.3` | 2 minor-as-major (0.x semver). **Also update pnpm override** from `^0.25.12` |
| 4i | **`jsdom`** | `^26.1.0` | `28.1.0` | 2 majors. Dev-only (Vitest env) |

### 5. Stylelint Upgrade (medium — config changes likely)

| # | Package | Current | Latest | Notes |
|---|---|---|---|---|
| 5a | **`stylelint`** | `^16.26.1` | `17.4.0` | 1 major. Check for removed/renamed rules |
| 5b | **`stylelint-config-standard`** | `^36.0.1` | `40.0.0` | 4 majors. Must upgrade together with stylelint |

### 6. Jest Upgrade (medium — server tests only)

| # | Package | Current | Latest | Notes |
|---|---|---|---|---|
| 6a | **`jest`** | `^29.7.0` | `30.2.0` | 1 major. Only affects server tests (frontend uses Vitest) |
| 6b | **`@types/jest`** | `^29.5.14` | `30.0.0` | Must match jest major |
| 6c | **`ts-jest`** | `^29.4.6` | needs v30 | Must match jest major |

### 7. ESLint v10 Ecosystem (BLOCKED — waiting on plugins)

| # | Package | Current | Latest | Status |
|---|---|---|---|---|
| 7a | **`eslint`** | `^9.39.3` | `10.0.2` | Blocked by plugins below |
| 7b | **`@eslint/js`** | `^9.39.3` | `10.0.1` | Tied to eslint v10 |
| 7c | **`eslint-config-prettier`** | `^9.1.2` | `10.1.8` | **Can likely upgrade independently now** |
| 7d | **`eslint-import-resolver-typescript`** | `^3.10.1` | `4.4.4` | **May be independent of eslint v10** |
| 7e | **`eslint-plugin-react-hooks`** | `^5.2.0` | `7.0.1` | Check if v7 supports eslint v10 |
| 7f | **`eslint-plugin-react`** | `^7.37.5` | — | Uses removed `context.getFilename()`. Track jsx-eslint/eslint-plugin-react#3979 |
| 7g | **`eslint-plugin-import`** | `^2.32.0` | — | Peer deps allow only `^9` |
| 7h | **`eslint-plugin-jsx-a11y`** | `^6.10.2` | — | Peer deps allow only `^9` |

### 8. Font Awesome 4 CDN -> react-icons (medium — 5 icons, 3 files)

- **CDN**: Font Awesome 4.7.0 (2016, EOL) loaded in `index.html:5-7`
- **5 icons used**:
  - `fa fa-info-circle` — `src/components/WelcomeVariantsControl.tsx`
  - `fa fa-list` — `src/components/Toolbar/index.js`
  - `fa fa-pencil` — `src/components/Toolbar/index.js`
  - `fa fa-check-square` — `src/components/Toolbar/index.js`
  - `fa fa-clone` — `src/components/Chat/Chat.js`
- **Action**: Replace with `react-icons/fa` equivalents, remove CDN link, check Toolbar CSS for FA styles

### 9. Firebase v7 -> Remove or v12 (LARGE)

- **Current**: `firebase@^7.24.0` — resolves to `7.24.0` — **5 major versions behind** (latest `12.10.0`)
- **Usage**: 1 direct import (`src/store/firebase.js`), legacy namespaced API
- **Decision**: If PostgreSQL + Socket.IO fully replaces Firebase Realtime Database, **remove entirely**. Otherwise migrate to modular SDK (tree-shakeable, much smaller bundle).

### 10. Server Build Step — Replace ts-node in Production (LARGE)

- **Dockerfile** (`Dockerfile:26`): `CMD ["npx", "ts-node", ...]` — compiles TS at runtime
- **Prod scripts** (`package.json:124-125`): `ts-node` + fragile `while true; do ... || true; done` restart loop + `env $(cat .env.prod | xargs)` that breaks on special characters
- **Action**:
  1. Add `build:server` script (compile to JS with `tsc`)
  2. Update Dockerfile: `CMD ["node", "dist/server.js"]`
  3. Replace restart loop with process manager or `dotenv-cli`
  4. Move `typescript` and `ts-node` to devDependencies

### 11. Rename 97 `.js` files with JSX to `.jsx` (LARGE)

- Both `vite.config.ts` and `vitest.config.ts` have a custom `treat-js-as-jsx` plugin (CRA legacy)
- 97 `.js` files in `src/` contain JSX, 0 `.jsx` files exist
- **Action**: Rename to `.jsx` (or `.tsx` during TS migration), remove custom plugin from both configs

### 12. Lodash Migration (ONGOING — 52 files)

- `lodash@^4.17.23` used across 43 files in `src/`, 9 in `server/`
- Many have native equivalents (`_.get` -> optional chaining, `_.isEmpty`, `_.flatten`, etc.)
- Already split into its own vendor chunk
- **Action**: Gradual migration. Not urgent but reduces bundle size.

---

## Infrastructure & Config Notes

| Item | File | Current | Note |
|---|---|---|---|
| **`.npmrc` hoisted mode** | `.npmrc:1` | `node-linker=hoisted` | Legacy compat mode. Consider migrating to pnpm default isolated mode |
| **`prettier.config.js` format** | `prettier.config.js` | CommonJS `module.exports` | Could migrate to ESM to match eslint/stylelint configs |
| **pnpm `esbuild` override** | `package.json:54` | `"^0.25.12"` | Must update if esbuild bumped (item 4h) |
| **pnpm `serialize-javascript` override** | `package.json:55` | `"^7.0.3"` | Security patch for transitive dep. Review periodically |
| **pnpm `diff` override** | `package.json:56` | `"^5.2.0"` | Security patch. Review periodically |
| **CI: no E2E test job** | `.github/workflows/ci.yml` | — | Playwright tests exist but aren't in CI. Consider chromium-only job |
| **CI: 8 parallel installs** | `.github/workflows/ci.yml` | Each job runs `pnpm install` | pnpm store cached but linking still takes time |
| **Firebase API keys in source** | `src/store/firebase.js:9-25` | Hardcoded | Client keys are public by design, but env vars are best practice |
| **`@types/node` at `^22`** | `package.json:79` | `22.19.13` (latest `25.3.3`) | Fine — matches Node 22 engine. Bump when moving to Node 24 |
| **`passport-local@1.0.0`** | `package.json:32` | Released 2014 | No newer version exists. Works fine, just unmaintained |
