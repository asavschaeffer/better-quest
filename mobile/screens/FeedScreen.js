import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../style";
import { FeedList } from "../components/feed";

const SCOPES = [
  { id: "you", label: "You" },
  { id: "friends", label: "Friends" },
  { id: "all", label: "All" },
];

function ScopeChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function PlaceholderScope({ scope }) {
  const isFriends = scope === "friends";
  
  return (
    <View style={localStyles.placeholder}>
      <Ionicons
        name={isFriends ? "people-outline" : "globe-outline"}
        size={48}
        color="#4b5563"
      />
      <Text style={localStyles.placeholderTitle}>
        {isFriends ? "Friends" : "Everyone"}
      </Text>
      <Text style={localStyles.placeholderDesc}>
        {isFriends
          ? "See what the people you follow are working on.\nFollow friends to fill this feed."
          : "Discover what adventurers around the world are doing.\nGlobal activity coming soon."}
      </Text>
      <Text style={localStyles.placeholderHint}>Coming soon</Text>
    </View>
  );
}

/**
 * FeedScreen - Unified activity feed with scope selector (You/Friends/All)
 *
 * Uses the shared FeedList primitive for session rendering.
 * - scope="you": Shows user's own sessions via FeedList
 * - scope="friends": Placeholder (coming soon)
 * - scope="all": Placeholder (coming soon)
 */
export default function FeedScreen({ sessions = [] }) {
  const [selectedScope, setSelectedScope] = useState("you");

  return (
    <View style={styles.screenContainer}>
      {/* Header with title and scope selector */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Feed</Text>
        <View style={localStyles.scopeRow}>
          {SCOPES.map((scope) => (
            <ScopeChip
              key={scope.id}
              label={scope.label}
              active={selectedScope === scope.id}
              onPress={() => setSelectedScope(scope.id)}
            />
          ))}
        </View>
      </View>

      {/* Scope content - now using shared FeedList primitive */}
      {selectedScope === "you" ? (
        <FeedList
          sessions={sessions}
          emptyText="No quests yet. Start your journey!"
          variant="feed"
        />
      ) : (
        <PlaceholderScope scope={selectedScope} />
      )}
    </View>
  );
}

const localStyles = {
  scopeRow: {
    flexDirection: "row",
    gap: 8,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  placeholderTitle: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderDesc: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  placeholderHint: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 16,
    fontStyle: "italic",
  },
};
