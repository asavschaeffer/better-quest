import { useEffect } from "react";

import { saveAppState } from "../../services/storage.js";

export function usePersistAppState(state) {
  useEffect(() => {
    const save = async () => {
      await saveAppState({
        user: state.user,
        avatar: state.user?.avatar,
        sessions: state.sessions,
        motivation: state.motivation,
        questStreaks: state.questStreaks,
        comboFromSessionId: state.comboFromSessionId,
        wellRestedUntil: state.wellRestedUntil,
        sunriseTimeLocal: state.sunriseTimeLocal,
        homeFooterConfig: state.homeFooterConfig,
        quickStartMode: state.quickStartMode,
        pickerDefaultMode: state.pickerDefaultMode,
        postSaveBehavior: state.postSaveBehavior,
        userQuotes: state.userQuotes,
        includeBuiltInQuotes: state.includeBuiltInQuotes,
      });
    };
    save();
  }, [
    state.user,
    state.sessions,
    state.motivation,
    state.questStreaks,
    state.comboFromSessionId,
    state.wellRestedUntil,
    state.sunriseTimeLocal,
    state.homeFooterConfig,
    state.quickStartMode,
    state.pickerDefaultMode,
    state.postSaveBehavior,
    state.userQuotes,
    state.includeBuiltInQuotes,
  ]);
}


