const STORAGE_KEY = "better-quest-state-v1";

export function loadState() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveState(state) {
  if (typeof localStorage === "undefined") return;
  try {
    const cleaned = {
      avatar: state.avatar,
      sessions: Array.isArray(state.sessions) ? state.sessions : [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore persistence errors in SLC.
  }
}


