import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SectionList } from "react-native";
import styles from "../../style";
import { SettingsGroup, SettingsSectionHeader } from "../components/SettingsCells";

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

  const sections = useMemo(() => {
    const quoteRows = [];
    quoteRows.push({
      key: "includeBuiltInQuotes",
      label: "Include built-in quotes",
      onPress: () => onToggleBuiltInQuotes?.(!includeBuiltInQuotes),
      right: includeBuiltInQuotes ? <Text style={styles.settingsCellRightCheck}>✓</Text> : null,
    });
    quoteRows.push({
      key: "addQuote",
      label: "Add a quote",
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
                onPress: () => onUpdateQuickStartMode?.("picker"),
                right: quickStartMode === "picker" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
              {
                key: "qs-instant",
                label: "Instant start: top suggestion",
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
                onPress: () => onUpdatePickerDefaultMode?.("top"),
                right: pickerDefaultMode === "top" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
              {
                key: "picker-blank",
                label: "Start blank",
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
                onPress: () => onUpdatePostSaveBehavior?.("library"),
                right: postSaveBehavior === "library" ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
              {
                key: "postsave-picker",
                label: "Jump to picker with quest selected",
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
        key: "home-footer",
        title: "Home Footer Content",
        subtitle: "Choose what appears under the stage on the home screen.",
        data: [
          {
            key: "footer-group",
            rows: [
              {
                key: "footer-completed",
                label: "Show completed quests today",
                onPress: () => toggleFooter("showCompletedToday"),
                right: localFooterConfig.showCompletedToday ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
              },
              {
                key: "footer-upcoming",
                label: "Show important upcoming quests",
                onPress: () => toggleFooter("showUpcoming"),
                right: localFooterConfig.showUpcoming ? (
                  <Text style={styles.settingsCellRightCheck}>✓</Text>
                ) : null,
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
                disabled: true,
                right: <Text style={styles.settingsCellRightText}>0.1</Text>,
              },
              {
                key: "about-tagline",
                label: "Tagline",
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
    localFooterConfig,
    localSunrise,
    name,
    newQuote,
    onDeleteQuote,
    onToggleBuiltInQuotes,
    onUpdatePickerDefaultMode,
    onUpdatePostSaveBehavior,
    onUpdateQuickStartMode,
    onUpdateSunriseTimeLocal,
    pickerDefaultMode,
    postSaveBehavior,
    quickStartMode,
    showToast,
    sunriseTimeLocal,
    toggleFooter,
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
