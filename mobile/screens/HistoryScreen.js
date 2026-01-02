import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import * as Clipboard from "expo-clipboard";
import styles from "../../style";
import { buildLogText } from "../core/logs";
import { aggregateStandGains } from "../core/stats";
import { computeStreakDays } from "../core/quests";
import { playerStatsToChartValues } from "../core/stats";
import { filterSessionsByPeriod } from "../core/feed";
import { deriveActivityEventsFromSessions } from "../core/activityEvents";
import { PlayerStatsChart } from "../components/PlayerStatsChart";
import { FeedList } from "../components/feed";

const PERIODS = {
  day: { label: "Day", days: 1, color: "#38bdf8", fill: "rgba(56,189,248,0.18)" },
  week: { label: "Week", days: 7, color: "#a78bfa", fill: "rgba(167,139,250,0.18)" },
  month: { label: "Month", days: 30, color: "#fbbf24", fill: "rgba(251,191,36,0.18)" },
  all: { label: "All", days: null, color: "#22c55e", fill: "rgba(34,197,94,0.18)" },
};

function Chip({ label, onPress, active, highlighted }) {
  const chipStyles = [
    styles.chip,
    active && styles.chipActive,
    highlighted && styles.chipHighlighted,
  ].filter(Boolean);
  return (
    <TouchableOpacity style={chipStyles} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HistoryScreen({ sessions }) {
  const [logStyle, setLogStyle] = useState("raw");
  const [copied, setCopied] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("week"); // single-select

  async function copyLog() {
    const text = buildLogText(logStyle, sessions);
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const selectPeriod = (id) => {
    setSelectedPeriod(id);
  };

  const now = useMemo(() => new Date(), []);

  // Calculate data for the selected period
  const periodData = useMemo(() => {
    const def = PERIODS[selectedPeriod];
    if (!def) return null;

    const filtered = filterSessionsByPeriod(sessions, def.days, now);

    const exp = filtered.reduce((sum, s) => sum + (s.expResult?.totalExp || 0), 0);
    const minutes = filtered.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const gains = aggregateStandGains(filtered);
    const chart = playerStatsToChartValues(gains);

    return {
      id: selectedPeriod,
      label: def.label,
      color: def.color,
      fill: def.fill,
      sessions: filtered,
      exp,
      minutes,
      chart,
      count: filtered.length,
    };
  }, [selectedPeriod, sessions, now]);

  const primary = periodData || {
    id: "all",
    label: "All",
    color: PERIODS.all.color,
    fill: PERIODS.all.fill,
    sessions,
    exp: sessions.reduce((s, v) => s + (v.expResult?.totalExp || 0), 0),
    minutes: sessions.reduce((s, v) => s + (v.durationMinutes || 0), 0),
    chart: playerStatsToChartValues(aggregateStandGains(sessions)),
    count: sessions.length,
  };

  // Sessions for the selected period
  const filteredSessions = primary.sessions;
  const streakDays = computeStreakDays(sessions);

  const items = useMemo(() => {
    return deriveActivityEventsFromSessions({
      sessions: filteredSessions,
      includeLevelUps: false,
      includeStreakMilestones: false,
    });
  }, [filteredSessions]);

  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>History / Insights</Text>
      </View>

      {/* Period selector */}
      <View style={styles.exportControls}>
        <View style={styles.rowWrap}>
          {Object.entries(PERIODS).map(([id, def]) => (
            <Chip
              key={id}
              label={def.label}
              active={selectedPeriod === id}
              onPress={() => selectPeriod(id)}
              highlighted
            />
          ))}
        </View>
        {filteredSessions.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={copyLog}>
            <Text style={styles.exportBtnText}>{copied ? "Copied!" : "Copy log"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stat gains chart for the selected period */}
      <View style={{ alignItems: "center", marginVertical: 8 }}>
        <PlayerStatsChart
          value={primary.chart}
          size={260}
          showTotalExp={primary.exp}
        />
      </View>

      {/* Period summary */}
      <Text style={[styles.historyEchoItem, { color: primary.color, textAlign: "center", marginTop: 8 }]}>
        {primary.label}: {primary.count} quests • {Math.round(primary.minutes / 60)}h • {primary.exp} EXP
      </Text>

      {/* Stats summary */}
      <View style={styles.historyStats}>
        <View style={styles.historyStat}>
          <Text style={styles.historyStatValue}>{primary.count}</Text>
          <Text style={styles.historyStatLabel}>Quests</Text>
        </View>
        <View style={styles.historyStat}>
          <Text style={styles.historyStatValue}>{Math.round(primary.minutes / 60)}h</Text>
          <Text style={styles.historyStatLabel}>Time</Text>
        </View>
        <View style={styles.historyStat}>
          <Text style={styles.historyStatValue}>{primary.exp}</Text>
          <Text style={styles.historyStatLabel}>EXP</Text>
        </View>
        <View style={styles.historyStat}>
          <Text style={styles.historyStatValue}>{streakDays}</Text>
          <Text style={styles.historyStatLabel}>Day streak</Text>
        </View>
      </View>

      {/* Session list - now using the shared FeedList primitive */}
      <FeedList
        items={items}
        emptyText="No quests in this period. Start your journey!"
        variant="history"
      />
    </View>
  );
}
