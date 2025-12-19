# Improvements Plan

## TODO (mechanics)

- **Auto sunrise**: Replace manual `sunriseTimeLocal` setting with computed sunrise based on user location/timezone (with caching + offline fallback) for Brahma Muhurta.
- **Quest draft automation (YouTube-first)**: see `docs/QUEST_DRAFT_AUTOMATION.md` for the roadmap (auto cover from link, open-in-app, import/share flows).

---

## Shared-logic dedupe idea (what it is, what it isn’t)

Right now you have **two separate implementations** of similar “core logic”:

- **Web:** `src/*` (used by `index.html`)
- **Mobile:** `mobile/core/*` (used by Expo app)

They share concepts, but **not code**.

#### What “dedupe shared logic” means

Create a third shared package, e.g.:

- `packages/core/` (new workspace)
  - exports pure logic only: EXP math, stats scaling, bonuses, quest ranking, etc.
  - no DOM, no React, no AsyncStorage/localStorage, no network

Then:

- Web imports from `packages/core` instead of `src/exp.js`, `src/models.js`, etc.
- Mobile imports from `packages/core` instead of `mobile/core/*`

#### Why you’d do it

- **One source of truth** for formulas (EXP, fatigue, chart scaling, bonus rules)
- **Fewer bugs** where web and mobile diverge silently
- **Better tests**: one test suite for the shared logic, used by both apps

#### Why we haven’t done it yet (good reasons)

- It’s a **bigger migration** (touches many imports in both apps).
- You want “slow improvements”: we first needed clear boundaries and stable tests (we now have that).
- Some “core” code is currently intertwined with each app’s models/storage conventions; we’d want to unify deliberately.

#### A good “slow” migration path

- Start by moving **one small, high-value module** into `packages/core` (example: the bonus computation or EXP math).
- Update web + mobile to use it.
- Keep old copies temporarily, then delete once both apps are migrated.
- Repeat module-by-module.

### Recommended order (keeps momentum, avoids rework)

#### 1) Lock the “game rules” first (small spec + tests)

Because you _already know_ you want to change **stat distributions / quest model / multipliers**, do **not** migrate shared core yet—otherwise we’ll just migrate twice.

- **Output**: a short “mechanics spec” doc (1–2 pages) + tests that encode it.
  - Example sections: quest model fields, allocation rules, bonus/multiplier stacking order, fatigue rules, chart scaling, rounding rules.
- **Why first**: this becomes the contract for both web + mobile, and prevents UX work from being undermined by later logic churn.

#### 2) Build `packages/core` around that spec (shared logic), with adapters

Once the rules are stable enough:

- Create **`packages/core`** with _pure_ functions + types (no UI, no storage).
- Add **adapters** in each app:
  - Web keeps DOM/UI in `src/*`, but imports core rules from `packages/core`.
  - Mobile keeps React Native UI in `mobile/*`, but imports core rules from `packages/core`.

This is when dedupe pays off: every future mechanic change is “change once, ship everywhere.”

#### 3) Migrate incrementally (one module at a time)

Start with the **least UI-coupled** modules:

- EXP math + multipliers
- stat distribution helpers
- quest ranking/scoring
  Then migrate models/session shaping, then fatigue budgets, etc.

Each migration step:

- move function(s) → update both apps → keep tests green → delete old copies.

#### 4) UX improvements in two tracks

- **Track A (now): “cheap UX wins”** that won’t be invalidated by mechanics changes:
  - wording/labels, spacing, button hierarchy, error states, loading states, navigation affordances, onboarding hints.
- **Track B (after core rules stabilize): “structural UX”** tied to the new quest model/stats/multipliers:
  - new quest editor UX, new stat sliders/radar behaviors, clearer multiplier explanations, etc.

### Concrete next step I recommend

1. You tell me your top 5 mechanic changes (one sentence each).
2. I’ll turn that into `docs/MECHANICS_SPEC.md` + failing tests, then implement the rules (in the current code) until tests pass.
3. Once you like the feel, we start the `packages/core` migration.

### One question to choose the best path

“source of truth UX” to be **mobile-first** (Expo app)
