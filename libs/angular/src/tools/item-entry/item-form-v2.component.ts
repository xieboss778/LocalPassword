import { CommonModule } from "@angular/common";
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
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule } from "@localpass/components";
import {
  applyFieldValues,
  FIELDS,
  FieldSpec,
  FieldValues,
  isItemKind,
  ItemKind,
  readFieldValues,
  setKind,
} from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  LpFieldComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
} from "../../local-ui";

/**
 * 新建 / 编辑表单（方向 C）。字段清单与读写映射都在 `@localpass/local-vault` 的
 * `item-fields` 里，桌面端右栏内联表单用的是同一份，不复制逻辑。
 */
@Component({
  selector: "item-form-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header [title]="heading()" [sub]="i18n.t(kindLabelKey())">
        <button type="button" bitButton buttonType="primary" [disabled]="saving()" (click)="save()">
          {{ i18n.t("save") }}
        </button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <lp-group>
          @for (field of fields(); track field.id) {
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
      </div>
    </div>
  `,
})
export class ItemFormV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly values = signal<FieldValues>({});
  protected readonly kind = signal<ItemKind>(ItemKind.Login);

  protected readonly fields = computed<readonly FieldSpec[]>(() => FIELDS[this.kind()]);
  protected readonly heading = computed(() =>
    this.i18n.t(this.isEditing() ? "editItem" : "newItem"),
  );
  protected readonly kindLabelKey = computed(
    () =>
      `itemKind${this.kind()
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")}`,
  );

  private readonly isEditing = signal(false);
  private readonly original = signal<CipherView | null>(null);

  async ngOnInit(): Promise<void> {
    const params: Params = await firstValueFrom(this.route.queryParams);
    const kind = params["kind"];
    if (isItemKind(kind)) {
      this.kind.set(kind);
    }

    const cipherId = params["cipherId"] as string | undefined;
    if (!cipherId) {
      this.values.set({});
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.cipherService.get(cipherId, userId);
    const view = await this.cipherService.decrypt(cipher, userId);
    this.original.set(view);
    this.isEditing.set(true);
    this.values.set(readFieldValues(view, this.kind()));
  }

  /** 保存后去哪：默认弹窗列表，桌面端通过 ?next=/vault-desktop-v2 指定自己的列表。 */
  private nextUrl(): string {
    const next = this.route.snapshot.queryParamMap.get("next");
    return next ?? "/vault-list-v2";
  }

  protected setValue(id: string, value: string): void {
    this.values.update((current) => ({ ...current, [id]: value }));
  }

  protected async save(): Promise<void> {
    this.errorMessage.set(null);
    this.saving.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const view = this.original() ?? new CipherView();
      applyFieldValues(view, this.kind(), this.values());
      setKind(view, this.kind());

      if (this.original()) {
        await this.cipherService.updateWithServer(view, userId);
      } else {
        this.original.set(await this.cipherService.createWithServer(view, userId));
      }

      await this.router.navigateByUrl(this.nextUrl());
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }
}
