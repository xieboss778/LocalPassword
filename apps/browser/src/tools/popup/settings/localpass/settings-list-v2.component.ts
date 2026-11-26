import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { filter, firstValueFrom, map, switchMap } from "rxjs";

import { LpPopupHeaderComponent } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { Theme, ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";
import { ThemeStateService } from "@localpass/common/platform/theming/theme-state.service";
import { UserId } from "@localpass/common/types/guid";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { IconModule, LocalPassIcon } from "@localpass/components";
import { LockService, LockSource } from "@localpass/unlock";

import { VaultPopupItemsService } from "../../../../vault/popup/services/vault-popup-items.service";

interface SettingsRow {
  readonly icon: LocalPassIcon;
  readonly labelKey: string;
  readonly descKey: string;
  readonly route: string;
  readonly countKey?: "folders" | "trash";
  readonly version?: boolean;
  readonly tone?: "danger";
}

interface SettingsGroup {
  readonly key: string;
  readonly labelKey: string;
  readonly rows: readonly SettingsRow[];
}

const GROUPS: readonly SettingsGroup[] = [
  {
    key: "account",
    labelKey: "security",
    rows: [
      {
        icon: "bwi-shield",
        labelKey: "security",
        descKey: "securitySettingsDesc",
        route: "/settings-security-v2",
      },
      {
        icon: "bwi-key",
        labelKey: "securityKey",
        descKey: "securityKeyRegistered",
        route: "/security-key",
      },
    ],
  },
  {
    key: "vault",
    labelKey: "vault",
    rows: [
      {
        icon: "bwi-folder",
        labelKey: "myFolders",
        descKey: "foldersCount",
        countKey: "folders",
        route: "/folders",
      },
      {
        icon: "bwi-trash",
        labelKey: "trash",
        descKey: "trashCount",
        countKey: "trash",
        route: "/trash",
      },
      {
        icon: "bwi-import",
        labelKey: "importData",
        descKey: "importSettingsDesc",
        route: "/import-source-v2",
      },
      {
        icon: "bwi-download",
        labelKey: "exportData",
        descKey: "exportSettingsDesc",
        route: "/export",
      },
    ],
  },
  {
    key: "tools",
    labelKey: "tools",
    rows: [
      {
        icon: "bwi-generate",
        labelKey: "generator",
        descKey: "generatorSettingsDesc",
        route: "/tabs/generator",
      },
      {
        icon: "bwi-palette",
        labelKey: "appearance",
        descKey: "appearance",
        route: "/appearance",
      },
    ],
  },
  {
    key: "backup",
    labelKey: "backupTitle",
    rows: [
      {
        icon: "bwi-download",
        labelKey: "cloudBackup",
        descKey: "backupSettingsDesc",
        route: "/backup-settings",
      },
      {
        icon: "bwi-globe",
        labelKey: "networkGate",
        descKey: "networkSettingsDesc",
        route: "/settings-network-v2",
      },
      {
        icon: "bwi-lock",
        labelKey: "dataAndSafety",
        descKey: "dataSettingsDesc",
        route: "/settings-data-v2",
      },
      {
        icon: "bwi-info-circle",
        labelKey: "aboutLocalPass",
        descKey: "appVersion",
        version: true,
        route: "/about",
      },
    ],
  },
];

/**
 * 设置一级页（弹窗）。
 *
 * 行右侧的计数/版本都是实时值：文件夹与回收站直接订阅服务，版本来自平台服务。
 * 主题名在「外观」行里显示当前选择，避免进二级页才知道现在是深色还是浅色。
 */
@Component({
  selector: "settings-list-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPopupHeaderComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header [title]="i18n.t('settings')" [sub]="i18n.t('settingsSubtitle')">
        <div slot="actions">
          <button
            type="button"
            class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
            [attr.aria-label]="i18n.t('lockVault')"
            [attr.title]="i18n.t('lockVault')"
            (click)="lock()"
          >
            <bit-icon name="bwi-lock" class="tw-text-base"></bit-icon>
          </button>
        </div>
      </lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        @for (group of groups; track group.key) {
          <section class="tw-pb-1.5">
            <h2
              class="tw-m-0 tw-px-2.5 tw-pt-2.5 tw-pb-1 tw-text-xs tw-font-semibold tw-text-muted"
            >
              {{ i18n.t(group.labelKey) }}
            </h2>
            <div
              class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
            >
              @for (row of group.rows; track row.labelKey) {
                <button
                  type="button"
                  class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 tw-text-start last:tw-border-b-0 hover:tw-bg-background-alt"
                  (click)="go(row.route)"
                >
                  <span
                    class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
                  >
                    <bit-icon [name]="row.icon" class="tw-text-base"></bit-icon>
                  </span>
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                      i18n.t(row.labelKey)
                    }}</span>
                    <span
                      class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted"
                      >{{ description(row) }}</span
                    >
                  </span>
                  <bit-icon name="bwi-angle-right" class="tw-text-sm tw-text-muted"></bit-icon>
                </button>
              }
            </div>
          </section>
        }

        <p class="tw-px-2.5 tw-pt-2 tw-text-xs tw-leading-relaxed tw-text-muted">
          {{ i18n.t("settingsPrivacyNote") }}
        </p>
      </div>
    </div>
  `,
})
export class SettingsListV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly folderService = inject(FolderService);
  private readonly itemsService = inject(VaultPopupItemsService);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly lockService = inject(LockService);

  protected readonly groups = GROUPS;
  protected readonly version = signal("");
  protected readonly theme = toSignal(this.themeStateService.selectedTheme$, {
    initialValue: ThemeTypes.System as Theme,
  });

  protected readonly trashCount = toSignal(
    this.itemsService.deletedCiphers$.pipe(
      takeUntilDestroyed(),
      map((items) => items.length),
    ),
    { initialValue: 0 },
  );

  protected readonly folderCount = toSignal(
    this.accountService.activeAccount$.pipe(
      takeUntilDestroyed(),
      getUserId,
      filter((userId): userId is UserId => userId != null),
      switchMap((userId) => this.folderService.folderViews$(userId)),
      map((folders) => folders.filter((folder) => folder.id !== "").length),
    ),
    { initialValue: 0 },
  );

  async ngOnInit(): Promise<void> {
    this.version.set(await this.platformUtilsService.getApplicationVersion());
  }

  protected description(row: SettingsRow): string {
    if (row.countKey === "folders") {
      return this.i18n.t("foldersCount").replace("{COUNT}", String(this.folderCount()));
    }
    if (row.countKey === "trash") {
      return this.i18n.t("trashCount").replace("{COUNT}", String(this.trashCount()));
    }
    if (row.version) {
      return `${this.i18n.t("appVersion")} ${this.version()}`;
    }
    if (row.descKey === "appearance") {
      return this.i18n.t(
        this.theme() === ThemeTypes.Dark
          ? "dark"
          : this.theme() === ThemeTypes.Light
            ? "light"
            : "default",
      );
    }
    return this.i18n.t(row.descKey);
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected async lock(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.lockService.lock(userId, LockSource.Manual);
    await this.router.navigateByUrl("/");
  }
}
