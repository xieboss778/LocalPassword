import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { filter, firstValueFrom, switchMap } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpEmptyComponent,
  LpKindTileComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import { CipherViewLikeUtils } from "@localpass/common/vault/utils/cipher-view-like-utils";
import { DialogService, IconModule } from "@localpass/components";
import { ItemKind, kindOf } from "@localpass/local-vault";

import { VaultPopupItemsService } from "../../services/vault-popup-items.service";
import { PopupCipherViewLike } from "../../views/popup-cipher.view";

/** 回收站（弹窗）：每行恢复/永久删除，清空需要二次确认。 */
@Component({
  selector: "trash-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    JslibModule,
    IconModule,
    LpEmptyComponent,
    LpKindTileComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('trash')"
        [sub]="subtitle()"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="agy-ext-scroll">
        @if (items().length === 0) {
          <div class="tw-grid tw-min-h-72 tw-place-items-center">
            <lp-empty
              icon="bwi-trash"
              [title]="i18n.t('noItemsInTrash')"
              [text]="i18n.t('noItemsInTrashDesc')"
            ></lp-empty>
          </div>
        } @else {
          <div class="agy-grp">
            @for (item of items(); track item.id) {
              <div class="agy-setrow">
                <lp-kind-tile [kind]="kindFor(item)" size="sm"></lp-kind-tile>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k tw-block tw-truncate">{{ item.name }}</span>
                  <span class="agy-d tw-block tw-truncate">{{ rowSubtitle(item) }}</span>
                </span>
                @if (daysLeft(item); as left) {
                  <span class="agy-chip agy-warn">{{ i18n.t("trashDaysLeft", left) }}</span>
                }
                <button
                  [attr.id]="'trash_button_restore-' + item.id"
                  type="button"
                  class="agy-btn agy-primary agy-sm"
                  (click)="restore(item.id)"
                >
                  {{ i18n.t("restore") }}
                </button>
                <button
                  [attr.id]="'trash_button_purge-' + item.id"
                  type="button"
                  class="agy-iconbtn agy-sm tw-text-fg-danger"
                  [attr.aria-label]="i18n.t('deleteForever')"
                  [attr.title]="i18n.t('deleteForever')"
                  (click)="purge(item.id)"
                >
                  <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
                </button>
              </div>
            }
          </div>
          <p class="agy-hint tw-text-center">
            {{ i18n.t("trashFootnote") }}
          </p>
        }
      </div>

      @if (items().length) {
        <div class="agy-ext-foot">
          <button
            id="trash_button_empty"
            type="button"
            class="agy-btn agy-danger agy-lg tw-w-full"
            (click)="emptyTrash()"
          >
            <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
            {{ i18n.t("emptyTrash") }}
          </button>
        </div>
      }
    </div>
  `,
})
export class TrashV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly itemsService = inject(VaultPopupItemsService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(LpToastService);
  private readonly router = inject(Router);

  protected readonly items = toSignal(this.itemsService.deletedCiphers$, { initialValue: [] });
  private readonly folders = toSignal(
    this.accountService.activeAccount$.pipe(
      takeUntilDestroyed(),
      getUserId,
      filter((userId): userId is UserId => userId != null),
      switchMap((userId) => this.folderService.folderViews$(userId)),
    ),
    { initialValue: [] as FolderView[] },
  );

  protected readonly subtitle = computed(() => this.i18n.t("trashRetentionLocal"));

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  /**
   * 回收站的数据可能是完整 `CipherView`，也可能来自 SDK 的列表视图 —— 后者没有自定义字段，
   * 只有原生类型。有原生数字类型时走 `kindOf`（能读到 `lp:kind` 标记），否则按列表类型退回。
   */
  protected kindFor(item: PopupCipherViewLike): ItemKind {
    if (!CipherViewLikeUtils.isCipherListView(item)) {
      return kindOf(item);
    }

    // 列表视图没有自定义字段，读不到 `lp:kind` 标记，只能按 SDK 的原生类型回退。
    switch (CipherViewLikeUtils.getType(item)) {
      case CipherType.SecureNote:
        return ItemKind.Note;
      case CipherType.Card:
      case CipherType.BankAccount:
        return ItemKind.Card;
      case CipherType.Identity:
      case CipherType.Passport:
      case CipherType.DriversLicense:
        return ItemKind.Identity;
      case CipherType.SshKey:
        return ItemKind.SshKey;
      default:
        return ItemKind.Login;
    }
  }

  protected rowSubtitle(item: PopupCipherViewLike): string {
    const folder = item.folderId
      ? (this.folders().find((entry) => entry.id === String(item.folderId))?.name ?? "")
      : "";
    const deleted = this.deletedAgo(item);
    return [folder, deleted].filter(Boolean).join(" · ");
  }

  protected daysLeft(item: PopupCipherViewLike): number | null {
    if (!item.deletedDate) {
      return null;
    }
    const date = item.deletedDate instanceof Date ? item.deletedDate : new Date(item.deletedDate);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    return Math.max(0, 30 - days);
  }

  private deletedAgo(item: PopupCipherViewLike): string {
    if (!item.deletedDate) {
      return "";
    }
    const date = item.deletedDate instanceof Date ? item.deletedDate : new Date(item.deletedDate);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    return this.i18n.t("deletedDaysAgo", String(days));
  }

  protected async restore(rawId: unknown): Promise<void> {
    const id = rawId as string;
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.restoreWithServer(id, userId);
    this.toast.show(this.i18n.t("itemRestored"));
  }

  protected async purge(rawId: unknown): Promise<void> {
    const id = rawId as string;
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "permanentlyDeleteItem" },
      content: { key: "permanentlyDeleteItemConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.deleteWithServer(id, userId);
    this.toast.show(this.i18n.t("deleted"));
  }

  protected async emptyTrash(): Promise<void> {
    const ids = this.items()
      .map((item) => item.id)
      .filter((id): id is string => id != null);
    if (ids.length === 0) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "emptyTrash" },
      content: { key: "emptyTrashConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.deleteManyWithServer(ids, userId);
    this.toast.show(this.i18n.t("trashEmptied"));
  }
}
