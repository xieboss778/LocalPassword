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
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { ButtonModule } from "@localpass/components";
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
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header [title]="i18n.t('vault')" [sub]="subtitle()">
        <button type="button" bitButton buttonType="primary" (click)="createItem()">
          {{ i18n.t("newItem") }}
        </button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @if (loading()) {
          <p class="tw-px-4 tw-py-6 tw-text-[12px] tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("loading") }}
          </p>
        } @else if (groups().length === 0) {
          <p class="tw-px-4 tw-py-8 tw-text-center tw-text-[12px] tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("noItemsInVault") }}
          </p>
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
    </div>
  `,
})
export class VaultListV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  private readonly ciphers = signal<CipherView[]>([]);

  protected readonly subtitle = computed(() => `${this.ciphers().length} ` + this.i18n.t("items"));
  protected readonly groups = computed<KindGroup[]>(() => this.groupByKind(this.ciphers()));

  async ngOnInit(): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const ciphers = await this.cipherService.getAllDecrypted(userId);
      this.ciphers.set(ciphers.filter((cipher) => !cipher.isDeleted));
    } finally {
      this.loading.set(false);
    }
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
