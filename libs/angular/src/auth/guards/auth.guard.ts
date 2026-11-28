// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { AuthService } from "@localpass/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@localpass/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@localpass/common/auth/models/domain/force-set-password-reason";
import { KeyConnectorService } from "@localpass/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@localpass/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { LocalAccountService } from "@localpass/local-vault";

export const authGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  routerState: RouterStateSnapshot,
): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const messagingService = inject(MessagingService);
  const keyConnectorService = inject(KeyConnectorService);
  const accountService = inject(AccountService);
  const masterPasswordService = inject(MasterPasswordServiceAbstraction);
  const localAccountService = inject(LocalAccountService);

  const authStatus = await authService.getAuthStatus();

  if (authStatus === AuthenticationStatus.LoggedOut) {
    messagingService.send("authBlocked", { url: routerState.url });
    return false;
  }

  const userId = (await firstValueFrom(accountService.activeAccount$)).id;
  const forceSetPasswordReason = await firstValueFrom(
    masterPasswordService.forceSetPasswordReason$(userId),
  );

  // User JIT provisioned into a master-password-encryption org
  if (
    authStatus === AuthenticationStatus.Locked &&
    forceSetPasswordReason === ForceSetPasswordReason.SsoNewJitProvisionedUser &&
    !routerState.url.includes("set-initial-password")
  ) {
    return router.createUrlTree(["/set-initial-password"]);
  }

  // TDE Offboarding on untrusted device
  if (
    authStatus === AuthenticationStatus.Locked &&
    forceSetPasswordReason === ForceSetPasswordReason.TdeOffboardingUntrustedDevice &&
    !routerState.url.includes("set-initial-password")
  ) {
    return router.createUrlTree(["/set-initial-password"]);
  }

  // We must add exemptions for the SsoNewJitProvisionedUser and TdeOffboardingUntrustedDevice scenarios as
  // the "set-initial-password" route is guarded by the authGuard.
  if (
    authStatus === AuthenticationStatus.Locked &&
    forceSetPasswordReason !== ForceSetPasswordReason.SsoNewJitProvisionedUser &&
    forceSetPasswordReason !== ForceSetPasswordReason.TdeOffboardingUntrustedDevice
  ) {
    if (routerState != null) {
      messagingService.send("lockedUrl", { url: routerState.url });
    }
    // TODO PM-9674: when extension refresh is finished, remove promptBiometric
    // as it has been integrated into the component as a default feature.
    return router.createUrlTree(["lock"], {
      queryParams: { promptBiometric: true, redirectUrl: routerState.url },
    });
  }

  // Handle cases where a user needs to set a password when they don't already have one:
  // - TDE org user has been given "manage account recovery" permission
  // - TDE offboarding on a trusted device, where we have access to their encryption key wrap with their new password
  if (
    (forceSetPasswordReason ===
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission ||
      forceSetPasswordReason === ForceSetPasswordReason.TdeOffboarding) &&
    !routerState.url.includes("set-initial-password")
  ) {
    const route = "/set-initial-password";
    return router.createUrlTree([route]);
  }

  // Handle cases where a user has a password but needs to set a new one:
  // - Account recovery
  // - Weak Password on login
  if (
    (forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset ||
      forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword) &&
    !routerState.url.includes("change-password")
  ) {
    const route = "/change-password";
    return router.createUrlTree([route]);
  }

  // Remove password when Key Connector is enabled
  //
  // 本地保险库没有服务器，也永远不会同步；Key Connector 转换对它不适用。
  // `convertAccountRequired$` 会等待只有同步才会写入的 usesKeyConnector 状态，
  // 本地账号若走这条等待就会永不返回（存量账号尤其如此），这里直接跳过。
  const isLocalAccount = await localAccountService.isLocalAccount(userId);
  if (
    !isLocalAccount &&
    forceSetPasswordReason == ForceSetPasswordReason.None &&
    !routerState.url.includes("remove-password") &&
    (await firstValueFrom(keyConnectorService.convertAccountRequired$))
  ) {
    return router.createUrlTree(["/remove-password"]);
  }

  return true;
};
