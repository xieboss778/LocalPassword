import { CommonModule } from "@angular/common";
import { Component, inject, NgZone, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  timer,
  mergeMap,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { LpPopupHeaderComponent } from "@localpass/angular/local-ui";
import { InternalPolicyService } from "@localpass/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@localpass/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@localpass/common/auth/abstractions/account.service";
import { LogoutService } from "@localpass/common/auth/logout";
import { ForceSetPasswordReason } from "@localpass/common/auth/models/domain/force-set-password-reason";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { ClientType, DeviceType } from "@localpass/common/enums";
import { DeviceTrustServiceAbstraction } from "@localpass/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { EncryptedMigrator } from "@localpass/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@localpass/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@localpass/common/key-management/pin/pin.service.abstraction";
import { BroadcasterService } from "@localpass/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@localpass/common/platform/sync";
import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { UserId } from "@localpass/common/types/guid";
import { UserKey } from "@localpass/common/types/key";
import { LocalVaultWriter } from "@localpass/common/vault/abstractions/local-vault-writer.abstraction";
import {
  AnonLayoutWrapperDataService,
  AsyncActionsModule,
  DialogService,
  IconComponent,
  ToastService,
} from "@localpass/components";
import {
  KeyService,
  BiometricStateService,
  BiometricsService,
  BiometricsStatus,
  UserAsymmetricKeysRegenerationService,
} from "@localpass/key-management";
import { measured, PerfTrackGroup } from "@localpass/logging";
import { UnlockMethod, UnlockService } from "@localpass/unlock";

import {
  UnlockOption,
  LockComponentService,
  UnlockOptions,
  UnlockOptionValue,
} from "../services/lock-component.service";

import { MasterPasswordLockComponent } from "./master-password-lock/master-password-lock.component";
import { UnlockViaPrfComponent } from "./unlock-via-prf.component";

const BroadcasterSubscriptionId = "LockComponent";

const clientTypeToSuccessRouteRecord: Partial<Record<ClientType, string>> = {
  [ClientType.Web]: "vault",
  [ClientType.Desktop]: "vault",
  [ClientType.Browser]: "/tabs/current",
};

type AfterUnlockActions = {
  passwordEvaluation?: {
    masterPassword: string;
  };
};

/// The minimum amount of time to wait after a process reload for a biometrics auto prompt to be possible
/// Fixes safari autoprompt behavior
const AUTOPROMPT_BIOMETRICS_PROCESS_RELOAD_DELAY = 5000;

const PERF_TRACK_GROUP = PerfTrackGroup.Unlock;
const PERF_TRACK = "Lock Component";

const BIOMETRIC_UNLOCK_TEMPORARY_UNAVAILABLE_STATUSES = [
  BiometricsStatus.HardwareUnavailable,
  BiometricsStatus.DesktopDisconnected,
  BiometricsStatus.NotEnabledInConnectedDesktopApp,
];

const PIN_LOCKOUT_STORAGE_PREFIX = "lp:lockout:pin:";

function readPinLockout(key: string): { attempts: number; waitUntil: number } {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) {
      return { attempts: 0, waitUntil: 0 };
    }
    const parsed = JSON.parse(raw) as { attempts?: unknown; waitUntil?: unknown };
    return {
      attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
      waitUntil: typeof parsed.waitUntil === "number" ? parsed.waitUntil : 0,
    };
  } catch {
    return { attempts: 0, waitUntil: 0 };
  }
}

function writePinLockout(key: string, value: { attempts: number; waitUntil: number } | null): void {
  try {
    if (value == null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Ignore storage restriction; in-memory lockout still enforces delay.
  }
}

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-lock",
  templateUrl: "lock.component.html",
  host: {
    "data-testid": "lock-screen",
    "[class.agy-lock-page]": "isDesktop",
    "[class.tw-block]": "!isDesktop",
    "[class.tw-h-full]": "!isDesktop",
  },
  imports: [
    IconComponent,
    CommonModule,
    LpPopupHeaderComponent,
    JslibModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    UnlockViaPrfComponent,
    MasterPasswordLockComponent,
  ],
})
export class LockComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private activeAccountChange$ = new Subject<void>();
  protected loading = true;

  activeAccount: Account | null = null;

  clientType?: ClientType;

  unlockOptions: UnlockOptions | null = null;

  UnlockOption = UnlockOption;

  private _activeUnlockOptionBSubject: BehaviorSubject<UnlockOptionValue | null> =
    new BehaviorSubject<UnlockOptionValue | null>(null);

  activeUnlockOption$ = this._activeUnlockOptionBSubject.asObservable();

  set activeUnlockOption(value: UnlockOptionValue | null) {
    this._activeUnlockOptionBSubject.next(value);
  }

  get activeUnlockOption(): UnlockOptionValue | null {
    return this._activeUnlockOptionBSubject.value;
  }

  private invalidPinAttempts = 0;
  /** Until this timestamp the PIN form refuses entries instead of logging the user out. */
  private pinLockedUntil: number | null = null;
  private pinWaitTimer: ReturnType<typeof setInterval> | null = null;
  protected pinWaitingSeconds = 0;
  protected isLocalAccount = false;
  private unlockingViaPin = false;
  private readonly pinService = inject(PinServiceAbstraction);
  private readonly localVaultWriter = inject(LocalVaultWriter, { optional: true });

  biometricUnlockBtnText?: string;

  private enforcedMasterPasswordOptions?: MasterPasswordPolicyOptions = undefined;

  formGroup: FormGroup | null = null;

  // Browser extension properties:
  shouldClosePopout = false;

  // Desktop properties:
  private deferFocus: boolean | null = null;
  private biometricAsked = false;

  defaultUnlockOptionSetForUser = false;

  unlockingViaBiometrics = false;

  constructor(
    private accountService: AccountService,
    private keyService: KeyService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private dialogService: DialogService,
    private messagingService: MessagingService,
    private biometricStateService: BiometricStateService,
    private ngZone: NgZone,
    private i18nService: I18nService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private logService: LogService,
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private syncService: SyncService,
    private policyService: InternalPolicyService,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private userAsymmetricKeysRegenerationService: UserAsymmetricKeysRegenerationService,
    private biometricService: BiometricsService,
    private logoutService: LogoutService,
    private lockComponentService: LockComponentService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private encryptedMigrator: EncryptedMigrator,

    // desktop deps
    private broadcasterService: BroadcasterService,
    private unlockService: UnlockService,
  ) {}

  async ngOnInit() {
    this.listenForActiveUnlockOptionChanges();

    // Listen for active account changes
    this.listenForActiveAccountChanges();

    this.listenForUnlockOptionsChanges();

    // Identify client
    this.clientType = this.platformUtilsService.getClientType();

    if (this.clientType === ClientType.Desktop) {
      await this.desktopOnInit();
    } else if (this.clientType === ClientType.Browser) {
      this.biometricUnlockBtnText = this.lockComponentService.getBiometricsUnlockBtnText();
    }
  }

  private listenForUnlockOptionsChanges() {
    timer(0, 1000)
      .pipe(
        mergeMap(async () => {
          // Only perform polling after the component has loaded. This prevents multiple sources setting the default active unlock option on initialization.
          if (this.loading === false && this.activeAccount?.id != null) {
            const prevBiometricsEnabled = this.unlockOptions?.biometrics.enabled;

            this.unlockOptions = await firstValueFrom(
              this.lockComponentService.getAvailableUnlockOptions$(this.activeAccount.id),
            );

            if (this.activeUnlockOption == null) {
              await this.setDefaultActiveUnlockOption(this.unlockOptions);
            } else if (!prevBiometricsEnabled && this.unlockOptions?.biometrics.enabled) {
              await this.setDefaultActiveUnlockOption(this.unlockOptions);
              if (this.activeUnlockOption === UnlockOption.Biometrics) {
                await this.handleBiometricsUnlockEnabled(this.activeAccount.id);
              }
            }
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  // Base component methods
  private listenForActiveUnlockOptionChanges() {
    this.activeUnlockOption$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeUnlockOption: UnlockOptionValue | null) => {
        if (activeUnlockOption === UnlockOption.Pin) {
          this.buildPinForm();
        }
      });
  }

  private buildPinForm() {
    this.formGroup = this.formBuilder.group(
      {
        pin: ["", [Validators.required]],
      },
      { updateOn: "submit" },
    );
    if (this.pinWaitingSeconds > 0) {
      this.formGroup.controls.pin.disable();
    }
  }

  private listenForActiveAccountChanges() {
    this.accountService.activeAccount$
      .pipe(
        tap((account) => {
          this.loading = true;
          this.activeAccount = account;
          this.resetDataOnActiveAccountChange();
        }),
        filter((account): account is Account => account != null),
        switchMap(async (account) => {
          await this.handleActiveAccountChange(account);
          this.loading = false;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private async handleActiveAccountChange(activeAccount: Account) {
    // this account may be unlocked, prevent any prompts so we can redirect to vault
    if (await this.keyService.hasUserKey(activeAccount.id)) {
      return;
    }

    this.isLocalAccount = (await this.localVaultWriter?.isLocalAccount(activeAccount.id)) ?? false;
    this.restorePinLockoutState(activeAccount.id);

    this.setEmailAsPageSubtitle(activeAccount.email);

    this.unlockOptions = await firstValueFrom(
      this.lockComponentService.getAvailableUnlockOptions$(activeAccount.id),
    );

    // The canUseBiometrics query is an expensive operation. Only call if both PIN and master password unlock are unavailable.
    if (!this.unlockOptions?.masterPassword.enabled && !this.unlockOptions?.pin.enabled) {
      const canUseBiometrics = [
        BiometricsStatus.Available,
        ...BIOMETRIC_UNLOCK_TEMPORARY_UNAVAILABLE_STATUSES,
      ].includes(await this.biometricService.getBiometricsStatusForUser(activeAccount.id));
      if (!canUseBiometrics) {
        // User has no available unlock options, force logout. This happens for TDE users without a masterpassword, that don't have a persistent unlock method set.
        this.logService.warning("[LockComponent] User cannot unlock again. Logging out!");
        await this.logoutService.logout(activeAccount.id, "noUnlockOptionsAvailable");
        return;
      }
    }

    await this.setDefaultActiveUnlockOption(this.unlockOptions);

    // Every unlock of this user continues from here, except
    // for master password, as a policy evaluation has to be run
    this.unlockService.unlocked$
      .pipe(
        filter(
          (unlock) =>
            unlock.userId === activeAccount.id && unlock.method !== UnlockMethod.MasterPassword,
        ),
        take(1),
        takeUntil(this.activeAccountChange$),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.ngZone.run((): void => {
          void this.continueAfterSettingUserKey();
        });
      });

    if (this.unlockOptions?.biometrics.enabled) {
      await this.handleBiometricsUnlockEnabled(activeAccount.id);
    }
  }

  private resetDataOnActiveAccountChange() {
    this.activeAccountChange$.next();
    this.defaultUnlockOptionSetForUser = false;
    this.unlockOptions = null;
    this.activeUnlockOption = null;
    this.formGroup = null; // new form group will be created based on new active unlock option

    // Desktop properties:
    this.biometricAsked = false;
  }

  private setEmailAsPageSubtitle(email: string) {
    // LocalPass 的解锁卡片自带标题，不再把邮箱放进匿名布局的副标题。
    if (this.clientType === ClientType.Desktop) {
      return;
    }
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageSubtitle: email,
    });
  }

  private async setDefaultActiveUnlockOption(unlockOptions: UnlockOptions | null) {
    // Priorities should be Biometrics > Pin > Master Password for speed
    if (unlockOptions?.biometrics.enabled) {
      this.activeUnlockOption = UnlockOption.Biometrics;
    } else if (unlockOptions?.pin.enabled) {
      this.activeUnlockOption = UnlockOption.Pin;
    } else if (unlockOptions?.masterPassword.enabled) {
      this.activeUnlockOption = UnlockOption.MasterPassword;
    } else if (
      unlockOptions != null &&
      BIOMETRIC_UNLOCK_TEMPORARY_UNAVAILABLE_STATUSES.includes(
        unlockOptions.biometrics.biometricsStatus,
      )
    ) {
      // If biometrics is temporarily unavailable for masterpassword-less users, but they have biometrics configured,
      // then show the biometrics screen so the user knows why they can't unlock, and to give them the option to log out.
      this.activeUnlockOption = UnlockOption.Biometrics;
    }
  }

  private async handleBiometricsUnlockEnabled(userId: UserId) {
    this.biometricUnlockBtnText = this.lockComponentService.getBiometricsUnlockBtnText();

    const autoPromptBiometrics = await firstValueFrom(
      this.biometricStateService.promptAutomatically$(userId),
    );

    // TODO: PM-12546 - we need to make our biometric autoprompt experience consistent between the
    // desktop and extension.
    if (this.clientType === "desktop") {
      if (autoPromptBiometrics) {
        this.loading = false;
        await this.desktopAutoPromptBiometrics(userId);
      }
    }

    if (this.clientType === "browser") {
      if (
        this.unlockOptions?.biometrics.enabled &&
        autoPromptBiometrics &&
        (await this.biometricService.getShouldAutopromptNow())
      ) {
        await this.biometricService.setShouldAutopromptNow(false);

        const lastProcessReload = await this.biometricStateService.getLastProcessReload();
        if (
          lastProcessReload == null ||
          isNaN(lastProcessReload.getTime()) ||
          Date.now() - lastProcessReload.getTime() > AUTOPROMPT_BIOMETRICS_PROCESS_RELOAD_DELAY
        ) {
          // Firefox extension closes the popup when unfocused during biometric unlock, pop out the window to prevent infinite loop.
          if (this.platformUtilsService.getDevice() === DeviceType.FirefoxExtension) {
            await this.lockComponentService.popOutBrowserExtension();
            this.shouldClosePopout = true;
          }
          this.loading = false;
          await this.unlockViaBiometrics();
        }
      }
    }
  }

  // Note: this submit method is only used for unlock methods that require a form and user input.
  // For biometrics unlock, the method is called directly.
  submit = async (): Promise<void> => {
    if (this.activeUnlockOption === UnlockOption.Pin) {
      return await this.unlockViaPin();
    }
  };

  async swapUnlockOption(unlockOption: UnlockOptionValue): Promise<void> {
    this.activeUnlockOption = unlockOption;

    if (unlockOption === UnlockOption.Biometrics) {
      await this.unlockViaBiometrics();
    }
  }

  /** 忘记安全密码的唯一出路：从用户自己的备份恢复一个本机账户。 */
  restoreFromBackup(): void {
    void this.router.navigateByUrl("/restore-vault");
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      acceptButtonText: { key: "logOut" },
      type: "warning",
    });

    if (confirmed && this.activeAccount != null) {
      await this.logoutService.logout(this.activeAccount.id, "userInitiated");
      // navigate to root so redirect guard can properly route next active user or null user to correct page
      await this.router.navigate(["/"]);
    }
  }

  async unlockViaBiometrics(): Promise<void> {
    if (this.unlockingViaBiometrics) {
      return;
    }

    this.unlockingViaBiometrics = true;

    try {
      if (
        this.unlockOptions == null ||
        !this.unlockOptions.biometrics.enabled ||
        this.activeAccount == null
      ) {
        return;
      }

      await this.biometricStateService.setUserPromptCancelled(this.activeAccount.id);

      // Throws if the user cancels the biometric prompt.
      await this.unlockService.unlockWithBiometrics(this.activeAccount.id);
    } catch (e) {
      // Biometrics may fail if the user does not accept or if the desktop app is disconnected.
      this.logService.info("[LockComponent] Failed to unlock via biometrics.", e);
    } finally {
      this.unlockingViaBiometrics = false;
    }
  }

  async onPrfUnlockSuccess(userKey: UserKey): Promise<void> {
    if (this.activeAccount == null) {
      throw new Error("No active user.");
    }

    await this.unlockService.unlockWithDecryptedUserKey(
      this.activeAccount.id,
      userKey,
      UnlockMethod.Prf,
    );
  }

  /**
   * Tries the PIN as soon as it has as many characters as the PIN length the SDK stored, as if the
   * user pressed Unlock: a wrong PIN counts as an attempt like any other.
   */
  protected async tryPinWhenComplete(pin: string, form: HTMLFormElement): Promise<void> {
    if (this.activeAccount == null) {
      return;
    }

    const pinLength = await this.pinService.getPinLength(this.activeAccount.id);
    if (pinLength == null || pin.length !== pinLength) {
      return;
    }

    form.requestSubmit();
  }

  private validatePin(): boolean {
    if (this.formGroup?.invalid) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("pinRequired"),
      });
      return false;
    }

    return true;
  }

  private async unlockViaPin() {
    // The PIN is tried as soon as it is typed; an Enter right after must not try it again.
    if (this.unlockingViaPin) {
      return;
    }

    this.unlockingViaPin = true;
    try {
      await this.tryPin();
    } finally {
      this.unlockingViaPin = false;
    }
  }

  private async tryPin() {
    if (!this.validatePin() || this.formGroup == null || this.activeAccount == null) {
      return;
    }

    const pin = this.formGroup.controls.pin.value;

    const MAX_INVALID_PIN_ENTRY_ATTEMPTS = 5;

    // LocalPass: a local vault has no recovery path, so repeated wrong PINs must never log the
    // user out. Past the threshold they instead lock the form for a growing pause.
    if (this.pinLockedUntil == null || Date.now() >= this.pinLockedUntil) {
      this.pinLockedUntil = null;
    } else {
      return;
    }

    try {
      await this.unlockService.unlockWithPin(this.activeAccount.id, pin);
      this.invalidPinAttempts = 0;
      this.stopPinWaitTimer();
      writePinLockout(`${PIN_LOCKOUT_STORAGE_PREFIX}${this.activeAccount.id}`, null);
    } catch {
      // Failure state: invalid PIN or failed decryption
      this.invalidPinAttempts++;
      const storageKey = `${PIN_LOCKOUT_STORAGE_PREFIX}${this.activeAccount.id}`;

      if (this.invalidPinAttempts >= MAX_INVALID_PIN_ENTRY_ATTEMPTS) {
        // 5th attempt waits 30s, then 60s … capped at a minute. The vault is never destroyed.
        const over = this.invalidPinAttempts - MAX_INVALID_PIN_ENTRY_ATTEMPTS;
        const waitMs = Math.min(60_000, 30_000 * 2 ** over);
        writePinLockout(storageKey, {
          attempts: this.invalidPinAttempts,
          waitUntil: Date.now() + waitMs,
        });
        this.startPinWait(waitMs);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("tooManyInvalidPinAttemptsWait"),
        });
        return;
      }

      writePinLockout(storageKey, { attempts: this.invalidPinAttempts, waitUntil: 0 });

      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidPin"),
      });

      // A full-length PIN was tried automatically; clear it so the next one can be typed right away.
      const pinLength = await this.pinService.getPinLength(this.activeAccount.id);
      if (pin.length === pinLength) {
        this.formGroup.controls.pin.reset();
      }
    }
  }

  get pinWaitingClock(): string {
    const seconds = this.pinWaitingSeconds;
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  }

  private restorePinLockoutState(userId: UserId): void {
    const stored = readPinLockout(`${PIN_LOCKOUT_STORAGE_PREFIX}${userId}`);
    this.invalidPinAttempts = stored.attempts;
    const remainingMs = stored.waitUntil - Date.now();
    if (remainingMs > 0) {
      this.startPinWait(remainingMs);
    } else {
      this.stopPinWaitTimer();
    }
  }

  private startPinWait(waitMs: number): void {
    this.stopPinWaitTimer();
    this.pinLockedUntil = Date.now() + waitMs;
    this.pinWaitingSeconds = Math.ceil(waitMs / 1000);
    this.formGroup?.controls.pin.disable();
    this.formGroup?.controls.pin.reset();
    this.pinWaitTimer = setInterval(() => {
      const remaining =
        this.pinLockedUntil == null
          ? 0
          : Math.max(0, Math.ceil((this.pinLockedUntil - Date.now()) / 1000));
      this.pinWaitingSeconds = remaining;
      if (remaining === 0) {
        this.stopPinWaitTimer();
      }
    }, 250);
  }

  private stopPinWaitTimer(): void {
    if (this.pinWaitTimer != null) {
      clearInterval(this.pinWaitTimer);
      this.pinWaitTimer = null;
    }
    this.pinLockedUntil = null;
    this.pinWaitingSeconds = 0;
    if (this.formGroup?.controls.pin.disabled) {
      this.formGroup.controls.pin.enable();
    }
  }

  async successfulMasterPasswordUnlock(event: {
    userKey: UserKey;
    masterPassword: string;
  }): Promise<void> {
    if (event.userKey == null || !event.masterPassword) {
      this.logService.error(
        "[LockComponent] successfulMasterPasswordUnlock called with invalid data.",
      );
      return;
    }

    await this.continueAfterSettingUserKey({
      passwordEvaluation: {
        masterPassword: event.masterPassword,
      },
    });
  }

  /**
   * Shared tail of every unlock, run once the user key is set. Reached through
   * {@link UnlockService.unlocked$} rather than called by each unlock method, so that an unlock
   * performed elsewhere continues the same way as one performed here.
   */
  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  protected async continueAfterSettingUserKey(
    afterUnlockActions: AfterUnlockActions = {},
  ): Promise<void> {
    if (this.activeAccount == null) {
      throw new Error("No active user.");
    }

    // Add a mark to indicate that the user has unlocked their vault. A good starting point for measuring unlock performance.
    this.logService.mark("Vault unlocked");

    // Now that we have a decrypted user key in memory, we can check if we
    // need to establish trust on the current device
    await this.deviceTrustService.trustDeviceIfRequired(this.activeAccount.id);

    await this.doContinue(afterUnlockActions);
  }

  private async doContinue(afterUnlockActions: AfterUnlockActions) {
    if (this.activeAccount == null) {
      throw new Error("No active user.");
    }

    await this.biometricStateService.resetUserPromptCancelled(this.activeAccount.id);

    const masterPassword = afterUnlockActions.passwordEvaluation?.masterPassword ?? null;
    // Don't block login success on migration failure
    const migrations = this.encryptedMigrator
      .runMigrations(this.activeAccount.id, masterPassword)
      .catch(() => {});
    // Migrations that run without the master password can wait on the server. If the server is
    // unreachable, waiting for them leaves the user on the lock screen until the requests time out.
    if (masterPassword != null) {
      await migrations;
    }

    this.messagingService.send("unlocked");

    if (afterUnlockActions.passwordEvaluation) {
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      if (userId == null) {
        throw new Error("No active user.");
      }

      try {
        // If we do not have any saved policies, attempt to load them from the service
        if (this.enforcedMasterPasswordOptions == undefined) {
          this.enforcedMasterPasswordOptions = await firstValueFrom(
            this.accountService.activeAccount$.pipe(
              getUserId,
              switchMap((userId) => this.policyService.masterPasswordPolicyOptions$(userId)),
            ),
          );
        }

        if (this.requirePasswordChange(afterUnlockActions.passwordEvaluation.masterPassword)) {
          await this.masterPasswordService.setForceSetPasswordReason(
            ForceSetPasswordReason.WeakMasterPassword,
            userId,
          );
        }
      } catch (e) {
        // Do not prevent unlock if there is an error evaluating policies
        this.logService.error(e);
      }
    }

    if (this.platformUtilsService.getClientType() == ClientType.Web) {
      // Web does not cache vault data and would be in a unusable state when unlocked.
      await this.syncService.fullSync(true);
    } else {
      // On non-web clients, we start a sync in the background, but to not block by it
      void this.syncService.fullSync(false);
    }

    // TODO: This should probably not be blocking
    await this.userAsymmetricKeysRegenerationService.regenerateIfNeeded(this.activeAccount.id);

    if (this.clientType === "browser") {
      const previousUrl = this.lockComponentService.getPreviousUrl();
      /**
       * In a passkey flow, the `previousUrl` will still be `/fido2?<queryParams>` at this point
       * because the `/lock` route doesn't save the URL in the `BrowserRouterService`. This is
       * handled by the `doNotSaveUrl` property on the `/lock` route in `app-routing.module.ts`.
       */
      if (previousUrl) {
        await this.router.navigateByUrl(previousUrl);
        return;
      }
    }

    // Return to the page the guard interrupted, e.g. the menu-bar tray panel. Only local routes
    // are honoured: the query parameter comes from the URL and must not become an open redirect.
    // Contexts that disable automatic redirects keep control of their own post-unlock navigation.
    const redirectUrl = this.activatedRoute.snapshot.queryParamMap.get("redirectUrl");
    const redirectDisabled = this.activatedRoute.snapshot.paramMap.get("disable-redirect") !== null;
    if (!redirectDisabled && redirectUrl != null && isLocalRoute(redirectUrl)) {
      await this.router.navigateByUrl(redirectUrl);
      return;
    }

    // determine success route based on client type
    // The disable-redirect parameter allows callers to prevent automatic navigation after unlock,
    // useful when the lock component is used in contexts where custom post-unlock behavior is needed
    // such as passkey modals.
    if (
      this.clientType != null &&
      this.activatedRoute.snapshot.paramMap.get("disable-redirect") === null
    ) {
      const successRoute = clientTypeToSuccessRouteRecord[this.clientType];
      await this.router.navigate([successRoute]);
    }

    if (
      this.shouldClosePopout &&
      this.platformUtilsService.getDevice() === DeviceType.FirefoxExtension
    ) {
      this.lockComponentService.closeBrowserExtensionPopout();
    }
  }

  /**
   * Checks if the master password meets the enforced policy requirements
   * If not, returns false
   */
  private requirePasswordChange(masterPassword: string): boolean {
    if (
      this.enforcedMasterPasswordOptions == undefined ||
      !this.enforcedMasterPasswordOptions.enforceOnLogin ||
      this.activeAccount == null
    ) {
      return false;
    }

    const passwordStrength = this.passwordStrengthService.getPasswordStrength(
      masterPassword,
      this.activeAccount.email,
    )?.score;

    return !this.policyService.evaluateMasterPassword(
      passwordStrength,
      masterPassword,
      this.enforcedMasterPasswordOptions,
    );
  }

  // -----------------------------------------------------------------------------------------------
  // Desktop methods:
  // -----------------------------------------------------------------------------------------------

  async desktopOnInit() {
    this.biometricUnlockBtnText = this.lockComponentService.getBiometricsUnlockBtnText();

    // TODO: move this into a WindowService and subscribe to messages via MessageListener service.
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case "windowIsFocused":
            if (this.deferFocus === null) {
              this.deferFocus = !message.windowIsFocused;
              if (!this.deferFocus) {
                this.focusInput();
              }
            } else if (this.deferFocus && message.windowIsFocused) {
              this.focusInput();
              this.deferFocus = false;
            }
            break;
          default:
        }
      });
    });
    this.messagingService.send("getWindowIsFocused");
  }

  private async desktopAutoPromptBiometrics(userId: UserId) {
    if (!this.unlockOptions?.biometrics?.enabled || this.biometricAsked) {
      return;
    }

    if (!(await this.biometricService.getShouldAutopromptNow())) {
      return;
    }

    // prevent the biometric prompt from showing if the user has already cancelled it
    if (await firstValueFrom(this.biometricStateService.promptCancelled$(userId))) {
      return;
    }

    const windowVisible = await this.lockComponentService.isWindowVisible();

    if (windowVisible) {
      this.biometricAsked = true;
      await this.unlockViaBiometrics();
    }
  }

  private focusInput() {
    if (this.unlockOptions) {
      document.getElementById(this.unlockOptions.pin.enabled ? "pin" : "masterPassword")?.focus();
    }
  }

  // -----------------------------------------------------------------------------------------------

  ngOnDestroy() {
    this.stopPinWaitTimer();
    this.destroy$.next();
    this.destroy$.complete();

    if (this.clientType === "desktop") {
      this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    }
  }

  get biometricsAvailable(): boolean {
    return this.unlockOptions?.biometrics.enabled ?? false;
  }

  get isBrowser(): boolean {
    return this.clientType === ClientType.Browser;
  }

  get isDesktop(): boolean {
    return this.clientType === ClientType.Desktop;
  }

  get showBiometrics(): boolean {
    if (this.unlockOptions == null) {
      return false;
    }
    return (
      this.unlockOptions.biometrics.biometricsStatus !== BiometricsStatus.PlatformUnsupported &&
      this.unlockOptions.biometrics.biometricsStatus !== BiometricsStatus.NotEnabledLocally
    );
  }

  get biometricUnavailabilityReason(): string {
    switch (this.unlockOptions?.biometrics.biometricsStatus) {
      case BiometricsStatus.Available:
        return "";
      case BiometricsStatus.UnlockNeeded:
        return this.i18nService.t("biometricsStatusHelptextUnlockNeeded");
      case BiometricsStatus.HardwareUnavailable:
        return this.i18nService.t("biometricsStatusHelptextHardwareUnavailable");
      case BiometricsStatus.AutoSetupNeeded:
        return this.i18nService.t("biometricsStatusHelptextAutoSetupNeeded");
      case BiometricsStatus.ManualSetupNeeded:
        return this.i18nService.t("biometricsStatusHelptextManualSetupNeeded");
      case BiometricsStatus.NotEnabledInConnectedDesktopApp:
        return this.i18nService.t(
          "biometricsStatusHelptextNotEnabledInDesktop",
          this.activeAccount?.email,
        );
      case BiometricsStatus.NotEnabledLocally:
        return this.i18nService.t(
          "biometricsStatusHelptextNotEnabledInDesktop",
          this.activeAccount?.email,
        );
      case BiometricsStatus.DesktopDisconnected:
        return this.i18nService.t("biometricsStatusHelptextDesktopDisconnected");
      default:
        return (
          this.i18nService.t("biometricsStatusHelptextUnavailableReasonUnknown") +
          this.unlockOptions?.biometrics.biometricsStatus
        );
    }
  }
}

/**
 * Accepts only in-app paths. Absolute URLs and protocol-relative routes are rejected so a
 * crafted `redirectUrl` query parameter cannot turn the lock screen into an open redirect.
 */
function isLocalRoute(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/lock");
}
