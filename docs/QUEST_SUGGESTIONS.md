# Quest Suggestion System - Design Document

> Shared vocabulary: see `docs/PRIMITIVES.md` for the canonical primitives and how screens compose from them.

## The Problem

The current quest system has two competing failures:
1. **Overly specific quests** - "Drink kefir", "10mg creatine" - too granular to be reusable
2. **Not general enough** - No umbrella concept that groups related activities

We want **general quests** with **context-aware suggestions**. The user picks "Biohacking", and the app whispers *what* to do based on time, stats, streaks, and history.

---

## Core Model

```
┌─────────────────────────────────────────────────────────────┐
│  QUEST (General)                                            │
│  ~3 per stat = ~21 total                                    │
│  e.g., "Biohacking" (VIT), "Deep Work" (INT), "Train" (STR) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  SUGGESTIONS (Contextual)                                   │
│  Attached to quests, surfaced by algorithm                  │
│  e.g., "Drink kefir" (morning), "Take creatine" (afternoon) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  RANKING ALGORITHM                                          │
│  Scores quests + suggestions based on all available signals │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** Users log sessions against *quests*, not suggestions. Suggestions are ephemeral guidance that helps them know what to do right now.

---

## Available Data Sources

### 1. Time-Based Signals

| Signal | Source | Current Implementation |
|--------|--------|----------------------|
| **Current hour** | `new Date()` | Available |
| **Day of week** | `new Date().getDay()` | Available |
| **Brahma Muhurta window** | 96-48 min before sunrise | `isWithinBrahmaWindow()` in models.js |
| **Sunrise time** | User-configured | `sunriseTimeLocal` in settings |

**Use cases:**
- Morning (6-10am): Suggest VIT quests (hydration, supplements, light movement)
- Brahma window: Boost SPI suggestions (meditation, prayer, journaling)
- Evening (6-10pm): Suggest recovery, reflection, social
- Weekend vs weekday: Different quest priorities

---

### 2. Budget & Stat Signals

| Signal | Source | Current Implementation |
|--------|--------|----------------------|
| **Daily budget per stat** | Computed from lifetime EXP + streaks + consistency | `computeDailyBudgets()` in models.js |
| **Spent today per stat** | Sum of today's session gains | `computeTodayStandExp()` |
| **Remaining budget** | `budget[stat] - spent[stat]` | Used in `suggestQuests()` |
| **Lifetime EXP per stat** | `avatar.standExp` | Available |
| **Neglected stats** | Stats below average lifetime EXP | Derivable |
| **Fatigue damping** | Exponential decay past budget | `dampingMultiplier` in models.js |

**Budget formula:**
```javascript
// Budget points per stat: 1-3 based on lifetime EXP thresholds
// Tier 1: < 600 EXP (< 10 hours)
// Tier 2: 600-2400 EXP (10-40 hours)
// Tier 3: > 2400 EXP (> 40 hours)

baseBudget = statPoints * 120  // EXP per day

// Multiplier grows with streaks, consistency, and level
multiplier = 1 + 0.7 * streakFactor + 0.3 * levelFactor

finalBudget = baseBudget * multiplier
```

**Use cases:**
- High remaining budget → Prioritize that stat's quests
- Over budget (fatigued) → Suggest different stats
- Neglected stat → Surface quests to balance growth

---

### 3. Streak Signals

| Signal | Source | Current Implementation |
|--------|--------|----------------------|
| **Global daily streak** | Consecutive days with sessions | `computeStreakDays()` |
| **Per-quest mandala streak** | Consecutive days doing same quest | `questStreaks` object |
| **Max mandala streak** | Highest individual quest streak | `getMaxMandalaStreak()` |
| **Streak at risk** | Quest done yesterday but not today | Derivable |

**Streak bonuses:**
- Global streak ≥ 2 days: +20% EXP
- Mandala streak: +10% per day, capped at +100% (11+ days)

**Use cases:**
- Streak at risk → Surface that quest prominently ("Keep your 5-day meditation streak!")
- Long streak → Celebrate but also suggest variety
- No streaks → Encourage starting one

---

### 4. Energy & Readiness Signals

| Signal | Source | Current Implementation |
|--------|--------|----------------------|
| **Rest bonus available** | 45-min window after taking break | `wellRestedUntil` timestamp |
| **Combo available** | Immediately after completing session | `comboFromSessionId` |
| **Recent session intensity** | Duration + stat allocation of last session | Session history |

**Bonus values:**
- Rest bonus: 1.1x EXP
- Combo bonus: 1.2x EXP
- Stacked: 1.32x EXP

**Use cases:**
- Rested → Suggest harder/longer quests
- Combo available → Encourage continuing (don't lose the multiplier)
- Just finished intense session → Suggest lighter quest or break

---

### 5. Historical Pattern Signals

| Signal | Source | Current Implementation |
|--------|--------|----------------------|
| **Session timestamps** | `completedAt` on each session | Stored in history |
| **Quest frequency** | Count of sessions per `questKey` | Derivable |
| **Time-of-day patterns** | When user typically does each quest | Derivable |
| **Day-of-week patterns** | Weekend vs weekday preferences | Derivable |
| **Average session duration** | Per quest or overall | Derivable |
| **Completion rate** | Finished vs cancelled sessions | Derivable |

**Use cases:**
- "You usually run at 7am" → Suggest running in morning
- "You haven't meditated in 5 days" → Surface meditation
- "You always do 25-min sessions for reading" → Pre-fill duration

---

### 6. User Intent Signals

| Signal | Source | Current Implementation |
|--------|--------|----------------------|
| **Chart selection** | Radar chart allocation (0-2 per stat) | `selectedAllocation` in QuestSetupScreen |
| **Search query** | Text typed in quest picker | `query` in suggestQuests() |
| **Motivation text** | User-set mantra/goal | `motivation` in settings |
| **Saved quests** | Favorited quest IDs | `savedQuestIds` array |

**Use cases:**
- User drags INT high on chart → Prioritize INT quests
- User searches "read" → Boost reading-related suggestions
- Saved quests → Show these first in picker

---

### 7. Level & Progression Signals

| Signal | Source | Current Implementation |
|--------|--------|----------------------|
| **Current level** | 1-999, asymptotic curve | `avatar.level` |
| **Title/rank** | Novice → Legendary Hero | `getPlayerTitle()` |
| **EXP to next level** | Distance to next milestone | Derivable |
| **Consistency ratio** | Active days / total days | `computeAggregateConsistency()` |

**Thresholds:**
- Level 1-4: Novice
- Level 5-9: Apprentice
- Level 10-19: Adventurer
- Level 20-29: Veteran
- Level 30-39: Expert
- Level 40-49: Master
- Level 50+: Legendary Hero

**Use cases:**
- Low level (Novice) → Suggest broad exploration, shorter sessions
- High level (Master+) → Suggest specialization, longer sessions
- Close to level-up → "15 more EXP to Level 5!"

---

## Suggestion Ranking Algorithm

### Current Implementation (suggestQuests in quests.js)

```javascript
// Weight calculation per stat
needWeight = 0.7 * fractionRemaining + 0.3 * absoluteRemaining
chartWeight = selectedAllocation[stat] / 2  // 0-1 scale
finalStatWeight = 0.5 * needWeight + 0.5 * chartWeight

// Quest score
score = sum(finalStatWeight[stat] * questAllocation[stat])

// Text matching (secondary)
textScore = exactMatch ? 3 : wordBoundary ? 2 : substring ? 1 : 0
finalScore = score + 0.5 * textScore

// Return top 7 (Miller's Law)
```

### Proposed Enhanced Algorithm

```javascript
function scoreQuest(quest, context) {
  const {
    currentHour,
    dayOfWeek,
    isBrahmaWindow,
    budgets,
    spentToday,
    questStreaks,
    isRested,
    hasCombo,
    historicalPatterns,
    chartSelection,
    query,
    level
  } = context

  let score = 0

  // 1. Budget need (what stats need attention today)
  const budgetScore = computeBudgetScore(quest, budgets, spentToday)
  score += budgetScore * WEIGHT_BUDGET  // ~0.3

  // 2. Time-of-day fit
  const timeScore = computeTimeScore(quest, currentHour, isBrahmaWindow)
  score += timeScore * WEIGHT_TIME  // ~0.2

  // 3. Streak maintenance
  const streakScore = computeStreakScore(quest, questStreaks)
  score += streakScore * WEIGHT_STREAK  // ~0.2

  // 4. Historical pattern match
  const patternScore = computePatternScore(quest, currentHour, dayOfWeek, historicalPatterns)
  score += patternScore * WEIGHT_PATTERN  // ~0.15

  // 5. User intent (chart + search)
  const intentScore = computeIntentScore(quest, chartSelection, query)
  score += intentScore * WEIGHT_INTENT  // ~0.15

  // Bonus modifiers
  if (isRested && quest.difficulty === 'hard') score *= 1.1
  if (hasCombo) score *= 1.05  // Slight boost to keep momentum

  return score
}
```

### Weight Tuning Philosophy

The weights should reflect **what matters most** for a good suggestion:

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Budget need | 0.30 | Core game mechanic - balance stat growth |
| Time-of-day | 0.20 | Strong contextual relevance |
| Streak risk | 0.20 | High emotional stakes (don't break streak) |
| Historical patterns | 0.15 | Personalization based on behavior |
| User intent | 0.15 | Respect explicit preferences |

---

## Suggestion Data Structure

### Quest with Suggestions

```javascript
{
  id: "biohacking",
  label: "Biohacking",
  stats: { VIT: 2, INT: 1 },
  suggestions: [
    {
      text: "Drink kefir or kombucha",
      context: {
        timeWindow: [7, 10],  // 7am-10am
        frequency: "daily",
        notes: "Probiotics best on empty stomach"
      }
    },
    {
      text: "Take 10mg creatine",
      context: {
        timeWindow: [14, 18],  // 2pm-6pm
        frequency: "daily",
        notes: "With carbs for better absorption"
      }
    },
    {
      text: "Cold shower or ice bath",
      context: {
        minStreak: 7,  // Only suggest after 7-day streak
        notes: "Progressive exposure"
      }
    },
    {
      text: "Check HRV and log",
      context: {
        dayOfWeek: [1, 4],  // Monday, Thursday
        notes: "Consistency in measurement timing"
      }
    }
  ]
}
```

### Context Matching for Suggestions

```javascript
function matchesSuggestionContext(suggestion, context) {
  const { timeWindow, dayOfWeek, minStreak, minLevel, frequency } = suggestion.context
  const { currentHour, currentDay, questStreak, level, lastDone } = context

  if (timeWindow && (currentHour < timeWindow[0] || currentHour > timeWindow[1])) {
    return false
  }

  if (dayOfWeek && !dayOfWeek.includes(currentDay)) {
    return false
  }

  if (minStreak && questStreak < minStreak) {
    return false
  }

  if (minLevel && level < minLevel) {
    return false
  }

  if (frequency === 'daily' && alreadyDoneToday(lastDone)) {
    return false  // Don't suggest twice
  }

  return true
}
```

---

## The 21 Core Quests (Draft)

### STR (Strength) - Force, mental toughness, hard tasks
1. **Train** - Weightlifting, resistance, intensity
2. **Grind** - Difficult work requiring willpower
3. **Compete** - Sports, games, direct competition

### DEX (Dexterity) - Fine motor, expertise, precision
1. **Craft** - Making things with hands
2. **Practice** - Deliberate skill repetition
3. **Perform** - Music, art, presentation execution

### STA (Stamina) - Sustained effort, endurance
1. **Cardio** - Running, cycling, swimming
2. **Focus** - Long deep work sessions
3. **Maintain** - Cleaning, organizing, upkeep

### INT (Intelligence) - Thinking hard, learning
1. **Study** - Formal learning, courses
2. **Research** - Investigation, problem-solving
3. **Build** - Coding, engineering, construction

### SPI (Spirit) - Non-thinking, feeling, reflection
1. **Meditate** - Stillness, breathwork
2. **Reflect** - Journaling, contemplation
3. **Pray** - Spiritual practice, devotion

### CHA (Charisma) - Social, interpersonal
1. **Connect** - Quality time with people
2. **Network** - Professional relationship building
3. **Lead** - Teaching, mentoring, presenting

### VIT (Vitality) - Health, biohacking, recovery
1. **Recover** - Sleep, rest, massage
2. **Nourish** - Cooking, meal prep, supplements
3. **Biohack** - Cold exposure, tracking, optimization

---

## UX Flow

### Pick Your Quest (Simplified)

```
┌────────────────────────────────────────┐
│  What do you want to work on?          │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 🔥 Train (STR)                   │  │
│  │    "Legs day - squats, lunges"   │  │◄── Top suggestion in context
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 🧘 Meditate (SPI)                │  │
│  │    "Keep your 5-day streak!"     │  │◄── Streak at risk
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 💊 Biohack (VIT)                 │  │
│  │    "10mg creatine with lunch"    │  │◄── Time-based suggestion
│  └──────────────────────────────────┘  │
│                                        │
│  [See all quests...]                   │
└────────────────────────────────────────┘
```

### Quest Detail (After Selection)

```
┌────────────────────────────────────────┐
│  Biohack                          30m  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                        │
│  Right now, try:                       │
│  • Take 10mg creatine with carbs       │
│  • Check and log HRV                   │
│                                        │
│  [Start Quest]                         │
└────────────────────────────────────────┘
```

---

## App Surfaces & Separation of Concerns

> See `docs/PRIMITIVES.md` for the canonical primitives and `docs/NAVIGATION.md` for the full navigation structure.

### Bottom Tab Bar

```
[ Library ]  [ Home ]  [ Feed ]  [ Ranks ]
```

| Tab | Question | Primitives Used |
|-----|----------|-----------------|
| **Library** | "What quests exist?" | QuestRow list, Filter/Sort controls |
| **Home** | "Welcome back" | Dashboard, Quick start CTA |
| **Feed** | "What's happening?" | Feed(scope: me/following/all) |
| **Ranks** | "Who's winning?" | Leaderboard(metric: level/stat/quest) |

### Feed Sub-tabs

Feed is a single **Feed primitive** with different scopes:

| Sub-tab | Scope | Old Name |
|---------|-------|----------|
| **You** | `scope: me` | History |
| **Friends** | `scope: following` | (new) |
| **All** | `scope: all` | Global Feed |

### Flows (Modals)

| Flow | Trigger | Primitives |
|------|---------|------------|
| **Picker** | "Start Quest" from anywhere | StatChart, Search, QuestCard |
| **Session** | After picking quest | Timer, Allocation viz |
| **Complete** | After session ends | EXP breakdown, Notes, Bonuses |

### Detail Screens (Push navigation)

| Screen | Reached from | Primitives |
|--------|--------------|------------|
| **Quest Profile** | Library, Feed, Picker, Leaderboard | Quest details, Suggestions, Materials, embedded Feed + Leaderboard |
| **User Profile** | Feed, Leaderboard | PublicProfile, StatChart, Top quests, embedded Feed + Leaderboard |
| **Session Detail** | Feed (You tab) | Session data, Notes editor, Bonuses |

### Header (Top Right)

```
[ 🔔 Notifications ]  [ 👤 Profile ]  [ ⚙️ Settings ]
```

---

### Key Distinctions

**Picker vs Library:**
- **Picker** = Algorithm suggests + user steers (text search, stat chart) → modal flow
- **Library** = User browses all 21 quests freely → tab
- Both lead to starting a quest, but intent differs (quick-start vs explore)

**Feed scopes (unified primitive):**
- **You** = YOUR sessions, YOUR patterns (reflection mode)
- **Friends** = People you follow (social proof)
- **All** = EVERYONE's sessions (discovery mode)

**Quest Profile vs Session Detail:**
- **Quest Profile** = The quest itself (suggestions, materials, community)
- **Session Detail** = One specific session you did (notes, stats gained, timestamp)

---

## Library Design

The Library is a **list of all 21 quests** that leads to **Quest Profiles**. It's for exploration and curation, not quick-start.

### Library List View

```
┌─────────────────────────────────────────────────────────────┐
│  Library                                    [Filter] [Sort] │
├─────────────────────────────────────────────────────────────┤
│  STR  DEX  STA  INT  SPI  CHA  VIT          ← stat filter   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💪 Train                                    12 day streak  │
│  STR 2 • STA 1                               18.5 hrs total │
│                                                             │
│  💊 Biohack                                   3 day streak  │
│  VIT 2 • INT 1                                4.2 hrs total │
│                                                             │
│  🧘 Meditate                                      ⚠️ at risk │
│  SPI 2 • VIT 1                               22.1 hrs total │
│                                                             │
│  📚 Study                                          — new —  │
│  INT 2 • DEX 1                              #12 most popular│
│                                                             │
│  🎯 Focus                                                   │
│  STA 2 • INT 1                                8.3 hrs total │
│                                                             │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Library Row States

Each quest row shows contextual metadata:

| State | Display | Meaning |
|-------|---------|---------|
| Active streak | "12 day streak" | You're on a roll |
| Streak at risk | "⚠️ at risk" | Did yesterday, not today |
| Never done | "— new —" | Haven't tried this quest |
| No streak | "4.2 hrs total" | Lifetime hours logged |

### Sort Options

- **Your activity** - Most used first (default)
- **Streak status** - At-risk first, then active streaks
- **Popularity** - Global usage across all users
- **Alphabetical** - A-Z by quest name

### Filter Options

- **By stat** - Tap stat chips to filter (STR, DEX, etc.)
- **Your quests only** - Hide quests you've never done
- **With streaks** - Only show quests with active streaks

---

## Quest Profile Design

The Quest Profile is the **detail page** for a single quest. It combines personal stats, curation tools, and community data.

### Entry Points

You can reach a Quest Profile from anywhere:
- **Library** → Tap quest row
- **Picker** → Tap quest card (or "more info" action)
- **Personal History** → Tap any past session
- **Global Feed** → Tap quest in activity item
- **Leaderboard** → Tap quest on user's profile

### Quest Profile Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                                      [Start Quest]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💊 Biohack                                                 │
│  VIT ██████░░ 2   INT ███░░░░░ 1                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  YOUR STATS                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ 12 day  │ │ 18.5 hr │ │ 47      │ │ 2 days  │           │
│  │ streak  │ │ total   │ │ sessions│ │ ago     │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  SUGGESTIONS                              [+ Add your own]  │
│                                                             │
│  ☀️ Morning (7-10am)                                        │
│  • Drink kefir or kombucha                                  │
│  • Morning sunlight (10 min)                                │
│                                                             │
│  🌤️ Afternoon (2-6pm)                                       │
│  • 10mg creatine with carbs                                 │
│  • Check HRV                                                │
│                                                             │
│  🌙 Evening                                                 │
│  • Blue light glasses on                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  MATERIALS                                  [+ Add link]    │
│                                                             │
│  📎 Huberman Lab - Sleep Toolkit                           │
│  📎 Examine.com - Creatine                                  │
│  📝 My supplement stack notes                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  COMMUNITY                                                  │
│                                                             │
│  🏆 #47 most popular quest (1.2k users)                     │
│                                                             │
│  Top users                          Trending suggestions    │
│  ┌──────────────────────┐          ┌─────────────────────┐ │
│  │ @dave    892 hrs     │          │ "Grounding/earthing"│ │
│  │ @sarah   445 hrs     │          │ "AG1 greens"        │ │
│  │ @mike    312 hrs     │          │ "Red light therapy" │ │
│  └──────────────────────┘          └─────────────────────┘ │
│                                                             │
│  Recent activity                                            │
│  • @emma completed 45m session (3 min ago)                  │
│  • @john added suggestion "Nasal breathing"                 │
│  • @lisa hit 30-day streak 🔥                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Quest Profile Sections

#### 1. Header
- Quest name and icon
- Stat allocation visualization
- Primary action: [Start Quest]

#### 2. Your Stats
Personal metrics for this quest:
- **Streak** - Current consecutive days
- **Total hours** - Lifetime time logged
- **Sessions** - Total session count
- **Last done** - Days since last session

#### 3. Suggestions
Context-aware suggestions grouped by time/condition:
- **Morning/Afternoon/Evening** - Time-based grouping
- **[+ Add your own]** - User can contribute suggestions
- Shows which suggestions are from you vs. curated vs. community

#### 4. Materials
Resources attached to this quest:
- **Links** - URLs to articles, videos, tools
- **Notes** - Personal text notes
- **[+ Add link]** - User can attach resources

#### 5. Community
Social layer for this quest:
- **Popularity rank** - Where this quest ranks globally
- **Top users** - Leaderboard for this specific quest
- **Trending suggestions** - Popular suggestions from community
- **Recent activity** - Live feed of sessions/milestones

### Quest Profile Actions

| Action | Description |
|--------|-------------|
| **Start Quest** | Begin a session with this quest |
| **Add Suggestion** | Contribute a new suggestion |
| **Add Material** | Attach a link or note |
| **Pin/Unpin** | Control visibility in Picker |
| **Hide** | Remove from your Library (can unhide later) |

---

## Picker Design (Revised)

The Picker is **algorithm-assisted but user-steerable**. It's not purely automatic - the user can influence suggestions via text and stat chart.

### Picker Layout

```
┌─────────────────────────────────────────────────────────────┐
│  What do you want to work on?                               │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔍 Search quests...                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│        ┌─────────────────────┐                              │
│        │    Stat Chart       │  ← drag to steer             │
│        │   (radar/sliders)   │                              │
│        └─────────────────────┘                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  SUGGESTED FOR YOU                                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 💪 Train                                  STR 2 STA 1 │  │
│  │ "Legs day - squats, lunges"                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🧘 Meditate                               SPI 2 VIT 1 │  │
│  │ "Keep your 5-day streak!"                    ⚠️ risk  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 💊 Biohack                                VIT 2 INT 1 │  │
│  │ "10mg creatine with lunch"                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [See all in Library...]                                    │
└─────────────────────────────────────────────────────────────┘
```

### How Steering Works

1. **Text search** - User types "read" → algorithm boosts reading-related quests
2. **Stat chart** - User drags INT high → algorithm boosts INT quests
3. **Combined** - Both inputs weighted into the ranking algorithm
4. **Default** - If no input, pure algorithm based on budget, time, streaks

### Picker vs Library

| Aspect | Picker | Library |
|--------|--------|---------|
| Shows | Top 3-5 ranked quests | All 21 quests |
| User input | Text + stat chart steering | Filter + sort |
| Intent | "Quick, tell me what to do" | "Let me browse" |
| Leads to | Session directly | Quest Profile first |

---

## Feed Design (Unified)

Feed is a single primitive with different scopes. The "You" tab is your personal history, "Friends" shows people you follow, "All" is global discovery.

### Feed Layout (You tab = History)

```
┌─────────────────────────────────────────────────────────────┐
│  Feed                             [You ●] [Friends] [All]   │
├─────────────────────────────────────────────────────────────┤
│                                   [Day] [Week] [Mo]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TODAY                                          3 sessions  │
│  ───────────────────────────────────────────────────────────│
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 💪 Train                              45m    2:30 PM  │  │
│  │ STR +38  STA +19                           "leg day"  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 📚 Study                              30m   10:15 AM  │  │
│  │ INT +24  DEX +12                      "calculus ch.4" │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🧘 Meditate                           15m    6:45 AM  │  │
│  │ SPI +18  VIT +9                  ☀️ Brahma bonus 2x   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  YESTERDAY                                      2 sessions  │
│  ───────────────────────────────────────────────────────────│
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 💊 Biohack                            20m    7:30 AM  │  │
│  │ VIT +16  INT +8                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ...                                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  THIS WEEK                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ 12      │ │ 8.5 hr  │ │ 🔥 5 day│ │ Train   │           │
│  │ sessions│ │ focused │ │ streak  │ │ favorite│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### History Data

Each session row shows:
- **Quest** - Icon + name
- **Duration** - How long
- **Time** - When you did it
- **Stats gained** - EXP breakdown
- **Notes** - Your session notes (if any)
- **Bonuses** - Brahma, combo, rest, streak indicators

### History Views

| View | Shows | Use case |
|------|-------|----------|
| **Day** | Today's sessions, grouped by hour | "What did I do today?" |
| **Week** | Last 7 days, grouped by day | "What's my week looking like?" |
| **Month** | Last 30 days, summary + drill-down | "Monthly patterns" |

### History Actions

- **Tap session** → Session Detail (full breakdown, edit notes)
- **Tap quest icon** → Quest Profile (deep dive on that quest)
- **Swipe session** → Quick actions (repeat, delete)

### Session Detail (Sub-screen)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💪 Train                                                   │
│  December 28, 2024 at 2:30 PM                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  DURATION                                                   │
│  45 minutes                                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  STATS GAINED                                               │
│  STR  ████████████████░░░░  +38 EXP                        │
│  STA  ████████░░░░░░░░░░░░  +19 EXP                        │
│  ─────────────────────────────────                          │
│  Total: +57 EXP                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  BONUSES                                                    │
│  🔥 5-day streak (+50%)                                     │
│  ⚡ Combo bonus (+20%)                                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  NOTES                                            [Edit]    │
│  "Leg day - squats 5x5, lunges, leg press.                 │
│   Felt strong, increased weight on squats."                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Repeat This Quest]              [Go to Quest Profile →]  │
└─────────────────────────────────────────────────────────────┘
```

---

### Feed Layout (All tab = Global)

The All tab is **everyone's activity** - a real-time stream of sessions completed worldwide. Discovery, social proof, and inspiration.

```
┌─────────────────────────────────────────────────────────────┐
│  Feed                              [You] [Friends] [All ●]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LIVE                                                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 👤 @emma completed 💪 Train                    just now│  │
│  │    45m session • STR +42                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 👤 @dave completed 🧘 Meditate                   2m ago│  │
│  │    30m session • SPI +28 • ☀️ Brahma 2x               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🎉 @lisa hit 30-day streak on 📚 Study!          5m ago│  │
│  │    "One month of consistent learning!"                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 👤 @mike completed 💊 Biohack                   8m ago │  │
│  │    20m session • VIT +18                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🏆 @sarah leveled up to 25 (Veteran)!          12m ago│  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 👤 @john added suggestion to 💪 Train          15m ago │  │
│  │    "Farmer's walks for grip strength"                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Feed Event Types

| Event | Display | Tap Action |
|-------|---------|------------|
| **Session completed** | User + quest + duration + stats | → User Profile or Quest Profile |
| **Streak milestone** | User + quest + streak count | → Quest Profile |
| **Level up** | User + new level/title | → User Profile |
| **Suggestion added** | User + quest + suggestion text | → Quest Profile |
| **New user joined** | Welcome message | → User Profile |

### Feed Filters

**Scope tabs:**

| Tab | Shows |
|-----|-------|
| **You** | Your sessions only (history mode) |
| **Friends** | Users you follow |
| **All** | Everyone's activity (discovery mode) |

**Additional filters (available in all scopes):**

| Filter | Effect |
|--------|--------|
| **Quest** | Filter by specific quest (e.g., only Train activity) |
| **Stat** | Filter by stat (e.g., only STR-focused sessions) |

### Feed Actions

- **Tap user** → User Profile (their stats, quests, history)
- **Tap quest** → Quest Profile (deep dive)
- **Tap event** → Contextual (session detail, streak info, etc.)
- **Follow user** → Add to "Following" feed

### Feed Scope Comparison

| Aspect | You | Friends | All |
|--------|-----|---------|-----|
| Whose data | Yours only | Following | Everyone |
| Purpose | Reflection | Social proof | Discovery |
| Unique features | Edit notes, repeat, day/week/month views | (same as All) | Follow users |
| Detail level | Full breakdown | Summary | Summary |

---

## Leaderboard Design

The Leaderboard is **rankings and competition** - how you stack up against others.

### Leaderboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Leaderboard                     [Stats] [Quests] [Streaks] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OVERALL LEVEL                                              │
│                                                             │
│   #1  👤 @dave         Level 52 (Legendary)    12,480 EXP  │
│   #2  👤 @sarah        Level 47 (Master)       10,220 EXP  │
│   #3  👤 @mike         Level 41 (Master)        8,890 EXP  │
│   ...                                                       │
│  #47  👤 @you          Level 18 (Adventurer)    2,340 EXP  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  BY STAT                                                    │
│                                                             │
│  STR        DEX        STA        INT        SPI    ...    │
│  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐      │
│  │@dave │   │@emma │   │@lisa │   │@sarah│   │@john │      │
│  │2.4k  │   │1.8k  │   │3.1k  │   │2.9k  │   │1.5k  │      │
│  └──────┘   └──────┘   └──────┘   └──────┘   └──────┘      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  BY QUEST                        ← tap to see quest leaders │
│                                                             │
│  💪 Train     🧘 Meditate    📚 Study     💊 Biohack        │
│  @dave 892h   @john 445h     @sarah 312h  @emma 156h       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Leaderboard Tabs

| Tab | Ranks by |
|-----|----------|
| **Stats** | Total EXP per stat (STR, DEX, etc.) |
| **Quests** | Total hours per quest (Train, Study, etc.) |
| **Streaks** | Current streak length per quest |

### Leaderboard Actions

- **Tap user** → User Profile
- **Tap quest** → Quest Profile (with leaderboard for that quest)
- **Tap stat** → Stat leaderboard (expanded view)

---

## User Profile Design

A User Profile is what you see when you tap a user anywhere in the app.

### User Profile Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                                          [Follow]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👤 @dave                                                   │
│  Level 52 • Legendary Hero                                  │
│  "Consistency beats intensity"                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  STATS                                                      │
│        ┌─────────────────────┐                              │
│        │    Radar Chart      │                              │
│        │   (their stats)     │                              │
│        └─────────────────────┘                              │
│  STR 2.4k  DEX 1.2k  STA 1.8k  INT 2.1k  SPI 0.9k  ...     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  TOP QUESTS                                                 │
│                                                             │
│  💪 Train          892 hrs    156 sessions    🔥 34 streak  │
│  📚 Study          445 hrs     89 sessions    🔥 12 streak  │
│  🧘 Meditate       312 hrs    201 sessions    🔥  8 streak  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  RECENT ACTIVITY                                            │
│                                                             │
│  • Completed 💪 Train (45m)                         2h ago  │
│  • Hit 34-day streak on 💪 Train                    2h ago  │
│  • Completed 📚 Study (30m)                       yesterday │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### User Profile Sections

| Section | Shows |
|---------|-------|
| **Header** | Username, level, title, bio/motivation |
| **Stats** | Radar chart + EXP per stat |
| **Top Quests** | Their most-used quests with hours, sessions, streaks |
| **Recent Activity** | Their last few sessions/milestones |

### User Profile Actions

- **Follow/Unfollow** → Add to your Following feed
- **Tap quest** → Quest Profile
- **View full history** → Their session log (if public)

---

## Implementation Strategy

### Phase 1: Simplify Quests
- Reduce to 21 core quests (3 per stat)
- Remove overly specific built-in quests
- Keep user-created quests but encourage migration

### Phase 2: Add Suggestion Layer
- Add `suggestions` array to quest model
- Build context-matching function
- Display matched suggestions in quest picker

### Phase 3: Enhance Ranking Algorithm
- Integrate time-of-day scoring
- Add streak-at-risk detection
- Incorporate historical patterns

### Phase 4: Learn & Adapt
- Track which suggestions users act on
- Adjust weights based on completion rates
- Build user-specific preference profiles

---

## Open Questions

1. **Who creates suggestions?** Just you (curated), or can users add their own?
2. **How specific should suggestions get?** "Take creatine" vs "10mg creatine monohydrate with 30g carbs"
3. **Should suggestions have their own streaks?** Or just quest-level streaks?
4. **What if no suggestion matches?** Show quest without suggestion, or always have a fallback?
5. **How do we handle custom quests?** Users can create quests - do they also define suggestions?

---

## Appendix: Current File Locations

| Concern | File |
|---------|------|
| Quest ranking algorithm | `mobile/core/quests.js` - `suggestQuests()` |
| Budget computation | `mobile/core/models.js` - `computeDailyBudgets()` |
| Streak tracking | `mobile/core/models.js` - `computeStreakDays()`, `updateQuestStreaks()` |
| Time bonuses (Brahma) | `mobile/core/models.js` - `isWithinBrahmaWindow()` |
| Quest data model | `mobile/core/models.js` - quest structure |
| Quest storage | `mobile/core/questStorage.js` - CRUD, built-in templates |
| Quest picker UI | `mobile/screens/QuestSetupScreen.js` |
| Quest library UI | `mobile/screens/LibraryScreen.js` |
| Quest editor UI | `mobile/screens/NewQuestScreen.js` |
