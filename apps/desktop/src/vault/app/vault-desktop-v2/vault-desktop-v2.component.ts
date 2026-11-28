import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { firstValueFrom, of, switchMap } from "rxjs";

import {
  CustomFieldDraft,
  DesktopShortcut,
  DesktopShortcutsService,
  ITEM_KIND_ORDER,
  ITEM_KIND_UI,
  LpCustomFieldsComponent,
  LpFieldComponent,
  LpFieldOption,
  LpKindTileComponent,
  LpPasswordSyntaxComponent,
  LpRowComponent,
  LpToastService,
  PASSWORD_AUTO_HIDE_MS,
  PasswordAutoHideService,
  VaultDensity,
  VaultDensityService,
  clearClipboardIfStillHolding,
  clipboardClearSeconds,
  newCustomFieldDraft,
} from "@localpass/angular/local-ui";
import {
  CipherVersionHistoryService,
  CipherVersionRow,
} from "@localpass/angular/vault/services/cipher-version-history.service";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService } from "@localpass/common/vault/abstractions/totp.service";
import { CipherRepromptType } from "@localpass/common/vault/enums/cipher-reprompt-type";
import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import { PasswordHistoryView } from "@localpass/common/vault/models/view/password-history.view";
import { IconModule } from "@localpass/components";
import {
  applyCustomFields,
  applyFieldValues,
  cloneCipherView,
  DEFAULT_PASSWORD_OPTIONS,
  fieldGroups,
  FIELD_SECTIONS,
  FIELDS,
  FieldSpec,
  FieldValues,
  formatCardExpiryInput,
  generatePasswords,
  ItemKind,
  kindOf,
  readCustomFields,
  readFieldValues,
  searchableFieldValues,
  setKind,
  withoutKindField,
} from "@localpass/local-vault";
import { PasswordRepromptService, TotpQrComponent } from "@localpass/vault";

type DrawerMode = "closed" | "edit" | "new-type" | "new-form" | "history" | "qr";
type TypeFilter = "all" | "other" | ItemKind;

interface RowView {
  readonly item: CipherView;
  readonly kind: ItemKind;
  readonly sub: string;
  readonly folder: string;
  readonly favorite: boolean;
  readonly updated: Date | null;
}

interface DetailRowView {
  readonly label: string;
  readonly display: string;
  readonly copy: string;
  readonly mono: boolean;
  readonly multiline: boolean;
  readonly launchUri: string;
  readonly sshLinkId?: string;
  readonly totp: boolean;
  readonly secret: boolean;
}

interface DetailGroupView {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly DetailRowView[];
}

interface TypeTab {
  readonly id: TypeFilter;
  readonly label: string;
  readonly count: number;
}

const MASK = "••••••••••••";

/** QR 抽屉里 Base32 种子的显示状态键；种子能直接生成验证码，默认掩码并自动收回。 */
const QR_SECRET_LABEL = "qr-secret";

/**
 * 桌面端保险库：页头 + 搜索筛选 + 文件夹卡片 + 条目表格 + 右侧详情抽屉。
 *
 * 展示与编辑都从 `FIELDS` 生成，8 类条目共用一套字段映射；复制只写进剪贴板，
 * 不触碰网络，也不把明文写进日志。
 */
@Component({
  selector: "vault-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IconModule,
    LpCustomFieldsComponent,
    LpFieldComponent,
    LpKindTileComponent,
    LpPasswordSyntaxComponent,
    LpRowComponent,
    TotpQrComponent,
  ],
  host: {
    class: "tw-block tw-h-full",
    "(document:keydown)": "onKeyDown($event)",
  },
  template: `
    <div class="agy agy-mac tw-relative tw-h-full">
      @if (showWelcome()) {
        <div class="agy-mac-welcome">
          <span class="agy-welcome-ico">
            <bit-icon name="bwi-vault" class="tw-text-xl"></bit-icon>
          </span>
          <h1 class="agy-welcome-h">{{ i18n.t("noItemsInVault") }}</h1>
          <p class="agy-welcome-s">{{ i18n.t("emptyVaultHintDesktop") }}</p>
          <div class="agy-welcome-actions">
            <button type="button" class="agy-btn agy-primary agy-lg" (click)="openNew()">
              <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
              {{ i18n.t("newItem") }}
            </button>
            <button type="button" class="agy-btn agy-lg" (click)="go('/import')">
              <bit-icon name="bwi-import" class="tw-text-xs"></bit-icon>
              {{ i18n.t("importData") }}
            </button>
            <button type="button" class="agy-btn agy-lg" (click)="go('/restore')">
              <bit-icon name="bwi-download" class="tw-text-xs"></bit-icon>
              {{ i18n.t("restoreFromBackup") }}
            </button>
          </div>
          <p class="agy-welcome-keys">
            ⌘N {{ i18n.t("newItem") }} · ⌘K {{ i18n.t("searchVault") }}
          </p>
        </div>
      } @else {
        <section class="agy-mac-list" [attr.aria-label]="i18n.t('vault')">
          <div class="agy-mac-listhead">
            <div class="tw-flex tw-items-center tw-gap-1.5 tw-px-1">
              <span class="tw-text-xs tw-font-semibold tw-text-main">{{ i18n.t("vault") }}</span>
              <span class="agy-chip">{{ rows().length }}</span>
              <span class="tw-flex-1"></span>
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.title]="i18n.t('importNoun')"
                [attr.aria-label]="i18n.t('importNoun')"
                (click)="go('/import')"
              >
                <bit-icon name="bwi-import" class="tw-text-xs"></bit-icon>
              </button>
              <button
                id="vault_button_new"
                type="button"
                class="agy-btn agy-primary agy-sm"
                (click)="openNew()"
              >
                <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
                {{ i18n.t("newItem") }}
              </button>
            </div>

            <label class="agy-ext-search">
              <bit-icon name="bwi-search" class="tw-text-xs"></bit-icon>
              <input
                type="search"
                [attr.placeholder]="i18n.t('searchAllFieldsPlaceholder')"
                [attr.aria-label]="i18n.t('searchVault')"
                [value]="query()"
                autocomplete="off"
                (input)="onSearch($event)"
              />
              <kbd class="agy-kbd" [class.tw-hidden]="!shortcutEnabled('search')"
                ><kbd>&#8984;K</kbd></kbd
              >
            </label>

            <div class="agy-mac-filters" role="tablist" [attr.aria-label]="i18n.t('type')">
              @for (tab of typeTabs(); track tab.id) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="typeFilter() === tab.id"
                  [class.agy-on]="typeFilter() === tab.id"
                  (click)="setTypeFilter(tab.id)"
                >
                  <span>{{ tab.label }}</span>
                  <span class="agy-n">{{ tab.count }}</span>
                </button>
              }
              <span class="agy-spacer"></span>
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [class.agy-on]="favoritesOnly()"
                [attr.aria-pressed]="favoritesOnly()"
                [attr.title]="i18n.t('favorites')"
                [attr.aria-label]="i18n.t('favorites')"
                (click)="favoritesOnly.set(!favoritesOnly())"
              >
                <bit-icon name="bwi-star-filled" class="tw-text-xs"></bit-icon>
              </button>
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-pressed]="sortAscending()"
                [attr.title]="i18n.t('sort')"
                [attr.aria-label]="i18n.t('sort')"
                (click)="toggleSort()"
              >
                <bit-icon name="bwi-numbered-list" class="tw-text-xs"></bit-icon>
              </button>
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [class.agy-on]="compactRows()"
                [attr.aria-pressed]="compactRows()"
                [attr.title]="i18n.t('compactRows')"
                [attr.aria-label]="i18n.t('compactRows')"
                (click)="toggleCompactRows()"
              >
                <bit-icon name="bwi-list" class="tw-text-xs"></bit-icon>
              </button>
            </div>

            @if (folders().length) {
              <div class="agy-mac-minirow">
                <bit-icon name="bwi-folder" class="tw-text-xs tw-text-muted"></bit-icon>
                <select
                  class="agy-input"
                  [attr.aria-label]="i18n.t('folders')"
                  [value]="folderFilter()"
                  (change)="onFolderFilter($event)"
                >
                  <option value="all">{{ i18n.t("folders") }}</option>
                  <option value="none">{{ i18n.t("noFolder") }}</option>
                  @for (folder of folders(); track folder.id) {
                    <option [value]="folder.id">{{ folder.name }}</option>
                  }
                </select>
                @if (isFiltering()) {
                  <button
                    type="button"
                    class="agy-iconbtn agy-sm"
                    [attr.title]="i18n.t('clearFilters')"
                    [attr.aria-label]="i18n.t('clearFilters')"
                    (click)="clearFilters()"
                  >
                    <bit-icon name="bwi-close" class="tw-text-xs"></bit-icon>
                  </button>
                }
              </div>
            }
          </div>

          <div class="agy-mac-rows" role="listbox" [attr.aria-label]="i18n.t('vault')">
            @if (loading()) {
              <div class="agy-mac-empty">
                <div class="agy-es">{{ i18n.t("loading") }}</div>
              </div>
            } @else if (!items().length) {
              <div class="agy-mac-empty">
                <div>
                  <span class="agy-emptyico">
                    <bit-icon name="bwi-vault" class="tw-text-base"></bit-icon>
                  </span>
                  <div class="agy-eh">{{ i18n.t("noItemsInVault") }}</div>
                  <div class="agy-es">{{ i18n.t("emptyVaultHintDesktop") }}</div>
                  <div class="tw-mt-3 tw-flex tw-justify-center tw-gap-1.5">
                    <button type="button" class="agy-btn agy-primary" (click)="openNew()">
                      {{ i18n.t("newItem") }}
                    </button>
                    <button type="button" class="agy-btn" (click)="go('/import')">
                      {{ i18n.t("importData") }}
                    </button>
                  </div>
                </div>
              </div>
            } @else if (!rows().length) {
              <div class="agy-mac-empty">
                <div>
                  <span class="agy-emptyico">
                    <bit-icon name="bwi-search" class="tw-text-base"></bit-icon>
                  </span>
                  <div class="agy-eh">{{ i18n.t("noSearchResults") }}</div>
                  <div class="agy-es">{{ i18n.t("searchVaultPlaceholderAll") }}</div>
                  <button type="button" class="agy-btn tw-mt-3" (click)="clearFilters()">
                    {{ i18n.t("clearFilters") }}
                  </button>
                </div>
              </div>
            } @else {
              @if (!isFiltering() && favoriteRows().length) {
                <div class="agy-grouphead">
                  {{ i18n.t("favorites") }} <span class="agy-n">{{ favoriteRows().length }}</span>
                </div>
                @for (row of favoriteRows(); track row.item) {
                  <button
                    type="button"
                    role="option"
                    data-testid="vault_row"
                    [attr.data-cipher-id]="row.item.id"
                    class="agy-mac-row"
                    [class.agy-on]="isSelected(row.item)"
                    [class.agy-ultra]="compactRows()"
                    [attr.aria-selected]="isSelected(row.item)"
                    (click)="openView(row.item)"
                  >
                    <lp-kind-tile [kind]="row.kind" size="sm"></lp-kind-tile>
                    <span class="agy-txt">
                      <span class="agy-t">
                        <span class="tw-truncate">{{ row.item.name }}</span>
                        <bit-icon
                          name="bwi-star-filled"
                          class="tw-text-xs tw-text-fg-warning"
                        ></bit-icon>
                      </span>
                      <span class="agy-s">{{ row.sub }}</span>
                    </span>
                    <span class="agy-m">
                      <span class="agy-idle-meta">
                        <span class="agy-chip">{{ kindLabel(row.kind) }}</span>
                      </span>
                      <span class="agy-hoveracts">
                        @if (row.item.login.username) {
                          <span
                            role="button"
                            tabindex="-1"
                            class="agy-iconbtn agy-sm"
                            [attr.title]="i18n.t('copyUsername')"
                            [attr.aria-label]="i18n.t('copyUsername')"
                            (click)="copyUsername(row.item, $event)"
                          >
                            <bit-icon name="bwi-user" class="tw-text-xs"></bit-icon>
                          </span>
                        }
                        @if (row.item.login.password) {
                          <span
                            role="button"
                            tabindex="-1"
                            class="agy-iconbtn agy-sm"
                            [attr.title]="i18n.t('copyPassword')"
                            [attr.aria-label]="i18n.t('copyPassword')"
                            (click)="copyPassword(row.item, $event)"
                          >
                            <bit-icon name="bwi-key" class="tw-text-xs"></bit-icon>
                          </span>
                        }
                      </span>
                    </span>
                  </button>
                }
              }

              <div class="agy-grouphead">
                @if (isFiltering()) {
                  {{ i18n.t("filterResults", rows().length) }}
                } @else {
                  {{ i18n.t("allItems") }} <span class="agy-n">{{ otherRows().length }}</span>
                }
              </div>
              @for (row of isFiltering() ? rows() : otherRows(); track row.item) {
                <button
                  type="button"
                  role="option"
                  data-testid="vault_row"
                  [attr.data-cipher-id]="row.item.id"
                  class="agy-mac-row"
                  [class.agy-on]="isSelected(row.item)"
                  [class.agy-ultra]="compactRows()"
                  [attr.aria-selected]="isSelected(row.item)"
                  (click)="openView(row.item)"
                >
                  <lp-kind-tile [kind]="row.kind" size="sm"></lp-kind-tile>
                  <span class="agy-txt">
                    <span class="agy-t">
                      <span class="tw-truncate">{{ row.item.name }}</span>
                      @if (row.favorite) {
                        <bit-icon
                          name="bwi-star-filled"
                          class="tw-text-xs tw-text-fg-warning"
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
                      @if (row.item.login.username) {
                        <span
                          role="button"
                          tabindex="-1"
                          class="agy-iconbtn agy-sm"
                          [attr.title]="i18n.t('copyUsername')"
                          [attr.aria-label]="i18n.t('copyUsername')"
                          (click)="copyUsername(row.item, $event)"
                        >
                          <bit-icon name="bwi-user" class="tw-text-xs"></bit-icon>
                        </span>
                      }
                      @if (row.item.login.password) {
                        <span
                          role="button"
                          tabindex="-1"
                          class="agy-iconbtn agy-sm"
                          [attr.title]="i18n.t('copyPassword')"
                          [attr.aria-label]="i18n.t('copyPassword')"
                          (click)="copyPassword(row.item, $event)"
                        >
                          <bit-icon name="bwi-key" class="tw-text-xs"></bit-icon>
                        </span>
                      }
                    </span>
                  </span>
                </button>
              }
            }
          </div>
        </section>

        <aside class="agy-mac-detail">
          @if (selected(); as item) {
            <header class="agy-mac-dhead">
              <span class="agy-crumb">
                <span>{{ folderName(item) }}</span>
                <bit-icon name="bwi-angle-right" class="tw-text-xs"></bit-icon>
                <b>{{ item.name }}</b>
              </span>
              <span class="tw-flex-1"></span>
              <button
                type="button"
                class="agy-iconbtn"
                [class.agy-on]="item.favorite"
                [attr.title]="i18n.t('favorite')"
                [attr.aria-label]="i18n.t('favorite')"
                [attr.aria-pressed]="item.favorite"
                (click)="toggleFavorite()"
              >
                <bit-icon name="bwi-star-filled" class="tw-text-xs"></bit-icon>
              </button>
              @if (totpKey()) {
                <button
                  type="button"
                  class="agy-iconbtn"
                  [attr.title]="i18n.t('totpQrTitle')"
                  [attr.aria-label]="i18n.t('totpQrTitle')"
                  (click)="openQr()"
                >
                  <bit-icon name="bwi-grid" class="tw-text-xs"></bit-icon>
                </button>
              }
              <button
                type="button"
                class="agy-iconbtn"
                data-testid="vault_button_history"
                [attr.title]="i18n.t('itemVersionHistory')"
                [attr.aria-label]="i18n.t('itemVersionHistory')"
                (click)="openHistory()"
              >
                <bit-icon name="bwi-clock" class="tw-text-xs"></bit-icon>
              </button>
              <button type="button" class="agy-btn agy-primary agy-sm" (click)="startEdit()">
                <bit-icon name="bwi-pencil-square" class="tw-text-xs"></bit-icon>
                {{ i18n.t("edit") }}
              </button>
              <button
                type="button"
                class="agy-iconbtn"
                [attr.title]="i18n.t('archiveVerb')"
                [attr.aria-label]="i18n.t('archiveVerb')"
                (click)="archiveSelected()"
              >
                <bit-icon name="bwi-archive" class="tw-text-xs"></bit-icon>
              </button>
              <button
                type="button"
                class="agy-iconbtn"
                data-testid="vault_drawer_delete"
                [attr.title]="i18n.t('delete')"
                [attr.aria-label]="i18n.t('delete')"
                (click)="remove()"
              >
                <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
              </button>
              <button
                type="button"
                class="agy-iconbtn"
                [attr.title]="i18n.t('close')"
                [attr.aria-label]="i18n.t('close')"
                (click)="clearSelection()"
              >
                <bit-icon name="bwi-close" class="tw-text-xs"></bit-icon>
              </button>
            </header>

            <div class="agy-mac-dbody">
              <div class="agy-mac-dmain">
                <div class="agy-mac-hero">
                  <lp-kind-tile [kind]="selectedKind()" size="lg"></lp-kind-tile>
                  <div class="tw-min-w-0 tw-flex-1">
                    <h2 class="agy-h1">{{ item.name }}</h2>
                    <div class="agy-h2">
                      <span class="agy-chip agy-brand">{{ kindLabel(selectedKind()) }}</span>
                      @if (item.favorite) {
                        <span class="agy-chip agy-warn">
                          <bit-icon name="bwi-star-filled" class="tw-text-xs"></bit-icon>
                          {{ i18n.t("favorite") }}
                        </span>
                      }
                      <span>
                        {{ i18n.t("lastModified") }}
                        {{ item.revisionDate ? shortDate(item.revisionDate) : "—" }}
                      </span>
                    </div>
                  </div>
                </div>

                @if (totpRow(); as otp) {
                  <div
                    class="agy-otpcard"
                    [class.agy-copied]="copiedKey() === 'otp'"
                    role="button"
                    tabindex="0"
                    (click)="copyValue(otp.copy, otp.label, 'otp', true)"
                    (keydown.enter)="copyValue(otp.copy, otp.label, 'otp', true)"
                  >
                    <span class="agy-ring" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <circle class="agy-bg" cx="12" cy="12" r="9.5"></circle>
                        <circle
                          class="agy-fg"
                          cx="12"
                          cy="12"
                          r="9.5"
                          [attr.stroke-dasharray]="totpRingCircumference"
                          [attr.stroke-dashoffset]="totpRingOffset()"
                        ></circle>
                      </svg>
                      <span class="agy-rn">{{ totpRemaining() }}</span>
                    </span>
                    <span class="agy-code">{{ otp.display }}</span>
                    <span class="agy-lbl">{{ otp.label }}</span>
                    <span class="agy-grow"></span>
                    <button
                      type="button"
                      class="agy-iconbtn agy-sm"
                      [attr.title]="i18n.t('totpQrTitle')"
                      [attr.aria-label]="i18n.t('totpQrTitle')"
                      (click)="$event.stopPropagation(); openQr()"
                    >
                      <bit-icon name="bwi-grid" class="tw-text-xs"></bit-icon>
                    </button>
                    <button
                      type="button"
                      class="agy-iconbtn agy-sm"
                      [attr.title]="i18n.t('copy')"
                      [attr.aria-label]="i18n.t('totpCodeLabel')"
                      (click)="
                        $event.stopPropagation(); copyValue(otp.copy, otp.label, 'otp', true)
                      "
                    >
                      <bit-icon
                        [name]="copiedKey() === 'otp' ? 'bwi-check' : 'bwi-copy'"
                        class="tw-text-xs"
                      ></bit-icon>
                    </button>
                  </div>
                }

                @for (group of detailGroups(); track group.key) {
                  <div class="agy-fgroup">
                    <div class="agy-flabel">
                      <span>{{ group.label }}</span>
                    </div>
                    <div class="agy-fbox">
                      @for (row of group.rows; track row.label) {
                        @if (!row.totp) {
                          <div
                            class="agy-field"
                            [class.agy-copied]="copiedKey() === row.label"
                            [attr.data-act]="row.copy ? 'copy' : null"
                            (click)="copyValue(row.copy, row.label, row.label, row.secret)"
                          >
                            <span class="agy-k" [attr.title]="row.label">{{ row.label }}</span>
                            @if (row.secret) {
                              <span class="agy-v agy-mono" [class.agy-multiline]="row.multiline">
                                @if (revealedLabels().has(row.label)) {
                                  @if (row.multiline) {
                                    {{ row.copy }}
                                  } @else {
                                    <lp-password-syntax [value]="row.copy" />
                                  }
                                } @else {
                                  {{ row.display }}
                                }
                              </span>
                            } @else {
                              <span
                                class="agy-v"
                                [class.agy-mono]="row.mono"
                                [class.agy-multiline]="row.multiline"
                                [attr.title]="row.multiline ? null : row.display"
                              >
                                {{ row.display }}
                              </span>
                            }
                            <span class="agy-a agy-always">
                              @if (row.sshLinkId) {
                                <button
                                  type="button"
                                  class="agy-btn agy-sm"
                                  (click)="$event.stopPropagation(); openLinkedSsh(row.sshLinkId)"
                                >
                                  {{ i18n.t("openSshKey") }}
                                </button>
                              }
                              @if (row.launchUri) {
                                <button
                                  type="button"
                                  class="agy-iconbtn agy-sm"
                                  [attr.title]="i18n.t('openWebsite')"
                                  [attr.aria-label]="i18n.t('openWebsite')"
                                  (click)="$event.stopPropagation(); launch(row.launchUri)"
                                >
                                  <bit-icon name="bwi-external-link" class="tw-text-xs"></bit-icon>
                                </button>
                              }
                              @if (row.secret && revealedLabels().has(row.label) && autoHide()) {
                                <span class="agy-chip">{{ i18n.t("autoHide30sChip") }}</span>
                              }
                              @if (row.secret) {
                                <button
                                  type="button"
                                  class="agy-iconbtn agy-sm"
                                  [attr.title]="
                                    revealedLabels().has(row.label)
                                      ? i18n.t('hideValue')
                                      : i18n.t('showValue')
                                  "
                                  [attr.aria-label]="i18n.t('toggleVisibility')"
                                  (click)="$event.stopPropagation(); toggleReveal(row.label)"
                                >
                                  <bit-icon
                                    [name]="
                                      revealedLabels().has(row.label) ? 'bwi-eye-slash' : 'bwi-eye'
                                    "
                                    class="tw-text-xs"
                                  ></bit-icon>
                                </button>
                              }
                              @if (row.copy) {
                                <button
                                  type="button"
                                  class="agy-iconbtn agy-sm"
                                  [attr.title]="row.label"
                                  [attr.aria-label]="row.label"
                                  (click)="
                                    $event.stopPropagation();
                                    copyValue(row.copy, row.label, row.label, row.secret)
                                  "
                                >
                                  <bit-icon
                                    [name]="copiedKey() === row.label ? 'bwi-check' : 'bwi-copy'"
                                    class="tw-text-xs"
                                  ></bit-icon>
                                </button>
                              }
                            </span>
                          </div>
                        }
                      }
                    </div>
                  </div>
                }

                @if (passkeys().length) {
                  <div class="agy-fgroup">
                    <div class="agy-flabel">
                      <span>{{ i18n.t("passkeys") }}</span>
                    </div>
                    <div class="agy-fbox">
                      @for (passkey of passkeys(); track $index) {
                        <div class="agy-field">
                          <span class="agy-k">{{ i18n.t("typePasskey") }}</span>
                          <span class="agy-v">
                            {{ formatPasskeyLabel(passkey) }}
                          </span>
                          <span class="agy-a agy-always">
                            <span class="agy-chip">
                              {{ passkey.creationDate | date: "short" }}
                            </span>
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (customFields().length) {
                  <div class="agy-fgroup">
                    <div class="agy-flabel">
                      <span>{{ i18n.t("customFields") }}</span>
                    </div>
                    <div class="agy-fbox">
                      @for (field of customFields(); track $index) {
                        <div
                          class="agy-field"
                          data-act="copy"
                          (click)="
                            copyValue(
                              field.value,
                              field.name ?? '',
                              undefined,
                              field.type === fieldType.Hidden
                            )
                          "
                        >
                          <span class="agy-k" [attr.title]="field.name">{{ field.name }}</span>
                          <span
                            class="agy-v"
                            [class.agy-mono]="field.type === fieldType.Hidden"
                            [attr.title]="
                              field.type === fieldType.Hidden ? i18n.t('typeHidden') : field.value
                            "
                          >
                            {{
                              field.type === fieldType.Hidden && !isCustomFieldRevealed(field.name)
                                ? "••••••••••••"
                                : field.value
                            }}
                          </span>
                          <span class="agy-a agy-always">
                            @if (field.type === fieldType.Hidden) {
                              <button
                                type="button"
                                class="agy-iconbtn agy-sm"
                                [attr.title]="
                                  isCustomFieldRevealed(field.name)
                                    ? i18n.t('hideValue')
                                    : i18n.t('showValue')
                                "
                                [attr.aria-label]="i18n.t('toggleVisibility')"
                                (click)="
                                  $event.stopPropagation(); toggleCustomFieldReveal(field.name)
                                "
                              >
                                <bit-icon
                                  [name]="
                                    isCustomFieldRevealed(field.name) ? 'bwi-eye-slash' : 'bwi-eye'
                                  "
                                  class="tw-text-xs"
                                ></bit-icon>
                              </button>
                            }
                            <button
                              type="button"
                              class="agy-iconbtn agy-sm"
                              [attr.title]="field.name"
                              [attr.aria-label]="field.name"
                              (click)="
                                $event.stopPropagation();
                                copyValue(
                                  field.value,
                                  field.name,
                                  undefined,
                                  field.type === fieldType.Hidden
                                )
                              "
                            >
                              <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                            </button>
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (optionsRows().length) {
                  <div class="agy-fgroup">
                    <div class="agy-flabel">
                      <span>{{ i18n.t("additionalOptions") }}</span>
                    </div>
                    <div class="agy-fbox">
                      @for (row of optionsRows(); track row.label) {
                        <div class="agy-field">
                          <span class="agy-k">{{ row.label }}</span>
                          <span class="agy-v" [class.agy-mono]="row.mono">{{ row.display }}</span>
                          <span class="agy-a"></span>
                        </div>
                      }
                      @if (selectedKind() === ItemKind.Login) {
                        <div class="agy-field">
                          <span class="agy-k">{{ i18n.t("passwordReprompt") }}</span>
                          <span class="agy-v">
                            {{
                              item.reprompt === repromptType.Password
                                ? i18n.t("repromptOn")
                                : i18n.t("repromptOff")
                            }}
                          </span>
                          <span class="agy-a"></span>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (errorMessage()) {
                  <p class="agy-hint agy-hint-error tw-px-0">{{ errorMessage() }}</p>
                }
              </div>

              <div class="agy-mac-inspector">
                <h3 class="agy-insp-h">{{ i18n.t("itemInfo") }}</h3>
                <div class="agy-meta-row">
                  <span class="agy-k">{{ i18n.t("type") }}</span>
                  <span class="agy-v">{{ kindLabel(selectedKind()) }}</span>
                </div>
                <div class="agy-meta-row">
                  <span class="agy-k">{{ i18n.t("folder") }}</span>
                  <span class="agy-v">{{ folderName(item) }}</span>
                </div>
                <div class="agy-meta-row">
                  <span class="agy-k">{{ i18n.t("dateCreated") }}</span>
                  <span class="agy-v">{{ shortDate(item.creationDate) }}</span>
                </div>
                <div class="agy-meta-row">
                  <span class="agy-k">{{ i18n.t("lastModified") }}</span>
                  <span class="agy-v">{{ shortDate(item.revisionDate) }}</span>
                </div>

                <div class="agy-divider"></div>

                <button
                  type="button"
                  class="agy-setrow agy-no-divider tw-px-0"
                  (click)="toggleFavorite()"
                >
                  <bit-icon
                    name="bwi-star-filled"
                    class="tw-text-xs"
                    [class.tw-text-fg-warning]="item.favorite"
                  ></bit-icon>
                  <span class="agy-k">{{ i18n.t("favorite") }}</span>
                  <span class="agy-right">
                    <span
                      class="tw-flex tw-h-4 tw-w-7 tw-flex-none tw-items-center tw-rounded-full tw-transition-colors"
                      [class.tw-bg-fg-brand]="item.favorite"
                      [class.tw-bg-border-strong]="!item.favorite"
                    >
                      <span
                        class="tw-size-3 tw-rounded-full tw-bg-background tw-transition-transform"
                        [class.tw-translate-x-3]="item.favorite"
                      ></span>
                    </span>
                  </span>
                </button>

                <div class="agy-divider"></div>
                @if (selectedStrength(); as strength) {
                  <h3 class="agy-insp-h">{{ i18n.t("passwordStrength") }}</h3>
                  <div class="agy-meta-row">
                    <span class="agy-k">{{ strength.label }}</span>
                    <span
                      class="agy-chip"
                      [class.agy-ok]="strength.tone === 'ok'"
                      [class.agy-warn]="strength.tone === 'warn'"
                      [class.agy-bad]="strength.tone === 'bad'"
                      >{{ strength.score }}/4</span
                    >
                  </div>
                  <div class="agy-divider"></div>
                }
                <h3 class="agy-insp-h">{{ i18n.t("itemVersionHistory") }}</h3>
                <button
                  type="button"
                  class="agy-btn agy-sm agy-block tw-mt-1"
                  (click)="openHistory()"
                >
                  <bit-icon name="bwi-clock" class="tw-text-xs"></bit-icon>
                  {{ i18n.t("itemVersionHistory") }}
                </button>

                <div class="agy-divider"></div>
                <h3 class="agy-insp-h">{{ i18n.t("privacySummary") }}</h3>
                <div class="agy-meta-row">
                  <span class="agy-k">{{ i18n.t("localEncrypted") }}</span>
                </div>
              </div>
            </div>

            <footer class="agy-mac-dfoot">
              @if (toast.clipboardRemaining(); as sec) {
                <span class="tw-inline-flex tw-items-center tw-gap-1.5">
                  <span>{{ i18n.t("clipboardClearCountdown", sec.toString()) }}</span>
                  <button
                    type="button"
                    class="tw-cursor-pointer tw-border-0 tw-bg-transparent tw-p-0 tw-text-xs tw-font-semibold tw-text-fg-brand tw-underline"
                    (click)="toast.clearClipboardNow()"
                  >
                    {{ i18n.t("clearNow") }}
                  </button>
                </span>
              } @else {
                <span>{{ i18n.t("vaultSummary", rows().length) }}</span>
              }
              <span class="agy-right">
                @if (shortcutEnabled("search")) {
                  <span class="agy-kbd"><kbd>&#8984;K</kbd>{{ i18n.t("searchVault") }}</span>
                }
                @if (shortcutEnabled("edit")) {
                  <span class="agy-kbd"><kbd>&#8984;E</kbd>{{ i18n.t("edit") }}</span>
                }
                @if (shortcutEnabled("copy")) {
                  <span class="agy-kbd"><kbd>&#8984;C</kbd>{{ i18n.t("username") }}</span>
                  <span class="agy-kbd"><kbd>&#8679;&#8984;C</kbd>{{ i18n.t("password") }}</span>
                }
              </span>
            </footer>
          } @else {
            <div class="agy-mac-empty">
              <div>
                <span class="agy-emptyico">
                  <bit-icon name="bwi-vault" class="tw-text-base"></bit-icon>
                </span>
                <div class="agy-eh">
                  {{ items().length ? i18n.t("itemDetails") : i18n.t("noItemsInVault") }}
                </div>
                <div class="agy-es">
                  {{
                    items().length ? i18n.t("selectAnItemHint") : i18n.t("emptyVaultHintDesktop")
                  }}
                </div>
              </div>
            </div>
          }
        </aside>
      }

      @if (drawer() !== "closed") {
        <div class="agy-sheetwrap" (click)="closeDrawer()">
          <aside
            class="agy-drawer"
            [class.agy-drawer-history]="drawer() === 'history'"
            (click)="$event.stopPropagation()"
            [attr.aria-label]="drawerTitle()"
          >
            <div class="agy-drawer-h">
              <div class="tw-min-w-0 tw-flex-1">
                <div class="agy-name">{{ drawerTitle() }}</div>
                @if (drawerSub()) {
                  <div class="agy-sub">{{ drawerSub() }}</div>
                }
              </div>
              <div class="agy-right">
                <button
                  type="button"
                  class="agy-iconbtn"
                  [attr.title]="i18n.t('close')"
                  [attr.aria-label]="i18n.t('close')"
                  (click)="closeDrawer()"
                >
                  <bit-icon name="bwi-close" class="tw-text-xs"></bit-icon>
                </button>
              </div>
            </div>

            <div class="agy-ext-scroll">
              @switch (drawer()) {
                @case ("edit") {
                  @for (group of editGroups(); track group.key) {
                    <div class="agy-seclbl">{{ i18n.t(group.labelKey) }}</div>
                    <div class="agy-grp">
                      @for (field of group.fields; track field.id) {
                        <lp-field
                          layout="row"
                          [id]="'vault-field_' + field.id"
                          [label]="i18n.t(field.labelKey)"
                          [value]="values()[field.id] ?? ''"
                          [password]="!!field.password"
                          [multiline]="!!field.multiline"
                          [mono]="isMonoField(field)"
                          [hint]="field.hintKey ? i18n.t(field.hintKey) : ''"
                          [placeholder]="fieldPlaceholder(field)"
                          [actionIcon]="field.generate ? 'bwi-generate' : undefined"
                          [actionLabel]="field.generate ? i18n.t('generatePassword') : ''"
                          [options]="optionsFor(field)"
                          [allowCustom]="!!field.allowCustom"
                          [maxlength]="field.maxLength ?? null"
                          [inputMode]="field.inputMode ?? ''"
                          [format]="field.id === 'expiry' ? formatExpiry : null"
                          [removable]="field.id !== 'name'"
                          [removeLabel]="i18n.t('remove')"
                          (actionTriggered)="generateInto(field)"
                          (removeTriggered)="hideEditField(field.id)"
                          (valueChange)="setValue(field.id, $event)"
                        ></lp-field>
                      }
                      @if (group.key === "item") {
                        <lp-field
                          layout="row"
                          [label]="i18n.t('folder')"
                          [value]="editFolderId()"
                          [options]="folderOptions()"
                          (valueChange)="editFolderId.set($event)"
                        ></lp-field>
                        <lp-row
                          [label]="i18n.t('favorite')"
                          [sub]="i18n.t('favoriteHint')"
                          [toggle]="editFavorite()"
                          [clickable]="true"
                          (activated)="editFavorite.set(!editFavorite())"
                        ></lp-row>
                        @if (activeEditKind() === ItemKind.Login) {
                          <lp-row
                            [label]="i18n.t('passwordReprompt')"
                            [toggle]="editReprompt()"
                            [clickable]="true"
                            (activated)="editReprompt.set(!editReprompt())"
                          ></lp-row>
                        }
                      }
                    </div>
                  }
                  @if (editHiddenFieldPills().length > 0) {
                    <div class="tw-flex tw-flex-wrap tw-gap-1.5 tw-px-4 tw-pb-2">
                      @for (field of editHiddenFieldPills(); track field.id) {
                        <button
                          type="button"
                          class="agy-btn agy-sm"
                          (click)="showEditField(field.id)"
                        >
                          <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
                          {{ i18n.t(field.labelKey) }}
                        </button>
                      }
                    </div>
                  }
                  <lp-custom-fields [(fields)]="editCustomFields"></lp-custom-fields>
                  @if (errorMessage()) {
                    <p class="agy-hint agy-hint-error tw-px-0">{{ errorMessage() }}</p>
                  }
                }
                @case ("new-form") {
                  @for (group of editGroups(); track group.key) {
                    <div class="agy-seclbl">{{ i18n.t(group.labelKey) }}</div>
                    <div class="agy-grp">
                      @for (field of group.fields; track field.id) {
                        <lp-field
                          layout="row"
                          [id]="'vault-field_' + field.id"
                          [label]="i18n.t(field.labelKey)"
                          [value]="values()[field.id] ?? ''"
                          [password]="!!field.password"
                          [multiline]="!!field.multiline"
                          [mono]="isMonoField(field)"
                          [hint]="field.hintKey ? i18n.t(field.hintKey) : ''"
                          [placeholder]="fieldPlaceholder(field)"
                          [actionIcon]="field.generate ? 'bwi-generate' : undefined"
                          [actionLabel]="field.generate ? i18n.t('generatePassword') : ''"
                          [options]="optionsFor(field)"
                          [allowCustom]="!!field.allowCustom"
                          [maxlength]="field.maxLength ?? null"
                          [inputMode]="field.inputMode ?? ''"
                          [format]="field.id === 'expiry' ? formatExpiry : null"
                          [removable]="field.id !== 'name'"
                          [removeLabel]="i18n.t('remove')"
                          (actionTriggered)="generateInto(field)"
                          (removeTriggered)="hideEditField(field.id)"
                          (valueChange)="setValue(field.id, $event)"
                        ></lp-field>
                      }
                      @if (group.key === "item") {
                        <lp-field
                          layout="row"
                          [label]="i18n.t('folder')"
                          [value]="editFolderId()"
                          [options]="folderOptions()"
                          (valueChange)="editFolderId.set($event)"
                        ></lp-field>
                        <lp-row
                          [label]="i18n.t('favorite')"
                          [sub]="i18n.t('favoriteHint')"
                          [toggle]="editFavorite()"
                          [clickable]="true"
                          (activated)="editFavorite.set(!editFavorite())"
                        ></lp-row>
                        @if (activeEditKind() === ItemKind.Login) {
                          <lp-row
                            [label]="i18n.t('passwordReprompt')"
                            [toggle]="editReprompt()"
                            [clickable]="true"
                            (activated)="editReprompt.set(!editReprompt())"
                          ></lp-row>
                        }
                      }
                    </div>
                  }
                  @if (editHiddenFieldPills().length > 0) {
                    <div class="tw-flex tw-flex-wrap tw-gap-1.5 tw-px-4 tw-pb-2">
                      @for (field of editHiddenFieldPills(); track field.id) {
                        <button
                          type="button"
                          class="agy-btn agy-sm"
                          (click)="showEditField(field.id)"
                        >
                          <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
                          {{ i18n.t(field.labelKey) }}
                        </button>
                      }
                    </div>
                  }
                  <lp-custom-fields [(fields)]="editCustomFields"></lp-custom-fields>
                  @if (errorMessage()) {
                    <p class="agy-hint agy-hint-error tw-px-0">{{ errorMessage() }}</p>
                  }
                }
                @case ("new-type") {
                  <div class="agy-typegrid">
                    @for (kind of kinds; track kind) {
                      <button type="button" (click)="startNewForm(kind)">
                        <lp-kind-tile [kind]="kind" size="xs"></lp-kind-tile>
                        <span>{{ kindLabel(kind) }}</span>
                      </button>
                    }
                  </div>
                  <div class="agy-callout tw-mt-2">
                    <bit-icon name="bwi-info-circle" class="tw-text-xs"></bit-icon>
                    <span>{{ i18n.t("newItemKindNotice") }}</span>
                  </div>
                }
                @case ("history") {
                  @if (selected(); as item) {
                    <div class="agy-ver agy-ver-current">
                      <div class="agy-ver-top">
                        <bit-icon name="bwi-check-circle" class="tw-text-xs"></bit-icon>
                        <span>{{ i18n.t("itemHistoryCurrent") }}</span>
                        @if (versionRows().length) {
                          <span class="agy-chip">v{{ versionRows().length + 1 }}</span>
                        }
                        <span class="agy-ver-when">
                          {{
                            longDate(
                              selectedKind() === ItemKind.Login
                                ? (item.login.passwordRevisionDate ?? item.revisionDate)
                                : item.revisionDate
                            )
                          }}
                        </span>
                      </div>
                      <div class="agy-ver-value">
                        @if (primarySecretOf(item); as currentSecret) {
                          <span class="agy-mono tw-truncate">
                            {{ historyRevealed().has(-1) ? currentSecret.value : mask }}
                          </span>
                          <button
                            type="button"
                            class="agy-iconbtn agy-sm"
                            [attr.title]="
                              i18n.t(historyRevealed().has(-1) ? 'hideValue' : 'showValue')
                            "
                            [attr.aria-label]="
                              i18n.t(historyRevealed().has(-1) ? 'hideValue' : 'showValue')
                            "
                            (click)="toggleHistoryReveal(-1)"
                          >
                            <bit-icon
                              [name]="historyRevealed().has(-1) ? 'bwi-eye-slash' : 'bwi-eye'"
                              class="tw-text-xs"
                            ></bit-icon>
                          </button>
                          <button
                            type="button"
                            class="agy-iconbtn agy-sm"
                            [attr.title]="i18n.t('copy')"
                            [attr.aria-label]="i18n.t('copy')"
                            (click)="
                              copyValue(currentSecret.value, currentSecret.label, undefined, true)
                            "
                          >
                            <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                          </button>
                        } @else {
                          <span class="agy-mono">—</span>
                          <span class="agy-hint tw-px-0">{{ kindLabel(selectedKind()) }}</span>
                        }
                      </div>
                    </div>
                  }

                  @if (versionLoading()) {
                    <p class="agy-hint tw-px-0">{{ i18n.t("loading") }}</p>
                  } @else if (versionRows().length) {
                    @for (row of versionRows(); track row.revisionDate.getTime(); let i = $index) {
                      <div class="agy-ver">
                        <div class="agy-ver-top">
                          <bit-icon name="bwi-clock" class="tw-text-xs"></bit-icon>
                          <span>{{
                            i18n.t("itemHistoryVersion", (versionRows().length - i).toString())
                          }}</span>
                          <span class="agy-ver-when">{{ longDate(row.revisionDate) }}</span>
                        </div>
                        @if (row.changedFields.length) {
                          <div class="agy-ver-diff">
                            {{ i18n.t("itemHistoryDiff", changedLabel(row)) }}
                          </div>
                        }
                        <div class="agy-ver-value">
                          @if (primarySecretOf(row.view); as versionSecret) {
                            <span class="agy-mono tw-truncate">
                              {{ versionRevealed().has(i) ? versionSecret.value : mask }}
                            </span>
                            <button
                              type="button"
                              class="agy-iconbtn agy-sm"
                              [attr.title]="
                                i18n.t(versionRevealed().has(i) ? 'hideValue' : 'showValue')
                              "
                              [attr.aria-label]="
                                i18n.t(versionRevealed().has(i) ? 'hideValue' : 'showValue')
                              "
                              (click)="toggleVersionReveal(i)"
                            >
                              <bit-icon
                                [name]="versionRevealed().has(i) ? 'bwi-eye-slash' : 'bwi-eye'"
                                class="tw-text-xs"
                              ></bit-icon>
                            </button>
                            <button
                              type="button"
                              class="agy-iconbtn agy-sm"
                              [attr.title]="i18n.t('copy')"
                              [attr.aria-label]="i18n.t('copy')"
                              (click)="
                                copyValue(versionSecret.value, versionSecret.label, undefined, true)
                              "
                            >
                              <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                            </button>
                          } @else {
                            <span class="agy-mono">{{ mask }}</span>
                          }
                          <button
                            type="button"
                            class="agy-btn agy-primary agy-sm"
                            data-testid="vault_button_restore_version"
                            [disabled]="saving()"
                            (click)="restoreVersion(row)"
                          >
                            {{ i18n.t("restore") }}
                          </button>
                        </div>
                      </div>
                    }
                  } @else if (!historyRows().length) {
                    <div class="agy-empty">
                      <span class="agy-empty-ico">
                        <bit-icon name="bwi-clock" class="tw-text-base"></bit-icon>
                      </span>
                      <div class="agy-eh">{{ i18n.t("itemHistoryEmptyTitle") }}</div>
                      <div class="agy-es">{{ i18n.t("itemHistoryEmptyHint") }}</div>
                    </div>
                  } @else {
                    @for (row of historyRows(); track $index) {
                      <div class="agy-ver">
                        <div class="agy-ver-top">
                          <bit-icon name="bwi-clock" class="tw-text-xs"></bit-icon>
                          <span>{{ i18n.t("passwordHistorySavedValue") }}</span>
                          <span class="agy-ver-when">{{ longDate(row.lastUsedDate) }}</span>
                        </div>
                        <div class="agy-ver-value">
                          <span class="agy-mono">
                            {{
                              historyRevealed().has($index)
                                ? row.password || "—"
                                : row.password
                                  ? mask
                                  : "—"
                            }}
                          </span>
                          <button
                            type="button"
                            class="agy-iconbtn agy-sm"
                            [attr.title]="
                              i18n.t(
                                historyRevealed().has($index) ? 'hidePassword' : 'showPassword'
                              )
                            "
                            [attr.aria-label]="
                              i18n.t(
                                historyRevealed().has($index) ? 'hidePassword' : 'showPassword'
                              )
                            "
                            (click)="toggleHistoryReveal($index)"
                          >
                            <bit-icon
                              [name]="historyRevealed().has($index) ? 'bwi-eye-slash' : 'bwi-eye'"
                              class="tw-text-xs"
                            ></bit-icon>
                          </button>
                          <button
                            type="button"
                            class="agy-iconbtn agy-sm"
                            [attr.title]="i18n.t('copyPassword')"
                            [attr.aria-label]="i18n.t('copyPassword')"
                            (click)="copyValue(row.password, i18n.t('password'), undefined, true)"
                          >
                            <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                          </button>
                          @if (canRestoreHistory()) {
                            <button
                              type="button"
                              class="agy-btn agy-primary agy-sm"
                              data-testid="vault_button_restore_history"
                              [disabled]="saving()"
                              (click)="restoreHistory(row)"
                            >
                              {{ i18n.t("restore") }}
                            </button>
                          }
                        </div>
                      </div>
                    }
                  }

                  @if (errorMessage()) {
                    <p class="agy-hint agy-hint-error tw-px-0">{{ errorMessage() }}</p>
                  }
                }
                @case ("qr") {
                  @if (totpKey()) {
                    <div class="agy-grp tw-mx-auto tw-mt-1 tw-w-fit tw-p-4 tw-text-center">
                      <vault-totp-qr
                        class="tw-mx-auto tw-block tw-w-fit"
                        [value]="totpKey()"
                        [size]="180"
                        [ariaLabel]="selected()?.name ?? ''"
                      />
                      <p class="agy-hint tw-mt-2 tw-text-center">
                        {{ i18n.t("totpQrCardHint") }}
                      </p>
                      <p class="agy-hint tw-mt-1 tw-font-mono tw-text-center">
                        SHA1 · 6 · {{ totpPeriod() || 30 }}s · {{ totpRemaining() }}s
                      </p>
                    </div>
                    <div class="agy-seclbl tw-mt-3">{{ i18n.t("manualEntry") }}</div>
                    <div class="agy-grp">
                      <div
                        class="agy-ext-field"
                        role="button"
                        tabindex="0"
                        (click)="
                          copyValue(totpBase32Secret(), i18n.t('totpSecret'), undefined, true)
                        "
                        (keydown.enter)="
                          copyValue(totpBase32Secret(), i18n.t('totpSecret'), undefined, true)
                        "
                      >
                        <span class="agy-k">{{ i18n.t("totpSecret") }}</span>
                        <span class="agy-v agy-mono">{{
                          qrSecretVisible() ? totpBase32Secret() : mask
                        }}</span>
                        <button
                          type="button"
                          class="agy-iconbtn agy-sm"
                          [attr.title]="i18n.t(qrSecretVisible() ? 'hideValue' : 'showValue')"
                          [attr.aria-label]="i18n.t('toggleVisibility')"
                          (click)="$event.stopPropagation(); toggleQrSecret()"
                        >
                          <bit-icon
                            [name]="qrSecretVisible() ? 'bwi-eye-slash' : 'bwi-eye'"
                            class="tw-text-xs"
                          ></bit-icon>
                        </button>
                        <bit-icon name="bwi-copy" class="tw-text-xs tw-text-muted"></bit-icon>
                      </div>
                    </div>
                    <p class="agy-hint tw-mt-2 tw-text-center">{{ i18n.t("totpQrFootnote") }}</p>
                  }
                }
              }
            </div>

            <div class="agy-ext-foot">
              @if (drawer() === "edit" || drawer() === "new-form") {
                @if (drawer() === "edit") {
                  <button
                    type="button"
                    class="agy-btn agy-danger agy-lg"
                    (click)="closeDrawer(); remove()"
                  >
                    {{ i18n.t("delete") }}
                  </button>
                }
                <button
                  type="button"
                  class="agy-btn agy-primary agy-lg tw-flex-1"
                  [disabled]="saving()"
                  (click)="save()"
                >
                  {{ i18n.t("save") }}
                </button>
                <button
                  type="button"
                  class="agy-btn agy-lg tw-flex-1"
                  (click)="drawer() === 'edit' ? cancelEdit() : closeDrawer()"
                >
                  {{ i18n.t("cancel") }}
                </button>
              } @else if (drawer() === "history") {
                <span class="agy-hint tw-px-0">{{
                  versionRows().length
                    ? i18n.t("itemHistoryRetention")
                    : i18n.t("passwordHistoryRetention")
                }}</span>
                <button
                  type="button"
                  class="agy-btn agy-lg tw-ml-auto tw-flex-none"
                  (click)="closeDrawer()"
                >
                  {{ i18n.t("close") }}
                </button>
              } @else {
                <button type="button" class="agy-btn agy-lg tw-flex-1" (click)="closeDrawer()">
                  {{ i18n.t("close") }}
                </button>
              }
            </div>
          </aside>
        </div>
      }

      @if (deleteTarget(); as target) {
        <div
          class="tw-absolute tw-inset-0 tw-z-40 tw-grid tw-place-items-center tw-bg-bg-overlay tw-px-6"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="i18n.t('deleteItemDialogTitle')"
          (click)="deleteTarget.set(null)"
        >
          <div
            class="agy-grp tw-w-full tw-max-w-sm tw-bg-background tw-shadow-xl"
            (click)="$event.stopPropagation()"
          >
            <div
              class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-4 tw-py-3"
            >
              <span class="agy-avatar" aria-hidden="true">{{ initialOf(target) }}</span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="tw-block tw-truncate tw-text-xs tw-font-semibold tw-text-main">
                  {{ target.name }}
                </span>
                <span class="tw-block tw-truncate tw-text-xs tw-text-muted">
                  {{ deleteSubtitle(target) }} · {{ folderName(target) }}
                </span>
              </span>
              <span class="agy-chip">{{ kindLabel(kindOfItem(target)) }}</span>
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-label]="i18n.t('close')"
                (click)="deleteTarget.set(null)"
              >
                <bit-icon name="bwi-close" class="tw-text-xs"></bit-icon>
              </button>
            </div>
            <div class="tw-px-4 tw-py-3 tw-text-xs tw-leading-relaxed tw-text-muted">
              {{ i18n.t("deleteItemDialogBody", target.name) }}
            </div>
            <div
              class="tw-flex tw-justify-end tw-gap-1.5 tw-border-t tw-border-border-light tw-px-4 tw-py-2.5"
            >
              <button type="button" class="agy-btn" (click)="deleteTarget.set(null)">
                {{ i18n.t("cancel") }}
              </button>
              <button
                type="button"
                class="agy-btn"
                [disabled]="saving()"
                data-testid="vault_delete_archive"
                (click)="archiveDeleteTarget()"
              >
                {{ i18n.t("archiveVerb") }}
              </button>
              <button
                type="button"
                class="agy-btn agy-danger"
                [disabled]="saving()"
                data-testid="vault_delete_confirm"
                (click)="confirmRemove()"
              >
                {{ i18n.t("moveToTrash") }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class VaultDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly versionHistory = inject(CipherVersionHistoryService);
  private readonly folderService = inject(FolderService);
  private readonly totpService = inject(TotpService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  protected readonly toast = inject(LpToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly densityService = inject(VaultDensityService);
  private readonly shortcutsService = inject(DesktopShortcutsService);
  private readonly passwordAutoHideService = inject(PasswordAutoHideService);
  private readonly passwordStrengthService = inject(PasswordStrengthServiceAbstraction);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly autofillSettingsService = inject(AutofillSettingsServiceAbstraction, {
    optional: true,
  });

  protected readonly autoHide = toSignal(this.passwordAutoHideService.autoHide$, {
    initialValue: true,
  });
  private readonly clearClipboardDelay = this.autofillSettingsService
    ? toSignal(this.autofillSettingsService.clearClipboardDelay$, {
        initialValue: ClearClipboardDelay.ThirtySeconds,
      })
    : signal(ClearClipboardDelay.ThirtySeconds);
  protected readonly totpRingCircumference = 2 * Math.PI * 9.5;
  protected readonly copiedKey = signal("");
  private readonly copiedTimer = signal<ReturnType<typeof setTimeout> | null>(null);
  private readonly revealTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly kinds = ITEM_KIND_ORDER;
  protected readonly noOptions: readonly LpFieldOption[] = [];
  protected readonly ItemKind = ItemKind;
  protected readonly kindOfItem = kindOf;
  protected readonly repromptType = CipherRepromptType;
  protected readonly fieldType = FieldType;
  protected readonly mask = MASK;
  protected readonly qrSecretVisible = computed(() => this.revealedLabels().has(QR_SECRET_LABEL));
  protected readonly formatExpiry = (value: string, deleting: boolean): string =>
    formatCardExpiryInput(value, { autoSlash: !deleting });
  protected readonly loading = signal(true);
  protected readonly query = signal("");
  protected readonly typeFilter = signal<TypeFilter>("all");
  protected readonly folderFilter = signal("all");
  protected readonly favoritesOnly = signal(false);
  protected readonly sortAscending = signal(false);
  private readonly density = toSignal(this.densityService.density$, {
    initialValue: VaultDensity.Compact,
  });
  protected readonly compactRows = computed(() => this.density() === VaultDensity.Ultra);
  private readonly disabledShortcuts = toSignal(this.shortcutsService.disabled$, {
    initialValue: new Set<DesktopShortcut>(),
  });
  protected readonly items = signal<CipherView[]>([]);
  protected readonly folders = signal<FolderView[]>([]);
  protected readonly selected = signal<CipherView | null>(null);
  protected readonly deleteTarget = signal<CipherView | null>(null);
  protected readonly drawer = signal<DrawerMode>("closed");
  protected readonly newKind = signal<ItemKind>(ItemKind.Login);
  protected readonly values = signal<FieldValues>({});
  protected readonly editFolderId = signal("");
  protected readonly editFavorite = signal(false);
  protected readonly editReprompt = signal(false);
  protected readonly editCustomFields = signal<readonly CustomFieldDraft[]>([]);
  protected readonly editHiddenFields = signal<ReadonlySet<string>>(new Set());
  protected readonly activeEditKind = computed(() =>
    this.drawer() === "new-form" ? this.newKind() : this.selectedKind(),
  );
  protected readonly sshKeyOptions = computed<readonly LpFieldOption[]>(() => [
    { value: "", label: this.i18n.t("none") },
    ...this.items()
      .filter((item) => kindOf(item) === ItemKind.SshKey)
      .map((item) => ({ value: item.id, label: item.name })),
  ]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly historyRevealed = signal<ReadonlySet<number>>(new Set());
  private readonly repromptedCipherId = signal<string | null>(null);
  protected readonly versionRows = signal<readonly CipherVersionRow[]>([]);
  protected readonly versionLoading = signal(false);
  protected readonly versionRevealed = signal<ReadonlySet<number>>(new Set());

  protected readonly subtitle = computed(() => {
    if (!this.items().length && !this.isFiltering()) {
      return this.i18n.t("noItemsYet");
    }
    return this.i18n.t("vaultSummary", this.items().length);
  });

  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });

  protected shortDate(date: Date): string {
    if (this.locale().startsWith("zh")) {
      return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  protected longDate(date: Date | null | undefined): string {
    return date ? formatLongDate(date) : "—";
  }

  private readonly folderNames = computed(() => {
    const map = new Map<string, string>();
    for (const folder of this.folders()) {
      map.set(folder.id, folder.name);
    }
    return map;
  });

  private readonly baseRows = computed<RowView[]>(() => {
    const query = this.query().trim().toLowerCase();
    const folderFilter = this.folderFilter();
    const favoritesOnly = this.favoritesOnly();
    const folderNames = this.folderNames();

    return this.items()
      .filter((item) => {
        if (folderFilter === "none" && item.folderId) {
          return false;
        }
        if (folderFilter !== "all" && folderFilter !== "none" && item.folderId !== folderFilter) {
          return false;
        }
        if (favoritesOnly && !item.favorite) {
          return false;
        }
        return this.matchesQuery(item, query, folderNames);
      })
      .map((item) => ({
        item,
        kind: kindOf(item),
        sub: this.subtitleOf(item),
        folder: item.folderId ? (folderNames.get(item.folderId) ?? "") : this.i18n.t("noFolder"),
        favorite: item.favorite,
        updated: item.revisionDate ?? null,
      }))
      .sort((a, b) =>
        this.sortAscending()
          ? a.item.name.localeCompare(b.item.name)
          : this.revisionTime(b.item) - this.revisionTime(a.item) ||
            a.item.name.localeCompare(b.item.name),
      );
  });

  protected readonly rows = computed<RowView[]>(() => {
    const type = this.typeFilter();
    if (type === "all") {
      return this.baseRows();
    }
    if (type === "other") {
      return this.baseRows().filter(
        (row) => row.kind !== ItemKind.Login && row.kind !== ItemKind.Card,
      );
    }
    return this.baseRows().filter((row) => row.kind === type);
  });

  protected readonly typeTabs = computed<readonly TypeTab[]>(() => {
    const base = this.baseRows();
    return [
      { id: "all", label: this.i18n.t("allItems"), count: base.length },
      {
        id: ItemKind.Login,
        label: this.kindLabel(ItemKind.Login),
        count: base.filter((row) => row.kind === ItemKind.Login).length,
      },
      {
        id: ItemKind.Card,
        label: this.kindLabel(ItemKind.Card),
        count: base.filter((row) => row.kind === ItemKind.Card).length,
      },
      {
        id: "other",
        label: this.i18n.t("other"),
        count: base.filter((row) => row.kind !== ItemKind.Login && row.kind !== ItemKind.Card)
          .length,
      },
    ];
  });

  protected readonly favoriteRows = computed(() => this.rows().filter((row) => row.favorite));
  protected readonly otherRows = computed(() => this.rows().filter((row) => !row.favorite));

  /**
   * 全字段检索：名称、用户名、网址、备注、自定义字段、卡号后四位与文件夹都参与匹配，
   * 并支持 `=favorite` / `=totp` / `=passkey` / `=ssh` 语法过滤。
   */
  private matchesQuery(
    item: CipherView,
    query: string,
    folderNames: ReadonlyMap<string, string>,
  ): boolean {
    if (!query) {
      return true;
    }
    if (query === "=favorite") {
      return item.favorite;
    }

    const kind = kindOf(item);
    const values = readFieldValues(item, kind);
    if (query === "=totp") {
      return !!(values.totp || item.login?.totp);
    }
    if (query === "=passkey") {
      return !!item.login?.fido2Credentials?.length;
    }
    if (query === "=ssh") {
      return kind === ItemKind.SshKey || kind === ItemKind.Server;
    }

    const haystack = [
      item.name,
      item.subTitle ?? "",
      item.notes ?? "",
      item.folderId ? (folderNames.get(item.folderId) ?? "") : "",
      ...searchableFieldValues(item, kind),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  constructor() {
    // 筛选后条目不在列表里时，右侧详情不能继续展示它，否则列表与详情会各说各话。
    effect(() => {
      // 编辑中的草稿不能被筛选顺手关掉，历史抽屉同样要留住当前条目，先让用户自己关闭。
      if (this.drawer() === "edit" || this.drawer() === "new-form" || this.drawer() === "history") {
        return;
      }
      const selected = this.selected();
      if (!selected) {
        return;
      }
      if (this.rows().some((row) => row.item === selected)) {
        return;
      }
      this.selected.set(null);
    });
  }

  protected readonly isFiltering = computed(
    () =>
      this.query().trim() !== "" ||
      this.typeFilter() !== "all" ||
      this.folderFilter() !== "all" ||
      this.favoritesOnly(),
  );

  /** 全新保险库：原型用一张居中的欢迎面板替代空列表与空详情。 */
  protected readonly showWelcome = computed(
    () => !this.loading() && this.baseRows().length === 0 && !this.isFiltering(),
  );

  protected readonly selectedKind = computed(() =>
    this.selected() ? kindOf(this.selected()!) : ItemKind.Login,
  );

  /** 旧值只来自登录密码历史；按时间倒序，导入的旧数据顺序不齐时也能稳定展示。 */
  protected readonly historyRows = computed<readonly PasswordHistoryView[]>(() => {
    const item = this.selected();
    if (!item || kindOf(item) !== ItemKind.Login || !item.passwordHistory?.length) {
      return [];
    }
    return [...item.passwordHistory].sort(
      (a, b) => (b.lastUsedDate?.getTime() ?? 0) - (a.lastUsedDate?.getTime() ?? 0),
    );
  });

  protected readonly canRestoreHistory = computed(() => {
    const item = this.selected();
    return !!item && kindOf(item) === ItemKind.Login;
  });

  protected readonly totpKey = computed(() => this.selected()?.login.totp ?? "");
  protected readonly totpBase32Secret = computed(() => totpSecretOf(this.totpKey()));
  private readonly totpResponse = toSignal(
    toObservable(this.totpKey).pipe(
      switchMap((key) => (key ? this.totpService.getCode$(key) : of(null))),
      takeUntilDestroyed(),
    ),
    { initialValue: null },
  );
  protected readonly totpCode = computed(() => this.totpResponse()?.code ?? "");
  protected readonly totpPeriod = computed(() => this.totpResponse()?.period ?? 30);
  protected readonly totpRemaining = computed(() => {
    const response = this.totpResponse();
    if (!response?.period) {
      return 0;
    }
    const elapsed = Math.floor(Date.now() / 1000) % response.period;
    return Math.max(1, response.period - elapsed);
  });
  protected readonly formattedTotp = computed(() => {
    const code = this.totpCode();
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  });
  protected readonly totpProgress = computed(() => {
    const response = this.totpResponse();
    if (!response?.period) {
      return 0;
    }
    return (this.totpRemaining() / response.period) * 100;
  });
  protected readonly totpRingOffset = computed(
    () => this.totpRingCircumference * (1 - this.totpProgress() / 100),
  );

  protected readonly selectedStrength = computed<{
    score: number;
    label: string;
    tone: "bad" | "warn" | "ok";
  } | null>(() => {
    const item = this.selected();
    if (!item || this.selectedKind() !== ItemKind.Login || !item.login?.password) {
      return null;
    }
    const score =
      this.passwordStrengthService.getPasswordStrength(
        item.login.password,
        item.login.username ?? undefined,
        [item.name],
      )?.score ?? 0;
    if (score < 2) {
      return { score, label: this.i18n.t("weak"), tone: "bad" };
    }
    if (score < 3) {
      return { score, label: this.i18n.t("good"), tone: "warn" };
    }
    return { score, label: this.i18n.t("strong"), tone: "ok" };
  });

  protected readonly revealedLabels = signal<ReadonlySet<string>>(new Set());

  protected readonly passkeys = computed(() => {
    const item = this.selected();
    if (!item || this.selectedKind() !== ItemKind.Login) {
      return [];
    }
    return item.login?.fido2Credentials ?? [];
  });

  protected readonly customFields = computed(() => {
    const item = this.selected();
    if (!item) {
      return [];
    }
    // 类型自有字段已经在「项目详细信息」里显示过，比如令牌的 scope/env；自定义字段
    // 只保留用户额外加的，否则同一份值会出现两次。
    const known = new Set(
      FIELDS[this.selectedKind()]
        .map((field) => (typeof field.target === "object" ? field.target.custom : ""))
        .filter(Boolean),
    );
    return withoutKindField(item.fields).filter((field) => !known.has(field.name ?? ""));
  });

  protected readonly detailGroups = computed<DetailGroupView[]>(() => {
    const item = this.selected();
    if (!item) {
      return [];
    }
    const kind = kindOf(item);
    const values = readFieldValues(item, kind);
    const groups: DetailGroupView[] = [];

    const sshKeyMap = new Map(
      this.items()
        .filter((entry) => kindOf(entry) === ItemKind.SshKey)
        .map((entry) => [entry.id, entry.name]),
    );

    if (kind === ItemKind.Login) {
      const credentials: DetailRowView[] = [];
      for (const spec of FIELDS[kind].filter((field) => field.section === "login")) {
        const raw = values[spec.id] ?? "";
        if (spec.target === "loginTotp") {
          const code = this.totpCode();
          if (code) {
            credentials.push({
              label: this.i18n.t("totpCodeLabel"),
              display: this.formattedTotp(),
              copy: code,
              mono: true,
              multiline: false,
              launchUri: "",
              totp: true,
              secret: false,
            });
          }
          continue;
        }
        if (!raw) {
          continue;
        }
        credentials.push({
          label: this.i18n.t(spec.labelKey),
          display: spec.password ? MASK : raw,
          copy: raw,
          mono: this.isMonoField(spec),
          multiline: !!spec.multiline,
          launchUri: "",
          totp: false,
          secret: spec.password ?? false,
        });
      }
      if (credentials.length) {
        groups.push({
          key: "login",
          label: this.i18n.t(FIELD_SECTIONS["login"]),
          rows: credentials,
        });
      }

      const autofill: DetailRowView[] = [];
      for (const spec of FIELDS[kind].filter((field) => field.section === "uri")) {
        const raw = values[spec.id] ?? "";
        if (!raw) {
          continue;
        }
        autofill.push({
          label: this.i18n.t(spec.labelKey),
          display: raw,
          copy: raw,
          mono: this.isMonoField(spec),
          multiline: false,
          launchUri: raw,
          totp: false,
          secret: false,
        });
      }
      if (autofill.length) {
        groups.push({
          key: "autofill",
          label: this.i18n.t(FIELD_SECTIONS["uri"]),
          rows: autofill,
        });
      }
      return groups;
    }

    for (const group of fieldGroups(kind)) {
      if (group.key === "item" || group.key === "options") {
        continue;
      }
      const rows: DetailRowView[] = [];
      for (const spec of group.fields) {
        const raw = values[spec.id] ?? "";
        if (spec.target === "loginTotp") {
          const code = this.totpCode();
          if (code) {
            rows.push({
              label: this.i18n.t("totpCodeLabel"),
              display: this.formattedTotp(),
              copy: code,
              mono: true,
              multiline: false,
              launchUri: "",
              totp: true,
              secret: false,
            });
          }
          continue;
        }
        if (!raw) {
          continue;
        }
        const linkedSshName = spec.sshKeyRef ? sshKeyMap.get(raw) : undefined;
        rows.push({
          label: this.i18n.t(spec.labelKey),
          display: spec.password ? MASK : (linkedSshName ?? raw),
          copy: linkedSshName ?? raw,
          mono: this.isMonoField(spec),
          multiline: !!spec.multiline,
          launchUri: "",
          sshLinkId: linkedSshName ? raw : undefined,
          totp: false,
          secret: spec.password ?? false,
        });
      }
      if (rows.length) {
        groups.push({
          key: group.key,
          label: this.i18n.t(group.labelKey),
          rows,
        });
      }
    }
    return groups;
  });

  protected readonly totpRow = computed<DetailRowView | null>(
    () =>
      this.detailGroups()
        .flatMap((group) => group.rows)
        .find((row) => row.totp) ?? null,
  );

  protected readonly optionsRows = computed<DetailRowView[]>(() => {
    const item = this.selected();
    if (!item) {
      return [];
    }
    const kind = kindOf(item);
    const group = fieldGroups(kind).find((entry) => entry.key === "options");
    if (!group) {
      return [];
    }
    const values = readFieldValues(item, kind);
    return group.fields
      .map((spec) => ({
        label: this.i18n.t(spec.labelKey),
        display: values[spec.id] ?? "",
        copy: values[spec.id] ?? "",
        mono: false,
        multiline: !!spec.multiline,
        launchUri: "",
        totp: false,
        secret: false,
      }))
      .filter((row) => row.display);
  });

  protected readonly editGroups = computed(() => {
    const hidden = this.editHiddenFields();
    return fieldGroups(this.activeEditKind())
      .map((group) => ({
        ...group,
        fields: group.fields.filter((field) => {
          if (field.id === "name") {
            return true;
          }
          return !hidden.has(field.id);
        }),
      }))
      .filter((group) => group.fields.length > 0);
  });

  protected readonly editHiddenFieldPills = computed(() => {
    const hidden = this.editHiddenFields();
    return fieldGroups(this.activeEditKind())
      .flatMap((group) => group.fields)
      .filter((field) => field.id !== "name" && hidden.has(field.id));
  });

  protected readonly folderOptions = computed(() => [
    { value: "", label: this.i18n.t("noFolder") },
    ...this.folders().map((folder) => ({ value: folder.id, label: folder.name })),
  ]);

  protected readonly drawerTitle = computed(() => {
    switch (this.drawer()) {
      case "edit":
        return this.i18n.t("editKindTitle", this.kindLabel(this.selectedKind()));
      case "new-type":
        return this.i18n.t("newItem");
      case "new-form":
        return this.i18n.t("newKindTitle", this.kindLabel(this.newKind()));
      case "history":
        return this.i18n.t("itemVersionHistory");
      case "qr":
        return this.i18n.t("totpQrTitle");
      default:
        return "";
    }
  });

  protected readonly drawerSub = computed(() => {
    switch (this.drawer()) {
      case "edit":
      case "history":
      case "qr":
        return this.selected()?.name ?? "";
      case "new-type":
        return this.i18n.t("newItemPickKind");
      case "new-form":
        return this.kindBlurb(this.newKind());
      default:
        return "";
    }
  });

  async ngOnInit(): Promise<void> {
    this.destroyRef.onDestroy(() => this.clearRevealTimers());
    this.repromptedCipherId.set(null);
    const folder = this.route.snapshot.queryParamMap.get("folder");
    if (folder) {
      this.folderFilter.set(folder);
    }

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const [ciphers, folders] = await Promise.all([
        this.cipherService.getAllDecrypted(userId),
        firstValueFrom(this.folderService.folderViews$(userId)),
      ]);
      this.items.set(ciphers.filter((cipher) => !cipher.isDeleted && !cipher.isArchived));
      this.folders.set(folders.filter((folder) => folder.id !== ""));

      // 快速检索（⌘K）与安全体检用 `cipherId` 把选中条目带回来；`edit=1` 直接展开编辑抽屉。
      // 先清掉可能挡住它的列表筛选。
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        void this.openFromQuery(params);
      });
    } finally {
      this.loading.set(false);
    }
  }

  private async openFromQuery(params: ParamMap): Promise<void> {
    const cipherId = params.get("cipherId");
    if (!cipherId) {
      return;
    }
    const item = this.items().find((cipher) => String(cipher.id) === cipherId);
    if (!item) {
      return;
    }
    const startEditing = params.get("edit") === "1";
    this.clearFilters();
    await this.openView(item);
    if (startEditing) {
      await this.startEdit();
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cipherId: null, edit: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  protected kindLabel(kind: ItemKind): string {
    return this.i18n.t(ITEM_KIND_UI[kind].labelKey);
  }

  protected kindBlurb(kind: ItemKind): string {
    return this.i18n.t(ITEM_KIND_UI[kind].blurbKey);
  }

  protected folderName(item: CipherView): string {
    return item.folderId ? (this.folderNames().get(item.folderId) ?? "") : this.i18n.t("noFolder");
  }

  protected initialOf(item: CipherView): string {
    return (item.name || "?").trim().slice(0, 1).toUpperCase();
  }

  protected deleteSubtitle(item: CipherView): string {
    return this.subtitleOf(item);
  }

  protected isSelected(item: CipherView): boolean {
    return this.selected() === item;
  }

  protected setTypeFilter(filter: TypeFilter): void {
    this.typeFilter.set(filter);
  }

  protected toggleCompactRows(): void {
    void this.densityService.setDensity(
      this.compactRows() ? VaultDensity.Compact : VaultDensity.Ultra,
    );
  }

  protected toggleSort(): void {
    this.sortAscending.update((ascending) => !ascending);
  }

  /**
   * Kind-aware second line, matching the popup list: logins show the username, tokens their
   * environment, servers the host with the SSH port and protocol, cards only the last four
   * digits, and notes their line count. The kind label is the fallback for kinds whose list
   * data has nothing more specific to show.
   */
  private subtitleOf(item: CipherView): string {
    const kind = kindOf(item);
    const values = readFieldValues(item, kind);
    const label = this.kindLabel(kind);
    switch (kind) {
      case ItemKind.Login:
        return values.username || label;
      case ItemKind.Token:
        return joinParts([label, this.envLabel(values.env)]);
      case ItemKind.Server: {
        const host = values.host;
        const protocol = values.protocol?.toUpperCase();
        const address =
          host && !host.includes(":") && /^ssh$/i.test(values.protocol ?? "") ? `${host}:22` : host;
        return joinParts([address, protocol || label]);
      }
      case ItemKind.Card: {
        const last4 = /(\d{4})\s*$/.exec(values.number ?? "")?.[1];
        return last4 ? `•••• ${last4}` : label;
      }
      case ItemKind.Note: {
        const notes = values.notes?.trim();
        return notes
          ? joinParts([label, this.i18n.t("lineCount", String(notes.split(/\r?\n/).length))])
          : label;
      }
      case ItemKind.License:
        return joinParts([label, values.seats]);
      case ItemKind.SshKey:
      case ItemKind.Identity:
        return label;
    }
  }

  private envLabel(env: string | undefined): string {
    if (!env || /环境$|environment$/i.test(env)) {
      return env ?? "";
    }
    return this.i18n.t("environmentLabel", env);
  }

  private revisionTime(item: CipherView): number {
    const time = item.revisionDate?.getTime() ?? 0;
    return Number.isNaN(time) ? 0 : time;
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onFolderFilter(event: Event): void {
    this.folderFilter.set((event.target as HTMLSelectElement).value);
  }

  protected clearFilters(): void {
    this.query.set("");
    this.typeFilter.set("all");
    this.folderFilter.set("all");
    this.favoritesOnly.set(false);
  }

  protected async openView(item: CipherView, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.repromptedCipherId.set(null);
    if (item.reprompt !== CipherRepromptType.None && !(await this.ensureReprompt(item))) {
      return;
    }
    this.clearRevealTimers();
    this.selected.set(item);
    this.revealedLabels.set(new Set());
    this.historyRevealed.set(new Set());
    this.errorMessage.set(null);
  }

  protected openLinkedSsh(sshId: string): void {
    const target = this.items().find((entry) => entry.id === sshId);
    if (target) {
      this.clearFilters();
      void this.openView(target);
    }
  }

  protected async openQr(): Promise<void> {
    if (!this.totpKey()) {
      return;
    }
    // 二维码和 Base32 种子都能直接生成验证码，和密码一样先过重提示。
    if (!(await this.ensureReprompt(this.selected()))) {
      return;
    }
    this.hideQrSecret();
    this.drawer.set("qr");
  }

  protected toggleQrSecret(): void {
    const willReveal = !this.revealedLabels().has(QR_SECRET_LABEL);
    this.revealedLabels.update((labels) => {
      const next = new Set(labels);
      if (willReveal) {
        next.add(QR_SECRET_LABEL);
      } else {
        next.delete(QR_SECRET_LABEL);
      }
      return next;
    });
    this.scheduleAutoHide(QR_SECRET_LABEL, willReveal, () => {
      this.revealedLabels.update((labels) => {
        const next = new Set(labels);
        next.delete(QR_SECRET_LABEL);
        return next;
      });
    });
  }

  /** 重新打开 QR 抽屉时种子回到掩码状态，不让上一次的展开沿用过来。 */
  private hideQrSecret(): void {
    const timer = this.revealTimers.get(QR_SECRET_LABEL);
    if (timer) {
      clearTimeout(timer);
      this.revealTimers.delete(QR_SECRET_LABEL);
    }
    this.revealedLabels.update((labels) => {
      if (!labels.has(QR_SECRET_LABEL)) {
        return labels;
      }
      const next = new Set(labels);
      next.delete(QR_SECRET_LABEL);
      return next;
    });
  }

  protected formatPasskeyLabel(passkey: { rpId?: string; userName?: string }): string {
    return (
      [passkey.rpId, passkey.userName].filter(Boolean).join(" · ") || this.i18n.t("typePasskey")
    );
  }

  protected primarySecretOf(view: CipherView): { label: string; value: string } | null {
    const kind = kindOf(view);
    const values = readFieldValues(view, kind);
    const secretSpec = FIELDS[kind].find((field) => field.password && (values[field.id] ?? ""));
    if (secretSpec) {
      return { label: this.i18n.t(secretSpec.labelKey), value: values[secretSpec.id] ?? "" };
    }
    if (kind === ItemKind.Note && values.notes) {
      return { label: this.i18n.t("notes"), value: values.notes };
    }
    return null;
  }

  protected optionsFor(field: FieldSpec): readonly LpFieldOption[] {
    if (field.sshKeyRef) {
      return this.sshKeyOptions();
    }
    return field.options ?? this.noOptions;
  }

  protected closeDrawer(): void {
    this.repromptedCipherId.set(null);
    if (this.drawer() === "edit") {
      this.cancelEdit();
      return;
    }
    this.drawer.set("closed");
    this.clearRevealTimers();
    this.historyRevealed.set(new Set());
    this.versionRevealed.set(new Set());
    this.errorMessage.set(null);
  }

  protected clearSelection(): void {
    this.repromptedCipherId.set(null);
    this.clearRevealTimers();
    this.selected.set(null);
    this.revealedLabels.set(new Set());
    this.errorMessage.set(null);
  }

  protected openNew(): void {
    this.newKind.set(ItemKind.Login);
    this.values.set({});
    this.editFavorite.set(false);
    this.editReprompt.set(false);
    this.editCustomFields.set([]);
    this.editHiddenFields.set(new Set());
    this.editFolderId.set(
      this.folderFilter() !== "all" && this.folderFilter() !== "none" ? this.folderFilter() : "",
    );
    this.errorMessage.set(null);
    this.drawer.set("new-type");
  }

  protected startNewForm(kind: ItemKind): void {
    this.newKind.set(kind);
    this.values.set({});
    this.editFavorite.set(false);
    this.editReprompt.set(false);
    this.editCustomFields.set([]);
    this.collapseEmptyOptionalEditFields(kind, {});
    this.errorMessage.set(null);
    this.drawer.set("new-form");
  }

  protected async startEdit(): Promise<void> {
    const item = this.selected();
    if (
      !item ||
      (item.reprompt !== CipherRepromptType.None && !(await this.ensureReprompt(item)))
    ) {
      return;
    }
    const kind = kindOf(item);
    const fieldValues = readFieldValues(item, kind);
    this.values.set(fieldValues);
    this.editCustomFields.set(
      readCustomFields(item, kind).map((field) =>
        newCustomFieldDraft(field.name, field.value, field.hidden),
      ),
    );
    this.editFolderId.set(item.folderId ?? "");
    this.editFavorite.set(item.favorite);
    this.editReprompt.set(item.reprompt !== CipherRepromptType.None);
    this.collapseEmptyOptionalEditFields(kind, fieldValues);
    this.errorMessage.set(null);
    this.drawer.set("edit");
  }

  private collapseEmptyOptionalEditFields(kind: ItemKind, values: FieldValues): void {
    const collapsed = new Set<string>();
    for (const group of fieldGroups(kind)) {
      for (const field of group.fields) {
        if (field.optional && !(values[field.id] ?? "")) {
          collapsed.add(field.id);
        }
      }
    }
    this.editHiddenFields.set(collapsed);
  }

  protected cancelEdit(): void {
    this.repromptedCipherId.set(null);
    this.drawer.set("closed");
    this.errorMessage.set(null);
  }

  protected async openHistory(): Promise<void> {
    const item = this.selected();
    if (
      !item ||
      (item.reprompt !== CipherRepromptType.None && !(await this.ensureReprompt(item)))
    ) {
      return;
    }
    this.clearRevealTimers();
    this.historyRevealed.set(new Set());
    this.versionRevealed.set(new Set());
    this.errorMessage.set(null);
    this.drawer.set("history");
    void this.loadVersionRows();
  }

  private async loadVersionRows(): Promise<void> {
    const item = this.selected();
    if (!item?.id) {
      this.versionRows.set([]);
      return;
    }

    this.versionLoading.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const rows = await this.versionHistory.rows(userId, item.id, item);
      // The user can select another item while the snapshots decrypt.
      if (this.selected()?.id === item.id) {
        this.versionRows.set(rows);
      }
    } catch {
      if (this.selected()?.id === item.id) {
        this.versionRows.set([]);
      }
    } finally {
      this.versionLoading.set(false);
    }
  }

  protected toggleVersionReveal(index: number): void {
    const willReveal = !this.versionRevealed().has(index);
    this.versionRevealed.update((revealed) => {
      const next = new Set(revealed);
      if (willReveal) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
    this.scheduleAutoHide(`version:${index}`, willReveal, () => {
      this.versionRevealed.update((revealed) => {
        const next = new Set(revealed);
        next.delete(index);
        return next;
      });
    });
  }

  protected changedLabel(row: CipherVersionRow): string {
    return row.changedFields.map((key) => this.i18n.t(key)).join(" · ");
  }

  protected async restoreVersion(row: CipherVersionRow): Promise<void> {
    const item = this.selected();
    if (!item?.id || item.id !== row.view.id || !(await this.ensureReprompt(item))) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const saved = await this.cipherService.updateWithServer(cloneCipherView(row.view), userId);
      this.selected.set(saved);
      this.items.update((items) =>
        items.map((entry) =>
          entry === item || (saved.id && entry.id === saved.id) ? saved : entry,
        ),
      );
      this.versionRevealed.set(new Set());
      await this.loadVersionRows();
      this.toast.show(this.i18n.t("itemHistoryRestored"));
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }

  protected toggleHistoryReveal(index: number): void {
    const willReveal = !this.historyRevealed().has(index);
    this.historyRevealed.update((revealed) => {
      const next = new Set(revealed);
      if (willReveal) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
    this.scheduleAutoHide(`history:${index}`, willReveal, () => {
      this.historyRevealed.update((revealed) => {
        const next = new Set(revealed);
        next.delete(index);
        return next;
      });
    });
  }

  /**
   * 把某个旧值恢复成当前密码。写入仍走 `updateWithServer`，本地写入器会在保存前把当前密码
   * 记入历史，所以这一步本身可逆；字段级版本与 10 版保留并不存在，界面上不宣称。
   */
  protected async restoreHistory(row: PasswordHistoryView): Promise<void> {
    const item = this.selected();
    if (
      !item?.id ||
      kindOf(item) !== ItemKind.Login ||
      !row.password ||
      !(await this.ensureReprompt(item))
    ) {
      return;
    }

    // Restore into a copy so a failed write leaves the cached item on its current password.
    const view = cloneCipherView(item);
    view.login.password = row.password;
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const saved = await this.cipherService.updateWithServer(view, userId);
      this.selected.set(saved);
      this.items.update((items) =>
        items.map((entry) =>
          entry === item || (saved.id && entry.id === saved.id) ? saved : entry,
        ),
      );
      this.historyRevealed.set(new Set());
      this.versionRevealed.set(new Set());
      await this.loadVersionRows();
      this.toast.show(this.i18n.t("passwordHistoryRestored"));
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }

  protected setValue(id: string, value: string): void {
    this.values.update((current) => ({
      ...current,
      [id]: value,
    }));
  }

  protected fieldPlaceholder(field: FieldSpec): string {
    if (field.id === "expiry") {
      return "MM/YY";
    }
    return field.target === "name" ? this.i18n.t("enterItemName") : "";
  }

  /** 移除字段：先清值再隐藏，保存后对应字段即为空。 */
  protected hideEditField(id: string): void {
    if (id === "name") {
      return;
    }
    this.values.update((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    this.editHiddenFields.update((current) => new Set([...current, id]));
  }

  protected showEditField(id: string): void {
    this.editHiddenFields.update((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  protected generateInto(field: FieldSpec): void {
    if (!field.generate) {
      return;
    }
    const [generated] = generatePasswords(1, DEFAULT_PASSWORD_OPTIONS);
    if (generated) {
      this.setValue(field.id, generated);
    }
  }

  protected isMonoField(field: FieldSpec): boolean {
    return (
      !!field.mono ||
      !!field.password ||
      !!field.multiline ||
      field.id === "expiry" ||
      field.target === "loginUsername" ||
      field.target === "loginUri" ||
      field.target === "loginUri2"
    );
  }

  protected async save(): Promise<void> {
    this.errorMessage.set(null);
    const name = (this.values()["name"] ?? "").trim();
    if (!name) {
      this.errorMessage.set(this.i18n.t("nameRequired"));
      return;
    }

    this.saving.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const creating = this.drawer() === "new-form" || this.drawer() === "new-type";
      const kind = creating ? this.newKind() : this.selectedKind();
      const original = creating ? new CipherView() : this.selected();
      if (!original) {
        return;
      }
      // Edit a copy: a failed write must leave the cached item the drawer was opened from intact.
      const view = creating ? original : cloneCipherView(original);

      applyFieldValues(view, kind, { ...this.values(), name });
      applyCustomFields(view, kind, this.editCustomFields());
      setKind(view, kind);
      view.folderId = this.editFolderId() || undefined;
      view.favorite = this.editFavorite();
      view.reprompt =
        kind === ItemKind.Login && this.editReprompt()
          ? CipherRepromptType.Password
          : CipherRepromptType.None;

      const saved = creating
        ? await this.cipherService.createWithServer(view, userId)
        : await this.cipherService.updateWithServer(view, userId);

      this.items.update((items) => {
        const existing = items.some((item) => item === view || (saved.id && item.id === saved.id));
        return existing
          ? items.map((item) =>
              item === view || (saved.id && item.id === saved.id) ? saved : item,
            )
          : [saved, ...items];
      });
      this.selected.set(saved);
      this.drawer.set("closed");
      this.toast.show(this.i18n.t(creating ? "itemCreated" : "itemSaved"));
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleFavorite(): Promise<void> {
    const item = this.selected();
    if (!item) {
      return;
    }

    try {
      // Toggle on a copy so a failed write does not leave the cached item's star flipped.
      const view = cloneCipherView(item);
      view.favorite = !view.favorite;
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const saved = await this.cipherService.updateWithServer(view, userId);
      this.selected.set(saved);
      this.items.update((items) =>
        items.map((entry) =>
          entry === item || (saved.id && entry.id === saved.id) ? saved : entry,
        ),
      );
      this.toast.show(
        this.i18n.t(saved.favorite ? "itemAddedToFavorites" : "itemRemovedFromFavorites"),
      );
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    }
  }

  protected async archiveSelected(): Promise<void> {
    const item = this.selected();
    if (item) {
      await this.archiveItem(item);
    }
  }

  /** 删除确认里的「改用归档」退路：只收起条目，不进回收站。 */
  protected async archiveDeleteTarget(): Promise<void> {
    const item = this.deleteTarget();
    if (!item) {
      return;
    }
    this.deleteTarget.set(null);
    await this.archiveItem(item);
  }

  private async archiveItem(item: CipherView): Promise<void> {
    if (!item.id || !(await this.ensureReprompt(item))) {
      return;
    }

    // 归档只改条目自身的 archivedDate；不删除、不改历史，也不碰网络。
    // Archive a copy so a failed write leaves the cached item unarchived.
    const view = cloneCipherView(item);
    view.archivedDate = new Date();
    this.saving.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.updateWithServer(view, userId);
      this.items.update((items) => items.filter((entry) => entry.id !== item.id));
      if (this.selected() === item) {
        this.selected.set(null);
      }
      this.toast.show(this.i18n.t("itemArchiveToast"));
    } catch {
      this.toast.show(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }

  protected remove(): void {
    const item = this.selected();
    if (item) {
      this.deleteTarget.set(item);
    }
  }

  protected async confirmRemove(): Promise<void> {
    const item = this.deleteTarget();
    if (!item?.id) {
      return;
    }

    this.saving.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.softDeleteWithServer(item.id, userId);
      this.items.update((items) => items.filter((entry) => entry !== item));
      this.deleteTarget.set(null);
      if (this.selected() === item) {
        this.selected.set(null);
      }
      this.toast.showUndo(this.i18n.t("movedToTrash"), () => this.undoRemove(item), 5);
    } catch {
      this.toast.show(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }

  private async undoRemove(item: CipherView): Promise<void> {
    if (!item.id) {
      return;
    }

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.restoreWithServer(item.id, userId);
      const ciphers = await this.cipherService.getAllDecrypted(userId);
      this.items.set(ciphers.filter((cipher) => !cipher.isDeleted && !cipher.isArchived));
      this.toast.show(this.i18n.t("itemRestored"));
    } catch {
      this.toast.show(this.i18n.t("unexpectedError"));
    }
  }

  protected launch(uri: string): void {
    if (uri) {
      this.platformUtilsService.launchUri(uri);
    }
  }

  protected copyUsername(item: CipherView, event: Event): void {
    event.stopPropagation();
    void this.copyValue(item.login.username, this.i18n.t("username"));
  }

  protected async copyPassword(item: CipherView, event: Event): Promise<void> {
    event.stopPropagation();
    await this.copyValue(item.login.password, this.i18n.t("password"), undefined, true, item);
  }

  private async ensureReprompt(cipher: CipherView | null | undefined): Promise<boolean> {
    if (!cipher) {
      return false;
    }
    if (cipher.reprompt === CipherRepromptType.None) {
      return true;
    }
    const cipherId = cipher.id == null ? null : String(cipher.id);
    if (cipherId != null && this.repromptedCipherId() === cipherId) {
      return true;
    }
    const passed = await this.passwordRepromptService
      .passwordRepromptCheck(cipher)
      .catch(() => false);
    if (passed && cipherId != null) {
      this.repromptedCipherId.set(cipherId);
    }
    return passed;
  }

  protected async copyValue(
    value: string | null | undefined,
    label: string,
    flashKey?: string,
    protectedValue = false,
    cipher?: CipherView | null,
  ): Promise<void> {
    if (!value) {
      return;
    }
    if (protectedValue && !(await this.ensureReprompt(cipher ?? this.selected()))) {
      return;
    }
    // 走平台剪贴板服务，按设置自动清空；不把明文留在系统剪贴板历史里。
    this.platformUtilsService.copyToClipboard(value);
    const message = this.i18n.t("valueCopied", label);
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
    if (flashKey) {
      this.flash(flashKey);
    }
  }

  private flash(key: string): void {
    const previous = this.copiedTimer();
    if (previous) {
      clearTimeout(previous);
    }
    this.copiedKey.set(key);
    this.copiedTimer.set(setTimeout(() => this.copiedKey.set(""), 1300));
  }

  protected toggleReveal(label: string): void {
    const willReveal = !this.revealedLabels().has(label);
    this.revealedLabels.update((labels) => {
      const next = new Set(labels);
      if (willReveal) {
        next.add(label);
      } else {
        next.delete(label);
      }
      return next;
    });
    this.scheduleAutoHide(label, willReveal, () => {
      this.revealedLabels.update((labels) => {
        const next = new Set(labels);
        next.delete(label);
        return next;
      });
    });
  }

  private scheduleAutoHide(label: string, visible: boolean, hide: () => void): void {
    const existing = this.revealTimers.get(label);
    if (existing) {
      clearTimeout(existing);
      this.revealTimers.delete(label);
    }
    if (!visible || !this.autoHide()) {
      return;
    }
    const timer = setTimeout(() => {
      this.revealTimers.delete(label);
      hide();
    }, PASSWORD_AUTO_HIDE_MS);
    this.revealTimers.set(label, timer);
  }

  private clearRevealTimers(): void {
    for (const timer of this.revealTimers.values()) {
      clearTimeout(timer);
    }
    this.revealTimers.clear();
  }

  protected isCustomFieldRevealed(name: string | null | undefined): boolean {
    return this.revealedLabels().has(`cf:${name ?? ""}`);
  }

  protected toggleCustomFieldReveal(name: string | null | undefined): void {
    this.toggleReveal(`cf:${name ?? ""}`);
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected shortcutEnabled(id: DesktopShortcut): boolean {
    return !this.disabledShortcuts().has(id);
  }

  /** ⌘N 新建、⌘K 搜索、⌘E 编辑、⌘↵ 保存、⌘C/⇧⌘C 复制、⌘⌫ 删除、Esc 关闭、↑↓ 切换。 */
  protected onKeyDown(event: KeyboardEvent): void {
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (event.key === "Escape" && this.deleteTarget() != null) {
      event.preventDefault();
      this.deleteTarget.set(null);
      return;
    }

    if (
      meta &&
      event.key === "Enter" &&
      (this.drawer() === "edit" || this.drawer() === "new-form") &&
      !this.saving()
    ) {
      event.preventDefault();
      void this.save();
      return;
    }

    if (meta && key === "n") {
      event.preventDefault();
      if (this.shortcutEnabled(DesktopShortcut.Edit)) {
        this.openNew();
      }
      return;
    }

    // 搜索框里按方向键是在移动光标，不该把选中行抢走。
    const target = event.target as HTMLElement | null;
    const typing =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "SELECT" ||
      target?.isContentEditable === true;
    if (typing && event.key !== "Escape") {
      return;
    }

    if (event.key === "Escape" && this.drawer() !== "closed") {
      event.preventDefault();
      this.closeDrawer();
      return;
    }

    if (this.drawer() !== "closed" || this.deleteTarget() != null) {
      return;
    }

    const selected = this.selected();
    if (meta && key === "e") {
      if (selected && this.shortcutEnabled(DesktopShortcut.Edit)) {
        event.preventDefault();
        void this.startEdit();
      }
      return;
    }

    if (
      (event.key === "Delete" || (meta && event.key === "Backspace")) &&
      selected &&
      this.shortcutEnabled(DesktopShortcut.Delete)
    ) {
      event.preventDefault();
      this.remove();
      return;
    }

    if (meta && selected && this.shortcutEnabled(DesktopShortcut.Copy)) {
      if (event.shiftKey && key === "c" && selected.login.password) {
        event.preventDefault();
        void this.copyValue(
          selected.login.password,
          this.i18n.t("password"),
          undefined,
          true,
          selected,
        );
        return;
      }
      if (!event.shiftKey && key === "c" && selected.login.username) {
        event.preventDefault();
        void this.copyValue(selected.login.username, this.i18n.t("username"));
        return;
      }
    }

    if (
      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
      this.shortcutEnabled(DesktopShortcut.Nav)
    ) {
      const rows = this.isFiltering() ? this.rows() : [...this.favoriteRows(), ...this.otherRows()];
      if (!rows.length) {
        return;
      }
      event.preventDefault();
      const index = rows.findIndex((row) => row.item === selected);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = rows[(index + delta + rows.length) % rows.length];
      if (next) {
        void this.openView(next.item);
        setTimeout(() => {
          document
            .querySelector<HTMLElement>(`.agy-mac-row[data-cipher-id="${next.item.id}"]`)
            ?.scrollIntoView({ block: "nearest" });
        });
      }
    }
  }
}

function totpSecretOf(value: string): string {
  if (!value.toLowerCase().startsWith("otpauth://")) {
    return value;
  }
  try {
    return new URL(value).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function formatLongDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function joinParts(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => !!part).join(" · ");
}
