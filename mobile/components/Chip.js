import React, { useCallback, useRef } from "react";
import { TouchableOpacity, Text } from "react-native";
import styles from "../../style";

/**
 * Reusable Chip component for selectable tags/options.
 */
export default function Chip({
  label,
  onPress,
  onLongPress,
  active,
  highlighted,
  accessibilityLabel,
  accessibilityHint,
}) {
  const chipStyles = [
    styles.chip,
    active && styles.chipActive,
    highlighted && styles.chipHighlighted,
  ].filter(Boolean);

  // Prevent a long-press from also triggering the normal onPress.
  const didLongPressRef = useRef(false);
  const handleLongPress = useCallback(() => {
    didLongPressRef.current = true;
    onLongPress?.();
  }, [onLongPress]);

  const handlePress = useCallback(() => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onPress?.();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={chipStyles}
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={260}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
    >
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}
