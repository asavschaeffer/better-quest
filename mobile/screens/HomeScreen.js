import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  useWindowDimensions,
} from "react-native";
import { StandStatsChart } from "../StandStatsChart";
import { Avatar3D } from "../Avatar3D";
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
  quotes = DEFAULT_QUOTES,
  announcements = [],
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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
    if (!announcements.length && isNotificationsOpen) {
      setIsNotificationsOpen(false);
    }
  }, [announcements.length, isNotificationsOpen]);

  function handleNotificationsPress() {
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
  const [showQuoteBubble, setShowQuoteBubble] = useState(true);
  const [lookAtChart, setLookAtChart] = useState(false);
  const [bubbleOnRight, setBubbleOnRight] = useState(true);

  // Bubble position derived from avatar position with offset
  const bubbleOffsetX = bubbleOnRight ? avatarSize * 0.6 : -140;
  const bubbleOffsetY = -60; // Above the avatar

  // Roaming animation - avatar wanders around
  // Occasionally glance at the chart
  useEffect(() => {
    const glance = () => {
      setLookAtChart(Math.random() > 0.6);
    };
    glance();
    const interval = setInterval(glance, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const maxX = Math.max(0, stageWidth - avatarSize);
    const maxY = Math.max(0, stageHeight - avatarSize);

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
        Animated.timing(avatarX, {
          toValue: targetX,
          duration,
          useNativeDriver: false,
        }),
        Animated.timing(avatarY, {
          toValue: targetY,
          duration,
          useNativeDriver: false,
        }),
      ]).start();
    };

    roam();
    const interval = setInterval(roam, 5000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [screenWidth, stageWidth, stageHeight, avatarSize]);

  return (
    <View style={styles.homeContainer}>
      {/* Header Row: Username | Level + Title | Bell + Cog */}
      <View style={styles.homeHeader}>
        <Text style={styles.headerUsername}>{avatar.name}</Text>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLevel}>Lv {avatar.level}</Text>
          <Text style={styles.headerTitle}>{playerTitle}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleNotificationsPress}
          >
            <Text style={styles.headerIcon}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onOpenSettings}
          >
            <Text style={styles.headerIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isNotificationsOpen && announcements.length > 0 && (
        <View style={styles.notificationDropdownContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.notificationBackdrop}
            activeOpacity={1}
            onPress={() => setIsNotificationsOpen(false)}
          />
          <View style={styles.notificationDropdown}>
            <View style={styles.notificationDropdownHeader}>
              <Text style={styles.notificationDropdownTitle}>Notifications</Text>
              <TouchableOpacity
                style={styles.notificationCloseBtn}
                onPress={() => setIsNotificationsOpen(false)}
              >
                <Text style={styles.notificationCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.notificationList}>
              {announcements.map((a) => (
                <View key={a.id} style={styles.announcementCard}>
                  <Text style={styles.announcementTitle}>{a.title}</Text>
                  <Text style={styles.announcementBody}>{a.body}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

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