import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
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
import { ButtonModule, DialogService, IconButtonModule } from "@localpass/components";

import { VaultPopupItemsService } from "../../services/vault-popup-items.service";

const TYPE_EMOJI: Record<number, string> = {
  [CipherType.Login]: "🔐",
  [CipherType.SecureNote]: "📝",
  [CipherType.Card]: "💳",
  [CipherType.Identity]: "🪪",
  [CipherType.SshKey]: "🗝️",
};

/** 回收站（方向 C）：每行两个动作，清空需要二次确认。 */
@Component({
  selector: "trash-v2",
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
          >
          </lp-empty>
        } @else {
          <lp-group [label]="i18n.t('itemsInTrash')">
            @for (item of items(); track item.id) {
              <div
                class="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-[#0000000a] tw-px-3.5 tw-py-2.5 last:tw-border-b-0"
              >
                <span
                  class="tw-w-[26px] tw-flex-none tw-text-center tw-text-[15px]"
                  aria-hidden="true"
                >
                  {{ emojiFor(item) }}
                </span>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-truncate tw-text-[12.5px]">{{ item.name }}</span>
                  <span class="tw-block tw-text-[10.5px] tw-text-[var(--lp-ink-3)]">
                    {{ i18n.t("itemsInTrash") }}
                  </span>
                </span>
                <button
                  type="button"
                  bitButton
                  buttonType="secondary"
                  size="small"
                  (click)="restore(item.id)"
                >
                  {{ i18n.t("restore") }}
                </button>
                <button
                  type="button"
                  bitButton
                  buttonType="danger"
                  size="small"
                  (click)="purge(item.id)"
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
export class TrashV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly itemsService = inject(VaultPopupItemsService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);

  protected readonly items = toSignal(this.itemsService.deletedCiphers$, { initialValue: [] });
  protected readonly subtitle = signal("");

  protected emojiFor(item: unknown): string {
    const type = (item as { type?: CipherType }).type ?? CipherType.Login;
    return TYPE_EMOJI[type] ?? "📄";
  }

  protected async restore(rawId: unknown): Promise<void> {
    const id = rawId as string;
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.restoreWithServer(id, userId);
  }

  protected async purge(rawId: unknown): Promise<void> {
    const id = rawId as string;
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "deleteItemConfirmation" },
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
