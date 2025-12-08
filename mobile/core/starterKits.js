/**
 * =====================================================
 * STARTER KITS - Pre-made Programs
 * =====================================================
 *
 * These are Program templates that users can subscribe to.
 * Each contains:
 *   - DailySeriesTemplate[] for day structure
 *   - TodoListTemplate[] within each day for time-based groupings
 *   - Milestones for achievements
 *   - Unlockables for progressive quest access
 *
 * The new schema supports both legacy format (schedule object)
 * and the new hierarchical format (dailySeries array).
 */

// =====================================================
// HELPER: Convert legacy schedule to DailySeries
// =====================================================

/**
 * Build a standard daily series template from legacy schedule format
 * @param {object} schedule - { morning: [], afternoon: [], evening: [] }
 * @param {object} suggestedMinutes - { questId: minutes }
 * @returns {object} DailySeriesTemplate
 */
function buildDailyTemplate(schedule, suggestedMinutes = {}) {
  const todoLists = [];

  if (schedule.morning?.length) {
    todoLists.push({
      id: "morning",
      name: "Morning",
      timeSlot: "morning",
      questTemplateIds: schedule.morning,
      suggestedTimes: schedule.morning.reduce((acc, qId) => {
        if (suggestedMinutes[qId]) acc[qId] = suggestedMinutes[qId];
        return acc;
      }, {}),
    });
  }

  if (schedule.afternoon?.length) {
    todoLists.push({
      id: "afternoon",
      name: "Afternoon",
      timeSlot: "afternoon",
      questTemplateIds: schedule.afternoon,
      suggestedTimes: schedule.afternoon.reduce((acc, qId) => {
        if (suggestedMinutes[qId]) acc[qId] = suggestedMinutes[qId];
        return acc;
      }, {}),
    });
  }

  if (schedule.evening?.length) {
    todoLists.push({
      id: "evening",
      name: "Evening",
      timeSlot: "evening",
      questTemplateIds: schedule.evening,
      suggestedTimes: schedule.evening.reduce((acc, qId) => {
        if (suggestedMinutes[qId]) acc[qId] = suggestedMinutes[qId];
        return acc;
      }, {}),
    });
  }

  return {
    id: "daily",
    dayNumber: 1, // Repeating template
    name: "Daily Routine",
    todoLists,
  };
}

// =====================================================
// STARTER KITS (Programs)
// =====================================================

export const STARTER_KITS = [
  {
    id: "depression-escape",
    name: "Depression Escape",
    description: "Gentle daily habits to lift mood and build momentum",
    icon: "🌱",
    creatorId: null, // Built-in
    difficulty: "beginner",
    durationDays: 30,
    tags: ["mental-health", "habits", "beginner", "mood"],

    // Legacy format for backward compatibility
    quests: ["walking", "meditation", "cleaning", "writing"],
    schedule: {
      morning: ["walking"],
      afternoon: ["cleaning"],
      evening: ["meditation", "writing"],
    },
    suggestedMinutes: {
      walking: 20,
      meditation: 10,
      cleaning: 15,
      writing: 15,
    },

    // New hierarchical format
    get dailySeries() {
      return [buildDailyTemplate(this.schedule, this.suggestedMinutes)];
    },

    milestones: [
      { day: 3, title: "First Steps", description: "Completed 3 days!", reward: "badge-seedling" },
      { day: 7, title: "One Week Strong", description: "A full week of progress", reward: "badge-sprout" },
      { day: 14, title: "Two Weeks", description: "Building real habits now", reward: "badge-growing" },
      { day: 30, title: "Month Champion", description: "You did it!", reward: "badge-bloom" },
    ],
    unlockables: [
      { day: 7, questId: "yoga", description: "Unlock Yoga quest" },
      { day: 14, questId: "reading", description: "Unlock Reading quest" },
    ],

    metrics: { uses: 0, likes: 0, completionRate: 0 },
    isPublic: true,
  },
  {
    id: "brainrot-healing",
    name: "Brainrot Healing",
    description: "Rebuild focus and attention span with structured activities",
    icon: "🧠",
    creatorId: null,
    difficulty: "intermediate",
    durationDays: 21,
    tags: ["focus", "attention", "digital-detox", "productivity"],

    quests: ["reading", "meditation", "work", "walking"],
    schedule: {
      morning: ["meditation", "reading"],
      afternoon: ["work"],
      evening: ["walking"],
    },
    suggestedMinutes: {
      reading: 30,
      meditation: 15,
      work: 45,
      walking: 20,
    },

    get dailySeries() {
      return [buildDailyTemplate(this.schedule, this.suggestedMinutes)];
    },

    milestones: [
      { day: 3, title: "Screen Detox", description: "3 days of intentional focus", reward: "badge-focus" },
      { day: 7, title: "Clear Mind", description: "One week of mental clarity", reward: "badge-clarity" },
      { day: 14, title: "Deep Focus", description: "Attention span growing", reward: "badge-deep" },
      { day: 21, title: "Brain Restored", description: "Full program complete!", reward: "badge-brain" },
    ],
    unlockables: [
      { day: 5, questId: "writing", description: "Unlock Writing quest" },
      { day: 10, questId: "science", description: "Unlock Science quest" },
    ],

    metrics: { uses: 0, likes: 0, completionRate: 0 },
    isPublic: true,
  },
  {
    id: "fitness-kickstart",
    name: "Fitness Kickstart",
    description: "Start your fitness journey with beginner-friendly routines",
    icon: "💪",
    creatorId: null,
    difficulty: "beginner",
    durationDays: 28,
    tags: ["fitness", "exercise", "beginner", "health"],

    quests: ["walking", "yoga", "weightlifting"],
    schedule: {
      morning: ["walking"],
      afternoon: ["weightlifting"],
      evening: ["yoga"],
    },
    suggestedMinutes: {
      walking: 30,
      yoga: 20,
      weightlifting: 30,
    },

    get dailySeries() {
      return [buildDailyTemplate(this.schedule, this.suggestedMinutes)];
    },

    milestones: [
      { day: 7, title: "First Week", description: "Body is waking up!", reward: "badge-active" },
      { day: 14, title: "Halfway There", description: "Real progress happening", reward: "badge-strength" },
      { day: 21, title: "Almost There", description: "Habits forming", reward: "badge-endurance" },
      { day: 28, title: "Fitness Foundation", description: "You're ready for more!", reward: "badge-athlete" },
    ],
    unlockables: [
      { day: 7, questId: "running", description: "Unlock Running quest" },
    ],

    metrics: { uses: 0, likes: 0, completionRate: 0 },
    isPublic: true,
  },
  {
    id: "study-master",
    name: "Study Master",
    description: "Optimize your learning with proven study techniques",
    icon: "📚",
    creatorId: null,
    difficulty: "intermediate",
    durationDays: 14,
    tags: ["study", "learning", "education", "productivity"],

    quests: ["reading", "math", "science", "writing"],
    schedule: {
      morning: ["reading"],
      afternoon: ["math", "science"],
      evening: ["writing"],
    },
    suggestedMinutes: {
      reading: 30,
      math: 45,
      science: 45,
      writing: 20,
    },

    get dailySeries() {
      return [buildDailyTemplate(this.schedule, this.suggestedMinutes)];
    },

    milestones: [
      { day: 3, title: "Study Streak", description: "Learning momentum!", reward: "badge-book" },
      { day: 7, title: "Knowledge Week", description: "One week of growth", reward: "badge-scholar" },
      { day: 14, title: "Study Master", description: "Program complete!", reward: "badge-graduate" },
    ],
    unlockables: [],

    metrics: { uses: 0, likes: 0, completionRate: 0 },
    isPublic: true,
  },
  {
    id: "spiritual-journey",
    name: "Spiritual Journey",
    description: "Deepen your spiritual practice with daily devotion",
    icon: "✨",
    creatorId: null,
    difficulty: "beginner",
    durationDays: 40,
    tags: ["spiritual", "meditation", "prayer", "mindfulness"],

    quests: ["prayer", "meditation", "reading", "walking"],
    schedule: {
      morning: ["prayer", "reading"],
      evening: ["meditation", "walking"],
    },
    suggestedMinutes: {
      prayer: 20,
      meditation: 15,
      reading: 20,
      walking: 20,
    },

    get dailySeries() {
      return [buildDailyTemplate(this.schedule, this.suggestedMinutes)];
    },

    milestones: [
      { day: 7, title: "First Week", description: "Beginning the journey", reward: "badge-candle" },
      { day: 21, title: "Three Weeks", description: "Deepening practice", reward: "badge-peace" },
      { day: 40, title: "Journey Complete", description: "Spiritual foundation built", reward: "badge-enlightened" },
    ],
    unlockables: [],

    metrics: { uses: 0, likes: 0, completionRate: 0 },
    isPublic: true,
  },
];

/**
 * Get a starter kit (Program) by ID
 * @param {string} kitId
 * @returns {object|null}
 */
export function getStarterKit(kitId) {
  return STARTER_KITS.find(kit => kit.id === kitId) || null;
}

// Alias for new naming convention
export const getProgram = getStarterKit;

/**
 * Calculate program subscription progress
 * Works with both legacy activeProgram format and new ProgramSubscription format
 *
 * @param {object} subscription - ProgramSubscription or legacy { kitId, startDate, completedDays: [] }
 * @returns {object} Progress info
 */
export function calculateProgramProgress(subscription) {
  // Handle both new ProgramSubscription format and legacy format
  const programId = subscription?.programId || subscription?.kitId;
  const startDate = subscription?.startDate;
  const completedDayIds = subscription?.completedDayIds || subscription?.completedDays || [];

  if (!programId || !startDate) {
    return {
      currentDay: 0,
      completedDays: 0,
      totalDays: 0,
      progress: 0,
      progressPercent: 0,
      nextMilestone: null,
      unlockedQuests: [],
      isComplete: false,
      dayNumber: 0,
    };
  }

  const kit = getStarterKit(programId);
  if (!kit) {
    return {
      currentDay: 0,
      completedDays: 0,
      totalDays: 0,
      progress: 0,
      progressPercent: 0,
      nextMilestone: null,
      unlockedQuests: [],
      isComplete: false,
      dayNumber: 0,
    };
  }

  const start = new Date(startDate);
  const today = new Date();
  const daysSinceStart = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.min(daysSinceStart, kit.durationDays);
  const completedCount = completedDayIds.length;
  const progress = kit.durationDays > 0 ? completedCount / kit.durationDays : 0;

  // Find next milestone
  const nextMilestone = kit.milestones.find(m => m.day > completedCount) || null;

  // Find unlocked quests
  const unlockedQuests = (kit.unlockables || [])
    .filter(u => completedCount >= u.day)
    .map(u => u.questId);

  const isComplete = completedCount >= kit.durationDays;

  return {
    currentDay,
    dayNumber: currentDay,
    completedDays: completedCount,
    totalDays: kit.durationDays,
    progress,
    progressPercent: Math.round(progress * 100),
    nextMilestone,
    unlockedQuests,
    isComplete,
    status: subscription?.status || (isComplete ? "completed" : "active"),
  };
}

/**
 * Get today's suggested quests from active program subscription
 * Returns both legacy format (schedule object) and new format (todoLists)
 *
 * @param {object} subscription - ProgramSubscription or legacy format
 * @returns {object} - { morning: [], afternoon: [], evening: [], todoLists: [] }
 */
export function getTodaysSuggestedQuests(subscription) {
  const programId = subscription?.programId || subscription?.kitId;

  if (!programId) {
    return { morning: [], afternoon: [], evening: [], todoLists: [] };
  }

  const kit = getStarterKit(programId);
  if (!kit) {
    return { morning: [], afternoon: [], evening: [], todoLists: [] };
  }

  // Return both legacy and new formats
  const dailyTemplate = kit.dailySeries?.[0];

  return {
    // Legacy format
    morning: kit.schedule?.morning || [],
    afternoon: kit.schedule?.afternoon || [],
    evening: kit.schedule?.evening || [],
    // New format
    todoLists: dailyTemplate?.todoLists || [],
    // Suggested times
    suggestedMinutes: kit.suggestedMinutes || {},
  };
}

/**
 * Get today's TodoList templates from a program
 * This is the new API for generating user TodoLists from program templates
 *
 * @param {object} program - Program or starter kit
 * @param {number} dayNumber - Current day in the program (1-indexed)
 * @returns {Array} TodoListTemplate[]
 */
export function getDayTodoListTemplates(program, dayNumber = 1) {
  if (!program) return [];

  // Get the daily series template (most programs repeat the same day)
  const dailySeries = program.dailySeries || [];

  // For now, all starter kits have a single repeating day template
  // In the future, programs could have different templates for different days
  const template = dailySeries[0];

  if (!template?.todoLists) {
    // Fallback to legacy schedule conversion
    if (program.schedule) {
      return buildDailyTemplate(program.schedule, program.suggestedMinutes || {}).todoLists;
    }
    return [];
  }

  return template.todoLists;
}

/**
 * Create a ProgramSubscription from legacy activeProgram format
 * Used during migration
 *
 * @param {object} legacy - { kitId, startDate, completedDays: [] }
 * @param {string} profileId - User's profile ID
 * @returns {object} ProgramSubscription
 */
export function migrateLegacyProgramState(legacy, profileId) {
  if (!legacy?.kitId) return null;

  const now = new Date().toISOString();

  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    profileId,
    programId: legacy.kitId,
    startDate: legacy.startDate || now,
    endDate: null,
    status: "active",
    completedDayIds: (legacy.completedDays || []).map((_, i) => `day-${i + 1}`),
    unlockedQuestIds: legacy.unlockedQuests || [],
    customSettings: {
      reminderTime: null,
      notificationsEnabled: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}