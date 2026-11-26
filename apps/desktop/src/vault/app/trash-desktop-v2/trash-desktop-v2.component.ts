import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpEmptyComponent,
  LpKindTileComponent,
  LpPageHeaderComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, DialogService, IconButtonModule, IconModule } from "@localpass/components";
import { kindOf } from "@localpass/local-vault";

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
    CommonModule,
    RouterModule,
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
            @for (item of items(); track item) {
              <div
                class="tw-grid tw-grid-cols-12 tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0 hover:tw-bg-background-alt"
              >
                <div class="tw-col-span-7 tw-flex tw-min-w-0 tw-items-center tw-gap-3">
                  <lp-kind-tile [kind]="kindOf(item)" size="base"></lp-kind-tile>
                  <span class="tw-min-w-0">
                    <span class="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-main">{{
                      item.name
                    }}</span>
                    <span class="tw-block tw-truncate tw-text-xs tw-text-muted">{{
                      item.subTitle
                    }}</span>
                  </span>
                </div>
                <div class="tw-col-span-2 tw-text-sm tw-text-muted">
                  {{ item.deletedDate ? (item.deletedDate | date: "mediumDate") : "—" }}
                </div>
                <div class="tw-col-span-3 tw-flex tw-justify-end tw-gap-1">
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
                    bitIconButton="bwi-trash"
                    size="small"
                    [label]="i18n.t('deleteForever')"
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

  protected readonly kindOf = kindOf;
  protected readonly loading = signal(true);
  protected readonly items = signal<CipherView[]>([]);

  protected readonly subtitle = computed(
    () => `${this.items().length} ${this.i18n.t("items")} · ${this.i18n.t("trashHint")}`,
  );

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.loading.set(false);
  }

  protected async restore(item: CipherView): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.restoreWithServer(item.id as string, userId);
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
