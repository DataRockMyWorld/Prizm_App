import { LinearGradient } from "expo-linear-gradient";
import React, { useRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { colors, fontFamily, fontSize } from "../tokens";
import { ThemedText } from "./ThemedText";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
}

/** Six-box OTP entry backed by a single hidden TextInput (native numeric keyboard). */
export function OtpInput({ length = 6, value, onChangeText, autoFocus }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.split("");

  return (
    // Same generous hitSlop as PinEntry — this box row is a small target
    // on a full-size screen, and a near-miss tap silently does nothing.
    <Pressable
      style={styles.row}
      onPress={() => inputRef.current?.focus()}
      hitSlop={{ top: 24, bottom: 24, left: 40, right: 40 }}
    >
      {Array.from({ length }).map((_, index) => {
        const digit = digits[index];
        const isFilled = digit !== undefined;
        const isCursor = index === digits.length;
        return isFilled ? (
          <LinearGradient
            key={index}
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.box}
          >
            <ThemedText style={styles.digitFilled}>{digit}</ThemedText>
          </LinearGradient>
        ) : (
          <View
            key={index}
            style={[styles.box, styles.boxEmpty, isCursor && styles.boxCursor]}
          />
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        maxLength={length}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  boxEmpty: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  boxCursor: {
    borderColor: colors.primary,
  },
  digitFilled: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize.lg,
    color: colors.textInverse,
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
