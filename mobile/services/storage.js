import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "better-quest-mobile-state-v3";
const CURRENT_VERSION = 8;

const migrations = {
  // v1 -> v2: normalize quickstart prefs
  1: (state) => {
    const next = { ...state };
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
  // v3 -> v4: add manual sunrise time setting for Brahma Muhurta bonus (future: auto sunrise)
  3: (state) => {
    const next = { ...state };
    next.sunriseTimeLocal = state.sunriseTimeLocal ?? "06:30";
    return next;
  },
  // v4 -> v5: add fatigue adaptation multipliers (progressive overload)
  4: (state) => {
    const next = { ...state };
    next.fatigueAdapt = state.fatigueAdapt ?? null;
    next.fatigueAdaptNext = state.fatigueAdaptNext ?? null;
    next.fatigueAdaptDay = state.fatigueAdaptDay ?? null;
    return next;
  },
  // v5 -> v6: remove any debug-injected sessions (dev-only overlay seeding)
  5: (state) => {
    const next = { ...state };
    if (Array.isArray(state.sessions)) {
      next.sessions = state.sessions.filter(
        (s) => !(typeof s?.id === "string" && s.id.startsWith("debug-fatigue-spend-dex")),
      );
    }
    return next;
  },
  // v6 -> v7: add in-app announcements toggle (default enabled)
  6: (state) => {
    const next = { ...state };
    next.inAppAnnouncementsEnabled = state.inAppAnnouncementsEnabled ?? true;
    return next;
  },
  // v7 -> v8: remove obsolete homeFooterConfig (was used for an old Home footer UI)
  7: (state) => {
    const next = { ...state };
    if ("homeFooterConfig" in next) delete next.homeFooterConfig;
    return next;
  },
};

function defaultState() {
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return {
    user: null,
    avatar: null,
    sessions: [],
    motivation: "",
    questStreaks: {},
    comboFromSessionId: null,
    wellRestedUntil: null,
    quickStartMode: "picker",
    pickerDefaultMode: "top",
    postSaveBehavior: "library",
    userQuotes: [],
    includeBuiltInQuotes: true,
    // In-app announcements (controls the 🔔 on Home + the in-app notifications sheet)
    inAppAnnouncementsEnabled: true,
    // Manual sunrise time in local clock (HH:MM). Used for Brahma Muhurta bonus.
    // TODO: Replace with auto sunrise via location/timezone + sunrise calculation or API.
    sunriseTimeLocal: "06:30",
    // Progressive overload: per-stat budget multipliers
    fatigueAdapt: null,
    fatigueAdaptNext: null,
    fatigueAdaptDay: dayKey,
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
