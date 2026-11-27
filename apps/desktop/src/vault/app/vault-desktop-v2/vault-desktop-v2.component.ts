import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { Router, RouterModule, ActivatedRoute } from "@angular/router";
import { firstValueFrom, of, switchMap } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  CustomFieldDraft,
  ITEM_KIND_ORDER,
  ITEM_KIND_UI,
  LpCustomFieldsComponent,
  LpEmptyComponent,
  LpFieldComponent,
  LpGroupComponent,
  LpKindTileComponent,
  LpPageHeaderComponent,
  LpRowComponent,
  LpToastService,
  newCustomFieldDraft,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService } from "@localpass/common/vault/abstractions/totp.service";
import { CipherRepromptType } from "@localpass/common/vault/enums/cipher-reprompt-type";
import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import {
  ButtonModule,
  IconButtonModule,
  IconModule,
  IconTileComponent,
} from "@localpass/components";
import {
  applyCustomFields,
  applyFieldValues,
  DEFAULT_PASSWORD_OPTIONS,
  fieldGroups,
  FIELD_SECTIONS,
  FIELDS,
  FieldSpec,
  FieldValues,
  generatePasswords,
  ItemKind,
  kindOf,
  readCustomFields,
  readFieldValues,
  setKind,
  withoutKindField,
} from "@localpass/local-vault";

type DrawerMode = "closed" | "view" | "edit" | "new-type" | "new-form";

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
  readonly launchUri: string;
  readonly totp: boolean;
  readonly secret: boolean;
}

interface DetailGroupView {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly DetailRowView[];
}

const MASK = "••••••••••••";

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
    RouterModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    IconModule,
    IconTileComponent,
    LpCustomFieldsComponent,
    LpEmptyComponent,
    LpFieldComponent,
    LpGroupComponent,
    LpKindTileComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  host: {
    class: "tw-block tw-h-full",
    "(document:keydown)": "onKeyDown($event)",
  },
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header [title]="i18n.t('vault')" [sub]="subtitle()">
        @if (items().length) {
          <button
            type="button"
            bitButton
            buttonType="secondary"
            startIcon="bwi-import"
            (click)="go('/import')"
          >
            {{ i18n.t("importNoun") }}
          </button>
        }
        <button
          type="button"
          bitButton
          buttonType="primary"
          startIcon="bwi-plus"
          (click)="openNew()"
        >
          {{ i18n.t("newItem") }}
          <span class="tw-ms-1 tw-text-xs tw-font-normal tw-opacity-70">&#8984;N</span>
        </button>
      </lp-page-header>

      @if (items().length || isFiltering()) {
        <div class="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-px-7 tw-pb-4">
          <label
            class="tw-flex tw-h-10 tw-w-80 tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 focus-within:tw-border-border-brand"
          >
            <bit-icon name="bwi-search" class="tw-text-muted"></bit-icon>
            <input
              #searchInput
              type="search"
              class="tw-min-w-0 tw-flex-1 tw-border-0 tw-bg-transparent tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted"
              [attr.placeholder]="i18n.t('searchVaultPlaceholder')"
              [attr.aria-label]="i18n.t('searchVault')"
              [value]="query()"
              (input)="onSearch($event)"
            />
            <kbd
              class="tw-rounded tw-border tw-border-border-light tw-bg-background-alt tw-px-1.5 tw-py-0.5 tw-text-xs tw-text-muted"
              >&#8984;K</kbd
            >
          </label>

          <label class="tw-relative">
            <select
              class="tw-h-10 tw-appearance-none tw-rounded-full tw-border tw-border-border-base tw-bg-background tw-py-0 tw-pe-8 tw-ps-4 tw-text-sm tw-text-main"
              [attr.aria-label]="i18n.t('type')"
              [value]="typeFilter()"
              (change)="onTypeFilter($event)"
            >
              <option value="all">{{ i18n.t("type") }}</option>
              @for (kind of kinds; track kind) {
                <option [value]="kind">{{ kindLabel(kind) }}</option>
              }
            </select>
            <bit-icon
              name="bwi-angle-down"
              class="tw-pointer-events-none tw-absolute tw-end-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-muted"
            ></bit-icon>
          </label>

          <label class="tw-relative">
            <select
              class="tw-h-10 tw-appearance-none tw-rounded-full tw-border tw-border-border-base tw-bg-background tw-py-0 tw-pe-8 tw-ps-4 tw-text-sm tw-text-main"
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
            <bit-icon
              name="bwi-angle-down"
              class="tw-pointer-events-none tw-absolute tw-end-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-muted"
            ></bit-icon>
          </label>

          <button
            type="button"
            class="tw-flex tw-h-10 tw-items-center tw-gap-1.5 tw-rounded-full tw-border tw-px-3 tw-text-sm"
            [class.tw-border-border-brand]="favoritesOnly()"
            [class.tw-bg-bg-brand-softer]="favoritesOnly()"
            [class.tw-text-fg-brand]="favoritesOnly()"
            [class.tw-border-border-base]="!favoritesOnly()"
            [class.tw-text-main]="!favoritesOnly()"
            [attr.aria-pressed]="favoritesOnly()"
            (click)="favoritesOnly.set(!favoritesOnly())"
          >
            <bit-icon name="bwi-star-filled" class="tw-text-xs"></bit-icon>
            {{ i18n.t("favorites") }}
          </button>

          @if (isFiltering()) {
            <button
              type="button"
              class="tw-h-10 tw-rounded-full tw-px-3 tw-text-sm tw-text-fg-brand hover:tw-bg-bg-brand-softer"
              (click)="clearFilters()"
            >
              {{ i18n.t("clearFilters") }}
            </button>
          }
        </div>
      }

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        @if (loading()) {
          <p class="tw-py-10 tw-text-center tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (!items().length) {
          <div class="tw-grid tw-min-h-80 tw-place-items-center">
            <div class="tw-flex tw-flex-col tw-items-center tw-px-4 tw-text-center">
              <span
                class="tw-grid tw-size-14 tw-place-items-center tw-rounded-full tw-bg-bg-brand-softer tw-text-fg-brand"
              >
                <bit-icon name="bwi-vault" class="tw-text-2xl"></bit-icon>
              </span>
              <h2 class="tw-mb-0 tw-mt-4 tw-text-lg tw-font-semibold tw-text-main">
                {{ i18n.t("noItemsInVault") }}
              </h2>
              <p class="tw-mb-0 tw-mt-1.5 tw-max-w-sm tw-text-sm tw-leading-relaxed tw-text-muted">
                {{ i18n.t("emptyVaultHintDesktop") }}
              </p>
              <div class="tw-mt-5 tw-flex tw-gap-2">
                <button
                  type="button"
                  bitButton
                  buttonType="primary"
                  startIcon="bwi-plus"
                  (click)="openNew()"
                >
                  {{ i18n.t("newItem") }}
                </button>
                <button
                  type="button"
                  bitButton
                  buttonType="secondary"
                  startIcon="bwi-import"
                  (click)="go('/import')"
                >
                  {{ i18n.t("importData") }}
                </button>
              </div>
            </div>
          </div>
        } @else {
          @if (!isFiltering() && folderCards().length) {
            <div
              class="tw-grid tw-grid-cols-2 tw-gap-3 tw-pb-5 lg:tw-grid-cols-4 xl:tw-grid-cols-5"
            >
              @for (folder of folderCards(); track folder.id) {
                <button
                  type="button"
                  class="tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-start tw-transition-shadow hover:tw-border-border-base hover:tw-shadow-sm"
                  (click)="folderFilter.set(folder.id)"
                >
                  <bit-icon-tile icon="bwi-folder" variant="brand" size="lg"></bit-icon-tile>
                  <span class="tw-min-w-0">
                    <span class="tw-block tw-truncate tw-text-sm tw-font-semibold tw-text-main">{{
                      folder.name
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("itemCount", folder.count)
                    }}</span>
                  </span>
                </button>
              }
            </div>
          }

          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-shadow-sm"
          >
            <div
              class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-4 tw-py-2.5"
            >
              <span class="tw-text-sm tw-font-semibold tw-text-main">{{
                isFiltering() ? i18n.t("filterResults", rows().length) : i18n.t("allItems")
              }}</span>
              <span class="tw-text-xs tw-text-muted"
                >{{ rows().length }} / {{ items().length }}</span
              >
              <span class="tw-flex-1"></span>
              <button
                type="button"
                bitIconButton="bwi-numbered-list"
                size="small"
                [label]="i18n.t('sort')"
                [attr.aria-pressed]="sortAscending()"
                (click)="toggleSort()"
              ></button>
            </div>

            @if (rows().length) {
              <div role="table" [attr.aria-label]="i18n.t('vault')">
                <div
                  role="row"
                  class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-bg-background-alt tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-text-muted"
                >
                  <div role="columnheader" class="tw-flex tw-w-8 tw-justify-center">
                    <input
                      type="checkbox"
                      class="tw-size-4"
                      [attr.aria-label]="i18n.t('selectAllItems')"
                      [checked]="allSelected()"
                      (change)="toggleSelectAll($event)"
                    />
                  </div>
                  <div role="columnheader" class="tw-min-w-0 tw-flex-1">
                    {{ i18n.t("name") }}
                  </div>
                  <div role="columnheader" class="tw-w-32 tw-ps-2">{{ i18n.t("folder") }}</div>
                  <div role="columnheader" class="tw-w-32">{{ i18n.t("modifiedTime") }}</div>
                  <div role="columnheader" class="tw-w-8 tw-text-center">
                    {{ i18n.t("favorite") }}
                  </div>
                  <div role="columnheader" class="tw-w-20 tw-text-end">
                    {{ i18n.t("options") }}
                  </div>
                </div>

                @for (row of rows(); track row.item) {
                  <div
                    role="row"
                    tabindex="0"
                    data-testid="vault_row"
                    class="tw-group/row tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-3 tw-py-2 last:tw-border-b-0 tw-cursor-pointer hover:tw-bg-background-alt focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-offset-2 focus-visible:tw-outline-bg-brand"
                    [class.tw-bg-bg-brand-softer]="isSelected(row.item)"
                    (click)="openView(row.item)"
                    (keydown.enter)="openView(row.item)"
                  >
                    <div role="cell" class="tw-flex tw-w-8 tw-justify-center">
                      <input
                        type="checkbox"
                        class="tw-size-4"
                        data-testid="vault_row_checkbox"
                        [attr.aria-label]="i18n.t('selectItem', row.item.name)"
                        [checked]="isChecked(row.item)"
                        (click)="$event.stopPropagation()"
                        (change)="toggleSelect(row.item, $event)"
                      />
                    </div>
                    <div role="cell" class="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-3">
                      <lp-kind-tile [kind]="row.kind" size="base"></lp-kind-tile>
                      <span class="tw-min-w-0">
                        <span class="tw-flex tw-items-center tw-gap-1">
                          <span class="tw-truncate tw-text-sm tw-font-medium tw-text-main">{{
                            row.item.name
                          }}</span>
                          @if (row.favorite) {
                            <bit-icon
                              name="bwi-star-filled"
                              class="tw-text-xs tw-text-fg-warning"
                            ></bit-icon>
                          }
                        </span>
                        <span class="tw-block tw-truncate tw-text-xs tw-text-muted">{{
                          row.sub
                        }}</span>
                      </span>
                    </div>
                    <div role="cell" class="tw-w-32 tw-truncate tw-ps-2 tw-text-sm tw-text-muted">
                      {{ row.folder }}
                    </div>
                    <div role="cell" class="tw-w-32 tw-text-sm tw-text-muted">
                      {{ row.updated ? shortDate(row.updated) : "—" }}
                    </div>
                    <div role="cell" class="tw-flex tw-w-8 tw-justify-center">
                      @if (row.favorite) {
                        <bit-icon
                          name="bwi-star-filled"
                          class="tw-text-xs tw-text-fg-warning"
                        ></bit-icon>
                      }
                    </div>
                    <div
                      role="cell"
                      class="tw-flex tw-w-20 tw-justify-end tw-gap-1 tw-opacity-0 group-hover/row:tw-pointer-events-auto group-hover/row:tw-opacity-100 group-focus-within/row:tw-opacity-100"
                    >
                      <button
                        type="button"
                        bitIconButton="bwi-copy"
                        size="small"
                        data-testid="vault_row_copy"
                        [label]="i18n.t('copyIdentifier')"
                        (click)="copyPrimary(row.item, $event)"
                      ></button>
                      <button
                        type="button"
                        bitIconButton="bwi-more-horizontal"
                        size="small"
                        data-testid="vault_row_open"
                        [label]="i18n.t('openItem')"
                        (click)="openView(row.item, $event)"
                      ></button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="tw-grid tw-place-items-center tw-py-16">
                <lp-empty
                  icon="bwi-search"
                  [title]="i18n.t('noSearchResults')"
                  [text]="i18n.t('clearFilters')"
                >
                  <button type="button" bitButton buttonType="secondary" (click)="clearFilters()">
                    {{ i18n.t("clearFilters") }}
                  </button>
                </lp-empty>
              </div>
            }
          </div>
        }
      </div>

      @if (drawer() !== "closed") {
        <aside
          class="tw-absolute tw-inset-y-0 tw-end-0 tw-z-30 tw-flex tw-max-w-full tw-flex-col tw-border-s tw-border-border-base tw-bg-background-alt tw-shadow-xl"
          [style.width.px]="640"
          [attr.aria-label]="drawerTitle()"
        >
          <div class="tw-flex tw-min-h-16 tw-items-center tw-gap-3 tw-px-6 tw-py-3">
            <div class="tw-min-w-0 tw-flex-1">
              <h2 class="tw-m-0 tw-text-xl tw-font-semibold tw-text-main">{{ drawerTitle() }}</h2>
              @if (drawerSub()) {
                <div class="tw-mt-0.5 tw-text-sm tw-text-muted">{{ drawerSub() }}</div>
              }
            </div>
            @if (drawer() === "view") {
              <button
                type="button"
                bitIconButton="bwi-pencil-square"
                [label]="i18n.t('edit')"
                (click)="startEdit()"
              ></button>
            }
            <button
              type="button"
              bitIconButton="bwi-close"
              [label]="i18n.t('close')"
              (click)="closeDrawer()"
            ></button>
          </div>

          <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-6 tw-pb-6">
            @switch (drawer()) {
              @case ("view") {
                @if (selected(); as item) {
                  <div class="tw-flex tw-items-center tw-gap-3 tw-pb-4 tw-pt-1">
                    <lp-kind-tile [kind]="selectedKind()" size="lg"></lp-kind-tile>
                    <div class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-muted">
                      {{ itemIdentity(item) }} · {{ folderName(item) }}
                    </div>
                    <div class="tw-flex tw-gap-1">
                      @if (item.login.username) {
                        <button
                          type="button"
                          bitIconButton="bwi-user"
                          [label]="i18n.t('copyUsername')"
                          (click)="copyValue(item.login.username, i18n.t('username'))"
                        ></button>
                      }
                      @if (item.login.password) {
                        <button
                          type="button"
                          bitIconButton="bwi-key"
                          [label]="i18n.t('copyPassword')"
                          (click)="copyValue(item.login.password, i18n.t('password'))"
                        ></button>
                      }
                      @if (primaryUri(item); as uri) {
                        <button
                          type="button"
                          bitIconButton="bwi-external-link"
                          [label]="i18n.t('openWebsite')"
                          (click)="launch(uri)"
                        ></button>
                      } @else if (selectedKind() !== ItemKind.Login && copyValueOf(item)) {
                        <button
                          type="button"
                          bitIconButton="bwi-copy"
                          [label]="i18n.t('copyIdentifier')"
                          (click)="copyValue(copyValueOf(item), kindLabel(selectedKind()))"
                        ></button>
                      }
                    </div>
                  </div>

                  @for (group of detailGroups(); track group.key) {
                    <lp-group [label]="group.label">
                      @for (row of group.rows; track row.label) {
                        @if (row.totp) {
                          <div
                            class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                          >
                            <span class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-main">{{
                              row.label
                            }}</span>
                            <span
                              class="tw-font-mono tw-text-lg tw-font-semibold tw-tracking-wide tw-text-fg-brand"
                              >{{ row.display }}</span
                            >
                            <span
                              class="tw-h-1.5 tw-w-10 tw-overflow-hidden tw-rounded-full tw-bg-border-light"
                              aria-hidden="true"
                            >
                              <span
                                class="tw-block tw-h-full tw-rounded-full tw-bg-fg-brand"
                                [style.width.%]="totpProgress()"
                              ></span>
                            </span>
                            <button
                              type="button"
                              bitIconButton="bwi-copy"
                              size="small"
                              [label]="row.label"
                              (click)="copyValue(row.copy, row.label)"
                            ></button>
                          </div>
                        } @else if (row.secret) {
                          <div
                            class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                          >
                            <span class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-main">{{
                              row.label
                            }}</span>
                            <span
                              class="tw-min-w-0 tw-truncate tw-font-mono tw-text-sm tw-text-main"
                              >{{ revealedLabels().has(row.label) ? row.copy : row.display }}</span
                            >
                            <button
                              type="button"
                              bitIconButton="bwi-eye"
                              size="small"
                              [label]="i18n.t('toggleVisibility')"
                              (click)="toggleReveal(row.label)"
                            ></button>
                            <button
                              type="button"
                              bitIconButton="bwi-copy"
                              size="small"
                              [label]="row.label"
                              (click)="copyValue(row.copy, row.label)"
                            ></button>
                          </div>
                        } @else {
                          <lp-row
                            [label]="row.label"
                            [value]="row.display"
                            [copyValue]="row.copy"
                            [copyLabel]="row.label"
                            [mono]="row.mono"
                            [brand]="!!row.launchUri"
                          />
                        }
                      }
                    </lp-group>
                  }

                  @if (passkeys().length) {
                    <lp-group [label]="i18n.t('passkeys')">
                      @for (passkey of passkeys(); track $index) {
                        <lp-row
                          [label]="passkey.userName || i18n.t('typePasskey')"
                          [value]="
                            i18n.t('dateCreated') + ' ' + (passkey.creationDate | date: 'short')
                          "
                          [clickable]="false"
                        ></lp-row>
                      }
                    </lp-group>
                  }

                  @if (customFields().length) {
                    <lp-group [label]="i18n.t('customFields')">
                      @for (field of customFields(); track field.name) {
                        <lp-row
                          [label]="field.name ?? ''"
                          [value]="fieldDisplay(field)"
                          [copyValue]="field.value ?? ''"
                          [copyLabel]="field.name ?? ''"
                        ></lp-row>
                      }
                    </lp-group>
                  }

                  @if (optionsRows().length) {
                    <lp-group [label]="i18n.t('additionalOptions')">
                      @for (row of optionsRows(); track row.label) {
                        <lp-row
                          [label]="row.label"
                          [sub]="row.display"
                          [copyValue]="row.copy"
                          [copyLabel]="row.label"
                          [clickable]="false"
                        ></lp-row>
                      }
                      @if (selectedKind() === ItemKind.Login) {
                        <lp-row
                          [label]="i18n.t('passwordReprompt')"
                          [value]="
                            item.reprompt === repromptType.Password
                              ? i18n.t('repromptOn')
                              : i18n.t('repromptOff')
                          "
                          [clickable]="false"
                        ></lp-row>
                      }
                    </lp-group>
                  }

                  <lp-group [label]="i18n.t('itemInfo')">
                    <div
                      class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3"
                    >
                      <span class="tw-flex-1 tw-text-sm tw-text-main">{{ i18n.t("folder") }}</span>
                      <span class="tw-text-sm tw-text-muted">{{ folderName(item) }}</span>
                    </div>
                    <div
                      class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3"
                    >
                      <span class="tw-flex-1 tw-text-sm tw-text-main">{{
                        i18n.t("lastModified")
                      }}</span>
                      <span class="tw-text-sm tw-text-muted">{{
                        longDate(item.revisionDate)
                      }}</span>
                    </div>
                    <div
                      class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3"
                    >
                      <span class="tw-flex-1 tw-text-sm tw-text-main">{{
                        i18n.t("dateCreated")
                      }}</span>
                      <span class="tw-text-sm tw-text-muted">{{
                        longDate(item.creationDate)
                      }}</span>
                    </div>
                    <lp-row
                      [label]="i18n.t('favorite')"
                      [toggle]="item.favorite"
                      [clickable]="true"
                      (activated)="toggleFavorite()"
                    ></lp-row>
                  </lp-group>
                }
              }

              @case ("edit") {
                @for (group of editGroups(); track group.key) {
                  <lp-group [label]="i18n.t(group.labelKey)">
                    @for (field of group.fields; track field.id) {
                      <lp-field
                        [label]="i18n.t(field.labelKey)"
                        [value]="values()[field.id] ?? ''"
                        [password]="!!field.password"
                        [multiline]="!!field.multiline"
                        [mono]="isMonoField(field)"
                        [hint]="field.hintKey ? i18n.t(field.hintKey) : ''"
                        [placeholder]="field.target === 'name' ? i18n.t('enterItemName') : ''"
                        [actionIcon]="field.generate ? 'bwi-generate' : undefined"
                        [actionLabel]="field.generate ? i18n.t('generatePassword') : ''"
                        (actionTriggered)="generateInto(field)"
                        (valueChange)="setValue(field.id, $event)"
                      ></lp-field>
                    }
                    @if (group.key === "item") {
                      <lp-field
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
                    }
                  </lp-group>
                }
                <lp-custom-fields [(fields)]="editCustomFields"></lp-custom-fields>
                @if (errorMessage()) {
                  <p class="tw-pt-3 tw-text-sm tw-text-fg-danger">{{ errorMessage() }}</p>
                }
              }

              @case ("new-type") {
                <div class="tw-grid tw-grid-cols-2 tw-gap-2 tw-pt-1">
                  @for (kind of kinds; track kind) {
                    <button
                      type="button"
                      class="tw-flex tw-flex-col tw-items-start tw-gap-1.5 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-start hover:tw-border-border-brand hover:tw-bg-bg-brand-softer"
                      (click)="startNewForm(kind)"
                    >
                      <lp-kind-tile [kind]="kind" size="base"></lp-kind-tile>
                      <span class="tw-text-sm tw-leading-tight tw-font-semibold tw-text-main">{{
                        kindLabel(kind)
                      }}</span>
                      <span class="tw-text-xs tw-leading-snug tw-text-muted">{{
                        kindBlurb(kind)
                      }}</span>
                    </button>
                  }
                </div>
                <div
                  class="tw-mt-3 tw-flex tw-items-start tw-gap-2.5 tw-rounded-lg tw-border tw-border-border-brand-soft tw-bg-bg-brand-softer tw-px-3.5 tw-py-3 tw-text-xs tw-leading-relaxed tw-text-muted"
                >
                  <bit-icon name="bwi-info-circle" class="tw-mt-0.5 tw-text-fg-brand"></bit-icon>
                  <span>{{ i18n.t("newItemKindNotice") }}</span>
                </div>
              }

              @case ("new-form") {
                @for (group of editGroups(); track group.key) {
                  <lp-group [label]="i18n.t(group.labelKey)">
                    @for (field of group.fields; track field.id) {
                      <lp-field
                        [label]="i18n.t(field.labelKey)"
                        [value]="values()[field.id] ?? ''"
                        [password]="!!field.password"
                        [multiline]="!!field.multiline"
                        [mono]="isMonoField(field)"
                        [hint]="field.hintKey ? i18n.t(field.hintKey) : ''"
                        [placeholder]="field.target === 'name' ? i18n.t('enterItemName') : ''"
                        [actionIcon]="field.generate ? 'bwi-generate' : undefined"
                        [actionLabel]="field.generate ? i18n.t('generatePassword') : ''"
                        (actionTriggered)="generateInto(field)"
                        (valueChange)="setValue(field.id, $event)"
                      ></lp-field>
                    }
                    @if (group.key === "item") {
                      <lp-field
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
                    }
                  </lp-group>
                }
                <lp-custom-fields [(fields)]="editCustomFields"></lp-custom-fields>
                @if (errorMessage()) {
                  <p class="tw-pt-3 tw-text-sm tw-text-fg-danger">{{ errorMessage() }}</p>
                }
              }
            }
          </div>

          @if (drawer() !== "new-type") {
            <div
              class="tw-flex tw-items-center tw-gap-2 tw-border-t tw-border-border-light tw-px-6 tw-py-4"
            >
              @switch (drawer()) {
                @case ("view") {
                  <button
                    type="button"
                    bitButton
                    buttonType="primary"
                    startIcon="bwi-pencil-square"
                    (click)="startEdit()"
                  >
                    {{ i18n.t("edit") }}
                  </button>
                  <button type="button" bitButton buttonType="secondary" (click)="closeDrawer()">
                    {{ i18n.t("close") }}
                  </button>
                  <span class="tw-flex-1"></span>
                  <button
                    type="button"
                    bitIconButton="bwi-trash"
                    buttonType="dangerGhost"
                    [label]="i18n.t('delete')"
                    data-testid="vault_drawer_delete"
                    (click)="remove()"
                  ></button>
                }
                @case ("edit") {
                  <button
                    type="button"
                    bitButton
                    buttonType="primary"
                    [disabled]="saving()"
                    (click)="save()"
                  >
                    {{ i18n.t("save") }}
                  </button>
                  <button type="button" bitButton buttonType="secondary" (click)="cancelEdit()">
                    {{ i18n.t("cancel") }}
                  </button>
                }
                @case ("new-form") {
                  <button
                    type="button"
                    bitButton
                    buttonType="primary"
                    [disabled]="saving()"
                    (click)="save()"
                  >
                    {{ i18n.t("save") }}
                  </button>
                  <button type="button" bitButton buttonType="secondary" (click)="closeDrawer()">
                    {{ i18n.t("cancel") }}
                  </button>
                }
                @default {
                  <button type="button" bitButton buttonType="secondary" (click)="closeDrawer()">
                    {{ i18n.t("close") }}
                  </button>
                }
              }
            </div>
          }
        </aside>
      }

      @if (deleteTarget(); as target) {
        <div
          class="tw-absolute tw-inset-0 tw-z-40 tw-grid tw-place-items-center tw-bg-bg-overlay tw-px-6"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="i18n.t('deleteItemDialogTitle')"
        >
          <div
            class="tw-w-full tw-max-w-md tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-shadow-xl"
          >
            <div class="tw-px-5 tw-pt-5 tw-text-lg tw-font-semibold tw-text-main">
              {{ i18n.t("deleteItemDialogTitle") }}
            </div>
            <div class="tw-px-5 tw-py-4 tw-text-sm tw-leading-relaxed tw-text-muted">
              {{ i18n.t("deleteItemDialogBody", target.name) }}
            </div>
            <div
              class="tw-flex tw-justify-end tw-gap-2 tw-border-t tw-border-border-light tw-px-5 tw-py-3"
            >
              <button
                type="button"
                bitButton
                buttonType="secondary"
                (click)="deleteTarget.set(null)"
              >
                {{ i18n.t("cancel") }}
              </button>
              <button
                type="button"
                bitButton
                buttonType="danger"
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
  private readonly folderService = inject(FolderService);
  private readonly totpService = inject(TotpService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toast = inject(LpToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly kinds = ITEM_KIND_ORDER;
  protected readonly ItemKind = ItemKind;
  protected readonly repromptType = CipherRepromptType;
  protected readonly loading = signal(true);
  protected readonly query = signal("");
  protected readonly typeFilter = signal<"all" | ItemKind>("all");
  protected readonly folderFilter = signal("all");
  protected readonly favoritesOnly = signal(false);
  protected readonly sortAscending = signal(false);
  protected readonly items = signal<CipherView[]>([]);
  protected readonly folders = signal<FolderView[]>([]);
  protected readonly selected = signal<CipherView | null>(null);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly deleteTarget = signal<CipherView | null>(null);
  protected readonly drawer = signal<DrawerMode>("closed");
  protected readonly newKind = signal<ItemKind>(ItemKind.Login);
  protected readonly values = signal<FieldValues>({});
  protected readonly editFolderId = signal("");
  protected readonly editFavorite = signal(false);
  protected readonly editCustomFields = signal<readonly CustomFieldDraft[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>("searchInput");

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

  protected readonly rows = computed<RowView[]>(() => {
    const query = this.query().trim().toLowerCase();
    const type = this.typeFilter();
    const folderFilter = this.folderFilter();
    const favoritesOnly = this.favoritesOnly();
    const folderNames = this.folderNames();

    return this.items()
      .filter((item) => {
        const kind = kindOf(item);
        if (type !== "all" && kind !== type) {
          return false;
        }
        if (folderFilter === "none" && item.folderId) {
          return false;
        }
        if (folderFilter !== "all" && folderFilter !== "none" && item.folderId !== folderFilter) {
          return false;
        }
        if (favoritesOnly && !item.favorite) {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = [
          item.name,
          item.login.username ?? "",
          item.subTitle ?? "",
          item.folderId ? (folderNames.get(item.folderId) ?? "") : "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
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

  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    const selected = this.selectedIds();
    return rows.length > 0 && rows.every((row) => row.item.id && selected.has(row.item.id));
  });

  protected readonly folderCards = computed(() =>
    this.folders().map((folder) => ({
      id: folder.id,
      name: folder.name,
      count: this.items().filter((item) => item.folderId === folder.id).length,
    })),
  );

  constructor() {
    // 筛选后条目不在列表里时，右侧抽屉不能继续展示它，否则列表与详情会各说各话。
    effect(() => {
      // 编辑中的草稿不能被筛选顺手关掉，先让用户自己保存或取消。
      if (this.drawer() !== "view") {
        return;
      }
      const selected = this.selected();
      if (!selected) {
        return;
      }
      if (this.rows().some((row) => row.item.id === selected.id)) {
        return;
      }
      this.selected.set(null);
      this.drawer.set("closed");
    });
  }

  protected readonly isFiltering = computed(
    () =>
      this.query().trim() !== "" ||
      this.typeFilter() !== "all" ||
      this.folderFilter() !== "all" ||
      this.favoritesOnly(),
  );

  protected readonly selectedKind = computed(() =>
    this.selected() ? kindOf(this.selected()!) : ItemKind.Login,
  );

  private readonly totpKey = computed(() => this.selected()?.login.totp ?? "");
  private readonly totpResponse = toSignal(
    toObservable(this.totpKey).pipe(
      switchMap((key) => (key ? this.totpService.getCode$(key) : of(null))),
      takeUntilDestroyed(),
    ),
    { initialValue: null },
  );
  protected readonly totpCode = computed(() => this.totpResponse()?.code ?? "");
  protected readonly formattedTotp = computed(() => {
    const code = this.totpCode();
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  });
  protected readonly totpProgress = computed(() => {
    // getCode$ re-emits every second, so reading Date.now() here is enough to tick the bar.
    const response = this.totpResponse();
    if (!response?.period) {
      return 0;
    }
    const elapsed = Math.floor(Date.now() / 1000) % response.period;
    return ((response.period - elapsed) / response.period) * 100;
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
        if (!raw) {
          continue;
        }
        rows.push({
          label: this.i18n.t(spec.labelKey),
          display: spec.password ? MASK : raw,
          copy: raw,
          mono: this.isMonoField(spec),
          launchUri: "",
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
        launchUri: "",
        totp: false,
        secret: false,
      }))
      .filter((row) => row.display);
  });

  protected readonly editGroups = computed(() =>
    fieldGroups(this.drawer() === "new-form" ? this.newKind() : this.selectedKind()),
  );

  protected readonly folderOptions = computed(() => [
    { value: "", label: this.i18n.t("noFolder") },
    ...this.folders().map((folder) => ({ value: folder.id, label: folder.name })),
  ]);

  protected readonly drawerTitle = computed(() => {
    switch (this.drawer()) {
      case "view":
        return this.selected()?.name ?? "";
      case "edit":
        return this.i18n.t("editKindTitle", this.kindLabel(this.selectedKind()));
      case "new-type":
        return this.i18n.t("newItem");
      case "new-form":
        return this.i18n.t("newKindTitle", this.kindLabel(this.newKind()));
      default:
        return "";
    }
  });

  protected readonly drawerSub = computed(() => {
    switch (this.drawer()) {
      case "view": {
        const item = this.selected();
        return item ? `${this.kindLabel(kindOf(item))} · ${this.folderName(item)}` : "";
      }
      case "edit": {
        return this.selected()?.name ?? "";
      }
      case "new-type":
        return this.i18n.t("newItemPickKind");
      case "new-form":
        return this.kindBlurb(this.newKind());
      default:
        return "";
    }
  });

  async ngOnInit(): Promise<void> {
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
      this.items.set(ciphers.filter((cipher) => !cipher.isDeleted));
      this.folders.set(folders.filter((folder) => folder.id !== ""));
    } finally {
      this.loading.set(false);
    }
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

  protected itemIdentity(item: CipherView): string {
    const identity = item.subTitle?.trim() || primaryValue(item);
    return identity || this.kindLabel(kindOf(item));
  }

  protected isSelected(item: CipherView): boolean {
    return this.selected() === item;
  }

  protected isChecked(item: CipherView): boolean {
    return !!item.id && this.selectedIds().has(item.id);
  }

  protected toggleSelect(item: CipherView, event: Event): void {
    if (!item.id) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(item.id);
    } else {
      next.delete(item.id);
    }
    this.selectedIds.set(next);
  }

  protected toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.set(
      checked
        ? new Set(
            this.rows()
              .map((row) => row.item.id)
              .filter((id): id is string => !!id),
          )
        : new Set(),
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

  protected onTypeFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.typeFilter.set(value === "all" ? "all" : (value as ItemKind));
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

  protected openView(item: CipherView, event?: Event): void {
    event?.stopPropagation();
    this.selected.set(item);
    this.revealedLabels.set(new Set());
    this.errorMessage.set(null);
    this.drawer.set("view");
  }

  protected closeDrawer(): void {
    if (this.drawer() === "edit") {
      this.cancelEdit();
      return;
    }
    this.drawer.set("closed");
    this.selected.set(null);
    this.revealedLabels.set(new Set());
    this.errorMessage.set(null);
  }

  protected openNew(): void {
    this.newKind.set(ItemKind.Login);
    this.values.set({});
    this.editFavorite.set(false);
    this.editCustomFields.set([]);
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
    this.editCustomFields.set([]);
    this.errorMessage.set(null);
    this.drawer.set("new-form");
  }

  protected startEdit(): void {
    const item = this.selected();
    if (!item) {
      return;
    }
    const kind = kindOf(item);
    this.values.set(readFieldValues(item, kind));
    this.editCustomFields.set(
      readCustomFields(item, kind).map((field) =>
        newCustomFieldDraft(field.name, field.value, field.hidden),
      ),
    );
    this.editFolderId.set(item.folderId ?? "");
    this.editFavorite.set(item.favorite);
    this.errorMessage.set(null);
    this.drawer.set("edit");
  }

  protected cancelEdit(): void {
    this.drawer.set(this.selected() ? "view" : "closed");
    this.errorMessage.set(null);
  }

  protected setValue(id: string, value: string): void {
    this.values.update((current) => ({ ...current, [id]: value }));
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

  protected fieldDisplay(field: { type: FieldType; value?: string | null }): string {
    return field.type === FieldType.Hidden ? MASK : (field.value ?? "");
  }

  protected isMonoField(field: FieldSpec): boolean {
    return (
      !!field.password ||
      !!field.multiline ||
      field.target === "loginUsername" ||
      field.target === "loginUri" ||
      field.target === "loginUri2"
    );
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const creating = this.drawer() === "new-form" || this.drawer() === "new-type";
      const kind = creating ? this.newKind() : this.selectedKind();
      const view = creating ? new CipherView() : this.selected();
      if (!view) {
        return;
      }

      applyFieldValues(view, kind, this.values());
      applyCustomFields(view, kind, this.editCustomFields());
      setKind(view, kind);
      view.folderId = this.editFolderId() || undefined;
      view.favorite = this.editFavorite();

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
      this.drawer.set("view");
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
      item.favorite = !item.favorite;
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const saved = await this.cipherService.updateWithServer(item, userId);
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

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.softDeleteWithServer(item.id, userId);
      this.items.update((items) => items.filter((entry) => entry !== item));
      const next = new Set(this.selectedIds());
      next.delete(item.id);
      this.selectedIds.set(next);
      this.deleteTarget.set(null);
      if (this.selected() === item) {
        this.selected.set(null);
        this.drawer.set("closed");
      }
      this.toast.show(this.i18n.t("movedToTrash"));
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    }
  }

  protected copyValueOf(item: CipherView): string {
    return primaryValue(item);
  }

  protected primaryUri(item: CipherView): string {
    return item.login?.uris?.[0]?.uri ?? "";
  }

  protected launch(uri: string): void {
    if (uri) {
      this.platformUtilsService.launchUri(uri);
    }
  }

  protected copyPrimary(item: CipherView, event: Event): void {
    event.stopPropagation();
    const value = item.login.password || item.login.username || primaryValue(item);
    if (value) {
      this.copyValue(value, this.i18n.t("value"));
    }
  }

  protected copyValue(value: string | null | undefined, label: string): void {
    if (!value) {
      return;
    }
    void navigator.clipboard?.writeText(value);
    this.toast.show(this.i18n.t("valueCopied", label));
  }

  protected toggleReveal(label: string): void {
    this.revealedLabels.update((labels) => {
      const next = new Set(labels);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  /** ⌘N 新建、⌘K 聚焦搜索、Esc 后退一层、↑↓ 在筛选结果里移动。 */
  protected onKeyDown(event: KeyboardEvent): void {
    const meta = event.metaKey || event.ctrlKey;

    if (meta && event.key.toLowerCase() === "n") {
      event.preventDefault();
      this.openNew();
      return;
    }

    if (meta && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.searchInput()?.nativeElement.focus();
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

    if (this.drawer() === "closed" && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      const rows = this.rows();
      if (!rows.length) {
        return;
      }
      event.preventDefault();
      const current = this.selected();
      const index = rows.findIndex((row) => row.item === current);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = rows[(index + delta + rows.length) % rows.length];
      if (next) {
        this.selected.set(next.item);
      }
    }
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

function primaryValue(item: CipherView): string {
  const kind = kindOf(item);
  const values = readFieldValues(item, kind);
  const first = FIELDS[kind].find(
    (field) =>
      field.target !== "name" && field.target !== "notes" && !field.password && values[field.id],
  );
  return first ? values[first.id] : "";
}

function joinParts(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => !!part).join(" · ");
}
