import React from "react";
import { View, Text } from "react-native";
import styles from "../../../style";
import { ActivityEventType } from "../../core/activityEvents";
import { SessionRow } from "./SessionRow";

export function ActivityRow({ item, variant = "history", showUserName = false }) {
  if (!item) return null;

  // Back-compat: allow passing raw sessions as items.
  if (!item.type && item.description) {
    return <SessionRow session={item} variant={variant} showUserName={showUserName} />;
  }

  if (item.type === ActivityEventType.SESSION_COMPLETED) {
    return <SessionRow session={item.session} variant={variant} showUserName={showUserName} />;
  }

  if (item.type === ActivityEventType.LEVEL_UP) {
    const to = item.toLevel ?? null;
    const from = item.fromLevel ?? null;
    const label =
      to && from
        ? `Level up: Lv ${from} → Lv ${to}`
        : to
          ? `Level up: Lv ${to}`
          : "Level up";
    return (
      <View style={styles.historySessionItem}>
        <Text style={styles.historySessionTitle}>{label}</Text>
        <Text style={styles.historySessionMeta}>Milestone</Text>
      </View>
    );
  }

  if (item.type === ActivityEventType.STREAK_MILESTONE) {
    const days = item.streakDays ?? 0;
    return (
      <View style={styles.historySessionItem}>
        <Text style={styles.historySessionTitle}>Streak milestone</Text>
        <Text style={styles.historySessionMeta}>{days} day streak</Text>
      </View>
    );
  }

  // Unknown event type: render a generic row so the feed never breaks.
  return (
    <View style={styles.historySessionItem}>
      <Text style={styles.historySessionTitle}>Activity</Text>
      <Text style={styles.historySessionMeta}>{String(item.type || "event")}</Text>
    </View>
  );
}

export default ActivityRow;


