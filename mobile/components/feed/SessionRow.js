import React from "react";
import { View, Text } from "react-native";
import styles from "../../../style";

/**
 * SessionRow - Renders a single session in a feed/history list
 *
 * @param {object} props
 * @param {object} props.session - The session object
 * @param {string} [props.variant="history"] - Display variant: "history" (full) or "feed" (compact)
 */
export function SessionRow({ session, variant = "history" }) {
  if (!session) return null;

  const showNotes = variant === "history" && session.notes;

  return (
    <View style={styles.historySessionItem}>
      <Text style={styles.historySessionTitle}>{session.description}</Text>
      <Text style={styles.historySessionMeta}>
        {session.durationMinutes}m • +{session.expResult?.totalExp || 0} EXP
        {session.comboBonus ? " 🔥" : ""}
        {session.restBonus ? " 😴" : ""}
      </Text>
      {showNotes && (
        <Text style={styles.historySessionNotes}>{session.notes}</Text>
      )}
    </View>
  );
}

export default SessionRow;

