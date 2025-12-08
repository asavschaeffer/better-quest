import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import styles from "../../style";

export default function CompleteScreen({
  session,
  expResult,
  avatar,
  levelInfo,
  notes,
  onNotesChange,
  onContinue,
  onBreak,
  onEnd,
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Session complete</Text>
      <Text style={styles.summary}>
        You focused on "{session.description}" for {session.durationMinutes} minutes.
      </Text>
      {session.bonusMultiplier && session.bonusMultiplier > 1 && (
        <Text style={styles.muted}>
          Bonuses applied (x{session.bonusMultiplier.toFixed(2)} EXP)
          {session.comboBonus ? " • combo" : ""}
          {session.restBonus ? " • well-rested" : ""}
        </Text>
      )}
      <View style={styles.blockRow}>
        <View style={styles.expCol}>
          <Text style={styles.label}>Total EXP</Text>
          <Text style={styles.expValue}>+{expResult.totalExp}</Text>
        </View>
        {expResult.standExp && (
          <View style={styles.expCol}>
            <Text style={styles.label}>Stand gains</Text>
            <Text style={styles.expValue}>
              {Object.entries(expResult.standExp)
                .filter(([, v]) => (v ?? 0) > 0)
                .map(([k, v]) => `${k}+${v}`)
                .join("  ") || "—"}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.block}>
        <View style={styles.avatarHeader}>
          <Text style={styles.label}>Avatar</Text>
          <Text style={styles.muted}>
            Lv {avatar.level} • {levelInfo.current} / {levelInfo.required} EXP
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${levelInfo.ratio * 100}%` }]}
          />
        </View>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>Want to jot down what you did?</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Optional reflection, what you finished, or how it felt."
        />
      </View>
      <View style={styles.rowBetween}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onContinue}>
          <Text style={styles.primaryBtnText}>Continue this quest</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.rowBetween}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBreak}>
          <Text style={styles.secondaryBtnText}>Take a break</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={onEnd}>
          <Text style={styles.ghostBtnText}>End for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
