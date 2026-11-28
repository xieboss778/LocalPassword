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
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  ITEM_KIND_UI,
  LpKindTileComponent,
  LpPasswordSyntaxComponent,
  LpPopupHeaderComponent,
  LpToastService,
  PASSWORD_AUTO_HIDE_MS,
  PasswordAutoHideService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import {
  AUTOFILL_ID,
  ClearClipboardDelay,
  COPY_PASSWORD_ID,
  COPY_VERIFICATION_CODE_ID,
} from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { ClearClipboardDelaySetting } from "@localpass/common/autofill/types";
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
  readonly hidden: boolean;
  readonly revealed: boolean;
}

const MASK = "••••••••••••";
const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * 条目详情（弹窗）。
 *
 * 字段来自 `FIELDS[kind]`，与新建/编辑表单共用一份定义；密码默认遮罩，
 * 动态口令按 30 秒刷新，复制统一走底部回执。删除进回收站，不做硬删除。
 */
@Component({
  selector: "vault-item-view-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-relative tw-block tw-h-full",
    "(document:keydown.escape)": "onEscape()",
  },
  imports: [
    CommonModule,
    JslibModule,
    IconModule,
    LpKindTileComponent,
    LpPasswordSyntaxComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div class="agy tw-relative tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="cipher()?.name ?? ''"
        [sub]="headerSubtitle()"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="agy-ext-scroll">
        @if (loading()) {
          <p class="tw-px-2 tw-py-6 tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else if (cipher(); as item) {
          <div class="agy-ext-hero">
            <lp-kind-tile [kind]="kind()" size="lg"></lp-kind-tile>
            <div class="tw-min-w-0 tw-flex-1">
              <div class="agy-h1">{{ item.name }}</div>
              <div class="agy-h2">
                {{ item.subTitle || kindLabel() }}
                @if (folderName()) {
                  · {{ folderName() }}
                }
              </div>
            </div>
            <button
              type="button"
              class="agy-iconbtn"
              [class.agy-on]="item.favorite"
              [attr.aria-label]="i18n.t('favorite')"
              [attr.title]="i18n.t('favorite')"
              (click)="toggleFavorite()"
            >
              <bit-icon
                [name]="item.favorite ? 'bwi-star-filled' : 'bwi-star'"
                class="tw-text-base"
              ></bit-icon>
            </button>
            <button
              type="button"
              class="agy-iconbtn"
              [attr.aria-label]="i18n.t('moreOptions')"
              [attr.title]="i18n.t('moreOptions')"
              (click)="sheetOpen.set(true)"
            >
              <bit-icon name="bwi-ellipsis-h" class="tw-text-base"></bit-icon>
            </button>
          </div>

          @if (hasTotpKey()) {
            <div
              class="agy-ext-otp"
              [class.agy-copied]="copiedKey() === 'otp'"
              role="button"
              tabindex="0"
              (click)="copyTotp()"
              (keydown.enter)="copyTotp()"
              (keydown.space)="$event.preventDefault(); copyTotp()"
            >
              <span class="agy-ring" [class.agy-low]="totpRemaining() <= 5" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="20" height="20">
                  <circle class="agy-track" cx="10" cy="10" r="8"></circle>
                  <circle
                    class="agy-prog"
                    cx="10"
                    cy="10"
                    r="8"
                    [attr.stroke-dasharray]="ringCircumference"
                    [attr.stroke-dashoffset]="totpRingOffset()"
                  ></circle>
                </svg>
              </span>
              <span class="agy-code">{{ formattedTotp() }}</span>
              <span class="agy-sub">{{ totpRemaining() }}s</span>
              <span class="tw-flex-1"></span>
              @if (copiedKey() === "otp") {
                <bit-icon name="bwi-check" class="tw-text-sm tw-text-fg-success"></bit-icon>
              }
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-label]="i18n.t('totpQrTitle')"
                [attr.title]="i18n.t('totpQrTitle')"
                (click)="openTotpQr($event)"
              >
                <bit-icon name="bwi-grid" class="tw-text-xs"></bit-icon>
              </button>
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-label]="i18n.t('copy')"
                [attr.title]="i18n.t('copy')"
                (click)="$event.stopPropagation(); copyTotp()"
              >
                <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
              </button>
            </div>
          }

          @for (section of sections(); track section.key) {
            <section class="tw-pb-2">
              <h2 class="agy-seclbl tw-flex tw-items-center tw-gap-1.5">
                {{ section.label }}
              </h2>
              <div class="agy-grp">
                @for (row of section.rows; track row.id) {
                  @if (row.multiline) {
                    <div class="agy-ext-field tw-cursor-default">
                      <span class="agy-k">{{ row.label }}</span>
                      <span
                        class="agy-v"
                        [class.agy-multiline]="!row.secret || row.revealed"
                        [class.agy-mono]="row.mono"
                        >{{ row.display }}</span
                      >
                      <span class="tw-flex tw-flex-none tw-items-center tw-gap-0.5 tw-text-muted">
                        @if (row.secret) {
                          <button
                            type="button"
                            class="agy-iconbtn agy-sm"
                            [attr.aria-label]="
                              row.revealed ? i18n.t('hideValue') : i18n.t('showValue')
                            "
                            [attr.title]="row.revealed ? i18n.t('hideValue') : i18n.t('showValue')"
                            (click)="toggleReveal($event, row.id)"
                          >
                            <bit-icon
                              [name]="row.revealed ? 'bwi-visibility-off' : 'bwi-visibility'"
                              class="tw-text-xs"
                            ></bit-icon>
                          </button>
                        }
                        <button
                          type="button"
                          class="agy-iconbtn agy-sm"
                          [attr.aria-label]="i18n.t('copy')"
                          [attr.title]="i18n.t('copy')"
                          (click)="copyMultiline($event, row)"
                        >
                          @if (copiedKey() === row.id) {
                            <bit-icon
                              name="bwi-check"
                              class="tw-text-xs tw-text-fg-success"
                            ></bit-icon>
                          } @else {
                            <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                          }
                        </button>
                      </span>
                    </div>
                  } @else {
                    <div
                      class="agy-ext-field"
                      [class.agy-copied]="copiedKey() === row.id"
                      role="button"
                      tabindex="0"
                      (click)="copyRow(row)"
                      (keydown.enter)="copyRow(row)"
                    >
                      <span class="agy-k">{{ row.label }}</span>
                      <span class="agy-v" [class.agy-mono]="row.mono">
                        @if (row.secret && row.revealed) {
                          <lp-password-syntax [value]="row.value" />
                        } @else {
                          {{ row.display }}
                        }
                      </span>
                      <span class="tw-flex tw-flex-none tw-items-center tw-gap-0.5 tw-text-muted">
                        @if (row.secret && row.revealed && autoHide()) {
                          <span class="agy-chip">{{ i18n.t("autoHide30sChip") }}</span>
                        }
                        @if (row.secret) {
                          <button
                            type="button"
                            class="agy-iconbtn agy-sm"
                            [attr.aria-label]="
                              row.revealed ? i18n.t('hideValue') : i18n.t('showValue')
                            "
                            [attr.title]="row.revealed ? i18n.t('hideValue') : i18n.t('showValue')"
                            (click)="toggleReveal($event, row.id)"
                          >
                            <bit-icon
                              [name]="row.revealed ? 'bwi-visibility-off' : 'bwi-visibility'"
                              class="tw-text-xs"
                            ></bit-icon>
                          </button>
                        }
                        @if (row.uri) {
                          <button
                            type="button"
                            class="agy-iconbtn agy-sm"
                            [attr.aria-label]="i18n.t('openWebsite')"
                            [attr.title]="i18n.t('openWebsite')"
                            (click)="launchUri($event, row.value)"
                          >
                            <bit-icon name="bwi-external-link" class="tw-text-xs"></bit-icon>
                          </button>
                        }
                        @if (copiedKey() === row.id) {
                          <bit-icon
                            name="bwi-check"
                            class="tw-text-xs tw-text-fg-success"
                          ></bit-icon>
                        } @else {
                          <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                        }
                      </span>
                    </div>
                  }
                }
              </div>
            </section>
          }

          @if (passkeys().length) {
            <section class="tw-pb-2">
              <h2 class="agy-seclbl tw-flex tw-items-center tw-gap-1.5">
                {{ i18n.t("passkeys") }}
              </h2>
              <div class="agy-grp">
                @for (passkey of passkeys(); track $index) {
                  <div class="agy-ext-field tw-cursor-default">
                    <span class="agy-k">{{ passkey.rpId || i18n.t("passkey") }}</span>
                    <span class="agy-v">
                      {{ passkey.userName ? passkey.userName + " · " : ""
                      }}{{ i18n.t("dateCreated") }} {{ passkey.creationDate | date: "short" }}
                    </span>
                    <span></span>
                  </div>
                }
              </div>
            </section>
          }

          @if (customFields().length) {
            <section class="tw-pb-2">
              <h2 class="agy-seclbl tw-flex tw-items-center tw-gap-1.5">
                {{ i18n.t("customFields") }}
              </h2>
              <div class="agy-grp">
                @for (field of customFields(); track field.id) {
                  <div
                    class="agy-ext-field"
                    [class.agy-copied]="copiedKey() === 'custom:' + field.id"
                    role="button"
                    tabindex="0"
                    (click)="copyCustomField(field)"
                    (keydown.enter)="copyCustomField(field)"
                  >
                    <span class="agy-k tw-truncate" [attr.title]="field.label">{{
                      field.label
                    }}</span>
                    <span class="agy-v" [class.agy-mono]="field.hidden">
                      @if (field.hidden && field.revealed) {
                        <lp-password-syntax [value]="field.value" />
                      } @else {
                        {{ field.display }}
                      }
                    </span>
                    <span class="tw-flex tw-flex-none tw-items-center tw-gap-0.5 tw-text-muted">
                      @if (field.hidden) {
                        <button
                          type="button"
                          class="agy-iconbtn agy-sm"
                          [attr.aria-label]="
                            field.revealed ? i18n.t('hideValue') : i18n.t('showValue')
                          "
                          [attr.title]="field.revealed ? i18n.t('hideValue') : i18n.t('showValue')"
                          (click)="toggleCustomReveal($event, field.id)"
                        >
                          <bit-icon
                            [name]="field.revealed ? 'bwi-visibility-off' : 'bwi-visibility'"
                            class="tw-text-xs"
                          ></bit-icon>
                        </button>
                      }
                      @if (copiedKey() === "custom:" + field.id) {
                        <bit-icon name="bwi-check" class="tw-text-xs tw-text-fg-success"></bit-icon>
                      } @else {
                        <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                      }
                    </span>
                  </div>
                }
              </div>
            </section>
          }

          <section class="tw-pb-2">
            <h2 class="agy-seclbl tw-flex tw-items-center tw-gap-1.5">
              {{ i18n.t("itemInformation") }}
            </h2>
            <div class="agy-grp">
              <div class="agy-ext-field tw-cursor-default">
                <span class="agy-k">{{ i18n.t("folder") }}</span>
                <span class="agy-v">{{ folderName() || i18n.t("noFolder") }}</span>
                <span></span>
              </div>
              <div class="agy-ext-field tw-cursor-default">
                <span class="agy-k">{{ i18n.t("lastModified") }}</span>
                <span class="agy-v">{{ item.revisionDate | date: "medium" }}</span>
                <span></span>
              </div>
            </div>
          </section>
        }
      </div>

      @if (cipher()) {
        <div class="agy-ext-foot">
          @if (fillable()) {
            <button type="button" class="agy-btn agy-primary agy-lg tw-flex-1" (click)="fill()">
              <bit-icon name="bwi-autofill" class="tw-text-xs"></bit-icon>
              {{ i18n.t("fill") }}
            </button>
          }
          <button
            type="button"
            class="agy-btn agy-lg tw-flex-1"
            [class.agy-primary]="!fillable()"
            (click)="edit()"
          >
            <bit-icon name="bwi-pencil-square" class="tw-text-xs"></bit-icon>
            {{ i18n.t("edit") }}
          </button>
          <button
            type="button"
            class="agy-iconbtn"
            [attr.aria-label]="i18n.t('moreOptions')"
            [attr.title]="i18n.t('moreOptions')"
            (click)="sheetOpen.set(true)"
          >
            <bit-icon name="bwi-ellipsis-h" class="tw-text-base"></bit-icon>
          </button>
        </div>
      }
    </div>

    @if (sheetOpen()) {
      <div class="agy-sheetwrap" (click)="sheetOpen.set(false)">
        <div
          class="agy-sheet"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="i18n.t('moreOptions')"
          (click)="$event.stopPropagation()"
        >
          <div class="agy-st">{{ cipher()?.name }}</div>
          <button type="button" class="agy-sb" (click)="edit()">
            <bit-icon name="bwi-pencil-square" class="tw-w-4 tw-text-muted"></bit-icon>
            {{ i18n.t("edit") }}
          </button>
          <button type="button" class="agy-sb" (click)="clone()">
            <bit-icon name="bwi-clone" class="tw-w-4 tw-text-muted"></bit-icon>
            {{ i18n.t("clone") }}
          </button>
          @if (hasTotpKey()) {
            <button type="button" class="agy-sb" (click)="openTotpQr($event)">
              <bit-icon name="bwi-grid" class="tw-w-4 tw-text-muted"></bit-icon>
              {{ i18n.t("totpQrTitle") }}
            </button>
          }
          <button type="button" class="agy-sb" (click)="toggleFavorite()">
            <bit-icon
              [name]="cipher()?.favorite ? 'bwi-star-filled' : 'bwi-star'"
              class="tw-w-4 tw-text-muted"
            ></bit-icon>
            {{ cipher()?.favorite ? i18n.t("removeFavorite") : i18n.t("favorite") }}
          </button>
          <button type="button" class="agy-sb" (click)="archive()">
            <bit-icon name="bwi-archive" class="tw-w-4 tw-text-muted"></bit-icon>
            {{ i18n.t("archiveVerb") }}
          </button>
          <button type="button" class="agy-sb agy-danger" (click)="remove()">
            <bit-icon name="bwi-trash" class="tw-w-4"></bit-icon>
            {{ i18n.t("moveToTrash") }}
          </button>
        </div>
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
  private readonly passwordAutoHideService = inject(PasswordAutoHideService);
  private readonly autofillSettingsService = inject(AutofillSettingsServiceAbstraction, {
    optional: true,
  });
  protected readonly autoHide = toSignal(this.passwordAutoHideService.autoHide$, {
    initialValue: true,
  });
  private readonly clearClipboardDelay = this.autofillSettingsService
    ? toSignal(this.autofillSettingsService.clearClipboardDelay$, {
        initialValue: ClearClipboardDelay.ThirtySeconds,
      })
    : signal(ClearClipboardDelay.ThirtySeconds);
  private readonly revealTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly ringCircumference = RING_CIRCUMFERENCE;
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

  protected readonly copiedKey = signal("");
  private readonly copiedTimer = signal<ReturnType<typeof setTimeout> | null>(null);

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
  protected readonly totpRingOffset = computed(
    () => RING_CIRCUMFERENCE * (1 - this.totpRemainingPercent() / 100),
  );

  protected readonly sections = computed<readonly DetailSection[]>(() => {
    const item = this.cipher();
    if (!item) {
      return [];
    }

    const kind = this.kind();
    // 顶部独立动态口令卡片已展示实时验证码与倒计时环，字段组里跳过 totp 避免重复。
    const specs = FIELDS[kind].filter(
      (field) => field.target !== "name" && field.target !== "notes" && field.id !== "totp",
    );
    const rows = specs
      .map((field) => this.toDetailRow(item, field))
      .filter((row) => row.value.length > 0);

    if (kind === ItemKind.Login) {
      const credentials = rows.filter((row) => row.id !== "uri" && row.id !== "uri2");
      const uris = rows.filter((row) => row.id === "uri" || row.id === "uri2");
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
    this.destroyRef.onDestroy(() => this.clearRevealTimers());
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
    this.sheetOpen.set(false);
    const id = this.cipher()?.id;
    if (id) {
      void this.router.navigate(["/totp-qr-v2"], { queryParams: { cipherId: id } });
    }
  }

  protected onEscape(): void {
    if (this.sheetOpen()) {
      this.sheetOpen.set(false);
    }
  }

  protected toggleReveal(event: Event, id: string): void {
    event.stopPropagation();
    const visible = !this.revealed()[id];
    this.revealed.update((current) => ({ ...current, [id]: visible }));
    this.scheduleAutoHide(`login:${id}`, visible, () =>
      this.revealed.update((current) => ({ ...current, [id]: false })),
    );
  }

  protected toggleCustomReveal(event: Event, id: string): void {
    event.stopPropagation();
    const visible = !this.customRevealed()[id];
    this.customRevealed.update((current) => ({ ...current, [id]: visible }));
    this.scheduleAutoHide(`custom:${id}`, visible, () =>
      this.customRevealed.update((current) => ({ ...current, [id]: false })),
    );
  }

  protected copyRow(row: DetailRow): void {
    if (row.multiline || !row.value) {
      return;
    }
    this.copyValue(row.value, row.label);
    this.flash(row.id);
  }

  protected copyCustomField(field: CustomRow): void {
    this.copyValue(field.value, field.label);
    this.flash(`custom:${field.id}`);
  }

  protected copyTotp(): void {
    const code = this.totpCode();
    if (!code) {
      return;
    }
    this.copyValue(code, this.i18n.t("verificationCode"));
    this.flash("otp");
  }

  protected readonly fillable = computed(() => {
    const kind = this.kind();
    return kind === ItemKind.Login || kind === ItemKind.Card || kind === ItemKind.Identity;
  });

  protected async fill(): Promise<void> {
    const item = this.cipher();
    if (!item) {
      return;
    }
    // The page already passed the reprompt check on open, so do not ask again.
    await this.vaultPopupAutofillService.doAutofill(item, true, true);
  }

  /** 行内复制后的短暂绿色反馈；只表示已写入剪贴板，不代表已自动清除。 */
  private flash(key: string): void {
    const previous = this.copiedTimer();
    if (previous) {
      clearTimeout(previous);
    }
    this.copiedKey.set(key);
    this.copiedTimer.set(setTimeout(() => this.copiedKey.set(""), 1300));
  }

  /** 多行字段（公钥、备注）不整行触发，只允许点尾部复制按钮。 */
  protected copyMultiline(event: Event, row: DetailRow): void {
    event.stopPropagation();
    this.copyValue(row.value, row.label);
    this.flash(row.id);
  }

  protected copyValue(value: string, label: string): void {
    if (!value) {
      return;
    }
    const copied = this.platformUtilsService.copyToClipboard(value, { window });
    if (copied !== false) {
      const delay = this.clipboardClearSeconds(this.clearClipboardDelay());
      if (delay > 0) {
        this.toast.showClipboard(
          this.i18n.t("copiedField", label),
          () => {
            this.platformUtilsService.copyToClipboard("", { window });
          },
          delay,
        );
      } else {
        this.toast.show(this.i18n.t("copiedField", label));
      }
    }
  }

  /** 设置里存的是可读档位，复制回执需要秒数；Never 与关闭时返回 0。 */
  private clipboardClearSeconds(setting: ClearClipboardDelaySetting): number {
    switch (setting) {
      case ClearClipboardDelay.TenSeconds:
        return 10;
      case ClearClipboardDelay.TwentySeconds:
        return 20;
      case ClearClipboardDelay.ThirtySeconds:
        return 30;
      case ClearClipboardDelay.OneMinute:
        return 60;
      case ClearClipboardDelay.TwoMinutes:
        return 120;
      case ClearClipboardDelay.FiveMinutes:
        return 300;
      case ClearClipboardDelay.Never:
      default:
        return 0;
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

  protected async archive(): Promise<void> {
    const item = this.cipher();
    if (!item?.id) {
      return;
    }

    const previous = item.archivedDate;
    item.archivedDate = new Date();
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.updateWithServer(item, userId);
      this.sheetOpen.set(false);
      this.toast.show(this.i18n.t("itemArchiveToast"));
      await this.router.navigateByUrl("/tabs/vault");
    } catch {
      item.archivedDate = previous;
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
    const deletedId = item.id;
    this.toast.showUndo(
      this.i18n.t("movedToTrash"),
      async () => {
        try {
          await this.cipherService.restoreWithServer(deletedId, userId);
          this.toast.show(this.i18n.t("itemRestored"));
        } catch {
          this.toast.show(this.i18n.t("unexpectedError"));
        }
      },
      5,
    );
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

  /** Restarts the mask timer for one revealed value; hiding it manually cancels the timer. */
  private scheduleAutoHide(key: string, visible: boolean, hide: () => void): void {
    const existing = this.revealTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.revealTimers.delete(key);
    }

    if (!visible || !this.autoHide()) {
      return;
    }

    this.revealTimers.set(
      key,
      setTimeout(() => {
        this.revealTimers.delete(key);
        hide();
      }, PASSWORD_AUTO_HIDE_MS),
    );
  }

  private clearRevealTimers(): void {
    this.revealTimers.forEach((timer) => clearTimeout(timer));
    this.revealTimers.clear();
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
      mono: secret || !!field.mono || id === "username" || id === "uri" || id === "uri2" || totp,
      uri: id === "uri" || id === "uri2",
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
      hidden,
      revealed,
    };
  }
}
