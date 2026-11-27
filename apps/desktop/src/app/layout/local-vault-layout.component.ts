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

import { LocalPassMark } from "@localpass/assets/svg";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { ButtonModule, IconButtonModule, IconModule, SvgModule } from "@localpass/components";
import { LockService, LockSource } from "@localpass/unlock";

interface NavEntry {
  readonly labelKey: string;
  readonly icon:
    | "bwi-vault"
    | "bwi-folder"
    | "bwi-trash"
    | "bwi-generate"
    | "bwi-import"
    | "bwi-download"
    | "bwi-settings"
    | "bwi-globe"
    | "bwi-lock";
  readonly route: string;
  readonly matches: readonly string[];
  readonly badge: "folders" | "trash" | null;
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
        matches: ["/vault"],
        badge: null,
      },
      {
        labelKey: "myFolders",
        icon: "bwi-folder",
        route: "/folders-desktop-v2",
        matches: ["/folders-desktop-v2"],
        badge: "folders",
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
        matches: ["/import"],
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
        icon: "bwi-download",
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
        matches: ["/settings-desktop-v2", "/new-item-v2", "/edit-item-v2"],
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
  imports: [RouterModule, SvgModule, ButtonModule, IconButtonModule, IconModule],
  host: { class: "tw-block tw-h-full" },
  template: `
    <div class="tw-flex tw-h-full tw-bg-background-alt">
      <nav
        class="tw-flex tw-flex-none tw-flex-col tw-bg-bg-nav tw-p-3"
        [style.width.px]="244"
        [attr.aria-label]="i18n.t('primaryNavigation')"
      >
        <div class="tw-flex tw-items-center tw-gap-2 tw-px-2 tw-pb-4">
          <bit-svg
            class="tw-size-7 tw-flex-none tw-text-fg-nav"
            [content]="logo"
            [ariaLabel]="i18n.t('appLogoLabel')"
          ></bit-svg>
          <span class="tw-min-w-0 tw-text-xs tw-text-fg-nav-heading">{{
            i18n.t("localVault")
          }}</span>
        </div>

        @for (section of sections; track section.labelKey) {
          <div class="tw-mb-2">
            <div
              class="tw-px-2.5 tw-pt-2.5 tw-pb-1 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-fg-nav-heading"
            >
              {{ i18n.t(section.labelKey) }}
            </div>
            @for (entry of section.entries; track entry.route) {
              <button
                type="button"
                class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-rounded-lg tw-border-0 tw-bg-transparent tw-px-2.5 tw-py-2 tw-text-start tw-text-sm tw-text-fg-nav-heading tw-transition-colors hover:tw-bg-bg-nav-hover hover:tw-text-fg-nav"
                [style.background-color]="isActive(entry) ? 'var(--color-nav-bg-brand-soft)' : null"
                [class.tw-font-semibold]="isActive(entry)"
                [class.tw-text-fg-nav]="isActive(entry)"
                [attr.aria-current]="isActive(entry) ? 'page' : null"
                data-testid="nav_entry"
                (click)="go(entry.route)"
              >
                <bit-icon [name]="entry.icon" fixedWidth class="tw-w-5 tw-text-center"></bit-icon>
                <span class="tw-min-w-0 tw-flex-1 tw-truncate">{{ i18n.t(entry.labelKey) }}</span>
                @if (badgeFor(entry); as badge) {
                  <span
                    class="tw-rounded-full tw-bg-bg-nav-hover tw-px-2 tw-text-xs tw-font-semibold tw-text-fg-nav"
                    >{{ badge }}</span
                  >
                }
              </button>
            }
          </div>
        }

        <span class="tw-flex-1"></span>

        <div class="tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-bg-bg-nav-hover tw-p-2.5">
          <span
            class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-full tw-bg-bg-nav-hover tw-text-xs tw-font-semibold tw-text-fg-nav"
            aria-hidden="true"
            >{{ accountInitial() }}</span
          >
          <span class="tw-min-w-0 tw-flex-1">
            <span class="tw-block tw-text-sm tw-font-semibold tw-text-fg-nav">{{
              i18n.t("localVault")
            }}</span>
            <span class="tw-block tw-text-xs tw-text-fg-nav-heading">{{
              i18n.t("unlockedEncrypted")
            }}</span>
          </span>
          <button
            type="button"
            class="tw-grid tw-size-8 tw-place-items-center tw-rounded-md tw-border-0 tw-bg-transparent tw-text-fg-nav-heading hover:tw-bg-bg-nav-hover hover:tw-text-fg-nav"
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
    </div>
  `,
})
export class LocalVaultLayoutComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly accountService = inject(AccountService);
  private readonly lockService = inject(LockService);

  protected readonly logo = LocalPassMark;
  protected readonly sections = NAV_SECTIONS;
  protected readonly folderCount = signal(0);
  protected readonly trashCount = signal(0);

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
          this.trashCount.set(views.filter((cipher) => cipher.isDeleted).length);
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
      case "folders":
        return this.folderCount();
      case "trash":
        return this.trashCount();
      default:
        return null;
    }
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
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
    this.folderCount.set(folders.filter((folder) => folder.id !== "").length);
    this.trashCount.set(ciphers.filter((cipher) => cipher.isDeleted).length);
  }
}
