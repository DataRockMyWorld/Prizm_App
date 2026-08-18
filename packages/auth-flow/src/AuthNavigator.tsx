import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { ConfirmPinScreen } from "./screens/ConfirmPinScreen";
import { CreatePinScreen } from "./screens/CreatePinScreen";
import { LoginPinScreen } from "./screens/LoginPinScreen";
import { OtpScreen } from "./screens/OtpScreen";
import { PhoneNumberScreen } from "./screens/PhoneNumberScreen";
import type { AuthStackParamList, Role } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export interface AuthNavigatorProps {
  role: Role;
}

/** Phone -> OTP -> (new user: create+confirm PIN, registers) | (returning user: PIN login). */
export function AuthNavigator({ role }: AuthNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneNumberScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="LoginPin" component={LoginPinScreen} />
      <Stack.Screen name="CreatePin" component={CreatePinScreen} />
      <Stack.Screen name="ConfirmPin">
        {(props) => <ConfirmPinScreen {...props} role={role} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
