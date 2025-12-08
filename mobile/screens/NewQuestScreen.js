import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from "react-native";
import styles from "../../style";
import { QuestStatsWheel } from "../QuestStatsWheel";
import { QuickLaunchEditor } from "../QuickLaunchEditor";
import {
  createQuest,
  suggestStatsForLabel,
  validateQuestStats,
  getQuestStatTotal,
  QUEST_STAT_MAX_TOTAL,
  STAT_KEYS,
} from "../core/models";

const DURATION_PRESETS = [10, 20, 30, 45, 60];

export default function NewQuestScreen({
  initialName = "",
  editQuest = null,
  onBack,
  onSave,
  onSaveAndStart,
  onDelete,
}) {
  const isEditing = !!editQuest;

  const [label, setLabel] = useState(editQuest?.label || initialName);
  const [description, setDescription] = useState(editQuest?.description || "");
  const [duration, setDuration] = useState(editQuest?.defaultDurationMinutes || 25);
  const [customDuration, setCustomDuration] = useState("");
  const [stats, setStats] = useState(() => editQuest?.stats || suggestStatsForLabel(initialName));
  const [keywords, setKeywords] = useState(editQuest?.keywords?.join(", ") || "");
  const [action, setAction] = useState(editQuest?.action || null);
  const [error, setError] = useState("");

  // Update stats suggestion when label changes (only for new quests)
  useEffect(() => {
    if (isEditing) return; // Don't auto-suggest for edits
    if (!label.trim()) return;
    const suggested = suggestStatsForLabel(label);
    const total = getQuestStatTotal(suggested);
    if (total > 0) {
      setStats(suggested);
    }
  }, [label, isEditing]);

  function validate() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError("Quest title is required");
      return null;
    }

    const finalDuration = customDuration ? parseInt(customDuration, 10) : duration;
    if (!Number.isFinite(finalDuration) || finalDuration <= 0) {
      setError("Please enter a valid duration");
      return null;
    }
    if (finalDuration > 240) {
      setError("Duration cannot exceed 240 minutes");
      return null;
    }

    // Validate stats
    const validatedStats = validateQuestStats(stats);

    // Parse keywords
    const keywordList = keywords
      .split(/[,\s]+/)
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    setError("");

    return {
      id: editQuest?.id || `quest-${Date.now()}`,
      label: trimmedLabel,
      description: description.trim(),
      defaultDurationMinutes: finalDuration,
      stats: validatedStats,
      keywords: keywordList,
      action: action?.value?.trim() ? action : null,
    };
  }

  function handleSave() {
    const questData = validate();
    if (!questData) return;

    try {
      const quest = createQuest(questData);
      onSave?.(quest);
    } catch (e) {
      setError(e.message || "Failed to create quest");
    }
  }

  function handleSaveAndStart() {
    const questData = validate();
    if (!questData) return;

    try {
      const quest = createQuest(questData);
      const sessionParams = {
        description: quest.label,
        durationMinutes: quest.defaultDurationMinutes,
        allocation: quest.stats,
        questAction: quest.action,
      };
      onSaveAndStart?.(quest, sessionParams);
    } catch (e) {
      setError(e.message || "Failed to create quest");
    }
  }

  const statTotal = getQuestStatTotal(stats);
  const pointsLeft = QUEST_STAT_MAX_TOTAL - statTotal;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{isEditing ? "Edit Quest" : "Create Quest"}</Text>
      <Text style={styles.muted}>
        {isEditing
          ? "Update your quest template"
          : "Build a reusable quest template with stats and quick launch"}
      </Text>

      {/* Title */}
      <View style={styles.block}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g., Math study, Morning run"
          placeholderTextColor="#6b7280"
          autoFocus={Platform.OS === "web"}
        />
      </View>

      {/* Description / Why */}
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Description / Why</Text>
          <Text style={styles.optional}>(optional)</Text>
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Why are you doing this? What does it involve?"
          placeholderTextColor="#6b7280"
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Stats allocation with integrated duration ring */}
      <QuestStatsWheel
        value={stats}
        onChange={setStats}
        duration={customDuration ? parseInt(customDuration, 10) || duration : duration}
        onDurationChange={(d) => {
          setDuration(d);
          setCustomDuration("");
        }}
      />

      {/* Duration quick-select chips + input */}
      <View style={styles.durationSection}>
        <View style={styles.durationRow}>
          {DURATION_PRESETS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[
                styles.durationChip,
                duration === d && !customDuration && styles.durationChipActive,
              ]}
              onPress={() => {
                setDuration(d);
                setCustomDuration("");
              }}
            >
              <Text
                style={[
                  styles.durationChipText,
                  duration === d && !customDuration && styles.durationChipTextActive,
                ]}
              >
                {d}m
              </Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={[styles.input, styles.durationInput]}
            value={customDuration || (DURATION_PRESETS.includes(duration) ? "" : duration.toString())}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, "");
              setCustomDuration(cleaned);
              if (cleaned) {
                const num = parseInt(cleaned, 10);
                if (num > 0 && num <= 240) {
                  setDuration(num);
                }
              }
            }}
            placeholder="min"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            maxLength={3}
          />
        </View>
      </View>
      {statTotal > 0 && (
        <TouchableOpacity
          style={styles.resetLink}
          onPress={() => {
            const empty = {};
            STAT_KEYS.forEach((k) => {
              empty[k] = 0;
            });
            setStats(empty);
          }}
        >
          <Text style={styles.resetLinkText}>Reset stats</Text>
        </TouchableOpacity>
      )}

      {/* Tags */}
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Tags</Text>
          <Text style={styles.optional}>(optional, comma or space separated)</Text>
        </View>
        <TextInput
          style={styles.input}
          value={keywords}
          onChangeText={setKeywords}
          placeholder="e.g., study, morning, focus"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
        />
      </View>

      {/* Quick Launch */}
      <QuickLaunchEditor value={action} onChange={setAction} />

      {/* Error */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.ghostBtn} onPress={onBack}>
          <Text style={styles.ghostBtnText}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.actionsRight}>
          {isEditing && onDelete && (
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => {
                if (Platform.OS === "web") {
                  if (window.confirm(`Delete "${editQuest.label}"?`)) {
                    onDelete(editQuest.id);
                  }
                } else {
                  onDelete(editQuest.id);
                }
              }}
            >
              <Text style={styles.dangerBtnText}>Delete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSave}>
            <Text style={styles.secondaryBtnText}>Save</Text>
          </TouchableOpacity>
          {!isEditing && (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveAndStart}>
              <Text style={styles.primaryBtnText}>Save & Start</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
