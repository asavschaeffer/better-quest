import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Platform, ScrollView } from "react-native";
import styles from "../../style";
import { StandStatsChart } from "../StandStatsChart";
import { BUILT_IN_QUEST_TEMPLATES, QUEST_CATEGORIES, questStatsToChartStats } from "../core/questStorage";
import { rankQuests } from "../core/quests";
import { STAT_KEYS } from "../core/models";

/**
 * Get subquests for a parent quest
 */
function getSubquestsForParent(parentId, allQuests) {
  return allQuests.filter(q => q.parentQuestId === parentId);
}

/**
 * Check if a quest is a parent (has subquests)
 */
function isParentQuest(questId, allQuests) {
  return allQuests.some(q => q.parentQuestId === questId);
}

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
  const [selectedSubquestId, setSelectedSubquestId] = useState(null);
  const [selectedQuestAction, setSelectedQuestAction] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [expandedParentQuests, setExpandedParentQuests] = useState({});
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

  // Rank all quests (including subquests for search)
  const rankedQuests = useMemo(
    () => rankQuests(allQuests, focusStats, description),
    [allQuests, focusStats, description]
  );

  // Filter to only show top-level quests (not subquests) in main list
  // Subquests will be shown nested under their parent
  const sortedQuests = useMemo(() => {
    const searchTerm = description.trim().toLowerCase();
    // If searching, show all matches including subquests
    if (searchTerm) {
      return rankedQuests;
    }
    // Otherwise, hide subquests (they'll show under their parent)
    return rankedQuests.filter(q => !q.parentQuestId);
  }, [rankedQuests, description]);

  // Group quests by category
  const questsByCategory = useMemo(() => {
    const groups = {};
    // Initialize all categories
    Object.keys(QUEST_CATEGORIES).forEach(cat => {
      groups[cat] = [];
    });
    // Assign quests to categories
    sortedQuests.forEach(quest => {
      const category = quest.category || "other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(quest);
    });
    return groups;
  }, [sortedQuests]);

  // Get sorted category keys (by order, then filter out empty ones unless searching)
  const sortedCategoryKeys = useMemo(() => {
    const isSearching = description.trim().length > 0;
    return Object.keys(QUEST_CATEGORIES)
      .filter(cat => isSearching || questsByCategory[cat]?.length > 0)
      .sort((a, b) => (QUEST_CATEGORIES[a]?.order || 99) - (QUEST_CATEGORIES[b]?.order || 99));
  }, [questsByCategory, description]);

  // Find which category contains the top-ranked quest
  const topQuestCategory = useMemo(() => {
    if (sortedQuests.length === 0) return null;
    return sortedQuests[0].category || "other";
  }, [sortedQuests]);

  // Toggle category collapse
  const toggleCategory = (category) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Toggle parent quest expansion (to show/hide subquests)
  const toggleParentExpansion = (questId) => {
    setExpandedParentQuests(prev => ({
      ...prev,
      [questId]: !prev[questId]
    }));
  };

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

  function applyQuestTemplate(template, isSubquest = false, parentQuest = null) {
    if (!template) return;
    setDescription(template.label);
    if (template.defaultDurationMinutes) {
      setDuration(template.defaultDurationMinutes);
    }
    // Store raw allocation (0-3 scale) - use baseStats with stats fallback
    const rawStats = {};
    const templateStats = template.baseStats || template.stats || {};
    STAT_KEYS.forEach(key => {
      rawStats[key] = templateStats[key] ?? 0;
    });
    setAllocation(rawStats);

    if (isSubquest && parentQuest) {
      // If selecting a subquest, track both parent and subquest
      setSelectedQuestId(parentQuest.id);
      setSelectedSubquestId(template.id);
    } else {
      setSelectedQuestId(template.id);
      setSelectedSubquestId(null);
    }

    setSelectedQuestAction(template.action || null);

    // Auto-expand parent when selecting it
    if (isParentQuest(template.id, allQuests)) {
      setExpandedParentQuests(prev => ({ ...prev, [template.id]: true }));
    }
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
        <ScrollView style={styles.questCategoryList} nestedScrollEnabled>
          {/* New quest button at top if no direct match */}
          {!hasDirectNameMatch && description.trim() && (
            <TouchableOpacity
              style={styles.questItem}
              onPress={() => onCreateQuestDraft?.(description)}
            >
              <Text style={styles.questItemLabel}>＋ Create "{description.trim()}"</Text>
            </TouchableOpacity>
          )}
          
          {/* Categorized quest sections */}
          {sortedCategoryKeys.map(categoryKey => {
            const category = QUEST_CATEGORIES[categoryKey];
            const quests = questsByCategory[categoryKey] || [];
            if (quests.length === 0) return null;
            
            // Auto-expand category containing top quest, collapse others by default
            const isCollapsed = collapsedCategories[categoryKey] ?? (categoryKey !== topQuestCategory);
            
            return (
              <View key={categoryKey} style={styles.questCategory}>
                <TouchableOpacity 
                  style={styles.questCategoryHeader}
                  onPress={() => toggleCategory(categoryKey)}
                >
                  <Text style={styles.questCategoryIcon}>{category.icon}</Text>
                  <Text style={styles.questCategoryLabel}>{category.label}</Text>
                  <Text style={styles.questCategoryCount}>({quests.length})</Text>
                  <Text style={styles.questCategoryChevron}>{isCollapsed ? "▶" : "▼"}</Text>
                </TouchableOpacity>
                
                {!isCollapsed && (
                  <View style={styles.questCategoryItems}>
                    {quests.map((q) => {
                      const isUserQuest = userQuests.some((uq) => uq.id === q.id);
                      const hasSubquests = isParentQuest(q.id, allQuests);
                      const isExpanded = expandedParentQuests[q.id];
                      const subquests = hasSubquests ? getSubquestsForParent(q.id, allQuests) : [];
                      const isSelected = selectedQuestId === q.id && !selectedSubquestId;
                      const hasSelectedSubquest = selectedQuestId === q.id && selectedSubquestId;

                      return (
                        <View key={q.id}>
                          <TouchableOpacity
                            style={[
                              styles.questItem,
                              isSelected && styles.questItemActive,
                              hasSelectedSubquest && styles.questItemParentActive,
                            ]}
                            onPress={() => {
                              if (hasSubquests) {
                                toggleParentExpansion(q.id);
                              }
                              applyQuestTemplate(q);
                            }}
                            onLongPress={
                              isUserQuest
                                ? () => {
                                    if (Platform.OS === "web") {
                                      if (window.confirm(`Delete "${q.label}"?`)) {
                                        onDeleteQuest?.(q.id);
                                        if (selectedQuestId === q.id) {
                                          setSelectedQuestId(null);
                                          setSelectedSubquestId(null);
                                          setSelectedQuestAction(null);
                                        }
                                      }
                                    } else {
                                      onDeleteQuest?.(q.id);
                                      if (selectedQuestId === q.id) {
                                        setSelectedQuestId(null);
                                        setSelectedSubquestId(null);
                                        setSelectedQuestAction(null);
                                      }
                                    }
                                  }
                                : undefined
                            }
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                              {hasSubquests && (
                                <Text style={styles.questItemExpander}>
                                  {isExpanded ? "▼" : "▶"}
                                </Text>
                              )}
                              <Text style={styles.questItemLabel}>{q.label}</Text>
                            </View>
                            {q.defaultDurationMinutes ? (
                              <Text style={styles.questItemMeta}>{q.defaultDurationMinutes}m</Text>
                            ) : null}
                          </TouchableOpacity>

                          {/* Subquests (nested under parent) */}
                          {hasSubquests && isExpanded && (
                            <View style={styles.subquestList}>
                              {subquests.map((sub) => {
                                const isSubSelected = selectedSubquestId === sub.id;
                                return (
                                  <TouchableOpacity
                                    key={sub.id}
                                    style={[
                                      styles.subquestItem,
                                      isSubSelected && styles.questItemActive,
                                    ]}
                                    onPress={() => applyQuestTemplate(sub, true, q)}
                                  >
                                    <Text style={styles.subquestItemLabel}>{sub.label}</Text>
                                    {sub.defaultDurationMinutes ? (
                                      <Text style={styles.questItemMeta}>{sub.defaultDurationMinutes}m</Text>
                                    ) : null}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
          
          {/* New quest button at bottom if there's a direct match */}
          {hasDirectNameMatch && (
            <TouchableOpacity
              style={[styles.questItem, { marginTop: 8 }]}
              onPress={() => onCreateQuestDraft?.(description)}
            >
              <Text style={styles.questItemLabel}>＋ New quest</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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
