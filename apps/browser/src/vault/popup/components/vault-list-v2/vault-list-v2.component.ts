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
  LpEmptyComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, IconButtonModule } from "@localpass/components";
import { ItemKind, kindOf } from "@localpass/local-vault";

/** 一个分组：同一类条目。 */
interface KindGroup {
  readonly kind: ItemKind;
  readonly label: string;
  readonly emoji: string;
  readonly rows: { id: string; name: string; sub: string; value: string }[];
}

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
 * 保险库列表（方向 C）：按条目类别分组的卡片列表。
 *
 * 只负责「读」和「进详情」——新建/编辑/删除都在各自的页面里，避免列表变上帝组件。
 */
@Component({
  selector: "vault-list-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    LpEmptyComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-relative tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header [title]="i18n.t('vault')" [sub]="subtitle()">
        <button
          type="button"
          bitIconButton="bwi-plus"
          [label]="i18n.t('newItem')"
          (click)="createItem()"
        ></button>
      </lp-page-header>

      <div
        class="tw-mx-3 tw-mb-2 tw-flex tw-items-center tw-gap-2 tw-rounded-[11px] tw-border tw-border-[var(--lp-line)] tw-bg-[var(--lp-card)] tw-px-2.5 tw-py-2"
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

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @if (loading()) {
          <p class="tw-px-4 tw-py-6 tw-text-[12px] tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("loading") }}
          </p>
        } @else if (ciphers().length === 0) {
          <lp-empty
            icon="&#128451;"
            [title]="i18n.t('noItemsInVault')"
            [text]="i18n.t('emptyVaultHint')"
          >
            <button type="button" bitButton buttonType="primary" (click)="createItem()">
              {{ i18n.t("newItem") }}
            </button>
            <button type="button" bitButton buttonType="secondary" (click)="importItems()">
              {{ i18n.t("importData") }}
            </button>
          </lp-empty>
        } @else if (groups().length === 0) {
          <lp-empty icon="&#128269;" [title]="i18n.t('noResults')" [text]="query()"></lp-empty>
        } @else {
          @for (group of groups(); track group.kind) {
            <lp-group [label]="group.label">
              @for (row of group.rows; track row.id) {
                <lp-row
                  [emoji]="group.emoji"
                  [label]="row.name"
                  [sub]="row.sub"
                  [value]="row.value"
                  [mono]="true"
                  [clickable]="true"
                  (activated)="open(row.id)"
                />
              }
            </lp-group>
          }
        }
      </div>

      <button
        type="button"
        class="tw-absolute tw-bottom-[72px] tw-right-4 tw-grid tw-size-[52px] tw-place-items-center tw-rounded-full tw-bg-[var(--lp-brand)] tw-text-[22px] tw-text-[#fff] tw-shadow-[0_8px_20px_#2f6bff4d]"
        [attr.aria-label]="i18n.t('newItem')"
        (click)="createItem()"
      >
        +
      </button>
    </div>
  `,
})
export class VaultListV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly query = signal("");
  protected readonly ciphers = signal<CipherView[]>([]);

  protected readonly subtitle = computed(() => `${this.ciphers().length} ` + this.i18n.t("items"));
  protected readonly groups = computed<KindGroup[]>(() => {
    const query = this.query().trim().toLowerCase();
    const items = query
      ? this.ciphers().filter((cipher) =>
          [cipher.name, cipher.login.username ?? "", cipher.subTitle ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : this.ciphers();
    return this.groupByKind(items);
  });

  async ngOnInit(): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const ciphers = await this.cipherService.getAllDecrypted(userId);
      this.ciphers.set(ciphers.filter((cipher) => !cipher.isDeleted));
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected importItems(): void {
    void this.router.navigate(["/import"]);
  }

  protected createItem(): void {
    void this.router.navigate(["/new-item"]);
  }

  protected open(id: string): void {
    void this.router.navigate(["/view-cipher"], { queryParams: { cipherId: id } });
  }

  private groupByKind(ciphers: CipherView[]): KindGroup[] {
    const buckets = new Map<ItemKind, CipherView[]>();
    for (const cipher of ciphers) {
      const kind = kindOf(cipher);
      const bucket = buckets.get(kind) ?? [];
      bucket.push(cipher);
      buckets.set(kind, bucket);
    }

    return [...buckets.entries()].map(([kind, items]) => ({
      kind,
      label: this.i18n.t(KIND_UI[kind].labelKey),
      emoji: KIND_UI[kind].emoji,
      rows: items.map((cipher) => ({
        id: cipher.id ?? "",
        name: cipher.name,
        sub: cipher.subTitle ?? "",
        value: "",
      })),
    }));
  }
}
