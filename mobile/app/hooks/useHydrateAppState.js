import { useEffect, useState } from "react";

import { createUser } from "../../core/models.js";
import { loadUserQuests } from "../../core/questStorage.js";
import { loadAppState } from "../../services/storage.js";

export function useHydrateAppState(actions) {
  const [userQuests, setUserQuests] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { state: persisted } = await loadAppState();
        const hydratedUser =
          persisted.user ??
          (persisted.avatar
            ? { ...createUser(), avatar: persisted.avatar }
            : createUser());

        actions.setUser(hydratedUser);
        if (Array.isArray(persisted.sessions)) {
          actions.setSessions(persisted.sessions);
        }
        if (typeof persisted.motivation === "string") {
          actions.setMotivation(persisted.motivation);
        }
        if (persisted.questStreaks && typeof persisted.questStreaks === "object") {
          actions.setQuestStreaks(persisted.questStreaks);
        }
        if (persisted.comboFromSessionId) {
          actions.setComboFromSessionId(persisted.comboFromSessionId);
        }
        if (persisted.wellRestedUntil) {
          actions.setWellRestedUntil(persisted.wellRestedUntil);
        }
        if (persisted.homeFooterConfig) {
          actions.setHomeFooterConfig({
            showCompletedToday: persisted.homeFooterConfig.showCompletedToday ?? true,
            showUpcoming: persisted.homeFooterConfig.showUpcoming ?? true,
          });
        }
        if (persisted.quickStartMode === "instant" || persisted.quickStartMode === "picker") {
          actions.setQuickStartMode(persisted.quickStartMode);
        }
        if (persisted.pickerDefaultMode === "top" || persisted.pickerDefaultMode === "blank") {
          actions.setPickerDefaultMode(persisted.pickerDefaultMode);
        }
        if (persisted.postSaveBehavior === "library" || persisted.postSaveBehavior === "picker") {
          actions.setPostSaveBehavior(persisted.postSaveBehavior);
        }

        // Load quotes preferences
        if (Array.isArray(persisted.userQuotes)) {
          actions.setUserQuotes(persisted.userQuotes);
        }
        if (typeof persisted.includeBuiltInQuotes === "boolean") {
          actions.setIncludeBuiltInQuotes(persisted.includeBuiltInQuotes);
        }

        // Load user quests
        const quests = await loadUserQuests();
        if (!cancelled) setUserQuests(quests);
      } catch (err) {
        console.warn("Failed to hydrate state", err);
        actions.setUser(createUser());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actions]);

  return { userQuests, setUserQuests };
}


