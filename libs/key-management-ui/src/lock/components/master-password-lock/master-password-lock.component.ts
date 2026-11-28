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
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { UserKey } from "@localpass/common/types/key";
import { AsyncActionsModule, IconModule, ToastService } from "@localpass/components";
import { BiometricsStatus, KeyService } from "@localpass/key-management";
import { LogService } from "@localpass/logging";
import { UnlockService } from "@localpass/unlock";
import { UserId } from "@localpass/user-core";

import { UnlockOptions } from "../../services/lock-component.service";
import { UnlockViaPrfComponent } from "../unlock-via-prf.component";

const MAX_INVALID_PASSWORD_ATTEMPTS = 5;
const MP_LOCKOUT_STORAGE_PREFIX = "lp:lockout:mp:";

interface StoredLockout {
  readonly attempts: number;
  readonly waitUntil: number;
}

function readStoredLockout(key: string): StoredLockout {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) {
      return { attempts: 0, waitUntil: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<StoredLockout>;
    return {
      attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
      waitUntil: typeof parsed.waitUntil === "number" ? parsed.waitUntil : 0,
    };
  } catch {
    return { attempts: 0, waitUntil: 0 };
  }
}

function writeStoredLockout(key: string, value: StoredLockout | null): void {
  try {
    if (value == null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Storage may be unavailable in restricted contexts; in-memory backoff still applies.
  }
}

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-master-password-lock",
  templateUrl: "master-password-lock.component.html",
  imports: [
    JslibModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    IconModule,
    UnlockViaPrfComponent,
  ],
})
export class MasterPasswordLockComponent implements OnInit, OnDestroy {
  private readonly accountService = inject(AccountService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly unlockService = inject(UnlockService);
  private readonly keyService = inject(KeyService);

  readonly unlockOptions = input.required<UnlockOptions>();
  readonly biometricUnlockBtnText = input.required<string>();
  /** LocalPass lock screens expose "restore from backup" next to the security-key link. */
  readonly showRestore = input(false);
  /** Local vaults hide destructive logout because there is no cloud account to sign back into. */
  readonly showLogOut = input(true);
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

  /** LocalPass: repeated wrong passwords pause the form instead of ever logging out or wiping. */
  protected readonly waitingSeconds = signal(0);
  protected readonly waiting = computed(() => this.waitingSeconds() > 0);
  /** 等待态的大号倒计时，原型用 `mm:ss` 等宽数字呈现。 */
  protected readonly waitingClock = computed(() => {
    const seconds = this.waitingSeconds();
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  });
  private invalidAttempts = 0;
  private waitUntil = 0;
  private waitTimer: ReturnType<typeof setInterval> | null = null;
  private activeLockoutKey: string | null = null;

  formGroup = new FormGroup({
    masterPassword: new FormControl("", {
      validators: [Validators.required],
      updateOn: "submit",
    }),
  });

  async ngOnInit(): Promise<void> {
    try {
      const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      if (!activeUserId) {
        return;
      }
      this.activeLockoutKey = `${MP_LOCKOUT_STORAGE_PREFIX}${activeUserId}`;
      const stored = readStoredLockout(this.activeLockoutKey);
      this.invalidAttempts = stored.attempts;
      const remainingMs = stored.waitUntil - Date.now();
      if (remainingMs > 0) {
        this.startWait(remainingMs);
      }
    } catch {
      // Ignore if account stream has no active user yet.
    }
  }

  ngOnDestroy(): void {
    this.stopWaitTimer();
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
      this.waitUntil = 0;
      const key = `${MP_LOCKOUT_STORAGE_PREFIX}${activeUserId}`;
      this.activeLockoutKey = key;
      writeStoredLockout(key, null);
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
      const key = `${MP_LOCKOUT_STORAGE_PREFIX}${activeUserId}`;
      this.activeLockoutKey = key;
      if (this.invalidAttempts >= MAX_INVALID_PASSWORD_ATTEMPTS) {
        // 5th wrong password waits 30s, then 60s for each further failure. Never destroys data.
        const over = this.invalidAttempts - MAX_INVALID_PASSWORD_ATTEMPTS;
        const waitMs = Math.min(60_000, 30_000 * 2 ** over);
        writeStoredLockout(key, { attempts: this.invalidAttempts, waitUntil: Date.now() + waitMs });
        this.startWait(waitMs);
        return;
      }
      writeStoredLockout(key, { attempts: this.invalidAttempts, waitUntil: 0 });

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
