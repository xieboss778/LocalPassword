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
import {
  ButtonModule,
  DialogService,
  IconButtonModule,
  IconModule,
  IconTileComponent,
} from "@localpass/components";
import { KeyService } from "@localpass/key-management";

import { JslibModule } from "../../jslib.module";
import { LpEmptyComponent, LpPageHeaderComponent, LpPopupHeaderComponent } from "../../local-ui";

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
    ButtonModule,
    IconButtonModule,
    IconModule,
    IconTileComponent,
    LpEmptyComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
  host: { class: "tw-block tw-h-full" },
  template: `
    <div
      class="tw-flex tw-h-full tw-flex-col"
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
              class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-fg-brand hover:tw-bg-bg-brand-softer"
              [attr.aria-label]="i18n.t('addFolder')"
              [attr.title]="i18n.t('addFolder')"
              (click)="startAdd()"
            >
              <bit-icon name="bwi-plus" class="tw-text-lg"></bit-icon>
            </button>
          </div>
        </lp-popup-header>
      } @else {
        <lp-page-header [title]="i18n.t('myFolders')" [sub]="subtitle()">
          <button
            type="button"
            bitButton
            buttonType="primary"
            startIcon="bwi-plus"
            (click)="startAdd()"
          >
            {{ i18n.t("addFolder") }}
          </button>
        </lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7"
        [class.tw-px-7]="!compact()"
        [class.tw-px-4]="compact()"
      >
        @if (editing()) {
          <div
            class="tw-mb-4 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
          >
            <label class="tw-block">
              <span class="tw-mb-1.5 tw-block tw-text-sm tw-font-medium tw-text-main">{{
                i18n.t("folderName")
              }}</span>
              <input
                type="text"
                class="tw-w-full tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-main tw-outline-none focus:tw-border-border-focus"
                [value]="draftName()"
                (input)="onNameInput($event)"
                (keydown.enter)="save()"
              />
            </label>
            @if (errorMessage()) {
              <p class="tw-mt-2 tw-text-sm tw-text-fg-danger">{{ errorMessage() }}</p>
            }
            <div class="tw-mt-3 tw-flex tw-gap-2">
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
            </div>
          </div>
        }

        @if (loading()) {
          <p class="tw-py-10 tw-text-center tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (!rows().length) {
          <div class="tw-grid tw-min-h-72 tw-place-items-center">
            <lp-empty
              icon="bwi-folder"
              [title]="i18n.t('youHaveNoFoldersV2')"
              [text]="i18n.t('emptyFoldersDescriptionV2')"
            >
              <button type="button" bitButton buttonType="primary" (click)="startAdd()">
                {{ i18n.t("addFolder") }}
              </button>
            </lp-empty>
          </div>
        } @else {
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-shadow-sm"
          >
            <div
              class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-4 tw-py-2.5"
            >
              <span class="tw-text-sm tw-font-semibold tw-text-main">{{ i18n.t("folders") }}</span>
              <span class="tw-text-xs tw-text-muted">{{ rows().length }}</span>
            </div>
            @for (row of rows(); track row.folder.id) {
              <div
                class="tw-group/row tw-grid tw-grid-cols-12 tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0 hover:tw-bg-background-alt"
              >
                <button
                  type="button"
                  class="tw-col-span-10 tw-flex tw-min-w-0 tw-items-center tw-gap-3 tw-border-0 tw-bg-transparent tw-p-0 tw-text-start"
                  (click)="openFolder(row.folder)"
                >
                  <bit-icon-tile icon="bwi-folder" variant="brand" size="base"></bit-icon-tile>
                  <span class="tw-min-w-0">
                    <span class="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-main">{{
                      row.folder.name
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted"
                      >{{ row.count }} {{ i18n.t("items") }}</span
                    >
                  </span>
                </button>
                <div class="tw-col-span-2 tw-flex tw-justify-end tw-gap-1">
                  <button
                    type="button"
                    bitIconButton="bwi-pencil-square"
                    size="small"
                    [label]="i18n.t('editFolder')"
                    (click)="startEdit(row.folder)"
                  ></button>
                  <button
                    type="button"
                    bitIconButton="bwi-trash"
                    size="small"
                    [label]="i18n.t('deleteFolder')"
                    (click)="remove(row.folder)"
                  ></button>
                </div>
              </div>
            }
          </div>
          <p class="tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
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
    void this.router.navigate(["/tabs/vault"], { queryParams: { folder: folder.id } });
  }

  private apply(folders: readonly FolderView[], ciphers: readonly CipherView[]): void {
    const visible = folders.filter((folder) => folder.id !== "");
    const counts = new Map<string, number>();
    for (const cipher of ciphers) {
      if (cipher.isDeleted || !cipher.folderId) {
        continue;
      }
      counts.set(cipher.folderId, (counts.get(cipher.folderId) ?? 0) + 1);
    }
    this.rows.set(visible.map((folder) => ({ folder, count: counts.get(folder.id) ?? 0 })));
    this.subtitle.set(`${visible.length} ${this.i18n.t("folders")}`);
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
