import AsyncStorage from "@react-native-async-storage/async-storage";
import { STAT_KEYS } from "./models.js";

const USER_QUESTS_KEY = "better-quest-user-quests-v1";

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

// Built-in quest templates (general, simple, editable)
// Stats: STR=Strength, STA=Stamina, DEX=Dexterity, VIT=Vitality, INT=Intelligence, SPI=Spirit, CHA=Charisma
export const BUILT_IN_QUEST_TEMPLATES = [
  {
    id: "math",
    label: "Math",
    description: "Study math, problem sets, or courses",
    defaultDurationMinutes: 60,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 3, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["math", "calculus", "algebra", "geometry", "study"],
    action: { type: "url", value: "https://mathacademy.com" },
  },
  {
    id: "science",
    label: "Science",
    description: "Science study or research",
    defaultDurationMinutes: 45,
    stats: { STR: 0, DEX: 1, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["science", "physics", "chemistry", "biology", "research"],
    action: null,
  },
  {
    id: "writing",
    label: "Writing",
    description: "Creative or professional writing",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 2, CHA: 0, VIT: 1 },
    keywords: ["writing", "journal", "essay", "blog", "article"],
    action: null,
  },
  {
    id: "reading",
    label: "Reading",
    description: "Read books, articles, or study material",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 1, CHA: 0, VIT: 1 },
    keywords: ["reading", "book", "novel", "article", "study"],
    action: null,
  },
  {
    id: "weightlifting",
    label: "Weightlifting",
    description: "Strength training at the gym",
    defaultDurationMinutes: 45,
    stats: { STR: 2, DEX: 0, STA: 1, INT: 0, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["weightlifting", "weights", "gym", "strength", "lift"],
    action: null,
  },
  {
    id: "running",
    label: "Running",
    description: "Cardio running or jogging",
    defaultDurationMinutes: 30,
    stats: { STR: 1, DEX: 0, STA: 2, INT: 0, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["running", "run", "jog", "cardio", "sprint"],
    action: null,
  },
  {
    id: "prayer",
    label: "Prayer",
    description: "Prayer and spiritual reflection",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 3, CHA: 0, VIT: 1 },
    keywords: ["prayer", "faith", "spiritual", "devotion"],
    action: null,
  },
  {
    id: "meditation",
    label: "Meditation",
    description: "Mindfulness and meditation",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 2, CHA: 0, VIT: 2 },
    keywords: ["meditation", "mindfulness", "calm", "breathing"],
    action: null,
  },
  {
    id: "yoga",
    label: "Yoga",
    description: "Yoga practice and stretching",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 1, STA: 1, INT: 0, SPI: 1, CHA: 0, VIT: 1 },
    keywords: ["yoga", "stretch", "flexibility", "pose"],
    action: null,
  },
  {
    id: "work",
    label: "Work",
    description: "Focused work session",
    defaultDurationMinutes: 45,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 1, SPI: 0, CHA: 1, VIT: 1 },
    keywords: ["work", "job", "office", "project", "task"],
    action: null,
  },
  {
    id: "cooking",
    label: "Cooking",
    description: "Prepare a meal or learn recipes",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["cooking", "cook", "meal", "food", "recipe", "baking"],
    action: null,
  },
  {
    id: "cleaning",
    label: "Cleaning",
    description: "Clean and organize your space",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 1, CHA: 0, VIT: 2 },
    keywords: ["cleaning", "clean", "organize", "tidy", "chores"],
    action: null,
  },
  {
    id: "walking",
    label: "Walking",
    description: "Go for a walk or hike",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 1, CHA: 0, VIT: 2 },
    keywords: ["walking", "walk", "hike", "stroll", "nature"],
    action: null,
  },
  {
    id: "guitar",
    label: "Guitar / Music",
    description: "Practice an instrument or make music",
    defaultDurationMinutes: 45,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 0, SPI: 1, CHA: 0, VIT: 1 },
    keywords: ["guitar", "music", "piano", "instrument", "song", "practice"],
    action: null,
  },
  {
    id: "socializing",
    label: "Socializing",
    description: "Spend time with friends or family",
    defaultDurationMinutes: 60,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CHA: 2, VIT: 1 },
    keywords: ["social", "friends", "family", "hangout", "party"],
    action: null,
  },
  {
    id: "presentation",
    label: "Presentation",
    description: "Public speaking or presenting",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 0, CHA: 2, VIT: 1 },
    keywords: ["presentation", "speech", "talk", "present", "public speaking"],
    action: null,
  },
];

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
