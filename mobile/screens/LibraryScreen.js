import React, { useMemo, useCallback, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Platform, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import styles from "../../style";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";
import { getQuestStatTotal, STAT_KEYS } from "../core/models";
import Chip from "../components/Chip";
import LibraryTabBar from "../components/LibraryTabBar";
import QuestDetailSheet from "../components/QuestDetailSheet";

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

function QuestRow({ quest, isBuiltIn, isSaved, onPress, onEdit, onDelete, onSave, onUnsave }) {
  const swipeableRef = React.useRef(null);

  const renderRightActions = useCallback(() => {
    if (isBuiltIn) return null;
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
            if (Platform.OS === "web") {
              // eslint-disable-next-line no-alert
              if (window.confirm(message)) onDelete?.(quest.id);
              return;
            }
            Alert.alert("Delete Quest", message, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => onDelete?.(quest.id) },
            ]);
          }}
        >
          <Ionicons name="trash" size={18} color="#fff" />
          <Text style={localStyles.swipeActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isBuiltIn, quest, onEdit, onDelete]);

  const content = (
    <TouchableOpacity
      style={localStyles.questRow}
      onPress={() => onPress?.(quest)}
      activeOpacity={0.7}
    >
      {/* Icon */}
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
          {formatStatRewards(quest.stats)} • {quest.authorName || (isBuiltIn ? "Better Quest" : "You")}
        </Text>
      </View>

      {/* Right: Save button for built-ins in Discover, or chevron */}
      {isBuiltIn ? (
        <TouchableOpacity
          style={[localStyles.saveBtn, isSaved && localStyles.saveBtnActive]}
          onPress={(e) => {
            e.stopPropagation?.();
            if (isSaved) {
              onUnsave?.(quest.id);
            } else {
              onSave?.(quest.id);
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={16}
            color={isSaved ? "#fbbf24" : "#a5b4fc"}
          />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      )}
    </TouchableOpacity>
  );

  // Built-in quests don't have swipe actions
  if (isBuiltIn) {
    return content;
  }

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
  onSelectQuest,
  onEditQuest,
  onDeleteQuest,
  onCreateQuest,
  onForkQuest,
  onSaveQuest,
  onUnsaveQuest,
  onStartQuest,
}) {
  const [query, setQuery] = useState("");
  const [selectedStat, setSelectedStat] = useState(null);
  const [activeTab, setActiveTab] = useState("my");
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const savedQuestIdsSet = useMemo(() => new Set(savedQuestIds), [savedQuestIds]);

  // Get saved built-in quests
  const savedBuiltIns = useMemo(() => {
    return BUILT_IN_QUEST_TEMPLATES.filter((q) => savedQuestIdsSet.has(q.id));
  }, [savedQuestIdsSet]);

  // Combine user quests and saved built-ins for "My Quests" tab
  const myQuests = useMemo(() => {
    const sorter = compareBySelectedStat(selectedStat);
    const combined = [...userQuests, ...savedBuiltIns];
    return combined
      .filter((q) => questMatchesQuery(q, query))
      .filter((q) => (selectedStat ? (q?.stats?.[selectedStat] ?? 0) > 0 : true))
      .sort(sorter);
  }, [userQuests, savedBuiltIns, query, selectedStat]);

  // All built-in templates for "Discover" tab
  const discoverQuests = useMemo(() => {
    const sorter = compareBySelectedStat(selectedStat);
    return BUILT_IN_QUEST_TEMPLATES
      .filter((q) => questMatchesQuery(q, query))
      .filter((q) => (selectedStat ? (q?.stats?.[selectedStat] ?? 0) > 0 : true))
      .sort(sorter);
  }, [query, selectedStat]);

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

  const handleQuestPress = useCallback((quest) => {
    setSelectedQuest(quest);
    setSheetVisible(true);
  }, []);

  const handleSheetClose = useCallback(() => {
    setSheetVisible(false);
    setSelectedQuest(null);
  }, []);

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
              ? "No saved quests yet.\nExplore Discover to find quests!"
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
          onPress={handleQuestPress}
          onEdit={onEditQuest}
          onDelete={onDeleteQuest}
          onSave={onSaveQuest}
          onUnsave={onUnsaveQuest}
        />
      );
    }
    return null;
  }, [activeTab, handleQuestPress, onEditQuest, onDeleteQuest, onSaveQuest, onUnsaveQuest]);

  // Determine if selected quest is built-in
  const selectedQuestIsBuiltIn = useMemo(() => {
    if (!selectedQuest) return false;
    return BUILT_IN_QUEST_TEMPLATES.some((q) => q.id === selectedQuest.id);
  }, [selectedQuest]);

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
          <Chip
            label="All"
            active={!selectedStat}
            onPress={() => setSelectedStat(null)}
          />
          {STAT_KEYS.map((k) => (
            <Chip
              key={k}
              label={k}
              active={selectedStat === k}
              onPress={() => setSelectedStat((prev) => (prev === k ? null : k))}
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

      {/* Quest Detail Sheet */}
      <QuestDetailSheet
        visible={sheetVisible}
        quest={selectedQuest}
        isBuiltIn={selectedQuestIsBuiltIn}
        isSaved={selectedQuest ? savedQuestIdsSet.has(selectedQuest.id) : false}
        onClose={handleSheetClose}
        onSave={onSaveQuest}
        onUnsave={onUnsaveQuest}
        onFork={handleFork}
        onEdit={handleEdit}
        onStart={handleStart}
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
