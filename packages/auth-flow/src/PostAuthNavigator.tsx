import React from "react";

import { ProfileScreen } from "./screens/ProfileScreen";

/** Basic profile (name/photo/liability ack) — the last onboarding step once
 * the user is authenticated. See each app's App.tsx for how "not finished
 * onboarding yet" is detected (profile.liability_acknowledged_at). Kept as
 * its own component (rather than inlining ProfileScreen directly in each
 * App.tsx) so both apps share one entry point. */
export function PostAuthNavigator() {
  return <ProfileScreen />;
}
