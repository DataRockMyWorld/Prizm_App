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
    <Pressable onPress={() => inputRef.current?.focus()}>
      <PinDots length={PIN_LENGTH} filled={value.length} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, PIN_LENGTH))}
        keyboardType="number-pad"
        secureTextEntry
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
