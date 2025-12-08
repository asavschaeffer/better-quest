import { useMemo, useState, useCallback } from "react";

export const Screens = {
  HOME: "home",
  LIBRARY: "library",
  HISTORY: "history",
  LEADERBOARD: "leaderboard",
  PROFILE: "profile",
  SETTINGS: "settings",
  QUEST: "quest",
  NEW_QUEST: "newQuest",
  SESSION: "session",
  COMPLETE: "complete",
};

export function useNavigation(initialScreen = Screens.HOME) {
  const [screen, setScreen] = useState(initialScreen);
  const [activeTab, setActiveTab] = useState(Screens.HOME);

  const navigate = useCallback(
    (next) => {
      setScreen(next);
      if (
        next === Screens.HOME ||
        next === Screens.LIBRARY ||
        next === Screens.HISTORY ||
        next === Screens.LEADERBOARD ||
        next === Screens.SETTINGS
      ) {
        setActiveTab(next);
      }
    },
    [setScreen, setActiveTab],
  );

  const state = useMemo(() => ({ screen, activeTab }), [screen, activeTab]);

  return { state, navigate, setActiveTab, setScreen };
}
