import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  createDefaultAvatar,
  createTaskSession,
  createUser,
  STAT_KEYS,
} from "./core/models";
import {
  calculateExpForSession,
  applyExpToAvatar,
  getLevelProgress,
} from "./core/exp";
import {
  computeDailyBudgets,
} from "./core/fatigue";
import { inferEmojiForDescription } from "./core/emoji";
import {
  loadUserQuests,
  addUserQuest,
  deleteUserQuest,
  questStatsToChartStats,
} from "./core/questStorage";
import {
  playerStatsToChartValues,
  computeTodayStandExp,
  addStandExp,
} from "./core/stats";
import {
  computeQuickstartSuggestions,
  updateQuestStreaks,
  getMaxMandalaStreak,
  computeAggregateConsistency,
} from "./core/quests";
import { applySessionBonuses, applyFatigueDamping } from "./core/sessions";
import { AppStateProvider, useAppState, useAppActions } from "./state/store";
import { loadAppState, saveAppState, getDefaultState } from "./services/storage";
import { useNavigation, Screens } from "./navigation/navigator";

// Screen imports
import HomeScreen from "./screens/HomeScreen";
import LibraryScreen from "./screens/LibraryScreen";
import HistoryScreen from "./screens/HistoryScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import SettingsScreen from "./screens/SettingsScreen";
import QuestSetupScreen from "./screens/QuestSetupScreen";
import NewQuestScreen from "./screens/NewQuestScreen";
import SessionScreen from "./screens/SessionScreen";
import CompleteScreen from "./screens/CompleteScreen";

// Component imports
import { Navbar } from "./components/Navbar";
import Toast from "./components/Toast";
import styles from "../style";

const COMBO_BONUS_MULTIPLIER = 1.2;
const REST_BONUS_MULTIPLIER = 1.1;
const REST_BONUS_WINDOW_MINUTES = 45;

export default function App() {
  return (
    <AppStateProvider initialState={getDefaultState()}>
      <AppShell />
    </AppStateProvider>
  );
}

function AppShell() {
  const {
    user,
    sessions,
    motivation,
    questStreaks,
    comboFromSessionId,
    wellRestedUntil,
    homeFooterConfig,
    quickStartMode,
    pickerDefaultMode,
    postSaveBehavior,
  } = useAppState();
  const {
    setUser,
    setSessions,
    setMotivation,
    setQuestStreaks,
    setComboFromSessionId,
    setWellRestedUntil,
    setHomeFooterConfig,
    setQuickStartMode,
    setPickerDefaultMode,
    setPostSaveBehavior,
  } = useAppActions();
  const [userQuests, setUserQuests] = useState([]);

  const { state: navState, navigate, setActiveTab } = useNavigation(Screens.HOME);
  const screen = navState.screen;
  const activeTab = navState.activeTab;

  const [currentSession, setCurrentSession] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [notes, setNotes] = useState("");
  const [lastExpResult, setLastExpResult] = useState(null);
  const [draftQuestName, setDraftQuestName] = useState("");
  const [editingQuest, setEditingQuest] = useState(null);
  const [pendingQuestAction, setPendingQuestAction] = useState(null);
  const [pendingQuestSelection, setPendingQuestSelection] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const toastTimerRef = useRef(null);
  const announcements = useMemo(
    () => [
      {
        id: "version-0-1",
        title: "Version 0.1 live now",
        body: "New quickstart options and refreshed insights.",
      },
      {
        id: "history-graph",
        title: "Graph history added 12/6!",
        body: "View multi-period stat gains in Insights.",
      },
    ],
    []
  );

  // Hydrate on mount
  useEffect(() => {
    (async () => {
      try {
        const { state: persisted } = await loadAppState();
        const hydratedUser =
          persisted.user ??
          (persisted.avatar
            ? { ...createUser(), avatar: persisted.avatar }
            : createUser());
        setUser(hydratedUser);
        if (Array.isArray(persisted.sessions)) {
          setSessions(persisted.sessions);
        }
        if (typeof persisted.motivation === "string") {
          setMotivation(persisted.motivation);
        }
        if (persisted.questStreaks && typeof persisted.questStreaks === "object") {
          setQuestStreaks(persisted.questStreaks);
        }
        if (persisted.comboFromSessionId) {
          setComboFromSessionId(persisted.comboFromSessionId);
        }
        if (persisted.wellRestedUntil) {
          setWellRestedUntil(persisted.wellRestedUntil);
        }
        if (persisted.homeFooterConfig) {
          setHomeFooterConfig({
            showCompletedToday: persisted.homeFooterConfig.showCompletedToday ?? true,
            showUpcoming: persisted.homeFooterConfig.showUpcoming ?? true,
          });
        }
        if (
          persisted.quickStartMode === "instant" ||
          persisted.quickStartMode === "picker"
        ) {
          setQuickStartMode(persisted.quickStartMode);
        }
        if (
          persisted.pickerDefaultMode === "top" ||
          persisted.pickerDefaultMode === "blank"
        ) {
          setPickerDefaultMode(persisted.pickerDefaultMode);
        }
        if (
          persisted.postSaveBehavior === "library" ||
          persisted.postSaveBehavior === "picker"
        ) {
          setPostSaveBehavior(persisted.postSaveBehavior);
        }

        // Load user quests
        const quests = await loadUserQuests();
        setUserQuests(quests);
      } catch (err) {
        console.warn("Failed to hydrate state", err);
        setUser(createUser());
      }
    })();
  }, [
    setUser,
    setSessions,
    setMotivation,
    setQuestStreaks,
    setComboFromSessionId,
    setWellRestedUntil,
    setHomeFooterConfig,
    setQuickStartMode,
    setPickerDefaultMode,
    setPostSaveBehavior,
  ]);

  // Persist on change
  useEffect(() => {
    const save = async () => {
      await saveAppState({
        user,
        avatar: user?.avatar,
        sessions,
        motivation,
        questStreaks,
        comboFromSessionId,
        wellRestedUntil,
        homeFooterConfig,
        quickStartMode,
        pickerDefaultMode,
        postSaveBehavior,
      });
    };
    save();
  }, [
    user,
    sessions,
    motivation,
    questStreaks,
    comboFromSessionId,
    wellRestedUntil,
    homeFooterConfig,
    quickStartMode,
    pickerDefaultMode,
    postSaveBehavior,
  ]);

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

  const avatar = user?.avatar ?? createDefaultAvatar();
  const levelInfo = useMemo(
    () => getLevelProgress(avatar.totalExp ?? 0),
    [avatar.totalExp]
  );

  const quickstartSuggestions = useMemo(
    () => computeQuickstartSuggestions(userQuests, avatar),
    [userQuests, avatar]
  );

  const todayStandExp = useMemo(() => computeTodayStandExp(sessions), [sessions]);
  const mandalaStreak = useMemo(() => getMaxMandalaStreak(questStreaks), [questStreaks]);
  const aggregateConsistency = useMemo(
    () => computeAggregateConsistency(sessions),
    [sessions]
  );
  const dailyBudgets = useMemo(() => {
    const chartStats = playerStatsToChartValues(avatar.standExp);
    return computeDailyBudgets({
      chartStats,
      level: avatar.level ?? 1,
      mandalaStreak,
      aggregateConsistency,
    });
  }, [avatar, mandalaStreak, aggregateConsistency]);
  const fatigueOverlayStats = useMemo(() => {
    const remaining = {};
    STAT_KEYS.forEach((k) => {
      const budget = dailyBudgets[k] ?? 0;
      const spent = todayStandExp[k] ?? 0;
      remaining[k] = Math.max(0, budget - spent);
    });
    const previewStand = addStandExp(avatar.standExp, remaining);
    return playerStatsToChartValues(previewStand);
  }, [dailyBudgets, todayStandExp, avatar]);

  function handleStartQuest() {
    navigate(Screens.QUEST);
  }

  function startQuestFromTemplate(template) {
    if (!template) {
      navigate(Screens.QUEST);
      return;
    }

    const sessionParams = {
      description: template.label || "Quest",
      durationMinutes: template.defaultDurationMinutes || 25,
      focusStats: questStatsToChartStats(template.stats || {}),
      questKey: template.id || template.label || null,
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
    questKey = null,
  }) {
    const id = `session-${Date.now()}`;
    const endTimeMs = Date.now() + durationMinutes * 60 * 1000;
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

    const resolvedQuestKey = questKey || (description ? description.trim() : null);

    const session = createTaskSession({
      id,
      description,
      durationMinutes,
      startTime: new Date().toISOString(),
      standStats: focusStats,
      questKey: resolvedQuestKey,
      comboBonus: hasCombo,
      restBonus: hasRest,
      bonusMultiplier,
      endTimeMs,
    });
    session.icon = inferEmojiForDescription(description);
    setCurrentSession(session);
    setRemainingMs(endTimeMs - Date.now());
    if (hasCombo) setComboFromSessionId(null);
    if (hasRest) setWellRestedUntil(null);
    navigate(Screens.SESSION);
  }

  function handleTimerComplete(endTimeMs) {
    if (!currentSession) return;
    const completedSession = {
      ...currentSession,
      endTime: new Date(endTimeMs).toISOString(),
    };
    const baseExp = calculateExpForSession(completedSession);
    const expWithBonuses = applySessionBonuses(completedSession, baseExp);
    const exp = applyFatigueDamping({
      baseExp: expWithBonuses,
      avatar,
      sessions,
      questStreaks,
    });
    setLastExpResult(exp);
    const nextAvatar = applyExpToAvatar(avatar, exp);
    setUser((prev) => ({ ...prev, avatar: nextAvatar }));

    const updatedQuestStreaks = updateQuestStreaks(
      questStreaks,
      completedSession.questKey,
      completedSession.endTime
    );
    setQuestStreaks(updatedQuestStreaks);

    setSessions((prev) => [
      {
        id: completedSession.id,
        description: completedSession.description,
        durationMinutes: completedSession.durationMinutes,
        completedAt: completedSession.endTime,
        standStats: completedSession.standStats ?? null,
        questKey: completedSession.questKey ?? null,
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
    navigate(Screens.COMPLETE);
  }

  const handleCancelSession = useCallback(() => {
    setCurrentSession(null);
    navigate(Screens.HOME);
  }, [navigate]);

  function handleContinueQuest() {
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
    navigate(Screens.QUEST);
  }

  function handleTakeBreak() {
    if (sessions[0] && notes.trim()) {
      setSessions((prev) => {
        const copy = [...prev];
        copy[0] = { ...copy[0], notes: notes.trim() };
        return copy;
      });
    }
    const windowMs = REST_BONUS_WINDOW_MINUTES * 60 * 1000;
    setWellRestedUntil(new Date(Date.now() + windowMs).toISOString());
    setCurrentSession(null);
    navigate(Screens.HOME);
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
    navigate(Screens.HOME);
  }

  // Helper to open quest action (URL or app)
  async function openQuestAction(action) {
    if (!action || !action.value) return;

    try {
      let url = action.value.trim();

      if (action.type === "url") {
        if (!/^https?:\/\//i.test(url)) {
          url = "https://" + url;
        }
      } else if (action.type === "file") {
        if (!url.startsWith("file://")) {
          if (/^[a-zA-Z]:/.test(url)) {
            url = "file:///" + url.replace(/\\/g, "/");
          } else if (!url.startsWith("/")) {
            url = "file:///" + url;
          } else {
            url = "file://" + url;
          }
        }
      }

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
    if (pendingQuestAction && screen === Screens.SESSION) {
      openQuestAction(pendingQuestAction);
      setPendingQuestAction(null);
    }
  }, [pendingQuestAction, screen]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e) => {
      if (e.key === "Escape" && screen === Screens.SESSION && currentSession) {
        e.preventDefault();
        handleCancelSession();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, currentSession, handleCancelSession]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Navigation helpers
  function handleNavigation(tab) {
    setActiveTab(tab);
    navigate(tab);
  }

  function handleQuickstartPress() {
    if (quickStartMode === "instant" && quickstartSuggestions.length > 0) {
      startQuestFromTemplate(quickstartSuggestions[0]);
      return;
    }
    navigate(Screens.QUEST);
  }

  function handleQuickstartSelect(template) {
    startQuestFromTemplate(template);
  }

  function showToast(message) {
    if (!message) return;
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 2000);
  }

  function handleOpenSettings() {
    navigate(Screens.SETTINGS);
  }

  function handleOpenNotifications() {
    console.log("Notifications pressed");
  }

  // Determine if navbar should show
  const showNavbar = [
    Screens.HOME,
    Screens.LIBRARY,
    Screens.HISTORY,
    Screens.LEADERBOARD,
  ].includes(screen);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        {screen === Screens.HOME && (
          <HomeScreen
            avatar={avatar}
            levelInfo={levelInfo}
            fatigueOverlayStats={fatigueOverlayStats}
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
        {screen === Screens.LIBRARY && (
          <LibraryScreen
            userQuests={userQuests}
            onSelectQuest={(quest) => {
              setEditingQuest(quest);
              setDraftQuestName("");
              navigate(Screens.NEW_QUEST);
            }}
            onCreateQuest={() => {
              setDraftQuestName("");
              setEditingQuest(null);
              navigate(Screens.NEW_QUEST);
            }}
          />
        )}
        {screen === Screens.HISTORY && <HistoryScreen sessions={sessions} />}
        {screen === Screens.LEADERBOARD && (
          <LeaderboardScreen avatar={avatar} sessions={sessions} />
        )}
        {screen === Screens.SETTINGS && (
          <SettingsScreen
            avatar={avatar}
            onBack={() => {
              navigate(activeTab);
            }}
            onUpdateAvatar={(updates) => {
              setUser((prev) => ({
                ...prev,
                avatar: { ...prev.avatar, ...updates },
              }));
              showToast("Saved");
            }}
            footerConfig={homeFooterConfig}
            onUpdateFooterConfig={(next) => {
              setHomeFooterConfig(next);
              showToast("Saved");
            }}
            quickStartMode={quickStartMode}
            pickerDefaultMode={pickerDefaultMode}
            postSaveBehavior={postSaveBehavior}
            onUpdateQuickStartMode={(mode) => {
              if (mode === "picker" || mode === "instant") {
                setQuickStartMode(mode);
              }
              showToast("Saved");
            }}
            onUpdatePickerDefaultMode={(mode) => {
              if (mode === "top" || mode === "blank") {
                setPickerDefaultMode(mode);
              }
              showToast("Saved");
            }}
            onUpdatePostSaveBehavior={(mode) => {
              if (mode === "library" || mode === "picker") {
                setPostSaveBehavior(mode);
              }
              showToast("Saved");
            }}
            showToast={showToast}
          />
        )}
        {screen === Screens.QUEST && (
          <QuestSetupScreen
            userQuests={userQuests}
            pickerDefaultMode={pickerDefaultMode}
            autoSelectQuest={pendingQuestSelection}
            onAutoSelectConsumed={() => setPendingQuestSelection(null)}
            onBack={() => navigate(Screens.HOME)}
            onStartSession={(params) => {
              if (params.questAction) {
                setPendingQuestAction(params.questAction);
              }
              handleStartSession({
                ...params,
                questKey: params.questKey || params.questId || params.description || null,
              });
            }}
            onCreateQuestDraft={(name) => {
              const trimmed = (name ?? "").trim();
              if (!trimmed) return;
              setDraftQuestName(trimmed);
              navigate(Screens.NEW_QUEST);
            }}
            onDeleteQuest={async (questId) => {
              const updated = await deleteUserQuest(questId);
              setUserQuests(updated);
            }}
            onEditQuest={(quest) => {
              setEditingQuest(quest);
              setDraftQuestName("");
              navigate(Screens.NEW_QUEST);
            }}
            onOpenQuestAction={openQuestAction}
          />
        )}
        {screen === Screens.NEW_QUEST && (
          <NewQuestScreen
            initialName={draftQuestName}
            editQuest={editingQuest}
            onBack={() => {
              setEditingQuest(null);
              navigate(Screens.QUEST);
            }}
            onSave={async (quest) => {
              const updated = await addUserQuest(quest);
              setUserQuests(updated);
              setEditingQuest(null);
              if (postSaveBehavior === "picker") {
                setPendingQuestSelection(quest);
                navigate(Screens.QUEST);
              } else {
                navigate(Screens.LIBRARY);
              }
              showToast("Quest saved");
            }}
            onSaveAndStart={async (quest, sessionParams) => {
              const updated = await addUserQuest(quest);
              setUserQuests(updated);
              setEditingQuest(null);
              if (quest.action) {
                openQuestAction(quest.action);
              }
              handleStartSession({
                ...sessionParams,
                questKey: quest.id || sessionParams.questKey || quest.label || null,
              });
            }}
            onDelete={async (questId) => {
              const updated = await deleteUserQuest(questId);
              setUserQuests(updated);
              setEditingQuest(null);
              navigate(Screens.QUEST);
              showToast("Quest deleted");
            }}
          />
        )}
        {screen === Screens.SESSION && currentSession && (
          <SessionScreen
            session={currentSession}
            remainingMs={remainingMs}
            avatar={avatar}
            onCancel={handleCancelSession}
          />
        )}
        {screen === Screens.COMPLETE && currentSession && lastExpResult && (
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
        <Toast message={toastMessage} />
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
