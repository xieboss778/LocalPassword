import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  PlatformUtilsService,
} from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import {
  Argon2KdfConfig,
  KdfType,
  PBKDF2KdfConfig,
} from "@bitwarden/legacy-crypto";
import {
  ACCOUNT_OBJECT,
  CreateLocalAccountService,
  LocalAccountObject,
  S3Client,
  VaultBackupSyncService,
} from "@bitwarden/local-vault";

import { JslibModule } from "../../jslib.module";

/**
 * Restores a vault on a new device from `account.json` in cloud storage: read the wrapped key
 * material, prove the master password opens it, then pull the snapshot the other device pushed.
 */
@Component({
  selector: "auth-restore-vault",
  templateUrl: "./restore-vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    TypographyModule,
  ],
})
export class RestoreVaultComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly createLocalAccountService = inject(CreateLocalAccountService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly router = inject(Router);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly validationService = inject(ValidationService);

  protected readonly formGroup = this.formBuilder.group({
    endpoint: ["", [Validators.required]],
    region: ["auto", [Validators.required]],
    bucket: ["", [Validators.required]],
    accessKeyId: ["", [Validators.required]],
    secretAccessKey: ["", [Validators.required]],
    prefix: ["localpassword"],
    masterPassword: ["", [Validators.required]],
  });

  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  readonly submit = async (): Promise<void> => {
    if (this.busy()) {
      return;
    }

    this.formGroup.markAllAsTouched();
    this.errorMessage.set(null);
    if (this.formGroup.invalid) {
      return;
    }

    const value = this.formGroup.getRawValue();
    this.busy.set(true);
    try {
      const client = new S3Client({
        endpoint: value.endpoint ?? "",
        region: value.region ?? "auto",
        bucket: value.bucket ?? "",
        prefix: value.prefix ?? "",
        forcePathStyle: false,
        credentials: {
          accessKeyId: value.accessKeyId ?? "",
          secretAccessKey: value.secretAccessKey ?? "",
        },
      });

      const stored = await client.getText(ACCOUNT_OBJECT);
      if (stored == null) {
        this.errorMessage.set(this.i18nService.t("restoreNoAccountFile"));
        return;
      }

      const account = JSON.parse(stored.text) as LocalAccountObject;
      const userId = await this.createLocalAccountService.restoreAccount({
        email: account.email,
        masterPassword: value.masterPassword ?? "",
        unlock: {
          salt: account.unlock.salt,
          kdf: kdfFromJson(account.unlock.kdf),
          masterKeyWrappedUserKey: account.unlock.masterKeyWrappedUserKey,
        },
        wrappedPrivateKey: account.wrappedPrivateKey,
      });

      // Keep the same storage settings so the pulled snapshot and later backups use them.
      await this.syncService.configure(userId, {
        provider: "generic",
        endpoint: value.endpoint ?? "",
        region: value.region ?? "auto",
        bucket: value.bucket ?? "",
        accessKeyId: value.accessKeyId ?? "",
        secretAccessKey: value.secretAccessKey ?? "",
        prefix: value.prefix ?? "",
        forcePathStyle: false,
      });
      await this.syncService.pull(userId);

      this.platformUtilsService.showToast("success", "", this.i18nService.t("restoreFinished"));
      await this.router.navigate(["/"]);
    } catch (error) {
      this.errorMessage.set(this.i18nService.t("restoreFailed"));
      this.validationService.showError(error);
    } finally {
      this.busy.set(false);
    }
  };
}

/** `account.json` stores the KDF as plain JSON; rebuild the class the crypto layer expects. */
function kdfFromJson(json: unknown) {
  const typed = json as { kdfType?: number } | null;
  return typed?.kdfType === KdfType.PBKDF2_SHA256
    ? PBKDF2KdfConfig.fromJSON(typed as never)
    : Argon2KdfConfig.fromJSON(typed as never);
}
