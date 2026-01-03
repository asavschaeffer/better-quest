import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { STAT_ATTRS } from "../RadarChartCore";

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 */
function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Get initials from username
 */
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Get top stats from standExp, sorted by value
 */
function getTopStats(standExp, limit = 3) {
  if (!standExp) return [];
  return Object.entries(standExp)
    .filter(([, val]) => val > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, val]) => {
      const attr = STAT_ATTRS.find((a) => a.key === key);
      return { key, value: val, color: attr?.color || "#6b7280" };
    });
}

/**
 * SessionRow - Renders a single session as a card in a feed/history list
 * 
 * @param {function} onPressUser - Called when avatar/username is tapped (navigates to profile)
 * @param {function} onPressSession - Called when card body is tapped (navigates to session details)
 */
export function SessionRow({ 
  session, 
  variant = "history", 
  showUserName = false,
  onPressUser,
  onPressSession,
}) {
  if (!session) return null;

  const hasUserInfo = showUserName && session.userName;
  const topStats = getTopStats(session.expResult?.standExp, 3);
  const timeAgo = formatTimeAgo(session.completedAt);

  const handlePressUser = () => {
    if (onPressUser && hasUserInfo) {
      onPressUser({
        name: session.userName,
        level: session.userLevel,
        // Add more user data as available
      });
    }
  };

  const handlePressSession = () => {
    if (onPressSession) {
      onPressSession(session);
    }
  };

  return (
    <Pressable 
      style={localStyles.card}
      onPress={handlePressSession}
      android_ripple={{ color: "rgba(165, 180, 252, 0.1)" }}
    >
      {/* Header: Avatar + User Info + Time */}
      {hasUserInfo ? (
        <View style={localStyles.header}>
          <TouchableOpacity 
            style={localStyles.userTouchable}
            onPress={handlePressUser}
            activeOpacity={0.7}
          >
            <View style={localStyles.avatar}>
              <Text style={localStyles.avatarText}>{getInitials(session.userName)}</Text>
            </View>
            <View style={localStyles.userInfo}>
              <Text style={localStyles.userName}>{session.userName}</Text>
              <Text style={localStyles.userLevel}>Level {session.userLevel || 1}</Text>
            </View>
          </TouchableOpacity>
          <Text style={localStyles.timeAgo}>{timeAgo}</Text>
        </View>
      ) : (
        <View style={localStyles.headerCompact}>
          <Text style={localStyles.timeAgo}>{timeAgo}</Text>
        </View>
      )}

      {/* Quest Title */}
      <Text style={localStyles.questTitle}>{session.description}</Text>

      {/* Stats Row */}
      <View style={localStyles.statsRow}>
        {/* EXP */}
        <View style={localStyles.expBadge}>
          <Text style={localStyles.expValue}>+{session.expResult?.totalExp || 0}</Text>
          <Text style={localStyles.expLabel}>EXP</Text>
        </View>

        {/* Duration */}
        <View style={localStyles.metaItem}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={localStyles.metaText}>{session.durationMinutes}m</Text>
        </View>

        {/* Bonuses */}
        {session.comboBonus && (
          <View style={localStyles.bonusBadge}>
            <Text style={localStyles.bonusText}>🔥 Combo</Text>
          </View>
        )}
        {session.restBonus && (
          <View style={localStyles.bonusBadge}>
            <Text style={localStyles.bonusText}>😴 Rested</Text>
          </View>
        )}
      </View>

      {/* Stat Gains */}
      {topStats.length > 0 && (
        <View style={localStyles.statGains}>
          {topStats.map((stat) => (
            <View key={stat.key} style={localStyles.statBadge}>
              <View style={[localStyles.statDot, { backgroundColor: stat.color }]} />
              <Text style={localStyles.statKey}>{stat.key}</Text>
              <Text style={localStyles.statValue}>+{stat.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Notes (history variant only) */}
      {variant === "history" && session.notes && (
        <Text style={localStyles.notes}>{session.notes}</Text>
      )}
    </Pressable>
  );
}

const localStyles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userTouchable: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerCompact: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#a5b4fc",
    fontSize: 14,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#f9fafb",
    fontSize: 15,
    fontWeight: "600",
  },
  userLevel: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 1,
  },
  timeAgo: {
    color: "#6b7280",
    fontSize: 12,
  },
  questTitle: {
    color: "#f9fafb",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  expBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  expValue: {
    color: "#fbbf24",
    fontSize: 18,
    fontWeight: "700",
  },
  expLabel: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "600",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: "#6b7280",
    fontSize: 13,
  },
  bonusBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bonusText: {
    color: "#9ca3af",
    fontSize: 11,
  },
  statGains: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statKey: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },
  statValue: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "600",
  },
  notes: {
    color: "#6b7280",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1e293b",
  },
});

export default SessionRow;
