# Primitives (Source of Truth)

This document defines the **core primitives** of Better Quest: the smallest reusable building blocks that everything else composes from.

If two screens feel “overlapped”, it usually means they share the same primitive with different **scope**, **filters**, or **presentation**.

---

## Vocabulary rules

- **Primitive**: smallest stable unit we build and reuse (data, logic, or UI).
- **Surface**: a screen/page composed from primitives (e.g. Quest Profile).
- **Scope**: “whose data / which slice of the world” a primitive is showing.
- **Projection**: a derived view computed from primitives (e.g. leaderboard rankings derived from events).

---

## Domain primitives (data entities)

### StatAxis

The 7 Stand axes:

- `STR, DEX, STA, INT, SPI, CHA, VIT`

### Avatar (Player state)

Core player progression state:

- **Level / totalExp**
- **Stand EXP per axis** (lifetime EXP per stat)
- **Derived chart values** (presentation-only)

### Quest (Template)

A general “activity umbrella” (e.g. Train, Study, Biohack).

Key properties:

- **Identity**: `id`, `label`
- **Text**: `description`, `keywords`
- **Defaults**: `defaultDurationMinutes`
- **Stat allocation**: quest stats (constrained distribution)
- **Optional action**: deep link / URL / file pointer

Notes:

- Quests are meant to be **broad** and reusable.
- Specific “what to do right now” lives in **Suggestions**, not in quest identity.

### Session (Instance)

One performed run of doing something (usually a quest) for a duration.

Key properties:

- **When**: timestamps (created/started/completed)
- **What**: `questKey` (or equivalent linkage), `description`
- **How long**: `durationMinutes`
- **Intent snapshot**: `allocation` (authoritative distribution intent)
- **Outputs**: EXP earned per axis + totals (post-bonus, post-fatigue)
- **User reflection**: optional notes
- **Bonus metadata**: applied bonuses + breakdown

### Suggestion (Contextual prompt)

A small “next action” attached to a quest and shown conditionally (time, streak, etc.).

Key properties:

- **Text** (what to do)
- **Attribution**: curated / you / community
- **Optional targeting**: time-of-day, conditions, tags

Key contract:

- Users **log sessions against quests**, not suggestions.
- Suggestions are **ephemeral guidance**, not the tracked identity.

### Material (Quest attachment)

Personal resources attached to a quest:

- Links
- Notes
- Files (optional)

### LibraryState (Per-user quest curation)

Per-user state about quests:

- Pinned / hidden
- Forked/customized quests
- Sort + filter preferences

---

## Mechanics primitives (rules & modifiers)

### EXP Pipeline

The deterministic computation from a Session + context → earned EXP:

- **Base EXP** (duration)
- **Bonus resolution** (combo/rest/streak/time windows, etc.)
- **Fatigue damping** (daily budgets per stat)
- **Split across axes** (based on intent snapshot)
- **Rounding rules / invariants**

### Bonus (Composable modifier)

A bonus is a single rule that modifies Session rewards.

Examples:

- **Combo**
- **Well-rested**
- **Global streak**
- **Per-quest (Mandala) streak**
- **Brahma / time-window bonus**

Bonuses compose into:

- **bonusBreakdown** (explainability)
- **bonusMultiplier / resolved modifiers** (applied result)

### Streak

Streaks are tracked at two levels:

- **Global streak**: consecutive days with any session
- **Per-quest streak (Mandala)**: consecutive days doing that quest

### FatigueBudget (Per-axis daily budgets)

Per-stat daily “budget” derived from progression + consistency, used for fatigue damping:

- Budget per stat (points/tiers → daily cap-ish)
- Damping multiplier curve beyond the budget
- Adaptation factor over time (progressive overload)

---

## Social primitives (data entities)

### SocialGraph (Following)

Who you follow (and who follows you), to power “Following” scopes in social views.

### PublicProfile (User-facing identity)

The publicly visible user shape:

- Username / display name
- Title / bio (and optionally dynamic title rules)
- Privacy settings for what can be shown

---

## Derived primitives (projections)

### ActivityEvent (Stream atom)

The smallest unit of “something happened” in the social/activity universe.

Examples:

- Session completed
- Streak milestone
- Level up
- Suggestion added
- New user joined

### Feed (Event stream view)

A Feed is a rendering of ActivityEvents, ordered by time, parameterized by:

- **Scope**: `me` | `user:@id` | `quest:@id` | `all`
- **Filter**: `following` | `stat` | `quest` | event types
- **Window**: `day` | `week` | `month` | `all-time`
- **Limit**: `N`

Key insight:

- **History** is just a Feed where `scope = me` and the UI supports deeper reflection/editing.
- **User Profile → Recent Activity** is Feed with `scope = user:@id`, `limit = 5`.
- **Quest Profile → Community → Recent Activity** is Feed with `scope = quest:@id`, `limit = 5`.
- **Global Feed** is Feed with `scope = all` (optionally `following = true`).

### Leaderboard (Ranking view)

Leaderboards are **aggregations** over ActivityEvents (and/or derived user stats), parameterized by:

- **Scope**: `all` | `following` | `quest:@id` | `stat:@axis`
- **Window**: `7d` | `30d` | `all-time`
- **Metric**: level | total EXP | EXP-by-stat | hours-by-quest | streak lengths

Key insight:

- Feeds and leaderboards overlap by **input data** (events), not by structure.
  - Feed = time-ordered events
  - Leaderboard = rank-ordered aggregates

---

## UI primitives (reusable components)

These are the “atoms” we want to reuse across screens.

### StatChart

Radar chart + sliders (and/or read-only chart) that visualizes or edits stat intent.

### QuestCard / QuestRow

Consistent quest representation (icon, label, stat tags, small hint text).

### SessionRow

Consistent session representation (quest, duration, time, earned stats, notes/bonuses).

### EventRow

Consistent activity event representation (user, quest, message, timestamp).

### LeaderboardRow

Consistent ranking representation (rank, user, value, context).

---

## Surfaces (screens) as compositions

### Picker

Composes:

- StatChart (steering)
- Search input (steering)
- Ranked QuestCards (output)

### Library

Composes:

- QuestRow list (all quests)
- Filter/sort controls (user-driven)

### Quest Profile

Composes:

- Quest details + allocation visualization
- Suggestions
- Materials
- Embedded Feed (`scope = quest:@id`, limit)
- Embedded Leaderboard (`scope = quest:@id`, metric)

### Session (Timer) + Complete

Composes:

- Active timer
- Allocation/intent visualization
- Completion summary + reflection (notes)

### History

Composes:

- Feed (`scope = me`) + “reflection” affordances (edit notes, repeat, drilldown)
- Session Detail drilldown

### Global Feed

Composes:

- Feed (`scope = all` or `following`) + discovery affordances

### Leaderboard

Composes:

- Leaderboard view (metric tabs, windows) + drilldowns to user/quest profiles

### User Profile

Composes:

- PublicProfile header (bio/title)
- StatChart (read-only for other users)
- Top quests summary
- Embedded Feed (`scope = user:@id`, limit)
- Embedded Leaderboard (their ranks / comparisons)

---

## Non-primitives (avoid duplicating these)

These should not become separate “new systems” unless we explicitly choose to:

- “History vs Global Feed” (same Feed primitive, different scope + affordances)
- “Quest activity vs Global activity” (same Feed primitive, different scope)
- “Quest top users vs global rankings” (same Leaderboard primitive, different scope)

---

## Pointers to existing docs

- Mechanics (current behavior): `docs/MECHANICS_SPEC.md`
- Quest surfaces/design: `docs/QUEST_SUGGESTIONS.md`
- Navigation structure (mobile): `docs/NAVIGATION.md`


