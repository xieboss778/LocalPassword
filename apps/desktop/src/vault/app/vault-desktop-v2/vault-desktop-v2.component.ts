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
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import {
  ButtonModule,
  DialogService,
  IconButtonModule,
  IconModule,
  IconTileComponent,
} from "@localpass/components";
import {
  applyCustomFields,
  applyFieldValues,
  fieldGroups,
  FIELDS,
  FieldSpec,
  FieldValues,
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
        <button
          type="button"
          bitButton
          buttonType="secondary"
          startIcon="bwi-import"
          (click)="go('/import')"
        >
          {{ i18n.t("importNoun") }}
        </button>
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

      <div class="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-px-7 tw-pb-4">
        <label
          class="tw-flex tw-h-10 tw-w-80 tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 focus-within:tw-border-border-brand"
        >
          <bit-icon name="bwi-search" class="tw-text-muted"></bit-icon>
          <input
            #searchInput
            type="search"
            class="tw-min-w-0 tw-flex-1 tw-border-0 tw-bg-transparent tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted"
            [attr.placeholder]="i18n.t('searchVault')"
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
            <option value="all">{{ i18n.t("allTypes") }}</option>
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
            <option value="all">{{ i18n.t("allFolders") }}</option>
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

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        @if (loading()) {
          <p class="tw-py-10 tw-text-center tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (!items().length) {
          <div class="tw-grid tw-min-h-80 tw-place-items-center">
            <lp-empty
              icon="bwi-vault"
              [title]="i18n.t('noItemsInVault')"
              [text]="i18n.t('emptyVaultHint')"
            >
              <button type="button" bitButton buttonType="primary" (click)="openNew()">
                {{ i18n.t("newItem") }}
              </button>
              <button type="button" bitButton buttonType="secondary" (click)="go('/import')">
                {{ i18n.t("importData") }}
              </button>
            </lp-empty>
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
                  <bit-icon-tile icon="bwi-folder" variant="brand" size="base"></bit-icon-tile>
                  <span class="tw-min-w-0">
                    <span class="tw-block tw-truncate tw-text-sm tw-font-semibold tw-text-main">{{
                      folder.name
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("items") + ": " + folder.count
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
            </div>

            @if (rows().length) {
              <div role="table" [attr.aria-label]="i18n.t('vault')">
                <div
                  role="row"
                  class="tw-grid tw-grid-cols-12 tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-bg-background-alt tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-text-muted"
                >
                  <div role="columnheader" class="tw-col-span-5 tw-ps-10">
                    {{ i18n.t("name") }}
                  </div>
                  <div role="columnheader" class="tw-col-span-2">{{ i18n.t("folder") }}</div>
                  <div role="columnheader" class="tw-col-span-2">{{ i18n.t("dateUpdated") }}</div>
                  <div role="columnheader" class="tw-col-span-1">{{ i18n.t("favorite") }}</div>
                  <div role="columnheader" class="tw-col-span-2 tw-text-end">
                    {{ i18n.t("options") }}
                  </div>
                </div>

                @for (row of rows(); track row.item) {
                  <div
                    role="row"
                    tabindex="0"
                    class="tw-group/row tw-grid tw-grid-cols-12 tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-3 tw-py-2 last:tw-border-b-0 tw-cursor-pointer hover:tw-bg-background-alt focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-offset-2 focus-visible:tw-outline-bg-brand"
                    [class.tw-bg-bg-brand-softer]="isSelected(row.item)"
                    (click)="openView(row.item)"
                    (keydown.enter)="openView(row.item)"
                  >
                    <div role="cell" class="tw-col-span-5 tw-flex tw-items-center tw-gap-3 tw-ps-7">
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
                          row.item.subTitle
                        }}</span>
                      </span>
                    </div>
                    <div role="cell" class="tw-col-span-2 tw-truncate tw-text-sm tw-text-muted">
                      {{ row.folder }}
                    </div>
                    <div role="cell" class="tw-col-span-2 tw-text-sm tw-text-muted">
                      {{ row.updated ? (row.updated | date: "mediumDate") : "—" }}
                    </div>
                    <div role="cell" class="tw-col-span-1">
                      @if (row.favorite) {
                        <bit-icon
                          name="bwi-star-filled"
                          class="tw-text-xs tw-text-fg-warning"
                        ></bit-icon>
                      }
                    </div>
                    <div
                      role="cell"
                      class="tw-col-span-2 tw-flex tw-justify-end tw-gap-1 tw-opacity-0 group-hover/row:tw-pointer-events-auto group-hover/row:tw-opacity-100 group-focus-within/row:tw-opacity-100"
                    >
                      <button
                        type="button"
                        bitIconButton="bwi-copy"
                        size="small"
                        [label]="i18n.t('copyValue')"
                        (click)="copyPrimary(row.item, $event)"
                      ></button>
                      <button
                        type="button"
                        bitIconButton="bwi-angle-right"
                        size="small"
                        [label]="i18n.t('viewItem')"
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
        <div class="tw-absolute tw-inset-0 tw-z-20" aria-hidden="true">
          <button
            type="button"
            class="tw-absolute tw-inset-0 tw-bg-bg-overlay"
            [attr.aria-label]="i18n.t('close')"
            (click)="closeDrawer()"
          ></button>
        </div>
        <aside
          class="tw-absolute tw-inset-y-0 tw-end-0 tw-z-30 tw-flex tw-w-full tw-max-w-2xl tw-flex-col tw-border-s tw-border-border-base tw-bg-background-alt tw-shadow-xl"
          [attr.aria-label]="drawerTitle()"
        >
          <div class="tw-flex tw-min-h-16 tw-items-center tw-gap-3 tw-px-6 tw-py-3">
            <div class="tw-min-w-0 tw-flex-1">
              <h2 class="tw-m-0 tw-text-lg tw-font-semibold tw-text-main">{{ drawerTitle() }}</h2>
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
                  <div class="tw-flex tw-items-center tw-gap-3 tw-py-2 tw-pb-4">
                    <lp-kind-tile [kind]="selectedKind()" size="lg"></lp-kind-tile>
                    <div class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-muted">
                      {{ kindLabel(selectedKind()) }} · {{ folderName(item) }}
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
                      }
                    </div>
                  </div>

                  @if (detailRows().length) {
                    <lp-group [label]="i18n.t('itemDetails')">
                      @for (row of detailRows(); track row.label) {
                        <lp-row
                          [label]="row.label"
                          [value]="row.display"
                          [copyValue]="row.copy"
                          [copyLabel]="row.label"
                          [mono]="row.mono"
                          [brand]="!!row.launchUri"
                        />
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

                  @if (item.notes) {
                    <lp-group [label]="i18n.t('notes')">
                      <lp-row
                        [label]="i18n.t('notes')"
                        [sub]="item.notes"
                        [clickable]="false"
                      ></lp-row>
                    </lp-group>
                  }

                  @if (customFields().length) {
                    <lp-group [label]="i18n.t('customFields')">
                      @for (field of customFields(); track field.name) {
                        <lp-row
                          [label]="field.name"
                          [value]="field.value"
                          [copyValue]="field.value"
                          [copyLabel]="field.name"
                        ></lp-row>
                      }
                    </lp-group>
                  }

                  <lp-group>
                    <lp-row
                      [label]="i18n.t('favorite')"
                      [toggle]="item.favorite"
                      [clickable]="true"
                      (activated)="toggleFavorite()"
                    ></lp-row>
                    <lp-row
                      [label]="i18n.t('dateCreated')"
                      [value]="item.creationDate | date: 'medium'"
                      [clickable]="false"
                    ></lp-row>
                    <lp-row
                      [label]="i18n.t('dateUpdated')"
                      [value]="item.revisionDate | date: 'medium'"
                      [clickable]="false"
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
                      class="tw-flex tw-items-start tw-gap-3 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-start hover:tw-border-border-brand hover:tw-bg-bg-brand-softer"
                      (click)="startNewForm(kind)"
                    >
                      <lp-kind-tile [kind]="kind" size="base"></lp-kind-tile>
                      <span class="tw-min-w-0">
                        <span class="tw-block tw-text-sm tw-font-semibold tw-text-main">{{
                          kindLabel(kind)
                        }}</span>
                        <span class="tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
                          kindBlurb(kind)
                        }}</span>
                      </span>
                    </button>
                  }
                </div>
                <div
                  class="tw-mt-3 tw-flex tw-items-start tw-gap-2 tw-rounded-lg tw-border tw-border-border-brand-soft tw-bg-bg-brand-softer tw-p-3 tw-text-sm tw-text-main"
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

          <div
            class="tw-flex tw-items-center tw-gap-2 tw-border-t tw-border-border-light tw-px-6 tw-py-4"
          >
            @switch (drawer()) {
              @case ("view") {
                <button type="button" bitButton buttonType="primary" (click)="startEdit()">
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
                <button
                  type="button"
                  bitButton
                  buttonType="secondary"
                  (click)="drawer.set('new-type')"
                >
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
        </aside>
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
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly kinds = ITEM_KIND_ORDER;
  protected readonly loading = signal(true);
  protected readonly query = signal("");
  protected readonly typeFilter = signal<"all" | ItemKind>("all");
  protected readonly folderFilter = signal("all");
  protected readonly favoritesOnly = signal(false);
  protected readonly items = signal<CipherView[]>([]);
  protected readonly folders = signal<FolderView[]>([]);
  protected readonly selected = signal<CipherView | null>(null);
  protected readonly drawer = signal<DrawerMode>("closed");
  protected readonly newKind = signal<ItemKind>(ItemKind.Login);
  protected readonly values = signal<FieldValues>({});
  protected readonly editFolderId = signal("");
  protected readonly editFavorite = signal(false);
  protected readonly editCustomFields = signal<readonly CustomFieldDraft[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>("searchInput");

  protected readonly subtitle = computed(
    () => `${this.items().length} ${this.i18n.t("items")} · ${this.i18n.t("localVault")}`,
  );

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
        folder: item.folderId ? (folderNames.get(item.folderId) ?? "") : this.i18n.t("noFolder"),
        favorite: item.favorite,
        updated: item.revisionDate ?? null,
      }));
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

  protected readonly detailRows = computed<DetailRowView[]>(() => {
    const item = this.selected();
    if (!item) {
      return [];
    }
    const kind = kindOf(item);
    const values = readFieldValues(item, kind);
    const result: DetailRowView[] = [];

    for (const spec of FIELDS[kind]) {
      if (spec.id === "name" || spec.id === "notes") {
        continue;
      }
      let raw = values[spec.id] ?? "";
      let display = raw;
      if (spec.target === "loginTotp") {
        display = this.formattedTotp();
        raw = this.totpCode();
      }
      if (!raw && !display) {
        continue;
      }
      result.push({
        label: this.i18n.t(spec.labelKey),
        display: spec.password ? MASK : display,
        copy: raw,
        mono: !!spec.password,
        launchUri: spec.target === "loginUri" ? raw : "",
      });
    }
    return result;
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
        return this.selected()?.name ?? this.i18n.t("edit");
      case "new-type":
        return this.i18n.t("newItem");
      case "new-form":
        return `${this.i18n.t("newItem")} · ${this.kindLabel(this.newKind())}`;
      default:
        return "";
    }
  });

  protected readonly drawerSub = computed(() => {
    switch (this.drawer()) {
      case "view":
      case "edit": {
        const item = this.selected();
        return item ? `${this.kindLabel(kindOf(item))} · ${this.folderName(item)}` : "";
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

  protected isSelected(item: CipherView): boolean {
    return this.selected() === item;
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
    this.errorMessage.set(null);
    this.drawer.set("view");
  }

  protected closeDrawer(): void {
    if (this.drawer() === "edit") {
      this.cancelEdit();
      return;
    }
    if (this.drawer() === "new-form") {
      this.drawer.set("new-type");
      return;
    }
    this.drawer.set("closed");
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

  protected async remove(): Promise<void> {
    const item = this.selected();
    if (!item?.id) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "deleteItemConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.softDeleteWithServer(item.id, userId);
      this.items.update((items) => items.filter((entry) => entry !== item));
      this.selected.set(null);
      this.drawer.set("closed");
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    }
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

function primaryValue(item: CipherView): string {
  const kind = kindOf(item);
  const values = readFieldValues(item, kind);
  const first = FIELDS[kind].find(
    (field) =>
      field.target !== "name" && field.target !== "notes" && !field.password && values[field.id],
  );
  return first ? values[first.id] : "";
}
