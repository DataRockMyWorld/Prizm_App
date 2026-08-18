import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { BiometricScreen } from "./screens/BiometricScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import type { PostAuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<PostAuthStackParamList>();

/** Biometric opt-in -> basic profile (name/photo/liability ack). Runs once
 * the user is authenticated but hasn't finished onboarding yet — see each
 * app's App.tsx for how that's detected (profile.liability_acknowledged_at). */
export function PostAuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Biometric" component={BiometricScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
