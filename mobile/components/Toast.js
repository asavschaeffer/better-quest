import React from "react";
import { View, Text } from "react-native";
import styles from "../../style";

/**
 * Simple toast component to display brief messages.
 * Usage: Render conditionally when message is non-empty.
 */
export default function Toast({ message }) {
  if (!message) return null;
  
  return (
    <View style={styles.toastContainer} pointerEvents="none">
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}
