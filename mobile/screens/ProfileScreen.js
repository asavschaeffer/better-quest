import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import styles from "../../style";
import { PlayerStatsChart } from "../components/PlayerStatsChart";
import { playerStatsToChartValues } from "../core/stats";
import { Avatar3D } from "../Avatar3D";

export default function ProfileScreen({ player, onOpenStatInfo }) {
  // Convert player's standExp to chart values (normalized 1-6 scale)
  const chartStats = useMemo(() => {
    return playerStatsToChartValues(player.standExp || {});
  }, [player.standExp]);

  // Calculate total stats for display
  const totalStats = useMemo(() => {
    const exp = player.standExp || {};
    return Object.values(exp).reduce((sum, val) => sum + (val || 0), 0);
  }, [player.standExp]);

  // Find dominant stat
  const dominantStat = useMemo(() => {
    const exp = player.standExp || {};
    let maxKey = "STR";
    let maxVal = 0;
    Object.entries(exp).forEach(([key, val]) => {
      if (val > maxVal) {
        maxKey = key;
        maxVal = val;
      }
    });
    return maxKey;
  }, [player.standExp]);

  const statLabels = {
    STR: "Strength",
    DEX: "Dexterity",
    STA: "Stamina",
    INT: "Intelligence",
    SPI: "Spirit",
    CHA: "Charisma",
    VIT: "Vitality",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Avatar section */}
      <View style={styles.profileAvatarSection}>
        <View style={styles.profileAvatarContainer}>
          <Avatar3D
            size={150}
            pose="idle"
          />
        </View>
        <View style={styles.profileLevelBadge}>
          <Text style={styles.profileLevelText}>Lv {player.level}</Text>
        </View>
        <Text style={styles.profileExp}>{player.exp?.toLocaleString()} EXP</Text>
        <Text style={styles.profileDominant}>
          {statLabels[dominantStat]} specialist
        </Text>
      </View>

      {/* Stats chart */}
      <View style={styles.profileStatsSection}>
        <Text style={styles.sectionLabel}>Stats Distribution</Text>
        <View style={{ alignItems: "center" }}>
          <PlayerStatsChart
            value={chartStats}
            size={240}
            showTotalExp={totalStats}
            onStatPress={onOpenStatInfo}
          />
        </View>
      </View>

      {/* Recent activity */}
      <View style={styles.profileActivitySection}>
        <Text style={styles.sectionLabel}>Favorite Quests</Text>
        <View style={styles.profileQuestList}>
          {(player.recentQuests || []).map((quest, i) => (
            <View key={i} style={styles.profileQuestItem}>
              <Text style={styles.profileQuestEmoji}>⚔️</Text>
              <Text style={styles.profileQuestName}>{quest}</Text>
            </View>
          ))}
          {(!player.recentQuests || player.recentQuests.length === 0) && (
            <Text style={styles.muted}>No recent activity</Text>
          )}
        </View>
      </View>

      {/* Stats summary */}
      <View style={styles.profileSummary}>
        <View style={styles.profileSummaryStat}>
          <Text style={styles.profileSummaryValue}>{Math.round((player.minutes || 0) / 60)}h</Text>
          <Text style={styles.profileSummaryLabel}>Time Questing</Text>
        </View>
        <View style={styles.profileSummaryStat}>
          <Text style={styles.profileSummaryValue}>{totalStats.toLocaleString()}</Text>
          <Text style={styles.profileSummaryLabel}>Total Stats</Text>
        </View>
      </View>
    </ScrollView>
  );
}