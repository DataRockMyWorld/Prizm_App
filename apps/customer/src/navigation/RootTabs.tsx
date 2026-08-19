import { Ionicons } from "@expo/vector-icons";
import { colors, fontFamily } from "@prizm/ui";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";

import { BookingsScreen } from "../screens/BookingsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { MessagesScreen } from "../screens/MessagesScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RequestsScreen } from "../screens/RequestsScreen";

export type RootTabParamList = {
  Home: undefined;
  Requests: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Requests: "list",
  Bookings: "calendar",
  Messages: "chatbubble",
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
      <Tab.Screen name="Requests" component={RequestsScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
