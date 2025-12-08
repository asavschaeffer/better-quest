/**
 * =====================================================
 * BETTER QUEST - DATA MODEL
 * =====================================================
 * 
 * Hierarchical structure from highest to lowest abstraction:
 * 
 *   Profile
 *     └── ProgramSubscription[]
 *           └── DailySeries[]
 *                 └── TodoList[]
 *                       └── Quest[]
 *                             └── Subquest[]
 * 
 * =====================================================
 */

import { STAT_KEYS, QUEST_STAT_MAX_PER_STAT, QUEST_STAT_MAX_TOTAL } from "./models";

// =====================================================
// SECTION 1: ENTITY DEFINITIONS
// =====================================================

/**
 * PROFILE
 * -------
 * The top-level entity representing a user in the system.
 * Accessible from HomeScreen (own) and LeaderboardScreen (others).
 * 
 * @typedef {Object} Profile
 * @property {string} id - Unique identifier (e.g., "profile-uuid")
 * @property {string} name - Display name
 * @property {Avatar} avatar - Player avatar with stats
 * @property {string[]} programSubscriptionIds - References to subscribed programs
 * @property {Object} settings - User preferences
 * @property {Object} privacy - Privacy settings for profile visibility
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */
export const PROFILE_SCHEMA = {
  id: "string:required:unique",
  name: "string:required",
  avatar: "Avatar:required",
  programSubscriptionIds: "string[]:default:[]",
  settings: {
    quickStartMode: "enum:instant|picker:default:picker",
    pickerDefaultMode: "enum:top|blank:default:top",
    postSaveBehavior: "enum:library|picker:default:library",
    includeBuiltInQuotes: "boolean:default:true",
  },
  privacy: {
    showOnLeaderboard: "boolean:default:true",
    showQuests: "boolean:default:true",
    showPrograms: "boolean:default:true",
  },
  createdAt: "datetime:required",
  updatedAt: "datetime:required",
};

/**
 * AVATAR
 * ------
 * The player's character with accumulated stats and progress.
 * 
 * @typedef {Object} Avatar
 * @property {string} id - Unique identifier
 * @property {string} name - Character name
 * @property {number} level - Current level (derived from totalExp)
 * @property {number} totalExp - Total experience points earned
 * @property {Object} standExp - Stat distribution { STR, DEX, STA, INT, SPI, CRE, VIT }
 */
export const AVATAR_SCHEMA = {
  id: "string:required:unique",
  name: "string:required",
  level: "number:default:1",
  totalExp: "number:default:0",
  standExp: {
    STR: "number:default:0",
    DEX: "number:default:0",
    STA: "number:default:0",
    INT: "number:default:0",
    SPI: "number:default:0",
    CRE: "number:default:0",
    VIT: "number:default:0",
  },
};

/**
 * PROGRAM (Catalog Entry)
 * -----------------------
 * A pre-made or user-created program template available in the library.
 * Contains the blueprint for daily series, quests, and progression.
 * 
 * @typedef {Object} Program
 * @property {string} id - Unique identifier
 * @property {string} name - Program name
 * @property {string} description - What this program helps with
 * @property {string} icon - Emoji icon
 * @property {string} creatorId - Profile ID of creator (null for built-in)
 * @property {string} difficulty - beginner | intermediate | advanced
 * @property {number} durationDays - Total program length
 * @property {DailySeriesTemplate[]} dailySeries - Template for each day/phase
 * @property {Milestone[]} milestones - Achievement points
 * @property {Unlockable[]} unlockables - Quests/features unlocked by progress
 * @property {string[]} tags - Searchable tags
 * @property {Object} metrics - Popularity metrics
 */
export const PROGRAM_SCHEMA = {
  id: "string:required:unique",
  name: "string:required",
  description: "string:default:''",
  icon: "string:default:'📋'",
  creatorId: "string:nullable",
  difficulty: "enum:beginner|intermediate|advanced:default:beginner",
  durationDays: "number:required:min:1",
  dailySeries: "DailySeriesTemplate[]:required",
  milestones: "Milestone[]:default:[]",
  unlockables: "Unlockable[]:default:[]",
  tags: "string[]:default:[]",
  metrics: {
    uses: "number:default:0",
    likes: "number:default:0",
    completionRate: "number:default:0", // 0-1
  },
  isPublic: "boolean:default:false",
  createdAt: "datetime:required",
  updatedAt: "datetime:required",
};

/**
 * PROGRAM SUBSCRIPTION
 * --------------------
 * Joins a Profile to a Program with user-specific state.
 * 
 * @typedef {Object} ProgramSubscription
 * @property {string} id - Unique identifier
 * @property {string} profileId - Owner profile
 * @property {string} programId - Reference to Program template
 * @property {string} startDate - When subscription began
 * @property {string|null} endDate - When subscription ended (null if active)
 * @property {string} status - active | paused | completed | cancelled
 * @property {string[]} completedDayIds - DailySeries IDs that are done
 * @property {string[]} unlockedQuestIds - Quests unlocked via progress
 * @property {Object} customSettings - User overrides for this program
 */
export const PROGRAM_SUBSCRIPTION_SCHEMA = {
  id: "string:required:unique",
  profileId: "string:required:fk:Profile.id",
  programId: "string:required:fk:Program.id",
  startDate: "datetime:required",
  endDate: "datetime:nullable",
  status: "enum:active|paused|completed|cancelled:default:active",
  completedDayIds: "string[]:default:[]",
  unlockedQuestIds: "string[]:default:[]",
  customSettings: {
    reminderTime: "string:nullable", // e.g., "09:00"
    notificationsEnabled: "boolean:default:true",
  },
  createdAt: "datetime:required",
  updatedAt: "datetime:required",
};

/**
 * DAILY SERIES TEMPLATE
 * ---------------------
 * Template for a day's structure within a Program.
 * 
 * @typedef {Object} DailySeriesTemplate
 * @property {string} id - Unique within program
 * @property {number} dayNumber - Day 1, 2, 3... (or phase number)
 * @property {string} name - Optional name (e.g., "Rest Day", "Push Day")
 * @property {TodoListTemplate[]} todoLists - Morning/afternoon/evening lists
 */
export const DAILY_SERIES_TEMPLATE_SCHEMA = {
  id: "string:required",
  dayNumber: "number:required:min:1",
  name: "string:default:''",
  todoLists: "TodoListTemplate[]:required",
};

/**
 * DAILY SERIES (Instance)
 * -----------------------
 * A user's actual day within their program subscription.
 * Created from DailySeriesTemplate when the day becomes active.
 * 
 * @typedef {Object} DailySeries
 * @property {string} id - Unique identifier
 * @property {string} subscriptionId - Parent ProgramSubscription
 * @property {string} templateId - Source DailySeriesTemplate ID
 * @property {number} dayNumber - Day in sequence
 * @property {string} date - Calendar date (ISO)
 * @property {string} status - pending | active | completed | skipped
 * @property {string[]} todoListIds - TodoList instances for this day
 */
export const DAILY_SERIES_SCHEMA = {
  id: "string:required:unique",
  subscriptionId: "string:required:fk:ProgramSubscription.id",
  templateId: "string:required",
  dayNumber: "number:required",
  date: "date:required",
  status: "enum:pending|active|completed|skipped:default:pending",
  todoListIds: "string[]:default:[]",
  completedAt: "datetime:nullable",
  createdAt: "datetime:required",
};

/**
 * TODO LIST TEMPLATE
 * ------------------
 * Template for a grouping of quests (e.g., "Morning Routine").
 * 
 * @typedef {Object} TodoListTemplate
 * @property {string} id - Unique within day
 * @property {string} name - "Morning", "Afternoon", "Evening", or custom
 * @property {string} timeSlot - morning | afternoon | evening | anytime
 * @property {string[]} questTemplateIds - Quest templates to include
 * @property {Object} suggestedTimes - Quest ID → suggested duration
 */
export const TODO_LIST_TEMPLATE_SCHEMA = {
  id: "string:required",
  name: "string:required",
  timeSlot: "enum:morning|afternoon|evening|anytime:default:anytime",
  questTemplateIds: "string[]:required",
  suggestedTimes: "Object:default:{}",
};

/**
 * TODO LIST (Instance)
 * --------------------
 * A user's actual todo list for a time period.
 * 
 * @typedef {Object} TodoList
 * @property {string} id - Unique identifier
 * @property {string} dailySeriesId - Parent day (nullable for standalone lists)
 * @property {string} profileId - Owner
 * @property {string} name - List name
 * @property {string} timeSlot - morning | afternoon | evening | anytime
 * @property {string} date - Calendar date
 * @property {QuestInstance[]} quests - Quest instances with completion state
 * @property {number} order - Sort order within day
 */
export const TODO_LIST_SCHEMA = {
  id: "string:required:unique",
  dailySeriesId: "string:nullable:fk:DailySeries.id",
  profileId: "string:required:fk:Profile.id",
  name: "string:required",
  timeSlot: "enum:morning|afternoon|evening|anytime:default:anytime",
  date: "date:required",
  quests: "QuestInstance[]:default:[]",
  order: "number:default:0",
  createdAt: "datetime:required",
  updatedAt: "datetime:required",
};

/**
 * QUEST (Template/Catalog Entry)
 * ------------------------------
 * A high-level task template that can be instantiated.
 * Examples: Exercise, Study, Work, Meditation, Chores
 * 
 * @typedef {Object} Quest
 * @property {string} id - Unique identifier
 * @property {string} label - Display name
 * @property {string} description - What this quest involves
 * @property {string} category - exercise | learning | creative | wellness | work | social | other
 * @property {number} defaultDurationMinutes - Suggested time
 * @property {Object} baseStats - Base stat weights { STR: 0-3, ... }
 * @property {string[]} keywords - Tags for search/matching
 * @property {Object|null} action - Quick launch { type, value }
 * @property {string|null} creatorId - Profile ID (null for built-in)
 * @property {string|null} sourceId - Original quest if cloned from library
 * @property {string[]} subquestIds - Available specializations
 * @property {Object} metrics - Popularity metrics
 */
export const QUEST_SCHEMA = {
  id: "string:required:unique",
  label: "string:required",
  description: "string:default:''",
  category: "enum:exercise|learning|creative|wellness|work|social|other:default:other",
  defaultDurationMinutes: "number:default:25:min:1:max:240",
  baseStats: {
    STR: "number:default:0:min:0:max:3",
    DEX: "number:default:0:min:0:max:3",
    STA: "number:default:0:min:0:max:3",
    INT: "number:default:0:min:0:max:3",
    SPI: "number:default:0:min:0:max:3",
    CRE: "number:default:0:min:0:max:3",
    VIT: "number:default:0:min:0:max:3",
  },
  keywords: "string[]:default:[]",
  action: "QuestAction:nullable",
  creatorId: "string:nullable:fk:Profile.id",
  sourceId: "string:nullable:fk:Quest.id",
  subquestIds: "string[]:default:[]",
  metrics: {
    uses: "number:default:0",
    likes: "number:default:0",
  },
  isPublic: "boolean:default:false",
  createdAt: "datetime:required",
  updatedAt: "datetime:required",
};

/**
 * SUBQUEST (Specialization)
 * -------------------------
 * A specialization of a Quest that modifies stat distribution.
 * Examples: 
 *   - Exercise (base) → Weightlifting, Running, Yoga (subquests)
 *   - Study (base) → Math, Science, Language (subquests)
 * 
 * @typedef {Object} Subquest
 * @property {string} id - Unique identifier
 * @property {string} parentQuestId - Parent Quest reference
 * @property {string} label - Specialization name
 * @property {string} description - Details about this variant
 * @property {Object} statDelta - Adjustments to base stats (can be positive/negative)
 * @property {Object} statOverride - Complete override (if set, ignores base + delta)
 * @property {Object} contextFields - Additional details specific to this variant
 * @property {string|null} creatorId - Profile ID (null for built-in)
 * @property {string|null} sourceId - Original if cloned
 */
export const SUBQUEST_SCHEMA = {
  id: "string:required:unique",
  parentQuestId: "string:required:fk:Quest.id",
  label: "string:required",
  description: "string:default:''",
  statDelta: {
    STR: "number:default:0",
    DEX: "number:default:0",
    STA: "number:default:0",
    INT: "number:default:0",
    SPI: "number:default:0",
    CRE: "number:default:0",
    VIT: "number:default:0",
  },
  statOverride: "Object:nullable", // If set, completely replaces computed stats
  contextFields: "Object:default:{}", // e.g., { topic: "Calculus", tool: "Textbook" }
  creatorId: "string:nullable:fk:Profile.id",
  sourceId: "string:nullable:fk:Subquest.id",
  isPublic: "boolean:default:false",
  createdAt: "datetime:required",
  updatedAt: "datetime:required",
};

/**
 * QUEST INSTANCE
 * --------------
 * An actual quest within a todo list with completion state.
 * 
 * @typedef {Object} QuestInstance
 * @property {string} id - Unique identifier
 * @property {string} questId - Reference to Quest template
 * @property {string|null} subquestId - Optional specialization
 * @property {number} order - Sort order in list
 * @property {number} plannedDurationMinutes - Duration for this instance
 * @property {Object} computedStats - Final stat weights after subquest applied
 * @property {string} status - pending | in_progress | completed | skipped
 * @property {string|null} sessionId - Link to completion Session
 * @property {string|null} completedAt - When completed
 * @property {string|null} notes - User notes on this instance
 */
export const QUEST_INSTANCE_SCHEMA = {
  id: "string:required:unique",
  questId: "string:required:fk:Quest.id",
  subquestId: "string:nullable:fk:Subquest.id",
  order: "number:default:0",
  plannedDurationMinutes: "number:required:min:1",
  computedStats: {
    STR: "number:required",
    DEX: "number:required",
    STA: "number:required",
    INT: "number:required",
    SPI: "number:required",
    CRE: "number:required",
    VIT: "number:required",
  },
  status: "enum:pending|in_progress|completed|skipped:default:pending",
  sessionId: "string:nullable:fk:Session.id",
  completedAt: "datetime:nullable",
  notes: "string:nullable",
  createdAt: "datetime:required",
};

/**
 * SESSION (Completion Log)
 * ------------------------
 * Record of a completed quest instance with awarded stats.
 * 
 * @typedef {Object} Session
 * @property {string} id - Unique identifier
 * @property {string} profileId - Who completed this
 * @property {string} questInstanceId - What was completed (nullable for ad-hoc)
 * @property {string} description - Quest description at time of completion
 * @property {number} durationMinutes - Actual duration
 * @property {string} startTime - When started
 * @property {string} endTime - When completed
 * @property {Object} allocation - Stat allocation used
 * @property {Object} expResult - EXP awarded { total, standExp: {...} }
 * @property {string|null} notes - User notes
 * @property {Object} bonuses - Applied bonuses
 */
export const SESSION_SCHEMA = {
  id: "string:required:unique",
  profileId: "string:required:fk:Profile.id",
  questInstanceId: "string:nullable:fk:QuestInstance.id",
  description: "string:required",
  durationMinutes: "number:required:min:1",
  startTime: "datetime:required",
  endTime: "datetime:required",
  allocation: {
    STR: "number:required",
    DEX: "number:required",
    STA: "number:required",
    INT: "number:required",
    SPI: "number:required",
    CRE: "number:required",
    VIT: "number:required",
  },
  expResult: {
    total: "number:required",
    standExp: "Object:required",
  },
  questKey: "string:nullable",
  notes: "string:nullable",
  bonuses: {
    comboBonus: "boolean:default:false",
    restBonus: "boolean:default:false",
    bonusMultiplier: "number:default:1",
  },
  createdAt: "datetime:required",
};

// =====================================================
// SECTION 2: RELATIONSHIPS
// =====================================================

/**
 * ENTITY RELATIONSHIPS
 * --------------------
 * 
 * Profile (1) ─────────────────────────────────────────┐
 *    │                                                  │
 *    │ 1:N                                              │
 *    ▼                                                  │
 * ProgramSubscription (N) ─────────────────────────┐   │
 *    │                                              │   │
 *    │ N:1                                          │   │
 *    ▼                                              │   │
 * Program (1) ◄─────── catalog entry                │   │
 *    │                                              │   │
 *    │ 1:N (template)                               │   │
 *    ▼                                              │   │
 * DailySeries (N) ◄─── instances created from       │   │
 *    │               DailySeriesTemplate            │   │
 *    │ 1:N                                          │   │
 *    ▼                                              │   │
 * TodoList (N)                                      │   │
 *    │                                              │   │
 *    │ 1:N                                          │   │
 *    ▼                                              │   │
 * QuestInstance (N)                                 │   │
 *    │                                              │   │
 *    │ N:1        N:1                               │   │
 *    ▼            ▼                                 │   │
 * Quest (1) ◄── Subquest (N)                       │   │
 *    │            (optional specialization)         │   │
 *    │                                              │   │
 *    │ N:1                                          │   │
 *    ▼                                              │   │
 * Session (N) ────────────────────────────────────►─┴───┘
 *    (completion log, also links back to Profile)
 * 
 * SHARING RELATIONSHIPS:
 * 
 * CatalogQuest (Library) ──clone──► UserQuest (Personal)
 *       │                                 │
 *       └── sourceId tracks origin ───────┘
 * 
 * Profile A ──view──► Profile B's quests
 *       │
 *       └── clone to own library
 */

export const RELATIONSHIPS = {
  Profile: {
    hasMany: ["ProgramSubscription", "TodoList", "Quest", "Subquest", "Session"],
    belongsTo: [],
  },
  ProgramSubscription: {
    hasMany: ["DailySeries"],
    belongsTo: ["Profile", "Program"],
  },
  Program: {
    hasMany: ["ProgramSubscription", "DailySeriesTemplate"],
    belongsTo: ["Profile"], // creator
  },
  DailySeries: {
    hasMany: ["TodoList"],
    belongsTo: ["ProgramSubscription"],
  },
  TodoList: {
    hasMany: ["QuestInstance"],
    belongsTo: ["DailySeries", "Profile"],
  },
  QuestInstance: {
    hasMany: [],
    belongsTo: ["TodoList", "Quest", "Subquest", "Session"],
  },
  Quest: {
    hasMany: ["Subquest", "QuestInstance"],
    belongsTo: ["Profile", "Quest"], // creator, source
  },
  Subquest: {
    hasMany: ["QuestInstance"],
    belongsTo: ["Quest", "Profile", "Subquest"], // parent, creator, source
  },
  Session: {
    hasMany: [],
    belongsTo: ["Profile", "QuestInstance"],
  },
};

// =====================================================
// SECTION 3: STAT WEIGHTING & INHERITANCE
// =====================================================

/**
 * CANONICAL STATS
 * ---------------
 * The seven stats tracked in the system.
 */
export const STATS = {
  STR: { key: "STR", name: "Strength", description: "Physical power and lifting" },
  DEX: { key: "DEX", name: "Dexterity", description: "Coordination and fine motor skills" },
  STA: { key: "STA", name: "Stamina", description: "Endurance and sustained effort" },
  INT: { key: "INT", name: "Intelligence", description: "Learning and problem-solving" },
  SPI: { key: "SPI", name: "Spirit", description: "Mindfulness and inner peace" },
  CRE: { key: "CRE", name: "Creativity", description: "Artistic expression and innovation" },
  VIT: { key: "VIT", name: "Vitality", description: "Overall wellness and life balance" },
};

/**
 * STAT CONSTRAINTS
 */
export const STAT_CONSTRAINTS = {
  MIN_PER_STAT: 0,
  MAX_PER_STAT: QUEST_STAT_MAX_PER_STAT, // 3
  MAX_TOTAL: QUEST_STAT_MAX_TOTAL, // 4
  DELTA_MIN: -3,
  DELTA_MAX: 3,
};

/**
 * Compute final stats for a quest instance.
 * 
 * Priority:
 * 1. If subquest has statOverride → use override
 * 2. Else → base stats + subquest delta (clamped)
 * 
 * @param {Object} baseStats - Quest's base stats
 * @param {Object|null} subquest - Optional subquest with delta/override
 * @returns {Object} Final computed stats
 */
export function computeQuestStats(baseStats, subquest = null) {
  // No subquest: return base stats
  if (!subquest) {
    return { ...baseStats };
  }

  // Subquest with override: use override directly
  if (subquest.statOverride) {
    return validateStats(subquest.statOverride);
  }

  // Subquest with delta: add to base
  const result = {};
  STAT_KEYS.forEach((key) => {
    const base = baseStats?.[key] ?? 0;
    const delta = subquest.statDelta?.[key] ?? 0;
    result[key] = Math.max(
      STAT_CONSTRAINTS.MIN_PER_STAT,
      Math.min(STAT_CONSTRAINTS.MAX_PER_STAT, base + delta)
    );
  });

  return result;
}

/**
 * Validate and clamp stats to constraints.
 * 
 * @param {Object} stats - Raw stats object
 * @returns {Object} Validated stats
 */
export function validateStats(stats) {
  const result = {};
  let total = 0;

  STAT_KEYS.forEach((key) => {
    result[key] = 0;
  });

  STAT_KEYS.forEach((key) => {
    const raw = stats?.[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      const clamped = Math.min(STAT_CONSTRAINTS.MAX_PER_STAT, Math.max(0, Math.floor(raw)));
      const canAdd = Math.min(clamped, STAT_CONSTRAINTS.MAX_TOTAL - total);
      if (canAdd > 0) {
        result[key] = canAdd;
        total += canAdd;
      }
    }
  });

  return result;
}

/**
 * Calculate total stat points in allocation.
 * 
 * @param {Object} stats
 * @returns {number}
 */
export function getStatTotal(stats) {
  return STAT_KEYS.reduce((sum, key) => sum + (stats?.[key] ?? 0), 0);
}

/**
 * Get stat distribution as ratios (for EXP calculation).
 * 
 * @param {Object} stats
 * @returns {Object} { STR: 0-1, ... } summing to 1
 */
export function getStatRatios(stats) {
  const total = getStatTotal(stats);
  if (total === 0) {
    // Equal distribution if no allocation
    const equal = 1 / STAT_KEYS.length;
    return STAT_KEYS.reduce((acc, key) => ({ ...acc, [key]: equal }), {});
  }
  return STAT_KEYS.reduce((acc, key) => ({
    ...acc,
    [key]: (stats?.[key] ?? 0) / total,
  }), {});
}

// =====================================================
// SECTION 4: EXAMPLE QUEST/SUBQUEST DEFINITIONS
// =====================================================

/**
 * BUILT-IN QUEST TYPES WITH SUBQUESTS
 * -----------------------------------
 * These demonstrate the inheritance pattern.
 */
export const QUEST_TYPE_DEFINITIONS = {
  // EXERCISE: Generic physical activity
  exercise: {
    label: "Exercise",
    category: "exercise",
    description: "Physical activity for health and fitness",
    baseStats: { STR: 1, DEX: 1, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
    subquests: {
      weightlifting: {
        label: "Weightlifting",
        description: "Strength training with weights",
        statDelta: { STR: 1, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
        // Final: STR:2, DEX:1, STA:1, VIT:1
      },
      running: {
        label: "Running",
        description: "Cardio running or jogging",
        statDelta: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
        // Final: STR:1, DEX:1, STA:2, VIT:1 (capped at 4)
      },
      yoga: {
        label: "Yoga",
        description: "Flexibility and mindfulness through yoga",
        statDelta: { STR: -1, DEX: 0, STA: 0, INT: 0, SPI: 1, CRE: 0, VIT: 0 },
        // Final: STR:0, DEX:1, STA:1, SPI:1, VIT:1
      },
      swimming: {
        label: "Swimming",
        description: "Full-body cardio in water",
        statDelta: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
        // Final: STR:1, DEX:1, STA:2, VIT:1
      },
      sports: {
        label: "Sports",
        description: "Team or individual sports",
        statDelta: { STR: 0, DEX: 1, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
        // Final: STR:1, DEX:2, STA:1, VIT:1 (capped)
      },
    },
  },

  // STUDY: Generic learning activity
  study: {
    label: "Study",
    category: "learning",
    description: "Learning and knowledge acquisition",
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CRE: 1, VIT: 1 },
    subquests: {
      math: {
        label: "Math",
        description: "Mathematical study and problem-solving",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 0, CRE: 0, VIT: 0 },
        // Final: INT:3, CRE:1, VIT:1 (capped at 4)
      },
      science: {
        label: "Science",
        description: "Scientific study and research",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 0, CRE: 0, VIT: 0 },
        // Final: INT:3, CRE:1 (capped)
      },
      language: {
        label: "Language",
        description: "Learning a new language",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CRE: 0, VIT: 0 },
        // Final: INT:2, SPI:1, CRE:1
      },
      reading: {
        label: "Reading",
        description: "Reading books or articles",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CRE: -1, VIT: 0 },
        // Final: INT:2, SPI:1, VIT:1
      },
    },
  },

  // WORK: Professional activities
  work: {
    label: "Work",
    category: "work",
    description: "Professional or job-related tasks",
    baseStats: { STR: 0, DEX: 0, STA: 1, INT: 1, SPI: 0, CRE: 1, VIT: 1 },
    subquests: {
      coding: {
        label: "Coding",
        description: "Programming and software development",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 0, CRE: 0, VIT: 0 },
        // Final: STA:1, INT:2, CRE:1
      },
      meetings: {
        label: "Meetings",
        description: "Professional meetings and calls",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CRE: 0, VIT: 0 },
        // Final: STA:1, INT:1, SPI:1, CRE:1
      },
      writing: {
        label: "Professional Writing",
        description: "Reports, documentation, emails",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 1, VIT: 0 },
        // Final: STA:1, INT:1, CRE:2
      },
    },
  },

  // SOCIAL: Social and community activities
  social: {
    label: "Socialize",
    category: "social",
    description: "Social interaction and community building",
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 2, CRE: 1, VIT: 1 },
    subquests: {
      family: {
        label: "Family Time",
        description: "Quality time with family",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CRE: 0, VIT: 0 },
        // Final: SPI:3, CRE:1
      },
      friends: {
        label: "Friends",
        description: "Hanging out with friends",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 1, VIT: 0 },
        // Final: SPI:2, CRE:2
      },
      community: {
        label: "Community",
        description: "Volunteering or community events",
        statDelta: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
        // Final: STA:1, SPI:2, CRE:1
      },
    },
  },

  // CHORES: Household tasks
  chores: {
    label: "Chores",
    category: "wellness",
    description: "Household maintenance and organization",
    baseStats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 1, CRE: 0, VIT: 2 },
    subquests: {
      cleaning: {
        label: "Cleaning",
        description: "Cleaning and tidying",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
        // Same as base
      },
      cooking: {
        label: "Cooking",
        description: "Meal preparation",
        statDelta: { STR: 0, DEX: 1, STA: 0, INT: 0, SPI: 0, CRE: 1, VIT: -1 },
        // Final: DEX:1, STA:1, SPI:1, CRE:1
      },
      organizing: {
        label: "Organizing",
        description: "Decluttering and organizing spaces",
        statDelta: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 0, CRE: 0, VIT: -1 },
        // Final: STA:1, INT:1, SPI:1, VIT:1
      },
    },
  },
};

// =====================================================
// SECTION 5: FACTORY FUNCTIONS
// =====================================================

/**
 * Create a new Profile.
 * 
 * @param {Object} params
 * @returns {Object} Profile
 */
export function createProfile({ id, name, avatar } = {}) {
  const now = new Date().toISOString();
  return {
    id: id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || "Adventurer",
    avatar: avatar || createDefaultAvatar(),
    programSubscriptionIds: [],
    settings: {
      quickStartMode: "picker",
      pickerDefaultMode: "top",
      postSaveBehavior: "library",
      includeBuiltInQuotes: true,
    },
    privacy: {
      showOnLeaderboard: true,
      showQuests: true,
      showPrograms: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a default Avatar.
 * 
 * @returns {Object} Avatar
 */
export function createDefaultAvatar() {
  return {
    id: `avatar-${Date.now()}`,
    name: "Adventurer",
    level: 1,
    totalExp: 0,
    standExp: {
      STR: 0,
      DEX: 0,
      STA: 0,
      INT: 0,
      SPI: 0,
      CRE: 0,
      VIT: 0,
    },
  };
}

/**
 * Create a Program Subscription.
 * 
 * @param {Object} params
 * @returns {Object} ProgramSubscription
 */
export function createProgramSubscription({ profileId, programId, customSettings = {} } = {}) {
  const now = new Date().toISOString();
  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    profileId,
    programId,
    startDate: now,
    endDate: null,
    status: "active",
    completedDayIds: [],
    unlockedQuestIds: [],
    customSettings: {
      reminderTime: null,
      notificationsEnabled: true,
      ...customSettings,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a TodoList.
 * 
 * @param {Object} params
 * @returns {Object} TodoList
 */
export function createTodoList({
  profileId,
  dailySeriesId = null,
  name = "Tasks",
  timeSlot = "anytime",
  date = null,
} = {}) {
  const now = new Date().toISOString();
  return {
    id: `todolist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dailySeriesId,
    profileId,
    name,
    timeSlot,
    date: date || now.split("T")[0],
    quests: [],
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a Quest template.
 * 
 * @param {Object} params
 * @returns {Object} Quest
 */
export function createQuestTemplate({
  label,
  description = "",
  category = "other",
  defaultDurationMinutes = 25,
  baseStats = {},
  keywords = [],
  action = null,
  creatorId = null,
  sourceId = null,
  subquestIds = [],
  isPublic = false,
} = {}) {
  if (!label || !label.trim()) {
    throw new Error("Quest label is required");
  }
  const now = new Date().toISOString();
  return {
    id: `quest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: label.trim(),
    description: description.trim(),
    category,
    defaultDurationMinutes: Math.max(1, Math.min(240, defaultDurationMinutes)),
    baseStats: validateStats(baseStats),
    keywords: keywords.filter((k) => typeof k === "string" && k.trim()),
    action,
    creatorId,
    sourceId,
    subquestIds,
    metrics: { uses: 0, likes: 0 },
    isPublic,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a Subquest.
 * 
 * @param {Object} params
 * @returns {Object} Subquest
 */
export function createSubquest({
  parentQuestId,
  label,
  description = "",
  statDelta = {},
  statOverride = null,
  contextFields = {},
  creatorId = null,
  sourceId = null,
  isPublic = false,
} = {}) {
  if (!parentQuestId) {
    throw new Error("parentQuestId is required");
  }
  if (!label || !label.trim()) {
    throw new Error("Subquest label is required");
  }
  const now = new Date().toISOString();
  return {
    id: `subquest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    parentQuestId,
    label: label.trim(),
    description: description.trim(),
    statDelta: {
      STR: statDelta.STR ?? 0,
      DEX: statDelta.DEX ?? 0,
      STA: statDelta.STA ?? 0,
      INT: statDelta.INT ?? 0,
      SPI: statDelta.SPI ?? 0,
      CRE: statDelta.CRE ?? 0,
      VIT: statDelta.VIT ?? 0,
    },
    statOverride: statOverride ? validateStats(statOverride) : null,
    contextFields,
    creatorId,
    sourceId,
    isPublic,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a Quest Instance (for a todo list).
 * 
 * @param {Object} params
 * @returns {Object} QuestInstance
 */
export function createQuestInstance({
  questId,
  quest,
  subquestId = null,
  subquest = null,
  plannedDurationMinutes,
  order = 0,
} = {}) {
  if (!questId) {
    throw new Error("questId is required");
  }
  const baseStats = quest?.baseStats ?? {};
  const computedStats = computeQuestStats(baseStats, subquest);
  const now = new Date().toISOString();
  return {
    id: `qi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    questId,
    subquestId,
    order,
    plannedDurationMinutes: plannedDurationMinutes ?? quest?.defaultDurationMinutes ?? 25,
    computedStats,
    status: "pending",
    sessionId: null,
    completedAt: null,
    notes: null,
    createdAt: now,
  };
}

// =====================================================
// SECTION 6: CLONING (SHARING/LIBRARY)
// =====================================================

/**
 * Clone a Quest from the library to user's personal collection.
 * Preserves sourceId to track provenance.
 * 
 * @param {Object} sourceQuest - Quest to clone
 * @param {string} creatorId - New owner's profile ID
 * @returns {Object} New Quest
 */
export function cloneQuest(sourceQuest, creatorId) {
  const now = new Date().toISOString();
  return {
    ...sourceQuest,
    id: `quest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creatorId,
    sourceId: sourceQuest.id,
    isPublic: false, // Cloned quests are private by default
    metrics: { uses: 0, likes: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Clone a Subquest from another user.
 * 
 * @param {Object} sourceSubquest - Subquest to clone
 * @param {string} creatorId - New owner's profile ID
 * @param {string} parentQuestId - New parent Quest ID in user's library
 * @returns {Object} New Subquest
 */
export function cloneSubquest(sourceSubquest, creatorId, parentQuestId) {
  const now = new Date().toISOString();
  return {
    ...sourceSubquest,
    id: `subquest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    parentQuestId,
    creatorId,
    sourceId: sourceSubquest.id,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };
}

// =====================================================
// SECTION 7: AGGREGATION HELPERS
// =====================================================

/**
 * Aggregate stats from completed sessions to profile.
 * 
 * @param {Object[]} sessions - Array of completed sessions
 * @returns {Object} Aggregated standExp
 */
export function aggregateSessionStats(sessions) {
  const totals = {};
  STAT_KEYS.forEach((k) => {
    totals[k] = 0;
  });
  sessions.forEach((s) => {
    const gains = s.expResult?.standExp || {};
    STAT_KEYS.forEach((k) => {
      totals[k] += gains[k] ?? 0;
    });
  });
  return totals;
}

/**
 * Compute profile stats from all sessions.
 * 
 * @param {Object[]} sessions
 * @returns {Object} { totalExp, standExp }
 */
export function computeProfileStats(sessions) {
  let totalExp = 0;
  const standExp = {};
  STAT_KEYS.forEach((k) => {
    standExp[k] = 0;
  });
  sessions.forEach((s) => {
    totalExp += s.expResult?.total ?? 0;
    const gains = s.expResult?.standExp || {};
    STAT_KEYS.forEach((k) => {
      standExp[k] += gains[k] ?? 0;
    });
  });
  return { totalExp, standExp };
}
