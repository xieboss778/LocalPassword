import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, filter, map, switchMap } from "rxjs";

import { LpToastService } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { IconModule } from "@localpass/components";
import {
  DEFAULT_PASSWORD_OPTIONS,
  generatePasswords,
  ItemKind,
  kindOf,
} from "@localpass/local-vault";
import { LockService, LockSource } from "@localpass/unlock";

const GENERATED_PASSWORD_OPTIONS = { ...DEFAULT_PASSWORD_OPTIONS, length: 20 } as const;
const RECENT_LIMIT = 4;

/**
 * 304×380 菜单栏托盘面板：搜索、复制密码、本地生成并复制，以及锁定或打开主窗口。
 *
 * 只显示未删除、未归档且带密码的登录条目；不展示 TOTP，也不复制用户名之外的数据。
 * 数据来自当前已解锁的本机保险库，不新增缓存，也不留明文在磁盘上。
 */
@Component({
  selector: "tray-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-h-full",
    "(document:keydown)": "onKeyDown($event)",
  },
  imports: [CommonModule, IconModule],
  template: `
    <div class="agy agy-tray">
      <div class="agy-tray-head">
        <label class="agy-ext-search">
          <bit-icon name="bwi-search" class="tw-text-xs"></bit-icon>
          <input
            #searchInput
            id="tray_input_search"
            type="search"
            [value]="query()"
            [placeholder]="i18n.t('trayQuickSearch')"
            [attr.aria-label]="i18n.t('trayQuickSearch')"
            (input)="onQuery($event)"
          />
        </label>
        <button
          type="button"
          class="agy-iconbtn"
          id="tray_button_lock"
          [attr.title]="i18n.t('lockVault')"
          [attr.aria-label]="i18n.t('lockVault')"
          (click)="lock()"
        >
          <bit-icon name="bwi-lock" class="tw-text-sm"></bit-icon>
        </button>
      </div>

      <div class="agy-tray-scroll">
        <h2 class="agy-seclbl">{{ i18n.t("trayRecent") }}</h2>
        @if (!items().length) {
          <p class="agy-empty-s tw-px-2 tw-py-6 tw-text-center">
            {{ i18n.t(query() ? "noMatchingItems" : "noItemsInVault") }}
          </p>
        } @else {
          @for (item of items(); track item.id; let i = $index) {
            <div
              class="agy-ext-row agy-tray-row"
              [class.agy-on]="i === activeIndex()"
              (mouseenter)="activeIndex.set(i)"
              (click)="copyPassword(item)"
            >
              <span class="agy-avatar" aria-hidden="true">{{ initial(item) }}</span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="agy-t">{{ item.name }}</span>
                <span class="agy-s">{{ subtitle(item) }}</span>
              </span>
              <span class="agy-m">
                <button
                  type="button"
                  class="agy-iconbtn agy-sm"
                  [attr.id]="'tray_button_copy_' + item.id"
                  [attr.title]="i18n.t('copyPassword')"
                  [attr.aria-label]="i18n.t('copyPassword')"
                  (click)="$event.stopPropagation(); copyPassword(item)"
                >
                  <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                </button>
              </span>
            </div>
          }
        }
      </div>

      <div class="agy-tray-foot">
        <button type="button" class="agy-btn agy-sm" id="tray_button_generate" (click)="generate()">
          <bit-icon name="bwi-generate" class="tw-text-xs"></bit-icon>
          {{ i18n.t("trayGenerate") }}
        </button>
        <button
          type="button"
          class="agy-btn agy-sm agy-primary tw-ml-auto"
          id="tray_button_open_main"
          (click)="openMainWindow()"
        >
          {{ i18n.t("trayOpenMain") }}
        </button>
      </div>
    </div>
  `,
})
export class TrayV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly messagingService = inject(MessagingService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly lockService = inject(LockService);
  private readonly toast = inject(LpToastService);

  protected readonly query = signal("");
  protected readonly activeIndex = signal(0);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>("searchInput");

  private readonly ciphers = toSignal(
    this.accountService.activeAccount$.pipe(
      takeUntilDestroyed(),
      filter((account) => account != null),
      map((account) => account.id),
      switchMap((userId) => this.cipherService.cipherViews$(userId)),
    ),
    { initialValue: [] as CipherView[] },
  );

  private readonly activeLogins = computed(() =>
    this.ciphers()
      .filter(
        (cipher) =>
          cipher.type === CipherType.Login &&
          kindOf(cipher) === ItemKind.Login &&
          !cipher.isDeleted &&
          !cipher.isArchived &&
          (cipher.login?.password ?? "") !== "",
      )
      .sort((a, b) => (b.revisionDate?.getTime() ?? 0) - (a.revisionDate?.getTime() ?? 0)),
  );

  protected readonly items = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    if (!query) {
      return this.activeLogins().slice(0, RECENT_LIMIT);
    }

    return this.activeLogins().filter((cipher) => {
      const haystack = [
        cipher.name,
        cipher.login?.username,
        ...(cipher.login?.uris?.map((uri) => uri.uri) ?? []),
      ];
      return haystack.some((value) => value?.toLocaleLowerCase().includes(query));
    });
  });

  async ngOnInit(): Promise<void> {
    // 独立托盘窗口没有可拖拽标题栏，隐藏主窗口专属的顶部拖拽区。
    await this.accountService.setShowHeader(false);
    this.searchInput()?.nativeElement.focus();
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected initial(item: CipherView): string {
    return (item.name || "?").slice(0, 1).toUpperCase();
  }

  /** 用户名优先；没有用户名时用第一个网址的主机名。 */
  protected subtitle(item: CipherView): string {
    if (item.login?.username) {
      return item.login.username;
    }
    const uri = item.login?.uris?.[0]?.uri;
    if (!uri) {
      return this.i18n.t("itemKindLogin");
    }
    try {
      return new URL(uri).hostname;
    } catch {
      return uri;
    }
  }

  protected copyPassword(item: CipherView): void {
    const password = item.login?.password;
    if (!password) {
      return;
    }
    this.platformUtilsService.copyToClipboard(password);
    this.toast.showClipboard(this.i18n.t("valueCopied", this.i18n.t("password")), () => {
      this.platformUtilsService.copyToClipboard("", { clearing: true });
    });
  }

  protected generate(): void {
    const [password] = generatePasswords(1, GENERATED_PASSWORD_OPTIONS);
    if (!password) {
      return;
    }
    this.platformUtilsService.copyToClipboard(password);
    this.toast.showClipboard(this.i18n.t("passwordGenerated"), () => {
      this.platformUtilsService.copyToClipboard("", { clearing: true });
    });
  }

  protected openMainWindow(): void {
    this.messagingService.send("trayOpenMain");
  }

  protected close(): void {
    this.messagingService.send("trayClose");
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }
    const meta = event.metaKey || event.ctrlKey;
    if (!meta && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      const list = this.items();
      if (!list.length) {
        return;
      }
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      this.activeIndex.set(Math.min(list.length - 1, Math.max(0, this.activeIndex() + delta)));
      return;
    }
    if (!meta && event.key === "Enter") {
      const active = this.items()[this.activeIndex()];
      if (active) {
        event.preventDefault();
        this.copyPassword(active);
      }
      return;
    }
    if (meta && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      void this.lock();
    }
  }

  protected async lock(): Promise<void> {
    const userId: UserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.lockService.lock(userId, LockSource.Manual);
    this.close();
  }
}
