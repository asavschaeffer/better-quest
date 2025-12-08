import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "better-quest-mobile-state-v2";
const CURRENT_VERSION = 2;

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
};

function defaultState() {
  return {
    user: null,
    avatar: null,
    sessions: [],
    motivation: "",
    questStreaks: {},
    comboFromSessionId: null,
    wellRestedUntil: null,
    homeFooterConfig: { showCompletedToday: true, showUpcoming: true },
    quickStartMode: "picker",
    pickerDefaultMode: "top",
    postSaveBehavior: "library",
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
