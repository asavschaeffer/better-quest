import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import { PanGestureHandler, State as GestureState } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../style";
import { STAT_KEYS } from "../core/models";

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
  return parts.join(" • ") || "No stats";
}

export function QuestDetailSheet({
  visible,
  quest,
  isBuiltIn,
  isSaved,
  onClose,
  onSave,
  onUnsave,
  onFork,
  onEdit,
  onStart,
}) {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(16, (insets?.bottom ?? 0) + 8);
  const sheetHeight = Math.min(380, screenH * 0.55);

  const translateY = useRef(new Animated.Value(sheetHeight + 24)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const [shown, setShown] = useState(!!visible);

  useEffect(() => {
    if (visible) {
      setShown(true);
      isClosingRef.current = false;
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => dragY.setValue(0));
      return;
    }

    if (!shown) return;
    Animated.timing(translateY, {
      toValue: sheetHeight + 24,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      dragY.setValue(0);
      setShown(false);
    });
  }, [visible, shown, sheetHeight, translateY, dragY]);

  const onGestureEvent = useMemo(() => {
    return Animated.event([{ nativeEvent: { translationY: dragY } }], { useNativeDriver: true });
  }, [dragY]);

  function closeWithAnimation() {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: sheetHeight + 24,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      dragY.setValue(0);
      setShown(false);
      isClosingRef.current = false;
      onClose?.();
    });
  }

  if (!shown || !quest) return null;

  return (
    <Modal
      visible={shown}
      transparent
      animationType="fade"
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : "overFullScreen"}
      onRequestClose={closeWithAnimation}
    >
      <Pressable style={styles.sheetBackdrop} onPress={closeWithAnimation} />
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={(e) => {
          const { state, translationY, velocityY } = e.nativeEvent;
          if (state === GestureState.END || state === GestureState.CANCELLED || state === GestureState.FAILED) {
            const dismiss = translationY > Math.max(50, sheetHeight * 0.14) || velocityY > 900;
            if (dismiss) {
              closeWithAnimation();
            } else {
              Animated.spring(dragY, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
            }
          }
        }}
      >
        <Animated.View
          style={[
            styles.sheetBottomContainer,
            { height: sheetHeight, paddingBottom: safeBottom },
            {
              transform: [
                { translateY },
                {
                  translateY: dragY.interpolate({
                    inputRange: [-sheetHeight, 0, sheetHeight],
                    outputRange: [0, 0, sheetHeight],
                    extrapolate: "clamp",
                  }),
                },
              ],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Quest Header */}
          <View style={styles.questSheetHeader}>
            <View style={styles.questSheetIconWrap}>
              <Ionicons
                name={quest.icon || "help-circle-outline"}
                size={28}
                color="#a5b4fc"
              />
            </View>
            <View style={styles.questSheetHeaderInfo}>
              <Text style={styles.questSheetTitle} numberOfLines={2}>
                {quest.label}
              </Text>
              <Text style={styles.questSheetAuthor}>
                {quest.authorName || (isBuiltIn ? "Better Quest" : "You")}
                {isBuiltIn && " • Built-in"}
              </Text>
            </View>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeWithAnimation}>
              <Ionicons name="close" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Description */}
          {quest.description ? (
            <Text style={styles.questSheetDescription} numberOfLines={3}>
              {quest.description}
            </Text>
          ) : null}

          {/* Stats & Duration */}
          <View style={styles.questSheetMeta}>
            <View style={styles.questSheetMetaItem}>
              <Ionicons name="stats-chart" size={16} color="#6b7280" />
              <Text style={styles.questSheetMetaText}>{formatStatRewards(quest.stats)}</Text>
            </View>
            <View style={styles.questSheetMetaItem}>
              <Ionicons name="time-outline" size={16} color="#6b7280" />
              <Text style={styles.questSheetMetaText}>
                {quest.defaultDurationMinutes || 30} min
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.questSheetActions}>
            {/* Save/Unsave for built-ins */}
            {isBuiltIn && !isSaved && (
              <TouchableOpacity
                style={styles.questSheetSecondaryBtn}
                onPress={() => {
                  onSave?.(quest.id);
                  closeWithAnimation();
                }}
              >
                <Ionicons name="bookmark-outline" size={18} color="#a5b4fc" />
                <Text style={styles.questSheetSecondaryBtnText}>Save</Text>
              </TouchableOpacity>
            )}
            {isBuiltIn && isSaved && (
              <TouchableOpacity
                style={styles.questSheetSecondaryBtn}
                onPress={() => {
                  onUnsave?.(quest.id);
                  closeWithAnimation();
                }}
              >
                <Ionicons name="bookmark" size={18} color="#fbbf24" />
                <Text style={styles.questSheetSecondaryBtnText}>Remove</Text>
              </TouchableOpacity>
            )}

            {/* Fork for built-ins */}
            {isBuiltIn && (
              <TouchableOpacity
                style={styles.questSheetSecondaryBtn}
                onPress={() => {
                  onFork?.(quest);
                  closeWithAnimation();
                }}
              >
                <Ionicons name="shuffle-outline" size={18} color="#a5b4fc" />
                <Text style={styles.questSheetSecondaryBtnText}>Fork</Text>
              </TouchableOpacity>
            )}

            {/* Edit for user quests */}
            {!isBuiltIn && (
              <TouchableOpacity
                style={styles.questSheetSecondaryBtn}
                onPress={() => {
                  onEdit?.(quest);
                  closeWithAnimation();
                }}
              >
                <Ionicons name="pencil" size={18} color="#a5b4fc" />
                <Text style={styles.questSheetSecondaryBtnText}>Edit</Text>
              </TouchableOpacity>
            )}

            {/* Start - primary action */}
            <TouchableOpacity
              style={styles.questSheetPrimaryBtn}
              onPress={() => {
                onStart?.(quest);
                closeWithAnimation();
              }}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.questSheetPrimaryBtnText}>Start</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </PanGestureHandler>
    </Modal>
  );
}

export default QuestDetailSheet;
