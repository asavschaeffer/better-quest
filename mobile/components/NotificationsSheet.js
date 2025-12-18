import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import { PanGestureHandler, State as GestureState } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styles from "../../style";

export function NotificationsSheet({ visible, announcements = [], onClose, anchorTop = null }) {
  const hasAnnouncements = announcements.length > 0;
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(8, (insets?.top ?? 0) + 6);
  // We render ONE continuous sheet that starts at the true top (top: 0).
  // `topOffset` is used as internal padding so the content starts below the safe-area / desired anchor.
  const topOffset =
    typeof anchorTop === "number" && Number.isFinite(anchorTop) ? Math.max(safeTop, anchorTop) : safeTop;
  const maxHeight = Math.max(220, Math.round(screenH * 0.65));
  const headerH = 44;
  const footerH = 22; // bottom grabber + spacing
  const [listH, setListH] = useState(0);
  const baseH = headerH + footerH + (hasAnnouncements ? Math.min(340, listH) : 52);
  const maxBodyHeight = Math.max(140, maxHeight - topOffset);
  const sheetBodyHeight = Math.min(maxBodyHeight, Math.max(140, baseH));
  const sheetHeight = sheetBodyHeight + topOffset;

  // translateY: 0 = shown, -sheetHeight = hidden (above the screen)
  const translateY = useRef(new Animated.Value(-(sheetHeight + 24))).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isDraggingRef = useRef(false);
  const isClosingRef = useRef(false);
  const [shown, setShown] = useState(!!visible);

  useEffect(() => {
    // keep Animated.Value in sync if height changes
    translateY.setValue(visible ? 0 : -(sheetHeight + 24));
    dragY.setValue(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetHeight, topOffset]);

  useEffect(() => {
    if (visible) {
      setShown(true);
      isClosingRef.current = false;
      // animate in
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => dragY.setValue(0));
      return;
    }

    if (!shown) return;
    // animate out, then unmount
    Animated.timing(translateY, {
      toValue: -(sheetHeight + 24),
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      dragY.setValue(0);
      setShown(false);
    });
  }, [visible, shown, sheetHeight, topOffset, translateY, dragY]);

  const onGestureEvent = useMemo(() => {
    return Animated.event([{ nativeEvent: { translationY: dragY } }], { useNativeDriver: true });
  }, [dragY]);

  function closeWithAnimation() {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: -(sheetHeight + 24),
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      dragY.setValue(0);
      setShown(false);
      isClosingRef.current = false;
      onClose?.();
    });
  }

  if (!shown) return null;

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
          if (state === GestureState.BEGAN) {
            isDraggingRef.current = true;
            return;
          }
          if (state === GestureState.END || state === GestureState.CANCELLED || state === GestureState.FAILED) {
            isDraggingRef.current = false;
            // If user swiped up enough or fast enough, dismiss.
            const dismiss = translationY < -Math.max(50, sheetHeight * 0.14) || velocityY < -900;
            if (dismiss) {
              closeWithAnimation();
            } else {
              // snap back
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
            styles.sheetTopContainer,
            { top: 0, maxHeight, height: sheetHeight, paddingTop: topOffset + 10 },
            {
              transform: [
                { translateY },
                {
                  translateY: dragY.interpolate({
                    inputRange: [-sheetHeight, 0, sheetHeight],
                    outputRange: [-sheetHeight, 0, 0],
                    extrapolate: "clamp",
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Notifications</Text>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeWithAnimation}>
              <Text style={styles.sheetCloseIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View>
            {!hasAnnouncements ? (
              <Text style={styles.sheetEmpty}>No notifications</Text>
            ) : (
              <ScrollView
                style={styles.sheetList}
                onContentSizeChange={(_, h) => {
                  if (Math.abs(h - listH) > 2) setListH(h);
                }}
              >
                {announcements.map((a) => (
                  <View key={a.id} style={styles.announcementCard}>
                    <Text style={styles.announcementTitle}>{a.title}</Text>
                    <Text style={styles.announcementBody}>{a.body}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            {/* Bottom grabber (like Notification Center's affordance) */}
            <View style={styles.sheetHandleBottom} />
          </View>
        </Animated.View>
      </PanGestureHandler>
    </Modal>
  );
}

export default NotificationsSheet;


