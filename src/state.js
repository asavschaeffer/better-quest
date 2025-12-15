import { loadState, saveState } from "./storage.js";

export function hydrateStateFromStorage({ user, setUser, setAvatar, setSessions, setMotivation, setWellRestedUntil, setComboFromSessionId, motivationInput }) {
  const state = loadState();
  if (!state) return;

  if (state.avatar) {
    setAvatar(state.avatar);
    if (setUser) {
      setUser({ ...user, avatar: state.avatar });
    }
  }
  if (Array.isArray(state.sessions)) {
    setSessions(state.sessions);
  }
  if (typeof state.motivation === "string") {
    setMotivation(state.motivation);
    if (motivationInput) {
      motivationInput.value = state.motivation;
    }
  }
  if (state.wellRestedUntil) {
    setWellRestedUntil(state.wellRestedUntil);
  }
  if (state.comboFromSessionId) {
    setComboFromSessionId(state.comboFromSessionId);
  }
}

export function persistStateToStorage({ avatar, sessions, motivation, wellRestedUntil, comboFromSessionId }) {
  saveState({ avatar, sessions, motivation, wellRestedUntil, comboFromSessionId });
}


