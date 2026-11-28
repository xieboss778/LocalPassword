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

import {
  LpPopupHeaderComponent,
  LpRowComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { formatBackupTimestamp } from "@localpass/angular/tools/backup";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@localpass/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogService } from "@localpass/components";
import { VaultBackupService, VaultBackupSyncService } from "@localpass/local-vault";

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
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('dataAndSafety')"
        [sub]="i18n.t('dataAndSafetySubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="agy-ext-scroll">
        <section class="tw-pb-2">
          <div class="agy-grp">
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
              icon="bwi-refresh"
              [label]="i18n.t('lastBackup')"
              [sub]="lastBackupText()"
              [clickable]="false"
            />
          </div>
        </section>

        <section class="tw-pb-2">
          <div class="agy-grp">
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
            class="tw-rounded-xl tw-border tw-border-border-danger-soft tw-bg-bg-danger-soft tw-p-3"
          >
            <div class="tw-text-xs tw-font-semibold tw-text-fg-danger-strong">
              {{ i18n.t("dangerZone") }}
            </div>
            <p class="agy-hint tw-pl-0 tw-pt-1">
              {{ i18n.t("clearVaultDescription") }}
            </p>
            <label
              class="tw-mt-2 tw-flex tw-cursor-pointer tw-items-start tw-gap-2 tw-text-sm tw-leading-relaxed tw-text-main"
              for="data-safety_input_clear-confirm"
            >
              <input
                id="data-safety_input_clear-confirm"
                type="checkbox"
                class="tw-mt-0.5 tw-size-4 tw-flex-none"
                data-testid="data_safety_clear_confirm"
                [checked]="confirmed()"
                (change)="onConfirmChange($event)"
              />
              <span>{{ i18n.t("clearVaultConfirmCheckbox") }}</span>
            </label>
            <button
              id="data-safety_button_clear-vault"
              type="button"
              class="agy-btn agy-danger agy-lg agy-block tw-mt-2 tw-bg-background"
              [disabled]="!confirmed() || clearing()"
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
  private readonly folderService = inject(FolderService);
  private readonly folderApiService = inject(FolderApiServiceAbstraction, { optional: true });
  private readonly backupService = inject(VaultBackupService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(LpToastService);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en-US" });

  protected readonly lastBackupAt = signal<string | null>(null);
  protected readonly clearing = signal(false);
  protected readonly confirmed = signal(false);

  protected readonly lastBackupText = computed(() =>
    formatBackupTimestamp(this.lastBackupAt(), this.locale(), this.i18n),
  );

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const [settings, syncState] = await Promise.all([
      this.backupService.getSettings(userId),
      this.syncService.getSyncState(userId),
    ]);
    this.lastBackupAt.set(syncState.lastSyncedAt ?? settings.lastBackupAt);
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected onConfirmChange(event: Event): void {
    this.confirmed.set((event.target as HTMLInputElement).checked);
  }

  protected async clearVault(): Promise<void> {
    if (this.clearing() || !this.confirmed()) {
      return;
    }

    const dialogConfirmed = await this.dialogService.openSimpleDialog({
      title: { key: "clearVaultConfirmTitle" },
      content: { key: "clearVaultConfirmBody" },
      type: "warning",
    });
    if (!dialogConfirmed) {
      return;
    }

    this.clearing.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const [ciphers, folders] = await Promise.all([
        this.cipherService.getAll(userId),
        firstValueFrom(this.folderService.folderViews$(userId)),
      ]);
      const ids = ciphers.map((cipher) => cipher.id).filter((id): id is string => id != null);
      if (ids.length > 0) {
        await this.cipherService.deleteManyWithServer(ids, userId);
      }
      if (this.folderApiService) {
        for (const folder of folders) {
          if (folder.id) {
            await this.folderApiService.delete(folder.id, userId);
          }
        }
      }
      this.confirmed.set(false);
      this.toast.show(this.i18n.t("vaultCleared"));
    } catch {
      this.toast.show(this.i18n.t("errorOccurred"));
    } finally {
      this.clearing.set(false);
    }
  }
}
