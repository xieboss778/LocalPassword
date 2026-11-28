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
  LpKindTileComponent,
  LpPageHeaderComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import { DialogService, IconModule } from "@localpass/components";
import { TRASH_RETENTION_DAYS, kindOf } from "@localpass/local-vault";

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
  imports: [JslibModule, IconModule, LpKindTileComponent, LpPageHeaderComponent],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header [title]="i18n.t('trash')" [sub]="subtitle()">
        @if (items().length) {
          <button
            type="button"
            class="agy-btn agy-danger agy-sm"
            data-testid="trash_empty"
            (click)="emptyTrash()"
          >
            <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
            {{ i18n.t("emptyTrash") }}
          </button>
        }
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        @if (!loading() && items().length === 0) {
          <div class="agy-empty">
            <span class="agy-empty-ico">
              <bit-icon name="bwi-trash" class="tw-text-lg"></bit-icon>
            </span>
            <h2 class="agy-empty-h">{{ i18n.t("noItemsInTrash") }}</h2>
            <p class="agy-empty-s">{{ i18n.t("noItemsInTrashDesc") }}</p>
          </div>
        } @else if (items().length) {
          <div class="agy-grp">
            <div class="agy-grphead">
              {{ i18n.t("itemsInTrash") }}
              <span class="agy-chip">{{ items().length }}</span>
            </div>
            @for (item of items(); track item) {
              <div class="agy-setrow" data-testid="trash_row">
                <lp-kind-tile [kind]="kindOf(item)" size="sm"></lp-kind-tile>
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k tw-block tw-truncate">{{ item.name }}</span>
                  <span class="agy-d tw-block tw-truncate">{{ subtitleOf(item) }}</span>
                </div>
                <span class="agy-chip agy-warn tw-flex-none">{{ deletedLabel(item) }}</span>
                <button
                  type="button"
                  class="agy-btn agy-primary agy-sm"
                  data-testid="trash_restore"
                  (click)="restore(item)"
                >
                  {{ i18n.t("restore") }}
                </button>
                <button
                  type="button"
                  class="agy-iconbtn agy-sm tw-text-danger"
                  [attr.aria-label]="i18n.t('deleteForever')"
                  [attr.title]="i18n.t('deleteForever')"
                  data-testid="trash_delete_forever"
                  (click)="purge(item)"
                >
                  <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
                </button>
              </div>
            }
          </div>
          <p class="agy-note">{{ i18n.t("trashWarning") }}</p>
        }
      </div>
    </div>
  `,
})
export class TrashDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(LpToastService);

  protected readonly kindOf = kindOf;
  protected readonly loading = signal(true);
  protected readonly items = signal<CipherView[]>([]);
  private readonly folders = signal<FolderView[]>([]);
  private readonly folderNames = computed(() => {
    const map = new Map<string, string>();
    for (const folder of this.folders()) {
      if (folder.id) {
        map.set(folder.id, folder.name);
      }
    }
    return map;
  });

  protected readonly subtitle = computed(() => this.i18n.t("trashSummary", this.items().length));

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.loading.set(false);
  }

  protected kindLabel(item: CipherView): string {
    return this.i18n.t(ITEM_KIND_UI[kindOf(item)].labelKey);
  }

  protected subtitleOf(item: CipherView): string {
    const primary = item.subTitle || this.kindLabel(item);
    const folder = item.folderId ? this.folderNames().get(item.folderId) : undefined;
    return [primary, folder].filter(Boolean).join(" · ");
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
    const remaining = Math.max(0, TRASH_RETENTION_DAYS - days);
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
    this.toast.show(this.i18n.t("trashEmptied"));
    await this.reload();
  }

  private async reload(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const [ciphers, folders] = await Promise.all([
      this.cipherService.getAllDecrypted(userId),
      firstValueFrom(this.folderService.folderViews$(userId)),
    ]);
    this.items.set(ciphers.filter((cipher) => cipher.isDeleted));
    this.folders.set(folders);
  }
}
