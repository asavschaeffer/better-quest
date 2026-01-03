import React, { useMemo, useCallback, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../style";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";
import { getQuestStatTotal, STAT_KEYS } from "../core/models";
import Chip from "../components/Chip";
import LibraryTabBar from "../components/LibraryTabBar";
import QuestRow from "../components/quests/QuestRow";

function questMatchesQuery(quest, query) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return true;
  const searchable = [
    quest?.label,
    quest?.description,
    ...(Array.isArray(quest?.keywords) ? quest.keywords : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return searchable.includes(q);
}

function compareBySelectedStat(selectedStat) {
  if (!selectedStat) {
    return (a, b) => (a?.label || "").localeCompare(b?.label || "");
  }

  return (a, b) => {
    const aVal = a?.stats?.[selectedStat] ?? 0;
    const bVal = b?.stats?.[selectedStat] ?? 0;
    if (bVal !== aVal) return bVal - aVal;

    const aTotal = getQuestStatTotal(a?.stats);
    const bTotal = getQuestStatTotal(b?.stats);
    if (bTotal !== aTotal) return bTotal - aTotal;

    return (a?.label || "").localeCompare(b?.label || "");
  };
}

function compareBySelectedStats(selectedStatsSet) {
  const active =
    selectedStatsSet && typeof selectedStatsSet?.has === "function" ? selectedStatsSet : null;
  const activeKeys = active ? STAT_KEYS.filter((k) => active.has(k)) : [];

  // If all stats are active (or none are active), behave like "no sorting preference".
  const treatAsNoPref =
    !activeKeys.length || activeKeys.length === STAT_KEYS.length;

  if (treatAsNoPref) return compareBySelectedStat(null);

  // Sort by sum of selected stats, then total, then name.
  return (a, b) => {
    const aSum = activeKeys.reduce((acc, k) => acc + (a?.stats?.[k] ?? 0), 0);
    const bSum = activeKeys.reduce((acc, k) => acc + (b?.stats?.[k] ?? 0), 0);
    if (bSum !== aSum) return bSum - aSum;

    const aTotal = getQuestStatTotal(a?.stats);
    const bTotal = getQuestStatTotal(b?.stats);
    if (bTotal !== aTotal) return bTotal - aTotal;

    return (a?.label || "").localeCompare(b?.label || "");
  };
}

export default function LibraryScreen({
  userQuests = [],
  savedQuestIds = [],
  onOpenQuestInfo,
  onEditQuest,
  onDeleteQuest,
  onCreateQuest,
  onForkQuest,
  onSaveQuest,
  onUnsaveQuest,
  onStartQuest,
  onOpenStatInfo,
}) {
  const [query, setQuery] = useState("");
  const [selectedStats, setSelectedStats] = useState(() => new Set(STAT_KEYS));
  const [activeTab, setActiveTab] = useState("my");

  const savedQuestIdsSet = useMemo(() => new Set(savedQuestIds), [savedQuestIds]);

  // Get saved built-in quests
  const savedBuiltIns = useMemo(() => {
    return BUILT_IN_QUEST_TEMPLATES.filter((q) => savedQuestIdsSet.has(q.id));
  }, [savedQuestIdsSet]);

  // Combine user quests and saved built-ins for "My Quests" tab
  const myQuests = useMemo(() => {
    const sorter = compareBySelectedStats(selectedStats);
    const combined = [...userQuests, ...savedBuiltIns];
    const activeKeys = STAT_KEYS.filter((k) => selectedStats.has(k));
    const treatAsAll = activeKeys.length === 0 || activeKeys.length === STAT_KEYS.length;
    return combined
      .filter((q) => questMatchesQuery(q, query))
      .filter((q) => {
        if (treatAsAll) return true;
        return activeKeys.some((k) => (q?.stats?.[k] ?? 0) > 0);
      })
      .sort(sorter);
  }, [userQuests, savedBuiltIns, query, selectedStats]);

  // All built-in templates for "Discover" tab
  const discoverQuests = useMemo(() => {
    const sorter = compareBySelectedStats(selectedStats);
    const activeKeys = STAT_KEYS.filter((k) => selectedStats.has(k));
    const treatAsAll = activeKeys.length === 0 || activeKeys.length === STAT_KEYS.length;
    return BUILT_IN_QUEST_TEMPLATES
      .filter((q) => questMatchesQuery(q, query))
      .filter((q) => {
        if (treatAsAll) return true;
        return activeKeys.some((k) => (q?.stats?.[k] ?? 0) > 0);
      })
      .sort(sorter);
  }, [query, selectedStats]);

  // Build flat list data based on active tab
  const listData = useMemo(() => {
    if (activeTab === "my") {
      if (myQuests.length === 0) {
        return [{ type: "empty", key: "empty-my" }];
      }
      return myQuests.map((quest) => {
        const isBuiltIn = savedQuestIdsSet.has(quest.id);
        return {
          type: "quest",
          quest,
          isBuiltIn,
          isSaved: isBuiltIn,
          key: quest.id,
        };
      });
    }

    // Discover tab
    return discoverQuests.map((quest) => ({
      type: "quest",
      quest,
      isBuiltIn: true,
      isSaved: savedQuestIdsSet.has(quest.id),
      key: `discover-${quest.id}`,
    }));
  }, [activeTab, myQuests, discoverQuests, savedQuestIdsSet]);

  const handleQuestOpen = useCallback(
    (quest, meta) => {
      if (!quest) return;
      onOpenQuestInfo?.(quest, meta?.isBuiltIn ?? false);
    },
    [onOpenQuestInfo],
  );

  const handleStart = useCallback((quest) => {
    onStartQuest?.(quest);
  }, [onStartQuest]);

  const handleFork = useCallback((quest) => {
    onForkQuest?.(quest);
  }, [onForkQuest]);

  const handleEdit = useCallback((quest) => {
    onEditQuest?.(quest);
  }, [onEditQuest]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === "empty") {
      return (
        <View style={localStyles.emptyContainer}>
          <Ionicons name="library-outline" size={48} color="#374151" />
          <Text style={localStyles.emptyText}>
            {activeTab === "my"
              ? "No quests yet.\nCreate one (+) or explore Discover."
              : "No matching quests found."}
          </Text>
        </View>
      );
    }
    if (item.type === "quest") {
      return (
        <QuestRow
          quest={item.quest}
          isBuiltIn={item.isBuiltIn}
          isSaved={item.isSaved}
          listContext={activeTab === "my" ? "my" : "discover"}
          onOpen={handleQuestOpen}
          onEdit={item.isBuiltIn ? handleFork : onEditQuest}
          onDelete={onDeleteQuest}
          onSave={onSaveQuest}
          onUnsave={onUnsaveQuest}
        />
      );
    }
    return null;
  }, [activeTab, handleQuestOpen, onEditQuest, onDeleteQuest, onSaveQuest, onUnsaveQuest]);

  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Quest Library</Text>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={onCreateQuest}
          accessibilityRole="button"
          accessibilityLabel="New quest"
        >
          <Ionicons name="add-circle" size={28} color="#a5b4fc" />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <LibraryTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Controls */}
      {/* Match History/Rank control bar styling (same padding + divider) */}
      <View style={[styles.exportControls, { flexDirection: "column", alignItems: "stretch", gap: 8 }]}>
        <View style={[styles.inputRow, { marginTop: 0 }]}>
          <Ionicons name="search" size={18} color="#64748b" />
          <TextInput
            style={[styles.input, styles.inputGrow]}
            value={query}
            onChangeText={setQuery}
            placeholder={activeTab === "my" ? "Search my quests..." : "Search templates..."}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
          />
        </View>

        <View style={styles.rowWrap}>
          {STAT_KEYS.map((k) => (
            <Chip
              key={k}
              label={k}
              active={selectedStats.has(k)}
              onPress={() => {
                setSelectedStats((prev) => {
                  const next = new Set(prev);
                  if (next.has(k)) next.delete(k);
                  else next.add(k);
                  // If user turned everything off, snap back to "all on" so there's always a filter state.
                  if (next.size === 0) return new Set(STAT_KEYS);
                  return next;
                });
              }}
              onLongPress={() => {
                onOpenStatInfo?.(k);
              }}
              accessibilityHint="Tap to filter. Long-press for meaning."
            />
          ))}
        </View>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={localStyles.listContent}
        showsVerticalScrollIndicator={false}
      />

    </View>
  );
}

const localStyles = StyleSheet.create({
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  // Quest row styles moved into `mobile/components/quests/QuestRow.js`
});
