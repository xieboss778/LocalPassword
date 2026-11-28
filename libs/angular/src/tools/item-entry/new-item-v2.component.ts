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
      class="agy tw-flex tw-h-full tw-flex-col"
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

      <div class="agy-ext-scroll">
        <h2 class="agy-seclbl">{{ i18n.t("newItemPickKind") }}</h2>
        <div class="agy-typegrid">
          @for (kind of kinds; track kind) {
            <button type="button" (click)="pick(kind)">
              <lp-kind-tile [kind]="kind" size="xs"></lp-kind-tile>
              <span>{{ label(kind) }}</span>
            </button>
          }
        </div>

        <div class="agy-callout tw-mt-2">
          <bit-icon name="bwi-info-circle" class="tw-text-xs tw-text-fg-brand"></bit-icon>
          <div>{{ i18n.t("newItemKindNotice") }}</div>
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

  protected pick(kind: ItemKind): void {
    // 入口页可能带着「保存后回哪」；丢了它，桌面端保存完会落到扩展的列表路由。
    const next = this.route.snapshot.queryParamMap.get("next");
    void this.router.navigate(["/edit-item-v2"], {
      queryParams: next ? { kind, next } : { kind },
    });
  }
}
