import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpEmptyComponent,
  LpKindTileComponent,
  LpPopupHeaderComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
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
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('trash')"
        [sub]="subtitle()"
        [back]="true"
        (backTriggered)="back()"
      >
        <div slot="actions">
          @if (items().length) {
            <button
              id="trash_button_empty"
              type="button"
              class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-fg-danger hover:tw-bg-bg-danger-soft"
              [attr.aria-label]="i18n.t('emptyTrash')"
              [attr.title]="i18n.t('emptyTrash')"
              (click)="emptyTrash()"
            >
              <bit-icon name="bwi-trash" class="tw-text-base"></bit-icon>
            </button>
          }
        </div>
      </lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        @if (items().length === 0) {
          <div class="tw-grid tw-min-h-72 tw-place-items-center">
            <lp-empty
              icon="bwi-trash"
              [title]="i18n.t('noItemsInTrash')"
              [text]="i18n.t('noItemsInTrashDesc')"
            ></lp-empty>
          </div>
        } @else {
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            @for (item of items(); track item.id) {
              <div
                class="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 last:tw-border-b-0"
              >
                <lp-kind-tile [kind]="kindFor(item)" size="sm"></lp-kind-tile>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-main">{{
                    item.name
                  }}</span>
                  <span class="tw-block tw-truncate tw-text-xs tw-text-muted">{{
                    deletedLabel(item)
                  }}</span>
                </span>
                <button
                  [attr.id]="'trash_button_restore-' + item.id"
                  type="button"
                  class="tw-grid tw-size-7 tw-place-items-center tw-rounded-md tw-text-muted hover:tw-bg-bg-hover hover:tw-text-main"
                  [attr.aria-label]="i18n.t('restore')"
                  [attr.title]="i18n.t('restore')"
                  (click)="restore(item.id)"
                >
                  <bit-icon name="bwi-undo" class="tw-text-base"></bit-icon>
                </button>
                <button
                  [attr.id]="'trash_button_purge-' + item.id"
                  type="button"
                  class="tw-grid tw-size-7 tw-place-items-center tw-rounded-md tw-text-muted hover:tw-bg-bg-danger-soft hover:tw-text-fg-danger"
                  [attr.aria-label]="i18n.t('deleteForever')"
                  [attr.title]="i18n.t('deleteForever')"
                  (click)="purge(item.id)"
                >
                  <bit-icon name="bwi-trash" class="tw-text-base"></bit-icon>
                </button>
              </div>
            }
          </div>
          <p class="tw-px-2.5 tw-pt-2 tw-text-center tw-text-xs tw-leading-relaxed tw-text-muted">
            {{ i18n.t("trashFootnote") }}
          </p>
        }
      </div>
    </div>
  `,
})
export class TrashV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly itemsService = inject(VaultPopupItemsService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly items = toSignal(this.itemsService.deletedCiphers$, { initialValue: [] });

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

  protected deletedLabel(item: PopupCipherViewLike): string {
    if (!item.deletedDate) {
      return "";
    }
    const date = item.deletedDate instanceof Date ? item.deletedDate : new Date(item.deletedDate);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    const daysLeft = Math.max(0, 30 - days);
    return `${this.i18n.t("deletedDaysAgo", String(days))} · ${this.i18n.t(
      "trashDaysLeft",
      String(daysLeft),
    )}`;
  }

  protected async restore(rawId: unknown): Promise<void> {
    const id = rawId as string;
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.restoreWithServer(id, userId);
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
  }
}
