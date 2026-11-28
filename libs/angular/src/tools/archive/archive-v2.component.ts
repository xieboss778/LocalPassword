import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { IconModule } from "@localpass/components";
import { ItemKind, kindOf, readFieldValues } from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  ITEM_KIND_UI,
  LpEmptyComponent,
  LpKindTileComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "../../local-ui";

/**
 * 已归档条目。归档只是把条目从默认检索与内联推荐中收起，不删除、不进回收站，
 * 也不会被 30 天清理；取消归档即可放回保险库。
 *
 * 归档状态写在条目自身的 `archivedDate` 上，随本机加密存储和 R2 快照一起走。
 */
@Component({
  selector: "archive-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    JslibModule,
    IconModule,
    LpEmptyComponent,
    LpKindTileComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div
      class="agy tw-flex tw-h-full tw-flex-col"
      [class.tw-bg-background-alt]="!compact()"
      [class.tw-bg-background]="compact()"
    >
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('archiveNoun')"
          [sub]="subtitle()"
          [back]="true"
          (backTriggered)="back()"
        ></lp-popup-header>
      } @else {
        <lp-page-header
          [title]="i18n.t('archiveNoun')"
          [sub]="subtitle()"
          [compact]="true"
        ></lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7"
        [class.agy-ext-scroll]="compact()"
        [class.tw-px-7]="!compact()"
      >
        @if (loading()) {
          <p class="tw-py-10 tw-text-center tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (!items().length) {
          @if (compact()) {
            <div class="tw-grid tw-min-h-72 tw-place-items-center">
              <lp-empty
                icon="bwi-archive"
                [title]="i18n.t('noItemsInArchive')"
                [text]="i18n.t('noItemsInArchiveDesc')"
              ></lp-empty>
            </div>
          } @else {
            <div class="agy-empty">
              <span class="agy-empty-ico">
                <bit-icon name="bwi-archive" class="tw-text-lg"></bit-icon>
              </span>
              <h2 class="agy-empty-h">{{ i18n.t("noItemsInArchive") }}</h2>
              <p class="agy-empty-s">{{ i18n.t("noItemsInArchiveDesc") }}</p>
            </div>
          }
        } @else {
          <div class="agy-callout tw-mb-2">
            <bit-icon name="bwi-archive" class="tw-text-xs tw-text-fg-brand"></bit-icon>
            <div>{{ i18n.t("archiveItemDialogContent") }}</div>
          </div>
          <div class="agy-grp">
            @if (!compact()) {
              <div class="agy-grphead">
                {{ i18n.t("itemsInArchive") }}
                <span class="agy-chip">{{ items().length }}</span>
              </div>
            }
            @for (item of items(); track item.id) {
              <div class="agy-setrow">
                <lp-kind-tile [kind]="kindOfItem(item)" size="sm"></lp-kind-tile>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k tw-block tw-truncate">{{ item.name }}</span>
                  <span class="agy-d tw-block tw-truncate">{{ archivedLabel(item) }}</span>
                </span>
                <button
                  type="button"
                  class="agy-btn agy-sm"
                  [attr.aria-label]="i18n.t('unArchive')"
                  (click)="unarchive(item)"
                >
                  {{ i18n.t("unArchive") }}
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ArchiveV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly toast = inject(LpToastService);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  protected readonly loading = signal(true);
  protected readonly items = signal<CipherView[]>([]);

  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });

  protected readonly subtitle = computed(() => {
    if (!this.items().length) {
      return "";
    }
    // 桌面页眉讲清归档的含义，数量和条目分组标题各出现一次；弹窗页眉直接给数量。
    return this.compact()
      ? `${this.i18n.t("itemsInArchive")} · ${this.items().length}`
      : this.i18n.t("archiveItemDialogContent");
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected kindOfItem(item: CipherView): ItemKind {
    return kindOf(item);
  }

  protected kindLabel(kind: ItemKind): string {
    return this.i18n.t(ITEM_KIND_UI[kind].labelKey);
  }

  /** 用户名（或类型摘要）· 类型 · 归档日期，都是条目自身已有的真实字段。 */
  protected archivedLabel(item: CipherView): string {
    const kind = kindOf(item);
    const values = readFieldValues(item, kind);
    const owner = ownerSummary(kind, values);
    const date = item.archivedDate;
    const archived =
      date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString(this.locale(), {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "";
    return [owner, this.kindLabel(kind), archived]
      .filter((part): part is string => !!part)
      .join(" · ");
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected async unarchive(item: CipherView): Promise<void> {
    const previous = item.archivedDate;
    item.archivedDate = undefined;
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.updateWithServer(item, userId);
      this.items.update((items) => items.filter((existing) => existing.id !== item.id));
      this.toast.show(this.i18n.t("itemUnarchivedToast"));
    } catch {
      item.archivedDate = previous;
      this.toast.show(this.i18n.t("unexpectedError"));
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const ciphers = await this.cipherService.getAllDecrypted(userId);
      this.items.set(
        ciphers
          .filter((cipher) => !cipher.isDeleted && cipher.isArchived)
          .sort((a, b) => (b.archivedDate?.getTime() ?? 0) - (a.archivedDate?.getTime() ?? 0)),
      );
    } catch {
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
function ownerSummary(kind: ItemKind, values: Record<string, string>): string {
  switch (kind) {
    case ItemKind.Login:
      return values.username ?? "";
    case ItemKind.Token:
      return values.service || values.accessKeyId || "";
    case ItemKind.SshKey:
      return values.fingerprint || values.algorithm || "";
    case ItemKind.License:
      return values.software || values.edition || "";
    case ItemKind.Card:
      return last4(values.number);
    case ItemKind.Identity:
      return [values.lastName, values.firstName].filter(Boolean).join("") || values.email || "";
    case ItemKind.Server:
      return values.host || "";
    case ItemKind.Note:
      return values.category || "";
  }
}

/** 卡片尾号只用于列表副标题，不展示完整卡号。 */
function last4(number: string | undefined): string {
  const digits = /(\d{4})\s*$/.exec(number ?? "")?.[1];
  return digits ? `•••• ${digits}` : "";
}
