# Better Quest Data Model

This document describes the hierarchical data model used in Better Quest, including entity relationships, stat computation, and migration patterns.

## Overview

Better Quest uses a hierarchical entity model designed for:
- **Modularity**: Each entity has a single responsibility
- **Extensibility**: Easy to add new quest types, programs, or features
- **Backend-readiness**: UUID-based IDs and normalized relationships for future Supabase sync
- **Backward compatibility**: Legacy fields maintained during transition

## Entity Hierarchy

```
Profile
  └── ProgramSubscription[]
        └── DailySeries[]
              └── TodoList[]
                    └── QuestInstance[]
                          ├── Quest (template)
                          └── Subquest (specialization)
```

## Core Entities

### Profile

The top-level entity representing a user. Contains identity, settings, and privacy preferences.

```javascript
{
  id: "profile-1234-abc",
  name: "Adventurer",
  avatar: Avatar,
  programSubscriptionIds: ["sub-1", "sub-2"],
  settings: {
    quickStartMode: "picker",      // "instant" | "picker"
    pickerDefaultMode: "top",      // "top" | "blank"
    postSaveBehavior: "library",   // "library" | "picker"
    includeBuiltInQuotes: true
  },
  privacy: {
    showOnLeaderboard: true,
    showQuests: true,
    showPrograms: true
  },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
}
```

### Avatar

The player's character with accumulated stats and level progression.

```javascript
{
  id: "avatar-1234",
  name: "Adventurer",
  level: 5,
  totalExp: 1250,
  standExp: {
    STR: 200,
    DEX: 150,
    STA: 180,
    INT: 300,
    SPI: 120,
    CRE: 200,
    VIT: 100
  }
}
```

### Program

A pre-made or user-created program template available in the library. Programs define a multi-day structure with quests, milestones, and unlockables.

```javascript
{
  id: "depression-escape",
  name: "Depression Escape",
  description: "Gentle daily habits to lift mood",
  icon: "🌱",
  creatorId: null,  // null = built-in
  difficulty: "beginner",
  durationDays: 30,
  dailySeries: [DailySeriesTemplate],
  milestones: [
    { day: 7, title: "One Week Strong", reward: "badge-sprout" }
  ],
  unlockables: [
    { day: 7, questId: "yoga", description: "Unlock Yoga" }
  ],
  tags: ["mental-health", "habits"],
  metrics: { uses: 0, likes: 0, completionRate: 0 },
  isPublic: true
}
```

### ProgramSubscription

Joins a Profile to a Program with user-specific state and progress tracking.

```javascript
{
  id: "sub-1234-abc",
  profileId: "profile-1234",
  programId: "depression-escape",
  startDate: "2024-01-01T00:00:00Z",
  endDate: null,
  status: "active",  // "active" | "paused" | "completed" | "cancelled"
  completedDayIds: ["day-1", "day-2", "day-3"],
  unlockedQuestIds: ["yoga"],
  customSettings: {
    reminderTime: "09:00",
    notificationsEnabled: true
  },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-05T00:00:00Z"
}
```

### DailySeries / DailySeriesTemplate

Templates define the structure; instances track actual user progress.

**Template** (in Program):
```javascript
{
  id: "daily",
  dayNumber: 1,
  name: "Daily Routine",
  todoLists: [TodoListTemplate]
}
```

**Instance** (user's actual day):
```javascript
{
  id: "ds-1234",
  subscriptionId: "sub-1234",
  templateId: "daily",
  dayNumber: 5,
  date: "2024-01-05",
  status: "completed",
  todoListIds: ["tl-1", "tl-2"],
  completedAt: "2024-01-05T22:00:00Z"
}
```

### TodoList / TodoListTemplate

Groups of quests organized by time slot (morning, afternoon, evening).

**Template**:
```javascript
{
  id: "morning",
  name: "Morning",
  timeSlot: "morning",
  questTemplateIds: ["walking", "meditation"],
  suggestedTimes: { walking: 20, meditation: 10 }
}
```

**Instance**:
```javascript
{
  id: "tl-1234",
  dailySeriesId: "ds-1234",  // null for standalone
  profileId: "profile-1234",
  name: "Morning",
  timeSlot: "morning",
  date: "2024-01-05",
  quests: [QuestInstance],
  order: 0,
  createdAt: "2024-01-05T06:00:00Z",
  updatedAt: "2024-01-05T08:00:00Z"
}
```

### Quest

A reusable task template with stat allocations and metadata.

```javascript
{
  id: "exercise",
  label: "Exercise",
  description: "Physical activity for health and fitness",
  category: "exercise",
  defaultDurationMinutes: 30,
  baseStats: { STR: 1, DEX: 1, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
  keywords: ["exercise", "workout", "fitness"],
  action: null,  // or { type: "url", value: "https://..." }
  creatorId: null,
  sourceId: null,  // for cloned quests
  subquestIds: ["weightlifting", "running", "yoga"],
  metrics: { uses: 0, likes: 0 },
  isPublic: false
}
```

### Subquest

A specialization of a Quest that modifies stat distribution. Can use either `statDelta` (additive) or `statOverride` (replacement).

```javascript
{
  id: "weightlifting",
  parentQuestId: "exercise",
  label: "Weightlifting",
  description: "Strength training with weights",
  statDelta: { STR: 1, DEX: -1, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
  statOverride: null,  // if set, replaces computed stats entirely
  contextFields: {},
  creatorId: null,
  sourceId: null,
  isPublic: false
}
```

### QuestInstance

An actual quest within a todo list with completion state.

```javascript
{
  id: "qi-1234",
  questId: "exercise",
  subquestId: "weightlifting",  // optional
  order: 0,
  plannedDurationMinutes: 45,
  computedStats: { STR: 2, DEX: 0, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
  status: "completed",  // "pending" | "in_progress" | "completed" | "skipped"
  sessionId: "sess-1234",
  completedAt: "2024-01-05T07:30:00Z",
  notes: "Great workout!"
}
```

### Session

Record of a completed quest with awarded stats and EXP.

```javascript
{
  id: "sess-1234",
  profileId: "profile-1234",
  questInstanceId: "qi-1234",  // null for ad-hoc sessions
  description: "Weightlifting",
  durationMinutes: 45,
  startTime: "2024-01-05T06:45:00Z",
  endTime: "2024-01-05T07:30:00Z",
  allocation: { STR: 2, DEX: 0, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
  expResult: {
    total: 450,
    standExp: { STR: 225, DEX: 0, STA: 112, INT: 0, SPI: 0, CRE: 0, VIT: 113 }
  },
  questKey: "weightlifting",
  notes: null,
  bonuses: {
    comboBonus: false,
    restBonus: true,
    bonusMultiplier: 1.1
  }
}
```

## Stat System

### The Seven Stats

| Stat | Name | Description |
|------|------|-------------|
| STR | Strength | Physical power and lifting |
| DEX | Dexterity | Coordination and fine motor skills |
| STA | Stamina | Endurance and sustained effort |
| INT | Intelligence | Learning and problem-solving |
| SPI | Spirit | Mindfulness and inner peace |
| CRE | Creativity | Artistic expression and innovation |
| VIT | Vitality | Overall wellness and life balance |

### Stat Constraints

- **Per-stat maximum**: 3 points
- **Total maximum**: 4 points per quest
- **Minimum**: 0 points

### Stat Computation

When a quest has a subquest selected, stats are computed as follows:

```javascript
function computeQuestStats(baseStats, subquest) {
  // No subquest: use base stats
  if (!subquest) return { ...baseStats };

  // Override: replace entirely
  if (subquest.statOverride) return subquest.statOverride;

  // Delta: add to base (clamped)
  return STAT_KEYS.reduce((result, key) => {
    const base = baseStats[key] ?? 0;
    const delta = subquest.statDelta[key] ?? 0;
    result[key] = clamp(base + delta, 0, 3);
    return result;
  }, {});
}
```

### Example: Exercise with Subquests

**Base Quest: Exercise**
```
STR: 1, DEX: 1, STA: 1, VIT: 1  (total: 4)
```

**Subquest: Weightlifting** (statDelta: STR +1, DEX -1)
```
STR: 2, DEX: 0, STA: 1, VIT: 1  (total: 4)
```

**Subquest: Yoga** (statDelta: STR -1, SPI +1)
```
STR: 0, DEX: 1, STA: 1, SPI: 1, VIT: 1  (total: 4, capped)
```

## Entity Relationships

```
Profile (1) ─────────────────────────────────────────┐
   │                                                  │
   │ 1:N                                              │
   ▼                                                  │
ProgramSubscription (N) ─────────────────────────┐   │
   │                                              │   │
   │ N:1                                          │   │
   ▼                                              │   │
Program (1) ◄─────── catalog entry                │   │
   │                                              │   │
   │ 1:N (template)                               │   │
   ▼                                              │   │
DailySeries (N) ◄─── instances from template      │   │
   │                                              │   │
   │ 1:N                                          │   │
   ▼                                              │   │
TodoList (N)                                      │   │
   │                                              │   │
   │ 1:N                                          │   │
   ▼                                              │   │
QuestInstance (N)                                 │   │
   │                                              │   │
   │ N:1        N:1                               │   │
   ▼            ▼                                 │   │
Quest (1) ◄── Subquest (N)                       │   │
   │                                              │   │
   │ N:1                                          │   │
   ▼                                              │   │
Session (N) ────────────────────────────────────►─┴───┘
```

## Storage & Migration

### Storage Versions

| Version | Changes |
|---------|---------|
| v1 | Initial state |
| v2 | Added homeFooterConfig, quickstart preferences |
| v3 | Added userQuotes, includeBuiltInQuotes |
| v4 | Added activeProgram for starter kits |
| v5 | **Current** - Profile, ProgramSubscription, TodoLists |

### v4 → v5 Migration

The migration automatically:
1. Creates a Profile from existing user/avatar data
2. Converts `activeProgram` to `ProgramSubscription`
3. Initializes empty collections for new entities
4. Maintains legacy fields for backward compatibility

```javascript
// Legacy format (v4)
{
  user: { name, avatar },
  avatar: { ... },
  activeProgram: { kitId, startDate, completedDays: [] },
  ...
}

// New format (v5)
{
  profile: {
    id, name, avatar,
    programSubscriptionIds: [],
    settings: { ... },
    privacy: { ... }
  },
  programSubscriptions: [{ id, profileId, programId, ... }],
  todoLists: [],
  dailySeries: [],
  // Legacy fields preserved for compatibility
  user, avatar, activeProgram, ...
}
```

## Key Services

### todoService.js

Manages TodoList generation and quest instance operations.

```javascript
// Generate today's TodoLists from active program
const todoLists = generateTodoListsForToday(subscription, profileId, userQuests);

// Update quest status
const updated = updateQuestInstanceStatus(todoList, questId, "completed", { sessionId });

// Calculate progress
const progress = calculateTodoListProgress(todoList);
// → { total, completed, skipped, pending, completionRate, isDone }

// Get daily aggregate
const daily = calculateDailyProgress(allTodaysTodoLists);
```

### starterKits.js

Program templates and progress calculation.

```javascript
// Get program progress
const progress = calculateProgramProgress(subscription);
// → { currentDay, completedDays, totalDays, progress, progressPercent, nextMilestone, ... }

// Get today's suggested quests
const { morning, afternoon, evening, todoLists } = getTodaysSuggestedQuests(subscription);

// Get TodoList templates for a day
const templates = getDayTodoListTemplates(program, dayNumber);
```

## State Management

### Store Hooks

```javascript
// Profile
const profile = useProfile();

// Program subscriptions
const subscriptions = useProgramSubscriptions();
const active = useActiveSubscription();

// TodoLists
const allLists = useTodoLists();
const todayLists = useTodaysTodoLists();

// Settings (merged legacy + new)
const settings = useProfileSettings();
```

### Store Actions

```javascript
// Profile
updateProfile({ name: "New Name" });
updateProfile(prev => ({ ...prev, name: "New Name" }));

// Subscriptions
upsertSubscription(newSubscription);
removeSubscription(subscriptionId);

// TodoLists
setTodoLists(lists);
upsertTodoList(updatedList);
```

## Cloning & Sharing

Quests and subquests can be cloned from the library or other users:

```javascript
const clonedQuest = cloneQuest(sourceQuest, myProfileId);
// → { ...sourceQuest, id: newId, creatorId: myProfileId, sourceId: sourceQuest.id }

const clonedSubquest = cloneSubquest(sourceSubquest, myProfileId, newParentQuestId);
```

The `sourceId` field tracks provenance, enabling:
- Attribution to original creators
- Update notifications when source changes
- Analytics on quest popularity

## Future Considerations

### Backend Sync (Supabase)

The data model is designed for easy migration to Supabase:
- UUID-style IDs (`prefix-timestamp-random`)
- Normalized relationships with foreign keys
- Timestamps on all entities
- No circular dependencies

### Planned Features

1. **Social sharing**: Share quests/programs with friends
2. **Community library**: Browse public quests/programs
3. **Achievements**: Badge system tied to milestones
4. **Analytics**: Track quest completion patterns over time
