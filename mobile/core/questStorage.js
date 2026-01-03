import AsyncStorage from "@react-native-async-storage/async-storage";
import { STAT_KEYS } from "./models.js";

const USER_QUESTS_KEY = "better-quest-user-quests-v1";

/**
 * NOTE: `expo-file-system` and `expo-file-system/legacy` are Expo-native modules.
 * Our Node test runner (`node --test`) cannot import their TypeScript entrypoints,
 * so we lazy-load them only inside the image helpers.
 */
let _FileSystem = null;
let _questImagesDir = null;

async function getFileSystem() {
  if (_FileSystem) return _FileSystem;
  try {
    // Prefer the legacy API to avoid deprecation warnings in Expo SDK 54+.
    _FileSystem = await import("expo-file-system/legacy");
    return _FileSystem;
  } catch {
    try {
      // Fallback for environments where `/legacy` isn't available.
      _FileSystem = await import("expo-file-system");
      return _FileSystem;
    } catch {
      _FileSystem = null;
      return null;
    }
  }
}

async function getQuestImagesDir() {
  if (_questImagesDir) return _questImagesDir;
  const FileSystem = await getFileSystem();
  const documentDirectory = FileSystem?.documentDirectory ?? null;
  if (!documentDirectory) return null;
  _questImagesDir = `${documentDirectory}quest-images/`;
  return _questImagesDir;
}

/**
 * Ensure the quest images directory exists
 */
async function ensureQuestImagesDir() {
  const FileSystem = await getFileSystem();
  const QUEST_IMAGES_DIR = await getQuestImagesDir();
  if (!FileSystem || !QUEST_IMAGES_DIR) return;

  const info = await FileSystem.getInfoAsync(QUEST_IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEST_IMAGES_DIR, { intermediates: true });
  }
}

/**
 * Copy a selected image into app storage for persistence
 * @param {string} sourceUri - URI from image picker (temporary location)
 * @returns {Promise<string>} - Permanent file URI in app storage
 */
export async function persistQuestImageAsync(sourceUri) {
  if (!sourceUri) return null;
  try {
    const FileSystem = await getFileSystem();
    const QUEST_IMAGES_DIR = await getQuestImagesDir();
    if (!FileSystem || !QUEST_IMAGES_DIR) return null;

    await ensureQuestImagesDir();
    const filename = `quest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const destUri = `${QUEST_IMAGES_DIR}${filename}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch (err) {
    console.warn("Failed to persist quest image:", err);
    return null;
  }
}

/**
 * Delete a persisted quest image
 * @param {string} imageUri - URI to delete
 */
export async function deleteQuestImageAsync(imageUri) {
  if (!imageUri) return;
  try {
    const FileSystem = await getFileSystem();
    const QUEST_IMAGES_DIR = await getQuestImagesDir();
    if (!FileSystem || !QUEST_IMAGES_DIR) return;
    if (!imageUri.startsWith(QUEST_IMAGES_DIR)) return;

    const info = await FileSystem.getInfoAsync(imageUri);
    if (info.exists) {
      await FileSystem.deleteAsync(imageUri, { idempotent: true });
    }
  } catch (err) {
    console.warn("Failed to delete quest image:", err);
  }
}

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
  const toDelete = quests.find(q => q.id === questId) || null;
  // Best-effort cleanup of persisted quest images.
  if (toDelete?.imageUri) {
    await deleteQuestImageAsync(toDelete.imageUri);
  }
  const filtered = quests.filter(q => q.id !== questId);
  await saveUserQuests(filtered);
  return filtered;
}

// Built-in quest templates (general, simple, editable)
// Stats: STR=Strength, STA=Stamina, DEX=Dexterity, VIT=Vitality, INT=Intelligence, SPI=Spirit, CHA=Charisma
export const BUILT_IN_QUEST_TEMPLATES = [
  // ---------------------------------------------------------------------------
  // Taxonomy-aligned built-ins (2-level): families are startable; children are leaves.
  // We intentionally do NOT preserve legacy IDs — backend overhaul will reset data anyway.
  // ---------------------------------------------------------------------------

  // --- INT families ---
  {
    id: "study",
    label: "Study",
    description: "Learn or review something intentionally",
    defaultDurationMinutes: 25,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["study", "learn", "review", "homework", "exam"],
    tags: ["study", "learn", "review"],
    verb: "study",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "school-outline",
    authorName: "Better Quest",
  },
  {
    id: "read",
    label: "Read",
    description: "Read something (book, article, paper)",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 1, CHA: 0, VIT: 1 },
    keywords: ["read", "reading", "book", "article", "paper"],
    tags: ["read", "reading", "book", "article", "research"],
    verb: "read",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "book-outline",
    authorName: "Better Quest",
  },
  {
    id: "plan",
    label: "Plan",
    description: "Plan your next step (day, week, or project)",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["plan", "planning", "organize", "schedule"],
    tags: ["plan", "planning", "schedule"],
    verb: "plan",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "calendar-outline",
    authorName: "Better Quest",
  },

  // --- DEX families ---
  {
    id: "practice",
    label: "Practice",
    description: "Practice a skill (instrument, typing, language, etc.)",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["practice", "drill", "skill", "reps"],
    tags: ["practice", "drill", "skill"],
    verb: "practice",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "repeat-outline",
    authorName: "Better Quest",
  },
  {
    id: "build",
    label: "Build",
    description: "Build something (code, prototype, craft)",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["build", "make", "create", "prototype", "project"],
    tags: ["build", "prototype", "project", "coding"],
    verb: "build",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "construct-outline",
    authorName: "Better Quest",
  },

  // --- VIT families ---
  {
    id: "eat",
    label: "Eat",
    description: "Eat something healthy and intentional",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 1, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["eat", "food", "meal", "nutrition"],
    tags: ["eat", "meal", "nutrition", "healthy"],
    verb: "eat",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "restaurant-outline",
    authorName: "Better Quest",
  },
  {
    id: "drink",
    label: "Drink",
    description: "Hydrate (water, tea, etc.)",
    defaultDurationMinutes: 5,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["drink", "water", "hydrate", "hydration"],
    tags: ["drink", "water", "hydrate"],
    verb: "drink",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "water-outline",
    authorName: "Better Quest",
  },
  {
    id: "sleep",
    label: "Sleep",
    description: "Sleep and recovery",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["sleep", "nap", "rest", "recovery"],
    tags: ["sleep", "nap", "rest"],
    verb: "sleep",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "moon-outline",
    authorName: "Better Quest",
  },

  // --- SPI families ---
  {
    id: "meditate",
    label: "Meditate",
    description: "Mindfulness and meditation practice",
    defaultDurationMinutes: 10,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 2, CHA: 0, VIT: 1 },
    keywords: ["meditate", "meditation", "mindfulness", "calm"],
    tags: ["meditate", "meditation", "mindfulness"],
    verb: "meditate",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "leaf-outline",
    authorName: "Better Quest",
  },
  {
    id: "reflect",
    label: "Reflect",
    description: "Reflect or journal for clarity",
    defaultDurationMinutes: 10,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 2, CHA: 0, VIT: 0 },
    keywords: ["reflect", "reflection", "journal", "gratitude"],
    tags: ["reflect", "journal", "gratitude"],
    verb: "reflect",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "create-outline",
    authorName: "Better Quest",
  },

  // --- CHA families ---
  {
    id: "call",
    label: "Call Someone",
    description: "Call someone you care about and be present",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CHA: 2, VIT: 0 },
    keywords: ["call", "phone", "talk", "check-in"],
    tags: ["call", "phone", "check-in", "friend", "family"],
    verb: "call",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "call-outline",
    authorName: "Better Quest",
  },
  {
    id: "connect",
    label: "Connect",
    description: "Reach out and build connection",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 2, VIT: 0 },
    keywords: ["connect", "reach out", "network", "reconnect"],
    tags: ["connect", "reach out", "reconnect", "network"],
    verb: "connect",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "people-outline",
    authorName: "Better Quest",
  },

  // --- STR families ---
  {
    id: "lift",
    label: "Lift",
    description: "Lift weights / strength training",
    defaultDurationMinutes: 30,
    stats: { STR: 2, DEX: 0, STA: 1, INT: 0, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["lift", "weights", "gym", "strength"],
    tags: ["lift", "weights", "strength", "gym"],
    verb: "lift",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "barbell-outline",
    authorName: "Better Quest",
  },
  {
    id: "train",
    label: "Train",
    description: "Train your body (strength, conditioning, endurance)",
    defaultDurationMinutes: 30,
    stats: { STR: 1, DEX: 0, STA: 2, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["train", "workout", "exercise", "conditioning"],
    tags: ["train", "workout", "exercise"],
    verb: "train",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "fitness-outline",
    authorName: "Better Quest",
  },

  // --- Universal / meta families ---
  {
    id: "organize",
    label: "Organize",
    description: "Clean or organize your environment",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 1, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["organize", "clean", "tidy", "declutter"],
    tags: ["organize", "clean", "tidy", "declutter"],
    verb: "organize",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "sparkles-outline",
    authorName: "Better Quest",
  },
  {
    id: "complete",
    label: "Complete a Task",
    description: "Finish one small task end-to-end",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 1, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["complete", "finish", "task", "todo"],
    tags: ["complete", "finish", "task", "todo"],
    verb: "complete",
    parentId: null,
    isFamily: true,
    isStartable: true,
    action: null,
    icon: "checkmark-done-outline",
    authorName: "Better Quest",
  },

  // --- Study children (leaves) ---
  {
    id: "study-math",
    label: "Study Math",
    description: "Math practice (problem sets, courses, drills)",
    defaultDurationMinutes: 45,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["study", "math", "algebra", "calculus", "geometry"],
    tags: ["study", "math", "algebra", "calculus", "geometry"],
    verb: "study",
    parentId: "study",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "calculator-outline",
    authorName: "Better Quest",
  },
  {
    id: "study-biology",
    label: "Study Biology",
    description: "Biology study (notes, textbook, practice questions)",
    defaultDurationMinutes: 35,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["study", "biology", "science"],
    tags: ["study", "biology", "science"],
    verb: "study",
    parentId: "study",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "flask-outline",
    authorName: "Better Quest",
  },
  {
    id: "study-something-new",
    label: "Study Something New",
    description: "Explore a new topic for curiosity and novelty",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 0 },
    keywords: ["study", "learn", "new", "explore"],
    tags: ["study", "learn", "novelty", "explore"],
    verb: "study",
    parentId: "study",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "sparkles-outline",
    authorName: "Better Quest",
  },

  // --- Read children ---
  {
    id: "read-article",
    label: "Read an Article",
    description: "Read one article and capture 1 takeaway",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 1, CHA: 0, VIT: 0 },
    keywords: ["read", "article"],
    tags: ["read", "article"],
    verb: "read",
    parentId: "read",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "newspaper-outline",
    authorName: "Better Quest",
  },
  {
    id: "read-book",
    label: "Read a Book",
    description: "Read a book chapter (or 10 pages)",
    defaultDurationMinutes: 25,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 1, CHA: 0, VIT: 0 },
    keywords: ["read", "book", "chapter"],
    tags: ["read", "book"],
    verb: "read",
    parentId: "read",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "book-outline",
    authorName: "Better Quest",
  },

  // --- Plan children ---
  {
    id: "plan-week",
    label: "Plan Your Week",
    description: "Pick 3 priorities and schedule the first step",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["plan", "week", "schedule"],
    tags: ["plan", "week", "schedule"],
    verb: "plan",
    parentId: "plan",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "calendar-outline",
    authorName: "Better Quest",
  },
  {
    id: "plan-project",
    label: "Plan a Project",
    description: "Define outcome, constraints, and next action",
    defaultDurationMinutes: 25,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 0 },
    keywords: ["plan", "project"],
    tags: ["plan", "project"],
    verb: "plan",
    parentId: "plan",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "map-outline",
    authorName: "Better Quest",
  },

  // --- Practice children ---
  {
    id: "practice-typing",
    label: "Practice Typing",
    description: "Typing accuracy + speed practice",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 1, SPI: 0, CHA: 0, VIT: 0 },
    keywords: ["practice", "typing", "accuracy", "speed"],
    tags: ["practice", "typing"],
    verb: "practice",
    parentId: "practice",
    isFamily: false,
    isStartable: true,
    action: { type: "url", value: "https://monkeytype.com" },
    icon: "keypad-outline",
    authorName: "Better Quest",
  },
  {
    id: "practice-guitar",
    label: "Practice Guitar",
    description: "Practice an instrument (scales, song, technique)",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 0, SPI: 1, CHA: 0, VIT: 0 },
    keywords: ["practice", "guitar", "music", "instrument"],
    tags: ["practice", "guitar", "music", "instrument"],
    verb: "practice",
    parentId: "practice",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "musical-notes-outline",
    authorName: "Better Quest",
  },
  {
    id: "practice-speaking",
    label: "Practice Speaking",
    description: "Speak out loud: clarity, pacing, confidence",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 1, STA: 0, INT: 0, SPI: 0, CHA: 2, VIT: 0 },
    keywords: ["practice", "speaking", "public speaking", "presentation"],
    tags: ["practice", "speaking", "presentation"],
    verb: "practice",
    parentId: "practice",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "mic-outline",
    authorName: "Better Quest",
  },

  // --- Build children ---
  {
    id: "build-prototype",
    label: "Build a Prototype",
    description: "Make a tiny prototype (sketch, code, or mock)",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 0 },
    keywords: ["build", "prototype", "mock", "project"],
    tags: ["build", "prototype", "project"],
    verb: "build",
    parentId: "build",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "construct-outline",
    authorName: "Better Quest",
  },
  {
    id: "build-code-feature",
    label: "Code a Feature",
    description: "Build or ship a small feature",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 0 },
    keywords: ["build", "code", "coding", "feature", "software"],
    tags: ["build", "coding", "feature", "software"],
    verb: "build",
    parentId: "build",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "code-slash-outline",
    authorName: "Better Quest",
  },
  {
    id: "repair-fix-bug",
    label: "Fix a Bug",
    description: "Debug one bug end-to-end",
    defaultDurationMinutes: 25,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 2, SPI: 0, CHA: 0, VIT: 0 },
    keywords: ["fix", "bug", "debug", "repair"],
    tags: ["repair", "fix", "bug", "debug"],
    verb: "repair",
    parentId: "build",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "bug-outline",
    authorName: "Better Quest",
  },

  // --- Eat / drink / sleep children ---
  {
    id: "eat-balanced-meal",
    label: "Eat a Balanced Meal",
    description: "Protein + fiber + color",
    defaultDurationMinutes: 25,
    stats: { STR: 0, DEX: 1, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["eat", "meal", "balanced", "nutrition"],
    tags: ["eat", "meal", "balanced", "nutrition"],
    verb: "eat",
    parentId: "eat",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "restaurant-outline",
    authorName: "Better Quest",
  },
  {
    id: "eat-vegetables",
    label: "Eat Vegetables",
    description: "Add vegetables to your meal",
    defaultDurationMinutes: 10,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["eat", "vegetables", "healthy"],
    tags: ["eat", "vegetables"],
    verb: "eat",
    parentId: "eat",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "leaf-outline",
    authorName: "Better Quest",
  },
  {
    id: "drink-water",
    label: "Drink Water",
    description: "Drink a full glass of water",
    defaultDurationMinutes: 3,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["drink", "water", "hydrate"],
    tags: ["drink", "water", "hydrate"],
    verb: "drink",
    parentId: "drink",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "water-outline",
    authorName: "Better Quest",
  },
  {
    id: "sleep-8-hours",
    label: "Sleep 8 Hours",
    description: "Aim for a full night of sleep",
    defaultDurationMinutes: 30,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["sleep", "8 hours", "recovery"],
    tags: ["sleep", "recovery"],
    verb: "sleep",
    parentId: "sleep",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "moon-outline",
    authorName: "Better Quest",
  },
  {
    id: "nap-20",
    label: "Nap (20 min)",
    description: "Short recovery nap",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["nap", "sleep", "rest"],
    tags: ["nap", "sleep", "rest"],
    verb: "sleep",
    parentId: "sleep",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "moon-outline",
    authorName: "Better Quest",
  },

  // --- Meditate / reflect children ---
  {
    id: "meditate-breath",
    label: "Breath Meditation",
    description: "Simple breathing attention practice",
    defaultDurationMinutes: 10,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 2, CHA: 0, VIT: 1 },
    keywords: ["meditate", "breath", "breathing", "mindfulness"],
    tags: ["meditate", "breath", "mindfulness"],
    verb: "meditate",
    parentId: "meditate",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "leaf-outline",
    authorName: "Better Quest",
  },
  {
    id: "meditate-body-scan",
    label: "Body Scan",
    description: "Scan attention through the body",
    defaultDurationMinutes: 12,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 2, CHA: 0, VIT: 1 },
    keywords: ["meditate", "body scan", "mindfulness"],
    tags: ["meditate", "body scan", "mindfulness"],
    verb: "meditate",
    parentId: "meditate",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "leaf-outline",
    authorName: "Better Quest",
  },
  {
    id: "reflect-gratitude",
    label: "Gratitude List",
    description: "Write 3 things you’re grateful for",
    defaultDurationMinutes: 8,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 1, SPI: 2, CHA: 0, VIT: 0 },
    keywords: ["reflect", "gratitude", "journal"],
    tags: ["reflect", "gratitude", "journal"],
    verb: "reflect",
    parentId: "reflect",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "heart-outline",
    authorName: "Better Quest",
  },

  // --- Call / connect children ---
  {
    id: "call-friend",
    label: "Call a Friend",
    description: "Call someone you care about and be fully present",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CHA: 2, VIT: 0 },
    keywords: ["call", "phone", "friend", "family"],
    tags: ["call", "friend", "family"],
    verb: "call",
    parentId: "call",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "call-outline",
    authorName: "Better Quest",
  },
  {
    id: "connect-reach-out",
    label: "Reach Out",
    description: "Send one kind message to someone",
    defaultDurationMinutes: 10,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 2, VIT: 0 },
    keywords: ["connect", "reach out", "message"],
    tags: ["connect", "reach out", "message"],
    verb: "connect",
    parentId: "connect",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "chatbubble-ellipses-outline",
    authorName: "Better Quest",
  },
  {
    id: "connect-reconnect",
    label: "Reconnect",
    description: "Reconnect with someone you haven’t talked to in a while",
    defaultDurationMinutes: 10,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 2, VIT: 0 },
    keywords: ["connect", "reconnect", "reach out"],
    tags: ["connect", "reconnect"],
    verb: "connect",
    parentId: "connect",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "people-outline",
    authorName: "Better Quest",
  },

  // --- Lift / train children ---
  {
    id: "lift-weights",
    label: "Lift Weights",
    description: "Do a strength session (compound movements preferred)",
    defaultDurationMinutes: 45,
    stats: { STR: 2, DEX: 0, STA: 1, INT: 0, SPI: 0, CHA: 0, VIT: 1 },
    keywords: ["lift", "weights", "gym", "strength", "barbell"],
    tags: ["lift", "weights", "strength", "gym"],
    verb: "lift",
    parentId: "lift",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "barbell-outline",
    authorName: "Better Quest",
  },
  {
    id: "train-intervals",
    label: "Intervals",
    description: "Short hard cardio intervals",
    defaultDurationMinutes: 20,
    stats: { STR: 1, DEX: 0, STA: 2, INT: 0, SPI: 0, CHA: 0, VIT: 2 },
    keywords: ["intervals", "sprints", "hiit", "cardio"],
    tags: ["train", "intervals", "hiit", "sprints"],
    verb: "train",
    parentId: "train",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "speedometer-outline",
    authorName: "Better Quest",
  },
  {
    id: "train-walk",
    label: "Go for a Walk",
    description: "Walk outside (easy recovery movement)",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 1, INT: 0, SPI: 1, CHA: 0, VIT: 2 },
    keywords: ["walk", "walking", "stroll", "hike", "nature"],
    tags: ["walk", "walking", "nature"],
    verb: "train",
    parentId: "train",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "footsteps-outline",
    authorName: "Better Quest",
  },

  // --- Hybrids (canonical parent; surface via ranking; searchable via tags) ---
  {
    id: "teach-back",
    label: "Teach-back Session",
    description: "Explain what you learned out loud (or to someone)",
    defaultDurationMinutes: 15,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 2, VIT: 0 },
    keywords: ["teach", "teach-back", "explain", "mentor", "study"],
    tags: ["teach", "teach-back", "explain", "mentor", "study"],
    verb: "teach",
    parentId: "study",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "megaphone-outline",
    authorName: "Better Quest",
  },
  {
    id: "study-communications",
    label: "Study Communications",
    description: "Learn communication frameworks or practice explaining ideas",
    defaultDurationMinutes: 20,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CHA: 2, VIT: 0 },
    keywords: ["communications", "communication", "study", "speaking", "social"],
    tags: ["study", "teach", "communication", "speaking", "charisma"],
    verb: "study",
    parentId: "study",
    isFamily: false,
    isStartable: true,
    action: null,
    icon: "chatbubbles-outline",
    authorName: "Better Quest",
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
 * Normalize stat preferences from chart values (1-5) to quest stats (0-2)
 * @param {object} chartStats - { STR: 1-5, ... }
 * @returns {object} - { STR: 0-2, ... }
 */
export function chartStatsToQuestStats(chartStats) {
  const result = {};
  STAT_KEYS.forEach(key => {
    const raw = chartStats?.[key] ?? 1;
    const clamped = Math.max(1, Math.min(5, raw));
    // Map 1-5 to 0-2 (roughly: 1-2 → 0, 3 → 1, 4-5 → 2)
    const mapped = Math.max(0, Math.min(2, Math.round((clamped - 1) * 2 / 4)));
    result[key] = mapped;
  });
  return result;
}

/**
 * Convert quest stats (0-2) to chart values (1-6) based on allocation AND duration
 * Scale: E=1, D=2, C=3, B=4, A=5, S=6
 * 
 * Calibration: Max allocation (2) at 120 min = S (6)
 * - 30 min: C (3), 60 min: B (4), 90 min: A (5), 120 min: S (6)
 * - Formula: chart_value = 1 + (allocation/2) * (1 + duration/30)
 * 
 * @param {object} questStats - { STR: 0-2, ... }
 * @param {number} duration - Duration in minutes (default 0 for base allocation view)
 * @returns {object} - { STR: 1-6, ... }
 */
export function questStatsToChartStats(questStats, duration = 0) {
  const result = {};
  STAT_KEYS.forEach(key => {
    const allocation = Math.max(0, Math.min(2, questStats?.[key] ?? 0));
    if (allocation === 0) {
      result[key] = 1; // E tier - no focus
    } else {
      // Formula: 1 + (allocation/2) * (1 + duration/30)
      // At duration=0: base tier proportional to allocation
      // At duration=120 with allocation=2: reaches S (6)
      const value = 1 + (allocation / 2) * (1 + duration / 30);
      result[key] = Math.min(6, value); // Cap at S
    }
  });
  return result;
}

/**
 * Get the EXP gain distribution ratios for a quest
 * @param {object} questStats - { STR: 0-2, ... }
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
