import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import styles from "../../../style";
import { groupSessionsByDay, getOrderedDayKeys } from "../../core/feed";
import { SessionRow } from "./SessionRow";

/**
 * FeedList - Renders a grouped list of sessions (by day)
 *
 * Used by HistoryScreen (with Insights) and FeedScreen (scoped feeds).
 *
 * @param {object} props
 * @param {object[]} props.sessions - Sessions to display
 * @param {string} [props.emptyText] - Text shown when no sessions
 * @param {string} [props.variant="history"] - Passed to SessionRow
 * @param {boolean} [props.showUserName=false] - Whether to show user names (for social feeds)
 * @param {object} [props.style] - Additional style for the ScrollView
 */
export function FeedList({
  sessions = [],
  emptyText = "No quests yet. Start your journey!",
  variant = "history",
  showUserName = false,
  style,
}) {
  const grouped = useMemo(() => groupSessionsByDay(sessions), [sessions]);
  const dayKeys = useMemo(() => getOrderedDayKeys(grouped), [grouped]);

  if (sessions.length === 0) {
    return (
      <ScrollView style={[styles.historyList, style]}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.historyList, style]}>
      {dayKeys.map((date) => (
        <View key={date}>
          <Text style={styles.historyDateHeader}>{date}</Text>
          {grouped[date].map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              variant={variant}
              showUserName={showUserName}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export default FeedList;
