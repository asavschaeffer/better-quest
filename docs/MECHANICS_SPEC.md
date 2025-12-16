# Mechanics Spec (Mobile-first)

This document captures **how mechanics work today** in the Expo app (`mobile/`). It’s meant to be reviewed and then evolved into the “intended design” spec.

> Note: This spec should match the shipped code in `mobile/core/*`. If you change mechanics, update this doc + `mobile/tests/*.test.mjs` together.

## Scope

- Quest model fields + allocation constraints
- Session → EXP pipeline (base EXP, bonuses, fatigue damping)
- Fatigue budgeting + damping curve
- Chart scaling + rounding rules

## Entities (current behavior)

### Stand stats / axes

- Axes (7): `STR, DEX, STA, INT, SPI, CHA, VIT` (`mobile/core/models.js`).
- Axis keys in code: `STAT_KEYS` in `mobile/core/models.js`.
  str = this is a hard thing to do
  dex = this is a thing to do that inspires expertise
  sta = this is a thing that is about quantity
  int = this involves problem solving
  spi = this cultivates gratitude and peace
  cha = this involves other people
  vit = this increases life energy

### Avatar

- Fields: `level`, `totalExp`, `standExp` (per-axis cumulative EXP).

### Quest (template)

Quest creation/validation is in `mobile/core/models.js:createQuest`.

- **Required**: `id`, `label`
- **Optional**: `description`, `keywords`, `action`, `defaultDurationMinutes`, `stats`
- **Duration clamp**: `defaultDurationMinutes` is clamped to `1..240` (integer).
- **Stats allocation constraints**:
  - Per-stat cap: `0..3`
  - **Total cap**: `sum(stats) <= 9` (enforced; throws on create/edit — no silent clamping)
- **Action**: `{ type: "url"|"app"|"file", value: string }` (validated; `url` auto-adds `https://`).

### Session

Created via `mobile/core/models.js:createTaskSession`.

- Required: `id`, `description`, `durationMinutes`
- Optional:
  - `allocation` (authoritative intent; quest stat points `0..3` per axis)
  - `standStats` (display-only chart values derived from allocation)
  - `targetStats` (display-only chart values derived from allocation + duration)
  - `questKey`, `isBreak`
  - `comboBonus`, `restBonus`
  - `bonusBreakdown` (array of applied bonus entries)
  - `bonusMultiplier` (resolved scalar multiplier applied before fatigue)
  - `endTimeMs` (timer target/end timestamp; used for time-window bonuses)

## Session → EXP pipeline (current behavior)

### 1) Base EXP

File: `mobile/core/exp.js`

- **EXP rate**: `EXP_PER_MINUTE = 1`
- **Duration clamp**: `durationMinutes` clamped to `1..240` (integer)
- **Base total EXP**:
  - `totalExp = durationMinutes * 1`

### Leveling (current behavior)

File: `mobile/core/exp.js:getTotalExpForLevel`

- **Goal**: level up quickly early, then slow down, with level asymptotically approaching 999.
- **Max level**: `999`
- **Curve (continuous, before flooring)**:
  - `levelFloat = 1 + (999 - 1) * (1 - exp(-totalExp / S))`
  - `level = floor(levelFloat)` (clamped `1..999`)
  - `S` is a tuning knob (`LEVEL_EXP_SCALE` in code; currently `22000`)
- **Inverse (exp required to reach a given level)**:
  - `requiredTotalExp(level) = ceil(-S * ln(1 - (level - 1) / (999 - 1)))`
  - `requiredTotalExp(999) = Infinity` (asymptote)

### 2) Distribute EXP across axes (using `session.allocation`)

File: `mobile/core/exp.js:splitTotalExp` (called by `calculateExpForSession`)

- **Current authoritative intent** for EXP distribution is `session.allocation` (quest stat points, `0..3` per axis).
- If `session.allocation` is missing (older sessions), the code falls back to `session.standStats` by treating it as a chart-ish value and using `weight = max(0, standStats[axis] - 1)`.
- Split is **conserved** (deterministic):
  - Compute raw fractional per-axis shares
  - Take `floor()` per axis
  - Distribute the remaining XP points to the largest fractional parts (ties broken by fixed axis order)
- Invariant: `sum(standExp) === totalExp`.

### 3) Apply session “bonusMultiplier”

File: `mobile/core/sessions.js:applySessionBonuses`

- If `bonusMultiplier === 1` → no change.
- Else:
  - `totalExp = round(base.totalExp * bonusMultiplier)`
  - `standExp` is re-split from the new total using the same intent snapshot (`session.allocation`, with fallback).
- Invariant: `sum(standExp) === totalExp`.

#### Bonus sources (current)

Bonus composition is managed in:

- `mobile/app/AppShell.js` (session-level combo/rest + streak injection)
- `mobile/core/bonuses.js` (streak rules, Brahma Muhurta, resolving mixed add/mult bonuses)

Supported bonus entries (v1):

- **Combo**: `mode: "mult"`; applies when chaining sessions via “Continue this quest”
- **Well-rested**: `mode: "mult"`; applies to the next session started within a short window after “Take a break”
- **Global streak**: `mode: "add"`; strict streak, **no bonus day 1**, `+20%` starting day 2+
- **Mandala (per-quest) streak**: `mode: "add"`; strict streak per questKey,
  - no bonus day 1
  - `+10% * (streakDays - 1)` starting day 2
  - capped at `+100%`
- **Brahma Muhurta (SPI)**: `mode: "stat_mult"`; if `allocation.SPI > 0` and session ends in the Brahma window,
  - doubles `SPI` gain
  - increases `totalExp` (no stealing)
  - preserves invariant `totalExp === sum(standExp)`

### 4) Apply fatigue damping (daily budgets)

File: `mobile/core/sessions.js:applyFatigueDamping` + `mobile/core/fatigue.js`

- Compute “spent today” per axis from completed sessions.
- Compute per-axis budget using:
  - **Stand EXP tiers** derived from avatar **raw** stand EXP (`standExpToPoints`)
  - **Mandala streak** (max quest streak)
  - **Aggregate consistency** (blend of last 7 / last 30 active days)
  - **Level factor** (0 at level 1 → 1 at level 30+)
- **Progressive overload (dead simple)**:
  - Budgets are multiplied by a per-stat factor `fatigueAdapt[stat]` (defaults to `1`).
  - That factor is updated based on how much you **actually earned today** (post-fatigue) relative to today’s budget:
    - if `spentTodayAfter / budgetToday >= upRatio` (default `0.9`): tomorrow’s factor nudges up by `upPct` (default `+20%`)
    - if `spentTodayAfter / budgetToday < downRatio` (default `0.3`): tomorrow’s factor nudges down by `downPct` (default `-10%`)
  - Important: the app applies updates to **tomorrow**, not the rest of today (day rollover swaps `fatigueAdaptNext` → `fatigueAdapt`).
- Apply damping per axis:
  - `mult = dampingMultiplier({ spent: spentToday + gain, budget, floor: 0.4 })`
  - `adjustedStand[axis] = round(gain * mult)`
- Final `totalExp` after damping:
  - `totalExp = round(sum(adjustedStand))`

This is the step where `totalExp` is explicitly “made consistent” with the standExp sum.

## Fatigue budgeting + damping

### Stand EXP tiers for budgets

File: `mobile/core/fatigue.js:standExpToPoints`

- Input: raw `avatar.standExp[stat]` (lifetime EXP in that stat; non-negative number)
- Maps to “budget points” `1..3` using fixed thresholds (no chart-derived inputs):
  - if `exp >= 2400` → 3 points
  - else if `exp >= 600` → 2 points
  - else → 1 point

### Budget multiplier

File: `mobile/core/fatigue.js:computeBudgetForStat`

- Base budget: `max(1, statPoints) * basePerPoint` (`basePerPoint = 120`)
- Multiplier:
  - `m = 1 + 0.7 * streakFactor + 0.3 * levelFactor`
  - `levelFactor = min(1, (level - 1) / 29)`
  - `streakFactor = 0.7 * mandalaScore + 0.3 * aggregateScore`
    - `mandalaScore = min(1, mandalaStreak / 21)`
    - `aggregateScore = clamp01(aggregateConsistency)`

### Damping curve

File: `mobile/core/fatigue.js:dampingMultiplier`

- If `spent <= budget` or `budget == 0` → `1`
- Else:
  - `excessRatio = (spent / budget) - 1`
  - `decay = exp(-excessRatio)`
  - `mult = floor + (1 - floor) * decay` with default `floor = 0.4`

## Chart scaling (current behavior)

### Avatar stand EXP → chart values

File: `mobile/core/stats.js:playerStatsToChartValues`

- Chart scale is **E..S = 1..6**
- Uses ratio to max axis:
  - `baseValue = 1 + (exp / maxExp) * 5`
  - If exp is non-zero and exp ≥ 50 → floor to at least `1.3`

### Quest allocation → chart values

File: `mobile/core/questStorage.js:questStatsToChartStats`

- Input quest allocation `0..3`
- Output chart value `1..6`
- If allocation is 0 → 1
- Else:
  - `value = 1 + (allocation / 3) * (1 + durationMinutes / 30)`
  - capped to `<= 6`

## Markup: change candidates / decisions for “Mechanics Spec v1 (Intended)”

Use this section to mark what you want to change next. I’ll turn your decisions into an “Intended v1” spec + failing tests, then implement until green.

## Mechanics Spec v1 (Intended) — draft (proposed contract)

This section captures the **intended rules** we’re moving toward. It may temporarily disagree with “current behavior” above; tests will encode this section and will intentionally fail until implementation catches up.

### Goals / philosophy (v1)

- **Keep the math simple and legible**: prefer small numbers and straightforward rules.
- **Support both easy and hard quests**: low-point “micro quests” (e.g. 1 point) and high-effort quests (up to 9 total points) should both feel valid.
- **Charts stay relative**: chart presentation should look “appropriate” regardless of overall level.

### EXP rate + leveling (v1)

- **Base EXP rate**: `EXP_PER_MINUTE = 1`.
- **Level curve**: asymptotic-to-999 curve (see “Leveling (current behavior)” above).
  - **[TBD]**: tune `LEVEL_EXP_SCALE` based on feel (how many sessions to reach level 10/50/100).

### Quest stat allocations (v1)

- **Per-stat cap**: keep `0..3`.
- **Total cap**: enforce a **max total allocation of 9 points** across all stats.
  - Example: `MMA sparring` might be `STR:2, DEX:3, STA:3` (total 8).
  - **Validation behavior** (v1): if `sum(stats) > 9`, quest creation/edit should fail with a clear error (no silent clamping).
- **Intensity**:
  - **[TBD]**: decide whether “intensity” is its own field or simply emerges from `(total points, duration)`.
  - For v1, we can proceed without adding an intensity field, and revisit once the feel is tested.

### Chart scaling (v1)

- **Keep relative scaling** for avatar chart values (normalize to max axis, as today).

### V1 decisions to make next (please mark your preference)

#### Stat distribution model (session → standExp weights)

Current behavior:

- Distribution weights come from `session.allocation` points, clamped `0..3` per stat.
- If all points are zero, EXP splits uniformly across 7 stats (prevents “no weights => no XP”).

V1 options:

- **Option A (keep)**: use raw points as weights (simple, transparent).
- **Option B (sharper focus)**: use squared weights \(w = p^2\) so 3-points “dominates” more.
- **Option C (tunable focus)**: \(w = \exp(k \cdot p)\) with small \(k\).

**V1 decision**: **Option A (keep)**.

#### Multiplier stacking rules (bonus breakdown → bonusMultiplier)

Current behavior (`mobile/core/bonuses.js:resolveBonusMultiplier`):

- Multiply all `"mult"` bonuses together.
- Add all `"add"` bonuses, then multiply base by `(1 + addSum)`.
- `"stat_mult"` bonuses (Brahma doubling SPI) are applied as a stat-specific post-process that increases total EXP (no stealing).

V1 questions:

- Should we **cap** the final multiplier? (e.g. `<= 2.5x`)
- Keep the current order, or apply add bonuses before mult bonuses?

**V1 decision**:

- Keep current stacking order.
- Apply a **hard cap**: `bonusMultiplier <= 3.0x` (`mobile/core/bonuses.js`).

#### Fatigue: budget basis + damping

Current behavior:

- Budgets are derived from **raw avatar stand EXP** (absolute) → `standExpToPoints(exp) → 1..3 points`.
- Per-axis damping uses `dampingMultiplier(spent + gain, budget, floor=0.4)` and rounds each stat independently.

V1 options:

- **Option A (keep)**: relative chart-derived budgets (easy, “always scales”).
- **Option B**: budgets based on **raw standExp** (absolute progression).
- **Option C**: hybrid (relative early, gradually shifts to raw at higher levels).

**V1 decision**: **Option B (raw standExp)** (already implemented).

#### Chart scaling & rounding

Current behavior:

- Avatar chart uses relative normalization to max stat: `1 + ratio*5`, with a small floor for any stat with >=50 exp.
- Quest target chart uses `1 + (allocation/3) * (1 + duration/30)` capped at 6.
- Rounding:
  - XP split uses `floor()` + remainder distribution by fractional parts.
  - Bonus totals use `round(totalExp * mult)`.
  - Fatigue rounds each axis `round(gain*mult)` and then sets `totalExp = round(sum(axis))`.

V1 question:

- Do you want **“total-first rounding”** (compute floats, round total, then re-split) to reduce edge cases, or keep the current per-step rounding?

**V1 decision**: keep current per-step rounding (deterministic + simpler).

### VNext (planned): quest stat assigner + UX overhaul

- Move quest stat allocation from “points per stat” to a **100% reserve** model (percentages sum to 100%).
- Expect associated UX overhaul in quest maker + quest selector.
- This will likely change how `session.allocation` is represented and therefore how EXP splitting weights are computed; treat as a separate vNext contract once we’re ready.

## Open questions / knobs (for “vision” spec)

- Should fatigue budgets remain chart-derived, or move to a pure “raw EXP” model (charts remain visual-only)?
- Are budgets and damping per-axis, or should they consider total effort across axes?
- Bonus stacking: do we want more bonuses to be additive vs multiplicative? Do we want caps?
- Quest categorization/sorting: keep it stat-driven only (Option A) vs add explicit tags/categories?
