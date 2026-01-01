import React from "react";
import { View, Text } from "react-native";
import styles from "../../../style";
import { formatStatBadges } from "../../core/stats";

/**
 * SessionRow - Renders a single session in a feed/history list
 *
 * @param {object} props
 * @param {object} props.session - The session object
 * @param {string} [props.variant="history"] - Display variant: "history" (full) or "feed" (compact)
 * @param {boolean} [props.showUserName=false] - Whether to show the user name (for social feeds)
 */
export function SessionRow({ session, variant = "history", showUserName = false }) {
  if (!session) return null;

  const showNotes = variant === "history" && session.notes;
  const hasUserInfo = showUserName && session.userName;

  const badges =
    formatStatBadges(session.allocation, { mode: "allocation", maxParts: 3 }) ||
    formatStatBadges(session.expResult?.standExp, { mode: "gains", maxParts: 2 });

  return (
    <View style={styles.historySessionItem}>
      {/* User info for social feeds */}
      {hasUserInfo && (
        <View style={localStyles.userRow}>
          <Text style={localStyles.userName}>{session.userName}</Text>
          {session.userLevel && (
            <Text style={localStyles.userLevel}>Lv {session.userLevel}</Text>
          )}
        </View>
      )}
      
      <Text style={styles.historySessionTitle}>{session.description}</Text>
      <Text style={styles.historySessionMeta}>
        {badges ? `${badges} • ` : ""}
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

const localStyles = {
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    color: "#a5b4fc",
    fontSize: 13,
    fontWeight: "600",
  },
  userLevel: {
    color: "#6b7280",
    fontSize: 11,
  },
};

export default SessionRow;
