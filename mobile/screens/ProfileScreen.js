import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import styles from "../../style";
import { StandStatsChart } from "../StandStatsChart";
import { playerStatsToChartValues } from "../core/stats";
import { Avatar3D } from "../Avatar3D";
import { getPlayerTitle } from "../core/stats";

/**
 * ProfileScreen - Shows a player's profile
 *
 * Supports both:
 * - Legacy player object: { name, level, exp, standExp, minutes, recentQuests }
 * - New Profile entity: { name, avatar: { level, standExp, ... }, privacy: { ... } }
 */
export default function ProfileScreen({ player, profile, onBack }) {
  // Support both legacy player object and new Profile entity
  const displayProfile = useMemo(() => {
    if (profile) {
      return {
        name: profile.name,
        level: profile.avatar?.level || 1,
        exp: profile.avatar?.totalExp || 0,
        standExp: profile.avatar?.standExp || {},
        minutes: profile.stats?.totalMinutes || 0,
        recentQuests: profile.recentQuests || [],
        privacy: profile.privacy || { showQuests: true, showOnLeaderboard: true },
      };
    }
    // Legacy player object
    return {
      ...player,
      privacy: { showQuests: true, showOnLeaderboard: true },
    };
  }, [player, profile]);

  // Convert player's standExp to chart values (normalized 1-6 scale)
  const chartStats = useMemo(() => {
    return playerStatsToChartValues(playerData.standExp || {});
  }, [playerData.standExp]);

  // Calculate total stats for display
  const totalStats = useMemo(() => {
    const exp = playerData.standExp || {};
    return Object.values(exp).reduce((sum, val) => sum + (val || 0), 0);
  }, [playerData.standExp]);

  // Find dominant stat
  const dominantStat = useMemo(() => {
    const exp = playerData.standExp || {};
    let maxKey = "STR";
    let maxVal = 0;
    Object.entries(exp).forEach(([key, val]) => {
      if (val > maxVal) {
        maxKey = key;
        maxVal = val;
      }
    });
    return maxKey;
  }, [playerData.standExp]);

  // Get player title based on level
  const playerTitle = useMemo(() => {
    return getPlayerTitle(playerData.level || 1);
  }, [playerData.level]);

  const statLabels = {
    STR: "Strength",
    DEX: "Dexterity", 
    STA: "Stamina",
    INT: "Intelligence",
    SPI: "Spirit",
    CRE: "Creativity",
    VIT: "Vitality",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header with back button */}
      <View style={styles.profileHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.profileTitle}>{playerData.name}</Text>
      </View>

      {/* Avatar section */}
      <View style={styles.profileAvatarSection}>
        <View style={styles.profileAvatarContainer}>
          <Avatar3D
            size={150}
            pose="idle"
          />
        </View>
        <View style={styles.profileLevelBadge}>
          <Text style={styles.profileLevelText}>Lv {playerData.level}</Text>
        </View>
        <Text style={styles.profileExp}>{playerData.exp?.toLocaleString()} EXP</Text>
        <Text style={styles.profileTitle2}>{playerTitle}</Text>
        <Text style={styles.profileDominant}>
          {statLabels[dominantStat]} specialist
        </Text>
      </View>

      {/* Stats chart */}
      <View style={styles.profileStatsSection}>
        <Text style={styles.sectionLabel}>Stats Distribution</Text>
        <StandStatsChart
          value={chartStats}
          size={240}
          hideOuterRing
          showTotalExp={totalStats}
        />
      </View>

      {/* Stat breakdown */}
      <View style={styles.profileStatBreakdown}>
        {Object.entries(playerData.standExp || {}).map(([key, val]) => (
          <View key={key} style={styles.profileStatRow}>
            <Text style={styles.profileStatLabel}>{statLabels[key] || key}</Text>
            <View style={styles.profileStatBarBg}>
              <View
                style={[
                  styles.profileStatBar,
                  { width: `${Math.min(100, (val / Math.max(...Object.values(playerData.standExp || {}), 1)) * 100)}%` }
                ]}
              />
            </View>
            <Text style={styles.profileStatValue}>{val?.toLocaleString()}</Text>
          </View>
        ))}
      </View>

      {/* Recent activity - respect privacy settings */}
      {playerData.privacy?.showQuests !== false && (
        <View style={styles.profileActivitySection}>
          <Text style={styles.sectionLabel}>Favorite Quests</Text>
          <View style={styles.profileQuestList}>
            {(playerData.recentQuests || []).map((quest, i) => (
              <View key={i} style={styles.profileQuestItem}>
                <Text style={styles.profileQuestEmoji}>⚔️</Text>
                <Text style={styles.profileQuestName}>{quest}</Text>
              </View>
            ))}
            {(!playerData.recentQuests || playerData.recentQuests.length === 0) && (
              <Text style={styles.muted}>No recent activity</Text>
            )}
          </View>
        </View>
      )}

      {/* Stats summary */}
      <View style={styles.profileSummary}>
        <View style={styles.profileSummaryStat}>
          <Text style={styles.profileSummaryValue}>{Math.round((playerData.minutes || 0) / 60)}h</Text>
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