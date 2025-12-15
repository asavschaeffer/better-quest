# Architecture (slow-improve baseline)

This repo is a small monorepo with two runnable apps:

- **Web (static)**: `index.html` + `src/` (no build step)
- **Mobile (Expo)**: `mobile/` (React Native + Expo)

Both apps share the same *concepts* (sessions, quests, stand stats), but today the implementation is duplicated:

- `src/…` is the web implementation.
- `mobile/core/…` is the mobile implementation (pure logic, tested with Node’s built-in test runner).

## Goals

- Keep **UI** and **pure logic** separated.
- Keep **state + persistence** centralized and versioned.
- Prefer **small modules** over “god files”.

## Mobile structure

- **Entry**: `mobile/index.js` → `mobile/App.js`
- **App composition**: `mobile/App.js` (provider wrapper) + `mobile/app/AppShell.js` (navigation + orchestration)
- **Pure domain logic (no React / no storage)**: `mobile/core/`
- **Persistence + migrations**: `mobile/services/storage.js`
- **State container**: `mobile/state/store.js`
- **Screens/components**: `mobile/screens/`, `mobile/components/`

### “Pure core” rule of thumb

Code in `mobile/core/` should:

- Avoid React imports
- Avoid AsyncStorage/localStorage/network calls
- Be deterministic (good for tests)

## Web structure

- **Static UI**: `index.html` + `styles.css`
- **App logic**: `src/main.js`
- **Web domain logic**: `src/models.js`, `src/exp.js`, `src/timer.js`, etc.

## Where new code should go (for now)

- **New mobile game logic**: `mobile/core/…` (+ a `mobile/tests/*.test.mjs` for it)
- **New mobile UI/UX**: `mobile/screens/…` or `mobile/components/…`
- **New persistence fields**: `mobile/services/storage.js` (add migration + version bump)

## Future direction (optional)

If duplication becomes painful, we can introduce a third workspace like `packages/core/` and have both web and mobile import from it. That’s a bigger change; we’ll only do it once the boundaries above are stable.


