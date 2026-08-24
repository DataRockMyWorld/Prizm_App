import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { AddressFormScreen } from "../screens/AddressFormScreen";
import { JobDetailScreen } from "../screens/JobDetailScreen";
import { JobStatusScreen } from "../screens/request/JobStatusScreen";
import { MatchedScreen } from "../screens/request/MatchedScreen";
import { PriceAgreementScreen } from "../screens/request/PriceAgreementScreen";
import { RatingScreen } from "../screens/request/RatingScreen";
import { ReportProblemScreen } from "../screens/request/ReportProblemScreen";
import { RequestSubmissionScreen } from "../screens/request/RequestSubmissionScreen";
import { SearchingScreen } from "../screens/request/SearchingScreen";
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
      <Stack.Screen
        name="ReportProblem"
        component={ReportProblemScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen name="PriceAgreement" component={PriceAgreementScreen} />
      <Stack.Screen name="Rating" component={RatingScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen
        name="AddressForm"
        component={AddressFormScreen}
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}
