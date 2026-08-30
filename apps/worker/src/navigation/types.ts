import type { JobRequest } from "@prizm/api";

export type WorkerOnboardingStackParamList = {
  /** Instructions-only entry point for ID verification (screen 7 in the
   * hi-fi flow) — every "Upload your ID" call site should navigate here,
   * not straight to IdUpload, so the tips/example are always seen first. */
  IdVerificationInfo: undefined;
  IdUpload: undefined;
  /** Onboarding-only entry point for the certifications step — the Profile
   * tab's "+ Add another certificate" bypasses this and navigates straight
   * to Certifications with returnTo: "profile" instead (see below). */
  CertificationsInfo: undefined;
  /** `returnTo: "profile"` — reached from the Profile tab's "+ Add another
   * certificate" (not the onboarding sequence): returns to the Profile
   * screen on submit instead of continuing to UnderReview, hides the
   * onboarding-only "Skip for now" link, and skips the "step 2 of 2"
   * framing. */
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
  /** messageId + messageText set only when reporting one specific chat
   * message (long-press) — omitted for the header menu's general "Report
   * user" (see docs/prds/chat-safety.md §6a/§6b). */
  ReportChat: { jobId: number; messageId?: number; messageText?: string };
  ComingSoon: { title: string };
  HelpSupport: undefined;
  SafetyTips: undefined;
  TermsLiability: undefined;
  /** Account deletion — 5-screen flow (D1/D2/D3/D4/D5 in the hi-fi design),
   * see docs/prds/app-store-readiness.md §5d. Entry point is a pre-check
   * from the Profile row, not a fixed first screen — see ProfileScreen. */
  DeleteAccountWarning: undefined;
  DeleteAccountBlocked: { job: JobRequest };
  DeleteAccountPin: undefined;
  DeleteAccountConfirm: undefined;
  AccountDeleted: undefined;
} & WorkerOnboardingStackParamList;
