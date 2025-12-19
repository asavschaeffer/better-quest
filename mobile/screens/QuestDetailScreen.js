import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../style";
import { getQuestStatTotal, STAT_KEYS } from "../core/models";

const STAT_COLORS = {
  STR: "#ef4444",
  DEX: "#f59e0b",
  STA: "#22c55e",
  INT: "#3b82f6",
  SPI: "#8b5cf6",
  CHA: "#ec4899",
  VIT: "#14b8a6",
};

const STAT_NAMES = {
  STR: "Strength",
  DEX: "Dexterity",
  STA: "Stamina",
  INT: "Intelligence",
  SPI: "Spirit",
  CHA: "Charisma",
  VIT: "Vitality",
};

export default function QuestDetailScreen({
  quest,
  isBuiltIn = false,
  onEdit,
  onStart,
  onOpenAction,
}) {
  if (!quest) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.emptyText}>Quest not found</Text>
      </View>
    );
  }

  const statTotal = getQuestStatTotal(quest.stats);

  return (
    <ScrollView style={styles.container} contentContainerStyle={localStyles.scrollContent}>
      {/* Header Image or Icon */}
      {quest.imageUri ? (
        <View style={localStyles.headerImageWrap}>
          <Image source={{ uri: quest.imageUri }} style={localStyles.headerImage} />
          <View style={localStyles.headerOverlay} />
          <View style={localStyles.headerContent}>
            {quest.icon && (
              <View style={localStyles.headerIconBadge}>
                <Ionicons name={quest.icon} size={24} color="#fff" />
              </View>
            )}
            <Text style={localStyles.headerTitle}>{quest.label}</Text>
          </View>
        </View>
      ) : (
        <View style={localStyles.headerPlain}>
          <View style={localStyles.headerIconLarge}>
            <Ionicons
              name={quest.icon || "help-circle-outline"}
              size={48}
              color="#a5b4fc"
            />
          </View>
          <Text style={localStyles.headerTitlePlain}>{quest.label}</Text>
        </View>
      )}

      {/* Meta Info */}
      <View style={localStyles.metaRow}>
        <View style={localStyles.metaItem}>
          <Ionicons name="time-outline" size={16} color="#9ca3af" />
          <Text style={localStyles.metaText}>{quest.defaultDurationMinutes} min</Text>
        </View>
        <View style={localStyles.metaItem}>
          <Ionicons name="person-outline" size={16} color="#9ca3af" />
          <Text style={localStyles.metaText}>
            {quest.authorName || (isBuiltIn ? "Better Quest" : "You")}
          </Text>
        </View>
        {isBuiltIn && (
          <View style={localStyles.builtInBadge}>
            <Text style={localStyles.builtInBadgeText}>Built-in</Text>
          </View>
        )}
      </View>

      {/* Description */}
      {quest.description ? (
        <View style={localStyles.section}>
          <Text style={localStyles.sectionTitle}>Description</Text>
          <Text style={localStyles.description}>{quest.description}</Text>
        </View>
      ) : null}

      {/* Stat Rewards */}
      <View style={localStyles.section}>
        <Text style={localStyles.sectionTitle}>
          Stat Rewards ({statTotal} pts)
        </Text>
        <View style={localStyles.statsGrid}>
          {STAT_KEYS.map((key) => {
            const val = quest.stats?.[key] || 0;
            if (val === 0) return null;
            return (
              <View key={key} style={localStyles.statItem}>
                <View style={[localStyles.statDot, { backgroundColor: STAT_COLORS[key] }]} />
                <Text style={localStyles.statLabel}>{STAT_NAMES[key]}</Text>
                <Text style={localStyles.statValue}>+{val}</Text>
              </View>
            );
          })}
          {statTotal === 0 && (
            <Text style={localStyles.noStats}>No stats allocated</Text>
          )}
        </View>
      </View>

      {/* Tags */}
      {quest.keywords?.length > 0 && (
        <View style={localStyles.section}>
          <Text style={localStyles.sectionTitle}>Tags</Text>
          <View style={localStyles.tagsRow}>
            {quest.keywords.map((tag, i) => (
              <View key={i} style={localStyles.tag}>
                <Text style={localStyles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick Launch Action */}
      {quest.action?.value && (
        <View style={localStyles.section}>
          <Text style={localStyles.sectionTitle}>Quick Launch</Text>
          <TouchableOpacity
            style={localStyles.actionBtn}
            onPress={() => onOpenAction?.(quest.action)}
          >
            <Ionicons
              name={quest.action.type === "url" ? "link-outline" : "apps-outline"}
              size={18}
              color="#a5b4fc"
            />
            <Text style={localStyles.actionBtnText} numberOfLines={1}>
              {quest.action.value}
            </Text>
            <Ionicons name="open-outline" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Placeholder sections for future */}
      <View style={localStyles.section}>
        <Text style={localStyles.sectionTitle}>Quote</Text>
        <Text style={localStyles.placeholderText}>Coming soon...</Text>
      </View>

      <View style={localStyles.section}>
        <Text style={localStyles.sectionTitle}>Resources</Text>
        <Text style={localStyles.placeholderText}>Coming soon...</Text>
      </View>

      {/* Actions */}
      <View style={localStyles.actionsSection}>
        <TouchableOpacity
          style={localStyles.startBtn}
          onPress={() => onStart?.(quest)}
        >
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={localStyles.startBtnText}>Start Quest</Text>
        </TouchableOpacity>

        {!isBuiltIn && (
          <TouchableOpacity
            style={localStyles.editBtn}
            onPress={() => onEdit?.(quest)}
          >
            <Ionicons name="pencil-outline" size={18} color="#a5b4fc" />
            <Text style={localStyles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  headerImageWrap: {
    height: 200,
    marginHorizontal: -16,
    marginTop: -12,
    position: "relative",
  },
  headerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  headerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
    // React Native doesn't support CSS gradients via `backgroundImage`.
    // This simple overlay improves text legibility without extra deps.
    backgroundColor: "rgba(2, 6, 23, 0.65)",
  },
  headerContent: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(79, 70, 229, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "700",
  },
  headerPlain: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  headerIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#1e1b4b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#4f46e5",
  },
  headerTitlePlain: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: "#9ca3af",
    fontSize: 13,
  },
  builtInBadge: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  builtInBadgeText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  description: {
    color: "#e5e7eb",
    fontSize: 15,
    lineHeight: 22,
  },
  statsGrid: {
    gap: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 12,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statLabel: {
    flex: 1,
    color: "#e5e7eb",
    fontSize: 14,
  },
  statValue: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "700",
  },
  noStats: {
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: "#1f2937",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 12,
  },
  actionBtnText: {
    flex: 1,
    color: "#a5b4fc",
    fontSize: 13,
  },
  placeholderText: {
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
  },
  actionsSection: {
    marginTop: 32,
    gap: 12,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    paddingVertical: 12,
  },
  editBtnText: {
    color: "#a5b4fc",
    fontSize: 15,
    fontWeight: "600",
  },
});
