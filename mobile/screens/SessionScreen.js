import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, Pressable, Text, View, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styles from "../../style";
import { StandClockChart } from "../components/StandClockChart";

export default function SessionScreen({ session, remainingMs, avatar, onDurationChange, onCancel }) {
  const insets = useSafeAreaInsets();
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const remainingMinutes = Math.max(0, remainingMs / 60000);

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

  // Tooltip visibility - show briefly on mount, then fade out
  const [showTooltip, setShowTooltip] = useState(true);
  const tooltipOpacity = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setShowTooltip(false));
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

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
        <StandClockChart
          value={session.standStats}
          targetValue={session.targetStats}
          durationMinutes={session.durationMinutes}
          remainingMinutes={remainingMinutes}
          allocation={session.allocation}
          progress={progress}
          size={320}
          countdownText={formatted}
          onDurationCommit={onDurationChange}
        />
        {/* Tooltip hint - fades out after 3 seconds */}
        {showTooltip && (
          <Animated.View
            style={{
              position: "absolute",
              bottom: -8,
              alignSelf: "center",
              backgroundColor: "rgba(99,102,241,0.9)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              opacity: tooltipOpacity,
            }}
            pointerEvents="none"
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "500" }}>
              Drag ring to adjust time
            </Text>
          </Animated.View>
        )}
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
