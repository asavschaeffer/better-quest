import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../../style";

export function SettingsSectionHeader({ title, subtitle }) {
  return (
    <View style={styles.settingsSectionHeader}>
      <Text style={styles.settingsSectionHeaderTitle}>{title}</Text>
      {subtitle ? <Text style={styles.settingsSectionHeaderSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SettingsGroup({ rows = [] }) {
  return (
    <View style={styles.settingsGroup}>
      {rows.map((row, idx) => (
        <View key={row.key ?? idx}>
          <SettingsRow {...row} />
          {idx < rows.length - 1 ? <View style={styles.settingsCellSeparator} /> : null}
        </View>
      ))}
    </View>
  );
}

export function SettingsRow({ label, right, onPress, disabled }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress, activeOpacity: 0.7, disabled: !!disabled }
    : {};

  return (
    <Wrapper style={styles.settingsCell} {...wrapperProps}>
      <Text style={styles.settingsCellLabel}>{label}</Text>
      <View style={styles.settingsCellRight}>{right}</View>
    </Wrapper>
  );
}


