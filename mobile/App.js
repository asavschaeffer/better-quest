import React, { useEffect, useMemo, useState, useCallback } from "react";
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

const STORAGE_KEY = "better-quest-mobile-state-v1";
const COMBO_BONUS_MULTIPLIER = 1.2;
const REST_BONUS_MULTIPLIER = 1.1;
const REST_BONUS_WINDOW_MINUTES = 45;

export default function App() {
  const [user, setUser] = useState(() => createUser());
  const [sessions, setSessions] = useState([]);
  const [motivation, setMotivation] = useState("");
  const [userQuests, setUserQuests] = useState([]);

  const [screen, setScreen] = useState("home"); // home | quest | newQuest | session | complete
  const [currentSession, setCurrentSession] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [notes, setNotes] = useState("");
  const [lastExpResult, setLastExpResult] = useState(null);
  const [comboFromSessionId, setComboFromSessionId] = useState(null);
  const [wellRestedUntil, setWellRestedUntil] = useState(null);
  const [draftQuestName, setDraftQuestName] = useState("");
  const [pendingQuestAction, setPendingQuestAction] = useState(null); // action to open after save & start

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
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    };
    save();
  }, [user, sessions, motivation, comboFromSessionId, wellRestedUntil]);

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

  function handleStartQuest() {
    setScreen("quest");
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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        {screen === "home" && (
          <HomeScreen
            avatar={avatar}
            levelInfo={levelInfo}
            motivation={motivation}
            onMotivationChange={setMotivation}
            onStartQuest={handleStartQuest}
            sessions={sessions}
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
          />
        )}
        {screen === "newQuest" && (
          <NewQuestScreen
            initialName={draftQuestName}
            onBack={() => setScreen("quest")}
            onSave={async (quest) => {
              const updated = await addUserQuest(quest);
              setUserQuests(updated);
              setScreen("quest");
            }}
            onSaveAndStart={async (quest, sessionParams) => {
              const updated = await addUserQuest(quest);
              setUserQuests(updated);
              // Open quick launch action if present
              if (quest.action) {
                openQuestAction(quest.action);
              }
              handleStartSession(sessionParams);
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function HomeScreen({
  avatar,
  levelInfo,
  motivation,
  onMotivationChange,
  onStartQuest,
  sessions,
}) {
  const [logStyle, setLogStyle] = useState("raw");
  const [copied, setCopied] = useState(false);

  async function copyLog() {
    const text = buildLogText(logStyle, sessions);
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore for now
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Better Quest</Text>
      <View style={styles.avatarCard}>
        <View style={styles.avatarHeader}>
          <Text style={styles.label}>Your adventurer</Text>
          <Text style={styles.avatarName}>{avatar.name}</Text>
        </View>
        <Text style={styles.avatarLevel}>Lv {avatar.level}</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${levelInfo.ratio * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.muted}>
          {levelInfo.current} / {levelInfo.required} EXP
        </Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>Reason for this quest</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="e.g. Finish my degree, get in shape, or build something I'm proud of."
          value={motivation}
          onChangeText={onMotivationChange}
        />
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={onStartQuest}>
        <Text style={styles.primaryBtnText}>Start quest</Text>
      </TouchableOpacity>
      <View style={styles.block}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Recent sessions</Text>
          {sessions.length > 0 && (
            <View style={styles.logControls}>
              <View style={styles.rowWrap}>
                <Chip
                  label="Raw"
                  active={logStyle === "raw"}
                  onPress={() => setLogStyle("raw")}
                />
                <Chip
                  label="Twitter"
                  active={logStyle === "twitter"}
                  onPress={() => setLogStyle("twitter")}
                />
                <Chip
                  label="LinkedIn"
                  active={logStyle === "linkedin"}
                  onPress={() => setLogStyle("linkedin")}
                />
              </View>
              <TouchableOpacity style={styles.secondaryBtn} onPress={copyLog}>
                <Text style={styles.secondaryBtnText}>Copy log</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {copied && (
          <Text style={styles.copiedToast}>Log copied to clipboard.</Text>
        )}
        {sessions.length === 0 ? (
          <Text style={styles.muted}>No sessions yet. Your first quest awaits.</Text>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <Text style={styles.historyPrimary}>
                  {item.description}{" "}
                  <Text style={styles.muted}>
                    ({item.durationMinutes} min, +{item.expResult.totalExp} EXP)
                  </Text>
                </Text>
                {item.notes ? (
                  <Text style={styles.historyNotes}>{item.notes}</Text>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

function QuestSetupScreen({ userQuests = [], onBack, onStartSession, onCreateQuestDraft, onDeleteQuest }) {
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
    if (selectedQuestId || !description.trim()) return;
    if (!sortedQuests.length) return;
    const top = sortedQuests[0];
    if (!top?.stats) return;
    setFocusStats(questStatsToChartStats(top.stats));
    setSelectedQuestAction(top.action || null);
  }, [sortedQuests, selectedQuestId, description]);

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
      {selectedQuestAction && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => openQuestAction(selectedQuestAction)}
        >
          <Text style={styles.actionBtnText}>
            {selectedQuestAction.type === "url" ? "🔗" : selectedQuestAction.type === "file" ? "📁" : "📱"} Open resource
          </Text>
        </TouchableOpacity>
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

function NewQuestScreen({ initialName = "", onBack, onSave, onSaveAndStart }) {
  const [label, setLabel] = useState(initialName);
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState("");
  const [stats, setStats] = useState(() => suggestStatsForLabel(initialName));
  const [keywords, setKeywords] = useState("");
  const [action, setAction] = useState(null);
  const [error, setError] = useState("");

  // Update stats suggestion when label changes
  useEffect(() => {
    if (!label.trim()) return;
    const suggested = suggestStatsForLabel(label);
    const total = getQuestStatTotal(suggested);
    if (total > 0) {
      setStats(suggested);
    }
  }, [label]);

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
      id: `quest-${Date.now()}`,
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
      <Text style={styles.title}>Create Quest</Text>
      <Text style={styles.muted}>
        Build a reusable quest template with stats and quick launch
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
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSave}>
            <Text style={styles.secondaryBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveAndStart}>
            <Text style={styles.primaryBtnText}>Save & Start</Text>
          </TouchableOpacity>
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
  actionBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#1e3a5f",
    alignSelf: "flex-start",
  },
  actionBtnText: {
    color: "#93c5fd",
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

