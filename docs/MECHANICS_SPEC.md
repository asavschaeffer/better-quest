# Mechanics Spec (Mobile-first)

This document captures **how mechanics work today** in the Expo app (`mobile/`). It’s meant to be reviewed and then evolved into the “intended design” spec.

## Scope

- Quest model fields + allocation constraints
- Session → EXP pipeline (base EXP, bonuses, fatigue damping)
- Fatigue budgeting + damping curve
- Chart scaling + rounding rules

## Entities (current behavior)

### Stand stats / axes

- Axes (7): `STR, DEX, STA, INT, SPI, CRE, VIT` (`mobile/core/models.js`).

### Avatar

- Fields: `level`, `totalExp`, `standExp` (per-axis cumulative EXP).

### Quest (template)

Quest creation/validation is in `mobile/core/models.js:createQuest`.

- **Required**: `id`, `label`
- **Optional**: `description`, `keywords`, `action`, `defaultDurationMinutes`, `stats`
- **Duration clamp**: `defaultDurationMinutes` is clamped to `1..240` (integer).
- **Stats allocation constraints**:
  - Per-stat cap: `0..3`
  - **No total cap** (total points may exceed 4)
- **Action**: `{ type: "url"|"app"|"file", value: string }` (validated; `url` auto-adds `https://`).

### Session

Created via `mobile/core/models.js:createTaskSession`.

- Required: `id`, `description`, `durationMinutes`
- Optional: `standStats` (chart values), `questKey`, `isBreak`, `comboBonus`, `restBonus`, `bonusMultiplier`

## Session → EXP pipeline (current behavior)

### 1) Base EXP

File: `mobile/core/exp.js`

- **EXP rate**: `EXP_PER_MINUTE = 10`
- **Duration clamp**: `durationMinutes` clamped to `1..240` (integer)
- **Base total EXP**:
  - `totalExp = durationMinutes * 10`

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

### 4) Apply fatigue damping (daily budgets)

File: `mobile/core/sessions.js:applyFatigueDamping` + `mobile/core/fatigue.js`

- Compute “spent today” per axis from completed sessions.
- Compute per-axis budget using:
  - **Chart stat points** derived from avatar stand EXP (`playerStatsToChartValues` → `chartValueToPoints`)
  - **Mandala streak** (max quest streak)
  - **Aggregate consistency** (blend of last 7 / last 30 active days)
  - **Level factor** (0 at level 1 → 1 at level 30+)
- Apply damping per axis:
  - `mult = dampingMultiplier({ spent: spentToday + gain, budget, floor: 0.4 })`
  - `adjustedStand[axis] = round(gain * mult)`
- Final `totalExp` after damping:
  - `totalExp = round(sum(adjustedStand))`

This is the step where `totalExp` is explicitly “made consistent” with the standExp sum.

## Fatigue budgeting + damping

### Chart stat points for budgets

File: `mobile/core/fatigue.js:chartValueToPoints`

- Input chart value expected ~`1..5`
- Maps to quest-like “points” `1..3`, minimum 1:
  - `scaled = ((clamped - 1) / 4) * 3`
  - `points = max(1, round(scaled))`

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

## Open questions / knobs (for “vision” spec)

- Should total EXP always equal sum of per-axis EXP at every step?
- Should `standStats` be treated as 1..6 (E..S) everywhere, or 1..5 in some places?
- Are budgets and damping per-axis, or should they consider total effort across axes?
- Bonus stacking: do we want multiplicative, additive, capped, or “best-of”?
- Quest model: should we continue using `{stats: 0..3, sum<=4}` or move to a different distribution model?
