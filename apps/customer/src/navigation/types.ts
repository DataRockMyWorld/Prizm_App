import type { Address, JobRequest } from "@prizm/api";

export type RequestStackParamList = {
  Tabs: undefined;
  RequestSubmission: { categoryId?: number };
  Searching: { jobId: number };
  Matched: { jobId: number };
  JobStatus: { jobId: number };
  Chat: { jobId: number };
  ReportProblem: { jobId: number };
  ReportChat: { jobId: number; messageId?: number; messageText?: string };
  PriceAgreement: { jobId: number };
  Rating: { jobId: number };
  JobDetail: { jobId: number };
  /** Omit `address` to add a new one; pass it to edit an existing one. */
  AddressForm: { address?: Address } | undefined;
  ComingSoon: { title: string };
  HelpSupport: undefined;
  SafetyTips: undefined;
  TermsLiability: undefined;
  /** Account deletion — 5-screen flow (D1b/D2b/D3/D4/D5 in the hi-fi
   * design), see docs/prds/app-store-readiness.md §5d. Entry point is a
   * pre-check from the Profile row, not a fixed first screen — see
   * ProfileScreen. */
  DeleteAccountWarning: undefined;
  DeleteAccountBlocked: { job: JobRequest };
  DeleteAccountPin: undefined;
  DeleteAccountConfirm: undefined;
  AccountDeleted: undefined;
};
