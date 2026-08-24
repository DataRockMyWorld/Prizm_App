export type WorkerOnboardingStackParamList = {
  IdUpload: undefined;
  /** `returnTo: "profile"` — reached from the Profile tab's "+ Add another
   * certificate" (not the onboarding sequence): returns to the Profile
   * screen on submit instead of continuing to UnderReview, and hides the
   * onboarding-only "Skip for now" link. */
  Certifications: { returnTo?: "profile" } | undefined;
  UnderReview: undefined;
};

export type WorkerRootStackParamList = {
  Tabs: undefined;
  IncomingOffer: undefined;
  ActiveJob: { jobId: number };
  CancelJob: { jobId: number };
  ProposePrice: { jobId: number };
  WaitingForConfirmation: { jobId: number };
  JobComplete: { jobId: number };
  JobDetail: { jobId: number };
  Chat: { jobId: number };
  ComingSoon: { title: string };
  HelpSupport: undefined;
  SafetyTips: undefined;
  TermsLiability: undefined;
} & WorkerOnboardingStackParamList;
