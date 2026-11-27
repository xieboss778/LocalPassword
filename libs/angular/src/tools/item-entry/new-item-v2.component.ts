import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";
import { ItemKind } from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  ITEM_KIND_ORDER,
  ITEM_KIND_UI,
  LpKindTileComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
} from "../../local-ui";

/** 新建条目的第一步：选类型。八格网格，点一下进对应表单。 */
@Component({
  selector: "new-item-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    JslibModule,
    IconModule,
    LpKindTileComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div
      class="tw-flex tw-h-full tw-flex-col"
      [class.tw-bg-background-alt]="!compact()"
      [class.tw-bg-background]="compact()"
    >
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('newItem')"
          [sub]="i18n.t('newItemPickKind')"
          [back]="true"
          (backTriggered)="back()"
        ></lp-popup-header>
      } @else {
        <lp-page-header
          [title]="i18n.t('newItem')"
          [sub]="i18n.t('newItemPickKind')"
          [compact]="true"
        ></lp-page-header>
      }

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-4 tw-pb-6">
        <div class="tw-grid tw-grid-cols-2 tw-gap-2">
          @for (kind of kinds; track kind) {
            <button
              type="button"
              class="tw-flex tw-flex-col tw-items-start tw-gap-1.5 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-start tw-transition-colors hover:tw-border-border-brand hover:tw-bg-bg-brand-softer"
              (click)="pick(kind)"
            >
              <lp-kind-tile [kind]="kind" size="base"></lp-kind-tile>
              <span class="tw-text-sm tw-leading-tight tw-font-semibold tw-text-main">{{
                label(kind)
              }}</span>
              <span class="tw-text-xs tw-leading-snug tw-text-muted">{{ blurb(kind) }}</span>
            </button>
          }
        </div>

        <div
          class="tw-mt-3 tw-flex tw-items-start tw-gap-2.5 tw-rounded-lg tw-border tw-border-border-brand-soft tw-bg-bg-brand-softer tw-px-3.5 tw-py-3 tw-text-xs tw-leading-relaxed tw-text-muted"
        >
          <bit-icon name="bwi-info-circle" class="tw-mt-0.5 tw-text-fg-brand"></bit-icon>
          <span>{{ i18n.t("newItemKindNotice") }}</span>
        </div>
      </div>
    </div>
  `,
})
export class NewItemV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly kinds = ITEM_KIND_ORDER;

  /** 弹窗路由在 route.data 里标记 compact；桌面端保持无返回键的页头。 */
  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);

  protected back(): void {
    void this.router.navigateByUrl("/tabs/vault");
  }

  protected label(kind: ItemKind): string {
    return this.i18n.t(ITEM_KIND_UI[kind].labelKey);
  }

  protected blurb(kind: ItemKind): string {
    return this.i18n.t(ITEM_KIND_UI[kind].blurbKey);
  }

  protected pick(kind: ItemKind): void {
    // 入口页可能带着「保存后回哪」；丢了它，桌面端保存完会落到扩展的列表路由。
    const next = this.route.snapshot.queryParamMap.get("next");
    void this.router.navigate(["/edit-item-v2"], {
      queryParams: next ? { kind, next } : { kind },
    });
  }
}
