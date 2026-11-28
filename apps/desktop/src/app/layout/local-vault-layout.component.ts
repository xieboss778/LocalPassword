import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { firstValueFrom, filter, map, startWith, distinctUntilChanged, of, switchMap } from "rxjs";

import { DesktopShortcut, DesktopShortcutsService } from "@localpass/angular/local-ui";
import { scanVaultHealth } from "@localpass/angular/tools/health/vault-health.scan";
import { LocalPassMark } from "@localpass/assets/svg";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { ButtonModule, IconButtonModule, IconModule, SvgModule } from "@localpass/components";
import { LockService, LockSource } from "@localpass/unlock";

import { LocalQuickAccessComponent } from "./quick-access.component";

interface NavEntry {
  readonly labelKey: string;
  readonly icon:
    | "bwi-vault"
    | "bwi-shield"
    | "bwi-folder"
    | "bwi-archive"
    | "bwi-trash"
    | "bwi-generate"
    | "bwi-import"
    | "bwi-download"
    | "bwi-refresh"
    | "bwi-settings"
    | "bwi-globe"
    | "bwi-lock";
  readonly route: string;
  readonly matches: readonly string[];
  readonly badge: "vault" | "folders" | "health" | "archive" | "trash" | null;
}

interface NavSection {
  readonly labelKey: string;
  readonly entries: readonly NavEntry[];
}

const NAV_SECTIONS: readonly NavSection[] = [
  {
    labelKey: "vault",
    entries: [
      {
        labelKey: "vault",
        icon: "bwi-vault",
        route: "/vault",
        matches: ["/vault", "/new-item-v2", "/edit-item-v2"],
        badge: "vault",
      },
      {
        labelKey: "healthCheck",
        icon: "bwi-shield",
        route: "/health-v2",
        matches: ["/health-v2"],
        badge: "health",
      },
      {
        labelKey: "myFolders",
        icon: "bwi-folder",
        route: "/folders-desktop-v2",
        matches: ["/folders-desktop-v2"],
        badge: "folders",
      },
      {
        labelKey: "archiveNoun",
        icon: "bwi-archive",
        route: "/archive-v2",
        matches: ["/archive-v2"],
        badge: "archive",
      },
      {
        labelKey: "trash",
        icon: "bwi-trash",
        route: "/trash-desktop-v2",
        matches: ["/trash-desktop-v2"],
        badge: "trash",
      },
    ],
  },
  {
    labelKey: "tools",
    entries: [
      {
        labelKey: "generator",
        icon: "bwi-generate",
        route: "/generator",
        matches: ["/generator", "/generator-history-v2"],
        badge: null,
      },
      {
        labelKey: "importNoun",
        icon: "bwi-import",
        route: "/import",
        matches: ["/import", "/import-preview", "/import-google-auth"],
        badge: null,
      },
      {
        labelKey: "exportNoun",
        icon: "bwi-download",
        route: "/export",
        matches: ["/export"],
        badge: null,
      },
      {
        labelKey: "cloudBackup",
        icon: "bwi-refresh",
        route: "/backup-settings",
        matches: ["/backup-settings", "/backup-config", "/restore"],
        badge: null,
      },
    ],
  },
  {
    labelKey: "manage",
    entries: [
      {
        labelKey: "settings",
        icon: "bwi-settings",
        route: "/settings-desktop-v2",
        matches: ["/settings-desktop-v2"],
        badge: null,
      },
      {
        labelKey: "networkGate",
        icon: "bwi-globe",
        route: "/network-gate",
        matches: ["/network-gate"],
        badge: null,
      },
      {
        labelKey: "dataAndSafety",
        icon: "bwi-lock",
        route: "/data-safety",
        matches: ["/data-safety"],
        badge: null,
      },
    ],
  },
];

/**
 * 桌面端外壳：Bitwarden 式深蓝左侧栏 + 路由内容。
 *
 * 保险库、文件夹、回收站在「保险库」分组，工具与管理各自成组；底部显示本机保险库状态
 * 与手动锁定入口。计数来自真实数据，每次导航后刷新。
 */
@Component({
  selector: "local-vault-layout",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    SvgModule,
    ButtonModule,
    IconButtonModule,
    IconModule,
    LocalQuickAccessComponent,
  ],
  host: {
    class: "tw-block tw-h-full",
    "(document:keydown)": "onDocumentKeyDown($event)",
  },
  template: `
    <div class="tw-flex tw-h-full tw-bg-background-alt tw-relative">
      <nav class="agy-sidenav" [attr.aria-label]="i18n.t('primaryNavigation')">
        <div class="agy-sidenav-brand">
          <bit-svg [content]="logo" [ariaLabel]="i18n.t('appLogoLabel')"></bit-svg>
          <span class="agy-sidenav-brandtitle">{{ i18n.t("localVault") }}</span>
          <button
            type="button"
            class="agy-iconbtn agy-sm tw-ms-auto"
            [attr.aria-label]="i18n.t('quickAccess')"
            [attr.title]="i18n.t('quickAccess') + ' (⌘K)'"
            (click)="quickOpen.set(true)"
          >
            <bit-icon name="bwi-search" class="tw-text-xs"></bit-icon>
          </button>
        </div>

        @for (section of sections; track section.labelKey) {
          <div class="agy-sidenav-sec">{{ i18n.t(section.labelKey) }}</div>
          @for (entry of section.entries; track entry.route) {
            <button
              type="button"
              class="agy-sidenav-row"
              [class.agy-on]="isActive(entry)"
              [attr.aria-current]="isActive(entry) ? 'page' : null"
              data-testid="nav_entry"
              (click)="go(entry.route)"
            >
              <bit-icon [name]="entry.icon"></bit-icon>
              <span class="agy-sidenav-label">{{ i18n.t(entry.labelKey) }}</span>
              @if (badgeFor(entry); as badge) {
                <span class="agy-sidenav-badge">{{ badge }}</span>
              }
            </button>
          }
        }

        <span class="tw-flex-1"></span>

        <div class="agy-sidenav-foot">
          <span class="agy-avatar" aria-hidden="true">{{ accountInitial() }}</span>
          <span class="agy-sidenav-foottext">
            <b>{{ i18n.t("localVault") }}</b>
            <span>{{ i18n.t("unlockedEncrypted") }}</span>
          </span>
          <button
            type="button"
            class="agy-sidenav-lock"
            [attr.aria-label]="i18n.t('lockVault')"
            [attr.title]="i18n.t('lockVault')"
            (click)="lock()"
          >
            <bit-icon name="bwi-lock"></bit-icon>
          </button>
        </div>
      </nav>

      <main class="tw-relative tw-flex tw-h-full tw-min-w-0 tw-flex-1 tw-flex-col">
        <router-outlet></router-outlet>
      </main>

      <local-quick-access [open]="quickOpen()" (closed)="quickOpen.set(false)"></local-quick-access>
    </div>
  `,
})
export class LocalVaultLayoutComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly accountService = inject(AccountService);
  private readonly passwordStrengthService = inject(PasswordStrengthServiceAbstraction);
  private readonly lockService = inject(LockService);
  private readonly shortcutsService = inject(DesktopShortcutsService);

  protected readonly logo = LocalPassMark;
  protected readonly sections = NAV_SECTIONS;
  protected readonly vaultCount = signal(0);
  protected readonly folderCount = signal(0);
  protected readonly healthCount = signal(0);
  protected readonly archiveCount = signal(0);
  protected readonly trashCount = signal(0);
  protected readonly quickOpen = signal(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly activeUrl = computed(() => this.currentUrl());

  private readonly activeAccount = toSignal(this.accountService.activeAccount$, {
    initialValue: null,
  });

  protected readonly accountInitial = computed(() => {
    const account = this.activeAccount();
    const label = account?.name || account?.email || "";
    return label.slice(0, 1).toUpperCase() || "LP";
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.refreshCounts());

    // 恢复/永久删除不会触发导航；跟着解密后的条目与文件夹列表更新角标，避免停在旧数字上。
    this.accountService.activeAccount$
      .pipe(
        map((account) => account?.id),
        distinctUntilChanged(),
        switchMap((userId) => (userId ? this.cipherService.cipherViews$(userId) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((views) => {
        if (views) {
          this.vaultCount.set(
            views.filter((cipher) => !cipher.isDeleted && !cipher.isArchived).length,
          );
          this.trashCount.set(views.filter((cipher) => cipher.isDeleted).length);
          this.archiveCount.set(
            views.filter((cipher) => cipher.isArchived && !cipher.isDeleted).length,
          );
          this.healthCount.set(scanVaultHealth(views, this.passwordStrengthService).issues.length);
        }
      });

    this.accountService.activeAccount$
      .pipe(
        map((account) => account?.id),
        distinctUntilChanged(),
        switchMap((userId) => (userId ? this.folderService.folderViews$(userId) : of([]))),
        takeUntilDestroyed(),
      )
      .subscribe((folders) =>
        this.folderCount.set(folders.filter((folder) => folder.id !== "").length),
      );
  }

  async ngOnInit(): Promise<void> {
    await this.refreshCounts();
  }

  protected isActive(entry: NavEntry): boolean {
    return entry.matches.some((prefix) => this.activeUrl().startsWith(prefix));
  }

  protected badgeFor(entry: NavEntry): number | null {
    switch (entry.badge) {
      case "vault":
        return this.vaultCount();
      case "folders":
        return this.folderCount();
      case "health":
        return this.healthCount();
      case "archive":
        return this.archiveCount();
      case "trash":
        return this.trashCount();
      default:
        return null;
    }
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  /** ⌘K / `/` 只在本应用内打开快速检索，不注册系统全局热键；删除映射后同时失效。 */
  protected onDocumentKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented) {
      return;
    }
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (meta && !event.shiftKey && !event.altKey && key === "k") {
      if (!this.shortcutsService.isEnabled(DesktopShortcut.Search)) {
        return;
      }
      event.preventDefault();
      this.quickOpen.set(true);
      return;
    }

    if (
      !meta &&
      !event.shiftKey &&
      !event.altKey &&
      event.key === "/" &&
      !this.isTyping(event.target) &&
      this.shortcutsService.isEnabled(DesktopShortcut.Search)
    ) {
      event.preventDefault();
      this.quickOpen.set(true);
      return;
    }

    if (meta && !event.shiftKey && !event.altKey && key === "l") {
      if (!this.shortcutsService.isEnabled(DesktopShortcut.Lock)) {
        return;
      }
      event.preventDefault();
      void this.lock();
    }
  }

  private isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return (
      element?.tagName === "INPUT" ||
      element?.tagName === "TEXTAREA" ||
      element?.tagName === "SELECT" ||
      element?.isContentEditable === true
    );
  }

  protected async lock(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.lockService.lock(userId, LockSource.Manual);
  }

  private async refreshCounts(): Promise<void> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }
    const userId = account.id;
    const [ciphers, folders] = await Promise.all([
      this.cipherService.getAllDecrypted(userId),
      firstValueFrom(this.folderService.folderViews$(userId)),
    ]);
    this.vaultCount.set(ciphers.filter((cipher) => !cipher.isDeleted && !cipher.isArchived).length);
    this.folderCount.set(folders.filter((folder) => folder.id !== "").length);
    this.trashCount.set(ciphers.filter((cipher) => cipher.isDeleted).length);
    this.archiveCount.set(
      ciphers.filter((cipher) => cipher.isArchived && !cipher.isDeleted).length,
    );
    this.healthCount.set(scanVaultHealth(ciphers, this.passwordStrengthService).issues.length);
  }
}
