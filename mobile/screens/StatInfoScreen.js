import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";
import { getQuestStatTotal, STAT_KEYS } from "../core/models";
import { getStatInfo } from "../core/statInfo";

function computeTopTemplatesForStat(statKey, limit = 5) {
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

function filterUserQuestsForStat(userQuests, statKey, limit = 3) {
  if (!userQuests?.length || !statKey) return [];
  return userQuests
    .filter((q) => (q?.stats?.[statKey] ?? 0) > 0)
    .sort((a, b) => (b?.stats?.[statKey] ?? 0) - (a?.stats?.[statKey] ?? 0))
    .slice(0, limit);
}

function QuestRow({ quest, onPress }) {
  return (
    <TouchableOpacity
      style={localStyles.row}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`Open ${quest.label}`}
    >
      <View style={localStyles.rowIcon}>
        <Ionicons name={quest.icon || "flash-outline"} size={18} color="#a5b4fc" />
      </View>
      <Text style={localStyles.rowTitle} numberOfLines={1}>
        {quest.label}
      </Text>
    </TouchableOpacity>
  );
}

export default function StatInfoScreen({ statKey, onOpenQuest, onClose, userQuests = [] }) {
  const info = useMemo(() => getStatInfo(statKey), [statKey]);
  const topTemplates = useMemo(() => computeTopTemplatesForStat(statKey, 5), [statKey]);
  const yourQuests = useMemo(() => filterUserQuestsForStat(userQuests, statKey, 3), [userQuests, statKey]);

  if (!statKey) {
    return (
      <View style={[localStyles.modalContainer, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={localStyles.emptyText}>No stat selected</Text>
      </View>
    );
  }

  const statColor = info?.color || "#a5b4fc";
  const statColorDark = info?.colorDark || "#1e293b";

  // TODO: Replace with actual top player's Stand image for this stat
  const bannerImageUri = null;

  return (
    <View style={localStyles.modalContainer}>
      <ScrollView 
        style={localStyles.scrollView} 
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner - Top player's Stand for this stat */}
        <View style={[localStyles.banner, { backgroundColor: statColorDark }]}>
          {bannerImageUri ? (
            <Image source={{ uri: bannerImageUri }} style={localStyles.bannerImage} />
          ) : (
            <View style={localStyles.bannerPlaceholder}>
              <Ionicons name={info?.icon || "help-circle-outline"} size={64} color={statColor + "40"} />
            </View>
          )}
          <View style={localStyles.bannerOverlay} />
          
          {/* Drag indicator - overlaid on banner */}
          <View style={localStyles.dragBar}>
            <View style={localStyles.dragIndicator} />
          </View>

          {/* Champion badge - future: show top player */}
          <View style={localStyles.championBadge}>
            <Ionicons name="trophy" size={12} color="#fbbf24" />
            <Text style={localStyles.championText}>Top Stand TBD</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={localStyles.hero}>
          <Text style={localStyles.statName}>{info?.name || statKey}</Text>
          <Text style={localStyles.description}>{info?.description}</Text>
        </View>

        {/* Quote */}
        {info?.quote && (
          <View style={localStyles.quoteCard}>
            <Text style={localStyles.quoteText}>"{info.quote}"</Text>
            <Text style={localStyles.quoteAuthor}>{info.quoteAuthor}</Text>
          </View>
        )}

        {/* Your Quests */}
        {yourQuests.length > 0 && (
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Your Quests</Text>
            <View style={localStyles.list}>
              {yourQuests.map((q) => (
                <QuestRow
                  key={q.id}
                  quest={q}
                  onPress={() => onOpenQuest?.(q, false)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Popular Quests */}
        {topTemplates.length > 0 && (
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Popular Quests</Text>
            <View style={localStyles.list}>
              {topTemplates.map((q) => (
                <QuestRow
                  key={q.id}
                  quest={q}
                  onPress={() => onOpenQuest?.(q, true)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#020617",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  banner: {
    height: 180,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: "cover",
  },
  bannerPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.3)",
  },
  dragBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: "center",
  },
  dragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  championBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  championText: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },
  hero: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 32,
  },
  statName: {
    color: "#f9fafb",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  description: {
    color: "#9ca3af",
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center",
  },
  quoteCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 20,
    backgroundColor: "#0f172a",
    borderRadius: 16,
  },
  quoteText: {
    color: "#d1d5db",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    marginBottom: 12,
  },
  quoteAuthor: {
    color: "#6b7280",
    fontSize: 13,
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  list: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e293b",
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowTitle: {
    flex: 1,
    color: "#f9fafb",
    fontSize: 16,
  },
  muted: {
    color: "#6b7280",
    fontSize: 14,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
