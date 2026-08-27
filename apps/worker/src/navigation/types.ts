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
  /** Read-only preview of a browsable nearby job — reachable from Home's
   * "Jobs near you" list regardless of verification status, since browsing
   * never requires being verified; only the hint copy changes. */
  JobPreview: {
    categoryName: string;
    description: string;
    distanceKm: number | null;
    priceMin: string;
    priceMax: string;
    createdAt: string;
    isVerified: boolean;
  };
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
