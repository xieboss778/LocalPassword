import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpEmptyComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherType } from "@localpass/common/vault/enums";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, DialogService, IconButtonModule } from "@localpass/components";

const TYPE_EMOJI: Record<number, string> = {
  [CipherType.Login]: "🔐",
  [CipherType.SecureNote]: "📝",
  [CipherType.Card]: "💳",
  [CipherType.Identity]: "🪪",
  [CipherType.SshKey]: "🗝️",
};

/**
 * 桌面端回收站（方向 C）。
 *
 * 与弹窗版的差别只在数据来源：桌面端没有扩展的 `VaultPopupItemsService`，
 * 直接用 `cipherService.getAllDecrypted` 过滤软删除的条目。
 */
@Component({
  selector: "trash-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    LpEmptyComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header [title]="i18n.t('trash')" [sub]="subtitle()">
        @if (items().length) {
          <button
            type="button"
            bitIconButton="bwi-trash"
            [label]="i18n.t('emptyTrash')"
            (click)="emptyTrash()"
          ></button>
        }
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @if (items().length === 0) {
          <lp-empty
            icon="🗑️"
            [title]="i18n.t('noItemsInTrash')"
            [text]="i18n.t('noItemsInTrashDesc')"
          ></lp-empty>
        } @else {
          <lp-group [label]="i18n.t('itemsInTrash')">
            @for (item of items(); track item.id) {
              <div
                class="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-[#0000000a] tw-px-3.5 tw-py-2.5 last:tw-border-b-0"
              >
                <span
                  class="tw-w-[26px] tw-flex-none tw-text-center tw-text-[15px]"
                  aria-hidden="true"
                  >{{ emojiFor(item) }}</span
                >
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-truncate tw-text-[12.5px]">{{ item.name }}</span>
                  <span class="tw-block tw-text-[10.5px] tw-text-[var(--lp-ink-3)]">{{
                    i18n.t("itemsInTrash")
                  }}</span>
                </span>
                <button
                  type="button"
                  bitButton
                  buttonType="secondary"
                  size="small"
                  (click)="restore(item)"
                >
                  {{ i18n.t("restore") }}
                </button>
                <button
                  type="button"
                  bitButton
                  buttonType="danger"
                  size="small"
                  (click)="purge(item)"
                >
                  {{ i18n.t("deleteForever") }}
                </button>
              </div>
            }
          </lp-group>

          <p class="tw-px-4 tw-pt-3 tw-text-[10.5px] tw-leading-relaxed tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("trashWarning") }}
          </p>
        }
      </div>
    </div>
  `,
})
export class TrashDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);

  protected readonly items = signal<CipherView[]>([]);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected subtitle(): string {
    return `${this.items().length} ` + this.i18n.t("items");
  }

  protected emojiFor(item: CipherView): string {
    return TYPE_EMOJI[item.type] ?? "📄";
  }

  protected async restore(item: CipherView): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.restoreWithServer(item.id as string, userId);
    await this.reload();
  }

  protected async purge(item: CipherView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "deleteItemConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.deleteWithServer(item.id as string, userId);
    await this.reload();
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
    await this.reload();
  }

  private async reload(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await this.cipherService.getAllDecrypted(userId);
    this.items.set(ciphers.filter((cipher) => cipher.isDeleted));
  }
}
