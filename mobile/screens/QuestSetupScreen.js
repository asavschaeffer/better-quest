import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Platform } from "react-native";
import styles from "../../style";
import { StandStatsChart } from "../StandStatsChart";
import { BUILT_IN_QUEST_TEMPLATES, questStatsToChartStats } from "../core/questStorage";
import { rankQuests } from "../core/quests";
import { STAT_KEYS } from "../core/models";

export default function QuestSetupScreen({
  userQuests = [],
  pickerDefaultMode = "top",
  autoSelectQuest = null,
  onAutoSelectConsumed,
  onBack,
  onStartSession,
  onCreateQuestDraft,
  onDeleteQuest,
  onEditQuest,
  onOpenQuestAction,
}) {
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(25);
  const [error, setError] = useState("");
  // Store raw allocation (0-3 scale)
  const [allocation, setAllocation] = useState({
    STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0,
  });
  const [selectedQuestId, setSelectedQuestId] = useState(null);
  const [selectedQuestAction, setSelectedQuestAction] = useState(null);
  const autoApplyRef = useRef({ desc: "", questId: null });

  // Compute chart values from allocation + duration
  const baseStats = useMemo(() => questStatsToChartStats(allocation, 0), [allocation]);
  const targetStats = useMemo(() => questStatsToChartStats(allocation, duration), [allocation, duration]);
  // Legacy: keep focusStats for compatibility with existing code
  const focusStats = baseStats;

  // Combine user quests with built-in templates
  const allQuests = useMemo(() => {
    return [...userQuests, ...BUILT_IN_QUEST_TEMPLATES];
  }, [userQuests]);

  const sortedQuests = useMemo(
    () => rankQuests(allQuests, focusStats, description),
    [allQuests, focusStats, description]
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
      allocation,
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
    if (!template) return;
    setDescription(template.label);
    if (template.defaultDurationMinutes) {
      setDuration(template.defaultDurationMinutes);
    }
    // Store raw allocation (0-3 scale)
    const rawStats = {};
    STAT_KEYS.forEach(key => {
      rawStats[key] = template.stats?.[key] ?? 0;
    });
    setAllocation(rawStats);
    setSelectedQuestId(template.id);
    setSelectedQuestAction(template.action || null);
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
  });

  useEffect(() => {
    const trimmed = description.trim();
    if (selectedQuestId || !trimmed) return;
    if (!sortedQuests.length) return;
    const top = sortedQuests[0];
    if (!top?.stats) return;

    // Avoid feedback loop: only auto-apply once per description change
    if (autoApplyRef.current.desc === trimmed) return;

    // Update allocation from top matching quest
    const suggestedAlloc = {};
    STAT_KEYS.forEach(key => {
      suggestedAlloc[key] = top.stats?.[key] ?? 0;
    });
    const allocChanged = STAT_KEYS.some(
      (key) => allocation[key] !== suggestedAlloc[key]
    );
    if (allocChanged) {
      setAllocation(suggestedAlloc);
    }

    const actionChanged =
      (selectedQuestAction?.type || null) !== (top.action?.type || null) ||
      (selectedQuestAction?.value || null) !== (top.action?.value || null);
    if (actionChanged) {
      setSelectedQuestAction(top.action || null);
    }

    autoApplyRef.current = { desc: trimmed, questId: top.id || null };
  }, [sortedQuests, selectedQuestId, description, allocation, selectedQuestAction]);

  // Auto-select quest when provided (e.g., saved from library)
  useEffect(() => {
    if (!autoSelectQuest) return;
    applyQuestTemplate(autoSelectQuest);
    setSelectedQuestId(autoSelectQuest.id || null);
    if (onAutoSelectConsumed) {
      onAutoSelectConsumed();
    }
  }, [autoSelectQuest, onAutoSelectConsumed]);

  // Picker default mode: preselect top suggestion unless user started typing
  useEffect(() => {
    if (pickerDefaultMode !== "top") return;
    if (description.trim() || selectedQuestId || !sortedQuests.length) return;
    const top = sortedQuests[0];
    if (top) {
      applyQuestTemplate(top);
    }
  }, [pickerDefaultMode, description, selectedQuestId, sortedQuests]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick your quest</Text>
      <StandStatsChart
        value={baseStats}
        targetValue={targetStats}
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
                const selected = allQuests.find((q) => q.id === selectedQuestId);
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
            const isUserQuest = userQuests.some((uq) => uq.id === q.id);
            return (
              <TouchableOpacity
                key={q.id}
                style={[
                  styles.questItem,
                  selectedQuestId === q.id && styles.questItemActive,
                  isUserQuest && styles.questItemUser,
                ]}
                onPress={() => applyQuestTemplate(q)}
                onLongPress={
                  isUserQuest
                    ? () => {
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
                      }
                    : undefined
                }
              >
                <Text style={styles.questItemLabel}>{q.label}</Text>
                {q.defaultDurationMinutes ? (
                  <Text style={styles.questItemMeta}>{q.defaultDurationMinutes}m</Text>
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
      {(selectedQuestAction ||
        (selectedQuestId && userQuests.some((q) => q.id === selectedQuestId))) && (
        <View style={styles.questActionsRow}>
          {selectedQuestAction && onOpenQuestAction && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onOpenQuestAction(selectedQuestAction)}
            >
              <Text style={styles.actionBtnText}>
                {selectedQuestAction.type === "url"
                  ? "🔗"
                  : selectedQuestAction.type === "file"
                  ? "📁"
                  : "📱"}{" "}
                Open
              </Text>
            </TouchableOpacity>
          )}
          {selectedQuestId && userQuests.some((q) => q.id === selectedQuestId) && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                const quest = userQuests.find((q) => q.id === selectedQuestId);
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
