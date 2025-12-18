import React, { createContext, useContext, useMemo, useReducer } from "react";
import { getDefaultState } from "../services/storage";

const AppStateContext = createContext(null);
const AppDispatchContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD": {
      const { key, value } = action;
      const nextValue = typeof value === "function" ? value(state[key]) : value;
      return { ...state, [key]: nextValue };
    }
    case "MERGE": {
      return { ...state, ...action.payload };
    }
    default:
      return state;
  }
}

export function AppStateProvider({ children, initialState }) {
  const [state, dispatch] = useReducer(reducer, initialState ?? getDefaultState());

  const actions = useMemo(
    () => ({
      setField: (key, value) => dispatch({ type: "SET_FIELD", key, value }),
      setUser: (value) => dispatch({ type: "SET_FIELD", key: "user", value }),
      setAvatar: (value) => dispatch({ type: "SET_FIELD", key: "avatar", value }),
      setSessions: (value) => dispatch({ type: "SET_FIELD", key: "sessions", value }),
      setMotivation: (value) => dispatch({ type: "SET_FIELD", key: "motivation", value }),
      setQuestStreaks: (value) => dispatch({ type: "SET_FIELD", key: "questStreaks", value }),
      setComboFromSessionId: (value) =>
        dispatch({ type: "SET_FIELD", key: "comboFromSessionId", value }),
      setWellRestedUntil: (value) =>
        dispatch({ type: "SET_FIELD", key: "wellRestedUntil", value }),
      setSunriseTimeLocal: (value) =>
        dispatch({ type: "SET_FIELD", key: "sunriseTimeLocal", value }),
      setFatigueAdapt: (value) => dispatch({ type: "SET_FIELD", key: "fatigueAdapt", value }),
      setFatigueAdaptNext: (value) =>
        dispatch({ type: "SET_FIELD", key: "fatigueAdaptNext", value }),
      setFatigueAdaptDay: (value) => dispatch({ type: "SET_FIELD", key: "fatigueAdaptDay", value }),
      setQuickStartMode: (value) =>
        dispatch({ type: "SET_FIELD", key: "quickStartMode", value }),
      setPickerDefaultMode: (value) =>
        dispatch({ type: "SET_FIELD", key: "pickerDefaultMode", value }),
      setPostSaveBehavior: (value) =>
        dispatch({ type: "SET_FIELD", key: "postSaveBehavior", value }),
      setUserQuotes: (value) =>
        dispatch({ type: "SET_FIELD", key: "userQuotes", value }),
      setIncludeBuiltInQuotes: (value) =>
        dispatch({ type: "SET_FIELD", key: "includeBuiltInQuotes", value }),
      setInAppAnnouncementsEnabled: (value) =>
        dispatch({ type: "SET_FIELD", key: "inAppAnnouncementsEnabled", value }),
      merge: (payload) => dispatch({ type: "MERGE", payload }),
    }),
    [],
  );

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={actions}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (ctx === null) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

export function useAppActions() {
  const ctx = useContext(AppDispatchContext);
  if (ctx === null) throw new Error("useAppActions must be used within AppStateProvider");
  return ctx;
}

export function useAvatar() {
  const state = useAppState();
  return state.avatar;
}

export function useUser() {
  const state = useAppState();
  return state.user;
}

export function useSessions() {
  const state = useAppState();
  return state.sessions;
}

export function useQuestStreaks() {
  const state = useAppState();
  return state.questStreaks;
}

export function usePreferences() {
  const state = useAppState();
  return {
    motivation: state.motivation,
    quickStartMode: state.quickStartMode,
    pickerDefaultMode: state.pickerDefaultMode,
    postSaveBehavior: state.postSaveBehavior,
    inAppAnnouncementsEnabled: state.inAppAnnouncementsEnabled ?? true,
  };
}

export function useQuotes() {
  const state = useAppState();
  return {
    userQuotes: state.userQuotes ?? [],
    includeBuiltInQuotes: state.includeBuiltInQuotes ?? true,
  };
}
