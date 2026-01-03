import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SessionGainsChart } from "../components/SessionGainsChart";

// Bonus type icons
function getBonusIcon(key) {
  switch (key?.toLowerCase()) {
    case "combo":
      return "🔥";
    case "rest":
    case "well-rested":
      return "😴";
    case "streak":
    case "quest_streak":
      return "⚡";
    case "brahma":
    case "brahma_muhurta":
      return "🌅";
    case "mandala":
    case "mandala_streak":
      return "🎯";
    default:
      return "✨";
  }
}

// Bonus type colors
function getBonusColor(key) {
  switch (key?.toLowerCase()) {
    case "combo":
      return "#f97316"; // orange
    case "rest":
    case "well-rested":
      return "#a78bfa"; // purple
    case "streak":
    case "quest_streak":
      return "#fbbf24"; // yellow
    case "brahma":
    case "brahma_muhurta":
      return "#fb7185"; // pink
    case "mandala":
    case "mandala_streak":
      return "#34d399"; // emerald
    default:
      return "#60a5fa"; // blue
  }
}

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
 * @param {boolean} isOwnSession - If true, hides user profile (it's your session)
 * @param {function} onClose - Called when modal is dismissed
 * @param {function} onViewProfile - Called when user profile is tapped (other's sessions)
 */
export default function SessionDetailsScreen({ 
  session, 
  isOwnSession = false,
  onClose, 
  onViewProfile,
}) {
  const insets = useSafeAreaInsets();
  
  // Track which segment is selected/pressed and its position
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentPositions, setSegmentPositions] = useState({});

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
  
  // Calculate base EXP and bonus segments (same logic as CompleteScreen)
  const { baseExpGain, bonusSegments } = useMemo(() => {
    const expGained = expResult?.totalExp ?? 0;
    
    // Calculate base EXP (before any multipliers)
    const multiplier = session?.bonusMultiplier ?? 1;
    const baseExp = multiplier > 1 ? Math.round(expGained / multiplier) : expGained;
    
    // Calculate each bonus's individual contribution
    const segments = [];
    let runningTotal = baseExp;
    
    if (breakdown && breakdown.length > 0) {
      breakdown.forEach((b) => {
        const mult = typeof b?.value === "number" && Number.isFinite(b.value) ? b.value : 1;
        let contribution = 0;
        
        if (b?.mode === "mult" && mult > 1) {
          contribution = Math.round(runningTotal * (mult - 1));
          runningTotal += contribution;
        } else if (b?.mode === "stat_mult") {
          contribution = Math.round(baseExp * (mult - 1) * 0.3);
          runningTotal += contribution;
        }
        
        if (contribution > 0) {
          segments.push({
            key: b.key,
            label: b.label || b.key,
            exp: contribution,
            color: getBonusColor(b.key),
            icon: getBonusIcon(b.key),
          });
        }
      });
    }
    
    return { baseExpGain: baseExp, bonusSegments: segments };
  }, [expResult?.totalExp, session?.bonusMultiplier, breakdown]);

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

        {/* Session Gains Chart */}
        <View style={localStyles.chartSection}>
          <SessionGainsChart
            allocation={session?.standStats}
            durationMinutes={session?.durationMinutes || 0}
            totalExp={expResult?.totalExp || 0}
            size={220}
          />
        </View>

        {/* EXP Progress Bar with Bonus Segments */}
        <View style={localStyles.block}>
          <View style={localStyles.levelHeader}>
            <Text style={localStyles.label}>EXP Earned</Text>
            <Text style={localStyles.levelMeta}>
              +{expResult?.totalExp || 0} EXP
            </Text>
          </View>
          
          {/* Progress bar with individual bonus segments */}
          <View style={localStyles.progressBarContainer}>
            <View style={localStyles.progressBar}>
              {/* Render base + each bonus segment as pressable */}
              {(() => {
                const totalExp = expResult?.totalExp || 0;
                if (totalExp === 0) return null;
                
                let currentPos = 0;
                const segments = [];
                
                // Base segment (blue)
                const baseRatio = baseExpGain / totalExp;
                const baseWidth = baseRatio * 100;
                segments.push(
                  <Pressable
                    key="base"
                    onPress={() => {
                      setSelectedSegment(selectedSegment === "base" ? null : "base");
                      setSegmentPositions(prev => ({ ...prev, base: { left: currentPos, width: baseWidth } }));
                    }}
                    style={[
                      localStyles.progressSegment,
                      {
                        left: `${currentPos}%`,
                        width: `${baseWidth}%`,
                        backgroundColor: "#60a5fa",
                      },
                      selectedSegment === "base" && localStyles.progressSegmentSelected,
                    ]}
                  />
                );
                currentPos += baseWidth;
                
                // Each bonus segment with its own color
                bonusSegments.forEach((seg, i) => {
                  const segKey = seg.key + i;
                  const segRatio = seg.exp / totalExp;
                  const segLeft = currentPos;
                  const segWidth = segRatio * 100;
                  segments.push(
                    <Pressable
                      key={segKey}
                      onPress={() => {
                        setSelectedSegment(selectedSegment === segKey ? null : segKey);
                        setSegmentPositions(prev => ({ ...prev, [segKey]: { left: segLeft, width: segWidth } }));
                      }}
                      style={[
                        localStyles.progressSegment,
                        {
                          left: `${segLeft}%`,
                          width: `${segWidth}%`,
                          backgroundColor: seg.color,
                        },
                        selectedSegment === segKey && localStyles.progressSegmentSelected,
                      ]}
                    />
                  );
                  currentPos += segWidth;
                });
                
                return segments;
              })()}
            </View>
            
            {/* Segment tooltip positioned above the segment */}
            {selectedSegment && segmentPositions[selectedSegment] && (
              <View 
                style={[
                  localStyles.tooltipWrapper,
                  {
                    left: `${segmentPositions[selectedSegment].left}%`,
                    width: `${segmentPositions[selectedSegment].width}%`,
                  },
                ]}
              >
                <View style={localStyles.segmentTooltip}>
                  {selectedSegment === "base" ? (
                    <>
                      <View style={[localStyles.tooltipDot, { backgroundColor: "#60a5fa" }]} />
                      <Text style={localStyles.tooltipText}>+{baseExpGain} base</Text>
                    </>
                  ) : (
                    (() => {
                      const seg = bonusSegments.find((s, i) => s.key + i === selectedSegment);
                      if (!seg) return null;
                      return (
                        <>
                          <Text style={localStyles.tooltipIcon}>{seg.icon}</Text>
                          <Text style={[localStyles.tooltipText, { color: seg.color }]}>
                            +{seg.exp} {seg.label}
                          </Text>
                        </>
                      );
                    })()
                  )}
                </View>
                {/* Arrow centered in the segment */}
                <View style={localStyles.tooltipArrow} />
              </View>
            )}
          </View>
          
          {/* EXP breakdown legend */}
          <View style={localStyles.expBreakdown}>
            <View style={localStyles.expLegendItem}>
              <View style={[localStyles.expLegendDot, { backgroundColor: "#60a5fa" }]} />
              <Text style={localStyles.expLegendText}>+{baseExpGain} base</Text>
            </View>
            {bonusSegments.map((seg, i) => (
              <View key={seg.key + i} style={localStyles.expLegendItem}>
                <View style={[localStyles.expLegendDot, { backgroundColor: seg.color }]} />
                <Text style={localStyles.expLegendText}>+{seg.exp} {seg.label}</Text>
              </View>
            ))}
            <Text style={localStyles.expTotal}>
              = {expResult?.totalExp || 0} EXP
            </Text>
          </View>
        </View>

        {/* Reflection */}
        {session.notes && (
          <View style={localStyles.block}>
            <Text style={localStyles.label}>Reflection</Text>
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
  chartSection: {
    alignItems: "center",
    marginBottom: 24,
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
  progressBarContainer: {
    position: "relative",
  },
  progressBar: {
    height: 12,
    backgroundColor: "#1e293b",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  progressSegment: {
    position: "absolute",
    top: 0,
    height: "100%",
  },
  progressSegmentSelected: {
    transform: [{ scaleY: 1.3 }],
    zIndex: 10,
  },
  tooltipWrapper: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 2,
    alignItems: "center",
    zIndex: 100,
  },
  segmentTooltip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  tooltipArrow: {
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#1e293b",
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipIcon: {
    fontSize: 14,
  },
  tooltipText: {
    color: "#f9fafb",
    fontSize: 13,
    fontWeight: "600",
  },
  expBreakdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 12,
    flexWrap: "wrap",
  },
  expLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expLegendText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  expTotal: {
    color: "#f9fafb",
    fontSize: 13,
    fontWeight: "700",
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

