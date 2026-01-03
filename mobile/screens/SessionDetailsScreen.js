import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { STAT_ATTRS } from "../components/RadarChartCore";

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

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
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
 * SessionDetailsScreen - Read-only view of a completed session
 * 
 * Shows session details when tapping a card in the feed or history.
 * 
 * @param {object} session - The session data
 * @param {boolean} isOwnSession - If true, shows level progress instead of user profile
 * @param {object} avatar - Avatar data (level) for own sessions
 * @param {object} levelInfo - Level progress info (current, required, ratio) for own sessions
 * @param {function} onClose - Called when modal is dismissed
 * @param {function} onViewProfile - Called when user profile is tapped (other's sessions)
 */
export default function SessionDetailsScreen({ 
  session, 
  isOwnSession = false,
  avatar,
  levelInfo,
  onClose, 
  onViewProfile,
}) {
  const insets = useSafeAreaInsets();

  if (!session) {
    return (
      <View style={[localStyles.container, { paddingTop: insets.top }]}>
        <Text style={localStyles.emptyText}>Session not found</Text>
      </View>
    );
  }

  const expResult = session.expResult || { totalExp: 0, standExp: {} };
  const breakdown = Array.isArray(session?.bonusBreakdown) ? session.bonusBreakdown : [];
  const hasUser = !isOwnSession && session.userName;
  const timeAgo = formatTimeAgo(session.completedAt);

  // Get stat gains sorted by value
  const statGains = Object.entries(expResult.standExp || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => {
      const attr = STAT_ATTRS.find((a) => a.key === key);
      return { key, value, color: attr?.color || "#6b7280" };
    });

  return (
    <View style={[localStyles.container, { paddingTop: insets.top }]}>
      {/* Header with drag indicator */}
      <View style={localStyles.header}>
        <View style={localStyles.dragIndicator} />
        <TouchableOpacity style={localStyles.closeButton} onPress={onClose}>
          <Text style={localStyles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={localStyles.scrollView}
        contentContainerStyle={[localStyles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info */}
        {hasUser && (
          <TouchableOpacity 
            style={localStyles.userSection}
            onPress={() => onViewProfile?.({ name: session.userName, level: session.userLevel })}
            activeOpacity={0.7}
          >
            <View style={localStyles.avatar}>
              <Text style={localStyles.avatarText}>{getInitials(session.userName)}</Text>
            </View>
            <View style={localStyles.userInfo}>
              <Text style={localStyles.userName}>{session.userName}</Text>
              <Text style={localStyles.userMeta}>Level {session.userLevel || 1} • {timeAgo}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>
        )}

        {/* Quest Title */}
        <Text style={localStyles.title}>Session complete</Text>
        <Text style={localStyles.questName}>{session.description}</Text>
        <Text style={localStyles.duration}>
          <Ionicons name="time-outline" size={14} color="#6b7280" /> {session.durationMinutes} minutes
        </Text>

        {/* Bonuses */}
        {(breakdown.length > 0 || session.comboBonus || session.restBonus) && (
          <View style={localStyles.block}>
            <Text style={localStyles.label}>Bonuses</Text>
            {breakdown.length > 0 ? (
              <Text style={localStyles.muted}>
                {breakdown
                  .map((b) => {
                    const label = b?.label || b?.key || "bonus";
                    const mode = b?.mode === "mult" ? "×" : b?.mode === "stat_mult" ? "×" : "+";
                    const value = typeof b?.value === "number" && Number.isFinite(b.value) ? b.value : null;
                    const stat = typeof b?.stat === "string" ? b.stat : null;
                    const display = value == null ? "" : mode === "+" ? `+${(value * 100).toFixed(0)}%` : `×${value.toFixed(2)}`;
                    const scope = stat ? ` ${stat}` : "";
                    return `${label}${scope}${display ? ` (${display})` : ""}`;
                  })
                  .join(" • ")}
              </Text>
            ) : (
              <View style={localStyles.bonusPills}>
                {session.comboBonus && (
                  <View style={localStyles.bonusPill}>
                    <Text style={localStyles.bonusPillText}>🔥 Combo</Text>
                  </View>
                )}
                {session.restBonus && (
                  <View style={localStyles.bonusPill}>
                    <Text style={localStyles.bonusPillText}>😴 Well-rested</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* EXP Earned */}
        <View style={localStyles.expSection}>
          <View style={localStyles.expCard}>
            <Text style={localStyles.expLabel}>Total EXP</Text>
            <Text style={localStyles.expValue}>+{expResult.totalExp}</Text>
          </View>
        </View>

        {/* Level Progress (own sessions only) */}
        {isOwnSession && avatar && levelInfo && (
          <View style={localStyles.block}>
            <View style={localStyles.levelHeader}>
              <Text style={localStyles.label}>Level {avatar.level}</Text>
              <Text style={localStyles.levelMeta}>
                {levelInfo.current} / {levelInfo.required} EXP
              </Text>
            </View>
            <View style={localStyles.progressBar}>
              <View
                style={[localStyles.progressFill, { width: `${levelInfo.ratio * 100}%` }]}
              />
            </View>
          </View>
        )}

        {/* Stand Gains */}
        {statGains.length > 0 && (
          <View style={localStyles.block}>
            <Text style={localStyles.label}>Stand Gains</Text>
            <View style={localStyles.statGains}>
              {statGains.map((stat) => (
                <View key={stat.key} style={localStyles.statRow}>
                  <View style={[localStyles.statDot, { backgroundColor: stat.color }]} />
                  <Text style={localStyles.statKey}>{stat.key}</Text>
                  <Text style={localStyles.statValue}>+{stat.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        {session.notes && (
          <View style={localStyles.block}>
            <Text style={localStyles.label}>Notes</Text>
            <Text style={localStyles.notes}>{session.notes}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  header: {
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e293b",
  },
  dragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#374151",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    top: 12,
  },
  closeText: {
    color: "#a5b4fc",
    fontSize: 17,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#a5b4fc",
    fontSize: 16,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#f9fafb",
    fontSize: 17,
    fontWeight: "600",
  },
  userMeta: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  title: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  questName: {
    color: "#f9fafb",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  duration: {
    color: "#6b7280",
    fontSize: 15,
    marginBottom: 24,
  },
  block: {
    marginBottom: 24,
  },
  label: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  muted: {
    color: "#6b7280",
    fontSize: 14,
  },
  bonusPills: {
    flexDirection: "row",
    gap: 8,
  },
  bonusPill: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bonusPillText: {
    color: "#d1d5db",
    fontSize: 14,
  },
  expSection: {
    marginBottom: 24,
  },
  expCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  expLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  expValue: {
    color: "#fbbf24",
    fontSize: 36,
    fontWeight: "800",
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  levelMeta: {
    color: "#6b7280",
    fontSize: 13,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#1e293b",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#a5b4fc",
    borderRadius: 4,
  },
  statGains: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statKey: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    width: 40,
  },
  statValue: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  notes: {
    color: "#d1d5db",
    fontSize: 15,
    fontStyle: "italic",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
  },
});

