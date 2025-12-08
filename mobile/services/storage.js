import AsyncStorage from "@react-native-async-storage/async-storage";
import { createProfile, createDefaultAvatar } from "../core/dataModel";
import { migrateLegacyProgramState } from "../core/starterKits";

const STORAGE_KEY = "better-quest-mobile-state-v5";
const CURRENT_VERSION = 5;

// =====================================================
// MIGRATIONS
// =====================================================

const migrations = {
  // v1 -> v2: ensure homeFooterConfig flags default to true, normalize quickstart prefs
  1: (state) => {
    const next = { ...state };
    next.homeFooterConfig = {
      showCompletedToday: state.homeFooterConfig?.showCompletedToday ?? true,
      showUpcoming: state.homeFooterConfig?.showUpcoming ?? true,
    };
    if (state.quickStartMode !== "instant" && state.quickStartMode !== "picker") {
      next.quickStartMode = "picker";
    }
    if (state.pickerDefaultMode !== "top" && state.pickerDefaultMode !== "blank") {
      next.pickerDefaultMode = "top";
    }
    if (state.postSaveBehavior !== "library" && state.postSaveBehavior !== "picker") {
      next.postSaveBehavior = "library";
    }
    return next;
  },
  // v2 -> v3: add userQuotes array and includeBuiltInQuotes preference
  2: (state) => {
    const next = { ...state };
    next.userQuotes = state.userQuotes ?? [];
    next.includeBuiltInQuotes = state.includeBuiltInQuotes ?? true;
    return next;
  },
  // v3 -> v4: add activeProgram for starter kits
  3: (state) => {
    const next = { ...state };
    next.activeProgram = state.activeProgram ?? null;
    return next;
  },
  // v4 -> v5: Migrate to new data model with Profile, ProgramSubscription, TodoLists
  4: (state) => {
    const next = { ...state };
    const now = new Date().toISOString();

    // Generate a profile ID (will be used for all entities)
    const profileId = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Migrate user/avatar to Profile structure
    if (!next.profile) {
      const existingAvatar = state.avatar || state.user?.avatar;
      const existingName = state.user?.name || existingAvatar?.name || "Adventurer";

      next.profile = {
        id: profileId,
        name: existingName,
        avatar: existingAvatar || createDefaultAvatar(),
        programSubscriptionIds: [],
        settings: {
          quickStartMode: state.quickStartMode ?? "picker",
          pickerDefaultMode: state.pickerDefaultMode ?? "top",
          postSaveBehavior: state.postSaveBehavior ?? "library",
          includeBuiltInQuotes: state.includeBuiltInQuotes ?? true,
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

    // Migrate activeProgram to ProgramSubscription
    if (state.activeProgram && !next.programSubscriptions) {
      const subscription = migrateLegacyProgramState(state.activeProgram, profileId);
      if (subscription) {
        next.programSubscriptions = [subscription];
        next.profile.programSubscriptionIds = [subscription.id];
      } else {
        next.programSubscriptions = [];
      }
    } else if (!next.programSubscriptions) {
      next.programSubscriptions = [];
    }

    // Initialize empty collections for new entities
    next.todoLists = next.todoLists ?? [];
    next.dailySeries = next.dailySeries ?? [];

    // Keep legacy fields for backward compatibility during transition
    // These will be read by App.js until fully migrated
    next.user = next.user ?? { id: profileId, name: next.profile.name, avatar: next.profile.avatar };
    next.avatar = next.profile.avatar;

    return next;
  },
};

// =====================================================
// DEFAULT STATE
// =====================================================

function defaultState() {
  const now = new Date().toISOString();
  const profileId = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const defaultAvatar = createDefaultAvatar();

  return {
    // New Profile-based structure
    profile: {
      id: profileId,
      name: "Adventurer",
      avatar: defaultAvatar,
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
    },

    // New entity collections
    programSubscriptions: [],
    dailySeries: [],
    todoLists: [],

    // Existing data (kept for compatibility)
    sessions: [],
    questStreaks: {},

    // Legacy fields (kept for backward compatibility)
    user: { id: profileId, name: "Adventurer", avatar: defaultAvatar },
    avatar: defaultAvatar,
    motivation: "",
    comboFromSessionId: null,
    wellRestedUntil: null,
    homeFooterConfig: { showCompletedToday: true, showUpcoming: true },
    quickStartMode: "picker",
    pickerDefaultMode: "top",
    postSaveBehavior: "library",
    userQuotes: [],
    includeBuiltInQuotes: true,
    activeProgram: null, // Legacy: { kitId, startDate, completedDays: [] }
  };
}

export async function loadAppState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: CURRENT_VERSION, state: defaultState() };
    }
    const parsed = JSON.parse(raw);
    const savedVersion = parsed.version ?? 1;
    let state = parsed.state ?? defaultState();

    // Run forward migrations
    for (let v = savedVersion; v < CURRENT_VERSION; v += 1) {
      const migrate = migrations[v];
      if (typeof migrate === "function") {
        state = migrate(state);
      }
    }

    return { version: CURRENT_VERSION, state };
  } catch (err) {
    console.warn("Failed to load app state, using defaults", err);
    return { version: CURRENT_VERSION, state: defaultState() };
  }
}

export async function saveAppState(state) {
  try {
    const payload = JSON.stringify({ version: CURRENT_VERSION, state });
    await AsyncStorage.setItem(STORAGE_KEY, payload);
  } catch (err) {
    console.warn("Failed to persist app state", err);
  }
}

export async function clearAppState() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear app state", err);
  }
}

export function getDefaultState() {
  return defaultState();
}
