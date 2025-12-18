import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styles from "../../style";
import { StandStatsChart } from "../StandStatsChart";

export default function SessionScreen({ session, remainingMs, avatar, onCancel }) {
  const insets = useSafeAreaInsets();
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Calculate progress: how much of the session is complete
  const totalMs = session.durationMinutes * 60 * 1000;
  const elapsedMs = totalMs - remainingMs;
  const progress = Math.max(0, Math.min(1, elapsedMs / totalMs));

  // Clock-style focus mode: block accidental exits (Android back) and require an intentional cancel.
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const [isHoldingCancel, setIsHoldingCancel] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  useEffect(() => {
    if (!isHoldingCancel) return undefined;

    const start = Date.now();
    const HOLD_MS = 900;
    setHoldProgress(0);

    const id = setInterval(() => {
      const ratio = Math.max(0, Math.min(1, (Date.now() - start) / HOLD_MS));
      setHoldProgress(ratio);
      if (ratio >= 1) {
        clearInterval(id);
        setIsHoldingCancel(false);
        setHoldProgress(0);
        onCancel?.();
      }
    }, 16);

    return () => clearInterval(id);
  }, [isHoldingCancel, onCancel]);

  const headerLine = useMemo(() => {
    const name = avatar?.name ?? "Adventurer";
    const lv = avatar?.level ?? 1;
    return `${name} • Lv ${lv}`;
  }, [avatar]);

  return (
    <View
      style={[
        styles.sessionFocusContainer,
        {
          // Base paddings from styles.sessionFocusContainer (12 top / 20 bottom) + safe-area insets.
          paddingTop: 12 + (insets?.top ?? 0),
          paddingBottom: 20 + (insets?.bottom ?? 0),
        },
      ]}
    >
      <View style={styles.sessionFocusHeader}>
        <Text style={styles.sessionFocusMeta}>{headerLine}</Text>
        <Text style={styles.sessionFocusTitle} numberOfLines={2}>
          {(session?.icon ?? "⏳") + " " + (session?.description ?? "Quest")}
        </Text>
      </View>

      {/* Live stat-growth clock: countdown in center, progress on the outer ring */}
      <View style={styles.sessionFocusClockWrap}>
        <StandStatsChart
          value={session.standStats}
          targetValue={session.targetStats}
          duration={session.durationMinutes}
          progress={progress}
          readOnly
          size={320}
          countdownText={formatted}
        />
      </View>

      <View style={styles.sessionFocusFooter}>
        <Text style={styles.sessionFocusHint}>Focus mode • press and hold to cancel</Text>
        <Pressable
          onPressIn={() => setIsHoldingCancel(true)}
          onPressOut={() => {
            setIsHoldingCancel(false);
            setHoldProgress(0);
          }}
          style={({ pressed }) => [
            styles.sessionHoldBtn,
            pressed && styles.sessionHoldBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel session"
        >
          <View style={[styles.sessionHoldBtnFill, { width: `${holdProgress * 100}%` }]} />
          <Text style={styles.sessionHoldBtnText}>
            {isHoldingCancel ? "Keep holding…" : "Hold to cancel"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
