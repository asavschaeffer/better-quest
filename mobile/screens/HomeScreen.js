import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { StandStatsChart } from "../StandStatsChart";
import { Avatar3D } from "../Avatar3D";
import NotificationsSheet from "../components/NotificationsSheet";
import {
  getPlayerTitle,
  getUnlockedAccessories,
  getAvatarPose,
  playerStatsToChartValues,
} from "../core/stats";
import styles from "../../style";

const DEFAULT_QUOTES = [
  "The journey of a thousand miles begins with a single step.",
  "You don't have to be great to start, but you have to start to be great.",
  "Small daily improvements are the key to staggering long-term results.",
  "Discipline is choosing between what you want now and what you want most.",
  "The only way to do great work is to love what you do.",
];

export default function HomeScreen({
  avatar,
  levelInfo,
  fatigueOverlayStats,
  onOpenSettings,
  onOpenNotifications,
  inAppAnnouncementsEnabled = true,
  quotes = DEFAULT_QUOTES,
  announcements = [],
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationsAnchorTop, setNotificationsAnchorTop] = useState(null);

  // Pick a random quote on mount (or cycle daily)
  const [quoteIndex] = useState(() => {
    const today = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = ((hash << 5) - hash) + today.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % quotes.length;
  });

  const currentQuote = quotes[quoteIndex] || quotes[0];
  const playerTitle = getPlayerTitle(avatar.level);

  // Responsive sizing
  const stageWidth = Math.max(280, screenWidth - 32);
  const avatarSize = Math.min(240, stageWidth * 0.68);
  const stageHeight = Math.max(avatarSize + 60, Math.min(420, screenHeight * 0.45));
  const chartSize = Math.min(200, stageWidth * 0.38);

  useEffect(() => {
    if (!inAppAnnouncementsEnabled && isNotificationsOpen) {
      setIsNotificationsOpen(false);
      return;
    }
    if (!announcements.length && isNotificationsOpen) {
      setIsNotificationsOpen(false);
    }
  }, [announcements.length, inAppAnnouncementsEnabled, isNotificationsOpen]);

  function handleNotificationsPress() {
    if (!inAppAnnouncementsEnabled) return;
    if (announcements.length === 0) {
      return;
    }
    setIsNotificationsOpen((open) => !open);
    if (onOpenNotifications) {
      onOpenNotifications();
    }
  }

  // Avatar roaming animation
  const avatarX = useRef(new Animated.Value(0)).current;
  const avatarY = useRef(new Animated.Value(0)).current;
  const roamIntervalRef = useRef(null);
  const glanceIntervalRef = useRef(null);
  const [showQuoteBubble, setShowQuoteBubble] = useState(true);
  const [lookAtChart, setLookAtChart] = useState(false);
  const [bubbleOnRight, setBubbleOnRight] = useState(true);

  // Bubble position derived from avatar position with offset
  const bubbleOffsetX = bubbleOnRight ? avatarSize * 0.6 : -140;
  const bubbleOffsetY = -60; // Above the avatar

  // Roaming animation - only runs while Home is focused.
  // This prevents the avatar from "progressing" in the background while you're in Settings/Profile,
  // which can look like it snaps when you return.
  useFocusEffect(
    useCallback(() => {
      const maxX = Math.max(0, stageWidth - avatarSize);
      const maxY = Math.max(0, stageHeight - avatarSize);

      const glance = () => setLookAtChart(Math.random() > 0.6);
      const roam = () => {
        // Random position: stick to left/center with rare excursions to chart
        const goRight = Math.random() > 0.85; // 15% chance to venture toward chart
        const leftRange = maxX * 0.5;
        const rightStart = Math.min(maxX, maxX * 0.55);
        const targetX = goRight
          ? rightStart + Math.random() * Math.max(12, maxX - rightStart)
          : Math.random() * Math.max(20, leftRange);
        const targetY = 20 + Math.random() * Math.max(12, maxY - 40);

        // Show quote bubble when avatar is not too far right
        setShowQuoteBubble(!goRight);
        // Position bubble on the side with more space
        setBubbleOnRight(targetX < stageWidth * 0.4);
        // If we move toward the chart, glance at it
        if (goRight) setLookAtChart(true);

        const duration = 3000 + Math.random() * 2000;
        Animated.parallel([
          Animated.timing(avatarX, { toValue: targetX, duration, useNativeDriver: false }),
          Animated.timing(avatarY, { toValue: targetY, duration, useNativeDriver: false }),
        ]).start();
      };

      // Start loops
      glance();
      roam();
      glanceIntervalRef.current = setInterval(glance, 3500);
      roamIntervalRef.current = setInterval(roam, 5000 + Math.random() * 3000);

      return () => {
        if (glanceIntervalRef.current) clearInterval(glanceIntervalRef.current);
        if (roamIntervalRef.current) clearInterval(roamIntervalRef.current);
        glanceIntervalRef.current = null;
        roamIntervalRef.current = null;
        avatarX.stopAnimation();
        avatarY.stopAnimation();
      };
    }, [stageWidth, stageHeight, avatarSize, avatarX, avatarY]),
  );

  return (
    <View style={styles.homeContainer}>
      {/* Header Row: Username | Level + Title | Bell + Cog */}
      <View
        style={styles.homeHeader}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          // Place notifications panel below this header.
          setNotificationsAnchorTop(y + height + 6);
        }}
      >
        <Text style={styles.headerUsername}>{avatar.name}</Text>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLevel}>Lv {avatar.level}</Text>
          <Text style={styles.headerTitle}>{playerTitle}</Text>
        </View>
        <View style={styles.headerIcons}>
          {inAppAnnouncementsEnabled ? (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleNotificationsPress}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color="#e5e7eb" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color="#e5e7eb" />
          </TouchableOpacity>
        </View>
      </View>

      <NotificationsSheet
        visible={inAppAnnouncementsEnabled && isNotificationsOpen}
        announcements={announcements}
        onClose={() => setIsNotificationsOpen(false)}
        anchorTop={notificationsAnchorTop}
      />

      {/* Stage: Chart as background, Avatar roams in foreground */}
      <View style={[styles.stage, { height: stageHeight }]}>
        {/* Background: Stats Chart in top-right corner */}
        <View style={styles.chartBackground}>
          <StandStatsChart
            value={playerStatsToChartValues(avatar.standExp)}
            readOnly
            size={chartSize}
            showTotalExp={avatar.totalExp}
            hideOuterRing
            overlays={
              fatigueOverlayStats
                ? [
                    {
                      value: fatigueOverlayStats,
                      stroke: "rgba(251,191,36,0.7)",
                      fill: "rgba(251,191,36,0.16)",
                      dash: "4,3",
                      strokeWidth: 2,
                    },
                  ]
                : undefined
            }
          />
        </View>

        {/* Foreground: Roaming Avatar */}
        <Animated.View
          style={[
            styles.roamingAvatar,
            {
              left: avatarX,
              top: avatarY,
              width: avatarSize,
              height: avatarSize,
            },
          ]}
        >
          <Avatar3D
            size={avatarSize}
            accessories={getUnlockedAccessories(avatar.level)}
            lookAtChart={lookAtChart}
            pose={getAvatarPose(avatar.standExp)}
          />
        </Animated.View>

        {/* Quote Speech Bubble - follows avatar */}
        {showQuoteBubble && (
          <Animated.View
            style={[
              styles.quoteBubble,
              {
                left: Animated.add(avatarX, bubbleOffsetX),
                top: Animated.add(avatarY, bubbleOffsetY),
                maxWidth: 160,
              },
            ]}
          >
            <Text style={styles.quoteBubbleText} numberOfLines={4}>
              "{currentQuote}"
            </Text>
            <View
              style={[
                styles.quoteBubbleTail,
                bubbleOnRight
                  ? { left: -6, transform: [{ rotate: "-90deg" }] }
                  : { right: -6, left: "auto", transform: [{ rotate: "90deg" }] },
              ]}
            />
          </Animated.View>
        )}
      </View>

      {/* EXP Progress */}
      <View style={styles.expProgressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${levelInfo.ratio * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.expText}>
          {levelInfo.current} / {levelInfo.required} EXP to next level
        </Text>
      </View>
    </View>
  );
}