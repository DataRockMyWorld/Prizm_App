import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { OfferPollingProvider } from "../offers/OfferPollingProvider";
import { ActiveJobScreen } from "../screens/ActiveJobScreen";
import { CancelJobScreen } from "../screens/CancelJobScreen";
import { IncomingOfferScreen } from "../screens/IncomingOfferScreen";
import { JobCompleteScreen } from "../screens/JobCompleteScreen";
import { ProposePriceScreen } from "../screens/ProposePriceScreen";
import { WaitingForConfirmationScreen } from "../screens/WaitingForConfirmationScreen";
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
        {/* gestureEnabled: false on ActiveJob/WaitingForConfirmation/JobComplete —
            the Jobs tab is still a read-only placeholder (T7), so swiping
            back out of an active job would be a dead end with no way back
            in; and swiping back from the later stages would land on a
            stale ActiveJob screen that doesn't render
            awaiting_price_confirmation/completed. Leaving via Cancel/
            Mark Complete/Done (explicit actions) is always still
            available — this only closes the accidental escape hatch. */}
        <Stack.Screen name="ActiveJob" component={ActiveJobScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="CancelJob"
          component={CancelJobScreen}
          options={{ presentation: "modal" }}
        />
        {/* Not a "modal" — this is a core forward-flow step (accept → stepper
            → propose price → waiting → complete), same category as
            ActiveJob, not a detour like CancelJob. */}
        <Stack.Screen name="ProposePrice" component={ProposePriceScreen} />
        <Stack.Screen
          name="WaitingForConfirmation"
          component={WaitingForConfirmationScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="JobComplete"
          component={JobCompleteScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </OfferPollingProvider>
  );
}
