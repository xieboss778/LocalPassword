import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LpPageHeaderComponent, LpToastService } from "@localpass/angular/local-ui";
import { formatBackupTimestamp } from "@localpass/angular/tools/backup";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { ButtonModule, CalloutModule, DialogService, IconModule } from "@localpass/components";
import { VaultBackupService } from "@localpass/local-vault";

/**
 * 桌面端「数据与安全」。
 *
 * 左列说明数据文件在哪儿、怎么搬走；右列是危险操作。清空保险库需要两次确认，
 * 会永久删除全部条目（含回收站），但不碰文件夹和本机密钥。
 */
@Component({
  selector: "data-safety-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [ButtonModule, CalloutModule, IconModule, LpPageHeaderComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header
        [title]="i18n.t('dataAndSafety')"
        [sub]="i18n.t('dataAndSafetySubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        <div class="tw-flex tw-items-start tw-gap-4">
          <div
            class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
          >
            <h2 class="tw-m-0 tw-pb-3 tw-text-sm tw-font-semibold tw-text-main">
              {{ i18n.t("dataLocationTitle") }}
            </h2>
            <div
              class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
            >
              <div class="tw-flex tw-min-h-12 tw-flex-col tw-gap-0.5 tw-px-4 tw-py-3">
                <span class="tw-text-sm tw-text-main">{{ i18n.t("dataDirectory") }}</span>
                <span class="tw-break-all tw-font-mono tw-text-xs tw-text-muted"
                  >~/Library/Application Support/LocalPass</span
                >
              </div>
              <div
                class="tw-flex tw-min-h-12 tw-flex-col tw-gap-0.5 tw-border-t tw-border-border-light tw-px-4 tw-py-3"
              >
                <span class="tw-text-sm tw-text-main">{{ i18n.t("dataEncryption") }}</span>
                <span class="tw-text-xs tw-text-muted">{{ i18n.t("dataEncryptionValue") }}</span>
              </div>
              <div
                class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-t tw-border-border-light tw-px-4 tw-py-3"
              >
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-text-sm tw-text-main">{{
                    i18n.t("dataLastBackup")
                  }}</span>
                  <span class="tw-block tw-text-xs tw-text-muted">{{ lastBackupLabel() }}</span>
                </span>
                <button
                  type="button"
                  bitButton
                  buttonType="primaryGhost"
                  size="small"
                  class="!tw-text-fg-brand"
                  data-testid="data_backup_view"
                  (click)="go('/backup-settings')"
                >
                  {{ i18n.t("viewAction") }}
                </button>
              </div>
              <div
                class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-t tw-border-border-light tw-px-4 tw-py-3"
              >
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-text-sm tw-text-main">{{
                    i18n.t("exportEncryptedBackup")
                  }}</span>
                  <span class="tw-block tw-text-xs tw-text-muted">{{
                    i18n.t("exportRowDesc")
                  }}</span>
                </span>
                <button
                  type="button"
                  bitButton
                  buttonType="primaryGhost"
                  size="small"
                  class="!tw-text-fg-brand"
                  (click)="go('/export')"
                >
                  {{ i18n.t("exportVerb") }}
                </button>
              </div>
            </div>
          </div>

          <div
            class="tw-w-5/12 tw-flex-none tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
          >
            <h2 class="tw-m-0 tw-pb-3 tw-text-sm tw-font-semibold tw-text-main">
              {{ i18n.t("dangerZone") }}
            </h2>
            <bit-callout type="warning" [title]="null">{{
              i18n.t("clearVaultWarning")
            }}</bit-callout>
            <button
              type="button"
              bitButton
              buttonType="dangerOutline"
              class="tw-mt-4"
              [disabled]="itemCount() === 0 || clearing()"
              [loading]="clearing()"
              data-testid="data_clear_vault"
              (click)="clearVault()"
            >
              {{ i18n.t("clearVault") }}
            </button>
            @if (errorMessage()) {
              <p class="tw-pt-3 tw-text-sm tw-text-fg-danger">{{ errorMessage() }}</p>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DataSafetyDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly backupService = inject(VaultBackupService);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(LpToastService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);

  protected readonly itemCount = signal(0);
  protected readonly lastBackupAt = signal<string | null>(null);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });
  protected readonly lastBackupLabel = computed(() =>
    formatBackupTimestamp(this.lastBackupAt(), this.locale(), this.i18n),
  );
  protected readonly clearing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const userId = await this.userId();
    const [ciphers, settings] = await Promise.all([
      this.cipherService.getAll(userId),
      this.backupService.getSettings(userId),
    ]);
    this.itemCount.set(ciphers.length);
    this.lastBackupAt.set(settings.lastBackupAt ?? null);
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected async clearVault(): Promise<void> {
    if (this.clearing()) {
      return;
    }

    const first = await this.dialogService.openSimpleDialog({
      title: { key: "clearVault" },
      content: { key: "clearVaultWarning" },
      type: "danger",
    });
    if (!first) {
      return;
    }

    const second = await this.dialogService.openSimpleDialog({
      title: { key: "clearVault" },
      content: { key: "clearVaultConfirmation" },
      type: "danger",
    });
    if (!second) {
      return;
    }

    this.clearing.set(true);
    this.errorMessage.set(null);
    try {
      const userId = await this.userId();
      // getAll 包含回收站里的条目，因此这里删的是「全部条目」，与文案一致。
      const ids = (await this.cipherService.getAll(userId))
        .map((cipher) => cipher.id)
        .filter((id): id is string => !!id);
      if (ids.length) {
        await this.cipherService.deleteManyWithServer(ids, userId);
      }
      this.itemCount.set(0);
      this.toast.show(this.i18n.t("vaultCleared"));
      await this.router.navigateByUrl("/vault");
    } catch (error) {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
      this.logService.error("Error clearing local vault: ", error);
    } finally {
      this.clearing.set(false);
    }
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
