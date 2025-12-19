import { useEffect, useMemo } from "react";
import { Platform, Linking } from "react-native";
import { getYouTubeAppUrlCandidates } from "../../core/linkPreviews";

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
          // Best UX: for known providers (YouTube), try opening the native app first.
          if (action.type === "url") {
            const candidates = getYouTubeAppUrlCandidates(url);
            for (const candidate of candidates) {
              try {
                // iOS canOpenURL() is restricted by LSApplicationQueriesSchemes (which Expo Go won't apply).
                // Instead, optimistically try openURL() and fall back on failure.
                await Linking.openURL(candidate);
                return;
              } catch {
                // Ignore and fall back to https
              }
            }
          }

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


