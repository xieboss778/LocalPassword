import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  ITEM_KIND_UI,
  LpKindTileComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import {
  AUTOFILL_ID,
  COPY_PASSWORD_ID,
  COPY_VERIFICATION_CODE_ID,
} from "@localpass/common/autofill/constants";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService } from "@localpass/common/vault/abstractions/totp.service";
import { FieldType } from "@localpass/common/vault/enums";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@localpass/common/vault/models/view/fido2-credential.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";
import { DialogService, IconModule } from "@localpass/components";
import {
  FIELDS,
  FieldSpec,
  ItemKind,
  kindOf,
  readField,
  withoutKindField,
} from "@localpass/local-vault";
import { PasswordRepromptService } from "@localpass/vault";

import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";
import { VaultPopupAutofillService } from "../../services/vault-popup-autofill.service";

interface DetailRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly display: string;
  readonly secret: boolean;
  readonly revealed: boolean;
  readonly totp: boolean;
  readonly multiline: boolean;
  readonly mono: boolean;
  readonly uri: boolean;
}

interface DetailSection {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly DetailRow[];
}

interface CustomRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly display: string;
  readonly revealed: boolean;
}

const MASK = "••••••••••••";

/**
 * 条目详情（弹窗）。
 *
 * 字段来自 `FIELDS[kind]`，与新建/编辑表单共用一份定义；密码默认遮罩，
 * 动态口令按 30 秒刷新，复制统一走底部回执。删除进回收站，不做硬删除。
 */
@Component({
  selector: "vault-item-view-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [CommonModule, JslibModule, IconModule, LpKindTileComponent, LpPopupHeaderComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="cipher()?.name ?? ''"
        [sub]="headerSubtitle()"
        [back]="true"
        (backTriggered)="back()"
      >
        <div slot="actions" class="tw-flex tw-items-center tw-gap-0.5">
          <button
            type="button"
            class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
            [attr.aria-label]="i18n.t('editItem')"
            [attr.title]="i18n.t('editItem')"
            (click)="edit()"
          >
            <bit-icon name="bwi-pencil-square" class="tw-text-base"></bit-icon>
          </button>
          <button
            type="button"
            class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
            [attr.aria-label]="i18n.t('moreOptions')"
            [attr.title]="i18n.t('moreOptions')"
            (click)="sheetOpen.set(true)"
          >
            <bit-icon name="bwi-more-horizontal" class="tw-text-base"></bit-icon>
          </button>
        </div>
      </lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        @if (loading()) {
          <p class="tw-px-2 tw-py-6 tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (cipher(); as item) {
          <div class="tw-flex tw-items-center tw-gap-3 tw-px-0.5 tw-pt-1 tw-pb-3.5">
            <lp-kind-tile [kind]="kind()" size="lg"></lp-kind-tile>
            <div class="tw-min-w-0 tw-flex-1">
              <p class="tw-m-0 tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ item.subTitle || kindLabel() }}
                @if (folderName()) {
                  · {{ folderName() }}
                }
              </p>
            </div>
            <div class="tw-flex tw-flex-none tw-items-center tw-gap-0.5">
              @if (kind() === loginKind) {
                @if (item.login.username) {
                  <button
                    type="button"
                    class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
                    [attr.aria-label]="i18n.t('copyUsername')"
                    [attr.title]="i18n.t('copyUsername')"
                    (click)="copyValue(item.login.username, i18n.t('username'))"
                  >
                    <bit-icon name="bwi-user" class="tw-text-base"></bit-icon>
                  </button>
                }
                @if (item.login.password) {
                  <button
                    type="button"
                    class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
                    [attr.aria-label]="i18n.t('copyPassword')"
                    [attr.title]="i18n.t('copyPassword')"
                    (click)="copyValue(item.login.password, i18n.t('password'))"
                  >
                    <bit-icon name="bwi-key" class="tw-text-base"></bit-icon>
                  </button>
                }
                @if (primaryUri()) {
                  <button
                    type="button"
                    class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-fg-brand hover:tw-bg-bg-brand-softer"
                    [attr.aria-label]="i18n.t('openWebsite')"
                    [attr.title]="i18n.t('openWebsite')"
                    (click)="launch()"
                  >
                    <bit-icon name="bwi-external-link" class="tw-text-base"></bit-icon>
                  </button>
                }
              } @else if (item.subTitle) {
                <button
                  type="button"
                  class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
                  [attr.aria-label]="i18n.t('copy')"
                  [attr.title]="i18n.t('copy')"
                  (click)="copyValue(item.subTitle, kindLabel())"
                >
                  <bit-icon name="bwi-copy" class="tw-text-base"></bit-icon>
                </button>
              }
            </div>
          </div>

          @for (section of sections(); track section.key) {
            <section class="tw-pb-2.5">
              <h2
                class="tw-m-0 tw-flex tw-items-center tw-gap-1.5 tw-px-0.5 tw-pt-2.5 tw-pb-1.5 tw-text-xs tw-font-semibold tw-text-muted"
              >
                {{ section.label }}
              </h2>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                @for (row of section.rows; track row.id) {
                  <div
                    class="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-p-3 last:tw-border-b-0"
                    [class.tw-cursor-pointer]="!row.multiline"
                    [class.hover:tw-bg-background-alt]="!row.multiline"
                    [attr.role]="row.multiline ? null : 'button'"
                    [attr.tabindex]="row.multiline ? null : 0"
                    (click)="copyRow(row)"
                    (keydown.enter)="copyRow(row)"
                  >
                    <span class="tw-w-20 tw-flex-none tw-text-xs tw-text-muted">{{
                      row.label
                    }}</span>
                    @if (row.multiline) {
                      <span
                        class="tw-min-w-0 tw-flex-1 tw-whitespace-pre-wrap tw-break-words tw-text-sm tw-leading-relaxed tw-text-main"
                        [class.tw-font-mono]="row.mono"
                        >{{ row.display }}</span
                      >
                    } @else {
                      <span
                        class="tw-min-w-0 tw-flex-1 tw-break-words tw-text-sm tw-leading-relaxed"
                        [class.tw-font-mono]="row.mono"
                        [class.tw-text-fg-brand]="row.totp"
                        [class.tw-font-semibold]="row.totp"
                        [class.tw-text-main]="!row.totp"
                        >{{ row.display }}</span
                      >
                    }
                    <span class="tw-flex tw-flex-none tw-items-center tw-gap-1.5 tw-text-muted">
                      @if (row.totp && totpPeriod()) {
                        <span
                          class="tw-h-1 tw-w-10 tw-overflow-hidden tw-rounded-full tw-bg-background-alt"
                          aria-hidden="true"
                        >
                          <span
                            class="tw-block tw-h-full tw-rounded-full tw-bg-primary-600 tw-transition-all"
                            [style.width.%]="totpRemainingPercent()"
                          ></span>
                        </span>
                      }
                      @if (row.totp && hasTotpKey()) {
                        <button
                          type="button"
                          class="tw-grid tw-size-7 tw-place-items-center tw-rounded-md hover:tw-bg-bg-hover hover:tw-text-main"
                          [attr.aria-label]="i18n.t('totpQrSubtitle')"
                          [attr.title]="i18n.t('totpQrSubtitle')"
                          (click)="openTotpQr($event)"
                        >
                          <bit-icon name="bwi-camera" class="tw-text-base"></bit-icon>
                        </button>
                      }
                      @if (row.secret) {
                        <button
                          type="button"
                          class="tw-grid tw-size-7 tw-place-items-center tw-rounded-md hover:tw-bg-bg-hover hover:tw-text-main"
                          [attr.aria-label]="
                            row.revealed ? i18n.t('hideValue') : i18n.t('showValue')
                          "
                          [attr.title]="row.revealed ? i18n.t('hideValue') : i18n.t('showValue')"
                          (click)="toggleReveal($event, row.id)"
                        >
                          <bit-icon
                            [name]="row.revealed ? 'bwi-visibility-off' : 'bwi-visibility'"
                            class="tw-text-base"
                          ></bit-icon>
                        </button>
                      }
                      @if (row.uri) {
                        <button
                          type="button"
                          class="tw-grid tw-size-7 tw-place-items-center tw-rounded-md hover:tw-bg-bg-hover hover:tw-text-main"
                          [attr.aria-label]="i18n.t('openWebsite')"
                          [attr.title]="i18n.t('openWebsite')"
                          (click)="launchUri($event, row.value)"
                        >
                          <bit-icon name="bwi-external-link" class="tw-text-base"></bit-icon>
                        </button>
                      }
                      @if (row.multiline && row.value) {
                        <button
                          type="button"
                          class="tw-grid tw-size-7 tw-place-items-center tw-rounded-md hover:tw-bg-bg-hover hover:tw-text-main"
                          [attr.aria-label]="i18n.t('copy')"
                          [attr.title]="i18n.t('copy')"
                          (click)="copyMultiline($event, row)"
                        >
                          <bit-icon name="bwi-copy" class="tw-text-base"></bit-icon>
                        </button>
                      } @else if (!row.multiline) {
                        <bit-icon name="bwi-copy" class="tw-text-base"></bit-icon>
                      }
                    </span>
                  </div>
                }
              </div>
            </section>
          }

          @if (passkeys().length) {
            <section class="tw-pb-2.5">
              <h2
                class="tw-m-0 tw-flex tw-items-center tw-gap-1.5 tw-px-0.5 tw-pt-2.5 tw-pb-1.5 tw-text-xs tw-font-semibold tw-text-muted"
              >
                {{ i18n.t("passkeys") }}
              </h2>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                @for (passkey of passkeys(); track $index) {
                  <div
                    class="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-p-3 last:tw-border-b-0"
                  >
                    <bit-icon
                      name="bwi-passkey"
                      class="tw-flex-none tw-text-base tw-text-muted"
                    ></bit-icon>
                    <span class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-main"
                      >{{ passkey.userName ? passkey.userName + " · " : ""
                      }}{{ i18n.t("dateCreated") }} {{ passkey.creationDate | date: "short" }}</span
                    >
                  </div>
                }
              </div>
            </section>
          }

          @if (customFields().length) {
            <section class="tw-pb-2.5">
              <h2
                class="tw-m-0 tw-flex tw-items-center tw-gap-1.5 tw-px-0.5 tw-pt-2.5 tw-pb-1.5 tw-text-xs tw-font-semibold tw-text-muted"
              >
                {{ i18n.t("customFields") }}
              </h2>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                @for (field of customFields(); track field.id) {
                  <div
                    class="tw-flex tw-cursor-pointer tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-p-3 last:tw-border-b-0 hover:tw-bg-background-alt"
                    role="button"
                    tabindex="0"
                    (click)="copyValue(field.value, field.label)"
                    (keydown.enter)="copyValue(field.value, field.label)"
                  >
                    <span class="tw-w-20 tw-flex-none tw-text-xs tw-text-muted">{{
                      field.label
                    }}</span>
                    <span class="tw-min-w-0 tw-flex-1 tw-break-words tw-text-sm tw-text-main">{{
                      field.display
                    }}</span>
                    @if (field.display !== field.value) {
                      <button
                        type="button"
                        class="tw-grid tw-size-7 tw-place-items-center tw-rounded-md tw-text-muted hover:tw-bg-bg-hover hover:tw-text-main"
                        [attr.aria-label]="i18n.t('showValue')"
                        [attr.title]="i18n.t('showValue')"
                        (click)="toggleCustomReveal($event, field.id)"
                      >
                        <bit-icon name="bwi-visibility" class="tw-text-base"></bit-icon>
                      </button>
                    }
                    <bit-icon name="bwi-copy" class="tw-text-base tw-text-muted"></bit-icon>
                  </div>
                }
              </div>
            </section>
          }

          <section class="tw-pb-2.5">
            <h2
              class="tw-m-0 tw-flex tw-items-center tw-gap-1.5 tw-px-0.5 tw-pt-2.5 tw-pb-1.5 tw-text-xs tw-font-semibold tw-text-muted"
            >
              {{ i18n.t("itemInformation") }}
            </h2>
            <div
              class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
            >
              <div
                class="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-p-3"
              >
                <span class="tw-w-20 tw-flex-none tw-text-xs tw-text-muted">{{
                  i18n.t("folder")
                }}</span>
                <span class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-main">{{
                  folderName() || i18n.t("noFolder")
                }}</span>
              </div>
              <div class="tw-flex tw-items-center tw-gap-2.5 tw-p-3">
                <span class="tw-w-20 tw-flex-none tw-text-xs tw-text-muted">{{
                  i18n.t("lastModified")
                }}</span>
                <span class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-main">{{
                  item.revisionDate | date: "medium"
                }}</span>
              </div>
            </div>
          </section>
        }
      </div>
    </div>

    @if (sheetOpen()) {
      <div
        class="tw-fixed tw-inset-0 tw-z-40 tw-bg-bg-overlay"
        aria-hidden="true"
        (click)="sheetOpen.set(false)"
      ></div>
      <div
        class="tw-fixed tw-inset-x-0 tw-bottom-0 tw-z-50 tw-rounded-t-2xl tw-bg-background tw-p-4 tw-pt-2 tw-shadow-lg"
        role="dialog"
        [attr.aria-label]="i18n.t('moreOptions')"
        (click)="$event.stopPropagation()"
      >
        <div class="tw-mx-auto tw-mb-3 tw-h-1 tw-w-9 tw-rounded-full tw-bg-border-strong"></div>
        <div class="tw-pb-2 tw-text-sm tw-font-semibold tw-text-main">{{ cipher()?.name }}</div>
        <button
          type="button"
          class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-rounded-lg tw-px-2 tw-py-2.5 tw-text-start tw-text-sm tw-text-main hover:tw-bg-background-alt"
          (click)="edit()"
        >
          <bit-icon name="bwi-pencil-square" class="tw-w-5 tw-text-muted"></bit-icon>
          {{ i18n.t("edit") }}
        </button>
        <button
          type="button"
          class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-rounded-lg tw-px-2 tw-py-2.5 tw-text-start tw-text-sm tw-text-main hover:tw-bg-background-alt"
          (click)="clone()"
        >
          <bit-icon name="bwi-clone" class="tw-w-5 tw-text-muted"></bit-icon>
          {{ i18n.t("clone") }}
        </button>
        <button
          type="button"
          class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-rounded-lg tw-px-2 tw-py-2.5 tw-text-start tw-text-sm tw-text-main hover:tw-bg-background-alt"
          (click)="toggleFavorite()"
        >
          <bit-icon
            [name]="cipher()?.favorite ? 'bwi-star-filled' : 'bwi-star'"
            class="tw-w-5 tw-text-muted"
          ></bit-icon>
          {{ cipher()?.favorite ? i18n.t("removeFavorite") : i18n.t("favorite") }}
        </button>
        <button
          type="button"
          class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-rounded-lg tw-px-2 tw-py-2.5 tw-text-start tw-text-sm tw-text-fg-danger hover:tw-bg-bg-danger-soft"
          (click)="remove()"
        >
          <bit-icon name="bwi-trash" class="tw-w-5"></bit-icon>
          {{ i18n.t("moveToTrash") }}
        </button>
      </div>
    }
  `,
})
export class VaultItemViewV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly totpService = inject(TotpService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toast = inject(LpToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly vaultPopupAutofillService = inject(VaultPopupAutofillService);

  protected readonly loginKind = ItemKind.Login;
  protected readonly loading = signal(true);
  protected readonly cipher = signal<CipherView | null>(null);
  protected readonly folderName = signal("");
  protected readonly totpCode = signal("");
  protected readonly totpPeriod = signal(0);
  protected readonly totpRemaining = signal(0);
  protected readonly revealed = signal<Record<string, boolean>>({});
  protected readonly customRevealed = signal<Record<string, boolean>>({});
  protected readonly sheetOpen = signal(false);

  protected readonly kind = computed<ItemKind>(() => {
    const item = this.cipher();
    return item ? kindOf(item) : ItemKind.Login;
  });
  protected readonly kindLabel = computed(() => this.i18n.t(ITEM_KIND_UI[this.kind()].labelKey));
  protected readonly headerSubtitle = computed(() => {
    const folder = this.folderName();
    return [this.kindLabel(), folder].filter(Boolean).join(" · ");
  });
  protected readonly hasTotpKey = computed(() => !!this.cipher()?.login?.totp);
  protected readonly primaryUri = computed(() => {
    const item = this.cipher();
    return item ? readField(item, "loginUri") : "";
  });
  protected readonly formattedTotp = computed(() => {
    const code = this.totpCode();
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  });
  protected readonly totpRemainingPercent = computed(() => {
    const period = this.totpPeriod();
    return period ? Math.max(0, Math.min(100, (this.totpRemaining() / period) * 100)) : 0;
  });

  protected readonly sections = computed<readonly DetailSection[]>(() => {
    const item = this.cipher();
    if (!item) {
      return [];
    }

    const kind = this.kind();
    const specs = FIELDS[kind].filter(
      (field) => field.target !== "name" && field.target !== "notes",
    );
    const rows = specs
      .map((field) => this.toDetailRow(item, field))
      .filter((row) => row.value.length > 0);

    if (kind === ItemKind.Login) {
      const credentials = rows.filter((row) => row.id !== "uri");
      const uris = rows.filter((row) => row.id === "uri");
      const sections: DetailSection[] = [];
      if (credentials.length) {
        sections.push({
          key: "credentials",
          label: this.i18n.t("loginCredentials"),
          rows: credentials,
        });
      }
      if (uris.length) {
        sections.push({ key: "uris", label: this.i18n.t("autofillOptions"), rows: uris });
      }
      const notes = this.notesRow(item);
      if (notes) {
        sections.push({ key: "notes", label: this.i18n.t("notes"), rows: [notes] });
      }
      return sections;
    }

    const notes = this.notesRow(item);
    const sections: DetailSection[] = [];
    if (rows.length) {
      sections.push({
        key: "fields",
        label: this.i18n.t("itemDetails"),
        rows,
      });
    }
    if (notes) {
      sections.push({ key: "notes", label: this.i18n.t("notes"), rows: [notes] });
    }
    return sections;
  });

  protected readonly passkeys = computed<readonly Fido2CredentialView[]>(() => {
    const item = this.cipher();
    if (!item || this.kind() !== ItemKind.Login) {
      return [];
    }
    return item.login?.fido2Credentials ?? [];
  });

  protected readonly customFields = computed<readonly CustomRow[]>(() => {
    const item = this.cipher();
    if (!item) {
      return [];
    }
    const known = new Set(
      FIELDS[this.kind()]
        .map((field) => (typeof field.target === "object" ? field.target.custom : ""))
        .filter(Boolean),
    );
    return withoutKindField(item.fields)
      .filter((field) => !known.has(field.name ?? ""))
      .map((field) => this.toCustomRow(field));
  });

  async ngOnInit(): Promise<void> {
    const params: Params = await firstValueFrom(this.route.queryParams);
    const cipherId = params["cipherId"] as string | undefined;
    const action = params["action"] as string | undefined;
    if (!cipherId) {
      this.loading.set(false);
      return;
    }

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const cipher = await this.cipherService.get(cipherId, userId);
      const view = await this.cipherService.decrypt(cipher, userId);

      // The view reveals TOTP codes and lets secrets be copied, so a reprompted item stays
      // closed until the master password is confirmed — from the list and from an
      // inline-menu single-action popout alike.
      if (!(await this.passwordRepromptService.passwordRepromptCheck(view))) {
        await this.dismiss();
        return;
      }

      this.cipher.set(view);

      const folders = await firstValueFrom(this.folderService.folderViews$(userId));
      this.folderName.set(
        view.folderId ? (folders.find((folder) => folder.id === view.folderId)?.name ?? "") : "",
      );

      this.watchTotp(view);
      await this.runPopoutAction(view, action);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * A single-action popout opened by the inline menu or a context menu passes the action that
   * needed the master password. Run it once the prompt has passed, then leave.
   */
  private async runPopoutAction(view: CipherView, action: string | undefined): Promise<void> {
    switch (action) {
      case AUTOFILL_ID:
        await this.vaultPopupAutofillService.doAutofill(view, true, true);
        return;
      case COPY_PASSWORD_ID:
        if (view.login.password) {
          this.copyValue(view.login.password, this.i18n.t("password"));
          this.closePopoutAfterToast();
        }
        return;
      case COPY_VERIFICATION_CODE_ID:
        if (view.login.totp) {
          const totp = await firstValueFrom(this.totpService.getCode$(view.login.totp));
          this.copyValue(totp.code, this.i18n.t("verificationCode"));
          this.closePopoutAfterToast();
        }
        return;
    }
  }

  private async dismiss(): Promise<void> {
    if (BrowserPopupUtils.inPopout(window)) {
      await BrowserPopupUtils.closeCurrentPopupOrPopout(window);
      return;
    }
    this.back();
  }

  /** Leaves the copy toast visible for a moment before closing the single-action window. */
  private closePopoutAfterToast(): void {
    if (BrowserPopupUtils.inPopout(window)) {
      setTimeout(() => void BrowserPopupUtils.closeCurrentPopupOrPopout(window), 800);
    }
  }

  protected back(): void {
    if (BrowserPopupUtils.inPopout(window)) {
      void BrowserPopupUtils.closeCurrentPopupOrPopout(window);
      return;
    }
    void this.router.navigateByUrl("/tabs/vault");
  }

  protected edit(): void {
    const item = this.cipher();
    if (!item?.id) {
      return;
    }
    this.sheetOpen.set(false);
    void this.router.navigate(["/edit-item-v2"], {
      queryParams: {
        cipherId: item.id,
        kind: kindOf(item),
        next: `/view-cipher-v2?cipherId=${item.id}`,
      },
    });
  }

  protected clone(): void {
    const item = this.cipher();
    if (!item?.id) {
      return;
    }
    this.sheetOpen.set(false);
    void this.router.navigate(["/edit-item-v2"], {
      queryParams: {
        cloneFrom: item.id,
        kind: kindOf(item),
        next: "/tabs/vault",
      },
    });
  }

  protected openTotpQr(event: Event): void {
    event.stopPropagation();
    const id = this.cipher()?.id;
    if (id) {
      void this.router.navigate(["/totp-qr-v2"], { queryParams: { cipherId: id } });
    }
  }

  protected toggleReveal(event: Event, id: string): void {
    event.stopPropagation();
    this.revealed.update((current) => ({ ...current, [id]: !current[id] }));
  }

  protected toggleCustomReveal(event: Event, id: string): void {
    event.stopPropagation();
    this.customRevealed.update((current) => ({ ...current, [id]: !current[id] }));
  }

  protected copyRow(row: DetailRow): void {
    if (row.multiline || !row.value) {
      return;
    }
    this.copyValue(row.value, row.label);
  }

  /** 多行字段（公钥、备注）不整行触发，只允许点尾部复制按钮。 */
  protected copyMultiline(event: Event, row: DetailRow): void {
    event.stopPropagation();
    this.copyValue(row.value, row.label);
  }

  protected copyValue(value: string, label: string): void {
    if (!value) {
      return;
    }
    const copied = this.platformUtilsService.copyToClipboard(value, { window });
    if (copied !== false) {
      this.toast.show(this.i18n.t("copiedField", label));
    }
  }

  protected launch(): void {
    const uri = this.primaryUri();
    if (uri) {
      this.platformUtilsService.launchUri(uri);
    }
  }

  protected launchUri(event: Event, uri: string): void {
    event.stopPropagation();
    if (uri) {
      this.platformUtilsService.launchUri(uri);
    }
  }

  protected async toggleFavorite(): Promise<void> {
    const item = this.cipher();
    if (!item?.id) {
      return;
    }

    // `CipherView` 是类实例，展开成普通对象会丢掉 toSdkCipherView 等方法，
    // 加密时必然失败。直接改实例，失败再改回来。
    const previous = item.favorite;
    item.favorite = !previous;
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const updated = await this.cipherService.updateWithServer(item, userId);
      this.cipher.set(updated);
      this.sheetOpen.set(false);
      this.toast.show(this.i18n.t(updated.favorite ? "favoriteAdded" : "favoriteRemoved"));
    } catch {
      item.favorite = previous;
      this.toast.show(this.i18n.t("unexpectedError"));
    }
  }

  protected async remove(): Promise<void> {
    const item = this.cipher();
    if (!item?.id) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "deleteItemConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.softDeleteWithServer(item.id, userId);
    this.sheetOpen.set(false);
    this.toast.show(this.i18n.t("movedToTrash"));
    await this.router.navigateByUrl("/tabs/vault");
  }

  private watchTotp(view: CipherView): void {
    const key = view.login?.totp;
    if (!key) {
      return;
    }
    this.totpService
      .getCode$(key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.totpCode.set(response.code ?? "");
        const period = response.period || 30;
        const epoch = Math.floor(Date.now() / 1000);
        this.totpPeriod.set(period);
        this.totpRemaining.set(period - (epoch % period));
      });
  }

  private toDetailRow(item: CipherView, field: FieldSpec): DetailRow {
    const id = field.id;
    const value = readField(item, field.target);
    const totp = id === "totp";
    const secret = !!field.password;
    const revealed = !!this.revealed()[id];
    const display =
      totp && this.formattedTotp() ? this.formattedTotp() : secret && !revealed ? MASK : value;

    return {
      id,
      label: this.i18n.t(totp ? "verificationCodeTotp" : field.labelKey),
      value: totp ? this.totpCode() : value,
      display,
      secret,
      revealed,
      totp,
      multiline: !!field.multiline,
      mono: secret || id === "username" || id === "uri" || totp,
      uri: id === "uri",
    };
  }

  private notesRow(item: CipherView): DetailRow | null {
    if (!item.notes) {
      return null;
    }
    return {
      id: "notes",
      label: this.i18n.t("notes"),
      value: item.notes,
      display: item.notes,
      secret: false,
      revealed: true,
      totp: false,
      multiline: true,
      mono: false,
      uri: false,
    };
  }

  private toCustomRow(field: FieldView): CustomRow {
    const hidden = field.type === FieldType.Hidden;
    const name = field.name ?? "";
    const revealed = !!this.customRevealed()[name];
    return {
      id: name,
      label: name,
      value: field.value ?? "",
      display: hidden && !revealed ? MASK : (field.value ?? ""),
      revealed,
    };
  }
}
