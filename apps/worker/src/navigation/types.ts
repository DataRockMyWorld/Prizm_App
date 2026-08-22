export type WorkerOnboardingStackParamList = {
  IdUpload: undefined;
  Certifications: undefined;
  UnderReview: undefined;
};

export type WorkerRootStackParamList = {
  Tabs: undefined;
  IncomingOffer: undefined;
  ActiveJob: { jobId: number };
  CancelJob: { jobId: number };
  ProposePrice: { jobId: number };
} & WorkerOnboardingStackParamList;
