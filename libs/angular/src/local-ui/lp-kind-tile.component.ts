import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { IconTileComponent, IconTileSize } from "@localpass/components";
import { ItemKind } from "@localpass/local-vault";

import { ITEM_KIND_UI } from "./item-kind-ui";

/** 条目类别的彩色图标块。列表、详情、选择器共用同一套映射。 */
@Component({
  selector: "lp-kind-tile",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconTileComponent],
  host: { class: "tw-inline-flex" },
  template: `<bit-icon-tile
    [icon]="meta().icon"
    [variant]="meta().variant"
    [size]="size()"
  ></bit-icon-tile>`,
})
export class LpKindTileComponent {
  readonly kind = input.required<ItemKind>();
  readonly size = input<IconTileSize>("base");

  protected readonly meta = computed(() => ITEM_KIND_UI[this.kind()]);
}
