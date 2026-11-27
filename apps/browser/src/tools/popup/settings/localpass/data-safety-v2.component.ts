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

import { LpPopupHeaderComponent, LpRowComponent } from "@localpass/angular/local-ui";
import { formatBackupTimestamp } from "@localpass/angular/tools/backup";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { DialogService } from "@localpass/components";
import { VaultBackupService } from "@localpass/local-vault";

/**
 * 数据与安全（弹窗）。
 *
 * 数据位置、加密方式、最近备份都是真实值；最后一段才是危险操作：
 * 「清空保险库」走 CipherService 逐条删除，并在之前弹二次确认。
 */
@Component({
  selector: "data-safety-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [LpPopupHeaderComponent, LpRowComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('dataAndSafety')"
        [sub]="i18n.t('dataAndSafetySubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        <section class="tw-pb-2 tw-pt-1">
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            <lp-row
              icon="bwi-folder"
              [label]="i18n.t('dataLocation')"
              [sub]="i18n.t('extensionStorage')"
              [clickable]="false"
            />
            <lp-row
              icon="bwi-shield"
              [label]="i18n.t('encryptionMethod')"
              [sub]="i18n.t('encryptionMethodValue')"
              [clickable]="false"
            />
            <lp-row
              icon="bwi-download"
              [label]="i18n.t('lastBackup')"
              [sub]="lastBackupText()"
              [clickable]="false"
            />
          </div>
        </section>

        <section class="tw-pb-2">
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            <lp-row
              icon="bwi-download"
              [label]="i18n.t('exportEncryptedBackup')"
              [sub]="i18n.t('exportBeforeClear')"
              [chevron]="true"
              [clickable]="true"
              (activated)="go('/export')"
            />
          </div>
        </section>

        <section class="tw-pt-2">
          <div
            class="tw-rounded-xl tw-border tw-border-border-danger-soft tw-bg-bg-danger-soft tw-p-4"
          >
            <div class="tw-text-sm tw-font-semibold tw-text-fg-danger-strong">
              {{ i18n.t("dangerZone") }}
            </div>
            <p class="tw-m-0 tw-pt-1 tw-text-xs tw-leading-relaxed tw-text-muted">
              {{ i18n.t("clearVaultDescription") }}
            </p>
            <button
              id="data-safety_button_clear-vault"
              type="button"
              class="tw-mt-3 tw-flex tw-h-9 tw-w-full tw-items-center tw-justify-center tw-rounded-lg tw-bg-background tw-text-sm tw-font-semibold tw-text-fg-danger-strong tw-transition-colors hover:tw-bg-bg-danger-soft focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-border-danger disabled:tw-opacity-60"
              [disabled]="clearing()"
              [attr.aria-busy]="clearing()"
              (click)="clearVault()"
            >
              {{ i18n.t("clearVault") }}
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class DataSafetyV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly backupService = inject(VaultBackupService);
  private readonly dialogService = inject(DialogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en-US" });

  protected readonly lastBackupAt = signal<string | null>(null);
  protected readonly clearing = signal(false);

  protected readonly lastBackupText = computed(() =>
    formatBackupTimestamp(this.lastBackupAt(), this.locale(), this.i18n),
  );

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const settings = await this.backupService.getSettings(userId);
    this.lastBackupAt.set(settings.lastBackupAt);
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected async clearVault(): Promise<void> {
    if (this.clearing()) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "clearVaultConfirmTitle" },
      content: { key: "clearVaultConfirmBody" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    this.clearing.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const ciphers = await this.cipherService.getAll(userId);
      const ids = ciphers.map((cipher) => cipher.id).filter((id): id is string => id != null);
      if (ids.length > 0) {
        await this.cipherService.deleteManyWithServer(ids, userId);
      }
      this.platformUtilsService.showToast("success", "", this.i18n.t("vaultCleared"));
    } catch {
      this.platformUtilsService.showToast("error", "", this.i18n.t("errorOccurred"));
    } finally {
      this.clearing.set(false);
    }
  }
}
