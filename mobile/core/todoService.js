/**
 * =====================================================
 * TODO SERVICE
 * =====================================================
 *
 * Service for managing TodoLists, QuestInstances, and daily structure.
 * Handles generation of TodoLists from Program templates and
 * provides utilities for quest instance management.
 */

import { BUILT_IN_QUEST_TEMPLATES } from "./questStorage";
import { getStarterKit, getDayTodoListTemplates, calculateProgramProgress } from "./starterKits";
import { createTodoList, createQuestInstance, computeQuestStats } from "./dataModel";

// =====================================================
// TODO LIST GENERATION
// =====================================================

/**
 * Generate TodoLists for today from a program subscription
 *
 * @param {object} subscription - ProgramSubscription
 * @param {string} profileId - User's profile ID
 * @param {Array} userQuests - User's custom quests (for lookup)
 * @returns {Array} TodoList[]
 */
export function generateTodoListsForToday(subscription, profileId, userQuests = []) {
  if (!subscription?.programId && !subscription?.kitId) {
    return [];
  }

  const programId = subscription.programId || subscription.kitId;
  const program = getStarterKit(programId);
  if (!program) {
    return [];
  }

  const progress = calculateProgramProgress(subscription);
  const dayNumber = progress.currentDay || 1;
  const today = new Date().toISOString().split("T")[0];

  // Get todo list templates for this day
  const templates = getDayTodoListTemplates(program, dayNumber);

  // Generate TodoList instances from templates
  return templates.map((template, index) => {
    const todoList = createTodoList({
      profileId,
      dailySeriesId: null, // Will be set when DailySeries is created
      name: template.name,
      timeSlot: template.timeSlot,
      date: today,
    });

    // Set order based on time slot
    const slotOrder = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };
    todoList.order = slotOrder[template.timeSlot] ?? index;

    // Generate QuestInstances from template quest IDs
    todoList.quests = generateQuestInstancesFromTemplate(
      template,
      userQuests,
      progress.unlockedQuests
    );

    return todoList;
  });
}

/**
 * Generate QuestInstance[] from a TodoListTemplate
 *
 * @param {object} template - TodoListTemplate
 * @param {Array} userQuests - User's custom quests
 * @param {Array} unlockedQuestIds - Quests unlocked via program progress
 * @returns {Array} QuestInstance[]
 */
function generateQuestInstancesFromTemplate(template, userQuests = [], unlockedQuestIds = []) {
  const questIds = template.questTemplateIds || [];
  const suggestedTimes = template.suggestedTimes || {};

  return questIds
    .map((questId, index) => {
      // Find the quest template
      const quest = findQuestById(questId, userQuests);
      if (!quest) {
        console.warn(`Quest template not found: ${questId}`);
        return null;
      }

      // Check if quest is locked
      const isUnlockable = BUILT_IN_QUEST_TEMPLATES.some(
        q => q.id === questId && q.parentQuestId
      );
      // For now, allow all quests (unlockables will be filtered in UI if needed)

      // Get suggested duration
      const plannedDuration = suggestedTimes[questId] || quest.defaultDurationMinutes || 25;

      return createQuestInstance({
        questId: quest.id,
        quest,
        subquestId: null,
        subquest: null,
        plannedDurationMinutes: plannedDuration,
        order: index,
      });
    })
    .filter(Boolean);
}

/**
 * Find a quest by ID from user quests or built-in templates
 *
 * @param {string} questId
 * @param {Array} userQuests
 * @returns {object|null}
 */
export function findQuestById(questId, userQuests = []) {
  // Check user quests first
  const userQuest = userQuests.find(q => q.id === questId);
  if (userQuest) {
    return normalizeQuest(userQuest);
  }

  // Check built-in templates
  const builtIn = BUILT_IN_QUEST_TEMPLATES.find(q => q.id === questId);
  if (builtIn) {
    return normalizeQuest(builtIn);
  }

  return null;
}

/**
 * Normalize quest to ensure consistent shape (baseStats vs stats)
 *
 * @param {object} quest
 * @returns {object}
 */
function normalizeQuest(quest) {
  if (!quest) return null;

  return {
    ...quest,
    baseStats: quest.baseStats || quest.stats || {},
    // Ensure stats alias exists for backward compatibility
    get stats() {
      return this.baseStats;
    },
  };
}

// =====================================================
// QUEST INSTANCE OPERATIONS
// =====================================================

/**
 * Update a quest instance's status
 *
 * @param {object} todoList - The TodoList containing the quest
 * @param {string} questInstanceId - ID of the QuestInstance
 * @param {string} status - New status: pending | in_progress | completed | skipped
 * @param {object} updates - Additional updates (sessionId, completedAt, notes)
 * @returns {object} Updated TodoList
 */
export function updateQuestInstanceStatus(todoList, questInstanceId, status, updates = {}) {
  const now = new Date().toISOString();

  return {
    ...todoList,
    updatedAt: now,
    quests: todoList.quests.map(qi => {
      if (qi.id !== questInstanceId) return qi;

      const updated = {
        ...qi,
        status,
        ...updates,
      };

      if (status === "completed" && !updated.completedAt) {
        updated.completedAt = now;
      }

      return updated;
    }),
  };
}

/**
 * Add a quest instance to a TodoList
 *
 * @param {object} todoList
 * @param {object} quest - Quest template
 * @param {object} subquest - Optional subquest
 * @param {number} plannedDurationMinutes
 * @returns {object} Updated TodoList
 */
export function addQuestToTodoList(todoList, quest, subquest = null, plannedDurationMinutes) {
  const instance = createQuestInstance({
    questId: quest.id,
    quest,
    subquestId: subquest?.id || null,
    subquest,
    plannedDurationMinutes: plannedDurationMinutes || quest.defaultDurationMinutes || 25,
    order: todoList.quests.length,
  });

  return {
    ...todoList,
    updatedAt: new Date().toISOString(),
    quests: [...todoList.quests, instance],
  };
}

/**
 * Remove a quest instance from a TodoList
 *
 * @param {object} todoList
 * @param {string} questInstanceId
 * @returns {object} Updated TodoList
 */
export function removeQuestFromTodoList(todoList, questInstanceId) {
  return {
    ...todoList,
    updatedAt: new Date().toISOString(),
    quests: todoList.quests.filter(qi => qi.id !== questInstanceId),
  };
}

/**
 * Reorder quests in a TodoList
 *
 * @param {object} todoList
 * @param {string} questInstanceId
 * @param {number} newIndex
 * @returns {object} Updated TodoList
 */
export function reorderQuestInTodoList(todoList, questInstanceId, newIndex) {
  const quests = [...todoList.quests];
  const currentIndex = quests.findIndex(qi => qi.id === questInstanceId);

  if (currentIndex === -1 || currentIndex === newIndex) {
    return todoList;
  }

  const [removed] = quests.splice(currentIndex, 1);
  quests.splice(newIndex, 0, removed);

  // Update order field
  const reordered = quests.map((qi, i) => ({ ...qi, order: i }));

  return {
    ...todoList,
    updatedAt: new Date().toISOString(),
    quests: reordered,
  };
}

// =====================================================
// TODO LIST COMPLETION
// =====================================================

/**
 * Calculate completion stats for a TodoList
 *
 * @param {object} todoList
 * @returns {object} { total, completed, skipped, pending, inProgress, completionRate }
 */
export function calculateTodoListProgress(todoList) {
  const quests = todoList?.quests || [];
  const total = quests.length;
  const completed = quests.filter(q => q.status === "completed").length;
  const skipped = quests.filter(q => q.status === "skipped").length;
  const inProgress = quests.filter(q => q.status === "in_progress").length;
  const pending = quests.filter(q => q.status === "pending").length;

  return {
    total,
    completed,
    skipped,
    pending,
    inProgress,
    completionRate: total > 0 ? completed / total : 0,
    isDone: completed + skipped === total && total > 0,
  };
}

/**
 * Get the next pending quest in a TodoList
 *
 * @param {object} todoList
 * @returns {object|null} Next QuestInstance or null
 */
export function getNextPendingQuest(todoList) {
  const quests = todoList?.quests || [];
  return quests.find(q => q.status === "pending") || null;
}

// =====================================================
// DAILY AGGREGATION
// =====================================================

/**
 * Get all TodoLists for a specific date
 *
 * @param {Array} allTodoLists
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Array} TodoList[]
 */
export function getTodoListsForDate(allTodoLists, date) {
  return (allTodoLists || []).filter(list => list.date === date);
}

/**
 * Get today's TodoLists sorted by time slot
 *
 * @param {Array} allTodoLists
 * @returns {Array} TodoList[]
 */
export function getTodaysTodoLists(allTodoLists) {
  const today = new Date().toISOString().split("T")[0];
  const lists = getTodoListsForDate(allTodoLists, today);

  // Sort by time slot order
  const slotOrder = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };
  return lists.sort((a, b) => {
    const orderA = slotOrder[a.timeSlot] ?? a.order ?? 99;
    const orderB = slotOrder[b.timeSlot] ?? b.order ?? 99;
    return orderA - orderB;
  });
}

/**
 * Calculate daily completion across all TodoLists
 *
 * @param {Array} todoLists - TodoLists for a single day
 * @returns {object} Aggregated stats
 */
export function calculateDailyProgress(todoLists) {
  let totalQuests = 0;
  let completedQuests = 0;
  let skippedQuests = 0;

  (todoLists || []).forEach(list => {
    const progress = calculateTodoListProgress(list);
    totalQuests += progress.total;
    completedQuests += progress.completed;
    skippedQuests += progress.skipped;
  });

  return {
    totalQuests,
    completedQuests,
    skippedQuests,
    pendingQuests: totalQuests - completedQuests - skippedQuests,
    completionRate: totalQuests > 0 ? completedQuests / totalQuests : 0,
    isDayComplete: completedQuests + skippedQuests === totalQuests && totalQuests > 0,
  };
}

// =====================================================
// STANDALONE TODO LIST (No Program)
// =====================================================

/**
 * Create a standalone TodoList (not from a program)
 *
 * @param {string} profileId
 * @param {string} name
 * @param {string} timeSlot
 * @returns {object} TodoList
 */
export function createStandaloneTodoList(profileId, name = "My Tasks", timeSlot = "anytime") {
  const today = new Date().toISOString().split("T")[0];

  return createTodoList({
    profileId,
    dailySeriesId: null,
    name,
    timeSlot,
    date: today,
  });
}
