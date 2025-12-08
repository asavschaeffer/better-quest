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
    // New action: Update Profile (syncs legacy fields)
    case "UPDATE_PROFILE": {
      const profile = typeof action.value === "function"
        ? action.value(state.profile)
        : { ...state.profile, ...action.value, updatedAt: new Date().toISOString() };
      return {
        ...state,
        profile,
        // Sync legacy fields for backward compatibility
        user: { ...state.user, name: profile.name, avatar: profile.avatar },
        avatar: profile.avatar,
        quickStartMode: profile.settings?.quickStartMode ?? state.quickStartMode,
        pickerDefaultMode: profile.settings?.pickerDefaultMode ?? state.pickerDefaultMode,
        postSaveBehavior: profile.settings?.postSaveBehavior ?? state.postSaveBehavior,
        includeBuiltInQuotes: profile.settings?.includeBuiltInQuotes ?? state.includeBuiltInQuotes,
      };
    }
    // New action: Add/Update ProgramSubscription
    case "UPSERT_SUBSCRIPTION": {
      const sub = action.value;
      const existing = state.programSubscriptions.findIndex(s => s.id === sub.id);
      let subscriptions;
      if (existing >= 0) {
        subscriptions = [...state.programSubscriptions];
        subscriptions[existing] = { ...sub, updatedAt: new Date().toISOString() };
      } else {
        subscriptions = [sub, ...state.programSubscriptions];
      }
      // Sync to profile
      const profile = {
        ...state.profile,
        programSubscriptionIds: subscriptions.map(s => s.id),
        updatedAt: new Date().toISOString(),
      };
      // Sync to legacy activeProgram (for backward compat)
      const activeProgram = subscriptions.find(s => s.status === "active")
        ? { kitId: subscriptions.find(s => s.status === "active").programId, startDate: subscriptions.find(s => s.status === "active").startDate, completedDays: subscriptions.find(s => s.status === "active").completedDayIds || [] }
        : null;
      return { ...state, programSubscriptions: subscriptions, profile, activeProgram };
    }
    // New action: Remove ProgramSubscription
    case "REMOVE_SUBSCRIPTION": {
      const subscriptions = state.programSubscriptions.filter(s => s.id !== action.id);
      const profile = {
        ...state.profile,
        programSubscriptionIds: subscriptions.map(s => s.id),
        updatedAt: new Date().toISOString(),
      };
      const activeProgram = subscriptions.find(s => s.status === "active")
        ? { kitId: subscriptions.find(s => s.status === "active").programId, startDate: subscriptions.find(s => s.status === "active").startDate, completedDays: [] }
        : null;
      return { ...state, programSubscriptions: subscriptions, profile, activeProgram };
    }
    // New action: Update TodoLists
    case "SET_TODO_LISTS": {
      return { ...state, todoLists: action.value };
    }
    // New action: Add/Update TodoList
    case "UPSERT_TODO_LIST": {
      const list = action.value;
      const existing = state.todoLists.findIndex(t => t.id === list.id);
      let todoLists;
      if (existing >= 0) {
        todoLists = [...state.todoLists];
        todoLists[existing] = { ...list, updatedAt: new Date().toISOString() };
      } else {
        todoLists = [list, ...state.todoLists];
      }
      return { ...state, todoLists };
    }
    default:
      return state;
  }
}

export function AppStateProvider({ children, initialState }) {
  const [state, dispatch] = useReducer(reducer, initialState ?? getDefaultState());

  const actions = useMemo(
    () => ({
      // Generic setters
      setField: (key, value) => dispatch({ type: "SET_FIELD", key, value }),
      merge: (payload) => dispatch({ type: "MERGE", payload }),

      // Legacy setters (kept for backward compatibility)
      setUser: (value) => dispatch({ type: "SET_FIELD", key: "user", value }),
      setAvatar: (value) => dispatch({ type: "SET_FIELD", key: "avatar", value }),
      setSessions: (value) => dispatch({ type: "SET_FIELD", key: "sessions", value }),
      setMotivation: (value) => dispatch({ type: "SET_FIELD", key: "motivation", value }),
      setQuestStreaks: (value) => dispatch({ type: "SET_FIELD", key: "questStreaks", value }),
      setComboFromSessionId: (value) =>
        dispatch({ type: "SET_FIELD", key: "comboFromSessionId", value }),
      setWellRestedUntil: (value) =>
        dispatch({ type: "SET_FIELD", key: "wellRestedUntil", value }),
      setHomeFooterConfig: (value) =>
        dispatch({ type: "SET_FIELD", key: "homeFooterConfig", value }),
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
      setActiveProgram: (value) =>
        dispatch({ type: "SET_FIELD", key: "activeProgram", value }),

      // New Profile-based actions
      updateProfile: (value) => dispatch({ type: "UPDATE_PROFILE", value }),

      // New ProgramSubscription actions
      upsertSubscription: (value) => dispatch({ type: "UPSERT_SUBSCRIPTION", value }),
      removeSubscription: (id) => dispatch({ type: "REMOVE_SUBSCRIPTION", id }),

      // New TodoList actions
      setTodoLists: (value) => dispatch({ type: "SET_TODO_LISTS", value }),
      upsertTodoList: (value) => dispatch({ type: "UPSERT_TODO_LIST", value }),
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
    homeFooterConfig: state.homeFooterConfig,
    quickStartMode: state.quickStartMode,
    pickerDefaultMode: state.pickerDefaultMode,
    postSaveBehavior: state.postSaveBehavior,
  };
}

export function useQuotes() {
  const state = useAppState();
  return {
    userQuotes: state.userQuotes ?? [],
    includeBuiltInQuotes: state.includeBuiltInQuotes ?? true,
  };
}

// =====================================================
// NEW HOOKS FOR V5 DATA MODEL
// =====================================================

/**
 * Get the current user's Profile
 */
export function useProfile() {
  const state = useAppState();
  return state.profile;
}

/**
 * Get all program subscriptions for the current user
 */
export function useProgramSubscriptions() {
  const state = useAppState();
  return state.programSubscriptions ?? [];
}

/**
 * Get the active program subscription (status === "active")
 */
export function useActiveSubscription() {
  const state = useAppState();
  const subscriptions = state.programSubscriptions ?? [];
  return subscriptions.find(s => s.status === "active") || null;
}

/**
 * Get all todo lists for the current user
 */
export function useTodoLists() {
  const state = useAppState();
  return state.todoLists ?? [];
}

/**
 * Get today's todo lists
 */
export function useTodaysTodoLists() {
  const state = useAppState();
  const todoLists = state.todoLists ?? [];
  const today = new Date().toISOString().split("T")[0];
  return todoLists.filter(list => list.date === today);
}

/**
 * Selector: Get profile settings (merged with legacy fields for compat)
 */
export function useProfileSettings() {
  const state = useAppState();
  return {
    quickStartMode: state.profile?.settings?.quickStartMode ?? state.quickStartMode ?? "picker",
    pickerDefaultMode: state.profile?.settings?.pickerDefaultMode ?? state.pickerDefaultMode ?? "top",
    postSaveBehavior: state.profile?.settings?.postSaveBehavior ?? state.postSaveBehavior ?? "library",
    includeBuiltInQuotes: state.profile?.settings?.includeBuiltInQuotes ?? state.includeBuiltInQuotes ?? true,
  };
}
