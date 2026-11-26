import { CommonModule, Location } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { ActivatedRoute, Params, Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, IconModule } from "@localpass/components";
import {
  applyFieldValues,
  FIELDS,
  FieldSpec,
  FieldValues,
  isItemKind,
  ItemKind,
  kindOf,
  readFieldValues,
  setKind,
} from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  ITEM_KIND_UI,
  LpFieldComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
} from "../../local-ui";

/**
 * 新建 / 编辑表单。字段清单与读写映射都在 `@localpass/local-vault` 的
 * `item-fields` 里，桌面端抽屉内联表单用的是同一份，不复制逻辑。
 */
@Component({
  selector: "item-form-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    IconModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div
      class="tw-flex tw-h-full tw-flex-col"
      [class.tw-bg-background-alt]="!compact()"
      [class.tw-bg-background]="compact()"
    >
      @if (compact()) {
        <lp-popup-header
          [title]="heading()"
          [sub]="kindLabel()"
          [back]="true"
          (backTriggered)="cancel()"
        ></lp-popup-header>
      } @else {
        <lp-page-header [title]="heading()" [sub]="kindLabel()" [compact]="true"></lp-page-header>
      }

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-4 tw-pb-6">
        <lp-field
          [label]="i18n.t('folder')"
          [value]="folderId()"
          [options]="folderOptions()"
          (valueChange)="folderId.set($event)"
        ></lp-field>

        <lp-group>
          @for (field of fields(); track field.id) {
            <lp-field
              [label]="i18n.t(field.labelKey)"
              [password]="!!field.password"
              [multiline]="!!field.multiline"
              [mono]="field.target === 'loginUsername'"
              [value]="values()[field.id] ?? ''"
              (valueChange)="setValue(field.id, $event)"
            />
          }
          <lp-row
            [label]="i18n.t('favorite')"
            [toggle]="favorite()"
            [clickable]="true"
            (activated)="favorite.set(!favorite())"
          ></lp-row>
        </lp-group>

        @if (errorMessage()) {
          <p class="tw-px-1 tw-pt-3 tw-text-sm tw-text-fg-danger">{{ errorMessage() }}</p>
        }
      </div>

      <div
        class="tw-flex tw-gap-2 tw-border-t tw-border-border-light tw-bg-background tw-px-4 tw-py-3"
      >
        <button
          type="button"
          bitButton
          buttonType="primary"
          class="tw-flex-1"
          [disabled]="saving()"
          (click)="save()"
        >
          {{ i18n.t("save") }}
        </button>
        <button type="button" bitButton buttonType="secondary" (click)="cancel()">
          {{ i18n.t("cancel") }}
        </button>
      </div>
    </div>
  `,
})
export class ItemFormV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly accountService = inject(AccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly values = signal<FieldValues>({});
  protected readonly kind = signal<ItemKind>(ItemKind.Login);
  protected readonly folderId = signal("");
  protected readonly favorite = signal(false);
  protected readonly folders = signal<{ value: string; label: string }[]>([]);

  protected readonly fields = computed<readonly FieldSpec[]>(() => FIELDS[this.kind()]);
  protected readonly heading = computed(() =>
    this.i18n.t(this.isEditing() ? "editItem" : "newItem"),
  );
  protected readonly kindLabel = computed(() => this.i18n.t(ITEM_KIND_UI[this.kind()].labelKey));
  protected readonly folderOptions = computed(() => [
    { value: "", label: this.i18n.t("noFolder") },
    ...this.folders(),
  ]);

  private readonly isEditing = signal(false);
  private readonly original = signal<CipherView | null>(null);

  /** 弹窗路由在 route.data 里标记 compact；桌面端保持无返回键的页头。 */
  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);

  async ngOnInit(): Promise<void> {
    const params: Params = await firstValueFrom(this.route.queryParams);
    const kind = params["kind"];
    if (isItemKind(kind)) {
      this.kind.set(kind);
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const folders = await firstValueFrom(this.folderService.folderViews$(userId));
    this.folders.set(
      folders
        .filter((folder) => folder.id !== "")
        .map((folder) => ({ value: folder.id, label: folder.name })),
    );

    const cipherId = params["cipherId"] as string | undefined;
    if (!cipherId) {
      this.values.set({});
      return;
    }

    const cipher = await this.cipherService.get(cipherId, userId);
    const view = await this.cipherService.decrypt(cipher, userId);
    this.original.set(view);
    this.isEditing.set(true);
    if (!isItemKind(kind)) {
      this.kind.set(kindOf(view));
    }
    this.values.set(readFieldValues(view, this.kind()));
    this.folderId.set(view.folderId ?? "");
    this.favorite.set(view.favorite);
  }

  /** 保存后去哪：默认弹窗列表，桌面端通过 ?next=... 指定自己的列表。 */
  private nextUrl(): string {
    const next = this.route.snapshot.queryParamMap.get("next");
    return next ?? "/vault-list-v2";
  }

  protected setValue(id: string, value: string): void {
    this.values.update((current) => ({ ...current, [id]: value }));
  }

  protected cancel(): void {
    this.location.back();
  }

  protected async save(): Promise<void> {
    this.errorMessage.set(null);
    this.saving.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const view = this.original() ?? new CipherView();
      applyFieldValues(view, this.kind(), this.values());
      setKind(view, this.kind());
      view.folderId = this.folderId() || undefined;
      view.favorite = this.favorite();

      if (this.original()) {
        await this.cipherService.updateWithServer(view, userId);
      } else {
        await this.cipherService.createWithServer(view, userId);
      }

      await this.router.navigateByUrl(this.nextUrl());
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }
}
