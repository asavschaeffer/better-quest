import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../style";
import { QuestStatsPicker } from "../components/QuestStatsPicker";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";
import { suggestQuests } from "../core/quests";
import { STAT_KEYS } from "../core/models";

export default function QuestSetupScreen({
  userQuests = [],
  pickerDefaultMode = "top",
  dailyBudgets = {},
  todayStandExp = {},
  autoSelectQuest = null,
  onAutoSelectConsumed,
  onBack,
  onStartSession,
  onCreateQuestDraft,
  onDeleteQuest,
  onEditQuest,
  onOpenQuestAction,
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(25);
  const [error, setError] = useState("");
  // Store raw allocation (0-2 scale)
  const [allocation, setAllocation] = useState({
    STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 0,
  });
  const [selectedQuestId, setSelectedQuestId] = useState(null);
  const [selectedQuestAction, setSelectedQuestAction] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Chart size: fill available width
  const chartSize = useMemo(() => {
    if (Platform.OS === "web") {
      return Math.min(520, screenWidth);
    }
    return screenWidth;
  }, [screenWidth]);

  // Track keyboard visibility to collapse chart on mobile
  useEffect(() => {
    if (Platform.OS === "web") return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Combine user quests with built-in templates
  const allQuests = useMemo(() => {
    return [...userQuests, ...BUILT_IN_QUEST_TEMPLATES];
  }, [userQuests]);

  // Miller's Law suggestions: 5–9 quests (default 7)
  const suggestedQuests = useMemo(
    () => suggestQuests({
      quests: allQuests,
      budgets: dailyBudgets,
      spentToday: todayStandExp,
      selectedAllocation: allocation,
      query: description,
      limit: 7,
    }),
    [allQuests, dailyBudgets, todayStandExp, allocation, description]
  );

  // Handle chart interaction: update allocation (independent of selection)
  function handleAllocationChange(newAllocation) {
    setAllocation(newAllocation);
  }

  const hasDirectNameMatch = useMemo(() => {
    const q = description.trim().toLowerCase();
    if (!q) return false;
    return suggestedQuests.some((tpl) => {
      const label = (tpl.label ?? "").toLowerCase();
      const desc = (tpl.description ?? "").toLowerCase();
      return label.startsWith(q) || desc.startsWith(q);
    });
  }, [suggestedQuests, description]);

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
    if (!selectedQuestId && suggestedQuests.length > 0) {
      // First enter: pick the top matching quest.
      applyQuestTemplate(suggestedQuests[0]);
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
    // Store raw allocation (0-2 scale)
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

  // Note: Auto-apply from top suggestion removed to prevent infinite loops.
  // Users now explicitly tap quest buttons to apply templates.
  // The suggestQuests algorithm already prioritizes relevant quests at the top.

  // Auto-select quest when provided (e.g., saved from library)
  useEffect(() => {
    if (!autoSelectQuest) return;
    applyQuestTemplate(autoSelectQuest);
    setSelectedQuestId(autoSelectQuest.id || null);
    if (onAutoSelectConsumed) {
      onAutoSelectConsumed();
    }
  }, [autoSelectQuest, onAutoSelectConsumed]);

  // Picker default mode: preselect top suggestion on initial mount only
  const defaultAppliedRef = useRef(false);
  useEffect(() => {
    if (pickerDefaultMode !== "top") return;
    if (defaultAppliedRef.current) return; // Only apply once
    if (description.trim() || selectedQuestId || !suggestedQuests.length) return;
    const top = suggestedQuests[0];
    if (top) {
      defaultAppliedRef.current = true;
      applyQuestTemplate(top);
    }
  }, [pickerDefaultMode, description, selectedQuestId, suggestedQuests]);

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          // Header is provided by the native stack (like Settings/Profile),
          // so we only need bottom safe-area room for the big Begin CTA.
          paddingTop: 12,
          // Extra breathing room so the pill button never hugs the home indicator.
          paddingBottom: 28 + (insets?.bottom ?? 0),
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={{ flex: 1 }}>
        {/* Search input - always at top for easy access */}
        <View style={styles.block}>
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
              placeholder="Search quests..."
              autoFocus={Platform.OS === "web"}
              onSubmitEditing={handleSubmitFromInput}
              returnKeyType="done"
            />
          </View>

          {/* Apple-search-style suggestion grid (5–9 buttons) */}
          <View style={styles.questGrid}>
            {!hasDirectNameMatch && description.trim() && (
              <TouchableOpacity
                style={styles.questGridItem}
                onPress={() => onCreateQuestDraft?.(description)}
              >
                <Text style={styles.questGridItemText}>＋ New</Text>
              </TouchableOpacity>
            )}
            {suggestedQuests.map((q) => {
              const isUserQuest = userQuests.some((uq) => uq.id === q.id);
              return (
                <TouchableOpacity
                  key={q.id}
                  style={[
                    styles.questGridItem,
                    selectedQuestId === q.id && styles.questGridItemActive,
                    isUserQuest && styles.questGridItemUser,
                  ]}
                  onPress={() => {
                    applyQuestTemplate(q);
                    // Dismiss keyboard after selecting a quest on mobile
                    if (Platform.OS !== "web") {
                      Keyboard.dismiss();
                    }
                  }}
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
                  <Text style={styles.questGridItemText} numberOfLines={2}>
                    {q.label}
                  </Text>
                  {isUserQuest && <Text style={styles.questGridBadge}>★</Text>}
                </TouchableOpacity>
              );
            })}
          {hasDirectNameMatch && (
            <TouchableOpacity
              style={styles.questGridItem}
              onPress={() => onCreateQuestDraft?.(description)}
            >
              <Text style={styles.questGridItemText}>＋ New</Text>
            </TouchableOpacity>
          )}
        </View>
        </View>

        {/* Chart - hidden when keyboard is visible on mobile */}
        {!isKeyboardVisible && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <QuestStatsPicker
              allocation={allocation}
              onAllocationChange={handleAllocationChange}
              duration={duration}
              size={chartSize}
              radarScale={1.21}
              ringRadiusScaleByValue={{ "1": 1.08, "2": 1.10 }}
            />
          </View>
        )}

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
      </View>

      {/* iOS-ish: big centered primary CTA anchored at bottom */}
      <View style={{ alignItems: "center", marginTop: 10, marginBottom: 14 }}>
        <Pressable
          onPress={start}
          style={({ pressed }) => [
            {
              width: "100%",
              maxWidth: 420,
              height: 56,
              borderRadius: 999,
              backgroundColor: pressed ? "#4338ca" : "#4f46e5",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              ...(Platform.OS === "web"
                ? { boxShadow: "0px 8px 18px rgba(79,70,229,0.35)" }
                : {
                    shadowColor: "#4f46e5",
                    shadowOpacity: 0.35,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 8,
                  }),
            },
            pressed && { transform: [{ scale: 0.99 }], opacity: 0.98 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Begin timer"
        >
          <Ionicons name="play" size={22} color="#f9fafb" />
          <Text style={{ color: "#f9fafb", fontSize: 16, fontWeight: "800" }}>
            Begin
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
