import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Platform } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { createDefaultAvatar, createTaskSession, STAT_KEYS } from "../core/models.js";
import { calculateExpForSession, applyExpToAvatar, getLevelProgress } from "../core/exp.js";
import { computeDailyBudgets } from "../core/fatigue.js";
import { inferEmojiForDescription } from "../core/emoji.js";
import { addUserQuest, deleteUserQuest, questStatsToChartStats } from "../core/questStorage.js";
import { playerStatsToChartValues, computeTodayStandExp, addStandExp } from "../core/stats.js";
import {
  computeQuickstartSuggestions,
  updateQuestStreaks,
  getMaxMandalaStreak,
  computeAggregateConsistency,
} from "../core/quests.js";
import { applySessionBonuses, applyFatigueDamping } from "../core/sessions.js";
import { getAllQuotes, getQuoteOfTheDay, addUserQuote, deleteUserQuote as deleteQuote } from "../core/quotes.js";

import { useAppState, useAppActions } from "../state/store.js";
import { useNavigation, Screens } from "../navigation/navigator.js";

import { useHydrateAppState } from "./hooks/useHydrateAppState.js";
import { usePersistAppState } from "./hooks/usePersistAppState.js";
import { useSessionTimer } from "./hooks/useSessionTimer.js";
import { useToast } from "./hooks/useToast.js";
import { useOpenQuestAction } from "./hooks/useOpenQuestAction.js";

// Screen imports
import HomeScreen from "../screens/HomeScreen.js";
import LibraryScreen from "../screens/LibraryScreen.js";
import HistoryScreen from "../screens/HistoryScreen.js";
import LeaderboardScreen from "../screens/LeaderboardScreen.js";
import ProfileScreen from "../screens/ProfileScreen.js";
import SettingsScreen from "../screens/SettingsScreen.js";
import QuestSetupScreen from "../screens/QuestSetupScreen.js";
import NewQuestScreen from "../screens/NewQuestScreen.js";
import SessionScreen from "../screens/SessionScreen.js";
import CompleteScreen from "../screens/CompleteScreen.js";

// Component imports
import { Navbar } from "../components/Navbar.js";
import Toast from "../components/Toast.js";
import styles from "../../style.js";

const COMBO_BONUS_MULTIPLIER = 1.2;
const REST_BONUS_MULTIPLIER = 1.1;
const REST_BONUS_WINDOW_MINUTES = 45;

export default function AppShell() {
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
    userQuotes,
    includeBuiltInQuotes,
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
    setUserQuotes,
    setIncludeBuiltInQuotes,
  } = useAppActions();

  const { state: navState, navigate, setActiveTab } = useNavigation(Screens.HOME);
  const screen = navState.screen;
  const activeTab = navState.activeTab;

  const [currentSession, setCurrentSession] = useState(null);
  const [notes, setNotes] = useState("");
  const [lastExpResult, setLastExpResult] = useState(null);
  const [draftQuestName, setDraftQuestName] = useState("");
  const [editingQuest, setEditingQuest] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [pendingQuestAction, setPendingQuestAction] = useState(null);
  const [pendingQuestSelection, setPendingQuestSelection] = useState(null);
  const { toastMessage, showToast } = useToast({ durationMs: 2000 });

  const hydrateActions = useMemo(
    () => ({
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
      setUserQuotes,
      setIncludeBuiltInQuotes,
    }),
    [
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
      setUserQuotes,
      setIncludeBuiltInQuotes,
    ],
  );

  const { userQuests, setUserQuests } = useHydrateAppState(hydrateActions);

  usePersistAppState({
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
    userQuotes,
    includeBuiltInQuotes,
  });

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
    [],
  );

  const { remainingMs, setRemainingMs } = useSessionTimer({
    currentSession,
    screen,
    onComplete: handleTimerComplete,
  });

  const avatar = user?.avatar ?? createDefaultAvatar();
  const levelInfo = useMemo(() => getLevelProgress(avatar.totalExp ?? 0), [avatar.totalExp]);

  const quickstartSuggestions = useMemo(
    () => computeQuickstartSuggestions(userQuests, avatar),
    [userQuests, avatar],
  );

  const todayStandExp = useMemo(() => computeTodayStandExp(sessions), [sessions]);
  const mandalaStreak = useMemo(() => getMaxMandalaStreak(questStreaks), [questStreaks]);
  const aggregateConsistency = useMemo(
    () => computeAggregateConsistency(sessions),
    [sessions],
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

  // Quotes
  const allQuotes = useMemo(
    () => getAllQuotes(userQuotes ?? [], includeBuiltInQuotes ?? true),
    [userQuotes, includeBuiltInQuotes],
  );
  const currentQuote = useMemo(() => getQuoteOfTheDay(allQuotes), [allQuotes]);

  async function handleAddQuote(text) {
    const updated = await addUserQuote(text);
    setUserQuotes(updated);
  }

  async function handleDeleteQuote(quoteId) {
    const updated = await deleteQuote(quoteId);
    setUserQuotes(updated);
  }

  function handleToggleBuiltInQuotes(enabled) {
    setIncludeBuiltInQuotes(enabled);
  }

  function handleStartQuest() {
    navigate(Screens.QUEST);
  }

  function startQuestFromTemplate(template) {
    if (!template) {
      navigate(Screens.QUEST);
      return;
    }

    // Extract raw allocation (0-3 scale)
    const allocation = {};
    STAT_KEYS.forEach((key) => {
      allocation[key] = template.stats?.[key] ?? 0;
    });

    const sessionParams = {
      description: template.label || "Quest",
      durationMinutes: template.defaultDurationMinutes || 25,
      allocation,
      questKey: template.id || template.label || null,
      questAction: template.action || null,
    };

    if (sessionParams.questAction) {
      setPendingQuestAction(sessionParams.questAction);
    }

    handleStartSession(sessionParams);
  }

  function handleStartSession({ description, durationMinutes, allocation, questKey = null }) {
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

    // Compute chart values from allocation
    const baseStats = questStatsToChartStats(allocation, 0);
    const targetStats = questStatsToChartStats(allocation, durationMinutes);

    const session = createTaskSession({
      id,
      description,
      durationMinutes,
      startTime: new Date().toISOString(),
      allocation,
      standStats: baseStats,
      targetStats,
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
      completedSession.endTime,
    );
    setQuestStreaks(updatedQuestStreaks);

    setSessions((prev) => [
      {
        id: completedSession.id,
        description: completedSession.description,
        durationMinutes: completedSession.durationMinutes,
        completedAt: completedSession.endTime,
        allocation: completedSession.allocation ?? null,
        standStats: completedSession.standStats ?? null,
        targetStats: completedSession.targetStats ?? null,
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

  const { openQuestAction } = useOpenQuestAction({
    pendingQuestAction,
    setPendingQuestAction,
    screen,
  });

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

  function handleOpenSettings() {
    navigate(Screens.SETTINGS);
  }

  function handleOpenNotifications() {
    console.log("Notifications pressed");
  }

  // Determine if navbar should show
  const showNavbar = [Screens.HOME, Screens.LIBRARY, Screens.HISTORY, Screens.LEADERBOARD].includes(screen);

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
            quotes={allQuotes.map((q) => q.text)}
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
          <LeaderboardScreen
            avatar={avatar}
            sessions={sessions}
            onViewProfile={(player) => {
              setViewingProfile(player);
              navigate(Screens.PROFILE);
            }}
          />
        )}
        {screen === Screens.PROFILE && viewingProfile && (
          <ProfileScreen
            player={viewingProfile}
            onBack={() => {
              setViewingProfile(null);
              navigate(Screens.LEADERBOARD);
            }}
          />
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
            userQuotes={userQuotes ?? []}
            includeBuiltInQuotes={includeBuiltInQuotes ?? true}
            onAddQuote={handleAddQuote}
            onDeleteQuote={handleDeleteQuote}
            onToggleBuiltInQuotes={handleToggleBuiltInQuotes}
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


