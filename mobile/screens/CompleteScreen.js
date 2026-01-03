import React from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SessionGainsChart } from "../components/SessionGainsChart";

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
        {(breakdown.length > 0 || (session.bonusMultiplier && session.bonusMultiplier > 1) || session.comboBonus || session.restBonus) && (
          <View style={localStyles.block}>
            <Text style={localStyles.label}>
              Bonuses
              {session.bonusMultiplier && session.bonusMultiplier > 1
                ? ` (×${session.bonusMultiplier.toFixed(2)} EXP)`
                : ""}
            </Text>
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

        {/* Session Gains Chart */}
        <View style={localStyles.chartSection}>
          <SessionGainsChart
            allocation={session?.standStats}
            durationMinutes={session?.durationMinutes || 0}
            totalExp={expResult?.totalExp || 0}
            size={220}
          />
        </View>

        {/* Level Progress */}
        {avatar && levelInfo && (
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
