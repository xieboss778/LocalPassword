import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ItemKind } from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import { LpPageHeaderComponent } from "../../local-ui";

interface KindTile {
  readonly kind: ItemKind;
  readonly emoji: string;
  readonly labelKey: string;
  readonly blurbKey: string;
}

const TILES: readonly KindTile[] = [
  { kind: ItemKind.Login, emoji: "🔐", labelKey: "itemKindLogin", blurbKey: "itemKindLoginBlurb" },
  { kind: ItemKind.Token, emoji: "🔑", labelKey: "itemKindToken", blurbKey: "itemKindTokenBlurb" },
  {
    kind: ItemKind.SshKey,
    emoji: "🗝️",
    labelKey: "itemKindSshKey",
    blurbKey: "itemKindSshKeyBlurb",
  },
  {
    kind: ItemKind.License,
    emoji: "📜",
    labelKey: "itemKindLicense",
    blurbKey: "itemKindLicenseBlurb",
  },
  { kind: ItemKind.Card, emoji: "💳", labelKey: "itemKindCard", blurbKey: "itemKindCardBlurb" },
  {
    kind: ItemKind.Identity,
    emoji: "🪪",
    labelKey: "itemKindIdentity",
    blurbKey: "itemKindIdentityBlurb",
  },
  {
    kind: ItemKind.Server,
    emoji: "🖥️",
    labelKey: "itemKindServer",
    blurbKey: "itemKindServerBlurb",
  },
  { kind: ItemKind.Note, emoji: "📝", labelKey: "itemKindNote", blurbKey: "itemKindNoteBlurb" },
];

/** 新建条目的第一步：选类型。八格网格，点一下进对应表单。 */
@Component({
  selector: "new-item-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, JslibModule, LpPageHeaderComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header
        [title]="i18n.t('newItem')"
        [sub]="i18n.t('newItemPickKind')"
      ></lp-page-header>
      <div class="tw-grid tw-grid-cols-2 tw-gap-2 tw-px-3 tw-pt-1">
        @for (tile of tiles; track tile.kind) {
          <button
            type="button"
            class="tw-flex tw-flex-col tw-items-start tw-gap-1 tw-rounded-[12px] tw-border tw-border-transparent tw-bg-[var(--lp-card)] tw-p-3 tw-text-left tw-shadow-[0_1px_2px_#10131812] hover:tw-border-[#c9d4ff]"
            (click)="pick(tile.kind)"
          >
            <span class="tw-text-[20px]" aria-hidden="true">{{ tile.emoji }}</span>
            <span class="tw-mt-1 tw-text-[12.5px] tw-font-semibold">{{
              i18n.t(tile.labelKey)
            }}</span>
            <span class="tw-text-[10.5px] tw-leading-snug tw-text-[var(--lp-ink-3)]">
              {{ i18n.t(tile.blurbKey) }}
            </span>
          </button>
        }
      </div>
    </div>
  `,
})
export class NewItemV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly tiles = TILES;

  protected pick(kind: ItemKind): void {
    void this.router.navigate(["/edit-item-v2"], { queryParams: { kind } });
  }
}
