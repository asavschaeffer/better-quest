import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import {
  createDefaultAvatar,
  createTaskSession,
  createUser,
  TaskType,
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

const STORAGE_KEY = "better-quest-mobile-state-v1";
const COMBO_BONUS_MULTIPLIER = 1.2;
const REST_BONUS_MULTIPLIER = 1.1;
const REST_BONUS_WINDOW_MINUTES = 45;

// Fixed stat set for radar and quest templates.
const STAT_KEYS = ["STR", "DEX", "STA", "INT", "SPI", "CRE", "VIT"];

// Deterministic quest templates. Stat levels are integers 0–3.
const QUEST_TEMPLATES = [
  {
    id: "weightlifting",
    label: "Weightlifting",
    description: "Weightlifting",
    defaultDurationMinutes: 45,
    taskType: TaskType.STRENGTH,
    stats: { STR: 2, DEX: 0, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 }, // +2 STR +1 STA +1 VIT
    keywords: ["weightlifting", "weights", "gym", "strength"],
  },
  {
    id: "guitar",
    label: "Guitar practice",
    description: "Guitar",
    defaultDurationMinutes: 45,
    taskType: TaskType.MIXED,
    stats: { STR: 0, DEX: 2, STA: 0, INT: 0, SPI: 1, CRE: 1, VIT: 0 }, // +2 DEX +1 SPI +1 CRE
    keywords: ["guitar", "music", "emo", "practice"],
  },
  {
    id: "running",
    label: "Running",
    description: "Running",
    defaultDurationMinutes: 30,
    taskType: TaskType.STAMINA,
    stats: { STR: 1, DEX: 0, STA: 2, INT: 0, SPI: 0, CRE: 0, VIT: 1 }, // +2 STA +1 STR +1 VIT
    keywords: ["run", "running", "cardio"],
  },
  {
    id: "math",
    label: "Math study",
    description: "Math",
    defaultDurationMinutes: 60,
    taskType: TaskType.INTELLIGENCE,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 2, SPI: 0, CRE: 1, VIT: 1 }, // +2 INT +1 CRE +1 VIT
    keywords: ["math", "study", "course"],
  },
  {
    id: "prayer",
    label: "Prayer / meditation",
    description: "Prayer / meditation",
    defaultDurationMinutes: 20,
    taskType: TaskType.MIXED,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 3, CRE: 0, VIT: 1 }, // +3 SPI +1 VIT
    keywords: ["prayer", "meditation", "spiritual", "faith"],
  },
  {
    id: "writing",
    label: "Writing",
    description: "Writing",
    defaultDurationMinutes: 30,
    taskType: TaskType.MIXED,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CRE: 2, VIT: 1 }, // +2 CRE +1 SPI +1 VIT
    keywords: ["writing", "journal", "essay"],
  },
  {
    id: "shower",
    label: "Shower / reset",
    description: "Shower / reset",
    defaultDurationMinutes: 15,
    taskType: TaskType.MIXED,
    stats: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 1, CRE: 0, VIT: 1 }, // +1 VIT +1 SPI
    keywords: ["shower", "reset", "clean"],
  },
];

export default function App() {
  const [user, setUser] = useState(() => createUser());
  const [sessions, setSessions] = useState([]);
  const [motivation, setMotivation] = useState("");

  const [screen, setScreen] = useState("home"); // home | quest | newQuest | session | complete
  const [currentSession, setCurrentSession] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [notes, setNotes] = useState("");
  const [lastExpResult, setLastExpResult] = useState(null);
  const [comboFromSessionId, setComboFromSessionId] = useState(null);
  const [wellRestedUntil, setWellRestedUntil] = useState(null);
  const [draftQuestName, setDraftQuestName] = useState("");

  // Hydrate on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
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

  function handleStartSession({ description, durationMinutes, taskType }) {
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
      taskType,
      startTime: new Date().toISOString(),
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
        taskType: completedSession.taskType,
        completedAt: completedSession.endTime,
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
          onBack={() => setScreen("home")}
          onStartSession={handleStartSession}
          onCreateQuestDraft={(name) => {
            const trimmed = (name ?? "").trim();
            if (!trimmed) return;
            setDraftQuestName(trimmed);
            setScreen("newQuest");
          }}
        />
      )}
      {screen === "newQuest" && (
        <NewQuestScreen
          name={draftQuestName}
          onBack={() => setScreen("quest")}
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

function QuestSetupScreen({ onBack, onStartSession, onCreateQuestDraft }) {
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("25");
  const [taskType, setTaskType] = useState(TaskType.INTELLIGENCE);
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

  const sortedQuests = useMemo(
    () => rankQuests(QUEST_TEMPLATES, focusStats, description),
    [focusStats, description],
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
    const minutes = parseInt(duration, 10);
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
      taskType,
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
    setDescription(template.description || template.label);
    if (template.defaultDurationMinutes) {
      setDuration(String(template.defaultDurationMinutes));
    }
    if (template.taskType) {
      setTaskType(template.taskType);
    }
    setFocusStats(questStatsToChartValue(template.stats));
    setSelectedQuestId(template.id);
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
    setFocusStats(questStatsToChartValue(top.stats));
  }, [sortedQuests, selectedQuestId, description]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick your quest</Text>
      <StandStatsChart value={focusStats} onChange={handleStatsChange} />
      <View style={styles.block}>
        <Text style={styles.label}>Quests</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputGrow]}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Study math, go for a run, practice guitar"
            autoFocus
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
          {sortedQuests.map((q) => (
            <TouchableOpacity
              key={q.id}
              style={[
                styles.questItem,
                selectedQuestId === q.id && styles.questItemActive,
              ]}
              onPress={() => applyQuestTemplate(q)}
            >
              <Text style={styles.questItemLabel}>{q.label}</Text>
              {q.defaultDurationMinutes ? (
                <Text style={styles.questItemMeta}>
                  {q.defaultDurationMinutes}m
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
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
      <View style={styles.block}>
        <Text style={styles.label}>Duration (minutes)</Text>
        <View style={styles.rowWrap}>
          {[15, 25, 45, 60].map((m) => (
            <Chip
              key={m}
              label={`${m}`}
              onPress={() => setDuration(String(m))}
              active={duration === String(m)}
            />
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
        />
      </View>
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quest in progress</Text>
      <Text style={styles.muted}>{avatar.name} • Lv {avatar.level}</Text>
      <View style={styles.timerBlock}>
        <Text style={styles.sessionEmoji}>{session.icon ?? "⏳"}</Text>
        <Text style={styles.timerText}>{formatted}</Text>
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
        <View style={styles.expCol}>
          <Text style={styles.label}>Strength</Text>
          <Text style={styles.expValue}>+{expResult.strengthExp}</Text>
        </View>
        <View style={styles.expCol}>
          <Text style={styles.label}>Stamina</Text>
          <Text style={styles.expValue}>+{expResult.staminaExp}</Text>
        </View>
        <View style={styles.expCol}>
          <Text style={styles.label}>Intelligence</Text>
          <Text style={styles.expValue}>+{expResult.intelligenceExp}</Text>
        </View>
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

function NewQuestScreen({ name, onBack }) {
  const title = (name ?? "").trim() || "Untitled quest";
  return (
    <View style={styles.container}>
      <Text style={styles.title}>New quest (coming soon)</Text>
      <Text style={[styles.muted, { marginTop: 8 }]}>
        We&apos;ll turn &ldquo;{title}&rdquo; into a reusable quest template here.
      </Text>
      <TouchableOpacity
        style={[styles.ghostBtn, { marginTop: 24 }]}
        onPress={onBack}
      >
        <Text style={styles.ghostBtnText}>Back to setup</Text>
      </TouchableOpacity>
    </View>
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
});

function applySessionBonuses(session, baseExp) {
  const mult = session.bonusMultiplier ?? 1;
  if (mult === 1) return baseExp;
  const strengthExp = Math.round(baseExp.strengthExp * mult);
  const staminaExp = Math.round(baseExp.staminaExp * mult);
  const intelligenceExp = Math.round(baseExp.intelligenceExp * mult);
  const totalExp = strengthExp + staminaExp + intelligenceExp;
  return {
    totalExp,
    strengthExp,
    staminaExp,
    intelligenceExp,
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

function questStatsToChartValue(stats) {
  const next = {};
  STAT_KEYS.forEach((key) => {
    const level = stats?.[key] ?? 0; // 0–3
    const clamped = Math.max(0, Math.min(3, level));
    // Map 0–3 → 1–5 roughly linearly.
    const val = 1 + Math.round((clamped / 3) * 4);
    next[key] = val;
  });
  return next;
}
