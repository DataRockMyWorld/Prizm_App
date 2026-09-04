import { PinDots } from "@prizm/ui";
import React, { useRef } from "react";
import { Pressable, StyleSheet, TextInput } from "react-native";

export const PIN_LENGTH = 4;

export interface PinEntryProps {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
}

export function PinEntry({ value, onChangeText, autoFocus }: PinEntryProps) {
  const inputRef = useRef<TextInput>(null);
  return (
    // hitSlop: the visible PinDots row is small (~150x32) on a full-size
    // screen with a lot of empty space around it — confirmed live that a
    // tap landing just outside those exact bounds does nothing (no error,
    // no keyboard), which reads as "PIN entry is broken" when it's really
    // just a hard-to-hit target. Generous slop makes near-misses register.
    <Pressable onPress={() => inputRef.current?.focus()} hitSlop={{ top: 24, bottom: 24, left: 40, right: 40 }}>
      <PinDots length={PIN_LENGTH} filled={value.length} />
      {/* No secureTextEntry: this field is already visually invisible
       * (1x1, opacity 0) — PinDots is the only thing that ever renders the
       * digits, as filled/empty circles, never the raw value — so masking
       * here adds nothing. */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, PIN_LENGTH))}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        maxLength={PIN_LENGTH}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
