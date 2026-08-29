export type Role = "customer" | "worker";

export type AuthStackParamList = {
  Phone: undefined;
  Otp: { phoneNumber: string };
  LoginPin: { phoneNumber: string };
  CreatePin: { phoneNumber: string; otpToken: string };
  ConfirmPin: { phoneNumber: string; otpToken: string; pin: string };
};

