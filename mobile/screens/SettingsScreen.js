import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import styles from "../../style";

export default function SettingsScreen({
  avatar,
  onUpdateAvatar,
  footerConfig,
  onUpdateFooterConfig,
  quickStartMode,
  onUpdateQuickStartMode,
  pickerDefaultMode = "top",
  postSaveBehavior = "library",
  onUpdatePickerDefaultMode,
  onUpdatePostSaveBehavior,
  sunriseTimeLocal = "06:30",
  onUpdateSunriseTimeLocal,
  showToast,
  // Quote props
  userQuotes = [],
  includeBuiltInQuotes = true,
  onAddQuote,
  onDeleteQuote,
  onToggleBuiltInQuotes,
}) {
  const [name, setName] = useState(avatar.name);
  const [localSunrise, setLocalSunrise] = useState(sunriseTimeLocal);
  const [localFooterConfig, setLocalFooterConfig] = useState(
    footerConfig || { showCompletedToday: true, showUpcoming: true }
  );
  const [newQuote, setNewQuote] = useState("");

  useEffect(() => {
    setLocalFooterConfig(footerConfig);
  }, [footerConfig]);
  useEffect(() => {
    setName(avatar.name);
  }, [avatar.name]);
  useEffect(() => {
    setLocalSunrise(sunriseTimeLocal || "06:30");
  }, [sunriseTimeLocal]);

  function handleSaveName() {
    if (name.trim()) {
      onUpdateAvatar({ name: name.trim() });
      showToast?.("Saved");
    }
  }

  function toggleFooter(key) {
    const next = { ...localFooterConfig, [key]: !localFooterConfig[key] };
    setLocalFooterConfig(next);
    onUpdateFooterConfig(next);
  }

  function handleAddQuote() {
    const trimmed = newQuote.trim();
    if (!trimmed) return;
    onAddQuote?.(trimmed);
    setNewQuote("");
    showToast?.("Quote added");
  }

  function normalizeHHMM(input) {
    const s = (input ?? "").trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    if (h < 0 || h > 23) return null;
    if (min < 0 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  function handleSaveSunrise() {
    const normalized = normalizeHHMM(localSunrise);
    if (!normalized) {
      showToast?.("Use HH:MM (e.g. 06:30)");
      setLocalSunrise(sunriseTimeLocal || "06:30");
      return;
    }
    onUpdateSunriseTimeLocal?.(normalized);
  }

  return (
    <View style={styles.screenContainer}>
      <ScrollView>
        {/* Time section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Time</Text>
          <Text style={styles.settingsDescription}>
            Used for the Brahma Muhurta bonus. Manual for now (we’ll auto-detect later).
          </Text>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Sunrise (local)</Text>
            <TextInput
              style={styles.settingsInput}
              value={localSunrise}
              onChangeText={setLocalSunrise}
              onBlur={handleSaveSunrise}
              placeholder="06:30"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Profile section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Profile</Text>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Name</Text>
            <TextInput
              style={styles.settingsInput}
              value={name}
              onChangeText={setName}
              onBlur={handleSaveName}
              placeholder="Your name"
              placeholderTextColor="#6b7280"
            />
          </View>
        </View>

        {/* Big Button section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Quick Start Button</Text>
          <Text style={styles.settingsDescription}>
            Choose what the ⚔️ button and home quickstart do.
          </Text>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onUpdateQuickStartMode?.("picker")}
          >
            <Text style={styles.settingsOptionText}>Show quest picker</Text>
            {quickStartMode === "picker" && (
              <Text style={styles.settingsOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onUpdateQuickStartMode?.("instant")}
          >
            <Text style={styles.settingsOptionText}>Instant start: top suggestion</Text>
            {quickStartMode === "instant" && (
              <Text style={styles.settingsOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quest picker defaults */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Quest Picker Defaults</Text>
          <Text style={styles.settingsDescription}>
            Choose what the quest picker shows first.
          </Text>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onUpdatePickerDefaultMode?.("top")}
          >
            <Text style={styles.settingsOptionText}>Preselect top suggestion</Text>
            {pickerDefaultMode === "top" && <Text style={styles.settingsOptionCheck}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onUpdatePickerDefaultMode?.("blank")}
          >
            <Text style={styles.settingsOptionText}>Start blank</Text>
            {pickerDefaultMode === "blank" && <Text style={styles.settingsOptionCheck}>✓</Text>}
          </TouchableOpacity>
        </View>

        {/* Library save flow */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>After Saving a Quest</Text>
          <Text style={styles.settingsDescription}>
            Choose where you land after saving in the Library.
          </Text>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onUpdatePostSaveBehavior?.("library")}
          >
            <Text style={styles.settingsOptionText}>Stay in Library</Text>
            {postSaveBehavior === "library" && <Text style={styles.settingsOptionCheck}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onUpdatePostSaveBehavior?.("picker")}
          >
            <Text style={styles.settingsOptionText}>Jump to picker with quest selected</Text>
            {postSaveBehavior === "picker" && <Text style={styles.settingsOptionCheck}>✓</Text>}
          </TouchableOpacity>
        </View>

        {/* Quotes section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Motivational Quotes</Text>
          <Text style={styles.settingsDescription}>
            Add your own quotes to appear on the home screen.
          </Text>
          
          {/* Toggle built-in quotes */}
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => onToggleBuiltInQuotes?.(!includeBuiltInQuotes)}
          >
            <Text style={styles.settingsOptionText}>Include built-in quotes</Text>
            {includeBuiltInQuotes && <Text style={styles.settingsOptionCheck}>✓</Text>}
          </TouchableOpacity>
          
          {/* Add new quote */}
          <View style={[styles.settingsRow, { marginTop: 12 }]}>
            <TextInput
              style={[styles.settingsInput, { flex: 1 }]}
              value={newQuote}
              onChangeText={setNewQuote}
              placeholder="Add a new quote..."
              placeholderTextColor="#6b7280"
              multiline
              onSubmitEditing={handleAddQuote}
            />
            <TouchableOpacity
              style={[styles.addBtn, { marginLeft: 8 }]}
              onPress={handleAddQuote}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {/* User quotes list */}
          {userQuotes.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionLabel}>Your Quotes ({userQuotes.length})</Text>
              {userQuotes.map((quote) => (
                <View key={quote.id} style={styles.settingsQuoteItem}>
                  <Text style={styles.settingsQuoteText} numberOfLines={2}>
                    "{quote.text}"
                  </Text>
                  <TouchableOpacity
                    style={styles.settingsQuoteDelete}
                    onPress={() => {
                      onDeleteQuote?.(quote.id);
                      showToast?.("Quote removed");
                    }}
                  >
                    <Text style={styles.settingsQuoteDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Home footer content */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Home Footer Content</Text>
          <Text style={styles.settingsDescription}>
            Choose what appears under the stage on the home screen.
          </Text>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => toggleFooter("showCompletedToday")}
          >
            <Text style={styles.settingsOptionText}>Show completed quests today</Text>
            {localFooterConfig.showCompletedToday && (
              <Text style={styles.settingsOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsOption}
            onPress={() => toggleFooter("showUpcoming")}
          >
            <Text style={styles.settingsOptionText}>Show important upcoming quests</Text>
            {localFooterConfig.showUpcoming && (
              <Text style={styles.settingsOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* App info */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>About</Text>
          <Text style={styles.settingsAbout}>Better Quest v0.1</Text>
          <Text style={styles.settingsAbout}>Turn your life into an RPG</Text>
        </View>
      </ScrollView>
    </View>
  );
}
