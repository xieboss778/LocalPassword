import { Directive, ElementRef, HostBinding, Input, Renderer2 } from "@angular/core";

import { ProductTierType } from "@localpass/common/billing/enums";
import { LocalPassIcon } from "@localpass/components";

export function getOrgIconForTier(tier: ProductTierType): LocalPassIcon {
  switch (tier) {
    case ProductTierType.Free:
    case ProductTierType.Families:
      return "bwi-family";
    case ProductTierType.Teams:
    case ProductTierType.TeamsStarter:
    case ProductTierType.Enterprise:
      return "bwi-business";
    default:
      return "bwi-business";
  }
}

export type OrgIconSize = "default" | "small" | "large";

@Directive({
  selector: "[appOrgIcon]",
})
export class OrgIconDirective {
  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) tierType!: ProductTierType;
  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() size?: OrgIconSize = "default";

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {
    this.renderer.setAttribute(this.el.nativeElement, "aria-hidden", "true");
  }

  get iconSize(): "bwi-sm" | "bwi-lg" | "" {
    switch (this.size) {
      case "small":
        return "bwi-sm";
      case "large":
        return "bwi-lg";
      default:
        return "";
    }
  }

  get orgIcon(): LocalPassIcon {
    return getOrgIconForTier(this.tierType);
  }

  @HostBinding("class") get classList() {
    return ["bwi", this.iconSize, this.orgIcon];
  }
}
