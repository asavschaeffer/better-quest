import { useEffect, useMemo } from "react";
import { Platform, Linking } from "react-native";

export function useOpenQuestAction({ pendingQuestAction, setPendingQuestAction, isSessionActive }) {
  const openQuestAction = useMemo(() => {
    return async (action) => {
      if (!action || !action.value) return;

      try {
        let url = action.value.trim();

        if (action.type === "url") {
          if (!/^https?:\/\//i.test(url)) {
            url = "https://" + url;
          }
        } else if (action.type === "file") {
          if (!url.startsWith("file://")) {
            if (/^[a-zA-Z]:/.test(url)) {
              url = "file:///" + url.replace(/\\/g, "/");
            } else if (!url.startsWith("/")) {
              url = "file:///" + url;
            } else {
              url = "file://" + url;
            }
          }
        }

        if (Platform.OS === "web") {
          window.open(url, "_blank");
        } else {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          }
        }
      } catch (e) {
        console.log("Failed to open quest action:", e);
      }
    };
  }, []);

  // Open pending action when session starts
  useEffect(() => {
    if (pendingQuestAction && isSessionActive) {
      openQuestAction(pendingQuestAction);
      setPendingQuestAction(null);
    }
  }, [pendingQuestAction, isSessionActive, openQuestAction, setPendingQuestAction]);

  return { openQuestAction };
}


