import React from "react";
import { TouchableOpacity, Text } from "react-native";
import styles from "../../style";

/**
 * Reusable Chip component for selectable tags/options.
 */
export default function Chip({ label, onPress, active, highlighted }) {
  const chipStyles = [
    styles.chip,
    active && styles.chipActive,
    highlighted && styles.chipHighlighted,
  ].filter(Boolean);

  return (
    <TouchableOpacity style={chipStyles} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}
