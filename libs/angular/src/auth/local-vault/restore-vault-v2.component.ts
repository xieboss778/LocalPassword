import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getOptionalUserId, getUserId } from "@localpass/common/auth/services/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@localpass/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { UserId } from "@localpass/common/types/guid";
import { UserKey } from "@localpass/common/types/key";
import { ButtonModule, CalloutModule } from "@localpass/components";
// account.json 里的 KDF 需要这个类；与既有 restore-vault.component.ts 同样的豁免。
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfType, PBKDF2KdfConfig } from "@localpass/legacy-crypto";
import {
  ACCOUNT_OBJECT,
  MergeConflict,
  CreateLocalAccountService,
  S3Client,
  SNAPSHOT_PREFIX,
  Snapshot,
  VaultBackupSyncService,
  isLocalAccountObject,
} from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  LpFieldComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
} from "../../local-ui";
import { formatSnapshotId } from "../../tools/backup/backup-time";

type RestoreState = "form" | "loading" | "conflict" | "error" | "done";

interface SnapshotRow {
  readonly id: string;
  readonly size: number;
}

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
    CalloutModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div
      class="tw-flex tw-h-full tw-flex-col"
      [class.tw-bg-background]="!desktop()"
      [class.tw-bg-background-alt]="desktop()"
    >
      @if (desktop()) {
        <lp-page-header [title]="i18n.t('restoreTitle')" [sub]="i18n.t('restoreSettingsDesc')">
          <button
            type="button"
            bitButton
            buttonType="primary"
            [disabled]="busy()"
            [loading]="busy()"
            data-testid="restore_start"
            (click)="startRestore()"
          >
            {{ i18n.t("restoreStartAction") }}
          </button>
        </lp-page-header>
      } @else {
        <lp-popup-header
          [title]="i18n.t('restoreTitle')"
          [sub]="i18n.t('restoreSubtitle')"
          [back]="true"
          (backTriggered)="goBack()"
        ></lp-popup-header>
      }

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @if (desktop()) {
          <div class="tw-flex tw-items-start tw-gap-4 tw-px-7 tw-pt-1">
            <div
              class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
            >
              <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
                {{ i18n.t("restoreSnapshotsTitle") }}
              </h2>
              @if (snapshotsLoading()) {
                <p class="tw-mb-0 tw-mt-3 tw-text-sm tw-text-muted">
                  {{ i18n.t("loading") }}
                </p>
              } @else if (!snapshots().length) {
                <p class="tw-mb-0 tw-mt-3 tw-text-sm tw-text-muted">
                  {{ i18n.t("backupNoSnapshots") }}
                </p>
              } @else {
                <div
                  class="tw-mt-3 tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
                  role="radiogroup"
                >
                  <ng-container [ngTemplateOutlet]="snapshotRows"></ng-container>
                </div>
              }
            </div>

            <aside
              class="tw-w-5/12 tw-flex-none tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
            >
              <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
                {{ i18n.t("restoreConfirmTitle") }}
              </h2>
              <div class="tw-mt-3">
                <lp-field
                  [label]="i18n.t('masterPassword')"
                  [password]="true"
                  [value]="valueOf('masterPassword')"
                  (valueChange)="set('masterPassword', $event)"
                />
              </div>
              <div class="tw-mt-3">
                <bit-callout type="warning" [title]="null">{{
                  i18n.t("restoreWarning")
                }}</bit-callout>
              </div>
              @if (savedError()) {
                <p class="tw-mb-0 tw-mt-3 tw-text-xs tw-text-fg-danger">{{ savedError() }}</p>
              }
            </aside>
          </div>
        } @else {
          @if (savedConfig()) {
            <div class="tw-px-3.5 tw-pt-3">
              <bit-callout type="warning" [title]="null">{{
                i18n.t("restoreWarning")
              }}</bit-callout>
            </div>

            <div class="tw-pt-1">
              <lp-field
                [label]="i18n.t('masterPassword')"
                [password]="true"
                [value]="valueOf('masterPassword')"
                (valueChange)="set('masterPassword', $event)"
                (blurred)="loadSnapshotsForSavedConfig()"
              />
            </div>

            @if (snapshotsLoading()) {
              <p class="tw-px-4 tw-pt-3 tw-text-sm tw-text-muted">
                {{ i18n.t("loading") }}
              </p>
            } @else if (!snapshots().length) {
              <p class="tw-px-4 tw-pt-3 tw-text-sm tw-text-muted">
                {{
                  i18n.t(valueOf("masterPassword") ? "backupNoSnapshots" : "restoreSnapshotsHint")
                }}
              </p>
            } @else {
              <lp-group [label]="i18n.t('restoreSnapshotsTitle')">
                <ng-container [ngTemplateOutlet]="snapshotRows"></ng-container>
              </lp-group>
            }

            <div class="tw-px-3.5 tw-pt-3">
              <button
                type="button"
                bitButton
                buttonType="primary"
                block
                [disabled]="busy()"
                [loading]="busy()"
                data-testid="restore_start"
                (click)="startRestore()"
              >
                {{ i18n.t("restoreStart") }}
              </button>

              @if (savedError()) {
                <div
                  class="tw-mt-2 tw-rounded-xl tw-border tw-border-border-danger-soft tw-bg-bg-danger-soft tw-p-3 tw-text-xs tw-leading-relaxed tw-text-fg-danger-strong"
                >
                  {{ savedError() }}
                </div>
              }

              <p
                class="tw-mx-auto tw-mt-3 tw-max-w-md tw-text-center tw-text-xs tw-leading-relaxed tw-text-muted"
              >
                {{ i18n.t("restoreFootnote") }}
              </p>
            </div>
          } @else {
            @switch (state()) {
              @case ("form") {
                <div class="tw-px-3.5 tw-pt-3">
                  <bit-callout type="warning" [title]="null">{{
                    i18n.t("restoreWarning")
                  }}</bit-callout>
                </div>

                <div class="tw-pt-1">
                  <lp-field
                    [label]="i18n.t('masterPassword')"
                    [password]="true"
                    [value]="valueOf('masterPassword')"
                    (valueChange)="set('masterPassword', $event)"
                  />
                </div>

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

                <div class="tw-px-3.5 tw-pt-3">
                  <button
                    type="button"
                    bitButton
                    buttonType="primary"
                    block
                    [disabled]="busy()"
                    (click)="submit()"
                  >
                    {{ i18n.t("restoreStart") }}
                  </button>
                  <p
                    class="tw-mx-auto tw-mt-3 tw-max-w-md tw-text-center tw-text-xs tw-leading-relaxed tw-text-muted"
                  >
                    {{ i18n.t("restoreFootnote") }}
                  </p>
                </div>
                @if (errorMessage()) {
                  <div
                    class="tw-mx-3.5 tw-mt-2 tw-rounded-xl tw-border tw-border-border-danger-soft tw-bg-bg-danger-soft tw-p-3 tw-text-xs tw-leading-relaxed tw-text-fg-danger-strong"
                  >
                    {{ errorMessage() }}
                  </div>
                }
              }

              @case ("loading") {
                <div class="tw-grid tw-h-60 tw-place-items-center">
                  <div class="tw-text-center">
                    <div
                      class="tw-mx-auto tw-mb-3 tw-size-8 tw-animate-spin tw-rounded-full tw-border-2 tw-border-border-light tw-border-t-border-brand"
                    ></div>
                    <p class="tw-m-0 tw-text-sm tw-text-main">
                      {{ i18n.t("restoreLoading") }}
                    </p>
                    <p class="tw-m-0 tw-mt-1 tw-text-xs tw-text-muted">
                      {{ i18n.t("restoreLoadingHint") }}
                    </p>
                  </div>
                </div>
              }

              @case ("conflict") {
                <div
                  class="tw-mx-3 tw-mb-2 tw-rounded-xl tw-border tw-border-border-warning-soft tw-bg-bg-warning-soft tw-px-3 tw-py-2.5 tw-text-xs tw-leading-relaxed tw-text-fg-warning-strong"
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
                <div class="tw-grid tw-h-60 tw-place-items-center">
                  <div class="tw-px-6 tw-text-center">
                    <p class="tw-m-0 tw-text-base tw-font-semibold tw-text-fg-danger">
                      {{ i18n.t("restoreFailed") }}
                    </p>
                    <p class="tw-m-0 tw-mt-2 tw-text-xs tw-leading-relaxed tw-text-muted">
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
                <div class="tw-grid tw-h-60 tw-place-items-center">
                  <div class="tw-text-center">
                    <div class="tw-text-4xl tw-text-fg-success">✓</div>
                    <p class="tw-m-0 tw-mt-2 tw-text-base tw-font-semibold tw-text-main">
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
          }
        }

        <ng-template #snapshotRows>
          @for (snapshot of snapshots(); track snapshot.id) {
            <button
              type="button"
              role="radio"
              class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-border-0 tw-border-b tw-border-border-light tw-bg-transparent tw-px-4 tw-py-3 tw-text-start last:tw-border-b-0 hover:tw-bg-bg-hover"
              [attr.aria-checked]="selectedSnapshotId() === snapshot.id"
              data-testid="restore_snapshot"
              (click)="selectedSnapshotId.set(snapshot.id)"
            >
              <span
                class="tw-grid tw-size-4 tw-flex-none tw-place-items-center tw-rounded-full tw-border"
                [class.tw-border-border-brand]="selectedSnapshotId() === snapshot.id"
                [class.tw-border-border-base]="selectedSnapshotId() !== snapshot.id"
              >
                @if (selectedSnapshotId() === snapshot.id) {
                  <span class="tw-size-2 tw-rounded-full tw-bg-bg-brand"></span>
                }
              </span>
              <span class="tw-min-w-0">
                <span class="tw-block tw-text-sm tw-text-main">{{
                  snapshotLabel(snapshot.id)
                }}</span>
                <span class="tw-block tw-text-xs tw-text-muted">{{
                  formatSize(snapshot.size)
                }}</span>
              </span>
            </button>
          }
        </ng-template>
      </div>
    </div>
  `,
})
export class RestoreVaultV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });
  private readonly formBuilder = inject(FormBuilder);
  private readonly createLocalAccountService = inject(CreateLocalAccountService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly router = inject(Router);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly route = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly masterPasswordService = inject(InternalMasterPasswordServiceAbstraction);

  /** 桌面端在设置里恢复：沿用已配置的存储，只挑快照并验安全密码。 */
  protected readonly desktop = computed(
    () => this.route.snapshot.data["restoreVariant"] === "desktop",
  );
  protected readonly snapshots = signal<readonly SnapshotRow[]>([]);
  protected readonly selectedSnapshotId = signal<string | null>(null);
  protected readonly snapshotsLoading = signal(false);
  /**
   * 已经有配置好的云存储时（桌面端设置、弹窗里已登录的账户），直接挑快照恢复；
   * 只有全新安装才需要手填存储凭据。
   */
  protected readonly savedConfig = signal(false);

  protected readonly state = signal<RestoreState>("form");
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly savedError = signal<string | null>(null);
  protected readonly conflicts = signal<readonly MergeConflict[]>([]);

  protected readonly form = this.formBuilder.group({
    endpoint: ["", [Validators.required]],
    bucket: ["", [Validators.required]],
    accessKeyId: ["", [Validators.required]],
    secretAccessKey: ["", [Validators.required]],
    masterPassword: ["", [Validators.required]],
  });

  async ngOnInit(): Promise<void> {
    if (this.desktop()) {
      this.savedConfig.set(true);
      await this.loadSnapshots();
      return;
    }

    await this.detectSavedConfig();
  }

  /** 弹窗：只有已存在账户且配置过备份时，才进入「选快照」视图。 */
  private async detectSavedConfig(): Promise<void> {
    try {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(getOptionalUserId),
      );
      if (!userId) {
        return;
      }
      const hasConfig = await this.syncService.hasConfig(userId);
      if (!hasConfig) {
        return;
      }
      this.savedConfig.set(true);
      // 锁定状态下拿不到用户密钥，先显示页面骨架；密码验过后再载入快照。
      await this.loadSnapshots();
    } catch {
      // 读不到配置就退回手填存储，不让恢复入口卡住。
      this.savedConfig.set(false);
    }
  }

  protected valueOf(
    key: "endpoint" | "bucket" | "accessKeyId" | "secretAccessKey" | "masterPassword",
  ): string {
    return this.form.get(key)?.value ?? "";
  }

  protected set(
    key: "endpoint" | "bucket" | "accessKeyId" | "secretAccessKey" | "masterPassword",
    value: string,
  ): void {
    this.form.get(key)?.setValue(value);
  }

  protected snapshotLabel(id: string): string {
    return formatSnapshotId(id, this.locale());
  }

  protected formatSize(bytes: number): string {
    if (bytes <= 0) {
      return "—";
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  /**
   * 沿用已配置的存储列出快照；不进表单，也不要求重填凭据。
   *
   * 弹窗在锁定状态进入时，先显示页面但不出快照；这里用用户刚输入的安全密码验一次，
   * 验过才解开存储密钥读桶。解出的密钥和存储密钥都只留在内存里，不落盘、不写日志。
   */
  protected async startRestore(): Promise<void> {
    if (this.busy()) {
      return;
    }
    const password = this.valueOf("masterPassword");
    this.savedError.set(null);
    if (!password) {
      this.savedError.set(this.i18n.t("masterPasswordRequired"));
      return;
    }

    if (!this.selectedSnapshotId()) {
      await this.loadSnapshotsForSavedConfig();
      if (!this.selectedSnapshotId() && !this.savedError()) {
        this.savedError.set(this.i18n.t("restoreSelectSnapshot"));
      }
      // 第一次点击先把快照列出来，让用户确认选哪一个再恢复。
      return;
    }

    this.busy.set(true);
    try {
      const userId = await this.userId();
      const client = await this.resolveSavedClient(userId, password);
      const stored = await client.getText(`${SNAPSHOT_PREFIX}${this.selectedSnapshotId()}.json`);
      if (stored == null) {
        throw new Error(this.i18n.t("backupNoSnapshots"));
      }

      const applied = await this.syncService.applySnapshot(
        userId,
        JSON.parse(stored.text) as Snapshot,
      );
      this.platformUtilsService.showToast("success", "", this.i18n.t("restoreSuccess", applied));
      await this.router.navigateByUrl(this.desktop() ? "/vault" : "/");
    } catch (error) {
      this.savedError.set(error instanceof Error ? error.message : this.i18n.t("restoreFailed"));
    } finally {
      this.busy.set(false);
    }
  }

  /** 安全密码输入完成时才去读快照，避免每敲一个字符就验一次。 */
  protected async loadSnapshotsForSavedConfig(): Promise<void> {
    if (this.desktop() || !this.savedConfig() || this.snapshotsLoading()) {
      return;
    }
    const password = this.valueOf("masterPassword");
    if (!password) {
      return;
    }
    await this.loadSnapshots(password);
  }

  private async resolveSavedClient(userId: UserId, password: string): Promise<S3Client> {
    const unlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(userId),
    );
    if (unlockData == null) {
      throw new Error(this.i18n.t("restoreFailed"));
    }

    let userKey: UserKey;
    try {
      // 验密码的同时拿到用户密钥；口令错误会抛，解锁状态不变。
      userKey = await this.masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData(
        password,
        unlockData,
      );
    } catch {
      throw new Error(this.i18n.t("invalidMasterPassword"));
    }

    const unlockedClient = await this.syncService.clientFor(userId);
    if (unlockedClient != null) {
      return unlockedClient;
    }

    const config = await this.syncService.getConfigWithUserKey(userId, userKey);
    if (config == null) {
      throw new Error(this.i18n.t("restoreNoStorage"));
    }

    return new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private async loadSnapshots(password?: string): Promise<void> {
    this.snapshotsLoading.set(true);
    this.savedError.set(null);
    this.snapshots.set([]);
    this.selectedSnapshotId.set(null);
    try {
      const userId = await this.userId();
      let client = await this.syncService.clientFor(userId);

      if (client == null && password) {
        try {
          client = await this.resolveSavedClient(userId, password);
        } catch (error) {
          this.savedError.set(
            error instanceof Error ? error.message : this.i18n.t("invalidMasterPassword"),
          );
          return;
        }
      }

      if (client == null) {
        // 弹窗锁定且还没输入密码：保持骨架，等 blur 后再读。
        if (this.desktop()) {
          this.savedError.set(this.i18n.t("restoreNoStorage"));
        }
        return;
      }

      try {
        const objects = await client.listObjects(SNAPSHOT_PREFIX);
        const rows = objects
          .filter((object) => object.key.endsWith(".json"))
          .map((object) => ({
            id:
              object.key
                .split("/")
                .pop()
                ?.replace(/\.json$/, "") ?? object.key,
            size: object.size ?? 0,
          }))
          .sort((a, b) => b.id.localeCompare(a.id));
        this.snapshots.set(rows);
        this.selectedSnapshotId.set(rows[0]?.id ?? null);
      } catch {
        this.savedError.set(this.i18n.t("restoreFailed"));
      }
    } finally {
      this.snapshotsLoading.set(false);
    }
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
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
      // The bucket is the vault boundary: the account object sits at its root, so reading it
      // needs no prefix, no directory scan, and no guess at the account id.
      const client = new S3Client({
        endpoint: value.endpoint ?? "",
        region: "auto",
        bucket: value.bucket ?? "",
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

      let parsed: unknown;
      try {
        parsed = JSON.parse(stored.text);
      } catch {
        throw new Error(this.i18n.t("restoreNoAccountFile"));
      }
      if (!isLocalAccountObject(parsed)) {
        throw new Error(this.i18n.t("restoreNoAccountFile"));
      }

      const account = parsed;
      const userId = await this.createLocalAccountService.restoreAccount({
        userId: account.userId,
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
        endpoint: value.endpoint ?? "",
        region: "auto",
        bucket: value.bucket ?? "",
        accessKeyId: value.accessKeyId ?? "",
        secretAccessKey: value.secretAccessKey ?? "",
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

  protected goBack(): void {
    void this.router.navigateByUrl("/");
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
