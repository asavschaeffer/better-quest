// Stat keys used across the app
export const STAT_KEYS = ["STR", "DEX", "STA", "INT", "SPI", "CRE", "VIT"];

// Quest stat constraints
export const QUEST_STAT_MAX_PER_STAT = 3;
export const QUEST_STAT_MAX_TOTAL = 4;

export function createDefaultAvatar() {
  return {
    id: "avatar-1",
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

export function createUser({ id = "user-1", name = "You", avatar } = {}) {
  return {
    id,
    name,
    avatar: avatar ?? createDefaultAvatar(),
  };
}

export function createTaskSession({
  id,
  description,
  durationMinutes,
  startTime,
  standStats,
  isBreak = false,
  comboBonus = false,
  restBonus = false,
  bonusMultiplier = 1,
}) {
  return {
    id,
    description: description.trim(),
    durationMinutes,
    startTime: startTime ?? new Date().toISOString(),
    endTime: null,
    standStats: standStats ?? null,
    isBreak,
    comboBonus,
    restBonus,
    bonusMultiplier,
    icon: null,
  };
}

/**
 * Create a Quest (user-created template)
 * @param {object} params
 * @param {string} params.id - Unique identifier
 * @param {string} params.label - Display name (required)
 * @param {string} [params.description] - Optional longer description / why
 * @param {number} [params.defaultDurationMinutes] - Default duration (1-240)
 * @param {object} [params.stats] - Stat allocation: { STR: 0-3, ... }, sum ≤ 4
 * @param {string[]} [params.keywords] - Tags for search/ranking
 * @param {object} [params.action] - Quick launch action { type: "url"|"app", value: string }
 * @returns {object} Quest object
 */
export function createQuest({
  id,
  label,
  description = "",
  defaultDurationMinutes = 25,
  stats = {},
  keywords = [],
  action = null,
}) {
  if (!id) {
    throw new Error("Quest id is required");
  }
  if (!label || !label.trim()) {
    throw new Error("Quest label is required");
  }
  
  // Validate and clamp duration
  const duration = Math.max(1, Math.min(240, Math.floor(defaultDurationMinutes) || 25));
  
  // Validate and clamp stats
  const validatedStats = validateQuestStats(stats);
  
  // Validate action
  const validatedAction = validateQuestAction(action);
  
  const now = new Date().toISOString();
  
  return {
    id,
    label: label.trim(),
    description: (description || "").trim(),
    defaultDurationMinutes: duration,
    stats: validatedStats,
    keywords: Array.isArray(keywords) ? keywords.filter(k => typeof k === "string" && k.trim()) : [],
    action: validatedAction,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate and enforce stat caps: 0-3 per stat, max 4 total
 * @param {object} stats - Raw stat object
 * @returns {object} Validated stats
 */
export function validateQuestStats(stats) {
  const result = {};
  let total = 0;
  
  // Initialize all stats to 0
  STAT_KEYS.forEach(key => {
    result[key] = 0;
  });
  
  // Apply provided stats with caps
  STAT_KEYS.forEach(key => {
    const raw = stats?.[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      // Cap per stat at 3
      const clamped = Math.min(QUEST_STAT_MAX_PER_STAT, Math.max(0, Math.floor(raw)));
      // Check total cap
      const canAdd = Math.min(clamped, QUEST_STAT_MAX_TOTAL - total);
      if (canAdd > 0) {
        result[key] = canAdd;
        total += canAdd;
      }
    }
  });
  
  return result;
}

/**
 * Get total points allocated in a quest stats object
 * @param {object} stats
 * @returns {number}
 */
export function getQuestStatTotal(stats) {
  let total = 0;
  STAT_KEYS.forEach(key => {
    const val = stats?.[key];
    if (typeof val === "number" && val > 0) {
      total += val;
    }
  });
  return total;
}

/**
 * Validate quest action (URL, app protocol, or file path)
 * @param {object} action - { type: "url"|"app"|"file", value: string }
 * @returns {object|null} Validated action or null
 */
export function validateQuestAction(action) {
  if (!action || !action.type || !action.value) {
    return null;
  }
  
  const type = action.type;
  let value = (action.value || "").trim();
  
  if (!value) {
    return null;
  }
  
  if (type === "url") {
    // Auto-add https:// if missing protocol
    if (!/^https?:\/\//i.test(value)) {
      value = "https://" + value;
    }
    return { type: "url", value };
  }
  
  if (type === "app") {
    // Store raw string for app protocol handlers
    return { type: "app", value };
  }
  
  if (type === "file") {
    // Store file path - will be converted to file:// URL when opening
    return { type: "file", value };
  }
  
  return null;
}

/**
 * Suggest stats based on quest label keywords
 * @param {string} label
 * @returns {object} Suggested stats { STR: 0-3, ... }
 */
export function suggestStatsForLabel(label) {
  const lower = (label || "").toLowerCase();
  
  // Default: no allocation (user picks)
  const empty = {};
  STAT_KEYS.forEach(key => { empty[key] = 0; });
  
  // Keyword-based suggestions
  const suggestions = [
    { keywords: ["math", "calculus", "algebra", "geometry", "statistics"], stats: { INT: 2, CRE: 1, VIT: 1 } },
    { keywords: ["science", "physics", "chemistry", "biology", "research"], stats: { INT: 2, CRE: 1, VIT: 1 } },
    { keywords: ["writing", "essay", "journal", "blog", "article"], stats: { CRE: 2, SPI: 1, VIT: 1 } },
    { keywords: ["reading", "book", "novel", "study"], stats: { INT: 2, SPI: 1, VIT: 1 } },
    { keywords: ["weightlifting", "weights", "gym", "strength", "lift"], stats: { STR: 2, STA: 1, VIT: 1 } },
    { keywords: ["running", "run", "jog", "cardio", "sprint"], stats: { STA: 2, STR: 1, VIT: 1 } },
    { keywords: ["prayer", "meditation", "spiritual", "faith", "mindfulness"], stats: { SPI: 3, VIT: 1 } },
    { keywords: ["yoga", "stretch", "flexibility"], stats: { SPI: 1, STA: 1, DEX: 1, VIT: 1 } },
    { keywords: ["work", "job", "office", "meeting", "project"], stats: { INT: 1, STA: 1, CRE: 1, VIT: 1 } },
    { keywords: ["cooking", "cook", "meal", "food", "baking"], stats: { CRE: 2, DEX: 1, VIT: 1 } },
    { keywords: ["cleaning", "clean", "organize", "tidy"], stats: { STA: 1, VIT: 2, SPI: 1 } },
    { keywords: ["walking", "walk", "hike", "stroll"], stats: { STA: 1, VIT: 2, SPI: 1 } },
    { keywords: ["guitar", "music", "piano", "instrument", "practice", "song"], stats: { DEX: 2, CRE: 1, SPI: 1 } },
    { keywords: ["art", "draw", "paint", "sketch", "design"], stats: { CRE: 2, DEX: 1, SPI: 1 } },
    { keywords: ["code", "coding", "programming", "develop", "software"], stats: { INT: 2, CRE: 1, VIT: 1 } },
    { keywords: ["language", "spanish", "french", "japanese", "duolingo"], stats: { INT: 2, SPI: 1, VIT: 1 } },
    { keywords: ["swim", "swimming", "pool"], stats: { STA: 2, STR: 1, VIT: 1 } },
    { keywords: ["basketball", "soccer", "football", "tennis", "sport"], stats: { STR: 1, STA: 1, DEX: 1, VIT: 1 } },
  ];
  
  for (const { keywords, stats } of suggestions) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { ...empty, ...stats };
    }
  }
  
  return empty;
}


