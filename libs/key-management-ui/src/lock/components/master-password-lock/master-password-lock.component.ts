import {
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { ClientType } from "@localpass/client-type";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { UserKey } from "@localpass/common/types/key";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  ToastService,
} from "@localpass/components";
import { BiometricsStatus, KeyService } from "@localpass/key-management";
import { LogService } from "@localpass/logging";
import { CommandDefinition, MessageListener } from "@localpass/messaging";
import { UnlockService } from "@localpass/unlock";
import { UserId } from "@localpass/user-core";

import { UnlockOptions } from "../../services/lock-component.service";
import { UnlockViaPrfComponent } from "../unlock-via-prf.component";

const MAX_INVALID_PASSWORD_ATTEMPTS = 5;

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-master-password-lock",
  templateUrl: "master-password-lock.component.html",
  imports: [
    JslibModule,
    ReactiveFormsModule,
    ButtonModule,
    FormFieldModule,
    AsyncActionsModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    UnlockViaPrfComponent,
  ],
})
export class MasterPasswordLockComponent implements OnInit, OnDestroy {
  private readonly accountService = inject(AccountService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly messageListener = inject(MessageListener);
  private readonly unlockService = inject(UnlockService);
  private readonly keyService = inject(KeyService);

  readonly unlockOptions = input.required<UnlockOptions>();
  readonly biometricUnlockBtnText = input.required<string>();
  /** LocalPass lock screens expose "restore from backup" next to the security-key link. */
  readonly showRestore = input(false);
  readonly showPinSwap = computed(() => this.unlockOptions().pin.enabled ?? false);
  readonly biometricsAvailable = computed(() => this.unlockOptions().biometrics.enabled ?? false);
  readonly showBiometricsSwap = computed(() => {
    const status = this.unlockOptions().biometrics.biometricsStatus;
    return (
      status !== BiometricsStatus.PlatformUnsupported &&
      status !== BiometricsStatus.NotEnabledLocally
    );
  });

  successfulUnlock = output<{ userKey: UserKey; masterPassword: string }>();
  swapToBiometrics = output<void>();
  swapToPin = output<void>();
  prfUnlockSuccess = output<UserKey>();
  logOut = output<void>();
  restore = output<void>();

  protected readonly isBrowser = this.platformUtilsService.getClientType() === ClientType.Browser;
  protected readonly isLocalClient =
    this.platformUtilsService.getClientType() === ClientType.Browser ||
    this.platformUtilsService.getClientType() === ClientType.Desktop;

  protected showPassword = false;
  /** LocalPass: repeated wrong passwords pause the form instead of ever logging out or wiping. */
  protected readonly waitingSeconds = signal(0);
  protected readonly waiting = computed(() => this.waitingSeconds() > 0);
  private invalidAttempts = 0;
  private waitUntil = 0;
  private waitTimer: ReturnType<typeof setInterval> | null = null;
  private destroy$ = new Subject<void>();

  formGroup = new FormGroup({
    masterPassword: new FormControl("", {
      validators: [Validators.required],
      updateOn: "submit",
    }),
  });

  async ngOnInit(): Promise<void> {
    if (this.platformUtilsService.getClientType() === ClientType.Desktop) {
      this.messageListener
        .messages$(new CommandDefinition("windowHidden"))
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.showPassword = false;
        });
    }
  }

  ngOnDestroy(): void {
    this.stopWaitTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    if (this.waiting()) {
      return;
    }

    this.formGroup.markAllAsTouched();
    const masterPassword = this.formGroup.controls.masterPassword.value;
    if (this.formGroup.invalid || !masterPassword) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordRequired"),
      });
      return;
    }

    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    // Unlocking runs the KDF synchronously on the main thread, which blocks rendering. The button
    // shows its spinner at once (`instantSpinner`); wait until it has been painted, one frame,
    // rather than through the 75 ms spinner debounce.
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

    await this.unlockViaMasterPassword(masterPassword, activeUserId);
  };

  private async unlockViaMasterPassword(
    masterPassword: string,
    activeUserId: UserId,
  ): Promise<void> {
    try {
      await this.unlockService.unlockWithMasterPassword(activeUserId, masterPassword);
      this.invalidAttempts = 0;
      this.stopWaitTimer();
      const userKey = await firstValueFrom(this.keyService.userKey$(activeUserId));
      if (!userKey) {
        this.logService.error(
          "[MasterPasswordLockComponent] Failed to retrieve user key after master password unlock",
        );
        throw Error("Failed to retrieve user key");
      }
      this.successfulUnlock.emit({ userKey: userKey, masterPassword });
    } catch (error) {
      this.logService.error(
        "[MasterPasswordLockComponent] Failed to unlock via master password",
        error,
      );

      this.invalidAttempts++;
      if (this.invalidAttempts >= MAX_INVALID_PASSWORD_ATTEMPTS) {
        // 5th wrong password waits 30s, then 60s for each further failure. Never destroys data.
        const over = this.invalidAttempts - MAX_INVALID_PASSWORD_ATTEMPTS;
        this.startWait(Math.min(60_000, 30_000 * 2 ** over));
        return;
      }

      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidMasterPassword"),
      });
    }
  }

  private startWait(waitMs: number): void {
    this.stopWaitTimer();
    this.waitUntil = Date.now() + waitMs;
    this.formGroup.controls.masterPassword.disable();
    this.formGroup.controls.masterPassword.reset();
    this.waitingSeconds.set(Math.ceil(waitMs / 1000));
    this.waitTimer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((this.waitUntil - Date.now()) / 1000));
      this.waitingSeconds.set(remaining);
      if (remaining === 0) {
        this.stopWaitTimer();
      }
    }, 250);
  }

  private stopWaitTimer(): void {
    if (this.waitTimer != null) {
      clearInterval(this.waitTimer);
      this.waitTimer = null;
    }
    this.waitingSeconds.set(0);
    if (this.formGroup.controls.masterPassword.disabled) {
      this.formGroup.controls.masterPassword.enable();
    }
  }

  onPrfUnlockSuccess(userKey: UserKey): void {
    this.prfUnlockSuccess.emit(userKey);
  }
}
