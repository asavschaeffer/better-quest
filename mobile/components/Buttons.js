import React from "react";
import { TouchableOpacity, Text } from "react-native";
import styles from "../../style";

export function PrimaryButton({ title, onPress, style, textStyle, ...rest }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, style]}
      onPress={onPress}
      {...rest}
    >
      <Text style={[styles.primaryBtnText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ title, onPress, style, textStyle, ...rest }) {
  return (
    <TouchableOpacity
      style={[styles.secondaryBtn, style]}
      onPress={onPress}
      {...rest}
    >
      <Text style={[styles.secondaryBtnText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function GhostButton({ title, onPress, style, textStyle, ...rest }) {
  return (
    <TouchableOpacity style={[styles.ghostBtn, style]} onPress={onPress} {...rest}>
      <Text style={[styles.ghostBtnText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function DangerButton({ title, onPress, style, textStyle, ...rest }) {
  return (
    <TouchableOpacity
      style={[styles.dangerBtn, style]}
      onPress={onPress}
      {...rest}
    >
      <Text style={[styles.dangerBtnText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}
