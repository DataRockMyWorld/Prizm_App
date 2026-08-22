import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/manrope";
import { AuthProvider, useAuth } from "@prizm/api";
import { AuthNavigator, PostAuthNavigator } from "@prizm/auth-flow";
import { SplashView } from "@prizm/ui";
import { NavigationContainer } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootNavigator } from "./src/navigation/RootNavigator";

SplashScreen.preventAutoHideAsync();

/** Auth/profile checks can resolve in a few ms — hold the brand splash up for at least this long. */
const MIN_SPLASH_MS = 1200;

const splash = (
  <>
    <SplashView icon="🔧" />
    <StatusBar style="light" />
  </>
);

function AppContent() {
  const { isLoading, isAuthenticated, profile } = useAuth();
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !minSplashElapsed) {
    return splash;
  }
  if (!isAuthenticated) {
    return <AuthNavigator role="worker" />;
  }
  if (!profile) {
    return splash;
  }
  if (!profile.liability_acknowledged_at) {
    return <PostAuthNavigator />;
  }
  return <RootNavigator />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
