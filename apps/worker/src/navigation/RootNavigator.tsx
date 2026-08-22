import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { OfferPollingProvider } from "../offers/OfferPollingProvider";
import { IncomingOfferScreen } from "../screens/IncomingOfferScreen";
import { CertificationsScreen } from "../screens/onboarding/CertificationsScreen";
import { IdUploadScreen } from "../screens/onboarding/IdUploadScreen";
import { UnderReviewScreen } from "../screens/onboarding/UnderReviewScreen";
import { RootTabs } from "./RootTabs";
import type { WorkerRootStackParamList } from "./types";

const Stack = createNativeStackNavigator<WorkerRootStackParamList>();

/** Main tabs, plus the ID/certification verification flow reachable from
 * the Home tab's "Upload your ID" banner (screens 8-10 in the design), plus
 * the global incoming-offer interrupt (W1) that can appear over any tab. */
export function RootNavigator() {
  return (
    <OfferPollingProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={RootTabs} />
        <Stack.Screen
          name="IdUpload"
          component={IdUploadScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="Certifications"
          component={CertificationsScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="UnderReview"
          component={UnderReviewScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="IncomingOffer"
          component={IncomingOfferScreen}
          options={{ presentation: "fullScreenModal", gestureEnabled: false }}
        />
      </Stack.Navigator>
    </OfferPollingProvider>
  );
}
