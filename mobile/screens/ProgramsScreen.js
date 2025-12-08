import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import styles from "../../style";
import {
  STARTER_KITS,
  calculateProgramProgress,
  getTodaysSuggestedQuests,
} from "../core/starterKits";
import { BUILT_IN_QUEST_TEMPLATES } from "../core/questStorage";

function ProgramCard({ kit, isActive, progress, onStart, onView }) {
  const progressPercent = progress ? Math.round(progress.progress * 100) : 0;
  
  return (
    <TouchableOpacity 
      style={[styles.programCard, isActive && styles.programCardActive]}
      onPress={isActive ? onView : onStart}
    >
      <View style={styles.programCardHeader}>
        <Text style={styles.programCardIcon}>{kit.icon}</Text>
        <View style={styles.programCardTitleArea}>
          <Text style={styles.programCardName}>{kit.name}</Text>
          <Text style={styles.programCardDifficulty}>{kit.difficulty} • {kit.durationDays} days</Text>
        </View>
        {isActive && (
          <View style={styles.programCardBadge}>
            <Text style={styles.programCardBadgeText}>Active</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.programCardDesc}>{kit.description}</Text>
      
      <View style={styles.programCardQuests}>
        {kit.quests.slice(0, 4).map((questId, i) => (
          <View key={questId} style={styles.programCardQuestChip}>
            <Text style={styles.programCardQuestText}>{questId}</Text>
          </View>
        ))}
        {kit.quests.length > 4 && (
          <Text style={styles.programCardMoreQuests}>+{kit.quests.length - 4} more</Text>
        )}
      </View>
      
      {isActive && progress && (
        <View style={styles.programCardProgress}>
          <View style={styles.programCardProgressBar}>
            <View style={[styles.programCardProgressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.programCardProgressText}>
            Day {progress.completedDays}/{progress.totalDays} ({progressPercent}%)
          </Text>
        </View>
      )}
      
      <View style={styles.programCardFooter}>
        <Text style={styles.programCardMilestones}>
          {kit.milestones.length} milestones
        </Text>
        {!isActive && (
          <View style={styles.programCardStartBtn}>
            <Text style={styles.programCardStartBtnText}>Start Program</Text>
          </View>
        )}
        {isActive && (
          <View style={styles.programCardViewBtn}>
            <Text style={styles.programCardViewBtnText}>View Progress</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Get quest label from ID
 */
function getQuestLabel(questId) {
  const quest = BUILT_IN_QUEST_TEMPLATES.find(q => q.id === questId);
  return quest?.label || questId;
}

function ActiveProgramDetail({ kit, progress, onCompleteDay, onQuit }) {
  // Get today's suggested quests using the new format
  const todayQuests = useMemo(() => {
    return getTodaysSuggestedQuests({ kitId: kit.id });
  }, [kit.id]);

  // Group quests by time slot with proper labels
  const timeSlots = useMemo(() => {
    const slots = [];
    if (todayQuests.morning?.length) {
      slots.push({
        key: "morning",
        label: "Morning",
        quests: todayQuests.morning.map(id => ({
          id,
          label: getQuestLabel(id),
          duration: kit.suggestedMinutes?.[id] || 25,
        })),
      });
    }
    if (todayQuests.afternoon?.length) {
      slots.push({
        key: "afternoon",
        label: "Afternoon",
        quests: todayQuests.afternoon.map(id => ({
          id,
          label: getQuestLabel(id),
          duration: kit.suggestedMinutes?.[id] || 25,
        })),
      });
    }
    if (todayQuests.evening?.length) {
      slots.push({
        key: "evening",
        label: "Evening",
        quests: todayQuests.evening.map(id => ({
          id,
          label: getQuestLabel(id),
          duration: kit.suggestedMinutes?.[id] || 25,
        })),
      });
    }
    return slots;
  }, [todayQuests, kit.suggestedMinutes]);

  return (
    <View style={styles.programDetail}>
      <View style={styles.programDetailHeader}>
        <Text style={styles.programDetailIcon}>{kit.icon}</Text>
        <Text style={styles.programDetailName}>{kit.name}</Text>
      </View>

      <View style={styles.programDetailStats}>
        <View style={styles.programDetailStat}>
          <Text style={styles.programDetailStatValue}>{progress.completedDays}</Text>
          <Text style={styles.programDetailStatLabel}>Days Done</Text>
        </View>
        <View style={styles.programDetailStat}>
          <Text style={styles.programDetailStatValue}>{progress.totalDays - progress.completedDays}</Text>
          <Text style={styles.programDetailStatLabel}>Days Left</Text>
        </View>
        <View style={styles.programDetailStat}>
          <Text style={styles.programDetailStatValue}>{progress.progressPercent || Math.round(progress.progress * 100)}%</Text>
          <Text style={styles.programDetailStatLabel}>Complete</Text>
        </View>
      </View>

      {progress.nextMilestone && (
        <View style={styles.programDetailMilestone}>
          <Text style={styles.programDetailMilestoneLabel}>Next Milestone</Text>
          <Text style={styles.programDetailMilestoneTitle}>{progress.nextMilestone.title}</Text>
          <Text style={styles.programDetailMilestoneDesc}>
            {progress.nextMilestone.description} (Day {progress.nextMilestone.day})
          </Text>
        </View>
      )}

      <View style={styles.programDetailSchedule}>
        <Text style={styles.programDetailScheduleTitle}>Today's Quests</Text>
        {timeSlots.map(slot => (
          <View key={slot.key} style={styles.programDetailTimeBlock}>
            <Text style={styles.programDetailTimeLabel}>{slot.label}</Text>
            <View style={styles.programDetailTimeQuests}>
              {slot.quests.map(quest => (
                <View key={quest.id} style={styles.programDetailQuestChip}>
                  <Text style={styles.programDetailQuestText}>{quest.label}</Text>
                  <Text style={styles.programDetailQuestTime}>{quest.duration}m</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        {timeSlots.length === 0 && (
          <Text style={styles.muted}>No quests scheduled for today</Text>
        )}
      </View>

      <View style={styles.programDetailActions}>
        <TouchableOpacity style={styles.programQuitBtn} onPress={onQuit}>
          <Text style={styles.programQuitBtnText}>Quit Program</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ProgramsScreen({ 
  activeProgram, 
  onStartProgram, 
  onQuitProgram,
  onBack 
}) {
  const progress = useMemo(() => {
    if (!activeProgram) return null;
    return calculateProgramProgress(activeProgram);
  }, [activeProgram]);
  
  const activeKit = activeProgram 
    ? STARTER_KITS.find(k => k.id === activeProgram.kitId) 
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.screenHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Programs</Text>
      </View>
      
      {activeKit && progress && (
        <View style={styles.programActiveSection}>
          <Text style={styles.sectionLabel}>Active Program</Text>
          <ActiveProgramDetail 
            kit={activeKit} 
            progress={progress}
            onQuit={onQuitProgram}
          />
        </View>
      )}
      
      <View style={styles.programsSection}>
        <Text style={styles.sectionLabel}>
          {activeProgram ? "Other Programs" : "Available Programs"}
        </Text>
        <Text style={styles.muted}>
          Structured routines to help you build consistent habits
        </Text>
        
        {STARTER_KITS.map(kit => {
          const isActive = activeProgram?.kitId === kit.id;
          return (
            <ProgramCard
              key={kit.id}
              kit={kit}
              isActive={isActive}
              progress={isActive ? progress : null}
              onStart={() => onStartProgram(kit.id)}
              onView={() => {}}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}
