import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { ButtonModule, DialogService, IconModule, LocalPassIcon } from "@localpass/components";

interface FactRow {
  readonly icon: LocalPassIcon;
  readonly labelKey: string;
  readonly value: string;
}

interface LinkRow {
  readonly icon: LocalPassIcon;
  readonly labelKey: string;
  readonly subKey: string;
  readonly route: string;
}

const FACTS: readonly FactRow[] = [
  { icon: "bwi-file", labelKey: "dataFile", value: "data.json" },
  { icon: "bwi-files", labelKey: "dataFileBackup", value: "data.json.bak" },
  { icon: "bwi-lock", labelKey: "dataNetworkFree", value: "enabled" },
];

const LINKS: readonly LinkRow[] = [
  {
    icon: "bwi-download",
    labelKey: "exportData",
    subKey: "exportSettingsDesc",
    route: "/export",
  },
  {
    icon: "bwi-import",
    labelKey: "importData",
    subKey: "importSettingsDesc",
    route: "/import",
  },
  {
    icon: "bwi-trash",
    labelKey: "trash",
    subKey: "trashHint",
    route: "/trash-desktop-v2",
  },
];

/**
 * 桌面端「数据与安全」。
 *
 * 左列说明数据文件在哪儿、怎么搬走；右列是危险操作。清空保险库需要二次确认，
 * 会永久删除全部条目（含回收站），但不碰文件夹和本机密钥。
 */
@Component({
  selector: "data-safety-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [ButtonModule, IconModule, LpGroupComponent, LpPageHeaderComponent, LpRowComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header
        [title]="i18n.t('dataAndSafety')"
        [sub]="i18n.t('dataAndSafetySubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7">
        <div class="tw-grid tw-gap-1 lg:tw-grid-cols-2">
          <div>
            <lp-group [label]="i18n.t('localData')">
              @for (fact of facts; track fact.labelKey) {
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span
                    class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-bg-brand-softer tw-text-fg-brand"
                  >
                    <bit-icon [name]="fact.icon" class="tw-text-base"></bit-icon>
                  </span>
                  <span class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-main">{{
                    i18n.t(fact.labelKey)
                  }}</span>
                  <span class="tw-max-w-48 tw-truncate tw-font-mono tw-text-xs tw-text-muted">{{
                    fact.labelKey === "dataNetworkFree" ? i18n.t("enabled") : fact.value
                  }}</span>
                </div>
              }
            </lp-group>

            <lp-group [label]="i18n.t('dataMove')">
              @for (row of links; track row.labelKey) {
                <lp-row
                  [icon]="row.icon"
                  [label]="i18n.t(row.labelKey)"
                  [sub]="i18n.t(row.subKey)"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go(row.route)"
                ></lp-row>
              }
            </lp-group>

            <p class="tw-px-5 tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
              {{ i18n.t("dataFileWarning") }}
            </p>
          </div>

          <div>
            <lp-group [label]="i18n.t('dangerZone')">
              <div class="tw-flex tw-flex-col tw-gap-3 tw-p-4">
                <div
                  class="tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-border tw-border-border-light tw-bg-background-alt tw-p-3 tw-text-xs tw-leading-relaxed tw-text-main"
                >
                  <bit-icon name="bwi-exclamation-triangle" class="tw-mt-0.5"></bit-icon>
                  <span>{{ i18n.t("clearVaultConfirmation") }}</span>
                </div>
                <button
                  type="button"
                  bitButton
                  buttonType="danger"
                  [disabled]="itemCount() === 0 || clearing()"
                  [loading]="clearing()"
                  (click)="clearVault()"
                >
                  {{ i18n.t("clearVault") }}
                </button>
              </div>
            </lp-group>

            @if (errorMessage()) {
              <p class="tw-px-5 tw-pt-3 tw-text-sm tw-text-fg-danger">{{ errorMessage() }}</p>
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
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(LpToastService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);

  protected readonly facts = FACTS;
  protected readonly links = LINKS;
  protected readonly itemCount = signal(0);
  protected readonly clearing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const userId = await this.userId();
    this.itemCount.set((await this.cipherService.getAll(userId)).length);
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected async clearVault(): Promise<void> {
    if (this.clearing()) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "clearVault" },
      content: { key: "clearVaultConfirmation" },
      type: "danger",
    });
    if (!confirmed) {
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
