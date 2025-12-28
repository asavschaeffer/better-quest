import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import styles from "../../style";

/**
 * Two-segment tab bar for Library screen ("My Quests" / "Discover").
 */
export default function LibraryTabBar({ activeTab, onTabChange }) {
  return (
    <View style={styles.libraryTabBar}>
      <TouchableOpacity
        style={[styles.libraryTab, activeTab === "my" && styles.libraryTabActive]}
        onPress={() => onTabChange("my")}
      >
        <Text
          style={[styles.libraryTabText, activeTab === "my" && styles.libraryTabTextActive]}
        >
          My Quests
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.libraryTab, activeTab === "discover" && styles.libraryTabActive]}
        onPress={() => onTabChange("discover")}
      >
        <Text
          style={[styles.libraryTabText, activeTab === "discover" && styles.libraryTabTextActive]}
        >
          Discover
        </Text>
      </TouchableOpacity>
    </View>
  );
}
