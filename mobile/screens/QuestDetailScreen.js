import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, G } from "react-native-svg";
import styles from "../../style";
import { getQuestStatTotal } from "../core/models";
import { RadarChartCore, STAT_ATTRS } from "../components/RadarChartCore";

export default function QuestDetailScreen({
  quest,
  isBuiltIn = false,
  onEdit,
  onFork,
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
  const statValues = STAT_ATTRS.map((a) => quest.stats?.[a.key] ?? 0);
  // Keep all 7 axes for consistent chart shape, but only label the stats this quest improves.
  const labeledAttrs = STAT_ATTRS.map((a) => {
    const v = quest.stats?.[a.key] ?? 0;
    return { ...a, label: v > 0 ? a.label : "" };
  });

  const badgeSize = 96;
  const durationMin = 1;
  const durationMax = 240;
  const duration = quest.defaultDurationMinutes || 30;
  const ringProgress = Math.max(
    0,
    Math.min(1, (duration - durationMin) / (durationMax - durationMin)),
  );
  const ringStroke = 2;
  // Keep the duration ring snug with the chart background circle.
  // This matches RadarChartCore's geometry in the mini badge:
  // - maxRadius = size * maxRadiusMult (we pass maxRadiusMult={0.3})
  // - background radius = maxRadius + backgroundPad (we pass backgroundPad={6})
  const maxRadiusMult = 0.3;
  const backgroundPad = 6;
  // Slightly outside the chart background edge so the ring is visible (and not covered).
  const ringR = badgeSize * maxRadiusMult + backgroundPad + 1.5;
  const circumference = 2 * Math.PI * ringR;
  const dashOffset = circumference * (1 - ringProgress);

  return (
    <ScrollView style={styles.container} contentContainerStyle={localStyles.scrollContent}>
      {/* Header Image or Icon */}
      {quest.imageUri ? (
        <View style={localStyles.headerImageWrap}>
          <Image source={{ uri: quest.imageUri }} style={localStyles.headerImage} />
          <View style={localStyles.headerOverlay} />
          <View pointerEvents="none" style={localStyles.statsBadge}>
            <RadarChartCore
              size={badgeSize}
              attrs={labeledAttrs}
              values={statValues}
              minValue={0}
              maxValue={2}
              rings={2}
              ringValues={[0, 1, 2]}
              showLabels
              // Keep the badge clean: no spokes, only rings + polygon + selective labels.
              showAxisLines={false}
              // Pull labels inward so they don't clip in the small badge.
              labelRadiusMult={0.34}
              // Tighter background (feels like ~2.5 rings, not "3 rings worth" of padding).
              backgroundPad={6}
              fill="rgba(99,102,241,0.32)"
              stroke="rgba(129,140,248,0.95)"
              strokeWidth={2}
              maxRadiusMult={0.3}
            />
            {/* Duration circumference ring (render ABOVE the chart so it's not hidden by the background) */}
            <Svg width={badgeSize} height={badgeSize} style={StyleSheet.absoluteFill} pointerEvents="none">
              <G rotation={-90} originX={badgeSize / 2} originY={badgeSize / 2}>
                <Circle
                  cx={badgeSize / 2}
                  cy={badgeSize / 2}
                  r={ringR}
                  stroke="rgba(99,102,241,0.22)"
                  strokeWidth={ringStroke}
                  fill="none"
                />
                {ringProgress > 0 ? (
                  <Circle
                    cx={badgeSize / 2}
                    cy={badgeSize / 2}
                    r={ringR}
                    stroke="#6366f1"
                    strokeWidth={ringStroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={dashOffset}
                  />
                ) : null}
              </G>
            </Svg>
          </View>
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
          <View pointerEvents="none" style={localStyles.statsBadgePlain}>
            <RadarChartCore
              size={badgeSize}
              attrs={labeledAttrs}
              values={statValues}
              minValue={0}
              maxValue={2}
              rings={2}
              ringValues={[0, 1, 2]}
              showLabels
              showAxisLines={false}
              labelRadiusMult={0.34}
              backgroundPad={6}
              fill="rgba(99,102,241,0.32)"
              stroke="rgba(129,140,248,0.95)"
              strokeWidth={2}
              maxRadiusMult={0.3}
            />
            <Svg width={badgeSize} height={badgeSize} style={StyleSheet.absoluteFill} pointerEvents="none">
              <G rotation={-90} originX={badgeSize / 2} originY={badgeSize / 2}>
                <Circle
                  cx={badgeSize / 2}
                  cy={badgeSize / 2}
                  r={ringR}
                  stroke="rgba(99,102,241,0.22)"
                  strokeWidth={ringStroke}
                  fill="none"
                />
                {ringProgress > 0 ? (
                  <Circle
                    cx={badgeSize / 2}
                    cy={badgeSize / 2}
                    r={ringR}
                    stroke="#6366f1"
                    strokeWidth={ringStroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={dashOffset}
                  />
                ) : null}
              </G>
            </Svg>
          </View>
          <Text style={localStyles.headerTitlePlain}>{quest.label}</Text>
        </View>
      )}

      {/* Meta Info */}
      <View style={localStyles.metaRow}>
        <View style={localStyles.metaItem}>
          <Ionicons name="stats-chart" size={16} color="#9ca3af" />
          <Text style={localStyles.metaText}>{statTotal} pts</Text>
        </View>
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
  statsBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    opacity: 0.95,
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
    position: "relative",
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  statsBadgePlain: {
    position: "absolute",
    top: 10,
    right: 10,
    opacity: 0.95,
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
