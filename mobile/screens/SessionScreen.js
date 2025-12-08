import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../../style";
import { StandStatsChart } from "../StandStatsChart";

export default function SessionScreen({ session, remainingMs, avatar, onCancel }) {
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Calculate progress: how much of the session is complete
  const totalMs = session.durationMinutes * 60 * 1000;
  const elapsedMs = totalMs - remainingMs;
  const progress = Math.max(0, Math.min(1, elapsedMs / totalMs));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quest in progress</Text>
      <Text style={styles.muted}>
        {avatar.name} • Lv {avatar.level}
      </Text>

      {/* Live stat growth visualization with countdown in center */}
      <StandStatsChart
        value={session.standStats}
        targetValue={session.targetStats}
        duration={session.durationMinutes}
        progress={progress}
        readOnly
        size={240}
        countdownText={formatted}
      />

      <View style={styles.timerBlock}>
        <Text style={styles.sessionEmoji}>{session.icon ?? "⏳"}</Text>
        <Text style={styles.sessionTitle}>{session.description}</Text>
      </View>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
        <Text style={styles.secondaryBtnText}>Cancel session</Text>
      </TouchableOpacity>
    </View>
  );
}
