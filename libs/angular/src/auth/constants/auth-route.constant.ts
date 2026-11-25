/**
 * Constants for auth team owned full routes which are shared across clients.
 */
export const AuthRoute = Object.freeze({
  SignUp: "signup",
  FinishSignUp: "finish-signup",
  Login: "login",
  LoginWithDevice: "login-with-device",
  AdminApprovalRequested: "admin-approval-requested",
  PasswordHint: "hint",
  LoginInitiated: "login-initiated",
  SetInitialPassword: "set-initial-password",
  ChangePassword: "change-password",
  Sso: "sso",
  TwoFactor: "2fa",
  AuthenticationTimeout: "authentication-timeout",
  NewDeviceVerification: "device-verification",
  LoginWithPasskey: "login-with-passkey",
  // LocalPass: the vault is created on this device instead of an account being registered.
  CreateLocalVault: "create-local-vault",
} as const);

export type AuthRoute = (typeof AuthRoute)[keyof typeof AuthRoute];
