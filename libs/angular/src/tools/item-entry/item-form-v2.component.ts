import { CommonModule, DatePipe, Location } from "@angular/common";
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
import { CipherRepromptType } from "@localpass/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@localpass/common/vault/models/view/fido2-credential.view";
import { DialogService, IconModule } from "@localpass/components";
import {
  applyCustomFields,
  applyFieldValues,
  DEFAULT_PASSWORD_OPTIONS,
  fieldGroups,
  FieldSpec,
  FieldValues,
  formatCardExpiryInput,
  generatePassword,
  isItemKind,
  ItemKind,
  kindOf,
  readCustomFields,
  readFieldValues,
  setKind,
} from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  CustomFieldDraft,
  ITEM_KIND_UI,
  LpCustomFieldsComponent,
  LpFieldComponent,
  LpFieldOption,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
  LpToastService,
  newCustomFieldDraft,
} from "../../local-ui";

/**
 * 新建 / 编辑表单。字段清单、分组与读写映射都在 `@localpass/local-vault` 的
 * `item-fields` 里，桌面端抽屉内联表单用的是同一份，不复制逻辑。
 *
 * 通行密钥不在表单里创建——它由网站的 WebAuthn 注册流程写入条目。表单只展示
 * 登记时间；浏览器扩展允许在这里删除，桌面端按产品要求只读。
 */
@Component({
  selector: "item-form-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-h-full",
    "(keydown)": "onKeydown($event)",
  },
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    IconModule,
    LpCustomFieldsComponent,
    LpFieldComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div
      class="agy tw-flex tw-h-full tw-flex-col"
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

      <div class="agy-ext-scroll">
        @for (group of groups(); track group.key) {
          <section class="tw-pb-2">
            <h2 class="agy-seclbl">{{ i18n.t(group.labelKey) }}</h2>
            <div class="agy-grp">
              @for (field of group.fields; track field.id) {
                <lp-field
                  layout="row"
                  [label]="i18n.t(field.labelKey)"
                  [placeholder]="placeholder(field)"
                  [password]="!!field.password"
                  [multiline]="!!field.multiline"
                  [mono]="isMono(field)"
                  [hint]="field.hintKey ? i18n.t(field.hintKey) : ''"
                  [actionIcon]="field.generate ? 'bwi-generate' : undefined"
                  [actionLabel]="i18n.t('generatePassword')"
                  [options]="optionsFor(field)"
                  [allowCustom]="!!field.allowCustom"
                  [maxlength]="field.maxLength ?? null"
                  [inputMode]="field.inputMode ?? ''"
                  [format]="field.id === 'expiry' ? formatExpiry : null"
                  [removable]="field.id !== 'name'"
                  [removeLabel]="i18n.t('remove')"
                  [value]="values()[field.id] ?? ''"
                  (valueChange)="setValue(field.id, $event)"
                  (actionTriggered)="generate(field.id)"
                  (removeTriggered)="hideField(field.id)"
                />
              }

              @if (group.key === "uri" && !showUri2()) {
                <button
                  type="button"
                  id="item-form_button_add_website"
                  class="agy-addrow"
                  (click)="uri2Visible.set(true)"
                >
                  <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
                  {{ i18n.t("addWebsite") }}
                </button>
              }

              @if (group.key === "item") {
                <lp-field
                  layout="row"
                  [label]="i18n.t('folder')"
                  [value]="folderId()"
                  [options]="folderOptions()"
                  (valueChange)="folderId.set($event)"
                ></lp-field>
                <lp-row
                  [label]="i18n.t('favorite')"
                  [sub]="i18n.t('favoriteHint')"
                  [toggle]="favorite()"
                  [clickable]="true"
                  (activated)="favorite.set(!favorite())"
                ></lp-row>
              }

              @if (group.key === "login" && showPasskeys()) {
                @for (credential of passkeys(); track credential.credentialId || $index) {
                  <div class="agy-ext-field tw-cursor-default">
                    <span class="agy-k">{{ i18n.t("typePasskey") }}</span>
                    <span class="agy-v">{{ formatPasskey(credential) }}</span>
                    <span>
                      @if (passkeysEditable()) {
                        <button
                          type="button"
                          class="agy-iconbtn agy-sm"
                          [attr.aria-label]="i18n.t('removePasskey')"
                          [attr.title]="i18n.t('removePasskey')"
                          (click)="removePasskey($index)"
                        >
                          <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
                        </button>
                      }
                    </span>
                  </div>
                }
              }

              @if (group.key === "options" && kind() === loginKind) {
                <lp-row
                  [label]="i18n.t('passwordReprompt')"
                  [toggle]="reprompt()"
                  [clickable]="true"
                  (activated)="reprompt.set(!reprompt())"
                ></lp-row>
              }
            </div>
          </section>
        }

        @if (hiddenFieldPills().length > 0) {
          <div class="tw-flex tw-flex-wrap tw-gap-1.5 tw-pb-2">
            @for (field of hiddenFieldPills(); track field.id) {
              <button type="button" class="agy-btn agy-sm" (click)="showField(field.id)">
                <bit-icon name="bwi-plus" class="tw-text-xs"></bit-icon>
                {{ i18n.t(field.labelKey) }}
              </button>
            }
          </div>
        }

        <lp-custom-fields [(fields)]="customFields"></lp-custom-fields>

        @if (errorMessage()) {
          <p class="agy-hint agy-hint-error tw-pt-2">{{ errorMessage() }}</p>
        }
      </div>

      <div class="agy-ext-foot">
        <button
          type="button"
          class="agy-btn agy-primary agy-lg tw-flex-1"
          [disabled]="saving()"
          (click)="save()"
        >
          {{ i18n.t("save") }}
        </button>
        <button type="button" class="agy-btn agy-lg tw-flex-1" (click)="cancel()">
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
  private readonly dialogService = inject(DialogService);
  private readonly datePipe = inject(DatePipe);
  private readonly toast = inject(LpToastService);

  protected readonly loginKind = ItemKind.Login;
  protected readonly noOptions: readonly LpFieldOption[] = [];
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly values = signal<FieldValues>({});
  protected readonly kind = signal<ItemKind>(ItemKind.Login);
  /** 默认只编辑一个网址；点「添加网站」或条目本来就有第二个网址时才展开第二行。 */
  protected readonly uri2Visible = signal(false);
  protected readonly showUri2 = computed(
    () => this.uri2Visible() || (this.values()["uri2"] ?? "") !== "",
  );
  protected readonly folderId = signal("");
  protected readonly favorite = signal(false);
  protected readonly reprompt = signal(false);
  protected readonly folders = signal<{ value: string; label: string }[]>([]);
  protected readonly sshKeyOptions = signal<readonly LpFieldOption[]>([]);
  protected readonly customFields = signal<readonly CustomFieldDraft[]>([]);
  protected readonly passkeys = signal<readonly Fido2CredentialView[]>([]);
  protected readonly formatExpiry = (value: string, deleting: boolean): string =>
    formatCardExpiryInput(value, { autoSlash: !deleting });
  /** 用户移除的默认字段；保存时这些字段的值已从 values 中清除。 */
  protected readonly hiddenFields = signal<ReadonlySet<string>>(new Set());
  protected readonly groups = computed(() => {
    const hidden = this.hiddenFields();
    const groups = fieldGroups(this.kind()).map((group) => ({
      ...group,
      fields: group.fields.filter((field) => {
        if (field.id === "name") {
          return true;
        }
        if (field.id === "uri2") {
          return this.showUri2();
        }
        return !hidden.has(field.id);
      }),
    }));
    // 分组本身还有附加行（添加网站 / 文件夹 / 通行密钥 / 重新验证），不能因字段空就整组消失。
    return groups.filter(
      (group) =>
        group.fields.length > 0 ||
        group.key === "uri" ||
        (group.key === "login" && this.showPasskeys()) ||
        (group.key === "options" && this.kind() === ItemKind.Login),
    );
  });
  protected readonly hiddenFieldPills = computed(() => {
    const hidden = this.hiddenFields();
    return fieldGroups(this.kind())
      .flatMap((group) => group.fields)
      .filter((field) => field.id !== "name" && field.id !== "uri2" && hidden.has(field.id));
  });
  protected readonly heading = computed(() =>
    this.i18n.t(this.isEditing() ? "editItem" : "newItem"),
  );
  protected readonly kindLabel = computed(() => this.i18n.t(ITEM_KIND_UI[this.kind()].labelKey));
  protected readonly folderOptions = computed(() => [
    { value: "", label: this.i18n.t("noFolder") },
    ...this.folders(),
  ]);
  protected readonly showPasskeys = computed(
    () => this.kind() === ItemKind.Login && this.passkeys().length > 0,
  );
  protected formatPasskey(credential: Fido2CredentialView): string {
    const created = this.datePipe.transform(credential.creationDate, "short") ?? "";
    const createdLabel = created ? `${this.i18n.t("dateCreated")} ${created}` : "";
    return [credential.rpId, credential.userName, createdLabel].filter(Boolean).join(" · ");
  }

  private readonly isEditing = signal(false);
  private readonly original = signal<CipherView | null>(null);

  /** 弹窗路由在 route.data 里标记 compact；桌面端保持无返回键的页头。 */
  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  /** 只有浏览器扩展允许删除通行密钥；桌面端按产品要求只读展示。 */
  protected readonly passkeysEditable = signal(
    this.route.snapshot.data["passkeysEditable"] === true,
  );

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

    const allCiphers = await this.cipherService.getAllDecrypted(userId);
    const sshKeys = allCiphers
      .filter((item) => !item.isDeleted && !item.isArchived && kindOf(item) === ItemKind.SshKey)
      .map((item) => ({ value: item.id, label: item.name }));
    this.sshKeyOptions.set([{ value: "", label: this.i18n.t("none") }, ...sshKeys]);

    const cipherId = params["cipherId"] as string | undefined;
    const cloneFrom = params["cloneFrom"] as string | undefined;
    const sourceId = cipherId ?? cloneFrom;
    if (!sourceId) {
      this.values.set({});
      this.collapseEmptyOptionalFields({});
      return;
    }

    const cipher = await this.cipherService.get(sourceId, userId);
    const view = await this.cipherService.decrypt(cipher, userId);
    // 克隆以「新建」对待：读完源条目的字段后不保留 original，保存时 createWithServer。
    this.original.set(cloneFrom ? null : view);
    this.isEditing.set(!cloneFrom);
    if (!isItemKind(kind)) {
      this.kind.set(kindOf(view));
    }
    const fieldValues = readFieldValues(view, this.kind());
    this.values.set(fieldValues);
    this.collapseEmptyOptionalFields(fieldValues);
    this.customFields.set(
      readCustomFields(view, this.kind()).map((field) =>
        newCustomFieldDraft(field.name, field.value, field.hidden),
      ),
    );
    this.passkeys.set(cloneFrom ? [] : (view.login?.fido2Credentials ?? []));
    this.folderId.set(view.folderId ?? "");
    this.favorite.set(view.favorite);
    this.reprompt.set(view.reprompt !== CipherRepromptType.None);
  }

  private collapseEmptyOptionalFields(values: FieldValues): void {
    const collapsed = new Set<string>();
    for (const group of fieldGroups(this.kind())) {
      for (const field of group.fields) {
        if (field.optional && field.id !== "uri2" && !(values[field.id] ?? "")) {
          collapsed.add(field.id);
        }
      }
    }
    this.hiddenFields.set(collapsed);
  }

  protected optionsFor(field: FieldSpec): readonly LpFieldOption[] {
    if (field.sshKeyRef) {
      return this.sshKeyOptions();
    }
    return field.options ?? this.noOptions;
  }

  /** 保存后去哪：默认弹窗列表或桌面端列表，调用方可通过 ?next=... 覆盖。 */
  private nextUrl(): string {
    const next = this.route.snapshot.queryParamMap.get("next");
    return next ?? (this.compact() ? "/tabs/vault" : "/vault");
  }

  protected setValue(id: string, value: string): void {
    if (id === "uri2") {
      // 清空时也保持这一行可见，否则光标会在输入过程中随字段一起消失。
      this.uri2Visible.set(true);
    }
    this.values.update((current) => ({
      ...current,
      [id]: value,
    }));
  }

  protected generate(id: string): void {
    this.setValue(id, generatePassword(DEFAULT_PASSWORD_OPTIONS));
  }

  /** 移除字段：先清值再隐藏，保存后对应字段即为空。 */
  protected hideField(id: string): void {
    if (id === "name") {
      return;
    }
    this.values.update((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (id === "uri2") {
      this.uri2Visible.set(false);
      return;
    }
    this.hiddenFields.update((current) => new Set([...current, id]));
  }

  protected showField(id: string): void {
    this.hiddenFields.update((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  protected isMono(field: FieldSpec): boolean {
    return (
      !!field.mono ||
      !!field.password ||
      !!field.multiline ||
      field.id === "expiry" ||
      field.target === "loginUsername" ||
      field.target === "loginUri" ||
      field.target === "loginUri2"
    );
  }

  /** 原型里的字段级 placeholder；字段定义在共享包里，界面文案留在这里。 */
  protected placeholder(field: FieldSpec): string {
    if (field.id === "expiry") {
      return "MM/YY";
    }
    const key = placeholderKey(this.kind(), field.id);
    return key ? this.i18n.t(key) : "";
  }

  protected async removePasskey(index: number): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deletePasskey" },
      content: { key: "deletePasskeyConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    this.passkeys.update((list) => list.filter((_, i) => i !== index));
    this.toast.show(this.i18n.t("passkeyRemoved"));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !this.saving()) {
      event.preventDefault();
      void this.save();
    }
  }

  protected cancel(): void {
    this.location.back();
  }

  protected async save(): Promise<void> {
    this.errorMessage.set(null);
    const name = (this.values()["name"] ?? "").trim();
    if (!name) {
      this.errorMessage.set(this.i18n.t("nameRequired"));
      return;
    }

    this.saving.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const view = this.original() ?? new CipherView();
      applyFieldValues(view, this.kind(), { ...this.values(), name });
      applyCustomFields(view, this.kind(), this.customFields());
      setKind(view, this.kind());
      view.folderId = this.folderId() || undefined;
      view.favorite = this.favorite();
      view.reprompt = this.reprompt() ? CipherRepromptType.Password : CipherRepromptType.None;
      view.login.fido2Credentials = [...this.passkeys()];

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

/** 字段 id → 原型里的占位文案；没有占位的字段留空。 */
const FIELD_PLACEHOLDERS: Readonly<Record<string, string>> = Object.freeze({
  name: "namePlaceholder",
  totp: "totpPlaceholder",
  service: "tokenServicePlaceholder",
  scope: "tokenScopePlaceholder",
  expires: "tokenExpiresPlaceholder",
  env: "tokenEnvPlaceholder",
  privateKey: "sshPrivateKeyPlaceholder",
  publicKey: "sshPublicKeyPlaceholder",
  protocol: "serverProtocolPlaceholder",
});

function placeholderKey(kind: ItemKind, fieldId: string): string | undefined {
  if (fieldId === "notes") {
    return kind === ItemKind.Note ? "notePlaceholder" : "notesPlaceholder";
  }
  return FIELD_PLACEHOLDERS[fieldId];
}
