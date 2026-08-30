import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { OfferPollingProvider } from "../offers/OfferPollingProvider";
import { AccountDeletedScreen } from "../screens/AccountDeletedScreen";
import { ActiveJobScreen } from "../screens/ActiveJobScreen";
import { CancelJobScreen } from "../screens/CancelJobScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { ComingSoonScreen } from "../screens/ComingSoonScreen";
import { DeleteAccountBlockedScreen } from "../screens/DeleteAccountBlockedScreen";
import { DeleteAccountConfirmScreen } from "../screens/DeleteAccountConfirmScreen";
import { DeleteAccountPinScreen } from "../screens/DeleteAccountPinScreen";
import { DeleteAccountWarningScreen } from "../screens/DeleteAccountWarningScreen";
import { HelpSupportScreen } from "../screens/HelpSupportScreen";
import { IncomingOfferScreen } from "../screens/IncomingOfferScreen";
import { JobCompleteScreen } from "../screens/JobCompleteScreen";
import { JobDetailScreen } from "../screens/JobDetailScreen";
import { JobPreviewScreen } from "../screens/JobPreviewScreen";
import { ProposePriceScreen } from "../screens/ProposePriceScreen";
import { ReportChatScreen } from "../screens/ReportChatScreen";
import { SafetyTipsScreen } from "../screens/SafetyTipsScreen";
import { TermsLiabilityScreen } from "../screens/TermsLiabilityScreen";
import { WaitingForConfirmationScreen } from "../screens/WaitingForConfirmationScreen";
import { CertificationsInfoScreen } from "../screens/onboarding/CertificationsInfoScreen";
import { CertificationsScreen } from "../screens/onboarding/CertificationsScreen";
import { IdUploadScreen } from "../screens/onboarding/IdUploadScreen";
import { IdVerificationInfoScreen } from "../screens/onboarding/IdVerificationInfoScreen";
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
          name="IdVerificationInfo"
          component={IdVerificationInfoScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="IdUpload" component={IdUploadScreen} />
        <Stack.Screen
          name="CertificationsInfo"
          component={CertificationsInfoScreen}
          options={{ presentation: "modal" }}
        />
        {/* Reached two ways: pushed from CertificationsInfo within the
            onboarding flow (plain push, that screen already owns the modal
            presentation) — or straight from the Profile tab's "+ Add
            another certificate" with returnTo: "profile", which has no
            modal screen underneath it and needs its own. */}
        <Stack.Screen
          name="Certifications"
          component={CertificationsScreen}
          options={({ route }) => ({
            presentation: route.params?.returnTo === "profile" ? "modal" : undefined,
          })}
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
        {/* gestureEnabled: false on ActiveJob/WaitingForConfirmation/JobComplete.
            Since T7, the Jobs tab can route back into an active job, so this
            is no longer a hard dead end — but deliberately still disabled:
            (1) an active job shouldn't be trivially swiped away from
            mid-task, matching how e.g. Uber's driver app behaves, and
            (2) swiping back from WaitingForConfirmation/JobComplete would
            still land on a stale ActiveJob screen with no rendering logic
            for awaiting_price_confirmation/completed — T7's fix doesn't
            touch that. Leaving via Cancel/Mark Complete/Done (explicit
            actions), or the Jobs tab, is always still available. */}
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
        <Stack.Screen name="JobDetail" component={JobDetailScreen} />
        <Stack.Screen name="JobPreview" component={JobPreviewScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="ReportChat" component={ReportChatScreen} />
        <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="SafetyTips" component={SafetyTipsScreen} />
        <Stack.Screen name="TermsLiability" component={TermsLiabilityScreen} />
        <Stack.Screen name="DeleteAccountWarning" component={DeleteAccountWarningScreen} />
        <Stack.Screen name="DeleteAccountBlocked" component={DeleteAccountBlockedScreen} />
        <Stack.Screen name="DeleteAccountPin" component={DeleteAccountPinScreen} />
        <Stack.Screen name="DeleteAccountConfirm" component={DeleteAccountConfirmScreen} />
        <Stack.Screen
          name="AccountDeleted"
          component={AccountDeletedScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </OfferPollingProvider>
  );
}
