import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, timeout } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  ITEM_KIND_ORDER,
  ITEM_KIND_UI,
  LpEmptyComponent,
  LpKindTileComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import { CipherViewLikeUtils } from "@localpass/common/vault/utils/cipher-view-like-utils";
import { ButtonModule, IconModule, LocalPassIcon } from "@localpass/components";
import { isItemKind, ItemKind, kindFromFields } from "@localpass/local-vault";
import { CipherListView } from "@localpass/sdk-internal";
import { LockService, LockSource } from "@localpass/unlock";
import { MY_ITEMS_ROUTE } from "@localpass/vault";

import { ImportConfirmationPopupService } from "../../../../tools/popup/settings/import/import-confirmation-popup.service";

interface VaultRow {
  readonly id: string;
  readonly kind: ItemKind;
  readonly name: string;
  readonly sub: string;
  readonly favorite: boolean;
  readonly username: string;
}

interface VaultGroup {
  readonly key: string;
  readonly label: string;
  readonly icon?: LocalPassIcon;
  readonly rows: readonly VaultRow[];
}

type TypeFilter = "all" | ItemKind;
type FolderFilter = "all" | string;

/**
 * 保险库列表（弹窗）。
 *
 * 数据仍来自 `CipherService.getAllDecrypted`：按作用域（组织/我的条目）过滤后，
 * 在这里做搜索、类型/文件夹/收藏过滤，再按「收藏 + 所有条目」分组。
 * 新建/编辑/删除都在独立页面，列表只负责读和导航。
 */
@Component({
  selector: "vault-list-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
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
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header [title]="i18n.t('vault')" [sub]="subtitle()">
        <div slot="actions" class="tw-flex tw-items-center tw-gap-0.5">
          @if (ciphers().length) {
            <button
              type="button"
              class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
              [attr.aria-label]="i18n.t('lockVault')"
              [attr.title]="i18n.t('lockVault')"
              (click)="lock()"
            >
              <bit-icon name="bwi-lock" class="tw-text-base"></bit-icon>
            </button>
          }
          <button
            type="button"
            class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-fg-brand hover:tw-bg-bg-brand-softer"
            [attr.aria-label]="i18n.t('newItem')"
            [attr.title]="i18n.t('newItem')"
            (click)="createItem()"
          >
            <bit-icon name="bwi-plus" class="tw-text-lg"></bit-icon>
          </button>
        </div>
      </lp-popup-header>

      @if (ciphers().length) {
        <div class="tw-flex tw-flex-none tw-flex-col tw-gap-2 tw-px-3.5 tw-pb-2">
          <div
            class="tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-border-light tw-bg-background-alt tw-px-2.5 tw-py-2 focus-within:tw-border-border-focus"
          >
            <bit-icon name="bwi-search" class="tw-text-sm tw-text-muted"></bit-icon>
            <input
              type="search"
              class="tw-min-w-0 tw-flex-1 tw-border-0 tw-bg-transparent tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted"
              [attr.aria-label]="i18n.t('searchVault')"
              [attr.placeholder]="i18n.t('searchVaultPlaceholder')"
              [value]="query()"
              (input)="onSearch($event)"
            />
          </div>

          <div class="tw-flex tw-items-center tw-gap-1.5 tw-overflow-x-auto tw-pb-0.5">
            <label
              class="tw-inline-flex tw-flex-none tw-items-center tw-gap-1 tw-rounded-full tw-border tw-border-border-light tw-bg-background tw-py-1 tw-ps-2.5 tw-pe-1.5 tw-text-xs hover:tw-border-border-base"
            >
              <bit-icon name="bwi-list" class="tw-text-xs tw-text-muted"></bit-icon>
              <select
                class="tw-appearance-none tw-border-0 tw-bg-transparent tw-py-0 tw-ps-0.5 tw-pe-0 tw-text-xs tw-font-medium tw-text-main tw-outline-none"
                [attr.aria-label]="i18n.t('type')"
                [value]="typeFilter()"
                (change)="onTypeFilter($event)"
              >
                <option value="all">{{ i18n.t("type") }}</option>
                @for (kind of kinds; track kind) {
                  <option [value]="kind">{{ kindLabel(kind) }}</option>
                }
              </select>
              <bit-icon name="bwi-angle-down" class="tw-text-xs tw-text-muted"></bit-icon>
            </label>

            <label
              class="tw-inline-flex tw-flex-none tw-items-center tw-gap-1 tw-rounded-full tw-border tw-border-border-light tw-bg-background tw-py-1 tw-ps-2.5 tw-pe-1.5 tw-text-xs hover:tw-border-border-base"
            >
              <bit-icon name="bwi-folder" class="tw-text-xs tw-text-muted"></bit-icon>
              <select
                class="tw-appearance-none tw-border-0 tw-bg-transparent tw-py-0 tw-ps-0.5 tw-pe-0 tw-text-xs tw-font-medium tw-text-main tw-outline-none"
                [attr.aria-label]="i18n.t('folder')"
                [value]="folderFilter()"
                (change)="onFolderFilter($event)"
              >
                <option value="all" [selected]="folderFilter() === 'all'">
                  {{ i18n.t("folder") }}
                </option>
                <option value="" [selected]="folderFilter() === ''">
                  {{ i18n.t("noFolder") }}
                </option>
                @for (folder of folders(); track folder.id) {
                  <option [value]="folder.id" [selected]="folderFilter() === folder.id">
                    {{ folder.name }}
                  </option>
                }
              </select>
              <bit-icon name="bwi-angle-down" class="tw-text-xs tw-text-muted"></bit-icon>
            </label>

            <button
              type="button"
              class="tw-inline-flex tw-flex-none tw-items-center tw-gap-1 tw-rounded-full tw-border tw-py-1 tw-ps-2.5 tw-pe-3 tw-text-xs tw-font-medium"
              [class.tw-border-border-brand]="favoritesOnly()"
              [class.tw-bg-bg-brand-softer]="favoritesOnly()"
              [class.tw-text-fg-brand]="favoritesOnly()"
              [class.tw-border-border-light]="!favoritesOnly()"
              [class.tw-bg-background]="!favoritesOnly()"
              [class.tw-text-main]="!favoritesOnly()"
              [attr.aria-pressed]="favoritesOnly()"
              (click)="favoritesOnly.set(!favoritesOnly())"
            >
              <bit-icon
                [name]="favoritesOnly() ? 'bwi-star-filled' : 'bwi-star'"
                class="tw-text-xs"
              ></bit-icon>
              {{ i18n.t("favorites") }}
            </button>
          </div>
        </div>
      }

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-5">
        @if (loading()) {
          <p class="tw-px-2 tw-py-6 tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (ciphers().length === 0) {
          <div class="tw-grid tw-min-h-72 tw-place-items-center">
            <lp-empty
              icon="bwi-vault"
              [title]="i18n.t('vaultIsEmpty')"
              [text]="i18n.t('emptyVaultText')"
            >
              <div class="tw-flex tw-flex-row tw-gap-2">
                <button
                  type="button"
                  bitButton
                  buttonType="primary"
                  startIcon="bwi-plus"
                  (click)="createItem()"
                >
                  {{ i18n.t("newItemCta") }}
                </button>
                <button
                  type="button"
                  bitButton
                  buttonType="secondary"
                  startIcon="bwi-import"
                  (click)="importItems()"
                >
                  {{ i18n.t("importData") }}
                </button>
              </div>
            </lp-empty>
          </div>
        } @else if (visible().length === 0) {
          <div class="tw-grid tw-min-h-72 tw-place-items-center">
            <lp-empty icon="bwi-search" [title]="i18n.t('noResults')" [text]="noResultsHint()">
              @if (isFiltering()) {
                <button type="button" bitButton buttonType="secondary" (click)="clearFilters()">
                  {{ i18n.t("clearFilters") }}
                </button>
              }
            </lp-empty>
          </div>
        } @else {
          @for (group of groups(); track group.key) {
            <section class="tw-pb-1.5">
              <h2
                class="tw-m-0 tw-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-pt-2.5 tw-pb-1 tw-text-xs tw-font-semibold tw-text-muted"
              >
                @if (group.icon) {
                  <bit-icon [name]="group.icon" class="tw-text-[11px]"></bit-icon>
                }
                <span>{{ group.label }}</span>
                @if (group.key !== "favorites") {
                  <span class="tw-font-normal tw-text-muted">{{ group.rows.length }}</span>
                }
              </h2>

              @for (row of group.rows; track row.id) {
                <button
                  type="button"
                  class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-rounded-xl tw-p-2.5 tw-text-start hover:tw-bg-background-alt"
                  (click)="open(row.id)"
                >
                  <lp-kind-tile [kind]="row.kind" size="base"></lp-kind-tile>
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-flex tw-items-center tw-gap-1">
                      <span class="tw-truncate tw-text-sm tw-font-medium tw-text-main">{{
                        row.name
                      }}</span>
                      @if (row.favorite) {
                        <bit-icon
                          name="bwi-star-filled"
                          class="tw-text-xs tw-text-fg-brand"
                        ></bit-icon>
                      }
                    </span>
                    <span
                      class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted"
                      >{{ row.sub }}</span
                    >
                  </span>
                  <span class="tw-flex tw-flex-none tw-items-center tw-gap-0.5 tw-text-muted">
                    @if (row.username) {
                      <span
                        role="button"
                        tabindex="0"
                        class="tw-grid tw-size-7 tw-place-items-center tw-rounded-md hover:tw-bg-bg-hover hover:tw-text-main"
                        [attr.aria-label]="i18n.t('copyUsername')"
                        [attr.title]="i18n.t('copyUsername')"
                        (click)="copyUsername($event, row.username)"
                        (keydown.enter)="copyUsername($event, row.username)"
                      >
                        <bit-icon name="bwi-user" class="tw-text-base"></bit-icon>
                      </span>
                    }
                    <bit-icon name="bwi-angle-right" class="tw-text-sm"></bit-icon>
                  </span>
                </button>
              }
            </section>
          }
        }
      </div>
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

  protected readonly kinds = ITEM_KIND_ORDER;
  protected readonly loading = signal(true);
  protected readonly query = signal("");
  protected readonly ciphers = signal<CipherListView[]>([]);
  protected readonly folders = signal<FolderView[]>([]);
  protected readonly typeFilter = signal<TypeFilter>("all");
  protected readonly folderFilter = signal<FolderFilter>("all");
  protected readonly favoritesOnly = signal(false);

  protected readonly subtitle = computed(() =>
    this.ciphers().length === 0
      ? this.i18n.t("emptyVaultSubtitle")
      : `${this.ciphers().length} ${this.i18n.t("itemCountShort")} · ${this.i18n.t("encryptedLocally")}`,
  );

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLowerCase();
    const type = this.typeFilter();
    const folder = this.folderFilter();
    const favoritesOnly = this.favoritesOnly();

    return this.ciphers()
      .filter((cipher) => {
        if (type !== "all" && this.kindOf(cipher) !== type) {
          return false;
        }
        if (folder !== "all" && String(cipher.folderId ?? "") !== folder) {
          return false;
        }
        if (favoritesOnly && !cipher.favorite) {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = [
          cipher.name,
          cipher.subtitle ?? "",
          this.folderName(cipher.folderId),
          this.usernameOf(cipher),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => this.revisionTime(b) - this.revisionTime(a) || a.name.localeCompare(b.name));
  });

  /** 仅按文件夹筛选时，标题直接写文件夹名；有搜索词时仍显示「搜索结果」。 */
  private readonly resultsHeading = computed(() => {
    if (this.query().trim()) {
      return this.i18n.t("searchResults");
    }
    const folderId = this.folderFilter();
    if (folderId === "") {
      return this.i18n.t("noFolder");
    }
    return (
      this.folders().find((folder) => folder.id === folderId)?.name ?? this.i18n.t("searchResults")
    );
  });

  protected readonly groups = computed<readonly VaultGroup[]>(() => {
    const rows = this.visible().map((cipher) => this.toRow(cipher));
    if (this.isFiltering()) {
      return [{ key: "results", label: this.resultsHeading(), rows }];
    }

    const favorites = rows.filter((row) => row.favorite);
    const groups: VaultGroup[] = [];
    if (favorites.length) {
      groups.push({
        key: "favorites",
        label: this.i18n.t("favorites"),
        icon: "bwi-star-filled",
        rows: favorites,
      });
    }
    groups.push({ key: "all", label: this.i18n.t("allItems"), rows });
    return groups;
  });

  protected readonly isFiltering = computed(
    () =>
      this.query().trim().length > 0 ||
      this.typeFilter() !== "all" ||
      this.folderFilter() !== "all" ||
      this.favoritesOnly(),
  );

  protected readonly noResultsHint = computed(() =>
    this.query().trim()
      ? this.i18n.t("noResultsFor", this.query().trim())
      : this.i18n.t("emptyFilterHint"),
  );

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
        this.ciphers.set(this.scoped(listViews.filter((view) => view.deletedDate == null)));
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
  }

  protected kindLabel(kind: ItemKind): string {
    return this.i18n.t(ITEM_KIND_UI[kind].labelKey);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onTypeFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.typeFilter.set(value === "all" || isItemKind(value) ? value : "all");
  }

  protected onFolderFilter(event: Event): void {
    this.folderFilter.set((event.target as HTMLSelectElement).value);
  }

  protected clearFilters(): void {
    this.query.set("");
    this.typeFilter.set("all");
    this.folderFilter.set("all");
    this.favoritesOnly.set(false);
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

  protected createItem(): void {
    void this.router.navigate(["/new-item-v2"], {
      queryParams: { next: "/tabs/vault" },
    });
  }

  protected open(id: string): void {
    void this.router.navigate(["/view-cipher-v2"], { queryParams: { cipherId: id } });
  }

  protected async lock(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.lockService.lock(userId, LockSource.Manual);
    await this.router.navigateByUrl("/");
  }

  protected copyUsername(event: Event, username: string): void {
    event.stopPropagation();
    const copied = this.platformUtilsService.copyToClipboard(username, { window });
    if (copied !== false) {
      this.toast.show(this.i18n.t("valueCopied", this.i18n.t("username")));
    }
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

  private toRow(view: CipherListView): VaultRow {
    const kind = this.kindOf(view);
    const sub = [this.subtitleOf(view, kind), this.folderName(view.folderId)]
      .filter(Boolean)
      .join(" · ");
    return {
      id: String(view.id ?? ""),
      kind,
      name: view.name,
      sub,
      favorite: view.favorite,
      // Only logins have a username to copy; for tokens/servers that slot holds a service
      // or host, which should not grow a username copy affordance.
      username: kind === ItemKind.Login ? this.usernameOf(view) : "",
    };
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
}

function joinParts(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => !!part).join(" · ");
}
