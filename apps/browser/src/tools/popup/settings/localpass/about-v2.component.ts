import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  buildDiagnosticReport,
  LpGroupComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ThemeStateService } from "@localpass/common/platform/theming/theme-state.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogService } from "@localpass/components";
import { BiometricsService, BiometricsStatus } from "@localpass/key-management";
import { VaultBackupSyncService } from "@localpass/local-vault";

import { BrowserApi } from "../../../../platform/browser/browser-api";

/**
 * 关于：版本、隐私、许可证与源码地址。链接只在用户点击时才交给系统浏览器。
 */
@Component({
  selector: "about-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [JslibModule, LpGroupComponent, LpPopupHeaderComponent, LpRowComponent],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('about')"
        [sub]="i18n.t('appName')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="agy-ext-scroll">
        <div class="agy-grp tw-flex tw-flex-col tw-items-center tw-p-4 tw-text-center">
          <img [src]="logoUrl" alt="" class="tw-size-12 tw-rounded-lg" aria-hidden="true" />
          <div class="agy-h1 tw-pt-2">LocalPass</div>
          <div class="agy-sub">{{ i18n.t("appVersion") }} {{ version() }}</div>
          <p class="agy-hint tw-pl-0 tw-pt-1">
            {{ i18n.t("aboutDescription") }}
          </p>
        </div>

        <lp-group class="tw-pt-3">
          <lp-row
            icon="bwi-lock"
            [label]="i18n.t('desktopBridgeTitle')"
            [sub]="bridgeStatusText()"
            [clickable]="false"
          ></lp-row>
          <lp-row
            icon="bwi-shield"
            [label]="i18n.t('privacy')"
            [sub]="i18n.t('privacySummary')"
            [chevron]="true"
            [clickable]="true"
            (activated)="showPrivacy()"
          ></lp-row>
          <lp-row
            icon="bwi-file-text"
            [label]="i18n.t('license')"
            [sub]="i18n.t('licenseGpl')"
            [chevron]="true"
            [clickable]="true"
            (activated)="showLicense()"
          ></lp-row>
          <lp-row
            icon="bwi-external-link"
            [label]="i18n.t('sourceCode')"
            [sub]="sourceUrl"
            [chevron]="true"
            [clickable]="true"
            (activated)="openSource()"
          ></lp-row>
        </lp-group>

        <div class="agy-seclbl">{{ i18n.t("offlineDiagnostics") }}</div>
        <div class="agy-grp">
          <div class="agy-setrow">
            <div class="tw-min-w-0 tw-flex-1">
              <span class="agy-k">{{ i18n.t("diagnosticsTitle") }}</span>
              <span class="agy-d">{{ i18n.t("diagnosticsDesc") }}</span>
            </div>
          </div>
          <div class="agy-setrow">
            <div class="agy-right">
              <button
                id="about_button_diagnostics-preview"
                type="button"
                class="agy-btn agy-sm"
                data-testid="about_diagnostics_preview"
                (click)="toggleDiagnostics()"
              >
                {{ i18n.t(diagnostics() ? "hideReport" : "showReport") }}
              </button>
              <button
                id="about_button_diagnostics-copy"
                type="button"
                class="agy-btn agy-sm"
                data-testid="about_diagnostics_copy"
                (click)="copyDiagnostics()"
              >
                {{ i18n.t("copyDiagnostics") }}
              </button>
            </div>
          </div>
          @if (diagnostics(); as report) {
            <pre class="agy-diag" data-testid="about_diagnostics_report">{{ report }}</pre>
          }
        </div>
      </div>
    </div>
  `,
})
export class AboutV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly logService = inject(LogService);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly toast = inject(LpToastService);
  private readonly biometricsService = inject(BiometricsService, { optional: true });

  protected readonly sourceUrl = "github.com/xieboss778/LocalPass";
  protected readonly logoUrl = BrowserApi.getRuntimeURL("images/icon128.png");
  protected readonly version = signal("");
  protected readonly bridgeStatusText = signal("");
  protected readonly diagnostics = signal<string | null>(null);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });
  private readonly theme = toSignal(this.themeStateService.selectedTheme$, {
    initialValue: "system",
  });

  async ngOnInit(): Promise<void> {
    this.version.set(await this.platformUtilsService.getApplicationVersion());
    this.bridgeStatusText.set(await this.resolveBridgeStatus());
  }

  /** 预览打开时复制同一份文本；没有预览才现场构建。 */
  protected async toggleDiagnostics(): Promise<void> {
    if (this.diagnostics() != null) {
      this.diagnostics.set(null);
      return;
    }

    try {
      this.diagnostics.set(await this.buildDiagnostics());
    } catch (error) {
      this.logService.error("Error building diagnostic report: ", error);
      this.toast.show(this.i18n.t("diagnosticsCopyFailed"));
    }
  }

  protected async copyDiagnostics(): Promise<void> {
    try {
      const report = this.diagnostics() ?? (await this.buildDiagnostics());
      this.diagnostics.set(report);
      this.platformUtilsService.copyToClipboard(report, { window });
      this.toast.show(this.i18n.t("diagnosticsCopied"));
    } catch (error) {
      this.logService.error("Error copying diagnostic report: ", error);
      this.toast.show(this.i18n.t("diagnosticsCopyFailed"));
    }
  }

  /**
   * 与桌面端共用同一套零敏感模板；输入类型没有条目名、URL、用户名、密码、动态口令、令牌或密文。
   */
  private async buildDiagnostics(): Promise<string> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const [
      syncState,
      syncConfigured,
      pendingConflicts,
      nativeMessagingPermission,
      ciphers,
      folders,
    ] = await Promise.all([
      this.syncService.getSyncState(userId),
      this.syncService.hasConfig(userId),
      this.syncService.getPendingConflicts(userId),
      BrowserApi.permissionsGranted(["nativeMessaging"]),
      firstValueFrom(this.cipherService.cipherViews$(userId)),
      firstValueFrom(this.folderService.folderViews$(userId)),
    ]);

    const activeCount = ciphers.filter((cipher) => !cipher.isDeleted && !cipher.isArchived).length;
    const archiveCount = ciphers.filter((cipher) => !cipher.isDeleted && cipher.isArchived).length;

    return buildDiagnosticReport({
      appVersion: this.version(),
      client: "extension",
      device: this.platformUtilsService.getDeviceString(),
      locale: this.locale(),
      theme: this.theme(),
      itemCount: activeCount,
      archiveCount,
      folderCount: folders.filter((folder) => folder.id !== "").length,
      trashCount: ciphers.filter((cipher) => cipher.isDeleted).length,
      syncConfigured,
      syncPending: syncState.pending,
      syncGeneration: syncState.generation,
      conflictCount: pendingConflicts.length,
      nativeMessagingPermission,
      userAgent: navigator.userAgent,
      generatedAt: new Date(),
    });
  }

  private async resolveBridgeStatus(): Promise<string> {
    try {
      const status = await this.biometricsService?.getBiometricsStatus();
      switch (status) {
        case BiometricsStatus.Available:
          return this.i18n.t("touchIdBridgeReady");
        case BiometricsStatus.NativeMessagingPermissionMissing:
          return this.i18n.t("touchIdBridgeNeedsPermission");
        case BiometricsStatus.DesktopDisconnected:
          return this.i18n.t("touchIdBridgeOffline");
        case BiometricsStatus.NotEnabledInConnectedDesktopApp:
          return this.i18n.t("touchIdBridgeDesktopSetup");
        default:
          return this.i18n.t("touchIdBridgeUnavailable");
      }
    } catch {
      return this.i18n.t("touchIdBridgeUnavailable");
    }
  }

  protected openSource(): void {
    this.platformUtilsService.launchUri("https://github.com/xieboss778/LocalPass");
  }

  protected showPrivacy(): void {
    void this.dialogService.openSimpleDialog({
      title: { key: "privacy" },
      content: this.i18n.t("aboutOfflineNotice"),
      acceptButtonText: { key: "ok" },
      type: "info",
    });
  }

  protected showLicense(): void {
    void this.dialogService.openSimpleDialog({
      title: { key: "license" },
      content: this.i18n.t("licenseGpl"),
      acceptButtonText: { key: "ok" },
      type: "info",
    });
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }
}
