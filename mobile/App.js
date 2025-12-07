import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  ScrollView,
  Linking,
  useWindowDimensions,
  Animated,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { 
  createDefaultAvatar, 
  createTaskSession, 
  createUser, 
  createQuest,
  STAT_KEYS,
  suggestStatsForLabel,
  validateQuestStats,
  getQuestStatTotal,
  QUEST_STAT_MAX_TOTAL,
} from "./core/models";
import {
  calculateExpForSession,
  applyExpToAvatar,
  getLevelProgress,
} from "./core/exp";
import { inferEmojiForDescription } from "./core/emoji";
import {
  generateRawLog,
  generateTwitterLog,
  generateLinkedInLog,
} from "./core/logFormats";
import { StandStatsChart } from "./StandStatsChart";
import { QuestStatsWheel } from "./QuestStatsWheel";
import { QuickLaunchEditor } from "./QuickLaunchEditor";
import {
  loadUserQuests,
  addUserQuest,
  deleteUserQuest,
  BUILT_IN_QUEST_TEMPLATES,
  questStatsToChartStats,
} from "./core/questStorage";
import { Avatar3D } from "./Avatar3D";

const STORAGE_KEY = "better-quest-mobile-state-v1";
const COMBO_BONUS_MULTIPLIER = 1.2;
const REST_BONUS_MULTIPLIER = 1.1;
const REST_BONUS_WINDOW_MINUTES = 45;

export default function App() {
  const [user, setUser] = useState(() => createUser());
  const [sessions, setSessions] = useState([]);
  const [motivation, setMotivation] = useState("");
  const [userQuests, setUserQuests] = useState([]);

  const [screen, setScreen] = useState("home"); // home | library | history | leaderboard | settings | quest | newQuest | session | complete
  const [activeTab, setActiveTab] = useState("home"); // tracks navbar selection
  const [currentSession, setCurrentSession] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [notes, setNotes] = useState("");
  const [lastExpResult, setLastExpResult] = useState(null);
  const [comboFromSessionId, setComboFromSessionId] = useState(null);
  const [wellRestedUntil, setWellRestedUntil] = useState(null);
  const [draftQuestName, setDraftQuestName] = useState("");
  const [editingQuest, setEditingQuest] = useState(null); // quest being edited
  const [pendingQuestAction, setPendingQuestAction] = useState(null); // action to open after save & start
  const [homeFooterConfig, setHomeFooterConfig] = useState({
    showCompletedToday: true,
    showUpcoming: true,
  });
  const [quickStartMode, setQuickStartMode] = useState("picker"); // picker | instant
  const announcements = useMemo(() => ([
    { id: "version-0-1", title: "Version 0.1 live now", body: "New quickstart options and refreshed insights." },
    { id: "history-graph", title: "Graph history added 12/6!", body: "View multi-period stat gains in Insights." },
  ]), []);

  // Hydrate on mount
  useEffect(() => {
    (async () => {
      try {
        // Load main app state
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.avatar) {
            setUser({ ...createUser(), avatar: parsed.avatar });
          }
          if (Array.isArray(parsed.sessions)) {
            setSessions(parsed.sessions);
          }
          if (typeof parsed.motivation === "string") {
            setMotivation(parsed.motivation);
          }
          if (parsed.comboFromSessionId) {
            setComboFromSessionId(parsed.comboFromSessionId);
          }
          if (parsed.wellRestedUntil) {
            setWellRestedUntil(parsed.wellRestedUntil);
          }
          if (parsed.homeFooterConfig) {
            setHomeFooterConfig({
              showCompletedToday: parsed.homeFooterConfig.showCompletedToday ?? true,
              showUpcoming: parsed.homeFooterConfig.showUpcoming ?? true,
            });
          }
          if (parsed.quickStartMode === "instant" || parsed.quickStartMode === "picker") {
            setQuickStartMode(parsed.quickStartMode);
          }
        }
        
        // Load user quests
        const quests = await loadUserQuests();
        setUserQuests(quests);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    const save = async () => {
      try {
        const state = {
          avatar: user.avatar,
          sessions,
          motivation,
          comboFromSessionId,
          wellRestedUntil,
          homeFooterConfig,
          quickStartMode,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    };
    save();
  }, [user, sessions, motivation, comboFromSessionId, wellRestedUntil, homeFooterConfig, quickStartMode]);

  // Timer effect
  useEffect(() => {
    if (!currentSession || screen !== "session") return;
    const endTime =
      currentSession.endTimeMs ??
      Date.now() + currentSession.durationMinutes * 60 * 1000;
    setRemainingMs(endTime - Date.now());

    const id = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        handleTimerComplete(endTime);
      }
    }, 500);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id, screen]);

  const avatar = user.avatar ?? createDefaultAvatar();
  const levelInfo = useMemo(
    () => getLevelProgress(avatar.totalExp ?? 0),
    [avatar.totalExp],
  );

  const quickstartSuggestions = useMemo(
    () => computeQuickstartSuggestions(userQuests, avatar),
    [userQuests, avatar],
  );

  function handleStartQuest() {
    setScreen("quest");
  }

  function startQuestFromTemplate(template) {
    if (!template) {
      // Fallback to manual selection
      setScreen("quest");
      return;
    }

    const sessionParams = {
      description: template.label || "Quest",
      durationMinutes: template.defaultDurationMinutes || 25,
      focusStats: questStatsToChartStats(template.stats || {}),
      questAction: template.action || null,
    };

    if (sessionParams.questAction) {
      setPendingQuestAction(sessionParams.questAction);
    }

    handleStartSession(sessionParams);
  }

  function handleStartSession({
    description,
    durationMinutes,
    focusStats,
  }) {
    const id = `session-${Date.now()}`;
    // Determine bonuses based on previous actions.
    const now = Date.now();
    let hasCombo = false;
    let hasRest = false;
    if (comboFromSessionId && sessions[0]?.id === comboFromSessionId) {
      hasCombo = true;
    }
    if (wellRestedUntil) {
      const until = Date.parse(wellRestedUntil);
      if (!Number.isNaN(until) && now < until) {
        hasRest = true;
      }
    }
    let bonusMultiplier = 1;
    if (hasCombo) bonusMultiplier *= COMBO_BONUS_MULTIPLIER;
    if (hasRest) bonusMultiplier *= REST_BONUS_MULTIPLIER;

    const session = createTaskSession({
      id,
      description,
      durationMinutes,
      startTime: new Date().toISOString(),
      standStats: focusStats,
      comboBonus: hasCombo,
      restBonus: hasRest,
      bonusMultiplier,
    });
    session.icon = inferEmojiForDescription(description);
    setCurrentSession(session);
    // Clear one-shot bonus flags once consumed.
    if (hasCombo) setComboFromSessionId(null);
    if (hasRest) setWellRestedUntil(null);
    setScreen("session");
  }

  function handleTimerComplete(endTimeMs) {
    if (!currentSession) return;
    const completedSession = {
      ...currentSession,
      endTime: new Date(endTimeMs).toISOString(),
    };
    const baseExp = calculateExpForSession(completedSession);
    const exp = applySessionBonuses(completedSession, baseExp);
    setLastExpResult(exp);
    const nextAvatar = applyExpToAvatar(avatar, exp);
    setUser((prev) => ({ ...prev, avatar: nextAvatar }));

    setSessions((prev) => [
      {
        id: completedSession.id,
        description: completedSession.description,
        durationMinutes: completedSession.durationMinutes,
        completedAt: completedSession.endTime,
        standStats: completedSession.standStats ?? null,
        expResult: exp,
        notes: "",
        bonusMultiplier: completedSession.bonusMultiplier ?? 1,
        comboBonus: !!completedSession.comboBonus,
        restBonus: !!completedSession.restBonus,
      },
      ...prev,
    ]);

    setCurrentSession(completedSession);
    setNotes("");
    setScreen("complete");
  }

  function handleCancelSession() {
    setCurrentSession(null);
    setScreen("home");
  }

  function handleContinueQuest() {
    // Save notes onto the last session
    if (sessions[0] && notes.trim()) {
      setSessions((prev) => {
        const copy = [...prev];
        copy[0] = { ...copy[0], notes: notes.trim() };
        return copy;
      });
    }
    if (sessions[0]) {
      setComboFromSessionId(sessions[0].id);
    }
    setScreen("quest");
  }

  function handleTakeBreak() {
    if (sessions[0] && notes.trim()) {
      setSessions((prev) => {
        const copy = [...prev];
        copy[0] = { ...copy[0], notes: notes.trim() };
        return copy;
      });
    }
    // Mark a short well-rested window for the next quest.
    const windowMs = REST_BONUS_WINDOW_MINUTES * 60 * 1000;
    setWellRestedUntil(new Date(Date.now() + windowMs).toISOString());
    setCurrentSession(null);
    setScreen("home");
  }

  function handleEndForNow() {
    if (sessions[0] && notes.trim()) {
      setSessions((prev) => {
        const copy = [...prev];
        copy[0] = { ...copy[0], notes: notes.trim() };
        return copy;
      });
    }
    setCurrentSession(null);
    setScreen("home");
  }

  // Helper to open quest action (URL or app)
  async function openQuestAction(action) {
    if (!action || !action.value) return;
    
    try {
      let url = action.value.trim();
      
      if (action.type === "url") {
        // Ensure URL has protocol
        if (!/^https?:\/\//i.test(url)) {
          url = "https://" + url;
        }
      } else if (action.type === "file") {
        // Convert file path to file:// URL
        if (!url.startsWith("file://")) {
          // Handle Windows paths (C:\path\to\file)
          if (/^[a-zA-Z]:/.test(url)) {
            url = "file:///" + url.replace(/\\/g, "/");
          } else if (!url.startsWith("/")) {
            url = "file:///" + url;
          } else {
            url = "file://" + url;
          }
        }
      }
      // For "app" type, use the value as-is (protocol handler like spotify:)
      
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      }
    } catch (e) {
      console.log("Failed to open quest action:", e);
    }
  }

  // Open pending action when session starts
  useEffect(() => {
    if (pendingQuestAction && screen === "session") {
      openQuestAction(pendingQuestAction);
      setPendingQuestAction(null);
    }
  }, [pendingQuestAction, screen]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e) => {
      if (e.key === "Escape" && screen === "session" && currentSession) {
        e.preventDefault();
        handleCancelSession();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, currentSession, handleCancelSession]);

  // Navigation helpers
  function handleNavigation(tab) {
    setActiveTab(tab);
    setScreen(tab);
  }

  function handleQuickstartPress() {
    if (quickStartMode === "instant" && quickstartSuggestions.length > 0) {
      startQuestFromTemplate(quickstartSuggestions[0]);
      return;
    }
    setScreen("quest");
  }

  function handleQuickstartSelect(template) {
    startQuestFromTemplate(template);
  }

  function handleOpenSettings() {
    setScreen("settings");
  }

  function handleOpenNotifications() {
    // TODO: implement notifications screen
    console.log("Notifications pressed");
  }

  // Determine if navbar should show
  const showNavbar = ["home", "library", "history", "leaderboard"].includes(screen);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        {screen === "home" && (
          <HomeScreen
            avatar={avatar}
            levelInfo={levelInfo}
            onStartQuest={handleStartQuest}
            onQuickstart={handleQuickstartPress}
            onQuickstartSelect={handleQuickstartSelect}
            quickStartMode={quickStartMode}
            quickstartSuggestions={quickstartSuggestions}
            onOpenSettings={handleOpenSettings}
            onOpenNotifications={handleOpenNotifications}
            sessions={sessions}
            userQuests={userQuests}
            homeFooterConfig={homeFooterConfig}
            announcements={announcements}
          />
        )}
        {screen === "library" && (
          <LibraryScreen
            userQuests={userQuests}
            onSelectQuest={(quest) => {
              setEditingQuest(quest);
              setDraftQuestName("");
              setScreen("newQuest");
            }}
            onCreateQuest={() => {
              setDraftQuestName("");
              setEditingQuest(null);
              setScreen("newQuest");
            }}
          />
        )}
        {screen === "history" && (
          <HistoryScreen sessions={sessions} />
        )}
        {screen === "leaderboard" && (
          <LeaderboardScreen avatar={avatar} sessions={sessions} />
        )}
        {screen === "settings" && (
          <SettingsScreen
            avatar={avatar}
            onBack={() => {
              setScreen(activeTab);
            }}
            onUpdateAvatar={(updates) => {
              setUser((prev) => ({
                ...prev,
                avatar: { ...prev.avatar, ...updates },
              }));
            }}
            footerConfig={homeFooterConfig}
            onUpdateFooterConfig={(next) => setHomeFooterConfig(next)}
            quickStartMode={quickStartMode}
            onUpdateQuickStartMode={(mode) => setQuickStartMode(mode)}
          />
        )}
        {screen === "quest" && (
          <QuestSetupScreen
            userQuests={userQuests}
            onBack={() => setScreen("home")}
            onStartSession={(params) => {
              // Check if quest has an action to open
              if (params.questAction) {
                setPendingQuestAction(params.questAction);
              }
              handleStartSession(params);
            }}
            onCreateQuestDraft={(name) => {
              const trimmed = (name ?? "").trim();
              if (!trimmed) return;
              setDraftQuestName(trimmed);
              setScreen("newQuest");
            }}
            onDeleteQuest={async (questId) => {
              const updated = await deleteUserQuest(questId);
              setUserQuests(updated);
            }}
            onEditQuest={(quest) => {
              setEditingQuest(quest);
              setDraftQuestName("");
              setScreen("newQuest");
            }}
            onOpenQuestAction={openQuestAction}
          />
        )}
        {screen === "newQuest" && (
          <NewQuestScreen
            initialName={draftQuestName}
            editQuest={editingQuest}
            onBack={() => {
              setEditingQuest(null);
              setScreen("quest");
            }}
            onSave={async (quest) => {
              const updated = await addUserQuest(quest);
              setUserQuests(updated);
              setEditingQuest(null);
              setScreen("quest");
            }}
            onSaveAndStart={async (quest, sessionParams) => {
              const updated = await addUserQuest(quest);
              setUserQuests(updated);
              setEditingQuest(null);
              // Open quick launch action if present
              if (quest.action) {
                openQuestAction(quest.action);
              }
              handleStartSession(sessionParams);
            }}
            onDelete={async (questId) => {
              const updated = await deleteUserQuest(questId);
              setUserQuests(updated);
              setEditingQuest(null);
              setScreen("quest");
            }}
          />
        )}
        {screen === "session" && currentSession && (
          <SessionScreen
            session={currentSession}
            remainingMs={remainingMs}
            avatar={avatar}
            onCancel={handleCancelSession}
          />
        )}
        {screen === "complete" && currentSession && lastExpResult && (
          <CompleteScreen
            session={currentSession}
            expResult={lastExpResult}
            avatar={avatar}
            levelInfo={levelInfo}
            notes={notes}
            onNotesChange={setNotes}
            onContinue={handleContinueQuest}
            onBreak={handleTakeBreak}
            onEnd={handleEndForNow}
          />
        )}
        {/* Bottom Navbar */}
        {showNavbar && (
          <Navbar
            activeTab={activeTab}
            onNavigate={handleNavigation}
            onBigButtonPress={handleQuickstartPress}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// Default motivational quotes
const DEFAULT_QUOTES = [
  "The journey of a thousand miles begins with a single step.",
  "You don't have to be great to start, but you have to start to be great.",
  "Small daily improvements are the key to staggering long-term results.",
  "Discipline is choosing between what you want now and what you want most.",
  "The only way to do great work is to love what you do.",
];

// Get player title based on level
function getPlayerTitle(level) {
  if (level >= 50) return "Legendary Hero";
  if (level >= 40) return "Master";
  if (level >= 30) return "Expert";
  if (level >= 20) return "Veteran";
  if (level >= 10) return "Adventurer";
  if (level >= 5) return "Apprentice";
  return "Novice";
}

// Choose a simple pose based on dominant stat
function getAvatarPose(standExp = {}) {
  const entries = STAT_KEYS.map((k) => [k, standExp[k] ?? 0]);
  const [topKey] = entries.sort((a, b) => b[1] - a[1])[0] || ["STR", 0];
  if (topKey === "STR") return "flex";
  if (topKey === "SPI") return "serene";
  return "idle";
}

// Determine which accessories are unlocked based on level
function getUnlockedAccessories(level) {
  const accessories = [];
  if (level >= 3) accessories.push("wand");        // Early unlock - magic wand
  if (level >= 10) accessories.push("wizardHat");  // Wizard hat at level 10
  if (level >= 25) accessories.push("crown");      // Crown at level 25
  if (level >= 50) accessories.push("popeHat");    // Pope hat at level 50 (legendary)
  return accessories;
}

// Convert player's total stat EXP to chart values (1-5 scale)
// Uses logarithmic scaling so early progress feels impactful
function playerStatsToChartValues(standExp) {
  const chartValues = {};

  // Find the max stat to use for relative scaling
  const values = STAT_KEYS.map(key => standExp?.[key] ?? 0);
  const maxStat = Math.max(...values, 1); // At least 1 to avoid division by zero

  STAT_KEYS.forEach(key => {
    const exp = standExp?.[key] ?? 0;

    if (exp === 0) {
      chartValues[key] = 1; // Minimum value for empty stats
    } else {
      // Logarithmic scale: log(exp+1) normalized to 1-5 range
      // This makes early gains feel significant while still showing growth at higher levels
      const logValue = Math.log10(exp + 1);
      const logMax = Math.log10(maxStat + 1);

      // Scale to 1-5 range (1 is min, 5 is max)
      // Stats are shown relative to your highest stat
      const normalized = logMax > 0 ? (logValue / logMax) : 0;
      chartValues[key] = 1 + (normalized * 4); // 1-5 range
    }
  });

  return chartValues;
}

function HomeScreen({
  avatar,
  levelInfo,
  onStartQuest,
  onQuickstart,
  onQuickstartSelect,
  quickStartMode = "picker",
  quickstartSuggestions = [],
  onOpenSettings,
  onOpenNotifications,
  quotes = DEFAULT_QUOTES,
  sessions = [],
  userQuests = [],
  homeFooterConfig,
  announcements = [],
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Pick a random quote on mount (or cycle daily)
  const [quoteIndex] = useState(() => {
    const today = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = ((hash << 5) - hash) + today.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % quotes.length;
  });

  const currentQuote = quotes[quoteIndex] || quotes[0];
  const playerTitle = getPlayerTitle(avatar.level);
  const footerPrefs = homeFooterConfig || { showCompletedToday: true, showUpcoming: true };

  // Responsive sizing
  const stageWidth = Math.max(280, screenWidth - 32);
  const avatarSize = Math.min(240, stageWidth * 0.68);
  const stageHeight = Math.max(avatarSize + 60, Math.min(420, screenHeight * 0.45));
  const chartSize = Math.min(200, stageWidth * 0.38);

  const todayKey = useMemo(() => new Date().toDateString(), []);
  const todaySessions = useMemo(() => {
    return (sessions || []).filter((s) => {
      const date = s.completedAt || s.endTime || s.startTime;
      if (!date) return false;
      return new Date(date).toDateString() === todayKey;
    });
  }, [sessions, todayKey]);

  const upcomingQuests = useMemo(() => {
    const list = [...(userQuests || [])];
    if (list.length < 3) {
      BUILT_IN_QUEST_TEMPLATES.forEach((q) => {
        if (!list.find((item) => item.id === q.id) && list.length < 5) {
          list.push(q);
        }
      });
    }
    return list.slice(0, 3);
  }, [userQuests]);

  // Avatar roaming animation
  const avatarX = useRef(new Animated.Value(0)).current;
  const avatarY = useRef(new Animated.Value(0)).current;
  const bubbleX = useRef(new Animated.Value(0)).current;
  const bubbleY = useRef(new Animated.Value(0)).current;
  const [showQuoteBubble, setShowQuoteBubble] = useState(true);
  const [lookAtChart, setLookAtChart] = useState(false);

  // Roaming animation - avatar wanders around
  // Occasionally glance at the chart
  useEffect(() => {
    const glance = () => {
      setLookAtChart(Math.random() > 0.6);
    };
    glance();
    const interval = setInterval(glance, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const maxX = Math.max(0, stageWidth - avatarSize);
    const maxY = Math.max(0, stageHeight - avatarSize);

    const roam = () => {
      // Random position: stick to left (A/C) with rare excursions right
      const goRight = Math.random() > 0.85; // 15% chance to venture toward chart
      const leftRange = maxX * 0.6;
      const rightStart = Math.min(maxX, maxX * 0.55);
      const targetX = goRight
        ? rightStart + Math.random() * Math.max(12, maxX - rightStart)
        : Math.random() * Math.max(20, leftRange);
      const targetY = Math.random() * Math.max(12, maxY);

      // Show quote bubble when avatar is on the left
      setShowQuoteBubble(!goRight);
      // If we move toward the chart, glance at it
      if (goRight) setLookAtChart(true);

      // Bubble prefers bottom-right quadrant (D) while tracking avatar
      const bubbleTargetX = Math.max(
        stageWidth * 0.55,
        Math.min(stageWidth - 160, targetX + avatarSize * 0.6)
      );
      const bubbleTargetY = Math.max(
        stageHeight * 0.5,
        Math.min(stageHeight - 60, targetY + avatarSize * 0.6)
      );

      Animated.parallel([
        Animated.timing(avatarX, {
          toValue: targetX,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: false,
        }),
        Animated.timing(avatarY, {
          toValue: targetY,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: false,
        }),
      ]).start();

      // Snap bubble into place (no slide transition)
      bubbleX.setValue(bubbleTargetX);
      bubbleY.setValue(bubbleTargetY);
    };

    roam();
    const interval = setInterval(roam, 5000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [screenWidth, stageWidth, stageHeight, avatarSize]);

  return (
    <View style={styles.homeContainer}>
      {announcements.length > 0 && (
        <View style={styles.announcements}>
          {announcements.map((a) => (
            <View key={a.id} style={styles.announcementCard}>
              <Text style={styles.announcementTitle}>{a.title}</Text>
              <Text style={styles.announcementBody}>{a.body}</Text>
            </View>
          ))}
        </View>
      )}
      {/* Header Row: Username | Level + Title | Bell + Cog */}
      <View style={styles.homeHeader}>
        <Text style={styles.headerUsername}>{avatar.name}</Text>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLevel}>Lv {avatar.level}</Text>
          <Text style={styles.headerTitle}>{playerTitle}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onOpenNotifications}
          >
            <Text style={styles.headerIcon}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onOpenSettings}
          >
            <Text style={styles.headerIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stage: Chart as background, Avatar roams in foreground */}
      <View style={[styles.stage, { height: stageHeight }]}>
        {/* Background: Stats Chart in top-right corner */}
        <View style={styles.chartBackground}>
          <StandStatsChart
            value={playerStatsToChartValues(avatar.standExp)}
            readOnly
            size={chartSize}
            showTotalExp={avatar.totalExp}
            hideOuterRing
          />
        </View>

        {/* Foreground: Roaming Avatar */}
        <Animated.View
          style={[
            styles.roamingAvatar,
            {
              left: avatarX,
              top: avatarY,
              width: avatarSize,
              height: avatarSize,
            },
          ]}
        >
          <Avatar3D
            size={avatarSize}
            accessories={getUnlockedAccessories(avatar.level)}
            lookAtChart={lookAtChart}
            pose={getAvatarPose(avatar.standExp)}
          />
        </Animated.View>

        {/* Quote Speech Bubble - appears when avatar is on the left */}
        {showQuoteBubble && (
          <Animated.View
            style={[
              styles.quoteBubble,
              {
                left: bubbleX,
                top: bubbleY,
              },
            ]}
          >
            <Text style={styles.quoteBubbleText} numberOfLines={3}>
              "{currentQuote}"
            </Text>
            <View style={styles.quoteBubbleTail} />
          </Animated.View>
        )}
      </View>

      {/* EXP Progress */}
      <View style={styles.expProgressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${levelInfo.ratio * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.expText}>
          {levelInfo.current} / {levelInfo.required} EXP to next level
        </Text>
      </View>

      {/* Quickstart CTA */}
      <View style={styles.quickstartCard}>
        <View style={styles.quickstartHeader}>
          <Text style={styles.sectionLabel}>Quickstart</Text>
          <Text style={styles.quickstartMode}>
            {quickStartMode === "instant" ? "Instant start" : "Picker"}
          </Text>
        </View>
        <TouchableOpacity style={styles.quickstartBtn} onPress={onQuickstart}>
          <Text style={styles.quickstartBtnText}>
            {quickStartMode === "instant"
              ? "Start top quest now"
              : "Choose a quest"}
          </Text>
        </TouchableOpacity>
        <View style={styles.quickstartSuggestions}>
          {(quickstartSuggestions || []).slice(0, 3).map((quest) => (
            <TouchableOpacity
              key={quest.id}
              style={styles.quickstartChip}
              onPress={() => onQuickstartSelect?.(quest)}
            >
              <Text style={styles.quickstartChipLabel}>{quest.label}</Text>
              {quest.defaultDurationMinutes ? (
                <Text style={styles.quickstartChipMeta}>
                  {quest.defaultDurationMinutes}m
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
          {(!quickstartSuggestions || quickstartSuggestions.length === 0) && (
            <Text style={styles.footerEmpty}>Add quests to get suggestions.</Text>
          )}
        </View>
      </View>

      {(footerPrefs.showCompletedToday || footerPrefs.showUpcoming) && (
        <View style={styles.homeFooter}>
          {footerPrefs.showCompletedToday && (
            <View style={styles.homeFooterSection}>
              <View style={styles.homeFooterHeader}>
                <Text style={styles.sectionLabel}>Completed Today</Text>
                <Text style={styles.footerMeta}>{todaySessions.length} done</Text>
              </View>
              {todaySessions.length === 0 ? (
                <Text style={styles.footerEmpty}>No quests finished yet today.</Text>
              ) : (
                todaySessions.slice(0, 3).map((s) => (
                  <View key={s.id} style={styles.footerItem}>
                    <Text style={styles.footerItemTitle}>{s.description || "Quest"}</Text>
                    <Text style={styles.footerItemMeta}>
                      {s.durationMinutes || 0}m • +{s.expResult?.totalExp || 0} EXP
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {footerPrefs.showUpcoming && (
            <View style={styles.homeFooterSection}>
              <View style={styles.homeFooterHeader}>
                <Text style={styles.sectionLabel}>Important / Upcoming</Text>
                <Text style={styles.footerMeta}>{upcomingQuests.length} queued</Text>
              </View>
              {upcomingQuests.length === 0 ? (
                <Text style={styles.footerEmpty}>Add quests to see suggestions.</Text>
              ) : (
                upcomingQuests.map((q) => (
                  <View key={q.id} style={styles.footerItem}>
                    <Text style={styles.footerItemTitle}>{q.label}</Text>
                    {q.stats && (
                      <Text style={styles.footerItemMeta}>
                        {Object.entries(q.stats)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => `${k}+${v}`)
                          .join(" · ")}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// Library Screen - Quest templates management
function LibraryScreen({ userQuests = [], onSelectQuest, onCreateQuest }) {
  const allQuests = useMemo(() => {
    return [...userQuests, ...BUILT_IN_QUEST_TEMPLATES];
  }, [userQuests]);

  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Quest Library</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onCreateQuest}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.questLibraryList}>
        <Text style={styles.sectionLabel}>Your Quests</Text>
        {userQuests.length === 0 ? (
          <Text style={styles.emptyText}>No custom quests yet. Create one!</Text>
        ) : (
          userQuests.map((quest) => (
            <TouchableOpacity
              key={quest.id}
              style={styles.libraryQuestItem}
              onPress={() => onSelectQuest(quest)}
            >
              <View style={styles.libraryQuestInfo}>
                <Text style={styles.libraryQuestLabel}>{quest.label}</Text>
                <Text style={styles.libraryQuestMeta}>
                  {quest.defaultDurationMinutes}m • {getQuestStatTotal(quest.stats)} pts
                </Text>
              </View>
              <Text style={styles.libraryQuestArrow}>→</Text>
            </TouchableOpacity>
          ))
        )}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Built-in Templates</Text>
        {BUILT_IN_QUEST_TEMPLATES.map((quest) => (
          <View key={quest.id} style={styles.libraryQuestItem}>
            <View style={styles.libraryQuestInfo}>
              <Text style={styles.libraryQuestLabel}>{quest.label}</Text>
              <Text style={styles.libraryQuestMeta}>
                {quest.defaultDurationMinutes}m • {getQuestStatTotal(quest.stats)} pts
              </Text>
            </View>
            <Text style={styles.libraryQuestBadge}>Built-in</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// History Screen - Past sessions
const PERIODS = {
  day: { label: "Day", days: 1, color: "#38bdf8", fill: "rgba(56,189,248,0.18)" },
  week: { label: "Week", days: 7, color: "#a78bfa", fill: "rgba(167,139,250,0.18)" },
  month: { label: "Month", days: 30, color: "#fbbf24", fill: "rgba(251,191,36,0.18)" },
  all: { label: "All", days: null, color: "#22c55e", fill: "rgba(34,197,94,0.18)" },
};

function HistoryScreen({ sessions }) {
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

// Leaderboard Screen - Rankings (placeholder for now)
function LeaderboardScreen({ avatar, sessions = [] }) {
  const [metric, setMetric] = useState("exp"); // exp | time

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const mockLeaders = useMemo(() => {
    const base = [
      { name: "XxDarkSlayer99xX", level: 42, exp: 52000, minutes: 3200 },
      { name: "StudyMaster", level: 38, exp: 41000, minutes: 2600 },
      { name: "FocusKing", level: 35, exp: 36000, minutes: 2100 },
      { name: "GrindMode", level: 28, exp: 22000, minutes: 1500 },
    ];
    const player = {
      name: avatar.name,
      level: avatar.level,
      exp: avatar.totalExp || 0,
      minutes: totalMinutes,
      isPlayer: true,
    };
    return [...base, player];
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
          <View
            key={player.name}
            style={[
              styles.leaderboardItem,
              player.isPlayer && styles.leaderboardItemPlayer,
            ]}
          >
            <Text style={styles.leaderboardRank}>#{index + 1}</Text>
            <View style={styles.leaderboardInfo}>
              <Text style={styles.leaderboardName}>{player.name}</Text>
              <Text style={styles.leaderboardLevel}>Lv {player.level}</Text>
            </View>
            <Text style={styles.leaderboardExp}>
              {metric === "exp" ? `${player.exp}` : `${Math.round((player.minutes || 0) / 60)}h`}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.leaderboardNote}>
        Leaderboard will sync with friends soon. Metrics toggle now mirrors your quickstart goals.
      </Text>
    </View>
  );
}

// Settings Screen
function SettingsScreen({
  avatar,
  onBack,
  onUpdateAvatar,
  footerConfig,
  onUpdateFooterConfig,
  quickStartMode,
  onUpdateQuickStartMode,
}) {
  const [name, setName] = useState(avatar.name);
  const [localFooterConfig, setLocalFooterConfig] = useState(
    footerConfig || { showCompletedToday: true, showUpcoming: true }
  );

  useEffect(() => {
    setLocalFooterConfig(footerConfig);
  }, [footerConfig]);

  function handleSaveName() {
    if (name.trim()) {
      onUpdateAvatar({ name: name.trim() });
    }
  }

  function toggleFooter(key) {
    const next = { ...localFooterConfig, [key]: !localFooterConfig[key] };
    setLocalFooterConfig(next);
    onUpdateFooterConfig(next);
  }

  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView>
        {/* Profile section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Profile</Text>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Name</Text>
            <TextInput
              style={styles.settingsInput}
              value={name}
              onChangeText={setName}
              onBlur={handleSaveName}
              placeholder="Your name"
              placeholderTextColor="#6b7280"
            />
          </View>
        </View>

        {/* Big Button section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Quick Start Button</Text>
          <Text style={styles.settingsDescription}>
            Choose what the ⚔️ button and home quickstart do.
          </Text>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onUpdateQuickStartMode?.("picker")}
          >
            <Text style={styles.settingsOptionText}>Show quest picker</Text>
            {quickStartMode === "picker" && (
              <Text style={styles.settingsOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onUpdateQuickStartMode?.("instant")}
          >
            <Text style={styles.settingsOptionText}>Instant start: top suggestion</Text>
            {quickStartMode === "instant" && (
              <Text style={styles.settingsOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quotes section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Motivational Quotes</Text>
          <Text style={styles.settingsDescription}>
            Custom quotes coming soon! For now, enjoy the defaults.
          </Text>
        </View>

        {/* Home footer content */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Home Footer Content</Text>
          <Text style={styles.settingsDescription}>
            Choose what appears under the stage on the home screen.
          </Text>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => toggleFooter("showCompletedToday")}
          >
            <Text style={styles.settingsOptionText}>Show completed quests today</Text>
            {localFooterConfig.showCompletedToday && (
              <Text style={styles.settingsOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => toggleFooter("showUpcoming")}
          >
            <Text style={styles.settingsOptionText}>Show important upcoming quests</Text>
            {localFooterConfig.showUpcoming && (
              <Text style={styles.settingsOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* App info */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>About</Text>
          <Text style={styles.settingsAbout}>Better Quest v0.1</Text>
          <Text style={styles.settingsAbout}>Turn your life into an RPG</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function QuestSetupScreen({ userQuests = [], onBack, onStartSession, onCreateQuestDraft, onDeleteQuest, onEditQuest, onOpenQuestAction }) {
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(25);
  const [error, setError] = useState("");
  const [focusStats, setFocusStats] = useState({
    STR: 3,
    DEX: 3,
    STA: 3,
    INT: 3,
    SPI: 3,
    CRE: 3,
    VIT: 3,
  });
  const [selectedQuestId, setSelectedQuestId] = useState(null);
  const [selectedQuestAction, setSelectedQuestAction] = useState(null);
  const autoApplyRef = useRef({ desc: "", questId: null });

  // Combine user quests with built-in templates
  const allQuests = useMemo(() => {
    return [...userQuests, ...BUILT_IN_QUEST_TEMPLATES];
  }, [userQuests]);

  const sortedQuests = useMemo(
    () => rankQuests(allQuests, focusStats, description),
    [allQuests, focusStats, description],
  );

  const hasDirectNameMatch = useMemo(() => {
    const q = description.trim().toLowerCase();
    if (!q) return false;
    return sortedQuests.some((tpl) => {
      const label = (tpl.label ?? "").toLowerCase();
      const desc = (tpl.description ?? "").toLowerCase();
      return label.startsWith(q) || desc.startsWith(q);
    });
  }, [sortedQuests, description]);

  function start() {
    const trimmed = description.trim();
    const minutes = duration;
    if (!trimmed) {
      setError("Please enter what you want to work on.");
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Please enter a valid duration in minutes.");
      return;
    }
    setError("");
    onStartSession({
      description: trimmed,
      durationMinutes: minutes,
      focusStats,
      questAction: selectedQuestAction,
    });
  }

  function handleSubmitFromInput() {
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Please enter what you want to work on.");
      return;
    }
    if (!selectedQuestId && sortedQuests.length > 0) {
      // First enter: pick the top matching quest.
      applyQuestTemplate(sortedQuests[0]);
      return;
    }
    // If a quest is already selected, treat enter as "begin timer".
    start();
  }

  function applyQuestTemplate(template) {
    setDescription(template.label);
    if (template.defaultDurationMinutes) {
      setDuration(template.defaultDurationMinutes);
    }
    setFocusStats(questStatsToChartStats(template.stats));
    setSelectedQuestId(template.id);
    setSelectedQuestAction(template.action || null);
  }

  function handleStatsChange(nextStats, meta) {
    setFocusStats(nextStats);
  }

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmitFromInput();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmitFromInput]);

  useEffect(() => {
    const trimmed = description.trim();
    if (selectedQuestId || !trimmed) return;
    if (!sortedQuests.length) return;
    const top = sortedQuests[0];
    if (!top?.stats) return;

    // Avoid feedback loop: only auto-apply once per description change
    if (autoApplyRef.current.desc === trimmed) return;

    const suggestedStats = questStatsToChartStats(top.stats);
    const statsChanged = STAT_KEYS.some(
      (key) => focusStats[key] !== suggestedStats[key],
    );
    if (statsChanged) {
      setFocusStats(suggestedStats);
    }

    const actionChanged =
      (selectedQuestAction?.type || null) !== (top.action?.type || null) ||
      (selectedQuestAction?.value || null) !== (top.action?.value || null);
    if (actionChanged) {
      setSelectedQuestAction(top.action || null);
    }

    autoApplyRef.current = { desc: trimmed, questId: top.id || null };
  }, [
    sortedQuests,
    selectedQuestId,
    description,
    focusStats,
    selectedQuestAction,
  ]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick your quest</Text>
      <StandStatsChart
        value={focusStats}
        onChange={handleStatsChange}
        duration={duration}
        onDurationChange={setDuration}
      />
      <View style={styles.block}>
        <Text style={styles.label}>Quests</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputGrow]}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              // Clear selection when user types something different
              if (selectedQuestId) {
                const selected = allQuests.find(q => q.id === selectedQuestId);
                if (selected && text.trim().toLowerCase() !== selected.label.toLowerCase()) {
                  setSelectedQuestId(null);
                  setSelectedQuestAction(null);
                }
              }
            }}
            placeholder="e.g. Study math, go for a run, practice guitar"
            autoFocus={Platform.OS === "web"}
            onSubmitEditing={handleSubmitFromInput}
            returnKeyType="done"
          />
        </View>
        <View style={styles.questList}>
          {!hasDirectNameMatch && (
            <TouchableOpacity
              style={styles.questItem}
              onPress={() => onCreateQuestDraft?.(description)}
            >
              <Text style={styles.questItemLabel}>＋ New</Text>
            </TouchableOpacity>
          )}
          {sortedQuests.map((q) => {
            const isUserQuest = userQuests.some(uq => uq.id === q.id);
            return (
              <TouchableOpacity
                key={q.id}
                style={[
                  styles.questItem,
                  selectedQuestId === q.id && styles.questItemActive,
                  isUserQuest && styles.questItemUser,
                ]}
                onPress={() => applyQuestTemplate(q)}
                onLongPress={isUserQuest ? () => {
                  // Long press to delete user quest
                  if (Platform.OS === "web") {
                    if (window.confirm(`Delete "${q.label}"?`)) {
                      onDeleteQuest?.(q.id);
                      if (selectedQuestId === q.id) {
                        setSelectedQuestId(null);
                        setSelectedQuestAction(null);
                      }
                    }
                  } else {
                    // On native, just delete (could add Alert later)
                    onDeleteQuest?.(q.id);
                    if (selectedQuestId === q.id) {
                      setSelectedQuestId(null);
                      setSelectedQuestAction(null);
                    }
                  }
                } : undefined}
              >
                {isUserQuest && <Text style={styles.questItemUserBadge}>★</Text>}
                <Text style={styles.questItemLabel}>{q.label}</Text>
                {q.defaultDurationMinutes ? (
                  <Text style={styles.questItemMeta}>
                    {q.defaultDurationMinutes}m
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {hasDirectNameMatch && (
            <TouchableOpacity
              style={styles.questItem}
              onPress={() => onCreateQuestDraft?.(description)}
            >
              <Text style={styles.questItemLabel}>＋ New</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Action buttons row */}
      {(selectedQuestAction || (selectedQuestId && userQuests.some(q => q.id === selectedQuestId))) && (
        <View style={styles.questActionsRow}>
          {selectedQuestAction && onOpenQuestAction && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onOpenQuestAction(selectedQuestAction)}
            >
              <Text style={styles.actionBtnText}>
                {selectedQuestAction.type === "url" ? "🔗" : selectedQuestAction.type === "file" ? "📁" : "📱"} Open
              </Text>
            </TouchableOpacity>
          )}
          {selectedQuestId && userQuests.some(q => q.id === selectedQuestId) && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                const quest = userQuests.find(q => q.id === selectedQuestId);
                if (quest) onEditQuest?.(quest);
              }}
            >
              <Text style={styles.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.rowBetween}>
        <TouchableOpacity style={styles.ghostBtn} onPress={onBack}>
          <Text style={styles.ghostBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={start}>
          <Text style={styles.primaryBtnText}>Begin timer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SessionScreen({ session, remainingMs, avatar, onCancel }) {
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;

  // Calculate progress: how much of the session is complete
  const totalMs = session.durationMinutes * 60 * 1000;
  const elapsedMs = totalMs - remainingMs;
  const progress = Math.max(0, Math.min(1, elapsedMs / totalMs));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quest in progress</Text>
      <Text style={styles.muted}>{avatar.name} • Lv {avatar.level}</Text>
      
      {/* Live stat growth visualization with countdown in center */}
      <StandStatsChart
        value={session.standStats}
        duration={session.durationMinutes}
        progress={progress}
        readOnly
        size={240}
        countdownText={formatted}
      />
      
      <View style={styles.timerBlock}>
        <Text style={styles.sessionEmoji}>{session.icon ?? "⏳"}</Text>
        <Text style={styles.sessionTitle}>{session.description}</Text>
      </View>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
        <Text style={styles.secondaryBtnText}>Cancel session</Text>
      </TouchableOpacity>
    </View>
  );
}

function CompleteScreen({
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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Session complete</Text>
      <Text style={styles.summary}>
        You focused on “{session.description}” for {session.durationMinutes} minutes.
      </Text>
      {session.bonusMultiplier && session.bonusMultiplier > 1 && (
        <Text style={styles.muted}>
          Bonuses applied (x{session.bonusMultiplier.toFixed(2)} EXP)
          {session.comboBonus ? " • combo" : ""}
          {session.restBonus ? " • well-rested" : ""}
        </Text>
      )}
      <View style={styles.blockRow}>
        <View style={styles.expCol}>
          <Text style={styles.label}>Total EXP</Text>
          <Text style={styles.expValue}>+{expResult.totalExp}</Text>
        </View>
        {expResult.standExp && (
          <View style={styles.expCol}>
            <Text style={styles.label}>Stand gains</Text>
            <Text style={styles.expValue}>
              {Object.entries(expResult.standExp)
                .filter(([, v]) => (v ?? 0) > 0)
                .map(([k, v]) => `${k}+${v}`)
                .join("  ") || "—"}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.block}>
        <View style={styles.avatarHeader}>
          <Text style={styles.label}>Avatar</Text>
          <Text style={styles.muted}>
            Lv {avatar.level} • {levelInfo.current} / {levelInfo.required} EXP
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${levelInfo.ratio * 100}%` },
            ]}
          />
        </View>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>Want to jot down what you did?</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Optional reflection, what you finished, or how it felt."
        />
      </View>
      <View style={styles.rowBetween}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onContinue}>
          <Text style={styles.primaryBtnText}>Continue this quest</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.rowBetween}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBreak}>
          <Text style={styles.secondaryBtnText}>Take a break</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={onEnd}>
          <Text style={styles.ghostBtnText}>End for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const DURATION_PRESETS = [10, 20, 30, 45, 60];

function NewQuestScreen({ initialName = "", editQuest = null, onBack, onSave, onSaveAndStart, onDelete }) {
  const isEditing = !!editQuest;
  
  const [label, setLabel] = useState(editQuest?.label || initialName);
  const [description, setDescription] = useState(editQuest?.description || "");
  const [duration, setDuration] = useState(editQuest?.defaultDurationMinutes || 25);
  const [customDuration, setCustomDuration] = useState("");
  const [stats, setStats] = useState(() => editQuest?.stats || suggestStatsForLabel(initialName));
  const [keywords, setKeywords] = useState(editQuest?.keywords?.join(", ") || "");
  const [action, setAction] = useState(editQuest?.action || null);
  const [error, setError] = useState("");

  // Update stats suggestion when label changes (only for new quests)
  useEffect(() => {
    if (isEditing) return; // Don't auto-suggest for edits
    if (!label.trim()) return;
    const suggested = suggestStatsForLabel(label);
    const total = getQuestStatTotal(suggested);
    if (total > 0) {
      setStats(suggested);
    }
  }, [label, isEditing]);

  function validate() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError("Quest title is required");
      return null;
    }
    
    const finalDuration = customDuration ? parseInt(customDuration, 10) : duration;
    if (!Number.isFinite(finalDuration) || finalDuration <= 0) {
      setError("Please enter a valid duration");
      return null;
    }
    if (finalDuration > 240) {
      setError("Duration cannot exceed 240 minutes");
      return null;
    }
    
    // Validate stats
    const validatedStats = validateQuestStats(stats);
    
    // Parse keywords
    const keywordList = keywords
      .split(/[,\s]+/)
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);
    
    setError("");
    
    return {
      id: editQuest?.id || `quest-${Date.now()}`,
      label: trimmedLabel,
      description: description.trim(),
      defaultDurationMinutes: finalDuration,
      stats: validatedStats,
      keywords: keywordList,
      action: action?.value?.trim() ? action : null,
    };
  }

  function handleSave() {
    const questData = validate();
    if (!questData) return;
    
    try {
      const quest = createQuest(questData);
      onSave?.(quest);
    } catch (e) {
      setError(e.message || "Failed to create quest");
    }
  }

  function handleSaveAndStart() {
    const questData = validate();
    if (!questData) return;
    
    try {
      const quest = createQuest(questData);
      const sessionParams = {
        description: quest.label,
        durationMinutes: quest.defaultDurationMinutes,
        focusStats: questStatsToChartStats(quest.stats),
        questAction: quest.action,
      };
      onSaveAndStart?.(quest, sessionParams);
    } catch (e) {
      setError(e.message || "Failed to create quest");
    }
  }

  const statTotal = getQuestStatTotal(stats);
  const pointsLeft = QUEST_STAT_MAX_TOTAL - statTotal;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{isEditing ? "Edit Quest" : "Create Quest"}</Text>
      <Text style={styles.muted}>
        {isEditing ? "Update your quest template" : "Build a reusable quest template with stats and quick launch"}
      </Text>

      {/* Title */}
      <View style={styles.block}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g., Math study, Morning run"
          placeholderTextColor="#6b7280"
          autoFocus={Platform.OS === "web"}
        />
      </View>

      {/* Description / Why */}
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Description / Why</Text>
          <Text style={styles.optional}>(optional)</Text>
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Why are you doing this? What does it involve?"
          placeholderTextColor="#6b7280"
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Stats allocation with integrated duration ring */}
      <QuestStatsWheel 
        value={stats} 
        onChange={setStats}
        duration={customDuration ? parseInt(customDuration, 10) || duration : duration}
        onDurationChange={(d) => {
          setDuration(d);
          setCustomDuration("");
        }}
      />

      {/* Duration quick-select chips + input */}
      <View style={styles.durationSection}>
        <View style={styles.durationRow}>
          {DURATION_PRESETS.map(d => (
            <TouchableOpacity
              key={d}
              style={[
                styles.durationChip,
                duration === d && !customDuration && styles.durationChipActive,
              ]}
              onPress={() => {
                setDuration(d);
                setCustomDuration("");
              }}
            >
              <Text style={[
                styles.durationChipText,
                duration === d && !customDuration && styles.durationChipTextActive,
              ]}>
                {d}m
              </Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={[styles.input, styles.durationInput]}
            value={customDuration || (DURATION_PRESETS.includes(duration) ? "" : duration.toString())}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, "");
              setCustomDuration(cleaned);
              if (cleaned) {
                const num = parseInt(cleaned, 10);
                if (num > 0 && num <= 240) {
                  setDuration(num);
                }
              }
            }}
            placeholder="min"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            maxLength={3}
          />
        </View>
      </View>
      {statTotal > 0 && (
        <TouchableOpacity 
          style={styles.resetLink}
          onPress={() => {
            const empty = {};
            STAT_KEYS.forEach(k => { empty[k] = 0; });
            setStats(empty);
          }}
        >
          <Text style={styles.resetLinkText}>Reset stats</Text>
        </TouchableOpacity>
      )}

      {/* Tags */}
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Tags</Text>
          <Text style={styles.optional}>(optional, comma or space separated)</Text>
        </View>
        <TextInput
          style={styles.input}
          value={keywords}
          onChangeText={setKeywords}
          placeholder="e.g., study, morning, focus"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
        />
      </View>

      {/* Quick Launch */}
      <QuickLaunchEditor value={action} onChange={setAction} />

      {/* Error */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.ghostBtn} onPress={onBack}>
          <Text style={styles.ghostBtnText}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.actionsRight}>
          {isEditing && onDelete && (
            <TouchableOpacity 
              style={styles.dangerBtn} 
              onPress={() => {
                if (Platform.OS === "web") {
                  if (window.confirm(`Delete "${editQuest.label}"?`)) {
                    onDelete(editQuest.id);
                  }
                } else {
                  onDelete(editQuest.id);
                }
              }}
            >
              <Text style={styles.dangerBtnText}>Delete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSave}>
            <Text style={styles.secondaryBtnText}>Save</Text>
          </TouchableOpacity>
          {!isEditing && (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveAndStart}>
              <Text style={styles.primaryBtnText}>Save & Start</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

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

// Bottom Navbar: Home | Library | [BIG] | History | Leaderboard
function Navbar({ activeTab, onNavigate, onBigButtonPress }) {
  const tabs = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "library", icon: "📚", label: "Library" },
    { id: "history", icon: "📜", label: "History" },
    { id: "leaderboard", icon: "🏆", label: "Ranks" },
  ];

  return (
    <View style={styles.navbar}>
      {/* Left two buttons */}
      <TouchableOpacity
        style={[styles.navItem, activeTab === "home" && styles.navItemActive]}
        onPress={() => onNavigate("home")}
      >
        <Text style={styles.navIcon}>{tabs[0].icon}</Text>
        <Text style={[styles.navLabel, activeTab === "home" && styles.navLabelActive]}>
          {tabs[0].label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === "library" && styles.navItemActive]}
        onPress={() => onNavigate("library")}
      >
        <Text style={styles.navIcon}>{tabs[1].icon}</Text>
        <Text style={[styles.navLabel, activeTab === "library" && styles.navLabelActive]}>
          {tabs[1].label}
        </Text>
      </TouchableOpacity>

      {/* Big center button */}
      <TouchableOpacity style={styles.navBigButton} onPress={onBigButtonPress}>
        <Text style={styles.navBigButtonIcon}>⚔️</Text>
      </TouchableOpacity>

      {/* Right two buttons */}
      <TouchableOpacity
        style={[styles.navItem, activeTab === "history" && styles.navItemActive]}
        onPress={() => onNavigate("history")}
      >
        <Text style={styles.navIcon}>{tabs[2].icon}</Text>
        <Text style={[styles.navLabel, activeTab === "history" && styles.navLabelActive]}>
          {tabs[2].label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === "leaderboard" && styles.navItemActive]}
        onPress={() => onNavigate("leaderboard")}
      >
        <Text style={styles.navIcon}>{tabs[3].icon}</Text>
        <Text style={[styles.navLabel, activeTab === "leaderboard" && styles.navLabelActive]}>
          {tabs[3].label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#020617",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f9fafb",
    marginBottom: 8,
  },
  avatarCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    marginBottom: 12,
  },
  avatarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  avatarName: {
    color: "#e5e7eb",
    fontWeight: "600",
  },
  avatarLevel: {
    color: "#e5e7eb",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 4,
  },
  progressBar: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1f2937",
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#22c55e",
  },
  block: {
    marginTop: 12,
  },
  blockRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
  },
  expCol: {
    width: "48%",
    marginBottom: 8,
  },
  label: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  muted: {
    color: "#9ca3af",
    fontSize: 13,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: "#4f46e5",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#f9fafb",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: "#0f172a",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4f46e5",
  },
  secondaryBtnText: {
    color: "#e5e7eb",
    fontWeight: "500",
  },
  dangerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#7f1d1d",
  },
  dangerBtnText: {
    color: "#fecaca",
    fontWeight: "500",
  },
  ghostBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  ghostBtnText: {
    color: "#9ca3af",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    color: "#e5e7eb",
    fontSize: 18,
    marginTop: -2,
  },
  textArea: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 8,
    color: "#e5e7eb",
    minHeight: 80,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 8,
    color: "#e5e7eb",
    marginTop: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  inputGrow: {
    flex: 1,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#111827",
  },
  chipHighlighted: {
    borderColor: "#f59e0b",
    backgroundColor: "#78350f",
  },
  chipText: {
    color: "#e5e7eb",
    fontSize: 13,
  },
  error: {
    color: "#f97316",
    marginTop: 4,
  },
  timerBlock: {
    alignItems: "center",
    marginVertical: 32,
  },
  sessionEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#f9fafb",
    letterSpacing: 4,
  },
  sessionTitle: {
    marginTop: 8,
    fontSize: 18,
    color: "#e5e7eb",
    textAlign: "center",
  },
  summary: {
    marginTop: 8,
    color: "#e5e7eb",
  },
  sectionTitle: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "600",
  },
  historyItem: {
    marginTop: 6,
  },
  historyPrimary: {
    color: "#e5e7eb",
  },
  historyNotes: {
    color: "#9ca3af",
    fontStyle: "italic",
    fontSize: 12,
  },
  expValue: {
    color: "#fbbf24",
    fontWeight: "600",
    marginTop: 2,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
  },
  logControls: {
    alignItems: "flex-end",
    gap: 4,
  },
  copiedToast: {
    marginTop: 4,
    color: "#22c55e",
    fontSize: 12,
  },
  questList: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  questItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2937",
    marginRight: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  questItemActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#0f172a",
  },
  questItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  questItemLabel: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "500",
  },
  questItemMeta: {
    color: "#9ca3af",
    fontSize: 11,
    marginLeft: 4,
  },
  questItemUser: {
    borderColor: "#4f46e5",
    borderWidth: 1,
  },
  questItemUserBadge: {
    color: "#a78bfa",
    fontSize: 10,
    marginRight: 4,
  },
  questActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#1e3a5f",
  },
  actionBtnText: {
    color: "#93c5fd",
    fontSize: 13,
  },
  editBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#374151",
  },
  editBtnText: {
    color: "#e5e7eb",
    fontSize: 13,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  optional: {
    color: "#6b7280",
    fontSize: 11,
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  durationChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  durationChipActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#1e1b4b",
  },
  durationChipText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
  durationChipTextActive: {
    color: "#e5e7eb",
  },
  durationInput: {
    width: 70,
    textAlign: "center",
    marginTop: 0,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    paddingBottom: 20,
  },
  actionsRight: {
    flexDirection: "row",
    gap: 10,
  },
  resetLink: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetLinkText: {
    color: "#6b7280",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  durationSection: {
    marginTop: 4,
    alignItems: "center",
  },
  // New HomeScreen styles
  homeContainer: {
    flex: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 16,
  },
  announcements: {
    marginTop: 8,
    gap: 8,
  },
  announcementCard: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  announcementTitle: {
    color: "#fbbf24",
    fontWeight: "700",
    fontSize: 14,
  },
  announcementBody: {
    color: "#e5e7eb",
    marginTop: 2,
    fontSize: 12,
  },
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  headerUsername: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  headerLevel: {
    color: "#fbbf24",
    fontSize: 16,
    fontWeight: "700",
  },
  headerTitle: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    justifyContent: "flex-end",
  },
  headerIconBtn: {
    padding: 8,
  },
  headerIcon: {
    fontSize: 20,
  },
  // Stage layout: chart background, roaming avatar foreground
  stage: {
    position: "relative",
    width: "100%",
    marginVertical: 8,
    overflow: "hidden",
    minHeight: 220,
  },
  chartBackground: {
    position: "absolute",
    top: 0,
    right: 0,
    opacity: 0.9,
    padding: 4,
    alignItems: "flex-end",
    pointerEvents: "none",
  },
  roamingAvatar: {
    position: "absolute",
    zIndex: 10,
  },
  quoteBubble: {
    position: "absolute",
    backgroundColor: "#1e1b4b",
    borderRadius: 12,
    padding: 10,
    maxWidth: 180,
    zIndex: 5,
    borderWidth: 2,
    borderColor: "#4f46e5",
  },
  quoteBubbleText: {
    color: "#e5e7eb",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 16,
  },
    quoteBubbleTail: {
      position: "absolute",
      bottom: -8,
    left: 18,
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: "#4f46e5",
      transform: [{ rotate: "-20deg" }],
    },
  expProgressSection: {
    marginBottom: 16,
  },
  expText: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
  quickstartCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 8,
    gap: 8,
  },
  quickstartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickstartMode: {
    color: "#6b7280",
    fontSize: 12,
  },
  quickstartBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  quickstartBtnText: {
    color: "#f9fafb",
    fontWeight: "600",
    fontSize: 15,
  },
  quickstartSuggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickstartChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  quickstartChipLabel: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
  },
  quickstartChipMeta: {
    color: "#9ca3af",
    fontSize: 12,
  },
  quoteSection: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#4f46e5",
  },
  quoteText: {
    color: "#e5e7eb",
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 22,
  },
  homeFooter: {
    gap: 12,
    marginTop: 8,
  },
  homeFooterSection: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 8,
  },
  homeFooterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerMeta: {
    color: "#9ca3af",
    fontSize: 12,
  },
  footerEmpty: {
    color: "#6b7280",
    fontSize: 12,
  },
  footerItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  footerItemTitle: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  footerItemMeta: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  // Navbar styles
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#0f172a",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: "#1e1b4b",
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "500",
  },
  navLabelActive: {
    color: "#a5b4fc",
  },
  navBigButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: "#0f172a",
  },
  navBigButtonIcon: {
    fontSize: 28,
  },
  // Generic screen styles
  screenContainer: {
    flex: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 16,
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  screenTitle: {
    color: "#f9fafb",
    fontSize: 20,
    fontWeight: "700",
  },
  backBtn: {
    color: "#a5b4fc",
    fontSize: 16,
  },
  addBtn: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#f9fafb",
    fontWeight: "600",
  },
  sectionLabel: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  // Library screen styles
  questLibraryList: {
    flex: 1,
  },
  libraryQuestItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  libraryQuestInfo: {
    flex: 1,
  },
  libraryQuestLabel: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  libraryQuestMeta: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  libraryQuestArrow: {
    color: "#4f46e5",
    fontSize: 18,
  },
  libraryQuestBadge: {
    color: "#6b7280",
    fontSize: 11,
    backgroundColor: "#1f2937",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  // History screen styles
  historyStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  historyStat: {
    alignItems: "center",
  },
  historyStatValue: {
    color: "#fbbf24",
    fontSize: 24,
    fontWeight: "700",
  },
  historyStatLabel: {
    color: "#9ca3af",
    fontSize: 11,
    textTransform: "uppercase",
    marginTop: 2,
  },
  exportControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  exportBtn: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportBtnText: {
    color: "#e5e7eb",
    fontSize: 12,
  },
  historyList: {
    flex: 1,
  },
  historyEchoList: {
    marginTop: 12,
    marginBottom: 4,
    gap: 4,
  },
  historyEchoItem: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.8,
  },
  historyDateHeader: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  historySessionItem: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  historySessionTitle: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "500",
  },
  historySessionMeta: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  historySessionNotes: {
    color: "#6b7280",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  // Leaderboard screen styles
  playerRankCard: {
    backgroundColor: "#1e1b4b",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginVertical: 16,
    borderWidth: 2,
    borderColor: "#4f46e5",
  },
  playerRankLabel: {
    color: "#a5b4fc",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  playerRankValue: {
    color: "#fbbf24",
    fontSize: 48,
    fontWeight: "700",
  },
  playerRankExp: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  leaderboardList: {
    marginTop: 8,
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  leaderboardItemPlayer: {
    backgroundColor: "#1e1b4b",
    borderWidth: 1,
    borderColor: "#4f46e5",
  },
  leaderboardRank: {
    color: "#fbbf24",
    fontSize: 16,
    fontWeight: "700",
    width: 40,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "500",
  },
  leaderboardLevel: {
    color: "#9ca3af",
    fontSize: 12,
  },
  leaderboardExp: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "600",
  },
  leaderboardNote: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
    fontStyle: "italic",
  },
  // Settings screen styles
  settingsSection: {
    marginTop: 24,
  },
  settingsSectionTitle: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsLabel: {
    color: "#9ca3af",
    fontSize: 14,
    width: 60,
  },
  settingsInput: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 10,
    color: "#f9fafb",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  settingsDescription: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 12,
  },
  settingsOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  settingsOptionText: {
    color: "#e5e7eb",
    fontSize: 14,
  },
  settingsOptionDisabled: {
    color: "#6b7280",
  },
  settingsOptionCheck: {
    color: "#22c55e",
    fontSize: 16,
  },
  settingsAbout: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 4,
  },
});

function applySessionBonuses(session, baseExp) {
  const mult = session.bonusMultiplier ?? 1;
  if (mult === 1) return baseExp;
  const totalExp = Math.round(baseExp.totalExp * mult);
  const standExp = {};
  if (baseExp.standExp) {
    Object.entries(baseExp.standExp).forEach(([key, value]) => {
      const v = typeof value === "number" ? value : 0;
      standExp[key] = Math.round(v * mult);
    });
  }
  return {
    totalExp,
    standExp,
  };
}

function buildLogText(style, sessions) {
  switch (style) {
    case "twitter":
      return generateTwitterLog(sessions);
    case "linkedin":
      return generateLinkedInLog(sessions);
    case "raw":
    default:
      return generateRawLog(sessions);
  }
}

// --- Quest ranking helpers ---

function normalizePrefs(focusStats) {
  const prefs = {};
  STAT_KEYS.forEach((key) => {
    const raw = focusStats?.[key] ?? 1;
    const clamped = Math.max(1, Math.min(5, raw));
    prefs[key] = (clamped - 1) / 4; // map 1–5 to 0–1
  });
  return prefs;
}

function scoreQuest(template, prefs) {
  let score = 0;
  const stats = template.stats || {};
  STAT_KEYS.forEach((key) => {
    const level = stats[key] ?? 0; // 0–3
    const levelNorm = Math.max(0, Math.min(3, level)) / 3; // 0–1
    score += prefs[key] * levelNorm;
  });
  return score;
}

function computeTextScore(template, query) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return 0;

  const parts = [
    template.label,
    template.description,
    ...(template.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!parts) return 0;
  if (parts.startsWith(q)) return 3;
  if (parts.includes(` ${q}`)) return 2;
  if (parts.includes(q)) return 1;
  return 0;
}

function rankQuests(templates, focusStats, query) {
  const prefs = normalizePrefs(focusStats);
  return templates
    .map((t) => ({
      ...t,
      score: scoreQuest(t, prefs) + computeTextScore(t, query) * 0.5,
    }))
    .sort((a, b) => b.score - a.score);
}

// Pick quickstart suggestions based on player stats and available quests
function computeQuickstartSuggestions(userQuests, avatar) {
  const focusStats = playerStatsToChartValues(avatar?.standExp || {});
  const templates = [...(userQuests || []), ...BUILT_IN_QUEST_TEMPLATES];
  const ranked = rankQuests(templates, focusStats, "");
  return ranked.slice(0, 3);
}

// Compute a simple daily streak from session completions (consecutive days ending today)
function computeStreakDays(sessions = []) {
  if (!sessions.length) return 0;
  const dates = Array.from(
    new Set(
      sessions
        .map((s) => new Date(s.completedAt || s.endTime || s.startTime))
        .filter((d) => !Number.isNaN(d.getTime()))
        .map((d) => d.toDateString()),
    ),
  )
    .map((d) => new Date(d))
    .sort((a, b) => b - a);

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const d of dates) {
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === cursor.getTime()) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (d.getTime() === cursor.getTime() - 86400000) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

// Sum stand EXP gains across a list of sessions
function aggregateStandGains(sessions = []) {
  const totals = {};
  STAT_KEYS.forEach((k) => {
    totals[k] = 0;
  });
  sessions.forEach((s) => {
    const gains = s.expResult?.standExp || {};
    STAT_KEYS.forEach((k) => {
      const inc = gains[k] ?? 0;
      totals[k] += typeof inc === "number" ? inc : 0;
    });
  });
  return totals;
}

