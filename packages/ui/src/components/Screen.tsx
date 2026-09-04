import React from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

import { colors, spacing } from "../tokens";

export interface ScreenProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

/** Consistent safe-area + horizontal padding wrapper for top-level screens.
 * Keyboard-avoiding by default so on-screen content (e.g. a submit button
 * below a text field) never ends up hidden behind the keyboard. Also
 * dismisses the keyboard on any tap that isn't itself a nested touchable
 * (a TextField, a Button, a message bubble) — RN's responder system
 * resolves to the innermost touchable first, so this only fires on
 * genuinely "empty" taps. Fixes every screen that renders a text input at
 * once instead of per-screen: without this, tapping outside a focused
 * TextField did nothing and there was no way to leave it (confirmed live
 * on the customer RequestSubmission screen). */
export function Screen({ children, style, edges = ["top", "bottom"] }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={[styles.content, style]} onPress={Keyboard.dismiss}>
          {children}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
