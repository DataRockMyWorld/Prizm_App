import type { Address } from "@prizm/api";

export type RequestStackParamList = {
  Tabs: undefined;
  RequestSubmission: { categoryId?: number };
  Searching: { jobId: number };
  Matched: { jobId: number };
  JobStatus: { jobId: number };
  Chat: { jobId: number };
  ReportProblem: { jobId: number };
  PriceAgreement: { jobId: number };
  Rating: { jobId: number };
  JobDetail: { jobId: number };
  /** Omit `address` to add a new one; pass it to edit an existing one. */
  AddressForm: { address?: Address } | undefined;
  ComingSoon: { title: string };
  HelpSupport: undefined;
  SafetyTips: undefined;
  TermsLiability: undefined;
};
