import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  ITEM_KIND_UI,
  LpEmptyComponent,
  LpKindTileComponent,
  LpPageHeaderComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, DialogService, IconButtonModule, IconModule } from "@localpass/components";
import { kindOf } from "@localpass/local-vault";

/** 回收站保留 30 天，删掉的条目会在这里展示删除时间。 */

/**
 * 桌面端回收站。
 *
 * 与弹窗版的差别只在数据来源：桌面端没有扩展的 `VaultPopupItemsService`，
 * 直接用 `cipherService.getAllDecrypted` 过滤软删除的条目。
 */
@Component({
  selector: "trash-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    JslibModule,
    ButtonModule,
    IconButtonModule,
    IconModule,
    LpEmptyComponent,
    LpKindTileComponent,
    LpPageHeaderComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header [title]="i18n.t('trash')" [sub]="subtitle()">
        @if (items().length) {
          <button
            type="button"
            bitButton
            buttonType="secondary"
            startIcon="bwi-trash"
            data-testid="trash_empty"
            (click)="emptyTrash()"
          >
            {{ i18n.t("emptyTrash") }}
          </button>
        }
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        @if (!loading() && items().length === 0) {
          <div class="tw-grid tw-min-h-72 tw-place-items-center">
            <lp-empty
              icon="bwi-trash"
              [title]="i18n.t('noItemsInTrash')"
              [text]="i18n.t('noItemsInTrashDesc')"
            ></lp-empty>
          </div>
        } @else if (items().length) {
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-shadow-sm"
          >
            <div
              class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-4 tw-py-2.5"
            >
              <span class="tw-text-sm tw-font-semibold tw-text-main">{{
                i18n.t("itemsInTrash")
              }}</span>
              <span class="tw-text-xs tw-text-muted">{{ items().length }}</span>
            </div>

            <div
              class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-bg-background-alt tw-px-4 tw-py-2 tw-text-xs tw-font-medium tw-text-muted"
            >
              <span class="tw-min-w-0 tw-flex-1">{{ i18n.t("name") }}</span>
              <span class="tw-w-44 tw-flex-none">{{ i18n.t("deletedAt") }}</span>
              <span class="tw-w-28 tw-flex-none tw-text-end">{{ i18n.t("actionColumn") }}</span>
            </div>

            @for (item of items(); track item) {
              <div
                class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0 hover:tw-bg-background-alt"
                data-testid="trash_row"
              >
                <div class="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-3">
                  <lp-kind-tile [kind]="kindOf(item)" size="base"></lp-kind-tile>
                  <span class="tw-min-w-0">
                    <span class="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-main">{{
                      item.name
                    }}</span>
                    <span class="tw-block tw-truncate tw-text-xs tw-text-muted">{{
                      item.subTitle || kindLabel(item)
                    }}</span>
                  </span>
                </div>
                <div class="tw-w-44 tw-flex-none tw-text-sm tw-text-muted">
                  {{ deletedLabel(item) }}
                </div>
                <div class="tw-flex tw-w-28 tw-flex-none tw-items-center tw-justify-end tw-gap-1">
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    data-testid="trash_restore"
                    (click)="restore(item)"
                  >
                    {{ i18n.t("restore") }}
                  </button>
                  <button
                    type="button"
                    bitIconButton="bwi-trash"
                    size="small"
                    class="tw-text-danger"
                    [label]="i18n.t('deleteForever')"
                    data-testid="trash_delete_forever"
                    (click)="purge(item)"
                  ></button>
                </div>
              </div>
            }
          </div>
          <p class="tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
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
  private readonly toast = inject(LpToastService);

  protected readonly kindOf = kindOf;
  protected readonly loading = signal(true);
  protected readonly items = signal<CipherView[]>([]);

  protected readonly subtitle = computed(() => this.i18n.t("trashSummary", this.items().length));

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.loading.set(false);
  }

  protected kindLabel(item: CipherView): string {
    return this.i18n.t(ITEM_KIND_UI[kindOf(item)].labelKey);
  }

  /** 「删了多久 · 还剩几天」，与原型回收站的第二列一致。 */
  protected deletedLabel(item: CipherView): string {
    if (!item.deletedDate) {
      return "";
    }
    const days = Math.max(
      0,
      Math.floor((Date.now() - item.deletedDate.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const remaining = Math.max(0, 30 - days);
    const ago = days === 0 ? this.i18n.t("deletedToday") : this.i18n.t("daysAgo", String(days));
    return `${ago} · ${this.i18n.t("remainingDays", String(remaining))}`;
  }

  protected async restore(item: CipherView): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.restoreWithServer(item.id as string, userId);
    this.toast.show(this.i18n.t("restoredItem"));
    await this.reload();
  }

  protected async purge(item: CipherView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItemPermanently" },
      content: { key: "permanentlyDeleteItemConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.deleteWithServer(item.id as string, userId);
    this.toast.show(this.i18n.t("permanentlyDeletedItem"));
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
    this.toast.show(this.i18n.t("emptyTrash"));
    await this.reload();
  }

  private async reload(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await this.cipherService.getAllDecrypted(userId);
    this.items.set(ciphers.filter((cipher) => cipher.isDeleted));
  }
}
