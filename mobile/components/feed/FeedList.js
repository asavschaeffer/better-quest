import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import styles from "../../../style";
import { groupSessionsByDay, getOrderedDayKeys } from "../../core/feed";
import { getActivityEventTimestamp } from "../../core/activityEvents";
import { SessionRow } from "./SessionRow";
import { ActivityRow } from "./ActivityRow";

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
 * @param {function} [props.onPressUser] - Called when user avatar/name is tapped
 * @param {function} [props.onPressSession] - Called when session card is tapped
 * @param {object} [props.style] - Additional style for the ScrollView
 */
export function FeedList({
  sessions = [],
  items = null,
  emptyText = "No quests yet. Start your journey!",
  variant = "history",
  showUserName = false,
  onPressUser,
  onPressSession,
  header = null,
  style,
}) {
  const hasItems = Array.isArray(items);

  const grouped = useMemo(() => {
    if (!hasItems) return groupSessionsByDay(sessions);
    const groups = {};
    (items || []).forEach((it) => {
      const dateKey = getActivityEventTimestamp(it).toLocaleDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(it);
    });
    return groups;
  }, [hasItems, items, sessions]);

  const dayKeys = useMemo(() => getOrderedDayKeys(grouped), [grouped]);

  const empty = hasItems ? (items?.length ?? 0) === 0 : sessions.length === 0;
  if (empty) {
    return (
      <ScrollView style={[styles.historyList, style]}>
        {header}
        <Text style={styles.emptyText}>{emptyText}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.historyList, style]}>
      {header}
      {dayKeys.map((date) => (
        <View key={date}>
          <Text style={styles.historyDateHeader}>{date}</Text>
          {grouped[date].map((row) => {
            // Back-compat: sessions-only lists.
            if (!hasItems) {
              return (
                <SessionRow
                  key={row.id}
                  session={row}
                  variant={variant}
                  showUserName={showUserName}
                  onPressUser={onPressUser}
                  onPressSession={onPressSession}
                />
              );
            }
            return (
              <ActivityRow
                key={row.id}
                item={row}
                variant={variant}
                showUserName={showUserName}
                onPressUser={onPressUser}
                onPressSession={onPressSession}
              />
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

export default FeedList;
