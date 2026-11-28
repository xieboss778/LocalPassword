import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, timeout } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  ITEM_KIND_UI,
  LpEmptyComponent,
  LpKindTileComponent,
  LpPopupHeaderComponent,
  LpToastService,
  VaultDensity,
  VaultDensityService,
  clearClipboardIfStillHolding,
  clipboardClearSeconds,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { Utils } from "@localpass/common/platform/misc/utils";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import { CipherViewLikeUtils } from "@localpass/common/vault/utils/cipher-view-like-utils";
import { ButtonModule, IconModule, LocalPassIcon } from "@localpass/components";
import { BiometricsService, BiometricsStatus } from "@localpass/key-management";
import {
  FIELDS,
  isItemKind,
  ItemKind,
  KIND_FIELD,
  kindFromFields,
  kindOf,
  readField,
} from "@localpass/local-vault";
import { CipherListView } from "@localpass/sdk-internal";
import { LockService, LockSource } from "@localpass/unlock";
import { MY_ITEMS_ROUTE, PasswordRepromptService } from "@localpass/vault";

import { ImportConfirmationPopupService } from "../../../../tools/popup/settings/import/import-confirmation-popup.service";
import { VaultPopupAutofillService } from "../../services/vault-popup-autofill.service";

type Filter = "all" | "login" | "card" | "other";
type FolderFilter = "all" | string;

interface VaultRow {
  readonly id: string;
  readonly kind: ItemKind;
  readonly name: string;
  readonly sub: string;
  readonly favorite: boolean;
  readonly username: string;
  readonly hasSecret: boolean;
  readonly siteMatch: boolean;
}

interface VaultGroup {
  readonly key: string;
  readonly label: string;
  readonly icon?: LocalPassIcon;
  readonly rows: readonly VaultRow[];
}

interface SearchQuery {
  readonly text: string;
  readonly favorite: boolean;
  readonly totp: boolean;
  readonly kind: ItemKind | null;
}

/**
 * 保险库列表（弹窗，AGY 紧凑版）。
 *
 * 数据仍来自 `CipherService` 的列表广播；搜索覆盖名称、用户名、网址、备注与自定义字段，
 * 并支持 `=favorite` / `=totp` / `=ssh` 这类过滤记号。当前标签页匹配的登录条目置顶，
 * 行内 hover 直接复制用户名/密码或填充，不离开列表。
 */
@Component({
  selector: "vault-list-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-h-full",
    "(document:keydown)": "onDocumentKeydown($event)",
  },
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    IconModule,
    LpEmptyComponent,
    LpKindTileComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div
      class="agy tw-flex tw-h-full tw-flex-col tw-bg-background"
      [class.agy-ultra]="density() === 'ultra'"
    >
      <lp-popup-header
        [title]="i18n.t('vault')"
        [avatar]="true"
        [badge]="bridgeOnline() ? i18n.t('bridgeBadge') : null"
        badgeTone="ok"
        [badgeTitle]="i18n.t('touchIdBridgeReady')"
      >
        <div slot="actions" class="tw-flex tw-items-center tw-gap-0.5">
          <button
            type="button"
            class="agy-iconbtn"
            [attr.aria-label]="i18n.t('shortcutHelpTitle')"
            [attr.title]="i18n.t('shortcutHelpTitle')"
            (click)="helpOpen.set(true)"
          >
            <bit-icon name="bwi-question-circle" class="tw-text-base"></bit-icon>
          </button>
          <button
            type="button"
            class="agy-iconbtn"
            [attr.aria-label]="i18n.t('lockVault')"
            [attr.title]="i18n.t('lockVault')"
            (click)="lock()"
          >
            <bit-icon name="bwi-lock" class="tw-text-base"></bit-icon>
          </button>
          <button
            type="button"
            class="agy-iconbtn agy-on"
            [attr.aria-label]="i18n.t('newItem')"
            [attr.title]="i18n.t('newItem')"
            (click)="createItem()"
          >
            <bit-icon name="bwi-plus" class="tw-text-base"></bit-icon>
          </button>
        </div>
      </lp-popup-header>

      @if (ciphers().length) {
        <label class="agy-ext-search">
          <bit-icon name="bwi-search" class="tw-text-xs"></bit-icon>
          <input
            #searchInput
            type="search"
            [attr.aria-label]="i18n.t('searchVault')"
            [attr.placeholder]="i18n.t('searchVaultPlaceholderAll')"
            [value]="query()"
            (input)="onSearch($event)"
          />
        </label>

        @if (activeFolderName()) {
          <div class="tw-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-pb-1">
            <span class="agy-chip agy-brand">
              <bit-icon name="bwi-folder" class="tw-text-xs"></bit-icon>
              {{ activeFolderName() }}
            </span>
            <button type="button" class="agy-btn agy-sm" (click)="clearFolderFilter()">
              {{ i18n.t("clearFilters") }}
            </button>
          </div>
        }

        <div class="agy-ext-tabs" role="tablist">
          @for (item of filters(); track item.id) {
            <button
              type="button"
              role="tab"
              [class.agy-on]="filter() === item.id"
              [attr.aria-selected]="filter() === item.id"
              (click)="filter.set(item.id)"
            >
              {{ item.label }}<span class="agy-n">{{ item.count }}</span>
            </button>
          }
        </div>
      }

      <div class="agy-ext-list" (keydown)="onListKeydown($event)">
        @if (loading()) {
          <p class="tw-px-2 tw-py-6 tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (ciphers().length === 0) {
          <div class="tw-flex tw-h-full tw-flex-col tw-justify-center">
            <lp-empty
              icon="bwi-key"
              [title]="i18n.t('vaultIsEmpty')"
              [text]="i18n.t('emptyVaultText')"
            >
              <button
                type="button"
                class="agy-btn agy-primary agy-lg tw-w-full"
                (click)="createItem()"
              >
                <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
                {{ i18n.t("newItemCta") }}
              </button>
              <button type="button" class="agy-btn agy-lg tw-w-full" (click)="importItems()">
                <bit-icon name="bwi-import" class="tw-text-xs"></bit-icon>
                {{ i18n.t("importData") }}
              </button>
              <button type="button" class="agy-btn agy-lg tw-w-full" (click)="restoreItems()">
                <bit-icon name="bwi-refresh" class="tw-text-xs"></bit-icon>
                {{ i18n.t("restoreVaultFromCloud") }}
              </button>
            </lp-empty>
          </div>
        } @else if (visible().length === 0) {
          <div class="tw-px-5 tw-py-10 tw-text-center">
            <div class="tw-text-xs tw-font-semibold tw-text-main">{{ i18n.t("noResults") }}</div>
            <div class="tw-mt-1 tw-text-xs tw-leading-relaxed tw-text-muted">
              @if (query().trim()) {
                {{ i18n.t("noResultsFor", query().trim()) }}
              } @else {
                {{ i18n.t("emptyFilterHint") }}
              }
            </div>
            <button type="button" class="agy-btn agy-sm tw-mt-3" (click)="clearFilters()">
              {{ i18n.t("clearFilters") }}
            </button>
          </div>
        } @else {
          @for (group of groups(); track group.key) {
            <div class="agy-grouphead">
              @if (group.icon) {
                <bit-icon [name]="group.icon" class="tw-text-xs"></bit-icon>
              }
              <span>{{ group.label }}</span>
              <span class="agy-n">{{ group.rows.length }}</span>
            </div>

            @for (row of group.rows; track row.id; let i = $index) {
              <div
                #rowButton
                class="agy-ext-row"
                [class.agy-on]="activeId() === row.id"
                role="button"
                tabindex="0"
                [attr.data-row]="rowKey(group.key, i)"
                [attr.aria-label]="row.name"
                (click)="open(row.id)"
                (keydown.enter)="open(row.id)"
                (keydown.space)="onRowSpace($event, row.id)"
                (focus)="activeId.set(row.id)"
              >
                <lp-kind-tile [kind]="row.kind" size="sm"></lp-kind-tile>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="agy-t">
                    {{ row.name }}
                    @if (row.favorite) {
                      <bit-icon
                        name="bwi-star-filled"
                        class="tw-ms-0.5 tw-inline tw-align-middle tw-text-xs tw-text-fg-brand"
                      ></bit-icon>
                    }
                  </span>
                  <span class="agy-s">{{ row.sub }}</span>
                </span>
                <span class="agy-m">
                  <span class="agy-idle-meta">
                    <span class="agy-chip">{{ kindLabel(row.kind) }}</span>
                  </span>
                  <span class="agy-hoveracts">
                    @if (row.username) {
                      <button
                        type="button"
                        class="agy-iconbtn agy-sm"
                        [attr.aria-label]="i18n.t('copyUsername')"
                        [attr.title]="i18n.t('copyUsername')"
                        (click)="copyUsername($event, row.username)"
                      >
                        <bit-icon name="bwi-user" class="tw-text-xs"></bit-icon>
                      </button>
                    }
                    @if (row.hasSecret) {
                      <button
                        type="button"
                        class="agy-iconbtn agy-sm"
                        [attr.aria-label]="i18n.t('copyPassword')"
                        [attr.title]="i18n.t('copyPassword')"
                        (click)="copyPassword($event, row.id)"
                      >
                        <bit-icon name="bwi-key" class="tw-text-xs"></bit-icon>
                      </button>
                    }
                    @if (row.siteMatch) {
                      <button
                        type="button"
                        class="agy-btn agy-sm agy-primary"
                        (click)="fill($event, row.id)"
                      >
                        {{ i18n.t("fill") }}
                      </button>
                    }
                  </span>
                </span>
              </div>
            }
          }
        }
      </div>

      @if (helpOpen()) {
        <div class="agy-sheetwrap" (click)="helpOpen.set(false)">
          <div class="agy-sheet" (click)="$event.stopPropagation()">
            <div class="agy-st">{{ i18n.t("shortcutHelpTitle") }}</div>
            <div class="agy-prow">
              <div class="agy-t">{{ i18n.t("shortcutOpenPopup") }}</div>
              <div class="agy-right"><kbd>&#8984;&#8679;Y</kbd></div>
            </div>
            <div class="agy-prow">
              <div class="agy-t">{{ i18n.t("shortcutFillPage") }}</div>
              <div class="agy-right"><kbd>&#8984;&#8679;L</kbd></div>
            </div>
            <div class="agy-prow">
              <div class="agy-t">{{ i18n.t("shortcutListMove") }}</div>
              <div class="agy-right"><kbd>&#8593;&#8595;</kbd> <kbd>&#8629;</kbd></div>
            </div>
            <div class="agy-prow">
              <div class="agy-t">{{ i18n.t("shortcutCopyFields") }}</div>
              <div class="agy-right"><kbd>&#8984;C</kbd> <kbd>&#8679;&#8984;C</kbd></div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class VaultListV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly accountService = inject(AccountService);
  private readonly lockService = inject(LockService);
  private readonly toast = inject(LpToastService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly importConfirmationPopup = inject(ImportConfirmationPopupService);
  private readonly autofillService = inject(VaultPopupAutofillService);
  private readonly densityService = inject(VaultDensityService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly biometricsService = inject(BiometricsService, { optional: true });
  private readonly autofillSettingsService = inject(AutofillSettingsServiceAbstraction, {
    optional: true,
  });

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>("searchInput");
  private readonly rows = viewChildren<ElementRef<HTMLElement>>("rowButton");

  protected readonly density = toSignal(this.densityService.density$, {
    initialValue: VaultDensity.Compact,
  });
  private readonly clearClipboardDelay = this.autofillSettingsService
    ? toSignal(this.autofillSettingsService.clearClipboardDelay$, {
        initialValue: ClearClipboardDelay.ThirtySeconds,
      })
    : signal(ClearClipboardDelay.ThirtySeconds);

  protected readonly loading = signal(true);
  protected readonly query = signal("");
  protected readonly ciphers = signal<CipherListView[]>([]);
  protected readonly folders = signal<FolderView[]>([]);
  protected readonly filter = signal<Filter>("all");
  protected readonly folderFilter = signal<FolderFilter>("all");
  protected readonly helpOpen = signal(false);
  protected readonly activeId = signal<string | null>(null);
  protected readonly bridgeOnline = signal(false);

  private readonly currentTab = toSignal(this.autofillService.currentAutofillTab$, {
    initialValue: null,
  });

  protected readonly activeFolderName = computed(() => {
    const folder = this.folderFilter();
    if (folder === "all") {
      return "";
    }
    return this.folderName(folder) || folder;
  });

  private readonly folderScopedCiphers = computed(() => {
    const folder = this.folderFilter();
    const items = this.ciphers();
    if (folder === "all") {
      return items;
    }
    return items.filter((cipher) => String(cipher.folderId ?? "") === folder);
  });

  /** 当前标签页的主机名；只在 http(s) 页面参与置顶匹配。 */
  protected readonly siteHost = computed(() => {
    const url = this.currentTab()?.url;
    if (!url || !/^https?:/i.test(url)) {
      return "";
    }
    return (Utils.getHostname(url) ?? "").toLowerCase();
  });

  protected readonly filters = computed<readonly { id: Filter; label: string; count: number }[]>(
    () => {
      const items = this.folderScopedCiphers();
      return [
        { id: "all", label: this.i18n.t("allItems"), count: items.length },
        {
          id: "login",
          label: this.i18n.t("typeLogin"),
          count: items.filter((cipher) => this.kindOf(cipher) === ItemKind.Login).length,
        },
        {
          id: "card",
          label: this.i18n.t("typeCard"),
          count: items.filter((cipher) => this.kindOf(cipher) === ItemKind.Card).length,
        },
        {
          id: "other",
          label: this.i18n.t("other"),
          count: items.filter((cipher) => {
            const kind = this.kindOf(cipher);
            return kind !== ItemKind.Login && kind !== ItemKind.Card;
          }).length,
        },
      ];
    },
  );

  private readonly parsedQuery = computed(() => parseSearch(this.query()));

  protected readonly visible = computed(() => {
    const query = this.parsedQuery();
    const filter = this.filter();
    const folder = this.folderFilter();
    const host = this.siteHost();

    return this.ciphers()
      .filter((cipher) => {
        if (cipher.deletedDate != null || cipher.archivedDate != null) {
          return false;
        }
        if (folder !== "all" && String(cipher.folderId ?? "") !== folder) {
          return false;
        }
        const kind = this.kindOf(cipher);
        if (filter === "login" && kind !== ItemKind.Login) {
          return false;
        }
        if (filter === "card" && kind !== ItemKind.Card) {
          return false;
        }
        if (filter === "other" && (kind === ItemKind.Login || kind === ItemKind.Card)) {
          return false;
        }
        if (query.favorite && !cipher.favorite) {
          return false;
        }
        if (query.totp && !this.totpOf(cipher)) {
          return false;
        }
        if (query.kind && kind !== query.kind) {
          return false;
        }
        return !query.text || this.searchSources(cipher, query.text).length > 0;
      })
      .sort((a, b) => this.revisionTime(b) - this.revisionTime(a) || a.name.localeCompare(b.name))
      .map((cipher) => this.toRow(cipher, host));
  });

  protected readonly groups = computed<readonly VaultGroup[]>(() => {
    const rows = this.visible();
    const query = this.parsedQuery();
    if (query.text || query.favorite || query.totp || query.kind) {
      return [{ key: "results", label: this.i18n.t("searchResults"), rows }];
    }

    const site = rows.filter((row) => row.siteMatch);
    const rest = rows.filter((row) => !row.siteMatch);
    const groups: VaultGroup[] = [];
    if (site.length) {
      groups.push({
        key: "site",
        label: this.siteGroupLabel(),
        icon: "bwi-globe",
        rows: site,
      });
    }
    groups.push({ key: "all", label: this.i18n.t("recentAndAll"), rows: rest });
    return groups;
  });

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    // 列表视图由后台解密并广播，弹窗不再自己解一遍保险库。慢的时候先收起加载态，
    // 后续广播仍然会把真实数据补上。
    const loadingFallback = setTimeout(() => this.loading.set(false), 8000);
    this.cipherService
      .cipherListViewsIncludingRestricted$(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((views) => {
        if (views == null) {
          return;
        }
        clearTimeout(loadingFallback);
        const listViews = views.filter(CipherViewLikeUtils.isCipherListView);
        this.ciphers.set(
          this.scoped(
            listViews.filter((view) => view.deletedDate == null && view.archivedDate == null),
          ),
        );
        this.loading.set(false);
      });

    // 文件夹名只影响筛选与副标题；拿不到也先把列表放出来。
    firstValueFrom(this.folderService.folderViews$(userId).pipe(timeout(5000))).then(
      (folders) => {
        this.folders.set(folders.filter((folder) => folder.id !== ""));
      },
      () => {
        this.folders.set([]);
      },
    );

    const folder = this.route.snapshot.queryParamMap.get("folder");
    if (folder) {
      this.folderFilter.set(folder);
    }
    // The folders screen deep-links here while this component may already be cached; follow
    // later query changes instead of only reading the first snapshot.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.folderFilter.set(params.get("folder") ?? "all");
    });

    // An import that finished in its own tab leaves its result for the popup to show.
    void this.importConfirmationPopup.conditionallyOpen(userId);
    void this.refreshBridgeStatus();
  }

  private async refreshBridgeStatus(): Promise<void> {
    try {
      const status = await this.biometricsService?.getBiometricsStatus();
      this.bridgeOnline.set(status === BiometricsStatus.Available);
    } catch {
      this.bridgeOnline.set(false);
    }
  }

  protected clearFolderFilter(): void {
    this.folderFilter.set("all");
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.helpOpen()) {
      event.preventDefault();
      this.helpOpen.set(false);
      return;
    }

    const target = event.target as HTMLElement | null;
    const inInput =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "SELECT" ||
      target?.isContentEditable;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.searchInput()?.nativeElement.focus();
      return;
    }
    if (inInput) {
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
      this.searchInput()?.nativeElement.focus();
      return;
    }
    if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      this.helpOpen.set(!this.helpOpen());
      return;
    }

    const activeId = this.activeId();
    if (!activeId || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "c") {
      return;
    }
    if (window.getSelection()?.toString()) {
      return;
    }
    const activeRow = this.visible().find((row) => row.id === activeId);
    if (!activeRow) {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      void this.copyPassword(event, activeRow.id);
    } else if (activeRow.username) {
      this.copyUsername(event, activeRow.username);
    } else if (activeRow.hasSecret) {
      void this.copyPassword(event, activeRow.id);
    }
  }

  protected kindLabel(kind: ItemKind): string {
    return this.i18n.t(ITEM_KIND_UI[kind].labelKey);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.query.set("");
    this.filter.set("all");
    this.folderFilter.set("all");
    // 文件夹筛选来自 URL，若只改本地信号，下次进入列表时旧 query 又会把筛选带回来。
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  protected importItems(): void {
    void this.router.navigate(["/import-source-v2"], {
      queryParams: { next: "/tabs/vault" },
    });
  }

  protected restoreItems(): void {
    void this.router.navigateByUrl("/restore-vault");
  }

  protected createItem(): void {
    void this.router.navigate(["/new-item-v2"], {
      queryParams: { next: "/tabs/vault" },
    });
  }

  protected open(id: string): void {
    void this.router.navigate(["/view-cipher-v2"], { queryParams: { cipherId: id } });
  }

  protected onRowSpace(event: Event, id: string): void {
    event.preventDefault();
    this.open(id);
  }

  /** ↑↓ 在行之间移动焦点，Enter 由行自身的键盘处理。 */
  protected onListKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const list = this.rows();
    if (!list.length) {
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    const index = active ? list.findIndex((row) => row.nativeElement === active) : -1;
    if (index === -1) {
      return;
    }
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    if (next < 0 || next >= list.length) {
      return;
    }
    event.preventDefault();
    list[next].nativeElement.focus();
    list[next].nativeElement.scrollIntoView({ block: "nearest" });
  }

  protected rowKey(group: string, index: number): string {
    return `${group}:${index}`;
  }

  protected copyUsername(event: Event, username: string): void {
    event.stopPropagation();
    const copied = this.platformUtilsService.copyToClipboard(username, { window });
    if (copied !== false) {
      this.showCopyToast(this.i18n.t("valueCopied", this.i18n.t("username")), username);
    }
  }

  protected async copyPassword(event: Event, id: string): Promise<void> {
    event.stopPropagation();
    const view = await this.decrypt(id);
    if (!view) {
      return;
    }
    if (!(await this.passwordRepromptService.passwordRepromptCheck(view).catch(() => false))) {
      return;
    }
    const kind = kindOf(view);
    const secretField = FIELDS[kind].find((field) => field.password);
    const secretValue =
      (secretField ? readField(view, secretField.target) : "") || view.login?.password || "";
    if (!secretValue) {
      return;
    }
    const label = secretField ? this.i18n.t(secretField.labelKey) : this.i18n.t("password");
    const copied = this.platformUtilsService.copyToClipboard(secretValue, { window });
    if (copied !== false) {
      this.showCopyToast(this.i18n.t("valueCopied", label), secretValue);
    }
  }

  private showCopyToast(message: string, value: string): void {
    const delay = clipboardClearSeconds(this.clearClipboardDelay());
    if (delay > 0) {
      this.toast.showClipboard(
        message,
        () => clearClipboardIfStillHolding(this.platformUtilsService, value),
        delay,
      );
    } else {
      this.toast.show(message);
    }
  }

  protected async fill(event: Event, id: string): Promise<void> {
    event.stopPropagation();
    const view = await this.decrypt(id);
    if (!view) {
      return;
    }
    await this.autofillService.doAutofill(view, true, false);
  }

  protected async lock(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.lockService.lock(userId, LockSource.Manual);
    await this.router.navigateByUrl("/");
  }

  /** `/vault/:vaultId` 或 `…/my-items` 收窄作用域；其余路由不裁剪。 */
  private scoped(ciphers: CipherListView[]): CipherListView[] {
    const vaultId = this.route.snapshot.paramMap.get("vaultId");
    if (vaultId == null) {
      return ciphers;
    }

    const myItemsOnly = this.router.url.includes(`/${MY_ITEMS_ROUTE}`);
    return ciphers.filter(
      (cipher) =>
        String(cipher.organizationId) === vaultId &&
        (!myItemsOnly || cipher.collectionIds.length === 0),
    );
  }

  private folderName(folderId: unknown): string {
    if (folderId == null || folderId === "") {
      return "";
    }
    const id = String(folderId);
    return this.folders().find((folder) => folder.id === id)?.name ?? "";
  }

  private kindOf(view: CipherListView): ItemKind {
    return kindFromFields(view.fields, CipherViewLikeUtils.getType(view));
  }

  private usernameOf(view: CipherListView): string {
    const type = view.type;
    return typeof type === "object" && type !== null && "login" in type
      ? (type.login?.username ?? "")
      : "";
  }

  private totpOf(view: CipherListView): string {
    const type = view.type;
    return typeof type === "object" && type !== null && "login" in type
      ? (type.login?.totp ?? "")
      : "";
  }

  private loginUris(view: CipherListView): readonly string[] {
    const type = view.type;
    if (typeof type !== "object" || type === null || !("login" in type)) {
      return [];
    }
    return (type.login?.uris ?? [])
      .map((uri) => uri.uri ?? "")
      .filter((uri): uri is string => uri.length > 0);
  }

  private matchesSite(view: CipherListView, host: string): boolean {
    if (!host || this.kindOf(view) !== ItemKind.Login) {
      return false;
    }
    return this.loginUris(view).some((uri) => {
      const uriHost = (Utils.getHostname(uri) ?? "").toLowerCase();
      if (!uriHost) {
        return false;
      }
      return (
        uriHost === host ||
        uriHost === `www.${host}` ||
        (uriHost.startsWith("www.") && uriHost.slice(4) === host)
      );
    });
  }

  protected siteGroupLabel(): string {
    return this.siteHost()
      ? `${this.i18n.t("currentTab")} · ${this.siteHost()}`
      : this.i18n.t("currentTab");
  }

  private toRow(view: CipherListView, host: string): VaultRow {
    const kind = this.kindOf(view);
    const query = this.parsedQuery();
    const sources = query.text ? this.searchSources(view, query.text) : [];
    const sub = sources.length ? sources[0] : this.subtitleOf(view, kind);
    return {
      id: String(view.id ?? ""),
      kind,
      name: view.name,
      sub,
      favorite: view.favorite,
      // Only logins have a username to copy; for tokens/servers that slot holds a service
      // or host, which should not grow a username copy affordance.
      username: kind === ItemKind.Login ? this.usernameOf(view) : "",
      hasSecret: kind !== ItemKind.Note && kind !== ItemKind.Identity,
      siteMatch: this.matchesSite(view, host),
    };
  }

  /** 全字段搜索命中的「字段: 片段」，用来解释这一行为什么出现在结果里。 */
  private searchSources(view: CipherListView, rawQuery: string): readonly string[] {
    const query = rawQuery.toLowerCase();
    const sources: string[] = [];
    const push = (label: string, value: string | null | undefined) => {
      const text = (value ?? "").trim();
      if (text && text.toLowerCase().includes(query)) {
        sources.push(`${label}: ${snippet(text, query)}`);
      }
    };

    push(this.i18n.t("name"), view.name);
    push(this.i18n.t("username"), this.usernameOf(view));
    push(this.i18n.t("folder"), this.folderName(view.folderId));
    push(this.i18n.t("notes"), view.notes);
    push(this.i18n.t("uri"), this.loginUris(view).join(" "));
    for (const field of view.fields ?? []) {
      if (field.name === KIND_FIELD) {
        continue;
      }
      push(field.name || this.i18n.t("customFields"), field.value);
    }
    return sources;
  }

  /** Kind-aware subtitle: kind + the fields this kind actually carries, never a raw username. */
  private subtitleOf(view: CipherListView, kind: ItemKind): string {
    const label = this.kindLabel(kind);
    switch (kind) {
      case ItemKind.Login:
        return this.usernameOf(view) || label;
      case ItemKind.Token:
        return joinParts([label, this.envOf(view)]);
      case ItemKind.Server:
        return joinParts([
          this.serverAddressOf(view),
          this.fieldValue(view, "protocol").toUpperCase() || label,
        ]);
      case ItemKind.License:
        return joinParts([label, this.fieldValue(view, "seats")]);
      case ItemKind.Card:
        return this.cardSubtitle(view.subtitle) || label;
      case ItemKind.Note: {
        const notes = view.notes?.trim();
        return notes
          ? `${label} · ${this.i18n.t("lineCount", String(notes.split(/\r?\n/).length))}`
          : label;
      }
      case ItemKind.SshKey:
      case ItemKind.Identity:
        // The list view carries no SSH fingerprint or identity document type; the closest
        // honest value is the kind label.
        return label;
    }
  }

  private fieldValue(view: CipherListView, name: string): string {
    return view.fields?.find((field) => field.name === name)?.value?.trim() ?? "";
  }

  private envOf(view: CipherListView): string {
    const env = this.fieldValue(view, "env");
    if (!env || /环境$|environment$/i.test(env)) {
      return env;
    }
    return this.i18n.t("environmentLabel", env);
  }

  private serverAddressOf(view: CipherListView): string {
    const host = this.usernameOf(view);
    if (!host) {
      return "";
    }
    const protocol = this.fieldValue(view, "protocol");
    return !host.includes(":") && /^ssh$/i.test(protocol) ? `${host}:22` : host;
  }

  private cardSubtitle(subtitle: string | undefined): string {
    const last4 = /(\d{4})\s*$/.exec(subtitle ?? "")?.[1];
    return last4 ? `•••• ${last4}` : (subtitle ?? "").trim();
  }

  private revisionTime(view: CipherListView): number {
    const time = new Date(view.revisionDate).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  /** 列表只持有脱敏视图；复制/填充时才按 id 取回并解密单条。 */
  private async decrypt(id: string) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.cipherService.get(id, userId);
    return this.cipherService.decrypt(cipher, userId);
  }
}

function joinParts(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => !!part).join(" · ");
}

function snippet(text: string, query: string): string {
  const index = text.toLowerCase().indexOf(query);
  if (index < 0) {
    return text;
  }
  const start = Math.max(0, index - 12);
  const end = Math.min(text.length, index + query.length + 24);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** 支持 `=favorite`、`=totp`、`=ssh`、`=login` 等过滤记号；其余词仍做全字段检索。 */
function parseSearch(query: string): SearchQuery {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const text: string[] = [];
  let favorite = false;
  let totp = false;
  let kind: ItemKind | null = null;

  for (const word of words) {
    const token = word.toLowerCase();
    if (token === "=favorite" || token === "=fav") {
      favorite = true;
      continue;
    }
    if (token === "=totp" || token === "=2fa") {
      totp = true;
      continue;
    }
    const mapped = KIND_TOKENS[token];
    if (mapped) {
      kind = mapped;
      continue;
    }
    if (isItemKind(token)) {
      kind = token;
      continue;
    }
    text.push(word);
  }

  return { text: text.join(" "), favorite, totp, kind };
}

const KIND_TOKENS: Readonly<Record<string, ItemKind>> = Object.freeze({
  "=login": ItemKind.Login,
  "=card": ItemKind.Card,
  "=identity": ItemKind.Identity,
  "=note": ItemKind.Note,
  "=token": ItemKind.Token,
  "=server": ItemKind.Server,
  "=license": ItemKind.License,
  "=ssh": ItemKind.SshKey,
});
