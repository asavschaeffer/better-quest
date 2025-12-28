// Stat keys used across the app
// STR=Strength, STA=Stamina, DEX=Dexterity, VIT=Vitality, INT=Intelligence, SPI=Spirit, CHA=Charisma
export const STAT_KEYS = ["STR", "DEX", "STA", "INT", "SPI", "CHA", "VIT"];

// Quest stat constraints
export const QUEST_STAT_MAX_PER_STAT = 2;
// Intended v1: allow "hard" quests but prevent runaway allocations.
export const QUEST_STAT_MAX_TOTAL = 9;

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
      CHA: 0,
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
  targetStats,
  allocation,
  questKey = null,
  isBreak = false,
  comboBonus = false,
  restBonus = false,
  bonusMultiplier = 1,
  bonusBreakdown,
  endTimeMs,
}) {
  return {
    id,
    description: description.trim(),
    durationMinutes,
    startTime: startTime ?? new Date().toISOString(),
    endTime: null,
    endTimeMs: typeof endTimeMs === "number" ? endTimeMs : null,
    // Mechanical intent snapshot (0–3 points per stat). This is authoritative for EXP splitting.
    allocation: allocation ?? null,
    // Display-only chart values (derived from allocation/duration elsewhere).
    standStats: standStats ?? null,
    targetStats: targetStats ?? null,
    questKey,
    isBreak,
    comboBonus,
    restBonus,
    bonusMultiplier,
    // Optional: snapshot of which bonuses were applied and why (for UX + testing).
    bonusBreakdown: Array.isArray(bonusBreakdown) ? bonusBreakdown : null,
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
 * @param {object} [params.stats] - Stat weights as points: { STR: 0-2, ... } (no total cap)
 * @param {string[]} [params.keywords] - Tags for search/ranking
 * @param {object} [params.action] - Quick launch action { type: "url"|"app", value: string }
 * @param {string} [params.icon] - Ionicons glyph name (e.g. "book-outline") or null
 * @param {string} [params.imageUri] - Quest image URI (app-local file://... or remote https://...) or null
 * @param {string} [params.authorName] - Display name of quest author
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
  icon = null,
  imageUri = null,
  authorName = null,
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

  // Intended v1: enforce total allocation cap (no silent clamping).
  const totalPoints = getQuestStatTotal(validatedStats);
  if (totalPoints > QUEST_STAT_MAX_TOTAL) {
    throw new Error(
      `Quest stats total cannot exceed ${QUEST_STAT_MAX_TOTAL} (got ${totalPoints})`,
    );
  }

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
    icon: typeof icon === "string" && icon.trim() ? icon.trim() : null,
    imageUri: typeof imageUri === "string" && imageUri.trim() ? imageUri.trim() : null,
    authorName: typeof authorName === "string" && authorName.trim() ? authorName.trim() : null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate and enforce stat caps: 0-2 per stat (no total cap)
 * @param {object} stats - Raw stat object
 * @returns {object} Validated stats
 */
export function validateQuestStats(stats) {
  const result = {};
  
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
      result[key] = clamped;
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
 * @param {object} action - { type: "url"|"app"|"file", value: string, openOnStart?: boolean }
 * @returns {object|null} Validated action or null
 */
export function validateQuestAction(action) {
  if (!action || !action.type || !action.value) {
    return null;
  }
  
  const type = action.type;
  let value = (action.value || "").trim();
  const openOnStart = action.openOnStart !== false;
  
  if (!value) {
    return null;
  }
  
  if (type === "url") {
    // Auto-add https:// if missing protocol
    if (!/^https?:\/\//i.test(value)) {
      value = "https://" + value;
    }
    return { type: "url", value, openOnStart };
  }
  
  if (type === "app") {
    // Store raw string for app protocol handlers
    return { type: "app", value, openOnStart };
  }
  
  if (type === "file") {
    // Store file path - will be converted to file:// URL when opening
    return { type: "file", value, openOnStart };
  }
  
  return null;
}

/**
 * Suggest stats based on quest label keywords
 * @param {string} label
 * @returns {object} Suggested stats { STR: 0-2, ... }
 */
export function suggestStatsForLabel(label) {
  const lower = (label || "").toLowerCase();
  
  // Default: no allocation (user picks)
  const empty = {};
  STAT_KEYS.forEach(key => { empty[key] = 0; });
  
  // Keyword-based suggestions (mapped to: STR, STA, DEX, VIT, INT, SPI, CHA)
  const suggestions = [
    // Physical - STR (peak force)
    { keywords: ["weightlifting", "weights", "gym", "strength", "lift", "calisthenics", "pushup", "pullup"], stats: { STR: 2, STA: 1, VIT: 1 } },
    // Physical - STA (cardiovascular)
    { keywords: ["running", "run", "jog", "cardio", "sprint", "cycling", "bike"], stats: { STA: 2, STR: 1, VIT: 1 } },
    { keywords: ["swim", "swimming", "pool"], stats: { STA: 2, STR: 1, VIT: 1 } },
    // Physical - DEX (coordination & skill)
    { keywords: ["yoga", "stretch", "flexibility"], stats: { DEX: 1, SPI: 1, STA: 1, VIT: 1 } },
    { keywords: ["basketball", "soccer", "football", "tennis", "sport"], stats: { DEX: 1, STR: 1, STA: 1, VIT: 1 } },
    { keywords: ["guitar", "music", "piano", "instrument", "practice", "song", "drums"], stats: { DEX: 2, SPI: 1, VIT: 1 } },
    { keywords: ["art", "draw", "paint", "sketch", "craft"], stats: { DEX: 2, SPI: 1, VIT: 1 } },
    { keywords: ["cooking", "cook", "meal", "food", "baking"], stats: { DEX: 2, VIT: 2 } },
    // Health & Routine - VIT
    { keywords: ["cleaning", "clean", "organize", "tidy", "chore"], stats: { VIT: 2, STA: 1, SPI: 1 } },
    { keywords: ["walking", "walk", "hike", "stroll"], stats: { VIT: 2, STA: 1, SPI: 1 } },
    { keywords: ["sleep", "nap", "rest"], stats: { VIT: 3, SPI: 1 } },
    // Mental - INT (logic & learning)
    { keywords: ["math", "calculus", "algebra", "geometry", "statistics"], stats: { INT: 3, VIT: 1 } },
    { keywords: ["science", "physics", "chemistry", "biology", "research"], stats: { INT: 2, DEX: 1, VIT: 1 } },
    { keywords: ["reading", "book", "novel", "study"], stats: { INT: 2, SPI: 1, VIT: 1 } },
    { keywords: ["code", "coding", "programming", "develop", "software"], stats: { INT: 2, DEX: 1, VIT: 1 } },
    { keywords: ["language", "spanish", "french", "japanese", "duolingo"], stats: { INT: 2, CHA: 1, VIT: 1 } },
    // Spiritual - SPI (inner world)
    { keywords: ["prayer", "meditation", "spiritual", "faith", "mindfulness"], stats: { SPI: 3, VIT: 1 } },
    { keywords: ["writing", "essay", "journal", "blog", "article"], stats: { SPI: 2, INT: 1, VIT: 1 } },
    { keywords: ["philosophy", "reflect", "contemplate"], stats: { SPI: 2, INT: 1, VIT: 1 } },
    // Social - CHA (outer world)
    { keywords: ["work", "job", "office", "meeting", "project"], stats: { CHA: 1, INT: 1, STA: 1, VIT: 1 } },
    { keywords: ["social", "friends", "party", "hangout"], stats: { CHA: 2, SPI: 1, VIT: 1 } },
    { keywords: ["presentation", "speech", "talk", "present"], stats: { CHA: 2, INT: 1, VIT: 1 } },
    { keywords: ["networking", "connect", "collaborate"], stats: { CHA: 2, INT: 1, VIT: 1 } },
    { keywords: ["call", "phone", "video", "chat"], stats: { CHA: 2, SPI: 1, VIT: 1 } },
    { keywords: ["teach", "tutor", "mentor", "coach"], stats: { CHA: 2, INT: 1, VIT: 1 } },
  ];
  
  for (const { keywords, stats } of suggestions) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { ...empty, ...stats };
    }
  }
  
  return empty;
}


