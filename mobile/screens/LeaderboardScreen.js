import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../../style";

function Chip({ label, onPress, active }) {
  const chipStyles = [styles.chip, active && styles.chipActive].filter(Boolean);
  return (
    <TouchableOpacity style={chipStyles} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

// Mock leaderboard players with different stat distributions
export const MOCK_PLAYERS = [
  {
    id: "darkslayer",
    name: "XxDarkSlayer99xX",
    level: 42,
    exp: 52000,
    minutes: 3200,
    // Lots of weightlifting, dexterity work, and meditation
    standExp: { STR: 2800, DEX: 1500, STA: 800, INT: 200, SPI: 1200, CRE: 100, VIT: 400 },
    recentQuests: ["Weightlifting", "Boxing", "Meditation", "Stretching"],
    avatarSeed: "darkslayer",
  },
  {
    id: "studymaster",
    name: "StudyMaster",
    level: 38,
    exp: 41000,
    minutes: 2600,
    // Pure intellectual focus
    standExp: { STR: 50, DEX: 100, STA: 200, INT: 4500, SPI: 300, CRE: 800, VIT: 50 },
    recentQuests: ["Deep Study", "Reading", "Problem Solving", "Language Learning"],
    avatarSeed: "studymaster",
  },
  {
    id: "focusking",
    name: "FocusKing",
    level: 35,
    exp: 36000,
    minutes: 2100,
    // Balanced mental + physical wellness
    standExp: { STR: 400, DEX: 300, STA: 500, INT: 1800, SPI: 1500, CRE: 200, VIT: 1300 },
    recentQuests: ["Meditation", "Deep Work", "Yoga", "Walking"],
    avatarSeed: "focusking",
  },
  {
    id: "grindmode",
    name: "GrindMode",
    level: 28,
    exp: 22000,
    minutes: 1500,
    // Even distribution - does everything
    standExp: { STR: 600, DEX: 550, STA: 580, INT: 620, SPI: 540, CRE: 590, VIT: 520 },
    recentQuests: ["Morning Workout", "Study Session", "Creative Writing", "Run"],
    avatarSeed: "grindmode",
  },
];

export default function LeaderboardScreen({ avatar, sessions = [], onViewProfile }) {
  const [metric, setMetric] = useState("exp"); // exp | time

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const mockLeaders = useMemo(() => {
    const player = {
      id: "player",
      name: avatar.name,
      level: avatar.level,
      exp: avatar.totalExp || 0,
      minutes: totalMinutes,
      standExp: avatar.standExp || {},
      isPlayer: true,
    };
    return [...MOCK_PLAYERS, player];
  }, [avatar, totalMinutes]);

  const sorted = useMemo(() => {
    return [...mockLeaders].sort((a, b) =>
      metric === "exp" ? (b.exp || 0) - (a.exp || 0) : (b.minutes || 0) - (a.minutes || 0)
    );
  }, [mockLeaders, metric]);

  const playerRank = sorted.findIndex((l) => l.isPlayer) + 1;

  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Leaderboard</Text>
      </View>

      {/* Metric selector */}
      <View style={styles.exportControls}>
        <View style={styles.rowWrap}>
          <Chip label="EXP" active={metric === "exp"} onPress={() => setMetric("exp")} />
          <Chip label="Time" active={metric === "time"} onPress={() => setMetric("time")} />
        </View>
        <Text style={styles.footerMeta}>
          {metric === "exp" ? "Ranked by total EXP" : "Ranked by time questing"}
        </Text>
      </View>

      {/* Player rank highlight */}
      <View style={styles.playerRankCard}>
        <Text style={styles.playerRankLabel}>Your Rank</Text>
        <Text style={styles.playerRankValue}>#{playerRank || "—"}</Text>
        <Text style={styles.playerRankExp}>
          {metric === "exp" ? `${avatar.totalExp || 0} EXP` : `${Math.round(totalMinutes / 60)}h questing`}
        </Text>
      </View>

      {/* Leaderboard list */}
      <View style={styles.leaderboardList}>
        {sorted.map((player, index) => (
          <TouchableOpacity
            key={player.name}
            style={[
              styles.leaderboardItem,
              player.isPlayer && styles.leaderboardItemPlayer,
            ]}
            onPress={() => onViewProfile?.(player)}
            activeOpacity={0.7}
          >
            <Text style={styles.leaderboardRank}>#{index + 1}</Text>
            <View style={styles.leaderboardInfo}>
              <Text style={styles.leaderboardName}>{player.name}</Text>
              <Text style={styles.leaderboardLevel}>Lv {player.level}</Text>
            </View>
            <Text style={styles.leaderboardExp}>
              {metric === "exp" ? `${player.exp}` : `${Math.round((player.minutes || 0) / 60)}h`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.leaderboardNote}>
        Leaderboard will sync with friends soon. Metrics toggle now mirrors your quickstart goals.
      </Text>
    </View>
  );
}
