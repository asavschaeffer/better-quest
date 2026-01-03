import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SessionGainsChart } from "../components/SessionGainsChart";
import { getLevelProgress } from "../core/exp";

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

export default function CompleteScreen({
  session,
  expResult,
  avatar,
  levelInfo,
  notes,
  onNotesChange,
  onContinue,
  onBreak,
  onEnd,
}) {
  const insets = useSafeAreaInsets();
  const breakdown = Array.isArray(session?.bonusBreakdown) ? session.bonusBreakdown : [];
  
  // Track which segment is selected/pressed and its position
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentPositions, setSegmentPositions] = useState({});

  // Calculate before/after level progress with per-bonus breakdown
  const { beforeProgress, afterProgress, leveledUp, baseExpGain, bonusSegments } = useMemo(() => {
    const totalExpAfter = avatar?.totalExp ?? 0;
    const expGained = expResult?.totalExp ?? 0;
    const totalExpBefore = Math.max(0, totalExpAfter - expGained);
    
    const before = getLevelProgress(totalExpBefore);
    const after = getLevelProgress(totalExpAfter);
    
    // Calculate base EXP (before any multipliers)
    const multiplier = session?.bonusMultiplier ?? 1;
    const baseExp = multiplier > 1 ? Math.round(expGained / multiplier) : expGained;
    
    // Calculate each bonus's individual contribution
    // For multiplicative bonuses: each bonus adds (previous_total × (mult - 1))
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
          // Stat-specific multipliers - approximate contribution
          contribution = Math.round(baseExp * (mult - 1) * 0.3); // rough estimate
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
    
    return {
      beforeProgress: before,
      afterProgress: after,
      leveledUp: after.level > before.level,
      baseExpGain: baseExp,
      bonusSegments: segments,
    };
  }, [avatar?.totalExp, expResult?.totalExp, session?.bonusMultiplier, breakdown]);

  return (
    <View style={[localStyles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={localStyles.scrollView}
        contentContainerStyle={[localStyles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={localStyles.title}>Session complete</Text>
        <Text style={localStyles.questName}>{session.description}</Text>
        <Text style={localStyles.duration}>
          <Ionicons name="time-outline" size={14} color="#6b7280" /> {session.durationMinutes} minutes
        </Text>

        {/* Bonuses */}
        <View style={localStyles.bonusSection}>
          {/* Total multiplier badge - only if > 1 */}
          {session.bonusMultiplier && session.bonusMultiplier > 1 && (
            <View style={localStyles.totalMultiplier}>
              <Ionicons name="sparkles" size={16} color="#fbbf24" />
              <Text style={localStyles.totalMultiplierText}>
                ×{session.bonusMultiplier.toFixed(2)} EXP Multiplier
              </Text>
            </View>
          )}
          
          {/* Individual bonus cards */}
          <View style={localStyles.bonusCards}>
            {breakdown.map((b, i) => {
              const icon = getBonusIcon(b.key);
              const color = getBonusColor(b.key);
              const value = typeof b?.value === "number" && Number.isFinite(b.value) ? b.value : null;
              const mode = b?.mode === "mult" ? "×" : b?.mode === "stat_mult" ? "×" : "+";
              const display = value == null ? "" : mode === "+" ? `+${Math.round(value * 100)}%` : `×${value.toFixed(2)}`;
              const stat = typeof b?.stat === "string" ? ` ${b.stat}` : "";
              
              return (
                <View key={b.key + i} style={[localStyles.bonusCard, { borderLeftColor: color }]}>
                  <View style={[localStyles.bonusIconWrap, { backgroundColor: color + "20" }]}>
                    <Text style={localStyles.bonusIcon}>{icon}</Text>
                  </View>
                  <View style={localStyles.bonusCardContent}>
                    <Text style={localStyles.bonusCardLabel}>{b.label || b.key}{stat}</Text>
                    {display && (
                      <Text style={[localStyles.bonusCardValue, { color }]}>{display}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          
          {/* No bonuses hint */}
          {(!breakdown || breakdown.length === 0) && (!session.bonusMultiplier || session.bonusMultiplier <= 1) && (
            <View style={localStyles.noBonusHint}>
              <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
              <Text style={localStyles.noBonusHintText}>
                Complete back-to-back quests for combo bonus, or rest between sessions for well-rested bonus!
              </Text>
            </View>
          )}
        </View>

        {/* Session Gains Chart */}
        <View style={localStyles.chartSection}>
          <SessionGainsChart
            allocation={session?.standStats}
            durationMinutes={session?.durationMinutes || 0}
            totalExp={expResult?.totalExp || 0}
            size={220}
          />
        </View>

        {/* Level Progress with Bonus Segments */}
        {avatar && afterProgress && (
          <View style={localStyles.block}>
            <View style={localStyles.levelHeader}>
              <Text style={localStyles.label}>
                Level {afterProgress.level}
                {leveledUp && <Text style={localStyles.levelUp}> ↑ Level Up!</Text>}
              </Text>
              <Text style={localStyles.levelMeta}>
                {afterProgress.current} / {afterProgress.required} EXP
              </Text>
            </View>
            
            {/* Progress bar with individual bonus segments */}
            <View style={localStyles.progressBarContainer}>
              <View style={localStyles.progressBar}>
                {/* Before fill (gray) - existing progress */}
                {!leveledUp && beforeProgress && (
                  <View
                    style={[
                      localStyles.progressFillBefore,
                      { width: `${beforeProgress.ratio * 100}%` },
                    ]}
                  />
                )}
                
                {/* Render base + each bonus segment as pressable */}
                {(() => {
                  const totalExp = expResult?.totalExp || 0;
                  const totalGainRatio = leveledUp 
                    ? afterProgress.ratio
                    : (afterProgress.ratio - beforeProgress.ratio);
                  
                  let currentPos = leveledUp ? 0 : beforeProgress.ratio * 100;
                  const segments = [];
                  
                  // Base segment (blue)
                  const baseRatio = totalGainRatio * (baseExpGain / totalExp);
                  const baseLeft = currentPos;
                  const baseWidth = baseRatio * 100;
                  segments.push(
                    <Pressable
                      key="base"
                      onPress={() => {
                        setSelectedSegment(selectedSegment === "base" ? null : "base");
                        setSegmentPositions(prev => ({ ...prev, base: { left: baseLeft, width: baseWidth } }));
                      }}
                      style={[
                        localStyles.progressSegment,
                        {
                          left: `${baseLeft}%`,
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
                    const segRatio = totalGainRatio * (seg.exp / totalExp);
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
              
              {/* Tap hint when no segment selected */}
              {!selectedSegment && (expResult?.totalExp || 0) > 0 && (
                <Text style={localStyles.tapHint}>Tap segments to see breakdown</Text>
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
        )}

        {/* Notes Input */}
        <View style={localStyles.block}>
          <Text style={localStyles.label}>Reflection</Text>
          <TextInput
            style={localStyles.textArea}
            multiline
            value={notes}
            onChangeText={onNotesChange}
            placeholder="What did you accomplish? How did it feel?"
            placeholderTextColor="#4b5563"
          />
        </View>

        {/* Actions */}
        <View style={localStyles.actions}>
          <TouchableOpacity style={localStyles.primaryBtn} onPress={onContinue}>
            <Text style={localStyles.primaryBtnText}>Continue this quest</Text>
          </TouchableOpacity>
          <View style={localStyles.secondaryRow}>
            <TouchableOpacity style={localStyles.secondaryBtn} onPress={onBreak}>
              <Text style={localStyles.secondaryBtnText}>Take a break</Text>
            </TouchableOpacity>
            <TouchableOpacity style={localStyles.ghostBtn} onPress={onEnd}>
              <Text style={localStyles.ghostBtnText}>End for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
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
  bonusSection: {
    marginBottom: 24,
  },
  totalMultiplier: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(251,191,36,0.15)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignSelf: "center",
  },
  totalMultiplierText: {
    color: "#fbbf24",
    fontSize: 15,
    fontWeight: "700",
  },
  bonusCards: {
    gap: 8,
  },
  bonusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
  },
  bonusIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bonusIcon: {
    fontSize: 18,
  },
  bonusCardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bonusCardLabel: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "500",
  },
  bonusCardValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  noBonusHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
  },
  noBonusHintText: {
    flex: 1,
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
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
  levelUp: {
    color: "#fbbf24",
    fontWeight: "700",
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
  progressFillBefore: {
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    backgroundColor: "#374151",
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
  tapHint: {
    color: "#4b5563",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  bonusBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    gap: 12,
    flexWrap: "wrap",
  },
  bonusBadgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bonusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bonusBadgeIcon: {
    fontSize: 13,
  },
  bonusBadgeExp: {
    fontSize: 13,
    fontWeight: "700",
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
  textArea: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    color: "#f9fafb",
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },
  actions: {
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#a5b4fc",
    fontSize: 15,
    fontWeight: "600",
  },
  ghostBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ghostBtnText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "500",
  },
});
