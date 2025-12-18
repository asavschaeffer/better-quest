import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SectionList } from "react-native";
import styles from "../../style";
import { SettingsGroup, SettingsSectionHeader } from "../components/SettingsCells";

export default function SettingsScreen({
  avatar,
  onUpdateAvatar,
  quickStartMode,
  onUpdateQuickStartMode,
  pickerDefaultMode = "top",
  postSaveBehavior = "library",
  onUpdatePickerDefaultMode,
  onUpdatePostSaveBehavior,
  sunriseTimeLocal = "06:30",
  onUpdateSunriseTimeLocal,
  showToast,
  inAppAnnouncementsEnabled = true,
  onUpdateInAppAnnouncementsEnabled,
  // Quote props
  userQuotes = [],
  includeBuiltInQuotes = true,
  onAddQuote,
  onDeleteQuote,
  onToggleBuiltInQuotes,
}) {
  const [name, setName] = useState(avatar.name);
  const [localSunrise, setLocalSunrise] = useState(sunriseTimeLocal);
  const [newQuote, setNewQuote] = useState("");

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

  const sections = useMemo(() => {
    const quoteRows = [];
    quoteRows.push({
      key: "includeBuiltInQuotes",
      label: "Include built-in quotes",
      icon: "chatbubbles-outline",
      iconBg: "#22c55e",
      onPress: () => onToggleBuiltInQuotes?.(!includeBuiltInQuotes),
      right: includeBuiltInQuotes ? <Text style={styles.settingsCellRightCheck}>✓</Text> : null,
    });
    quoteRows.push({
      key: "addQuote",
      label: "Add a quote",
      icon: "add-outline",
      iconBg: "#3b82f6",
      right: (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            style={[styles.settingsCellInput, { minWidth: 170, textAlign: "left" }]}
            value={newQuote}
            onChangeText={setNewQuote}
            placeholder="Type something..."
            placeholderTextColor="#6b7280"
            multiline={false}
            onSubmitEditing={handleAddQuote}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddQuote}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      ),
      disabled: true,
    });

    if (userQuotes.length > 0) {
      userQuotes.forEach((q) => {
        quoteRows.push({
          key: `quote-${q.id}`,
          label: q.text,
          icon: "chatbubble-ellipses-outline",
          iconBg: "#64748b",
          right: (
            <TouchableOpacity
              style={styles.settingsQuoteDelete}
              onPress={() => {
                onDeleteQuote?.(q.id);
                showToast?.("Quote removed");
              }}
            >
              <Text style={styles.settingsQuoteDeleteText}>✕</Text>
            </TouchableOpacity>
          ),
          disabled: true,
        });
      });
    }

    return [
      {
        key: "time",
        title: "Time",
        subtitle: "Used for the Brahma Muhurta bonus. Manual for now (we’ll auto-detect later).",
        data: [
          {
            key: "time-group",
            rows: [
              {
                key: "sunrise",
                label: "Sunrise",
                icon: "sunny-outline",
                iconBg: "#f59e0b",
                disabled: true,
                right: (
                  <TextInput
                    style={styles.settingsCellInput}
                    value={localSunrise}
                    onChangeText={setLocalSunrise}
                    onBlur={handleSaveSunrise}
                    placeholder="06:30"
                    placeholderTextColor="#6b7280"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                ),
              },
            ],
          },
        ],
      },
      {
        key: "profile",
        title: "Profile",
        data: [
          {
            key: "profile-group",
            rows: [
              {
                key: "name",
                label: "Name",
                icon: "person-outline",
                iconBg: "#3b82f6",
                disabled: true,
                right: (
                  <TextInput
                    style={[styles.settingsCellInput, { minWidth: 140, textAlign: "right" }]}
                    value={name}
                    onChangeText={setName}
                    onBlur={handleSaveName}
                    placeholder="Your name"
                    placeholderTextColor="#6b7280"
                  />
                ),
              },
            ],
          },
        ],
      },
      {
        key: "quickstart",
        title: "Quick Start Button",
        subtitle: "Choose what the ⚔️ button and home quickstart do.",
        data: [
          {
            key: "quickstart-group",
            rows: [
              {
                key: "qs-picker",
                label: "Show quest picker",
                icon: "list-outline",
                iconBg: "#8b5cf6",
                onPress: () => onUpdateQuickStartMode?.("picker"),
                right: quickStartMode === "picker" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
              {
                key: "qs-instant",
                label: "Instant start: top suggestion",
                icon: "flash-outline",
                iconBg: "#f97316",
                onPress: () => onUpdateQuickStartMode?.("instant"),
                right: quickStartMode === "instant" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
            ],
          },
        ],
      },
      {
        key: "picker-defaults",
        title: "Quest Picker Defaults",
        subtitle: "Choose what the quest picker shows first.",
        data: [
          {
            key: "picker-group",
            rows: [
              {
                key: "picker-top",
                label: "Preselect top suggestion",
                icon: "sparkles-outline",
                iconBg: "#22c55e",
                onPress: () => onUpdatePickerDefaultMode?.("top"),
                right: pickerDefaultMode === "top" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
              {
                key: "picker-blank",
                label: "Start blank",
                icon: "create-outline",
                iconBg: "#64748b",
                onPress: () => onUpdatePickerDefaultMode?.("blank"),
                right: pickerDefaultMode === "blank" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
            ],
          },
        ],
      },
      {
        key: "post-save",
        title: "After Saving a Quest",
        subtitle: "Choose where you land after saving in the Library.",
        data: [
          {
            key: "postsave-group",
            rows: [
              {
                key: "postsave-library",
                label: "Stay in Library",
                icon: "folder-outline",
                iconBg: "#0ea5e9",
                onPress: () => onUpdatePostSaveBehavior?.("library"),
                right: postSaveBehavior === "library" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
              {
                key: "postsave-picker",
                label: "Jump to picker with quest selected",
                icon: "arrow-forward-outline",
                iconBg: "#a855f7",
                onPress: () => onUpdatePostSaveBehavior?.("picker"),
                right: postSaveBehavior === "picker" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
            ],
          },
        ],
      },
      {
        key: "quotes",
        title: "Motivational Quotes",
        subtitle: "Add your own quotes to appear on the home screen.",
        data: [{ key: "quotes-group", rows: quoteRows }],
      },
      {
        key: "notifications",
        title: "Notifications",
        subtitle: "In-app announcements and future push notifications.",
        data: [
          {
            key: "notifications-group",
            rows: [
              {
                key: "notifs-inapp",
                label: "In-app announcements",
                icon: "notifications-outline",
                iconBg: "#f59e0b",
                onPress: () => onUpdateInAppAnnouncementsEnabled?.(!inAppAnnouncementsEnabled),
                right: inAppAnnouncementsEnabled ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
              {
                key: "notifs-push",
                label: "Push notifications",
                icon: "phone-portrait-outline",
                iconBg: "#64748b",
                disabled: true,
                right: <Text style={styles.settingsCellRightText}>Coming soon</Text>,
              },
            ],
          },
        ],
      },
      {
        key: "data",
        title: "Data",
        subtitle: "Export or reset your local data.",
        data: [
          {
            key: "data-group",
            rows: [
              {
                key: "data-export",
                label: "Export sessions",
                icon: "download-outline",
                iconBg: "#0ea5e9",
                disabled: true,
                right: <Text style={styles.settingsCellRightText}>Coming soon</Text>,
              },
              {
                key: "data-reset",
                label: "Reset app data",
                icon: "trash-outline",
                iconBg: "#ef4444",
                disabled: true,
                right: <Text style={styles.settingsCellRightText}>Coming soon</Text>,
              },
            ],
          },
        ],
      },
      {
        key: "about",
        title: "About",
        data: [
          {
            key: "about-group",
            rows: [
              {
                key: "about-version",
                label: "Version",
                icon: "information-circle-outline",
                iconBg: "#64748b",
                disabled: true,
                right: <Text style={styles.settingsCellRightText}>0.1</Text>,
              },
              {
                key: "about-tagline",
                label: "Tagline",
                icon: "heart-outline",
                iconBg: "#ef4444",
                disabled: true,
                right: <Text style={styles.settingsCellRightText}>Turn your life into an RPG</Text>,
              },
            ],
          },
        ],
      },
    ];
  }, [
    includeBuiltInQuotes,
    inAppAnnouncementsEnabled,
    localSunrise,
    name,
    newQuote,
    onDeleteQuote,
    onToggleBuiltInQuotes,
    onUpdateInAppAnnouncementsEnabled,
    onUpdatePickerDefaultMode,
    onUpdatePostSaveBehavior,
    onUpdateQuickStartMode,
    onUpdateSunriseTimeLocal,
    pickerDefaultMode,
    postSaveBehavior,
    quickStartMode,
    showToast,
    sunriseTimeLocal,
    userQuotes,
  ]);

  return (
    <View style={styles.screenContainer}>
      <SectionList
        contentContainerStyle={styles.settingsListContent}
        sections={sections}
        keyExtractor={(item) => item.key}
        renderSectionHeader={({ section }) => (
          <SettingsSectionHeader title={section.title} subtitle={section.subtitle} />
        )}
        renderItem={({ item }) => <SettingsGroup rows={item.rows} />}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}
