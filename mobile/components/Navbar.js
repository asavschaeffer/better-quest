import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../../style";

export function Navbar({ activeTab, onNavigate, onBigButtonPress }) {
  const tabs = [
    { key: "home", label: "Home", icon: "🏠" },
    { key: "library", label: "Library", icon: "📚" },
    { key: "history", label: "History", icon: "📜" },
    { key: "leaderboard", label: "Rank", icon: "🏆" },
  ];

  return (
    <View style={styles.navbar}>
      <TouchableOpacity
        style={[styles.navItem, activeTab === "home" && styles.navItemActive]}
        onPress={() => onNavigate("home")}
      >
        <Text style={styles.navIcon}>{tabs[0].icon}</Text>
        <Text style={[styles.navLabel, activeTab === "home" && styles.navLabelActive]}>
          {tabs[0].label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === "library" && styles.navItemActive]}
        onPress={() => onNavigate("library")}
      >
        <Text style={styles.navIcon}>{tabs[1].icon}</Text>
        <Text style={[styles.navLabel, activeTab === "library" && styles.navLabelActive]}>
          {tabs[1].label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navBigButton} onPress={onBigButtonPress}>
        <Text style={styles.navBigButtonIcon}>⚔️</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === "history" && styles.navItemActive]}
        onPress={() => onNavigate("history")}
      >
        <Text style={styles.navIcon}>{tabs[2].icon}</Text>
        <Text style={[styles.navLabel, activeTab === "history" && styles.navLabelActive]}>
          {tabs[2].label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, activeTab === "leaderboard" && styles.navItemActive]}
        onPress={() => onNavigate("leaderboard")}
      >
        <Text style={styles.navIcon}>{tabs[3].icon}</Text>
        <Text style={[styles.navLabel, activeTab === "leaderboard" && styles.navLabelActive]}>
          {tabs[3].label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default Navbar;