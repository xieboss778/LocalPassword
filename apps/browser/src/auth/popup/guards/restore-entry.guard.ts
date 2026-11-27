import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { AuthService } from "@localpass/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@localpass/common/auth/enums/authentication-status";

/**
 * 恢复页对两种人开放：还没有账户的人（首次恢复），以及忘记安全密码、正被锁定的账户。
 * 已解锁的人不需要恢复，直接送回保险库。
 */
export const restoreEntryGuard: CanActivateFn = async () => {
  const accountService = inject(AccountService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const activeUser = await firstValueFrom(accountService.activeAccount$);
  if (!activeUser) {
    return true;
  }

  const status = await firstValueFrom(authService.authStatusFor$(activeUser.id));
  if (status === AuthenticationStatus.Unlocked) {
    return router.createUrlTree(["/tabs/current"]);
  }

  return true;
};
