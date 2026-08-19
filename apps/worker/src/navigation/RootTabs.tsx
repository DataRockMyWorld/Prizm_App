import { Ionicons } from "@expo/vector-icons";
import { colors, fontFamily } from "@prizm/ui";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";

import { BookingsScreen } from "../screens/BookingsScreen";
import { EarningsScreen } from "../screens/EarningsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { JobsScreen } from "../screens/JobsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

export type RootTabParamList = {
  Home: undefined;
  Jobs: undefined;
  Bookings: undefined;
  Earnings: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Jobs: "briefcase",
  Bookings: "calendar",
  Earnings: "wallet",
  Profile: "person",
};

export function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fontFamily.semiBold, fontSize: 12 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof RootTabParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
