import React, { useEffect, useMemo, useState, useCallback, useContext } from "react";
import { Platform, Text, TouchableOpacity, View, Pressable } from "react-native";
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { enableScreens } from "react-native-screens";
import { Ionicons } from "@expo/vector-icons";

import {
  CommonActions,
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { createDefaultAvatar, createTaskSession, STAT_KEYS } from "../core/models.js";
import { calculateExpForSession, applyExpToAvatar, getLevelProgress } from "../core/exp.js";
import { computeDailyBudgets, updateFatigueAdaptNext } from "../core/fatigue.js";
import { inferEmojiForDescription } from "../core/emoji.js";
import { addUserQuest, deleteUserQuest, questStatsToChartStats } from "../core/questStorage.js";
import { playerStatsToChartValues, computeTodayStandExp, addStandExp } from "../core/stats.js";
import {
  updateQuestStreaks,
  getMaxMandalaStreak,
  computeAggregateConsistency,
} from "../core/quests.js";
import { applySessionBonuses, applyFatigueDamping } from "../core/sessions.js";
import {
  applyBrahmaMuhurtaBonus,
  computeStreakBonusEntries,
  resolveBonusMultiplier,
} from "../core/bonuses.js";
import { getAllQuotes, getQuoteOfTheDay, addUserQuote, deleteUserQuote as deleteQuote } from "../core/quotes.js";

import { useAppState, useAppActions } from "../state/store.js";

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

import Toast from "../components/Toast.js";
import styles from "../../style.js";

const COMBO_BONUS_MULTIPLIER = 1.2;
const REST_BONUS_MULTIPLIER = 1.1;
const REST_BONUS_WINDOW_MINUTES = 45;

enableScreens(true);

const navigationRef = createNavigationContainerRef();

const RootStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const LibraryStack = createNativeStackNavigator();
const HistoryStack = createNativeStackNavigator();
const RankStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ROUTES = {
  TABS: "Tabs",
  SETTINGS: "Settings",
  PROFILE: "Profile",
  QUEST_SETUP: "QuestSetup",
  QUEST_EDITOR: "QuestEditor",
  SESSION: "Session",
  COMPLETE: "Complete",
};

const TAB_ROUTES = {
  HOME: "HomeTab",
  LIBRARY: "LibraryTab",
  QUEST_ACTION: "QuestActionTab",
  HISTORY: "HistoryTab",
  RANK: "RankTab",
};

const AppShellContext = React.createContext(null);

const NAV_BG = "#020617";
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: NAV_BG,
    card: NAV_BG,
    text: "#f9fafb",
    border: "#1f2937",
    primary: "#a5b4fc",
  },
};

const stackScreenOptions = {
  contentStyle: { backgroundColor: NAV_BG },
  headerStyle: { backgroundColor: NAV_BG },
  headerTintColor: "#f9fafb",
  headerShadowVisible: false,
  // Ensure iOS back swipe works consistently (even within scroll views).
  // Session/Complete override this with gestureEnabled: false in their group.
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === "ios",
};

function QuestActionStub() {
  return null;
}

function HomeTab() {
  const ctx = useContext(AppShellContext);

  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="Home" options={{ headerShown: false }}>
        {({ navigation }) => (
          <HomeScreen
            avatar={ctx.avatar}
            levelInfo={ctx.levelInfo}
            fatigueOverlayStats={ctx.fatigueOverlayStats}
            onOpenSettings={() => ctx.nav(ROUTES.SETTINGS)}
            onOpenNotifications={ctx.handleOpenNotifications}
            inAppAnnouncementsEnabled={ctx.inAppAnnouncementsEnabled}
            announcements={ctx.announcements}
            quotes={ctx.quotes}
          />
        )}
      </HomeStack.Screen>
    </HomeStack.Navigator>
  );
}

function LibraryTab() {
  const ctx = useContext(AppShellContext);

  return (
    <LibraryStack.Navigator screenOptions={stackScreenOptions}>
      <LibraryStack.Screen name="Library" options={{ headerShown: false }}>
        {() => (
          <LibraryScreen
            userQuests={ctx.userQuests}
            onSelectQuest={(quest) => ctx.nav(ROUTES.QUEST_EDITOR, { editQuest: quest })}
            onCreateQuest={() => ctx.nav(ROUTES.QUEST_EDITOR, { initialName: "" })}
          />
        )}
      </LibraryStack.Screen>
    </LibraryStack.Navigator>
  );
}

function HistoryTab() {
  const ctx = useContext(AppShellContext);

  return (
    <HistoryStack.Navigator screenOptions={stackScreenOptions}>
      <HistoryStack.Screen name="History" options={{ headerShown: false }}>
        {() => <HistoryScreen sessions={ctx.sessions} />}
      </HistoryStack.Screen>
    </HistoryStack.Navigator>
  );
}

function RankTab() {
  const ctx = useContext(AppShellContext);

  return (
    <RankStack.Navigator screenOptions={stackScreenOptions}>
      <RankStack.Screen name="Leaderboard" options={{ headerShown: false }}>
        {() => (
          <LeaderboardScreen
            avatar={ctx.avatar}
            sessions={ctx.sessions}
            onViewProfile={(player) => ctx.nav(ROUTES.PROFILE, { player })}
          />
        )}
      </RankStack.Screen>
    </RankStack.Navigator>
  );
}

function TabsNavigator() {
  const ctx = useContext(AppShellContext);
  const insets = useSafeAreaInsets();

  const tabBarStyle = useMemo(() => {
    const bottom = Math.max(0, insets?.bottom ?? 0);
    // iOS-feeling sizing: keep the bar "tall enough" and pad to clear the home indicator.
    return {
      backgroundColor: "#0b1220",
      borderTopColor: "#1f2937",
      borderTopWidth: 1,
      height: 56 + bottom,
      paddingBottom: bottom,
      paddingTop: 8,
    };
  }, [insets]);

  function TabCenterButton({ onPress, accessibilityLabel }) {
    return (
      <View style={{ flex: 1, alignItems: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={({ pressed }) => [
            styles.navBigButton,
            pressed && { transform: [{ translateY: -20 }, { scale: 0.98 }], opacity: 0.95 },
          ]}
        >
          <Ionicons name="play" size={26} color="#f9fafb" />
        </Pressable>
      </View>
    );
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: "#a5b4fc",
        tabBarInactiveTintColor: "#6b7280",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
        tabBarIconStyle: { marginTop: 2 },
        tabBarItemStyle: { justifyContent: "center" },
        sceneContainerStyle: { backgroundColor: NAV_BG },
      }}
    >
      <Tab.Screen
        name={TAB_ROUTES.HOME}
        component={HomeTab}
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name={TAB_ROUTES.LIBRARY}
        component={LibraryTab}
        options={{
          title: "Library",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "book" : "book-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name={TAB_ROUTES.QUEST_ACTION}
        component={QuestActionStub}
        options={{
          title: "",
          tabBarLabel: "",
          tabBarButton: () => (
            <TabCenterButton
              accessibilityLabel="Start quest"
              onPress={() => ctx.nav(ROUTES.QUEST_SETUP)}
            />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            ctx.nav(ROUTES.QUEST_SETUP);
          },
        }}
      />
      <Tab.Screen
        name={TAB_ROUTES.HISTORY}
        component={HistoryTab}
        options={{
          title: "History",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name={TAB_ROUTES.RANK}
        component={RankTab}
        options={{
          title: "Rank",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "podium" : "podium-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function SettingsRootScreen() {
  const ctx = useContext(AppShellContext);
  return (
    <SettingsScreen
      avatar={ctx.avatar}
      onUpdateAvatar={ctx.onUpdateAvatar}
      quickStartMode={ctx.quickStartMode}
      pickerDefaultMode={ctx.pickerDefaultMode}
      postSaveBehavior={ctx.postSaveBehavior}
      onUpdateQuickStartMode={ctx.onUpdateQuickStartMode}
      onUpdatePickerDefaultMode={ctx.onUpdatePickerDefaultMode}
      onUpdatePostSaveBehavior={ctx.onUpdatePostSaveBehavior}
      sunriseTimeLocal={ctx.sunriseTimeLocal}
      onUpdateSunriseTimeLocal={ctx.onUpdateSunriseTimeLocal}
      showToast={ctx.showToast}
      userQuotes={ctx.userQuotes}
      includeBuiltInQuotes={ctx.includeBuiltInQuotes}
      onAddQuote={ctx.handleAddQuote}
      onDeleteQuote={ctx.handleDeleteQuote}
      onToggleBuiltInQuotes={ctx.handleToggleBuiltInQuotes}
      inAppAnnouncementsEnabled={ctx.inAppAnnouncementsEnabled}
      onUpdateInAppAnnouncementsEnabled={ctx.handleToggleInAppAnnouncementsEnabled}
    />
  );
}

function ProfileRootScreen({ route }) {
  return <ProfileScreen player={route.params.player} />;
}

export default function AppShell() {
  const {
    user,
    sessions,
    motivation,
    questStreaks,
    comboFromSessionId,
    wellRestedUntil,
    sunriseTimeLocal,
    fatigueAdapt,
    fatigueAdaptNext,
    fatigueAdaptDay,
    quickStartMode,
    pickerDefaultMode,
    postSaveBehavior,
    userQuotes,
    includeBuiltInQuotes,
    inAppAnnouncementsEnabled,
  } = useAppState();
  const {
    setUser,
    setSessions,
    setMotivation,
    setQuestStreaks,
    setComboFromSessionId,
    setWellRestedUntil,
    setSunriseTimeLocal,
    setFatigueAdapt,
    setFatigueAdaptNext,
    setFatigueAdaptDay,
    setQuickStartMode,
    setPickerDefaultMode,
    setPostSaveBehavior,
    setUserQuotes,
    setIncludeBuiltInQuotes,
    setInAppAnnouncementsEnabled,
  } = useAppActions();

  const [currentSession, setCurrentSession] = useState(null);
  const [notes, setNotes] = useState("");
  const [lastExpResult, setLastExpResult] = useState(null);
  const [pendingQuestAction, setPendingQuestAction] = useState(null);
  const [pendingQuestSelection, setPendingQuestSelection] = useState(null);
  const { toastMessage, showToast } = useToast({ durationMs: 2000 });
  const [routeName, setRouteName] = useState(null);
  const isSessionActive = routeName === ROUTES.SESSION;

  const nav = useCallback((name, params) => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate(name, params);
  }, []);

  const navToHomeTab = useCallback(() => {
    nav(ROUTES.TABS, { screen: TAB_ROUTES.HOME });
  }, [nav]);

  const resetToTabs = useCallback((tabRoute = TAB_ROUTES.HOME) => {
    if (!navigationRef.isReady()) return;
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: ROUTES.TABS, params: { screen: tabRoute } }],
      }),
    );
  }, []);

  const hydrateActions = useMemo(
    () => ({
      setUser,
      setSessions,
      setMotivation,
      setQuestStreaks,
      setComboFromSessionId,
      setWellRestedUntil,
      setSunriseTimeLocal,
      setFatigueAdapt,
      setFatigueAdaptNext,
      setFatigueAdaptDay,
      setQuickStartMode,
      setPickerDefaultMode,
      setPostSaveBehavior,
      setUserQuotes,
      setIncludeBuiltInQuotes,
      setInAppAnnouncementsEnabled,
    }),
    [
      setUser,
      setSessions,
      setMotivation,
      setQuestStreaks,
      setComboFromSessionId,
      setWellRestedUntil,
      setSunriseTimeLocal,
      setFatigueAdapt,
      setFatigueAdaptNext,
      setFatigueAdaptDay,
      setQuickStartMode,
      setPickerDefaultMode,
      setPostSaveBehavior,
      setUserQuotes,
      setIncludeBuiltInQuotes,
      setInAppAnnouncementsEnabled,
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
    sunriseTimeLocal,
    fatigueAdapt,
    fatigueAdaptNext,
    fatigueAdaptDay,
    quickStartMode,
    pickerDefaultMode,
    postSaveBehavior,
    userQuotes,
    includeBuiltInQuotes,
    inAppAnnouncementsEnabled,
  });

  function getLocalDayKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }

  function ensureStatMap(obj, fallback = 1) {
    const out = {};
    STAT_KEYS.forEach((k) => {
      const v = obj?.[k];
      out[k] = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    });
    return out;
  }

  // Day rollover: apply "tomorrow" fatigue multipliers at the start of a new day.
  useEffect(() => {
    const todayKey = getLocalDayKey();
    if (fatigueAdaptDay && fatigueAdaptDay === todayKey) return;
    const nextApplied = ensureStatMap(fatigueAdaptNext || fatigueAdapt, 1);
    setFatigueAdapt(nextApplied);
    setFatigueAdaptNext(nextApplied);
    setFatigueAdaptDay(todayKey);
  }, [fatigueAdaptDay, fatigueAdapt, fatigueAdaptNext, setFatigueAdapt, setFatigueAdaptNext, setFatigueAdaptDay]);

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
    isActive: isSessionActive,
    onComplete: handleTimerComplete,
  });

  const avatar = user?.avatar ?? createDefaultAvatar();
  const levelInfo = useMemo(() => getLevelProgress(avatar.totalExp ?? 0), [avatar.totalExp]);

  const todayStandExp = useMemo(() => computeTodayStandExp(sessions), [sessions]);
  const mandalaStreak = useMemo(() => getMaxMandalaStreak(questStreaks), [questStreaks]);
  const aggregateConsistency = useMemo(
    () => computeAggregateConsistency(sessions),
    [sessions],
  );
  const dailyBudgets = useMemo(() => {
    return computeDailyBudgets({
      standExp: avatar.standExp,
      level: avatar.level ?? 1,
      mandalaStreak,
      aggregateConsistency,
      adaptMultipliers: ensureStatMap(fatigueAdapt, 1),
    });
  }, [avatar, mandalaStreak, aggregateConsistency, fatigueAdapt]);
  const fatigueOverlayStats = useMemo(() => {
    const baselineMax = Math.max(
      1,
      ...STAT_KEYS.map((k) => (typeof avatar.standExp?.[k] === "number" ? avatar.standExp[k] : 0)),
    );
    const remaining = {};
    STAT_KEYS.forEach((k) => {
      const budget = dailyBudgets[k] ?? 0;
      const spent = todayStandExp[k] ?? 0;
      remaining[k] = Math.max(0, budget - spent);
    });
    const previewStand = addStandExp(avatar.standExp, remaining);
    // IMPORTANT: keep the overlay on the same "power level" scale as the current chart,
    // otherwise adding to the max stat can rescale everything and make the overlay look smaller.
    return playerStatsToChartValues(previewStand, { maxStatOverride: baselineMax });
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

  function handleToggleInAppAnnouncementsEnabled(enabled) {
    setInAppAnnouncementsEnabled(enabled);
    showToast(enabled ? "Announcements enabled" : "Announcements disabled");
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
    const bonusBreakdown = [];
    if (hasCombo) {
      bonusBreakdown.push({
        key: "combo",
        label: "Combo",
        mode: "mult",
        value: COMBO_BONUS_MULTIPLIER,
      });
    }
    if (hasRest) {
      bonusBreakdown.push({
        key: "rest",
        label: "Well-rested",
        mode: "mult",
        value: REST_BONUS_MULTIPLIER,
      });
    }

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
      bonusBreakdown: bonusBreakdown.length ? bonusBreakdown : null,
      endTimeMs,
    });
    session.icon = inferEmojiForDescription(description);
    setCurrentSession(session);
    setRemainingMs(endTimeMs - Date.now());
    if (hasCombo) setComboFromSessionId(null);
    if (hasRest) setWellRestedUntil(null);
    nav(ROUTES.SESSION);
  }

  function handleTimerComplete(endTimeMs) {
    if (!currentSession) return;
    const completedSession = {
      ...currentSession,
      endTime: new Date(endTimeMs).toISOString(),
    };

    // Streak bonuses are determined at completion time (strict: day 1 => no bonus).
    const existingBreakdown = Array.isArray(completedSession.bonusBreakdown)
      ? completedSession.bonusBreakdown
      : [];
    const { entries: streakEntries } = computeStreakBonusEntries({
      sessions,
      questStreaks,
      questKey: completedSession.questKey,
      completedAt: completedSession.endTime,
    });
    const combinedBreakdown = [...existingBreakdown, ...streakEntries];
    completedSession.bonusBreakdown = combinedBreakdown.length ? combinedBreakdown : null;
    completedSession.bonusMultiplier = resolveBonusMultiplier({
      bonusBreakdown: completedSession.bonusBreakdown,
      fallbackMultiplier: completedSession.bonusMultiplier ?? 1,
    });

    const baseExp = calculateExpForSession(completedSession);
    const expWithBonuses = applySessionBonuses(completedSession, baseExp);
    const { exp: expWithBrahma, applied: brahmaApplied, breakdownEntry } =
      applyBrahmaMuhurtaBonus({
        session: { ...completedSession, endTimeMs },
        exp: expWithBonuses,
        sunriseTimeLocal,
      });
    if (brahmaApplied && breakdownEntry) {
      const existing = Array.isArray(completedSession.bonusBreakdown)
        ? completedSession.bonusBreakdown
        : [];
      completedSession.bonusBreakdown = [...existing, breakdownEntry];
    }
    const exp = applyFatigueDamping({
      baseExp: expWithBrahma,
      avatar,
      sessions,
      questStreaks,
      adaptMultipliers: ensureStatMap(fatigueAdapt, 1),
    });
    setLastExpResult(exp);
    const nextAvatar = applyExpToAvatar(avatar, exp);
    setUser((prev) => ({ ...prev, avatar: nextAvatar }));

    // Progressive overload (Option A): update tomorrow multipliers from today's earned load.
    // Uses *earned* amounts (post-fatigue) to stay simple and avoid extra stored fields.
    const spentAfter = ensureStatMap(todayStandExp, 0);
    STAT_KEYS.forEach((k) => {
      spentAfter[k] += exp?.standExp?.[k] ?? 0;
    });
    const nextTomorrow = updateFatigueAdaptNext({
      adaptNext: ensureStatMap(fatigueAdaptNext || fatigueAdapt, 1),
      spentTodayAfter: spentAfter,
      budgetsToday: dailyBudgets,
    });
    setFatigueAdaptNext(nextTomorrow);

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
        bonusBreakdown: completedSession.bonusBreakdown ?? null,
      },
      ...prev,
    ]);

    setCurrentSession(completedSession);
    setNotes("");
    nav(ROUTES.COMPLETE);
  }

  const handleCancelSession = useCallback(() => {
    setCurrentSession(null);
    // Important: dismiss the full-screen modal route, not just "navigate" underneath it.
    resetToTabs(TAB_ROUTES.HOME);
  }, [resetToTabs]);

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
    nav(ROUTES.QUEST_SETUP);
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
    resetToTabs(TAB_ROUTES.HOME);
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
    resetToTabs(TAB_ROUTES.HOME);
  }

  const { openQuestAction } = useOpenQuestAction({
    pendingQuestAction,
    setPendingQuestAction,
    isSessionActive,
  });

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e) => {
      if (e.key === "Escape" && isSessionActive && currentSession) {
        e.preventDefault();
        handleCancelSession();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSessionActive, currentSession, handleCancelSession]);

  function handleOpenNotifications() {
    // Hook for future analytics/haptics, intentionally no-op for now.
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <StatusBar style="light" />
          <AppShellContext.Provider
            value={useMemo(
              () => ({
                nav,
                avatar,
                levelInfo,
                fatigueOverlayStats,
                announcements,
                quotes: allQuotes.map((q) => q.text),
                sessions,
                userQuests,
                handleOpenNotifications,
                showToast,
                inAppAnnouncementsEnabled: inAppAnnouncementsEnabled ?? true,
                // Settings
                quickStartMode,
                pickerDefaultMode,
                postSaveBehavior,
                sunriseTimeLocal,
                userQuotes: userQuotes ?? [],
                includeBuiltInQuotes: includeBuiltInQuotes ?? true,
                onUpdateAvatar: (updates) => {
                  setUser((prev) => ({
                    ...prev,
                    avatar: { ...prev.avatar, ...updates },
                  }));
                  showToast("Saved");
                },
                onUpdateQuickStartMode: (mode) => {
                  if (mode === "picker" || mode === "instant") {
                    setQuickStartMode(mode);
                  }
                  showToast("Saved");
                },
                onUpdatePickerDefaultMode: (mode) => {
                  if (mode === "top" || mode === "blank") {
                    setPickerDefaultMode(mode);
                  }
                  showToast("Saved");
                },
                onUpdatePostSaveBehavior: (mode) => {
                  if (mode === "library" || mode === "picker") {
                    setPostSaveBehavior(mode);
                  }
                  showToast("Saved");
                },
                onUpdateSunriseTimeLocal: (value) => {
                  setSunriseTimeLocal(value);
                  showToast("Saved");
                },
                handleAddQuote,
                handleDeleteQuote,
                handleToggleBuiltInQuotes,
                handleToggleInAppAnnouncementsEnabled,
              }),
              [
                nav,
                avatar,
                levelInfo,
                fatigueOverlayStats,
                announcements,
                allQuotes,
                sessions,
                userQuests,
                handleOpenNotifications,
                showToast,
                inAppAnnouncementsEnabled,
                quickStartMode,
                pickerDefaultMode,
                postSaveBehavior,
                sunriseTimeLocal,
                userQuotes,
                includeBuiltInQuotes,
                setUser,
                setQuickStartMode,
                setPickerDefaultMode,
                setPostSaveBehavior,
                setSunriseTimeLocal,
                setInAppAnnouncementsEnabled,
                handleAddQuote,
                handleDeleteQuote,
                handleToggleBuiltInQuotes,
                handleToggleInAppAnnouncementsEnabled,
              ],
            )}
          >
            <NavigationContainer
              ref={navigationRef}
              theme={navTheme}
              onReady={() => setRouteName(navigationRef.getCurrentRoute()?.name ?? null)}
              onStateChange={() => setRouteName(navigationRef.getCurrentRoute()?.name ?? null)}
            >
            <RootStack.Navigator screenOptions={stackScreenOptions}>
              <RootStack.Screen name={ROUTES.TABS} component={TabsNavigator} options={{ headerShown: false }} />
              {/* Drill-down screens live above tabs, so the tab bar never "animates away" mid-transition */}
              <RootStack.Screen
                name={ROUTES.SETTINGS}
                component={SettingsRootScreen}
                options={{ title: "Settings" }}
              />
              <RootStack.Screen
                name={ROUTES.PROFILE}
                component={ProfileRootScreen}
                options={({ route }) => ({
                  title: route?.params?.player?.name ?? "Profile",
                })}
              />

              {/* Modals */}
              <RootStack.Group screenOptions={{ presentation: "modal", headerShown: false }}>
                <RootStack.Screen name={ROUTES.QUEST_SETUP}>
                  {({ navigation }) => (
                    <QuestSetupScreen
                      userQuests={userQuests}
                      pickerDefaultMode={pickerDefaultMode}
                      dailyBudgets={dailyBudgets}
                      todayStandExp={todayStandExp}
                      autoSelectQuest={pendingQuestSelection}
                      onAutoSelectConsumed={() => setPendingQuestSelection(null)}
                      onBack={() => navigation.goBack()}
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
                        nav(ROUTES.QUEST_EDITOR, { initialName: trimmed });
                      }}
                      onDeleteQuest={async (questId) => {
                        const updated = await deleteUserQuest(questId);
                        setUserQuests(updated);
                      }}
                      onEditQuest={(quest) => nav(ROUTES.QUEST_EDITOR, { editQuest: quest })}
                      onOpenQuestAction={openQuestAction}
                    />
                  )}
                </RootStack.Screen>

                <RootStack.Screen
                  name={ROUTES.QUEST_EDITOR}
                  options={({ route }) => ({
                    headerShown: true,
                    title: route?.params?.editQuest ? "Edit Quest" : "New Quest",
                  })}
                >
                  {({ navigation, route }) => (
                    <NewQuestScreen
                      initialName={route?.params?.initialName ?? ""}
                      editQuest={route?.params?.editQuest ?? null}
                      onBack={() => navigation.goBack()}
                      onSave={async (quest) => {
                        const updated = await addUserQuest(quest);
                        setUserQuests(updated);
                        showToast("Quest saved");
                        if (postSaveBehavior === "picker") {
                          setPendingQuestSelection(quest);
                          nav(ROUTES.QUEST_SETUP);
                        }
                        navigation.goBack();
                      }}
                      onSaveAndStart={async (quest, sessionParams) => {
                        const updated = await addUserQuest(quest);
                        setUserQuests(updated);
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
                        showToast("Quest deleted");
                        navigation.goBack();
                      }}
                    />
                  )}
                </RootStack.Screen>
              </RootStack.Group>

              {/* Focused session flow */}
              <RootStack.Group
                screenOptions={{
                  presentation: "fullScreenModal",
                  headerShown: false,
                  gestureEnabled: false,
                }}
              >
                <RootStack.Screen name={ROUTES.SESSION}>
                  {() =>
                    currentSession ? (
                      <SessionScreen
                        session={currentSession}
                        remainingMs={remainingMs}
                        avatar={avatar}
                        onCancel={handleCancelSession}
                      />
                    ) : (
                      <View />
                    )
                  }
                </RootStack.Screen>
                <RootStack.Screen name={ROUTES.COMPLETE}>
                  {() =>
                    currentSession && lastExpResult ? (
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
                    ) : (
                      <View />
                    )
                  }
                </RootStack.Screen>
              </RootStack.Group>
            </RootStack.Navigator>
            </NavigationContainer>
          </AppShellContext.Provider>
          <Toast message={toastMessage} />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}


