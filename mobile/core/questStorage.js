import AsyncStorage from "@react-native-async-storage/async-storage";
import { STAT_KEYS } from "./models";
import { createQuestTemplate, createSubquest, computeQuestStats } from "./dataModel";

const USER_QUESTS_KEY = "better-quest-user-quests-v2";
const USER_SUBQUESTS_KEY = "better-quest-user-subquests-v1";

/**
 * Load user-created quests from AsyncStorage
 * @returns {Promise<Array>} Array of Quest objects
 */
export async function loadUserQuests() {
  try {
    const raw = await AsyncStorage.getItem(USER_QUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save user-created quests to AsyncStorage
 * @param {Array} quests - Array of Quest objects
 */
export async function saveUserQuests(quests) {
  try {
    const data = Array.isArray(quests) ? quests : [];
    await AsyncStorage.setItem(USER_QUESTS_KEY, JSON.stringify(data));
  } catch {
    // Ignore save errors
  }
}

/**
 * Add a new quest to storage
 * @param {object} quest - Quest object
 * @returns {Promise<Array>} Updated quests array
 */
export async function addUserQuest(quest) {
  const quests = await loadUserQuests();
  // Check for duplicate ID
  const existingIndex = quests.findIndex(q => q.id === quest.id);
  if (existingIndex >= 0) {
    // Update existing
    quests[existingIndex] = { ...quest, updatedAt: new Date().toISOString() };
  } else {
    // Add new
    quests.unshift(quest);
  }
  await saveUserQuests(quests);
  return quests;
}

/**
 * Update an existing quest in storage
 * @param {string} questId
 * @param {object} updates - Partial quest updates
 * @returns {Promise<Array>} Updated quests array
 */
export async function updateUserQuest(questId, updates) {
  const quests = await loadUserQuests();
  const index = quests.findIndex(q => q.id === questId);
  if (index >= 0) {
    quests[index] = {
      ...quests[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await saveUserQuests(quests);
  }
  return quests;
}

/**
 * Delete a quest from storage
 * @param {string} questId
 * @returns {Promise<Array>} Updated quests array
 */
export async function deleteUserQuest(questId) {
  const quests = await loadUserQuests();
  const filtered = quests.filter(q => q.id !== questId);
  await saveUserQuests(filtered);
  return filtered;
}

// =====================================================
// SUBQUEST STORAGE
// =====================================================

/**
 * Load user-created subquests from AsyncStorage
 * @returns {Promise<Array>} Array of Subquest objects
 */
export async function loadUserSubquests() {
  try {
    const raw = await AsyncStorage.getItem(USER_SUBQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save user-created subquests to AsyncStorage
 * @param {Array} subquests - Array of Subquest objects
 */
export async function saveUserSubquests(subquests) {
  try {
    const data = Array.isArray(subquests) ? subquests : [];
    await AsyncStorage.setItem(USER_SUBQUESTS_KEY, JSON.stringify(data));
  } catch {
    // Ignore save errors
  }
}

/**
 * Add a new subquest to storage
 * @param {object} subquest - Subquest object
 * @returns {Promise<Array>} Updated subquests array
 */
export async function addUserSubquest(subquest) {
  const subquests = await loadUserSubquests();
  const existingIndex = subquests.findIndex(s => s.id === subquest.id);
  if (existingIndex >= 0) {
    subquests[existingIndex] = { ...subquest, updatedAt: new Date().toISOString() };
  } else {
    subquests.unshift(subquest);
  }
  await saveUserSubquests(subquests);
  return subquests;
}

/**
 * Delete a subquest from storage
 * @param {string} subquestId
 * @returns {Promise<Array>} Updated subquests array
 */
export async function deleteUserSubquest(subquestId) {
  const subquests = await loadUserSubquests();
  const filtered = subquests.filter(s => s.id !== subquestId);
  await saveUserSubquests(filtered);
  return filtered;
}

/**
 * Get subquests for a specific parent quest
 * @param {string} parentQuestId
 * @returns {Promise<Array>}
 */
export async function getSubquestsForQuest(parentQuestId) {
  const allSubquests = await loadUserSubquests();
  return allSubquests.filter(s => s.parentQuestId === parentQuestId);
}

// Quest categories for organization
export const QUEST_CATEGORIES = {
  exercise: { label: "Exercise", icon: "💪", order: 1 },
  learning: { label: "Learning", icon: "📚", order: 2 },
  creative: { label: "Creative", icon: "🎨", order: 3 },
  wellness: { label: "Wellness", icon: "🧘", order: 4 },
  work: { label: "Work", icon: "💼", order: 5 },
  social: { label: "Social", icon: "👥", order: 6 },
  other: { label: "Other", icon: "⭐", order: 99 },
};

// =====================================================
// BUILT-IN QUEST TEMPLATES (v2 with baseStats)
// =====================================================
// These use the new schema with baseStats (0-3 per stat, max 4 total)
// and reference built-in subquests for specialization.

export const BUILT_IN_QUEST_TEMPLATES = [
  // ─────────────────────────────────────────────────────
  // EXERCISE: Parent quest with subquests for specialization
  // ─────────────────────────────────────────────────────
  {
    id: "exercise",
    label: "Exercise",
    category: "exercise",
    description: "Physical activity for health and fitness",
    defaultDurationMinutes: 30,
    baseStats: { STR: 1, DEX: 1, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
    // For backward compat, also include stats alias
    get stats() { return this.baseStats; },
    keywords: ["exercise", "workout", "fitness", "gym", "training"],
    action: null,
    subquestIds: ["weightlifting", "running", "yoga", "walking", "swimming", "sports"],
  },
  // Exercise subquests as standalone quests (can also be used directly)
  {
    id: "weightlifting",
    label: "Weightlifting",
    category: "exercise",
    description: "Strength training with weights",
    defaultDurationMinutes: 45,
    baseStats: { STR: 2, DEX: 0, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["weightlifting", "weights", "gym", "strength", "lift", "muscle"],
    action: null,
    parentQuestId: "exercise",
  },
  {
    id: "running",
    label: "Running",
    category: "exercise",
    description: "Cardio running or jogging",
    defaultDurationMinutes: 30,
    baseStats: { STR: 1, DEX: 0, STA: 2, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["running", "run", "jog", "cardio", "sprint"],
    action: null,
    parentQuestId: "exercise",
  },
  {
    id: "yoga",
    label: "Yoga",
    category: "exercise",
    description: "Yoga practice and stretching",
    defaultDurationMinutes: 30,
    baseStats: { STR: 0, DEX: 1, STA: 1, INT: 0, SPI: 1, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["yoga", "stretch", "flexibility", "pose", "mindful"],
    action: null,
    parentQuestId: "exercise",
  },
  {
    id: "walking",
    label: "Walking",
    category: "exercise",
    description: "Go for a walk or hike",
    defaultDurationMinutes: 30,
    baseStats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 1, CRE: 0, VIT: 2 },
    get stats() { return this.baseStats; },
    keywords: ["walking", "walk", "hike", "stroll", "nature"],
    action: null,
    parentQuestId: "exercise",
  },
  {
    id: "swimming",
    label: "Swimming",
    category: "exercise",
    description: "Full-body cardio in water",
    defaultDurationMinutes: 45,
    baseStats: { STR: 1, DEX: 0, STA: 2, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["swimming", "swim", "pool", "laps", "water"],
    action: null,
    parentQuestId: "exercise",
  },
  {
    id: "sports",
    label: "Sports",
    category: "exercise",
    description: "Team or individual sports",
    defaultDurationMinutes: 60,
    baseStats: { STR: 1, DEX: 1, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["sports", "basketball", "soccer", "tennis", "game"],
    action: null,
    parentQuestId: "exercise",
  },
  // ─────────────────────────────────────────────────────
  // LEARNING: Study and knowledge acquisition
  // ─────────────────────────────────────────────────────
  {
    id: "study",
    label: "Study",
    category: "learning",
    description: "Learning and knowledge acquisition",
    defaultDurationMinutes: 45,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CRE: 1, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["study", "learn", "education", "course"],
    action: null,
    subquestIds: ["math", "science", "reading", "language"],
  },
  {
    id: "math",
    label: "Math",
    category: "learning",
    description: "Mathematical study and problem-solving",
    defaultDurationMinutes: 60,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 3, SPI: 0, CRE: 1, VIT: 0 },
    get stats() { return this.baseStats; },
    keywords: ["math", "calculus", "algebra", "geometry", "statistics"],
    action: { type: "url", value: "https://mathacademy.com" },
    parentQuestId: "study",
  },
  {
    id: "science",
    label: "Science",
    category: "learning",
    description: "Science study or research",
    defaultDurationMinutes: 45,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CRE: 1, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["science", "physics", "chemistry", "biology", "research"],
    action: null,
    parentQuestId: "study",
  },
  {
    id: "reading",
    label: "Reading",
    category: "learning",
    description: "Read books, articles, or study material",
    defaultDurationMinutes: 30,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 1, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["reading", "book", "novel", "article", "study"],
    action: null,
    parentQuestId: "study",
  },
  {
    id: "language",
    label: "Language",
    category: "learning",
    description: "Learning a new language",
    defaultDurationMinutes: 30,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 1, CRE: 1, VIT: 0 },
    get stats() { return this.baseStats; },
    keywords: ["language", "spanish", "french", "japanese", "duolingo"],
    action: null,
    parentQuestId: "study",
  },
  // ─────────────────────────────────────────────────────
  // WORK: Professional activities
  // ─────────────────────────────────────────────────────
  {
    id: "work",
    label: "Work",
    category: "work",
    description: "Professional or job-related tasks",
    defaultDurationMinutes: 45,
    baseStats: { STR: 0, DEX: 0, STA: 1, INT: 1, SPI: 0, CRE: 1, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["work", "job", "office", "project", "task"],
    action: null,
    subquestIds: ["coding", "meetings", "professional-writing"],
  },
  {
    id: "coding",
    label: "Coding",
    category: "work",
    description: "Programming and software development",
    defaultDurationMinutes: 60,
    baseStats: { STR: 0, DEX: 0, STA: 1, INT: 2, SPI: 0, CRE: 1, VIT: 0 },
    get stats() { return this.baseStats; },
    keywords: ["coding", "programming", "develop", "software", "code"],
    action: null,
    parentQuestId: "work",
  },
  {
    id: "meetings",
    label: "Meetings",
    category: "work",
    description: "Professional meetings and calls",
    defaultDurationMinutes: 30,
    baseStats: { STR: 0, DEX: 0, STA: 1, INT: 1, SPI: 1, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["meeting", "call", "conference", "presentation"],
    action: null,
    parentQuestId: "work",
  },
  // ─────────────────────────────────────────────────────
  // WELLNESS: Mind and body care
  // ─────────────────────────────────────────────────────
  {
    id: "prayer",
    label: "Prayer",
    category: "wellness",
    description: "Prayer and spiritual reflection",
    defaultDurationMinutes: 20,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 3, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["prayer", "faith", "spiritual", "devotion"],
    action: null,
  },
  {
    id: "meditation",
    label: "Meditation",
    category: "wellness",
    description: "Mindfulness and meditation",
    defaultDurationMinutes: 15,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 2, CRE: 0, VIT: 2 },
    get stats() { return this.baseStats; },
    keywords: ["meditation", "mindfulness", "calm", "breathing"],
    action: null,
  },
  {
    id: "cleaning",
    label: "Cleaning",
    category: "wellness",
    description: "Clean and organize your space",
    defaultDurationMinutes: 20,
    baseStats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 1, CRE: 0, VIT: 2 },
    get stats() { return this.baseStats; },
    keywords: ["cleaning", "clean", "organize", "tidy", "chores"],
    action: null,
  },
  // ─────────────────────────────────────────────────────
  // CREATIVE: Artistic and creative expression
  // ─────────────────────────────────────────────────────
  {
    id: "writing",
    label: "Writing",
    category: "creative",
    description: "Creative or professional writing",
    defaultDurationMinutes: 30,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 1, CRE: 2, VIT: 0 },
    get stats() { return this.baseStats; },
    keywords: ["writing", "journal", "essay", "blog", "article"],
    action: null,
  },
  {
    id: "cooking",
    label: "Cooking",
    category: "creative",
    description: "Prepare a meal or learn recipes",
    defaultDurationMinutes: 30,
    baseStats: { STR: 0, DEX: 1, STA: 0, INT: 0, SPI: 0, CRE: 2, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["cooking", "cook", "meal", "food", "recipe", "baking"],
    action: null,
  },
  {
    id: "guitar",
    label: "Guitar / Music",
    category: "creative",
    description: "Practice an instrument or make music",
    defaultDurationMinutes: 45,
    baseStats: { STR: 0, DEX: 2, STA: 0, INT: 0, SPI: 1, CRE: 1, VIT: 0 },
    get stats() { return this.baseStats; },
    keywords: ["guitar", "music", "piano", "instrument", "song", "practice"],
    action: null,
  },
  {
    id: "art",
    label: "Art",
    category: "creative",
    description: "Drawing, painting, or digital art",
    defaultDurationMinutes: 45,
    baseStats: { STR: 0, DEX: 1, STA: 0, INT: 0, SPI: 1, CRE: 2, VIT: 0 },
    get stats() { return this.baseStats; },
    keywords: ["art", "draw", "paint", "sketch", "design", "digital"],
    action: null,
  },
  // ─────────────────────────────────────────────────────
  // SOCIAL: Social and community activities
  // ─────────────────────────────────────────────────────
  {
    id: "socialize",
    label: "Socialize",
    category: "social",
    description: "Social interaction and community building",
    defaultDurationMinutes: 60,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 2, CRE: 1, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["social", "friends", "family", "hangout", "community"],
    action: null,
    subquestIds: ["family-time", "friends", "community"],
  },
  {
    id: "family-time",
    label: "Family Time",
    category: "social",
    description: "Quality time with family",
    defaultDurationMinutes: 60,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 3, CRE: 0, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["family", "parents", "kids", "home"],
    action: null,
    parentQuestId: "socialize",
  },
  {
    id: "friends",
    label: "Friends",
    category: "social",
    description: "Hanging out with friends",
    defaultDurationMinutes: 60,
    baseStats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 2, CRE: 1, VIT: 1 },
    get stats() { return this.baseStats; },
    keywords: ["friends", "hangout", "socializing"],
    action: null,
    parentQuestId: "socialize",
  },
];

// Legacy alias: keep "stats" working by mapping from baseStats
// This ensures backward compatibility with existing code
BUILT_IN_QUEST_TEMPLATES.forEach(quest => {
  if (!quest.stats && quest.baseStats) {
    Object.defineProperty(quest, 'stats', {
      get() { return this.baseStats; },
      enumerable: true,
    });
  }
});

/**
 * Get all quests (built-in + user-created)
 * @returns {Promise<Array>}
 */
export async function getAllQuests() {
  const userQuests = await loadUserQuests();
  return [...userQuests, ...BUILT_IN_QUEST_TEMPLATES];
}

/**
 * Normalize stat preferences from chart values (1-5) to quest stats (0-3)
 * @param {object} chartStats - { STR: 1-5, ... }
 * @returns {object} - { STR: 0-3, ... }
 */
export function chartStatsToQuestStats(chartStats) {
  const result = {};
  STAT_KEYS.forEach(key => {
    const raw = chartStats?.[key] ?? 1;
    const clamped = Math.max(1, Math.min(5, raw));
    // Map 1-5 to 0-3 (roughly: 1-2 → 0, 3 → 1, 4 → 2, 5 → 3)
    const mapped = Math.max(0, Math.min(3, Math.round((clamped - 1) * 3 / 4)));
    result[key] = mapped;
  });
  return result;
}

/**
 * Convert quest stats (0-3) to chart values (1-6) based on allocation AND duration
 * Scale: E=1, D=2, C=3, B=4, A=5, S=6
 * 
 * Calibration: Max allocation (3) at 120 min = S (6)
 * - 30 min: C (3), 60 min: B (4), 90 min: A (5), 120 min: S (6)
 * - Formula: chart_value = 1 + (allocation/3) * (1 + duration/30)
 * 
 * @param {object} questStats - { STR: 0-3, ... }
 * @param {number} duration - Duration in minutes (default 0 for base allocation view)
 * @returns {object} - { STR: 1-6, ... }
 */
export function questStatsToChartStats(questStats, duration = 0) {
  const result = {};
  STAT_KEYS.forEach(key => {
    const allocation = Math.max(0, Math.min(3, questStats?.[key] ?? 0));
    if (allocation === 0) {
      result[key] = 1; // E tier - no focus
    } else {
      // Formula: 1 + (allocation/3) * (1 + duration/30)
      // At duration=0: base tier proportional to allocation
      // At duration=120 with allocation=3: reaches S (6)
      const value = 1 + (allocation / 3) * (1 + duration / 30);
      result[key] = Math.min(6, value); // Cap at S
    }
  });
  return result;
}

/**
 * Get the EXP gain distribution ratios for a quest
 * @param {object} questStats - { STR: 0-3, ... }
 * @returns {object} - { STR: 0-1, ... } ratios that sum to 1
 */
export function getExpDistribution(questStats) {
  const result = {};
  let total = 0;
  
  STAT_KEYS.forEach(key => {
    const allocation = Math.max(0, questStats?.[key] ?? 0);
    result[key] = allocation;
    total += allocation;
  });
  
  // Normalize to ratios
  if (total > 0) {
    STAT_KEYS.forEach(key => {
      result[key] = result[key] / total;
    });
  }
  
  return result;
}
