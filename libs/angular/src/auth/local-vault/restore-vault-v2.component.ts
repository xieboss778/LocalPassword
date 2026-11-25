import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule } from "@localpass/components";
// account.json 里的 KDF 需要这个类；与既有 restore-vault.component.ts 同样的豁免。
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfType, PBKDF2KdfConfig } from "@localpass/legacy-crypto";
import {
  MergeConflict,
  ACCOUNT_OBJECT,
  CreateLocalAccountService,
  LocalAccountObject,
  S3Client,
  VaultBackupSyncService,
} from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  LpFieldComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "../../local-ui";

type RestoreState = "form" | "loading" | "conflict" | "error" | "done";

/**
 * 恢复向导（方向 C）：表单 → 读取 → 冲突复核 → 完成，四态各自可见。
 *
 * 合并规则本身在 `snapshot-merge`（纯函数、有单测）：两遍都改过的条目按更新时间较新的一侧胜出。
 * 这里不实现规则，只把结果摊开给用户过目——所以这不是「随便点一下覆盖」的恢复。
 */
@Component({
  selector: "auth-restore-vault-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    ButtonModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header
        [title]="i18n.t('restoreTitle')"
        [sub]="i18n.t('restoreSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @switch (state()) {
          @case ("form") {
            <lp-group [label]="i18n.t('backupStorage')">
              <lp-field
                [label]="i18n.t('backupEndpoint')"
                [value]="valueOf('endpoint')"
                (valueChange)="set('endpoint', $event)"
              />
              <lp-field
                [label]="i18n.t('backupBucket')"
                [value]="valueOf('bucket')"
                (valueChange)="set('bucket', $event)"
              />
              <lp-field
                [label]="i18n.t('backupPrefix')"
                [value]="valueOf('prefix')"
                (valueChange)="set('prefix', $event)"
              />
              <lp-field
                [label]="i18n.t('backupAccessKey')"
                [value]="valueOf('accessKeyId')"
                (valueChange)="set('accessKeyId', $event)"
              />
              <lp-field
                [label]="i18n.t('backupSecretKey')"
                [password]="true"
                [value]="valueOf('secretAccessKey')"
                (valueChange)="set('secretAccessKey', $event)"
              />
            </lp-group>

            <lp-group [label]="i18n.t('security')">
              <lp-field
                [label]="i18n.t('masterPassword')"
                [password]="true"
                [value]="valueOf('masterPassword')"
                (valueChange)="set('masterPassword', $event)"
              />
            </lp-group>

            <div class="tw-flex tw-gap-2 tw-px-3 tw-pt-3">
              <button
                type="button"
                bitButton
                buttonType="primary"
                [disabled]="busy()"
                (click)="submit()"
              >
                {{ i18n.t("restoreStart") }}
              </button>
            </div>
            @if (errorMessage()) {
              <p class="tw-px-4 tw-pt-3 tw-text-[11px] tw-text-[var(--lp-danger)]">
                {{ errorMessage() }}
              </p>
            }
          }

          @case ("loading") {
            <div class="tw-grid tw-h-[240px] tw-place-items-center">
              <div class="tw-text-center">
                <div
                  class="tw-mx-auto tw-mb-3 tw-size-8 tw-animate-spin tw-rounded-full tw-border-2 tw-border-[#dfe3ea] tw-border-t-[var(--lp-brand)]"
                ></div>
                <p class="tw-m-0 tw-text-[12px] tw-text-[var(--lp-ink-2)]">
                  {{ i18n.t("restoreLoading") }}
                </p>
                <p class="tw-m-0 tw-mt-1 tw-text-[10.5px] tw-text-[var(--lp-ink-3)]">
                  {{ i18n.t("restoreLoadingHint") }}
                </p>
              </div>
            </div>
          }

          @case ("conflict") {
            <div
              class="tw-mx-3 tw-mb-2 tw-rounded-[11px] tw-border tw-border-[#f6e2b8] tw-bg-[#fdf6e6] tw-px-3 tw-py-2.5 tw-text-[11px] tw-leading-relaxed tw-text-[#8a5a00]"
            >
              {{ i18n.t("restoreConflictHint") }}
            </div>
            <lp-group [label]="i18n.t('restoreConflictTitle')">
              @for (conflict of conflicts(); track conflict.id) {
                <lp-row
                  [label]="conflict.id"
                  [sub]="conflict.localRevision + ' → ' + conflict.remoteRevision"
                  [value]="
                    conflict.winner === 'local'
                      ? i18n.t('restoreWinnerLocal')
                      : i18n.t('restoreWinnerRemote')
                  "
                  [clickable]="false"
                />
              }
            </lp-group>
            <div class="tw-flex tw-gap-2 tw-px-3 tw-pt-3">
              <button type="button" bitButton buttonType="primary" (click)="finish()">
                {{ i18n.t("restoreConflictAccept") }}
              </button>
            </div>
          }

          @case ("error") {
            <div class="tw-grid tw-h-[240px] tw-place-items-center">
              <div class="tw-px-6 tw-text-center">
                <p class="tw-m-0 tw-text-[13px] tw-font-semibold tw-text-[var(--lp-danger)]">
                  {{ i18n.t("restoreFailed") }}
                </p>
                <p
                  class="tw-m-0 tw-mt-2 tw-text-[11px] tw-leading-relaxed tw-text-[var(--lp-ink-3)]"
                >
                  {{ errorMessage() }}
                </p>
                <button
                  type="button"
                  bitButton
                  buttonType="secondary"
                  class="tw-mt-4"
                  (click)="retry()"
                >
                  {{ i18n.t("retry") }}
                </button>
              </div>
            </div>
          }

          @case ("done") {
            <div class="tw-grid tw-h-[240px] tw-place-items-center">
              <div class="tw-text-center">
                <div class="tw-text-[26px]">✅</div>
                <p class="tw-m-0 tw-mt-2 tw-text-[13px] tw-font-semibold">
                  {{ i18n.t("restoreFinished") }}
                </p>
                <button
                  type="button"
                  bitButton
                  buttonType="primary"
                  class="tw-mt-4"
                  (click)="finish()"
                >
                  {{ i18n.t("continue") }}
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class RestoreVaultV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly createLocalAccountService = inject(CreateLocalAccountService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly router = inject(Router);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly state = signal<RestoreState>("form");
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly conflicts = signal<readonly MergeConflict[]>([]);

  protected readonly form = this.formBuilder.group({
    endpoint: ["", [Validators.required]],
    bucket: ["", [Validators.required]],
    accessKeyId: ["", [Validators.required]],
    secretAccessKey: ["", [Validators.required]],
    prefix: ["localpass"],
    masterPassword: ["", [Validators.required]],
  });

  protected valueOf(
    key: "endpoint" | "bucket" | "prefix" | "accessKeyId" | "secretAccessKey" | "masterPassword",
  ): string {
    return this.form.get(key)?.value ?? "";
  }

  protected set(
    key: "endpoint" | "bucket" | "prefix" | "accessKeyId" | "secretAccessKey" | "masterPassword",
    value: string,
  ): void {
    this.form.get(key)?.setValue(value);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.t("backupFieldsRequired"));
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);
    this.state.set("loading");

    try {
      const value = this.form.getRawValue();
      const client = new S3Client({
        endpoint: value.endpoint ?? "",
        region: "auto",
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
        throw new Error(this.i18n.t("restoreNoAccountFile"));
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

      await this.syncService.configure(userId, {
        provider: "generic",
        endpoint: value.endpoint ?? "",
        region: "auto",
        bucket: value.bucket ?? "",
        accessKeyId: value.accessKeyId ?? "",
        secretAccessKey: value.secretAccessKey ?? "",
        prefix: value.prefix ?? "",
        forcePathStyle: false,
      });

      const pulled = await this.syncService.pull(userId);
      if (pulled.conflicts.length > 0) {
        this.conflicts.set(pulled.conflicts);
        this.state.set("conflict");
        return;
      }

      this.state.set("done");
      this.platformUtilsService.showToast("success", "", this.i18n.t("restoreFinished"));
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : this.i18n.t("restoreFailed"));
      this.state.set("error");
    } finally {
      this.busy.set(false);
    }
  }

  protected retry(): void {
    this.state.set("form");
    this.errorMessage.set(null);
  }

  protected finish(): void {
    void this.router.navigate(["/"]);
  }
}

/** `account.json` 把 KDF 存成普通 JSON，恢复时重建加密层需要的类。 */
function kdfFromJson(json: unknown) {
  const typed = json as { kdfType?: number } | null;
  return typed?.kdfType === KdfType.PBKDF2_SHA256
    ? PBKDF2KdfConfig.fromJSON(typed as never)
    : Argon2KdfConfig.fromJSON(typed as never);
}
