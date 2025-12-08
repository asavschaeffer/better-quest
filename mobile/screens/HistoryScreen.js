import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import styles from "../../style";
import { buildLogText } from "../core/logs";
import { aggregateStandGains } from "../core/stats";
import { computeStreakDays } from "../core/quests";
import { playerStatsToChartValues } from "../core/stats";
import { StandStatsChart } from "../StandStatsChart";

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
  const [selectedPeriods, setSelectedPeriods] = useState(["day"]); // multi-select

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

  const togglePeriod = (id) => {
    setSelectedPeriods((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((p) => p !== id);
        return next.length ? next : ["day"];
      }
      return [...prev, id];
    });
  };

  const now = useMemo(() => new Date(), []);

  const datasets = useMemo(() => {
    const list = [];
    selectedPeriods.forEach((id) => {
      const def = PERIODS[id];
      if (!def) return;
      let filtered = sessions;
      if (def.days) {
        const start = new Date(now);
        start.setDate(start.getDate() - def.days);
        filtered = sessions.filter((s) => {
          const d = new Date(s.completedAt || s.endTime || s.startTime);
          return d >= start;
        });
      }
      const exp = filtered.reduce((sum, s) => sum + (s.expResult?.totalExp || 0), 0);
      const minutes = filtered.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      const gains = aggregateStandGains(filtered);
      const chart = playerStatsToChartValues(gains);
      list.push({
        id,
        label: def.label,
        color: def.color,
        fill: def.fill,
        sessions: filtered,
        exp,
        minutes,
        chart,
        count: filtered.length,
      });
    });
    return list;
  }, [selectedPeriods, sessions, now]);

  const primary = datasets[0] || {
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

  // Group sessions by date for list rendering (use union of selected sessions)
  const unionSessions = useMemo(() => {
    const map = new Map();
    datasets.forEach((d) => {
      d.sessions.forEach((s) => map.set(s.id, s));
    });
    return Array.from(map.values());
  }, [datasets]);

  const groupedSessions = useMemo(() => {
    const groups = {};
    unionSessions.forEach((session) => {
      const date = new Date(session.completedAt || session.endTime || session.startTime).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(session);
    });
    return groups;
  }, [unionSessions]);

  const totalExp = datasets.reduce((sum, d) => sum + d.exp, 0);
  const totalMinutes = datasets.reduce((sum, d) => sum + d.minutes, 0);
  const streakDays = computeStreakDays(sessions);
  const overlays = datasets.slice(1).map((d) => ({
    value: d.chart,
    stroke: d.color,
    fill: d.fill,
    dash: "6,3",
    strokeWidth: 2,
  }));

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
              active={selectedPeriods.includes(id)}
              onPress={() => togglePeriod(id)}
              highlighted
            />
          ))}
        </View>
        {unionSessions.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={copyLog}>
            <Text style={styles.exportBtnText}>{copied ? "Copied!" : "Copy log"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stat gains chart for the selected period */}
      <StandStatsChart
        value={primary.chart}
        readOnly
        hideOuterRing
        size={260}
        showTotalExp={primary.exp}
        overlays={overlays}
      />

      {/* Period stat echoes */}
      <View style={styles.historyEchoList}>
        {datasets.map((d) => (
          <Text key={d.id} style={[styles.historyEchoItem, { color: d.color }]}>
            {d.label}: {d.count} quests • {Math.round(d.minutes / 60)}h • {d.exp} EXP
          </Text>
        ))}
      </View>

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

      {/* Session list */}
      <ScrollView style={styles.historyList}>
        {unionSessions.length === 0 ? (
          <Text style={styles.emptyText}>No quests in this period. Start your journey!</Text>
        ) : (
          Object.entries(groupedSessions).map(([date, dateSessions]) => (
            <View key={date}>
              <Text style={styles.historyDateHeader}>{date}</Text>
              {dateSessions.map((session) => (
                <View key={session.id} style={styles.historySessionItem}>
                  <Text style={styles.historySessionTitle}>{session.description}</Text>
                  <Text style={styles.historySessionMeta}>
                    {session.durationMinutes}m • +{session.expResult?.totalExp || 0} EXP
                    {session.comboBonus ? " 🔥" : ""}
                    {session.restBonus ? " 😴" : ""}
                  </Text>
                  {session.notes && (
                    <Text style={styles.historySessionNotes}>{session.notes}</Text>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
