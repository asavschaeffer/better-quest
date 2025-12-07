import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { STAT_KEYS, QUEST_STAT_MAX_PER_STAT, QUEST_STAT_MAX_TOTAL, getQuestStatTotal } from "./core/models";

const STAT_LABELS = {
  STR: { label: "STR", name: "Strength", color: "#ef4444" },
  DEX: { label: "DEX", name: "Dexterity", color: "#f97316" },
  STA: { label: "STA", name: "Stamina", color: "#eab308" },
  INT: { label: "INT", name: "Intelligence", color: "#3b82f6" },
  SPI: { label: "SPI", name: "Spirit", color: "#a855f7" },
  CRE: { label: "CRE", name: "Creativity", color: "#ec4899" },
  VIT: { label: "VIT", name: "Vitality", color: "#22c55e" },
};

/**
 * QuestStatsEditor - Edit quest stats with caps
 * Stats: 0-3 per stat, max 4 total points
 */
export function QuestStatsEditor({ value, onChange, disabled = false }) {
  const stats = useMemo(() => {
    const result = {};
    STAT_KEYS.forEach(key => {
      result[key] = value?.[key] ?? 0;
    });
    return result;
  }, [value]);

  const total = useMemo(() => getQuestStatTotal(stats), [stats]);
  const pointsLeft = QUEST_STAT_MAX_TOTAL - total;

  function handleIncrement(key) {
    if (disabled) return;
    const current = stats[key] ?? 0;
    // Check both per-stat cap and total cap
    if (current >= QUEST_STAT_MAX_PER_STAT) return;
    if (total >= QUEST_STAT_MAX_TOTAL) return;
    
    const next = { ...stats, [key]: current + 1 };
    onChange?.(next);
  }

  function handleDecrement(key) {
    if (disabled) return;
    const current = stats[key] ?? 0;
    if (current <= 0) return;
    
    const next = { ...stats, [key]: current - 1 };
    onChange?.(next);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stat Allocation</Text>
        <Text style={[styles.pointsLeft, pointsLeft === 0 && styles.pointsFull]}>
          {pointsLeft} {pointsLeft === 1 ? "point" : "points"} left
        </Text>
      </View>
      <Text style={styles.helper}>
        Max {QUEST_STAT_MAX_PER_STAT} per stat • Max {QUEST_STAT_MAX_TOTAL} total
      </Text>
      <View style={styles.statsGrid}>
        {STAT_KEYS.map(key => {
          const info = STAT_LABELS[key];
          const statValue = stats[key] ?? 0;
          const canIncrement = statValue < QUEST_STAT_MAX_PER_STAT && total < QUEST_STAT_MAX_TOTAL;
          const canDecrement = statValue > 0;
          
          return (
            <View key={key} style={styles.statRow}>
              <View style={styles.statInfo}>
                <Text style={[styles.statLabel, { color: info.color }]}>{info.label}</Text>
                <Text style={styles.statName}>{info.name}</Text>
              </View>
              <View style={styles.statControls}>
                <TouchableOpacity
                  style={[styles.controlBtn, !canDecrement && styles.controlBtnDisabled]}
                  onPress={() => handleDecrement(key)}
                  disabled={disabled || !canDecrement}
                >
                  <Text style={[styles.controlBtnText, !canDecrement && styles.controlBtnTextDisabled]}>−</Text>
                </TouchableOpacity>
                <View style={styles.statValueContainer}>
                  <View style={styles.statDots}>
                    {[0, 1, 2, 3].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i < statValue ? { backgroundColor: info.color } : styles.dotEmpty,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.statValue}>{statValue}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.controlBtn, !canIncrement && styles.controlBtnDisabled]}
                  onPress={() => handleIncrement(key)}
                  disabled={disabled || !canIncrement}
                >
                  <Text style={[styles.controlBtnText, !canIncrement && styles.controlBtnTextDisabled]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  pointsLeft: {
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "500",
  },
  pointsFull: {
    color: "#9ca3af",
  },
  helper: {
    color: "#6b7280",
    fontSize: 11,
    marginBottom: 12,
  },
  statsGrid: {
    gap: 8,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#0f172a",
    borderRadius: 8,
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  statName: {
    color: "#6b7280",
    fontSize: 10,
  },
  statControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnDisabled: {
    backgroundColor: "#111827",
  },
  controlBtnText: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 20,
  },
  controlBtnTextDisabled: {
    color: "#374151",
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 70,
    justifyContent: "center",
  },
  statDots: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotEmpty: {
    backgroundColor: "#374151",
  },
  statValue: {
    color: "#9ca3af",
    fontSize: 12,
    minWidth: 12,
    textAlign: "center",
  },
});

export default QuestStatsEditor;
