import { createNavigationContainerRef } from "@react-navigation/native";

import type { WorkerRootStackParamList } from "./types";

/** Lets code outside the navigation tree (e.g. the offer-polling provider,
 * mounted above the root stack) trigger navigation imperatively. */
export const navigationRef = createNavigationContainerRef<WorkerRootStackParamList>();
