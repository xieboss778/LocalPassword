import { CommonModule, Location } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, Subject, firstValueFrom, map, of, startWith, switchMap } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { AuthService } from "@localpass/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@localpass/common/auth/enums/authentication-status";
import { LogoutService } from "@localpass/common/auth/logout";
import {
  VaultTimeoutAction,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
} from "@localpass/common/key-management/vault-timeout";
import { UserId } from "@localpass/common/types/guid";
import {
  AvatarModule,
  ButtonModule,
  DialogService,
  IconModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@localpass/components";
import { LockService, LockSource } from "@localpass/unlock";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { AccountComponent } from "./account.component";
import { CurrentAccountComponent } from "./current-account.component";
import { AccountSwitcherService } from "./services/account-switcher.service";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "account-switcher.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    ItemModule,
    AvatarModule,
    IconModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    AccountComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class AccountSwitcherComponent implements OnInit, OnDestroy {
  readonly lockedStatus = AuthenticationStatus.Locked;
  private destroy$ = new Subject<void>();

  loading = false;
  activeUserCanLock = false;
  enableAccountSwitching$: Observable<boolean>;

  constructor(
    private accountSwitcherService: AccountSwitcherService,
    private accountService: AccountService,
    private vaultTimeoutService: VaultTimeoutService,
    private dialogService: DialogService,
    private location: Location,
    private router: Router,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private authService: AuthService,
    private lockService: LockService,
    private logoutService: LogoutService,
  ) {
    this.enableAccountSwitching$ = this.accountSwitcherService.accountSwitchingEnabled$();
  }

  get accountLimit() {
    return this.accountSwitcherService.ACCOUNT_LIMIT;
  }

  get specialAddAccountId() {
    return this.accountSwitcherService.SPECIAL_ADD_ACCOUNT_ID;
  }

  readonly availableAccounts$ = this.accountSwitcherService.availableAccounts$;
  readonly currentAccount$ = this.accountService.activeAccount$.pipe(
    switchMap((a) =>
      a == null
        ? of(null)
        : this.authService.activeAccountStatus$.pipe(map((s) => ({ ...a, status: s }))),
    ),
  );

  readonly showLockAll$ = this.availableAccounts$.pipe(
    startWith([]),
    map((accounts) => accounts.filter((a) => !a.isActive)),
    switchMap((accounts) => {
      // If account switching is disabled, don't show the lock all button
      // as only one account should be shown.
      return this.accountSwitcherService.accountSwitchingEnabled$().pipe(
        switchMap((enabled) => {
          if (!enabled) {
            return of(false);
          }

          // When there are inactive accounts provide the option to lock all accounts
          // Note: "Add account" is counted as an inactive account, so check for more than one account
          return of(accounts.length > 1);
        }),
      );
    }),
  );

  async ngOnInit() {
    const availableVaultTimeoutActions = await firstValueFrom(
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
    );
    this.activeUserCanLock = availableVaultTimeoutActions.includes(VaultTimeoutAction.Lock);
  }

  back() {
    this.location.back();
  }

  async lock(userId: string) {
    this.loading = true;
    await this.lockService.lock(userId as UserId, LockSource.Manual);
    await this.router.navigate(["lock"]);
  }

  async lockAll() {
    this.loading = true;
    await this.lockService.lockAll(LockSource.Manual);
    await this.router.navigate(["lock"]);
  }

  async logOut(userId: UserId) {
    this.loading = true;
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      // LocalPass: logging out wipes a vault that has no server copy, so say so plainly.
      content: { key: "localVaultLogoutWarning" },
      type: "danger",
    });

    if (confirmed) {
      await this.logoutService.logout(userId, "userInitiated");
      // navigate to root so redirect guard can properly route next active user or null user to correct page
      await this.router.navigate(["/"]);
    }
    this.loading = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
