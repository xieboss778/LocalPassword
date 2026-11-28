import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { filter, firstValueFrom, map, switchMap } from "rxjs";

import {
  LpPopupHeaderComponent,
  VaultDensity,
  VaultDensityService,
} from "@localpass/angular/local-ui";
import { scanVaultHealth } from "@localpass/angular/tools/health";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { Theme, ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";
import { ThemeStateService } from "@localpass/common/platform/theming/theme-state.service";
import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { IconModule, LocalPassIcon } from "@localpass/components";
import { LocalWebAuthnPrfEnrollmentService } from "@localpass/key-management-ui";
import { LockService, LockSource } from "@localpass/unlock";

import { VaultPopupItemsService } from "../../../../vault/popup/services/vault-popup-items.service";

interface SettingsRow {
  readonly icon: LocalPassIcon;
  readonly labelKey: string;
  readonly descKey: string;
  readonly route: string;
  readonly countKey?: "folders" | "trash" | "archive" | "health";
  /** 设置页里的计数来自服务，而不是固定文案。 */
  readonly dynamicCount?: "securityKey";
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
    labelKey: "securityAndUnlockGroup",
    rows: [
      {
        icon: "bwi-shield",
        labelKey: "securitySettings",
        descKey: "securitySettingsDesc",
        route: "/settings-security-v2",
      },
      {
        icon: "bwi-key",
        labelKey: "securityKey",
        descKey: "securityKeyDescription",
        dynamicCount: "securityKey",
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
        icon: "bwi-archive",
        labelKey: "archiveNoun",
        descKey: "itemsInArchive",
        countKey: "archive",
        route: "/archive",
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
        labelKey: "importLabel",
        descKey: "importSettingsDesc",
        route: "/import-source-v2",
      },
      {
        icon: "bwi-download",
        labelKey: "exportLabel",
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
        icon: "bwi-shield",
        labelKey: "healthCheck",
        descKey: "healthCheckDesc",
        countKey: "health",
        route: "/health-v2",
      },
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
    labelKey: "backupPrivacyGroup",
    rows: [
      {
        icon: "bwi-refresh",
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
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('settings')"
        [sub]="i18n.t('settingsSubtitle')"
        [avatar]="true"
      >
        <div slot="actions">
          <button
            type="button"
            class="agy-iconbtn"
            [attr.aria-label]="i18n.t('lockVault')"
            [attr.title]="i18n.t('lockVault')"
            (click)="lock()"
          >
            <bit-icon name="bwi-lock" class="tw-text-base"></bit-icon>
          </button>
        </div>
      </lp-popup-header>

      <div class="agy-ext-scroll">
        @for (group of groups; track group.key) {
          <section class="tw-pb-2">
            <h2 class="agy-seclbl">{{ i18n.t(group.labelKey) }}</h2>
            <div class="agy-grp">
              @for (row of group.rows; track row.labelKey) {
                <button type="button" class="agy-setrow" (click)="go(row.route)">
                  <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                    <bit-icon [name]="row.icon" class="tw-text-xs"></bit-icon>
                  </span>
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="agy-k tw-block">{{ i18n.t(row.labelKey) }}</span>
                    <span class="agy-d tw-block tw-truncate">{{ description(row) }}</span>
                  </span>
                  <bit-icon name="bwi-angle-right" class="tw-text-xs tw-text-muted"></bit-icon>
                </button>
              }
            </div>
          </section>
        }

        <p class="agy-hint tw-pl-2">
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
  private readonly cipherService = inject(CipherService);
  private readonly itemsService = inject(VaultPopupItemsService);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly lockService = inject(LockService);
  private readonly enrollmentService = inject(LocalWebAuthnPrfEnrollmentService);
  private readonly densityService = inject(VaultDensityService);
  private readonly passwordStrengthService = inject(PasswordStrengthServiceAbstraction);

  protected readonly groups = GROUPS;
  protected readonly version = signal("");
  protected readonly securityKeyCount = signal(0);
  protected readonly theme = toSignal(this.themeStateService.selectedTheme$, {
    initialValue: ThemeTypes.System as Theme,
  });
  protected readonly density = toSignal(this.densityService.density$, {
    initialValue: VaultDensity.Compact,
  });

  protected readonly trashCount = toSignal(
    this.itemsService.deletedCiphers$.pipe(
      takeUntilDestroyed(),
      map((items) => items.length),
    ),
    { initialValue: 0 },
  );

  private readonly allCiphers = toSignal(
    this.accountService.activeAccount$.pipe(
      takeUntilDestroyed(),
      getUserId,
      filter((userId): userId is UserId => userId != null),
      switchMap((userId) => this.cipherService.cipherViews$(userId)),
    ),
    { initialValue: [] },
  );

  protected readonly archiveCount = () =>
    this.allCiphers().filter((cipher) => cipher.isArchived && !cipher.isDeleted).length;

  protected readonly healthIssueCount = () =>
    scanVaultHealth(
      this.allCiphers().filter((cipher) => !cipher.isDeleted && !cipher.isArchived),
      this.passwordStrengthService,
    ).issues.length;

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
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.securityKeyCount.set(await this.enrollmentService.count(userId));
  }

  protected description(row: SettingsRow): string {
    if (row.countKey === "folders") {
      return this.i18n.t("folderCount", this.folderCount());
    }
    if (row.countKey === "trash") {
      return this.i18n.t("trashCount").replace("{COUNT}", String(this.trashCount()));
    }
    if (row.countKey === "archive") {
      return this.i18n.t("itemCount", String(this.archiveCount()));
    }
    if (row.countKey === "health") {
      const issues = this.healthIssueCount();
      return issues > 0
        ? this.i18n.t("healthIssuesCount", String(issues))
        : this.i18n.t("healthCheckDesc");
    }
    if (row.dynamicCount === "securityKey") {
      return this.securityKeyCount() > 0
        ? this.i18n.t("registeredKeysCount", this.securityKeyCount().toString())
        : this.i18n.t(row.descKey);
    }
    if (row.version) {
      return `${this.i18n.t("appVersion")} ${this.version()}`;
    }
    if (row.descKey === "appearance") {
      const themeLabel = this.i18n.t(
        this.theme() === ThemeTypes.Dark
          ? "dark"
          : this.theme() === ThemeTypes.Light
            ? "light"
            : "default",
      );
      const densityLabel = this.i18n.t(
        this.density() === VaultDensity.Ultra ? "densityUltra" : "densityCompact",
      );
      return `${themeLabel} · ${densityLabel}`;
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
