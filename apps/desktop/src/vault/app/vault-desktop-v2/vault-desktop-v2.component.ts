import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter, firstValueFrom, map, of, startWith, switchMap } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpFieldComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { TotpService } from "@localpass/common/vault/abstractions/totp.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, DialogService, IconButtonModule } from "@localpass/components";
import {
  applyFieldValues,
  FIELDS,
  FieldSpec,
  FieldValues,
  ItemKind,
  kindOf,
  readFieldValues,
  setKind,
  withoutKindField,
} from "@localpass/local-vault";

const KIND_UI: Record<ItemKind, { labelKey: string; emoji: string }> = {
  login: { labelKey: "itemKindLogin", emoji: "🔐" },
  token: { labelKey: "itemKindToken", emoji: "🔑" },
  "ssh-key": { labelKey: "itemKindSshKey", emoji: "🗝️" },
  license: { labelKey: "itemKindLicense", emoji: "📜" },
  card: { labelKey: "itemKindCard", emoji: "💳" },
  identity: { labelKey: "itemKindIdentity", emoji: "🪪" },
  server: { labelKey: "itemKindServer", emoji: "🖥️" },
  note: { labelKey: "itemKindNote", emoji: "📝" },
};

/**
 * 桌面端三栏保险库（方向 C）：左 rail + 中间列表 + 右栏详情 / 内联表单。
 *
 * 右栏表单与弹窗共用 `@localpass/local-vault` 的字段清单与读写映射；
 * 复制只有「点行」一个入口（见 {@link LpRowComponent}）。
 */
@Component({
  selector: "vault-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  host: {
    "(document:keydown)": "onKeyDown($event)",
  },
  template: `
    <div class="tw-flex tw-h-full tw-bg-[var(--lp-bg)]">
      <nav class="tw-flex tw-w-[216px] tw-flex-none tw-flex-col tw-gap-1 tw-px-2 tw-py-3">
        <div class="tw-mb-2 tw-flex tw-items-center tw-gap-2 tw-px-2">
          <span
            class="tw-grid tw-size-8 tw-place-items-center tw-rounded-[10px] tw-bg-[var(--lp-brand-soft)] tw-text-[13px] tw-font-bold tw-text-[var(--lp-brand)]"
            >LP</span
          >
          <div class="tw-text-[12px] tw-font-semibold">{{ i18n.t("localVault") }}</div>
        </div>

        @for (entry of railEntries; track entry.route) {
          <button
            type="button"
            class="tw-flex tw-items-center tw-gap-2 tw-rounded-[10px] tw-px-2.5 tw-py-2 tw-text-left tw-text-[12.5px]"
            [class.tw-bg-[var(--lp-card)]]="entry.active"
            (click)="go(entry.route)"
          >
            <span aria-hidden="true">{{ entry.emoji }}</span>
            <span>{{ i18n.t(entry.labelKey) }}</span>
          </button>
        }
      </nav>

      <section class="tw-flex tw-w-[330px] tw-flex-none tw-flex-col tw-bg-[var(--lp-card)]">
        <div class="tw-px-3.5 tw-pt-3 tw-pb-2">
          <div class="tw-text-[15px] tw-font-semibold">{{ i18n.t("vault") }}</div>
          <div class="tw-text-[10.5px] tw-text-[var(--lp-ink-3)]">{{ subtitle() }}</div>
        </div>

        <div
          class="tw-mx-3 tw-mb-2 tw-flex tw-items-center tw-gap-2 tw-rounded-[10px] tw-border tw-border-[var(--lp-line)] tw-px-2.5 tw-py-1.5"
        >
          <span class="tw-text-[var(--lp-ink-3)]" aria-hidden="true">&#9906;</span>
          <input
            class="tw-min-w-0 tw-flex-1 tw-border-0 tw-bg-transparent tw-text-[11.5px] tw-outline-none"
            [attr.placeholder]="i18n.t('searchVault')"
            [value]="query()"
            (input)="onSearch($event)"
          />
          <span class="tw-text-[10px] tw-text-[var(--lp-ink-3)]">&#8984;K</span>
        </div>

        <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-4">
          @for (item of filtered(); track item.id) {
            <button
              type="button"
              class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-px-3.5 tw-py-2 tw-text-left"
              [class.tw-bg-[var(--lp-brand-soft)]]="item.id === selectedId()"
              (click)="select(item)"
            >
              <span aria-hidden="true">{{ kindEmoji(item) }}</span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="tw-block tw-truncate tw-text-[12.5px]">{{ item.name }}</span>
                <span class="tw-block tw-truncate tw-text-[10.5px] tw-text-[var(--lp-ink-3)]">{{
                  item.subTitle
                }}</span>
              </span>
            </button>
          }
        </div>
      </section>

      <section class="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col">
        @if (selected(); as item) {
          <lp-page-header
            [title]="mode() === 'edit' ? i18n.t('editItem') : item.name"
            [sub]="item.subTitle ?? ''"
          >
            @if (mode() === "edit") {
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
            } @else {
              <button
                type="button"
                bitIconButton="bwi-pencil-square"
                [label]="i18n.t('edit')"
                (click)="startEdit()"
              ></button>
              <button
                type="button"
                bitIconButton="bwi-trash"
                [label]="i18n.t('delete')"
                (click)="remove()"
              ></button>
              <button
                type="button"
                bitIconButton="bwi-plus"
                [label]="i18n.t('newItem')"
                (click)="go('/new-item-v2')"
              ></button>
            }
          </lp-page-header>

          <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
            @if (mode() === "edit") {
              <lp-group>
                @for (field of editFields(); track field.id) {
                  <lp-field
                    [label]="i18n.t(field.labelKey)"
                    [password]="!!field.password"
                    [multiline]="!!field.multiline"
                    [value]="values()[field.id] ?? ''"
                    (valueChange)="setValue(field.id, $event)"
                  />
                }
              </lp-group>
              @if (errorMessage()) {
                <p class="tw-px-4 tw-pt-3 tw-text-[11px] tw-text-[var(--lp-danger)]">
                  {{ errorMessage() }}
                </p>
              }
            } @else {
              <lp-group [label]="i18n.t('credentials')">
                @if (item.login.username) {
                  <lp-row
                    [label]="i18n.t('username')"
                    [value]="item.login.username"
                    [mono]="true"
                    [copyValue]="item.login.username"
                    [copyLabel]="i18n.t('username')"
                  />
                }
                @if (item.login.password) {
                  <lp-row
                    [label]="i18n.t('password')"
                    [value]="masked"
                    [mono]="true"
                    [copyValue]="item.login.password"
                    [copyLabel]="i18n.t('password')"
                  />
                }
                @if (totpCode()) {
                  <lp-row
                    [label]="i18n.t('verificationCodeTotp')"
                    [value]="formattedTotp()"
                    [mono]="true"
                    [brand]="true"
                    [copyValue]="totpCode()"
                    [copyLabel]="i18n.t('verificationCodeTotp')"
                  />
                }
              </lp-group>

              @if (item.login.uris.length) {
                <lp-group [label]="i18n.t('autofillOptions')">
                  @for (uri of item.login.uris; track uri.uri) {
                    <lp-row
                      [label]="uri.uri ?? ''"
                      [mono]="true"
                      [copyValue]="uri.uri ?? ''"
                      [copyLabel]="i18n.t('uri')"
                    />
                  }
                </lp-group>
              }

              @if (item.login.fido2Credentials.length) {
                <lp-group label="Passkey">
                  <lp-row
                    [label]="i18n.t('passkey')"
                    [value]="passkeySummary(item)"
                    [clickable]="false"
                  />
                </lp-group>
              }

              @if (customFields(item).length) {
                <lp-group [label]="i18n.t('customFields')">
                  @for (field of customFields(item); track field.name) {
                    <lp-row
                      [label]="field.name"
                      [value]="field.value"
                      [copyValue]="field.value"
                      [copyLabel]="field.name"
                    />
                  }
                </lp-group>
              }

              <lp-group [label]="i18n.t('additionalOptions')">
                @if (item.notes) {
                  <lp-row [label]="i18n.t('notes')" [sub]="item.notes" [clickable]="false" />
                }
                <lp-row
                  [label]="i18n.t('passwordReprompt')"
                  [value]="item.reprompt ? i18n.t('enabled') : i18n.t('disabled')"
                  [clickable]="false"
                />
                @if (item.attachments.length) {
                  <lp-row
                    [label]="i18n.t('attachments')"
                    [value]="attachmentCount(item)"
                    [clickable]="false"
                  />
                }
              </lp-group>
            }
          </div>
        } @else {
          <div
            class="tw-grid tw-h-full tw-place-items-center tw-text-[12px] tw-text-[var(--lp-ink-3)]"
          >
            {{ i18n.t("noItemsInVault") }}
          </div>
        }
      </section>
    </div>
  `,
})
export class VaultDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly totpService = inject(TotpService);
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  protected readonly masked = "••••••••••••";
  protected readonly query = signal("");
  protected readonly items = signal<CipherView[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly mode = signal<"view" | "edit">("view");
  protected readonly values = signal<FieldValues>({});
  protected readonly editKind = signal<ItemKind>(ItemKind.Login);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** 左 rail 的三条主入口；active 由当前 URL 推出来，不写死。 */
  private readonly railSpec = [
    { emoji: "🗄️", labelKey: "vault", route: "/vault-desktop-v2" },
    { emoji: "⚙️", labelKey: "generator", route: "/generator" },
    { emoji: "🎛️", labelKey: "settings", route: "/settings-desktop-v2" },
  ] as const;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly railEntries = computed(() =>
    this.railSpec.map((entry) => ({ ...entry, active: this.currentUrl().startsWith(entry.route) })),
  );

  protected readonly editFields = computed<readonly FieldSpec[]>(() => FIELDS[this.editKind()]);
  protected readonly subtitle = computed(() => `${this.items().length} ` + this.i18n.t("items"));
  protected readonly selected = computed(
    () => this.items().find((item) => item.id === this.selectedId()) ?? null,
  );
  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) {
      return this.items();
    }
    return this.items().filter((item) =>
      [item.name, item.login.username ?? "", item.subTitle ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  });

  /** 选中项的 TOTP 密文；切换条目时重新订阅。 */
  private readonly totpKey = computed(() => this.selected()?.login.totp ?? "");
  private readonly totpResponse = toSignal(
    toObservable(this.totpKey).pipe(
      switchMap((key) => (key ? this.totpService.getCode$(key) : of(null))),
      takeUntilDestroyed(),
    ),
    { initialValue: null },
  );

  protected readonly totpCode = computed(() => this.totpResponse()?.code ?? "");
  protected readonly formattedTotp = computed(() => {
    const code = this.totpCode();
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  });

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await this.cipherService.getAllDecrypted(userId);
    const items = ciphers.filter((cipher) => !cipher.isDeleted);
    this.items.set(items);
    this.selectedId.set(items[0]?.id ?? null);
  }

  protected kindEmoji(item: CipherView): string {
    return KIND_UI[kindOf(item)].emoji;
  }

  protected customFields(item: CipherView) {
    return withoutKindField(item.fields);
  }

  protected passkeySummary(item: CipherView): string {
    return `${item.login.fido2Credentials.length}`;
  }

  protected attachmentCount(item: CipherView): string {
    return `${item.attachments.length}`;
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected select(item: CipherView): void {
    this.selectedId.set(item.id ?? null);
    this.mode.set("view");
  }

  protected startEdit(): void {
    const item = this.selected();
    if (!item) {
      return;
    }
    const kind = kindOf(item);
    this.editKind.set(kind);
    this.values.set(readFieldValues(item, kind));
    this.errorMessage.set(null);
    this.mode.set("edit");
  }

  protected cancelEdit(): void {
    this.mode.set("view");
  }

  protected setValue(id: string, value: string): void {
    this.values.update((current) => ({ ...current, [id]: value }));
  }

  protected async save(): Promise<void> {
    const item = this.selected();
    if (!item) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const kind = this.editKind();
      applyFieldValues(item, kind, this.values());
      setKind(item, kind);

      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.updateWithServer(item, userId);

      this.items.update((items) => items.map((entry) => (entry.id === item.id ? item : entry)));
      this.mode.set("view");
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const item = this.selected();
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

    this.items.update((items) => items.filter((entry) => entry.id !== item.id));
    this.selectedId.set(this.items()[0]?.id ?? null);
    this.mode.set("view");
  }

  /** ⌘N 新建、↑↓ 切条目、esc 退出编辑。 */
  protected onKeyDown(event: KeyboardEvent): void {
    const meta = event.metaKey || event.ctrlKey;

    if (meta && event.key.toLowerCase() === "n") {
      event.preventDefault();
      this.go("/new-item-v2");
      return;
    }

    if (event.key === "Escape" && this.mode() === "edit") {
      event.preventDefault();
      this.cancelEdit();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const list = this.filtered();
      if (!list.length) {
        return;
      }
      event.preventDefault();
      const index = list.findIndex((item) => item.id === this.selectedId());
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = list[(index + delta + list.length) % list.length];
      this.selectedId.set(next.id ?? null);
      this.mode.set("view");
    }
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }
}
