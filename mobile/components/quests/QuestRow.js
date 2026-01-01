import React, { useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";

import styles from "../../../style";
import { formatStatBadges } from "../../core/stats";

function formatQuestBadges(stats) {
  const badges = formatStatBadges(stats, { mode: "allocation", maxParts: 3 });
  return badges || "No stats";
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

/**
 * QuestRow - reusable quest row (Library, Profile, etc.)
 *
 * Variants:
 * - full: icon + label + stats + author + chevron (default)
 * - compact: minimal meta line
 * - minimal: just label (for embeds)
 */
export function QuestRow({
  quest,
  variant = "full",
  isBuiltIn = false,
  isSaved = false,
  listContext = "my", // "my" | "discover"
  onOpen,
  onEdit,
  onDelete,
  onSave,
  onUnsave,
}) {
  const swipeableRef = useRef(null);

  const renderRightActions = useCallback(() => {
    if (variant === "minimal") return null;

    if (isBuiltIn) {
      const inMy = listContext === "my";
      return (
        <View style={localStyles.swipeActionsRight}>
          {inMy ? (
            <TouchableOpacity
              style={[localStyles.swipeAction, localStyles.swipeActionDelete]}
              onPress={() => {
                swipeableRef.current?.close();
                const label = quest?.label || "this quest";
                confirmDestructive({
                  title: "Remove Quest",
                  message: `Remove \"${label}\" from My Quests?`,
                  confirmText: "Remove",
                  onConfirm: () => onUnsave?.(quest?.id),
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
                  const label = quest?.label || "this quest";
                  confirmDestructive({
                    title: "Remove Quest",
                    message: `Remove \"${label}\" from My Quests?`,
                    confirmText: "Remove",
                    onConfirm: () => onUnsave?.(quest?.id),
                  });
                } else {
                  onSave?.(quest?.id);
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
            const label = quest?.label || "this quest";
            const message = `Delete \"${label}\"? This can't be undone.`;
            confirmDestructive({
              title: "Delete Quest",
              message,
              confirmText: "Delete",
              onConfirm: () => onDelete?.(quest?.id),
            });
          }}
        >
          <Ionicons name="trash" size={18} color="#fff" />
          <Text style={localStyles.swipeActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isBuiltIn, isSaved, listContext, onDelete, onEdit, onSave, onUnsave, quest, variant]);

  const author = quest?.authorName || (isBuiltIn ? "Better Quest" : "You");
  const builtInSuffix = isBuiltIn ? (isSaved ? " • Saved" : " • Template") : "";
  const meta =
    variant === "minimal"
      ? ""
      : variant === "compact"
        ? author
        : `${formatQuestBadges(quest?.stats)} • ${author}${builtInSuffix}`;

  const content = (
    <View style={localStyles.questRow}>
      <TouchableOpacity
        style={localStyles.questMainPress}
        onPress={() => onOpen?.(quest, { isBuiltIn, isSaved })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={quest?.label ? `Open ${quest.label}` : "Open quest"}
      >
        {variant !== "minimal" && (
          <View style={localStyles.questIconWrap}>
            <Ionicons
              name={quest?.icon || "help-circle-outline"}
              size={22}
              color={isBuiltIn ? "#6b7280" : "#a5b4fc"}
            />
          </View>
        )}

        <View style={localStyles.questInfo}>
          <Text style={localStyles.questLabel} numberOfLines={1}>
            {quest?.label || "Untitled quest"}
          </Text>
          {meta ? (
            <Text style={localStyles.questMeta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {variant !== "minimal" && (
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      )}
    </View>
  );

  if (variant === "minimal") return content;

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

const localStyles = {
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
  swipeActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
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
};

export default QuestRow;

