import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ItemKind, kindOf, withoutKindField } from "@localpass/local-vault";

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
 * 桌面端三栏保险库（方向 C）：左 rail + 中间列表 + 右栏详情。
 *
 * 先把骨架与「点行复制」跑通；右栏的内联表单与工具栏动作随后逐屏接入。
 */
@Component({
  selector: "vault-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-bg-[var(--lp-bg)]">
      <!-- 左 rail -->
      <nav class="tw-flex tw-w-[216px] tw-flex-none tw-flex-col tw-gap-1 tw-px-2 tw-py-3">
        <div class="tw-mb-2 tw-flex tw-items-center tw-gap-2 tw-px-2">
          <span
            class="tw-grid tw-size-8 tw-place-items-center tw-rounded-[10px] tw-bg-[var(--lp-brand-soft)] tw-text-[13px] tw-font-bold tw-text-[var(--lp-brand)]"
            >LP</span
          >
          <div class="tw-text-[12px] tw-font-semibold">本地保险库</div>
        </div>

        @for (entry of railEntries; track entry.route) {
          <button
            type="button"
            class="tw-flex tw-items-center tw-gap-2 tw-rounded-[10px] tw-px-2.5 tw-py-2 tw-text-left tw-text-[12.5px]"
            (click)="go(entry.route)"
          >
            <span aria-hidden="true">{{ entry.emoji }}</span>
            <span>{{ i18n.t(entry.labelKey) }}</span>
          </button>
        }
      </nav>

      <!-- 中间列表 -->
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

      <!-- 右栏详情 -->
      <section class="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col">
        @if (selected(); as item) {
          <lp-page-header [title]="item.name" [sub]="item.subTitle ?? ''"></lp-page-header>
          <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
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

            @if (item.notes) {
              <lp-group [label]="i18n.t('notes')">
                <lp-row [label]="i18n.t('notes')" [sub]="item.notes" [clickable]="false" />
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
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);

  protected readonly masked = "••••••••••••";
  protected readonly query = signal("");
  protected readonly items = signal<CipherView[]>([]);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly railEntries = [
    { emoji: "🗄️", labelKey: "vault", route: "/vault-desktop-v2" },
    { emoji: "⚙️", labelKey: "generator", route: "/generator" },
    { emoji: "🎛️", labelKey: "settings", route: "/settings" },
  ] as const;

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

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected select(item: CipherView): void {
    this.selectedId.set(item.id ?? null);
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }
}
