import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../../style";
import { FeedList } from "../components/feed";
import { deriveActivityEventsFromSessions } from "../core/activityEvents";
import { filterSessionsByPeriod } from "../core/feed";
import { aggregateStandGains, playerStatsToChartValues } from "../core/stats";
import { PlayerStatsChart } from "../components/PlayerStatsChart";

const SCOPES = [
  { id: "you", label: "You" },
  { id: "friends", label: "Friends" },
  { id: "all", label: "All" },
];

const INSIGHT_PERIODS = {
  day: { label: "Day", days: 1, color: "#38bdf8" },
  week: { label: "Week", days: 7, color: "#a78bfa" },
  month: { label: "Month", days: 30, color: "#fbbf24" },
};

// Mock friends feed data - simulates activity from people you follow
const MOCK_FRIENDS_SESSIONS = [
  {
    id: "friend-1",
    description: "Morning Run",
    durationMinutes: 35,
    completedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    expResult: { totalExp: 420, standExp: { STA: 260, VIT: 110, SPI: 50 } },
    comboBonus: true,
    userName: "FocusKing",
    userLevel: 35,
  },
  {
    id: "friend-2",
    description: "Deep Study Session",
    durationMinutes: 90,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    expResult: { totalExp: 1080, standExp: { INT: 780, SPI: 200, DEX: 100 } },
    restBonus: true,
    userName: "StudyMaster",
    userLevel: 38,
  },
  {
    id: "friend-3",
    description: "Meditation",
    durationMinutes: 20,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    expResult: { totalExp: 240, standExp: { SPI: 180, VIT: 60 } },
    userName: "FocusKing",
    userLevel: 35,
  },
  {
    id: "friend-4",
    description: "Weightlifting",
    durationMinutes: 60,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    expResult: { totalExp: 720, standExp: { STR: 520, STA: 120, VIT: 80 } },
    comboBonus: true,
    userName: "XxDarkSlayer99xX",
    userLevel: 42,
  },
  {
    id: "friend-5",
    description: "Language Learning",
    durationMinutes: 45,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // 1+ day ago
    expResult: { totalExp: 540, standExp: { INT: 320, CHA: 140, VIT: 80 } },
    userName: "StudyMaster",
    userLevel: 38,
  },
];

// Mock global feed data - simulates worldwide activity
const MOCK_GLOBAL_SESSIONS = [
  {
    id: "global-1",
    description: "Yoga Flow",
    durationMinutes: 30,
    completedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
    expResult: { totalExp: 360, standExp: { DEX: 180, SPI: 110, VIT: 70 } },
    userName: "ZenWarrior",
    userLevel: 27,
  },
  {
    id: "global-2",
    description: "Boxing Training",
    durationMinutes: 45,
    completedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 min ago
    expResult: { totalExp: 540, standExp: { STR: 280, STA: 180, VIT: 80 } },
    comboBonus: true,
    userName: "XxDarkSlayer99xX",
    userLevel: 42,
  },
  {
    id: "global-3",
    description: "Creative Writing",
    durationMinutes: 60,
    completedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(), // 20 min ago
    expResult: { totalExp: 720, standExp: { SPI: 420, INT: 210, CHA: 90 } },
    userName: "WordSmith42",
    userLevel: 19,
  },
  {
    id: "global-4",
    description: "Deep Work Sprint",
    durationMinutes: 25,
    completedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 min ago
    expResult: { totalExp: 300, standExp: { INT: 180, VIT: 80, SPI: 40 } },
    userName: "GrindMode",
    userLevel: 28,
  },
  {
    id: "global-5",
    description: "Morning Run",
    durationMinutes: 35,
    completedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
    expResult: { totalExp: 420, standExp: { STA: 260, VIT: 110, SPI: 50 } },
    userName: "FocusKing",
    userLevel: 35,
  },
  {
    id: "global-6",
    description: "Guitar Practice",
    durationMinutes: 40,
    completedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    expResult: { totalExp: 480, standExp: { DEX: 320, SPI: 100, VIT: 60 } },
    restBonus: true,
    userName: "MelodyMaker",
    userLevel: 22,
  },
  {
    id: "global-7",
    description: "Deep Study Session",
    durationMinutes: 90,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    expResult: { totalExp: 1080, standExp: { INT: 780, SPI: 200, DEX: 100 } },
    userName: "StudyMaster",
    userLevel: 38,
  },
  {
    id: "global-8",
    description: "HIIT Workout",
    durationMinutes: 20,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    expResult: { totalExp: 240, standExp: { STA: 120, STR: 80, VIT: 40 } },
    comboBonus: true,
    userName: "BurnMachine",
    userLevel: 31,
  },
];

function ScopeChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function PeriodChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, styles.chipHighlighted, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * FeedScreen - Unified activity feed with scope selector (You/Friends/All)
 *
 * Uses the shared FeedList primitive for session rendering.
 * - scope="you": Shows user's own sessions
 * - scope="friends": Shows activity from people you follow (mock data for now)
 * - scope="all": Shows global activity feed (mock data for now)
 */
export default function FeedScreen({ sessions = [], onOpenStatInfo, onViewProfile, onViewSession }) {
  const [selectedScope, setSelectedScope] = useState("you");
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const now = useMemo(() => new Date(), []);

  // Select sessions based on scope
  const scopedSessions = useMemo(() => {
    switch (selectedScope) {
      case "you":
        return sessions;
      case "friends":
        return MOCK_FRIENDS_SESSIONS;
      case "all":
        return MOCK_GLOBAL_SESSIONS;
      default:
        return sessions;
    }
  }, [selectedScope, sessions]);

  const items = useMemo(() => {
    if (selectedScope !== "you") return null;
    return deriveActivityEventsFromSessions({
      sessions: scopedSessions,
      // Keep this lightweight for now: sessions are the canonical primitive;
      // Feed renders ActivityEvents projected from sessions.
      includeLevelUps: false,
      includeStreakMilestones: false,
    });
  }, [selectedScope, scopedSessions]);

  const insights = useMemo(() => {
    if (selectedScope !== "you") return null;
    const def = INSIGHT_PERIODS[selectedPeriod] || INSIGHT_PERIODS.week;
    const filtered = filterSessionsByPeriod(scopedSessions, def.days, now);
    const exp = filtered.reduce((sum, s) => sum + (s.expResult?.totalExp || 0), 0);
    const minutes = filtered.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const gains = aggregateStandGains(filtered);
    const chart = playerStatsToChartValues(gains);
    return {
      label: def.label,
      color: def.color,
      exp,
      minutes,
      count: filtered.length,
      chart,
    };
  }, [now, scopedSessions, selectedPeriod, selectedScope]);

  // Empty state text varies by scope
  const emptyText = useMemo(() => {
    switch (selectedScope) {
      case "you":
        return "No quests yet. Start your journey!";
      case "friends":
        return "No friend activity yet. Follow some adventurers!";
      case "all":
        return "No global activity yet. Be the first!";
      default:
        return "No activity to show.";
    }
  }, [selectedScope]);

  const header = useMemo(() => {
    if (selectedScope !== "you") return null;

    return (
      <View style={{ alignItems: "center", marginBottom: 10 }}>
        <View style={[styles.rowWrap, { justifyContent: "center", marginTop: 8 }]}>
          {Object.entries(INSIGHT_PERIODS).map(([id, def]) => (
            <PeriodChip
              key={id}
              label={def.label}
              active={selectedPeriod === id}
              onPress={() => setSelectedPeriod(id)}
            />
          ))}
        </View>

        {insights?.count > 0 ? (
          <View style={{ alignItems: "center", marginTop: 6 }}>
            <PlayerStatsChart
              value={insights.chart}
              size={220}
              showTotalExp={insights.exp}
              onStatPress={onOpenStatInfo}
            />
            <Text style={[styles.historyEchoItem, { color: insights.color, textAlign: "center", marginTop: 6 }]}>
              {insights.label}: {insights.count} quests • {Math.round(insights.minutes / 60)}h • {insights.exp} EXP
            </Text>
          </View>
        ) : (
          <Text style={[styles.emptyText, { marginTop: 10 }]}>
            No quests in this period yet.
          </Text>
        )}
      </View>
    );
  }, [insights, selectedPeriod, selectedScope, onOpenStatInfo]);

  return (
    <View style={styles.screenContainer}>
      {/* Header with title and scope selector */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Feed</Text>
        <View style={localStyles.scopeRow}>
          {SCOPES.map((scope) => (
            <ScopeChip
              key={scope.id}
              label={scope.label}
              active={selectedScope === scope.id}
              onPress={() => setSelectedScope(scope.id)}
            />
          ))}
        </View>
      </View>

      {/* Feed list for all scopes */}
      <FeedList
        {...(selectedScope === "you"
          ? { items }
          : { sessions: scopedSessions })}
        emptyText={emptyText}
        variant="feed"
        showUserName={selectedScope !== "you"}
        header={header}
        onPressUser={onViewProfile}
        onPressSession={onViewSession}
      />
    </View>
  );
}

const localStyles = {
  scopeRow: {
    flexDirection: "row",
    gap: 8,
  },
};
