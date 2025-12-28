import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Alert, Image, StyleSheet, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import styles from "../../style";
import { QuestStatsPicker } from "../components/QuestStatsPicker";
import { QuickLaunchEditor } from "../QuickLaunchEditor";
import {
  createQuest,
  suggestStatsForLabel,
  validateQuestStats,
  getQuestStatTotal,
  STAT_KEYS,
} from "../core/models";
import { deleteQuestImageAsync, persistQuestImageAsync } from "../core/questStorage";
import { getAutoImageUriForAction, isAutoPreviewImageUri } from "../core/linkPreviews";

// Curated icon set for quest icons
const QUEST_ICON_OPTIONS = [
  "book-outline",
  "calculator-outline",
  "flask-outline",
  "pencil-outline",
  "barbell-outline",
  "walk-outline",
  "heart-outline",
  "leaf-outline",
  "body-outline",
  "briefcase-outline",
  "restaurant-outline",
  "sparkles-outline",
  "footsteps-outline",
  "musical-notes-outline",
  "people-outline",
  "mic-outline",
  "code-slash-outline",
  "game-controller-outline",
  "camera-outline",
  "globe-outline",
  "fitness-outline",
  "bicycle-outline",
  "bed-outline",
  "cafe-outline",
  "bulb-outline",
  "construct-outline",
  "color-palette-outline",
  "megaphone-outline",
  "school-outline",
  "trophy-outline",
];

const DURATION_PRESETS = [10, 20, 30, 45, 60];

export default function NewQuestScreen({
  initialName = "",
  editQuest = null,
  userName = "You",
  // Navigation + actions are now handled in the native header (QuestStack screen options).
  // This screen just renders the form and reports validation errors.
  onChange,
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
  const [icon, setIcon] = useState(editQuest?.icon || null);
  const [imageUri, setImageUri] = useState(editQuest?.imageUri || null);
  const [showIconPicker, setShowIconPicker] = useState(false);
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

  // Auto-derive cover image from supported URLs (YouTube) when the user hasn't picked a custom image.
  useEffect(() => {
    const auto = getAutoImageUriForAction(action);

    // If there's no custom image yet (or current is an auto preview), refresh it from the URL.
    if (auto && (!imageUri || isAutoPreviewImageUri(imageUri))) {
      setImageUri(auto);
      return;
    }

    // If the action is no longer supported, and we were only showing an auto preview, clear it.
    if (!auto && isAutoPreviewImageUri(imageUri)) {
      setImageUri(null);
    }
  }, [action, imageUri]);

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        // expo-image-picker >=17 uses string media types (or an array of them).
        // Using the string form avoids relying on deprecated MediaTypeOptions
        // and prevents runtime crashes from non-existent enum exports.
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/d7add573-3752-4b30-89e0-4c436052ce12", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "mobile/screens/NewQuestScreen.js:pickImage:afterPicker",
          message: "ImagePicker result",
          data: {
            canceled: !!result?.canceled,
            assetUri: result?.assets?.[0]?.uri ?? null,
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "E",
        }),
      }).catch(() => {});
      // #endregion agent log
      if (!result.canceled && result.assets?.[0]?.uri) {
        const persistedUri = await persistQuestImageAsync(result.assets[0].uri);
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/d7add573-3752-4b30-89e0-4c436052ce12", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "mobile/screens/NewQuestScreen.js:pickImage:afterPersist",
            message: "persistQuestImageAsync return",
            data: { persistedUri: persistedUri ?? null, prevImageUri: imageUri ?? null },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "D",
          }),
        }).catch(() => {});
        // #endregion agent log
        if (persistedUri) {
          // If we already had a persisted image, remove it to avoid leaking files.
          if (imageUri) {
            await deleteQuestImageAsync(imageUri);
          }
          setImageUri(persistedUri);
        }
      }
    } catch (err) {
      console.warn("Image picker error:", err);
    }
  }

  async function removeImage() {
    if (imageUri) {
      await deleteQuestImageAsync(imageUri);
    }
    setImageUri(null);
  }

  function buildQuestData() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return { ok: false, error: "Quest title is required", questData: null };
    }

    const finalDuration = customDuration ? parseInt(customDuration, 10) : duration;
    if (!Number.isFinite(finalDuration) || finalDuration <= 0) {
      return { ok: false, error: "Please enter a valid duration", questData: null };
    }
    if (finalDuration > 240) {
      return { ok: false, error: "Duration cannot exceed 240 minutes", questData: null };
    }

    // Validate stats
    const validatedStats = validateQuestStats(stats);

    // Parse keywords
    const keywordList = keywords
      .split(/[,\s]+/)
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    const questData = {
      id: editQuest?.id || `quest-${Date.now()}`,
      label: trimmedLabel,
      description: description.trim(),
      defaultDurationMinutes: finalDuration,
      stats: validatedStats,
      keywords: keywordList,
      action: action?.value?.trim() ? action : null,
      icon: icon || null,
      imageUri: imageUri || null,
      authorName: editQuest?.authorName || userName,
    };
    return { ok: true, error: "", questData };
  }

  // Report changes upward so the navigator header can enable/disable Save/Start.
  useEffect(() => {
    const res = buildQuestData();
    if (!res.ok) {
      setError(res.error);
      onChange?.({ isValid: false, quest: null, error: res.error });
      return;
    }
    try {
      const quest = createQuest(res.questData);
      setError("");
      onChange?.({ isValid: true, quest, error: "" });
    } catch (e) {
      const msg = e?.message || "Invalid quest";
      setError(msg);
      onChange?.({ isValid: false, quest: null, error: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, description, duration, customDuration, stats, keywords, action, icon, imageUri]);

  const statTotal = getQuestStatTotal(stats);

  function confirmDelete() {
    const labelText = (editQuest?.label || "this quest").trim();
    const message = `Delete "${labelText}"? This can't be undone.`;

    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(message)) onDelete?.();
      return;
    }

    Alert.alert("Delete Quest", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.() },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title/subtitle moved into native header to match iOS patterns */}

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

      {/* Icon Picker */}
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Icon</Text>
          <Text style={styles.optional}>(optional)</Text>
        </View>
        <TouchableOpacity
          style={questEditorStyles.iconPickerToggle}
          onPress={() => setShowIconPicker(!showIconPicker)}
        >
          {icon ? (
            <View style={questEditorStyles.selectedIconWrap}>
              <Ionicons name={icon} size={24} color="#a5b4fc" />
              <Text style={questEditorStyles.selectedIconLabel}>{icon}</Text>
            </View>
          ) : (
            <Text style={questEditorStyles.iconPickerPlaceholder}>Choose an icon...</Text>
          )}
          <Ionicons name={showIconPicker ? "chevron-up" : "chevron-down"} size={18} color="#6b7280" />
        </TouchableOpacity>
        {showIconPicker && (
          <View style={questEditorStyles.iconGrid}>
            {icon && (
              <TouchableOpacity
                style={[questEditorStyles.iconOption, questEditorStyles.iconOptionClear]}
                onPress={() => { setIcon(null); setShowIconPicker(false); }}
              >
                <Ionicons name="close" size={20} color="#ef4444" />
              </TouchableOpacity>
            )}
            {QUEST_ICON_OPTIONS.map((iconName) => (
              <TouchableOpacity
                key={iconName}
                style={[
                  questEditorStyles.iconOption,
                  icon === iconName && questEditorStyles.iconOptionActive,
                ]}
                onPress={() => { setIcon(iconName); setShowIconPicker(false); }}
              >
                <Ionicons name={iconName} size={20} color={icon === iconName ? "#a5b4fc" : "#9ca3af"} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Image Picker */}
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Cover Image</Text>
          <Text style={styles.optional}>(optional)</Text>
        </View>
        {imageUri ? (
          <View style={questEditorStyles.imagePreviewWrap}>
            <Image source={{ uri: imageUri }} style={questEditorStyles.imagePreview} />
            <View style={questEditorStyles.imageActions}>
              <TouchableOpacity style={questEditorStyles.imageActionBtn} onPress={pickImage}>
                <Ionicons name="image-outline" size={16} color="#a5b4fc" />
                <Text style={questEditorStyles.imageActionText}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity style={questEditorStyles.imageActionBtn} onPress={removeImage}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={[questEditorStyles.imageActionText, { color: "#ef4444" }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={questEditorStyles.imagePickerBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={24} color="#6b7280" />
            <Text style={questEditorStyles.imagePickerText}>Add cover image</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats allocation with integrated duration ring */}
      <QuestStatsPicker
        allocation={stats}
        onAllocationChange={setStats}
        duration={customDuration ? parseInt(customDuration, 10) || duration : duration}
        onDurationChange={(d) => {
          setDuration(d);
          setCustomDuration("");
        }}
        size={Platform.OS === "web" ? 340 : 320}
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

      {/* Danger zone */}
      {isEditing ? (
        <View style={styles.block}>
          <Text style={styles.label}>Danger zone</Text>
          <TouchableOpacity
            style={[styles.dangerBtn, { marginTop: 8 }]}
            onPress={confirmDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete quest"
          >
            <Text style={styles.dangerBtnText}>Delete quest</Text>
          </TouchableOpacity>
        </View>
      ) : null}

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const questEditorStyles = StyleSheet.create({
  iconPickerToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 12,
    marginTop: 4,
  },
  selectedIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedIconLabel: {
    color: "#e5e7eb",
    fontSize: 13,
  },
  iconPickerPlaceholder: {
    color: "#6b7280",
    fontSize: 14,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  iconOptionActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#1e1b4b",
  },
  iconOptionClear: {
    borderColor: "#7f1d1d",
    backgroundColor: "#1f1717",
  },
  imagePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    borderStyle: "dashed",
    padding: 24,
    marginTop: 4,
  },
  imagePickerText: {
    color: "#6b7280",
    fontSize: 14,
  },
  imagePreviewWrap: {
    marginTop: 4,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  imagePreview: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
  },
  imageActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 10,
  },
  imageActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#111827",
  },
  imageActionText: {
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: "500",
  },
});
