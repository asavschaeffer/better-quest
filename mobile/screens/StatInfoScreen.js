import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../style";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";
import { getQuestStatTotal, STAT_KEYS } from "../core/models";
import { getStatInfo } from "../core/statInfo";

function formatStatRewards(stats) {
  if (!stats) return "";
  const parts = [];
  STAT_KEYS.forEach((key) => {
    const val = stats[key];
    if (typeof val === "number" && val > 0) parts.push(`${key} ${val}`);
  });
  return parts.join(" • ") || "No stats";
}

function computeTopTemplatesForStat(statKey, limit = 7) {
  if (!statKey) return [];
  const list = [...BUILT_IN_QUEST_TEMPLATES];
  list.sort((a, b) => {
    const av = a?.stats?.[statKey] ?? 0;
    const bv = b?.stats?.[statKey] ?? 0;
    if (bv !== av) return bv - av;
    const at = getQuestStatTotal(a?.stats);
    const bt = getQuestStatTotal(b?.stats);
    if (bt !== at) return bt - at;
    return (a?.label || "").localeCompare(b?.label || "");
  });
  return list.filter((q) => (q?.stats?.[statKey] ?? 0) > 0).slice(0, limit);
}

export default function StatInfoScreen({ statKey, onOpenQuest }) {
  const info = useMemo(() => getStatInfo(statKey), [statKey]);
  const topTemplates = useMemo(() => computeTopTemplatesForStat(statKey, 7), [statKey]);

  if (!statKey) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={localStyles.emptyText}>No stat selected</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={localStyles.scrollContent}>
      <View style={localStyles.hero}>
        <View style={localStyles.heroIcon}>
          <Ionicons name="sparkles-outline" size={28} color="#a5b4fc" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={localStyles.heroTitle}>
            {info?.name || statKey} <Text style={localStyles.heroKey}>({statKey})</Text>
          </Text>
          <Text style={localStyles.heroSubtitle}>What this stat really means, plus quest examples.</Text>
        </View>
      </View>

      <View style={localStyles.section}>
        <Text style={localStyles.sectionTitle}>Meaning</Text>
        <Text style={localStyles.bodyText}>{info?.description || "No description yet."}</Text>
      </View>

      <View style={localStyles.section}>
        <Text style={localStyles.sectionTitle}>Top quests for {statKey}</Text>
        {topTemplates.length === 0 ? (
          <Text style={localStyles.muted}>No templates found for this stat yet.</Text>
        ) : (
          <View style={localStyles.list}>
            {topTemplates.map((q) => (
              <TouchableOpacity
                key={q.id}
                style={localStyles.row}
                onPress={() => onOpenQuest?.(q, true)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Open ${q.label}`}
              >
                <View style={localStyles.rowIcon}>
                  <Ionicons name={q.icon || "help-circle-outline"} size={20} color="#a5b4fc" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={localStyles.rowTitle} numberOfLines={1}>
                    {q.label}
                  </Text>
                  <Text style={localStyles.rowMeta} numberOfLines={1}>
                    {formatStatRewards(q.stats)} • {q.defaultDurationMinutes || 30} min
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    marginBottom: 8,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  heroTitle: {
    color: "#f9fafb",
    fontSize: 22,
    fontWeight: "800",
  },
  heroKey: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 3,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  bodyText: {
    color: "#e5e7eb",
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: "#6b7280",
    fontSize: 14,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#111827",
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    color: "#f9fafb",
    fontSize: 15,
    fontWeight: "700",
  },
  rowMeta: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
});


