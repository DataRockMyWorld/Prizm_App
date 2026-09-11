import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { AccountDeletedScreen } from "../screens/AccountDeletedScreen";
import { AddressFormScreen } from "../screens/AddressFormScreen";
import { ComingSoonScreen } from "../screens/ComingSoonScreen";
import { DeleteAccountBlockedScreen } from "../screens/DeleteAccountBlockedScreen";
import { DeleteAccountConfirmScreen } from "../screens/DeleteAccountConfirmScreen";
import { DeleteAccountPinScreen } from "../screens/DeleteAccountPinScreen";
import { DeleteAccountWarningScreen } from "../screens/DeleteAccountWarningScreen";
import { HelpSupportScreen } from "../screens/HelpSupportScreen";
import { JobDetailScreen } from "../screens/JobDetailScreen";
import { SafetyTipsScreen } from "../screens/SafetyTipsScreen";
import { TermsLiabilityScreen } from "../screens/TermsLiabilityScreen";
import { ChatScreen } from "../screens/request/ChatScreen";
import { ConfirmQuoteScreen } from "../screens/request/ConfirmQuoteScreen";
import { JobStatusScreen } from "../screens/request/JobStatusScreen";
import { MatchedScreen } from "../screens/request/MatchedScreen";
import { RatingScreen } from "../screens/request/RatingScreen";
import { ReportChatScreen } from "../screens/request/ReportChatScreen";
import { ReportProblemScreen } from "../screens/request/ReportProblemScreen";
import { RequestSubmissionScreen } from "../screens/request/RequestSubmissionScreen";
import { SearchingScreen } from "../screens/request/SearchingScreen";
import { WorkerDeclinedScreen } from "../screens/request/WorkerDeclinedScreen";
import { RootTabs } from "./RootTabs";
import type { RequestStackParamList } from "./types";

const Stack = createNativeStackNavigator<RequestStackParamList>();

/** Main tabs, plus the full request flow (screens C1-C5/C7 in the design)
 * reachable from Home's category grid / "Request a Service" button. */
export function RequestNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RootTabs} />
      <Stack.Screen
        name="RequestSubmission"
        component={RequestSubmissionScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen name="Searching" component={SearchingScreen} />
      <Stack.Screen name="Matched" component={MatchedScreen} />
      <Stack.Screen name="JobStatus" component={JobStatusScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen
        name="ReportProblem"
        component={ReportProblemScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="ReportChat"
        component={ReportChatScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen name="ConfirmQuote" component={ConfirmQuoteScreen} />
      <Stack.Screen
        name="WorkerDeclined"
        component={WorkerDeclinedScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Rating" component={RatingScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen
        name="AddressForm"
        component={AddressFormScreen}
        options={{ presentation: "modal" }}
      />
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
  );
}
