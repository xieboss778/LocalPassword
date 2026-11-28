import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { filter, firstValueFrom, from, map, switchMap } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@localpass/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import { DialogService, IconModule } from "@localpass/components";
import { KeyService } from "@localpass/key-management";

import { JslibModule } from "../../jslib.module";
import { LpPageHeaderComponent, LpPopupHeaderComponent } from "../../local-ui";

interface FolderRow {
  readonly folder: FolderView;
  readonly count: number;
}

/**
 * 文件夹管理。文件夹只是本机组织方式，不参与加密；条目通过 `folderId` 关联，
 * 删除文件夹只删除目录本身，不会删除条目。
 */
@Component({
  selector: "folders-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    IconModule,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
  host: { class: "tw-block tw-h-full" },
  template: `
    <div
      class="agy tw-flex tw-h-full tw-flex-col"
      [class.tw-bg-background-alt]="!compact()"
      [class.tw-bg-background]="compact()"
    >
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('myFolders')"
          [sub]="subtitle()"
          [back]="true"
          (backTriggered)="back()"
        >
          <div slot="actions">
            <button
              type="button"
              class="agy-iconbtn tw-text-fg-brand"
              [attr.aria-label]="i18n.t('addFolder')"
              [attr.title]="i18n.t('addFolder')"
              (click)="startAdd()"
            >
              <bit-icon name="bwi-plus" class="tw-text-base"></bit-icon>
            </button>
          </div>
        </lp-popup-header>
      } @else {
        <lp-page-header [title]="i18n.t('myFolders')" [sub]="subtitle()">
          <button
            type="button"
            class="agy-btn agy-primary agy-sm"
            data-testid="folder_add"
            (click)="startAdd()"
          >
            <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
            {{ i18n.t("addFolder") }}
          </button>
        </lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7"
        [class.agy-ext-scroll]="compact()"
        [class.tw-px-7]="!compact()"
      >
        @if (editing()) {
          <div class="agy-grp tw-mb-2">
            <div class="agy-formrow">
              <label class="agy-ext-field tw-cursor-default">
                <span class="agy-k">{{ i18n.t("folderName") }}</span>
                <input
                  type="text"
                  class="agy-input"
                  [value]="draftName()"
                  (input)="onNameInput($event)"
                  (keydown.enter)="save()"
                />
                <span></span>
              </label>
            </div>
          </div>
          @if (errorMessage()) {
            <p class="agy-hint agy-hint-error">{{ errorMessage() }}</p>
          }
          <div class="tw-flex tw-gap-1.5 tw-pb-2">
            <button
              type="button"
              class="agy-btn agy-primary agy-lg tw-flex-1"
              [disabled]="saving()"
              (click)="save()"
            >
              {{ i18n.t("save") }}
            </button>
            <button type="button" class="agy-btn agy-lg tw-flex-1" (click)="cancelEdit()">
              {{ i18n.t("cancel") }}
            </button>
          </div>
        }

        @if (loading()) {
          <p class="tw-py-10 tw-text-center tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (!rows().length) {
          <div class="agy-empty">
            <span class="agy-empty-ico">
              <bit-icon name="bwi-folder" class="tw-text-lg"></bit-icon>
            </span>
            <h2 class="agy-empty-h">{{ i18n.t("youHaveNoFoldersV2") }}</h2>
            <p class="agy-empty-s">{{ i18n.t("emptyFoldersDescriptionV2") }}</p>
            <div class="agy-empty-act">
              <button type="button" class="agy-btn agy-primary agy-lg" (click)="startAdd()">
                {{ i18n.t("addFolder") }}
              </button>
            </div>
          </div>
        } @else {
          @if (compact()) {
            <div class="agy-grp tw-mb-2">
              <button type="button" class="agy-setrow" (click)="openAll()">
                <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                  <bit-icon name="bwi-grid" class="tw-text-xs"></bit-icon>
                </span>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k tw-block">{{ i18n.t("allItems") }}</span>
                  <span class="agy-d tw-block">{{ i18n.t("foldersAllItemsSub") }}</span>
                </span>
                <span class="agy-chip">{{ totalCount() }}</span>
              </button>
            </div>
          }

          @if (!compact()) {
            <div class="agy-folder-tiles">
              @for (row of rows(); track row.folder.id) {
                <button type="button" class="agy-folder-tile" (click)="openFolder(row.folder)">
                  <span class="agy-n">{{ row.count }}</span>
                  <span class="agy-l">{{ row.folder.name }}</span>
                </button>
              }
            </div>
          }

          <div class="agy-grp">
            @if (!compact()) {
              <div class="agy-grphead">
                {{ i18n.t("folders") }}
                <span class="agy-chip">{{ rows().length }}</span>
              </div>
            }
            @for (row of rows(); track row.folder.id) {
              <div class="agy-setrow" data-testid="folder_row">
                <button
                  type="button"
                  class="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-2 tw-text-start"
                  (click)="openFolder(row.folder)"
                >
                  <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                    <bit-icon name="bwi-folder" class="tw-text-xs"></bit-icon>
                  </span>
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="agy-k tw-block tw-truncate">{{ row.folder.name }}</span>
                    <span class="agy-d tw-block">
                      @if (compact()) {
                        {{ row.count }} {{ i18n.t("itemCountShort") }}
                      } @else {
                        {{ i18n.t("itemCount", row.count) }}
                      }
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  class="agy-iconbtn agy-sm"
                  [attr.aria-label]="i18n.t('editFolder')"
                  [attr.title]="i18n.t('editFolder')"
                  data-testid="folder_edit"
                  (click)="startEdit(row.folder)"
                >
                  <bit-icon name="bwi-pencil-square" class="tw-text-xs"></bit-icon>
                </button>
                <button
                  type="button"
                  class="agy-iconbtn agy-sm"
                  [attr.aria-label]="i18n.t('deleteFolder')"
                  [attr.title]="i18n.t('deleteFolder')"
                  data-testid="folder_delete"
                  (click)="remove(row.folder)"
                >
                  <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
                </button>
                <button
                  type="button"
                  class="agy-iconbtn agy-sm"
                  [attr.aria-label]="i18n.t('openFolder')"
                  [attr.title]="i18n.t('openFolder')"
                  data-testid="folder_open"
                  (click)="openFolder(row.folder)"
                >
                  <bit-icon name="bwi-angle-right" class="tw-text-xs"></bit-icon>
                </button>
              </div>
            }
          </div>
          <p class="agy-note" [class.tw-text-center]="compact()">
            {{ i18n.t("folderLocalOnlyNotice") }}
          </p>
        }
      </div>
    </div>
  `,
})
export class FoldersV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly folderService = inject(FolderService);
  private readonly folderApiService = inject(FolderApiServiceAbstraction);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly keyService = inject(KeyService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly draftName = signal("");
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly subtitle = signal("");
  protected readonly rows = signal<FolderRow[]>([]);
  protected readonly totalCount = signal(0);

  /** 弹窗路由在 route.data 里标记 compact；桌面端保持大号两栏布局。 */
  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);

  ngOnInit(): void {
    // `folderViews$` keeps emitting after local writes; stay subscribed so a save/delete
    // doesn't leave the list showing the pre-write snapshot.
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        filter((userId): userId is UserId => userId != null),
        switchMap((userId) =>
          this.folderService
            .folderViews$(userId)
            .pipe(
              switchMap((folders) =>
                from(this.cipherService.getAllDecrypted(userId)).pipe(
                  map((ciphers) => ({ folders, ciphers })),
                ),
              ),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ folders, ciphers }) => {
        this.apply(folders, ciphers);
        this.loading.set(false);
      });
  }

  protected startAdd(): void {
    this.editingId.set(null);
    this.draftName.set("");
    this.errorMessage.set(null);
    this.editing.set(true);
  }

  protected onNameInput(event: Event): void {
    this.draftName.set((event.target as HTMLInputElement).value);
  }

  protected startEdit(folder: FolderView): void {
    this.editingId.set(folder.id);
    this.draftName.set(folder.name);
    this.errorMessage.set(null);
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.editingId.set(null);
    this.draftName.set("");
    this.errorMessage.set(null);
  }

  protected async save(): Promise<void> {
    const name = this.draftName().trim();
    if (!name) {
      this.errorMessage.set(this.i18n.t("nameRequired"));
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const userId = await this.userId();
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      if (userKey == null) {
        this.errorMessage.set(this.i18n.t("unexpectedError"));
        return;
      }

      const folder = new FolderView();
      folder.id = this.editingId() ?? "";
      folder.name = name;
      await this.folderApiService.save(await this.folderService.encrypt(folder, userKey), userId);

      this.cancelEdit();
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(folder: FolderView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteFolder" },
      content: { key: "deleteFolderConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    try {
      const userId = await this.userId();
      await this.folderApiService.delete(folder.id, userId);
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    }
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected openFolder(folder: FolderView): void {
    const route = this.compact() ? "/tabs/vault" : "/vault";
    void this.router.navigate([route], { queryParams: { folder: folder.id } });
  }

  protected openAll(): void {
    void this.router.navigateByUrl("/tabs/vault");
  }

  private apply(folders: readonly FolderView[], ciphers: readonly CipherView[]): void {
    const visible = folders.filter((folder) => folder.id !== "");
    const activeCiphers = ciphers.filter((cipher) => !cipher.isDeleted && !cipher.isArchived);
    const counts = new Map<string, number>();
    for (const cipher of activeCiphers) {
      if (!cipher.folderId) {
        continue;
      }
      counts.set(cipher.folderId, (counts.get(cipher.folderId) ?? 0) + 1);
    }
    this.rows.set(visible.map((folder) => ({ folder, count: counts.get(folder.id) ?? 0 })));
    this.totalCount.set(activeCiphers.length);
    this.subtitle.set(this.i18n.t("folderCount", visible.length));
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
