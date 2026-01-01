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

These are the "atoms" we want to reuse across screens.

### STAT_ATTRS (Constants)

Canonical stat definitions. Single source of truth in `mobile/core/stats.js`:

```js
export const STAT_ATTRS = [
  { key: "STR", label: "STR", color: "#ef4444" },
  { key: "DEX", label: "DEX", color: "#f97316" },
  { key: "STA", label: "STA", color: "#eab308" },
  { key: "INT", label: "INT", color: "#3b82f6" },
  { key: "SPI", label: "SPI", color: "#a855f7" },
  { key: "CHA", label: "CHA", color: "#ec4899" },
  { key: "VIT", label: "VIT", color: "#22c55e" },
];
```

### StatBadges (Text format)

Compact text representation of stat allocation/gains. Used in list rows.

**Format:**
- Allocation 0 → (omit)
- Allocation 1 → `STR+`
- Allocation 2 → `STR++`

**Display:** `STR++ INT+ SPI+` (only non-zero stats, space-separated)

**Usage:** QuestRow, SessionRow, anywhere stats need a quick glance.

**The chart is the visualizer.** Text badges are the summary. No horizontal bar charts.

### StatChart (Radar visualization)

Layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│  RadarChartCore                                             │
│  Pure SVG renderer. Takes values array, overlays, rings.    │
│  No interaction, no domain knowledge.                       │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ PlayerStatsChart│ │ QuestStatsPicker│ │ StandClockChart     │
│ (display)       │ │ (interactive)   │ │ (session timer)     │
│ 1-6 scale       │ │ 0-2 scale       │ │ 1-6 scale, animated │
│ Read-only       │ │ Drag to allocate│ │ Drag ring to extend │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
```

**Shared utilities:**
- `DurationRing` - arc rendering with optional drag interaction
- `useRadialDrag` - gesture handling + haptic feedback hook

### ActivityRow (Unified list item)

**Replaces:** QuestRow, SessionRow, EventRow

One component with variants for different contexts:

```jsx
<ActivityRow
  variant="quest"     // "quest" | "session" | "event"
  quest={quest}       // always present
  session={session}   // for variant="session"
  event={event}       // for variant="event" (milestone, level-up, etc.)
  showStreak={true}   // quest streak badge
  showTime={true}     // "2h ago" timestamp
  showUser={false}    // "@username" for feed items
  onPress={handlePress}
/>
```

**Shared elements:**
- Quest icon + label
- StatBadges (allocation or gains)
- Duration (for sessions)
- Timestamp (for feed items)
- User attribution (for global feed)

**Used in:** Library, Feed (all scopes), Quest Profile, User Profile

### LeaderboardRow

Consistent ranking representation (rank, user, value, context).

```jsx
<LeaderboardRow
  rank={1}
  user={user}
  metric="exp"        // "exp" | "hours" | "streak"
  value={12480}
  onPress={handlePress}
/>
```

---

## Surfaces (screens) as compositions

### Picker

Composes:

- QuestStatsPicker (steering via stat chart)
- Search input (steering via text)
- Ranked ActivityRow list (`variant="quest"`)

### Library

Composes:

- ActivityRow list (`variant="quest"`, all 21 quests)
- Filter chips (by stat)
- Sort controls (activity, streak, popularity)

### Quest Profile

Composes:

- Quest header + StatChart (read-only, shows allocation)
- Suggestions list
- Materials list
- Embedded Feed (`scope = quest:@id`, limit)
- Embedded LeaderboardRow list (`scope = quest:@id`)

### Session (Timer) + Complete

Composes:

- StandClockChart (animated radar + draggable duration ring)
- Countdown display
- Completion summary + StatBadges for gains
- Notes input

### Feed (unified)

Composes:

- Scope tabs (You / Friends / All)
- ActivityRow list (`variant="session"` or `variant="event"`)
- Period filter (for "You" scope: day/week/month)

Note: "History" is just Feed with `scope = me` + reflection affordances.

### Leaderboard

Composes:

- Metric tabs (level, stats, quests, streaks)
- LeaderboardRow list
- Drilldowns to User Profile / Quest Profile

### User Profile

Composes:

- PublicProfile header (username, level, title, bio)
- StatChart (read-only, shows their stats)
- Top quests (ActivityRow list, `variant="quest"`, limit 3)
- Embedded Feed (`scope = user:@id`, limit)
- Follow action

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


