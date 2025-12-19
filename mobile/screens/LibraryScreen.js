import React, { useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import styles from "../../style";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";
import { getQuestStatTotal, STAT_KEYS } from "../core/models";

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

function QuestRow({ quest, isBuiltIn, onPress, onEdit, onDelete }) {
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

      {/* Right: Badge or Chevron */}
      {isBuiltIn ? (
        <Text style={localStyles.builtInBadge}>Built-in</Text>
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
  onSelectQuest,
  onEditQuest,
  onDeleteQuest,
  onCreateQuest,
}) {
  // Combine user quests and built-in templates with section markers
  const sections = useMemo(() => {
    const data = [];

    // User quests section
    if (userQuests.length > 0) {
      data.push({ type: "header", title: "Your Quests", key: "header-user" });
      userQuests.forEach((quest) => {
        data.push({ type: "quest", quest, isBuiltIn: false, key: quest.id });
      });
    } else {
      data.push({ type: "header", title: "Your Quests", key: "header-user" });
      data.push({ type: "empty", key: "empty-user" });
    }

    // Built-in templates section
    data.push({ type: "header", title: "Built-in Templates", key: "header-builtin" });
    BUILT_IN_QUEST_TEMPLATES.forEach((quest) => {
      data.push({ type: "quest", quest, isBuiltIn: true, key: `builtin-${quest.id}` });
    });

    return data;
  }, [userQuests]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === "header") {
      return <Text style={localStyles.sectionHeader}>{item.title}</Text>;
    }
    if (item.type === "empty") {
      return (
        <Text style={localStyles.emptyText}>
          No custom quests yet. Create one!
        </Text>
      );
    }
    if (item.type === "quest") {
      return (
        <QuestRow
          quest={item.quest}
          isBuiltIn={item.isBuiltIn}
          onPress={onSelectQuest}
          onEdit={onEditQuest}
          onDelete={onDeleteQuest}
        />
      );
    }
    return null;
  }, [onSelectQuest, onEditQuest, onDeleteQuest]);

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

      <FlatList
        data={sections}
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
  },
  sectionHeader: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
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
  builtInBadge: {
    color: "#6b7280",
    fontSize: 11,
    backgroundColor: "#1f2937",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
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
