import React, { useMemo, useCallback, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Platform, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import styles from "../../style";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";
import { getQuestStatTotal, STAT_KEYS } from "../core/models";
import Chip from "../components/Chip";
import LibraryTabBar from "../components/LibraryTabBar";

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

// Format stat rewards as a compact string: "INT 3 • SPI 2"
function formatStatRewards(stats) {
  if (!stats) return "";
  const parts = [];
  STAT_KEYS.forEach((key) => {
    const val = stats[key];
    if (typeof val === "number" && val > 0) {
      parts.push(`${key} ${val}`);
    }
  });
  return parts.slice(0, 3).join(" • ") || "No stats";
}

function confirmDestructive({ title, message, confirmText = "Delete", onConfirm }) {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    if (window.confirm(message)) onConfirm?.();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmText, style: "destructive", onPress: () => onConfirm?.() },
  ]);
}

function QuestRow({
  quest,
  isBuiltIn,
  isSaved,
  listContext, // "my" | "discover"
  onOpen,
  onEdit,
  onDelete,
  onSave,
  onUnsave,
}) {
  const swipeableRef = React.useRef(null);

  const renderRightActions = useCallback(() => {
    if (isBuiltIn) {
      const inMy = listContext === "my";
      return (
        <View style={localStyles.swipeActionsRight}>
          {inMy ? (
            <TouchableOpacity
              style={[localStyles.swipeAction, localStyles.swipeActionDelete]}
              onPress={() => {
                swipeableRef.current?.close();
                const label = quest.label || "this quest";
                confirmDestructive({
                  title: "Remove Quest",
                  message: `Remove "${label}" from My Quests?`,
                  confirmText: "Remove",
                  onConfirm: () => onUnsave?.(quest.id),
                });
              }}
            >
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={localStyles.swipeActionText}>Remove</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[localStyles.swipeAction, localStyles.swipeActionBookmark]}
              onPress={() => {
                swipeableRef.current?.close();
                if (isSaved) {
                  const label = quest.label || "this quest";
                  confirmDestructive({
                    title: "Remove Quest",
                    message: `Remove "${label}" from My Quests?`,
                    confirmText: "Remove",
                    onConfirm: () => onUnsave?.(quest.id),
                  });
                } else {
                  onSave?.(quest.id);
                }
              }}
            >
              <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={18} color="#fff" />
              <Text style={localStyles.swipeActionText}>{isSaved ? "Remove" : "Save"}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[localStyles.swipeAction, localStyles.swipeActionFork]}
            onPress={() => {
              swipeableRef.current?.close();
              // Fork behavior is handled upstream (opens editor draft, only saves on Save).
              onEdit?.(quest);
            }}
          >
            <Ionicons name="shuffle" size={18} color="#fff" />
            <Text style={localStyles.swipeActionText}>Fork</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={localStyles.swipeActionsRight}>
        <TouchableOpacity
          style={[localStyles.swipeAction, localStyles.swipeActionEdit]}
          onPress={() => {
            swipeableRef.current?.close();
            onEdit?.(quest);
          }}
        >
          <Ionicons name="pencil" size={18} color="#fff" />
          <Text style={localStyles.swipeActionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[localStyles.swipeAction, localStyles.swipeActionDelete]}
          onPress={() => {
            swipeableRef.current?.close();
            const label = quest.label || "this quest";
            const message = `Delete "${label}"? This can't be undone.`;
            confirmDestructive({
              title: "Delete Quest",
              message,
              confirmText: "Delete",
              onConfirm: () => onDelete?.(quest.id),
            });
          }}
        >
          <Ionicons name="trash" size={18} color="#fff" />
          <Text style={localStyles.swipeActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isBuiltIn, listContext, isSaved, quest, onEdit, onDelete, onSave, onUnsave]);

  const author = quest.authorName || (isBuiltIn ? "Better Quest" : "You");
  const builtInSuffix = isBuiltIn ? (isSaved ? " • Saved" : " • Template") : "";

  const content = (
    <View style={localStyles.questRow}>
      {/* Icon */}
      <TouchableOpacity
        style={localStyles.questMainPress}
        onPress={() => onOpen?.(quest, { isBuiltIn, isSaved })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Open ${quest.label}`}
      >
        <View style={localStyles.questIconWrap}>
          <Ionicons
            name={quest.icon || "help-circle-outline"}
            size={22}
            color={isBuiltIn ? "#6b7280" : "#a5b4fc"}
          />
        </View>

        {/* Info */}
        <View style={localStyles.questInfo}>
          <Text style={localStyles.questLabel} numberOfLines={1}>
            {quest.label}
          </Text>
          <Text style={localStyles.questMeta} numberOfLines={1}>
            {formatStatRewards(quest.stats)} • {author}
            {builtInSuffix}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Right: Save button for built-ins in Discover, or chevron */}
      <Ionicons name="chevron-forward" size={18} color="#64748b" />
    </View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {content}
    </Swipeable>
  );
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
      <View style={localStyles.controls}>
        <View style={styles.inputRow}>
          <Ionicons name="search" size={18} color="#64748b" />
          <TextInput
            style={[styles.input, styles.inputGrow]}
            value={query}
            onChangeText={setQuery}
            placeholder={activeTab === "my" ? "Search my quests..." : "Search templates..."}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
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
  controls: {
    marginTop: 4,
  },
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
  questRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  questMainPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  questIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  questInfo: {
    flex: 1,
    marginRight: 8,
  },
  questLabel: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  questMeta: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnActive: {
    backgroundColor: "#78350f",
  },
  swipeActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  swipeAction: {
    width: 70,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeActionEdit: {
    backgroundColor: "#4f46e5",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  swipeActionBookmark: {
    backgroundColor: "#a16207",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  swipeActionFork: {
    backgroundColor: "#334155",
  },
  swipeActionDelete: {
    backgroundColor: "#dc2626",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  swipeActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
