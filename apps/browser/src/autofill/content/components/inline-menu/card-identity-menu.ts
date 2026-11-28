import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { EventSecurity } from "../../../utils/event-security";

import { getAvatarTone } from "./avatar";
import { InlineMenuFooter } from "./menu-footer";
import { InlineMenuHeader } from "./menu-header";
import { InlineMenuShell } from "./menu-shell";
import { inlineMenuColors, inlineMenuScrollbar } from "./menu-styles";
import {
  inlineMenuAvatarStyles,
  inlineMenuPillStyles,
  inlineMenuRowActionStyles,
  inlineMenuRowMainStyles,
  inlineMenuRowStyles,
  inlineMenuRowSubStyles,
  inlineMenuRowTitleStyles,
  inlineMenuRowTitleTextStyles,
  showInlineMenuFillFeedback,
} from "./row-styles";

export type InlineMenuCardIdentityKind = "card" | "identity";

export type InlineMenuCardIdentityMenuI18n = {
  cardsTitle: string;
  identityTitle: string;
  favorite: string;
  fill: string;
  fillCardAria: string;
  fillIdentityAria: string;
  cardMaskedNote: string;
  identityFillNote: string;
  keysHint: string;
  closeAria: string;
  showAll: string;
  cardMenuAriaLabel: string;
  identityMenuAriaLabel: string;
};

export type InlineMenuCardIdentityMenuProps = {
  theme: Theme;
  kind: InlineMenuCardIdentityKind;
  ciphers: InlineMenuCipherData[];
  activeRowKey?: string;
  i18n: InlineMenuCardIdentityMenuI18n;
  onFill: (cipher: InlineMenuCipherData, event: Event) => void;
  onClose: (event: Event) => void;
};

/**
 * Favorites take the place of a default item: they sort above the background order, which is
 * otherwise preserved so recent-use ordering from the background remains intact.
 */
export function orderCardIdentityCiphers(ciphers: InlineMenuCipherData[]): InlineMenuCipherData[] {
  return [...ciphers].sort((first, second) => Number(second.favorite) - Number(first.favorite));
}

/**
 * Compact card and identity suggestions. Rows show only the information needed to choose the
 * right item: favorites sort first, card numbers stay masked to their last four digits, and
 * identity rows show the saved address instead of the username.
 */
export function InlineMenuCardIdentityMenu({
  theme,
  kind,
  ciphers,
  activeRowKey,
  i18n,
  onFill,
  onClose,
}: InlineMenuCardIdentityMenuProps) {
  const orderedCiphers = orderCardIdentityCiphers(ciphers);
  const resolvedActiveRowKey = orderedCiphers.some((cipher) => cipher.id === activeRowKey)
    ? activeRowKey
    : orderedCiphers[0]?.id;
  const title = kind === "card" ? i18n.cardsTitle : i18n.identityTitle;
  const ariaLabel = kind === "card" ? i18n.cardMenuAriaLabel : i18n.identityMenuAriaLabel;

  return InlineMenuShell({
    theme,
    ariaLabel,
    dataTestId: kind === "card" ? "inline-menu-card-list" : "inline-menu-identity-list",
    children: html`
      ${InlineMenuHeader({
        theme,
        domain: title,
        contextText: "",
        showContext: false,
        i18n: { closeAria: i18n.closeAria, showAll: i18n.showAll },
        onClose,
      })}
      <div data-cipher-list-scroll class=${scrollStyles(theme)}>
        ${orderedCiphers.map((cipher) =>
          rowTemplate({
            theme,
            kind,
            cipher,
            active: cipher.id === resolvedActiveRowKey,
            i18n,
            onFill,
          }),
        )}
      </div>
      ${InlineMenuFooter({
        theme,
        hint: {
          text: kind === "card" ? i18n.cardMaskedNote : i18n.identityFillNote,
          right: i18n.keysHint,
        },
      })}
    `,
  });
}

function rowTemplate({
  theme,
  kind,
  cipher,
  active,
  i18n,
  onFill,
}: {
  theme: Theme;
  kind: InlineMenuCardIdentityKind;
  cipher: InlineMenuCipherData;
  active: boolean;
  i18n: InlineMenuCardIdentityMenuI18n;
  onFill: (cipher: InlineMenuCipherData, event: Event) => void;
}) {
  const subtitle = cardIdentitySubtitle(cipher, kind);
  const ariaLabel = (kind === "card" ? i18n.fillCardAria : i18n.fillIdentityAria).replace(
    "{name}",
    cipher.name,
  );
  const initial = cipher.name.charAt(0).toUpperCase() || "?";

  const handleClick = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onFill(cipher, event);
      showInlineMenuFillFeedback(event.currentTarget as HTMLElement, theme);
    }
  };

  return html`
    <button
      type="button"
      tabindex="-1"
      data-inline-row-key=${cipher.id}
      data-inline-menu-focusable
      data-fill-cipher=${cipher.id}
      data-inline-kind=${kind}
      aria-label=${ariaLabel}
      class=${`${inlineMenuRowStyles(theme)}${active ? " is-active" : ""}`}
      @click=${handleClick}
    >
      <span class=${inlineMenuAvatarStyles(theme, getAvatarTone(cipher.id))} aria-hidden="true">
        ${initial}
      </span>
      <span class=${inlineMenuRowMainStyles()}>
        <span class=${inlineMenuRowTitleStyles(theme)}>
          <span class=${inlineMenuRowTitleTextStyles()}>${cipher.name}</span>
          ${
            cipher.favorite
              ? html`<span class=${inlineMenuPillStyles(theme)}>${i18n.favorite}</span>`
              : nothing
          }
        </span>
        ${
          subtitle
            ? html`<span
                class=${`${inlineMenuRowSubStyles(theme)}${kind === "card" ? " is-mono" : ""}`}
                title=${subtitle}
              >
                ${subtitle}
              </span>`
            : nothing
        }
      </span>
      <span class=${inlineMenuRowActionStyles(theme)}>${i18n.fill}</span>
    </button>
  `;
}

function cardIdentitySubtitle(cipher: InlineMenuCipherData, kind: InlineMenuCardIdentityKind) {
  if (kind === "card") {
    return [cipher.cardMask || cipher.card, cipher.cardExpiry].filter(Boolean).join(" · ");
  }

  return cipher.identity?.address || cipher.identity?.fullName || cipher.identity?.username || "";
}

const scrollStyles = (theme: Theme) => css`
  max-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;

  .is-mono {
    font-family: ${inlineMenuColors(theme).mono};
  }

  ${inlineMenuScrollbar(theme)}
`;
