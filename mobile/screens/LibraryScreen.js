import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import styles from "../../style";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";
import { getQuestStatTotal } from "../core/models";

export default function LibraryScreen({ userQuests = [], onSelectQuest, onCreateQuest }) {
  const allQuests = useMemo(() => {
    return [...userQuests, ...BUILT_IN_QUEST_TEMPLATES];
  }, [userQuests]);

  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Quest Library</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onCreateQuest}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.questLibraryList}>
        <Text style={styles.sectionLabel}>Your Quests</Text>
        {userQuests.length === 0 ? (
          <Text style={styles.emptyText}>No custom quests yet. Create one!</Text>
        ) : (
          userQuests.map((quest) => (
            <TouchableOpacity
              key={quest.id}
              style={styles.libraryQuestItem}
              onPress={() => onSelectQuest(quest)}
            >
              <View style={styles.libraryQuestInfo}>
                <Text style={styles.libraryQuestLabel}>{quest.label}</Text>
                <Text style={styles.libraryQuestMeta}>
                  {quest.defaultDurationMinutes}m • {getQuestStatTotal(quest.stats)} pts
                </Text>
              </View>
              <Text style={styles.libraryQuestArrow}>→</Text>
            </TouchableOpacity>
          ))
        )}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Built-in Templates</Text>
        {BUILT_IN_QUEST_TEMPLATES.map((quest) => (
          <View key={quest.id} style={styles.libraryQuestItem}>
            <View style={styles.libraryQuestInfo}>
              <Text style={styles.libraryQuestLabel}>{quest.label}</Text>
              <Text style={styles.libraryQuestMeta}>
                {quest.defaultDurationMinutes}m • {getQuestStatTotal(quest.stats)} pts
              </Text>
            </View>
            <Text style={styles.libraryQuestBadge}>Built-in</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}