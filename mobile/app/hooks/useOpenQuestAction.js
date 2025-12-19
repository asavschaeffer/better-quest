import { useEffect, useMemo } from "react";
import { Platform, Linking } from "react-native";
import { getYouTubeAppUrlCandidates } from "../../core/linkPreviews";
import * as Sharing from "expo-sharing";

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
          // If it's already a URI (file://, content://, etc), keep it.
          if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
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

          // For file:// and content:// URIs, canOpenURL is not always reliable on iOS.
          // Treat it as a hint and try openURL directly.
          if (action.type === "file") {
            // iOS: Sharing is a more reliable way to open local files (PDFs, etc.) than Linking.openURL(file://).
            if (url.startsWith("file://") || url.startsWith("content://")) {
              const canShare = await Sharing.isAvailableAsync();
              if (canShare) {
                await Sharing.shareAsync(url);
                return;
              }
            }

            await Linking.openURL(url);
            return;
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


