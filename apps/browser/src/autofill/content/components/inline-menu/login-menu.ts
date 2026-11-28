import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { Clock, Key, Search } from "../icons";

import { InlineMenuAccountRow, InlineMenuAccountRowI18n } from "./account-row";
import { InlineMenuEmptyState } from "./empty-state";
import {
  InlineMenuAccountMethod,
  InlineMenuGroupData,
  InlineMenuTotpRowData,
  getLoginGroups,
  getTotpRows,
} from "./login-menu-data";
import { InlineMenuFooter } from "./menu-footer";
import { InlineMenuHeader } from "./menu-header";
import { InlineMenuShell } from "./menu-shell";
import { inlineMenuColors, inlineMenuScrollbar } from "./menu-styles";
import { InlineMenuTotpRow, InlineMenuTotpRowI18n } from "./totp-row";

export type InlineMenuLoginMenuI18n = InlineMenuAccountRowI18n &
  InlineMenuTotpRowI18n & {
    accountCount: string;
    sameDomainRecent: string;
    filterMatch: string;
    showAll: string;
    passkeysGroup: string;
    passwordsGroup: string;
    totpGroup: string;
    keyboardHint: string;
    totpKeyboardHint: string;
    newLogin: string;
    newLoginAria: string;
    totpContext: string;
    totpRefreshNote: string;
    totpFill: string;
    totpCopyOnly?: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyDescriptionNoQuery: string;
    showAllAccounts: string;
    generatePassword: string;
    searchAll: string;
    readOnlyDomain: string;
    closeAria: string;
    menuAriaLabel: string;
    totpMenuAriaLabel: string;
  };

export type InlineMenuLoginMenuProps = {
  theme: Theme;
  domain: string;
  /** Every cipher matching the current username filter, including those not loaded yet. */
  ciphers: InlineMenuCipherData[];
  /** The current scroll page of ciphers. */
  visibleCiphers: InlineMenuCipherData[];
  query: string;
  isTotp?: boolean;
  selectedTotpAccountId?: string | null;
  activeRowKey?: string;
  i18n: InlineMenuLoginMenuI18n;
  onFill: (cipher: InlineMenuCipherData, method: InlineMenuAccountMethod, event: Event) => void;
  onFillTotp: (cipher: InlineMenuCipherData, event: Event) => void;
  onCopyTotp?: (cipher: InlineMenuCipherData, event: Event) => void;
  onNewItem: (event: Event) => void;
  onGeneratePassword: (event: Event) => void;
  onSearchAll: (event: Event) => void;
  onClearFilter: (event: Event) => void;
  onClose: (event: Event) => void;
  onTotpPeriodElapsed?: () => void;
};

export function InlineMenuLoginMenu({
  theme,
  domain,
  ciphers,
  visibleCiphers,
  query,
  isTotp = false,
  selectedTotpAccountId = null,
  activeRowKey,
  i18n,
  onFill,
  onFillTotp,
  onCopyTotp,
  onNewItem,
  onGeneratePassword,
  onSearchAll,
  onClearFilter,
  onClose,
  onTotpPeriodElapsed,
}: InlineMenuLoginMenuProps) {
  const colors = inlineMenuColors(theme);
  const groups = getLoginGroups(ciphers, query);
  const visibleRowKeys = new Set<string>();
  groups.groups.forEach((group) =>
    group.rows.forEach((row) => {
      if (visibleCiphers.some((cipher) => cipher.id === row.cipher.id)) {
        visibleRowKeys.add(row.rowKey);
      }
    }),
  );
  const visibleGroups = groups.groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => visibleRowKeys.has(row.rowKey)),
    }))
    .filter((group) => group.rows.length > 0);

  const totpRows = getTotpRows(ciphers, query, selectedTotpAccountId).filter((row) =>
    visibleCiphers.some((cipher) => cipher.id === row.cipher.id),
  );
  const allTotpRows = getTotpRows(ciphers, query, selectedTotpAccountId);
  const currentTotpId = allTotpRows[0]?.cipher.id ?? null;
  const currentTotpUsername = allTotpRows[0]?.username ?? "";
  const firstVisibleRowKey = isTotp
    ? (totpRows.find((row) => row.cipher.id === currentTotpId)?.rowKey ?? totpRows[0]?.rowKey)
    : (visibleGroups[0]?.rows[0]?.rowKey ?? undefined);
  const resolvedActiveRowKey = activeRowKey ?? firstVisibleRowKey;

  const hasRows = isTotp ? totpRows.length > 0 : visibleGroups.length > 0;
  const matchedAccounts = isTotp ? allTotpRows.length : groups.matchedAccounts;
  const isFilteredEmpty =
    !isTotp && !!query && groups.matchedAccounts === 0 && groups.totalAccounts > 0;
  const isNoMatch = !isTotp && !query && groups.totalAccounts === 0;
  const activeTotpCipher =
    allTotpRows.find((row) => row.rowKey === resolvedActiveRowKey)?.cipher ??
    allTotpRows[0]?.cipher;
  const contextText = isTotp
    ? currentTotpUsername
      ? i18n.totpContext.replace("{username}", currentTotpUsername)
      : i18n.emptyDescriptionNoQuery
    : query
      ? i18n.filterMatch
          .replace("{query}", query)
          .replace("{matched}", `${groups.matchedAccounts}`)
          .replace("{total}", `${groups.totalAccounts}`)
      : i18n.sameDomainRecent;

  const emptyDescription = query
    ? i18n.emptyDescription.replace("{query}", query)
    : i18n.emptyDescriptionNoQuery;

  const headerCountText = isFilteredEmpty
    ? `${groups.matchedAccounts} / ${groups.totalAccounts}`
    : i18n.accountCount.replace("{count}", `${matchedAccounts}`);

  return InlineMenuShell({
    theme,
    ariaLabel: isTotp ? i18n.totpMenuAriaLabel : i18n.menuAriaLabel,
    dataTestId: isTotp ? "inline-menu-totp-list" : "inline-menu-login-list",
    children: html`
      ${InlineMenuHeader({
        theme,
        domain,
        countText: headerCountText,
        countTone: isFilteredEmpty ? "warn" : "default",
        contextText,
        showContext: !isNoMatch,
        showClear: !isTotp && !!query && groups.matchedAccounts > 0,
        i18n: { closeAria: i18n.closeAria, showAll: i18n.showAll },
        onClear: onClearFilter,
        onClose,
      })}
      <div class=${bodyStyles(theme)} data-inline-menu-body>
        ${
          hasRows
            ? html`<div data-cipher-list-scroll class=${scrollStyles(theme)}>
                ${
                  isTotp
                    ? html`${groupHeading(theme, i18n.totpGroup, totpRows.length)}
                      ${totpRows.map((row) =>
                        totpRowTemplate(row, {
                          theme,
                          activeRowKey: resolvedActiveRowKey,
                          currentTotpId,
                          i18n,
                          onFillTotp,
                          onTotpPeriodElapsed,
                        }),
                      )}`
                    : visibleGroups.map((group) =>
                        loginGroupTemplate(group, theme, i18n, {
                          activeRowKey: resolvedActiveRowKey,
                          currentAccountId: groups.currentAccountId,
                          lastUsedAccountId: groups.lastUsedAccountId,
                          onFill,
                        }),
                      )
                }
              </div>`
            : InlineMenuEmptyState({
                theme,
                totalAccounts: groups.totalAccounts,
                showClear: !!query && groups.totalAccounts > 0,
                i18n: {
                  title: i18n.emptyTitle,
                  description: emptyDescription,
                  showAll: i18n.showAllAccounts,
                },
                onClear: onClearFilter,
                newItem: {
                  text: i18n.newLogin,
                  aria: i18n.newLoginAria,
                  onAction: onNewItem,
                },
                ...(isNoMatch
                  ? {
                      generatePassword: {
                        text: i18n.generatePassword,
                        aria: i18n.generatePassword,
                        onAction: onGeneratePassword,
                      },
                    }
                  : {}),
              })
        }
      </div>
      ${InlineMenuFooter({
        theme,
        actions: isTotp
          ? onCopyTotp && activeTotpCipher && i18n.totpCopyOnly
            ? [
                {
                  text: i18n.totpCopyOnly,
                  aria: i18n.totpCopyOnly,
                  icon: Clock({ theme, color: colors.brand }),
                  testId: "inline-menu-totp-copy-only",
                  handleAction: (event) => onCopyTotp(activeTotpCipher, event),
                },
              ]
            : undefined
          : [
              {
                text: i18n.generatePassword,
                aria: i18n.generatePassword,
                icon: Key({ theme, color: colors.brand }),
                testId: "inline-menu-generate-password",
                handleAction: onGeneratePassword,
              },
              {
                text: i18n.searchAll,
                aria: i18n.searchAll,
                icon: Search({ theme, color: colors.brand }),
                testId: "inline-menu-search-all",
                handleAction: onSearchAll,
              },
            ],
        note: isTotp
          ? {
              text: i18n.totpRefreshNote,
              icon: Clock({ theme, color: colors.brand }),
            }
          : { text: i18n.readOnlyDomain },
        hint: isTotp ? i18n.totpKeyboardHint : i18n.keyboardHint,
      })}
    `,
  });
}

function groupHeading(theme: Theme, text: string, count: number) {
  return html`
    <div class=${groupHeadingStyles(theme)} role="presentation">
      <span>${text} · ${count}</span>
    </div>
  `;
}

function loginGroupTemplate(
  group: InlineMenuGroupData,
  theme: Theme,
  i18n: InlineMenuLoginMenuI18n,
  options: {
    activeRowKey?: string;
    currentAccountId: string | null;
    lastUsedAccountId: string | null;
    onFill: (cipher: InlineMenuCipherData, method: InlineMenuAccountMethod, event: Event) => void;
  },
) {
  const title = group.key === "passkey" ? i18n.passkeysGroup : i18n.passwordsGroup;

  return html`
    <div class=${groupStyles(theme)} data-inline-group=${group.key}>
      ${groupHeading(theme, title, group.rows.length)}
      ${group.rows.map((row) =>
        InlineMenuAccountRow({
          theme,
          cipher: row.cipher,
          method: row.method,
          rowKey: row.rowKey,
          username: row.username,
          label: row.label,
          hasTotp: row.hasTotp,
          active: row.rowKey === options.activeRowKey,
          showCurrent: row.cipher.id === options.currentAccountId,
          showLastUsed: !options.currentAccountId && row.cipher.id === options.lastUsedAccountId,
          i18n,
          onFill: options.onFill,
        }),
      )}
    </div>
  `;
}

function totpRowTemplate(
  row: InlineMenuTotpRowData,
  options: {
    theme: Theme;
    activeRowKey?: string;
    currentTotpId: string | null;
    i18n: InlineMenuLoginMenuI18n;
    onFillTotp: (cipher: InlineMenuCipherData, event: Event) => void;
    onTotpPeriodElapsed?: () => void;
  },
) {
  return InlineMenuTotpRow({
    theme: options.theme,
    cipher: row.cipher,
    rowKey: row.rowKey,
    username: row.username,
    label: row.label,
    code: row.code,
    period: row.period,
    active: row.rowKey === options.activeRowKey,
    isCurrent: row.cipher.id === options.currentTotpId,
    masked: !!row.cipher.reprompt,
    i18n: { ...options.i18n, fill: options.i18n.totpFill },
    onFill: options.onFillTotp,
    onPeriodElapsed: options.onTotpPeriodElapsed,
  });
}

const bodyStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    max-height: 320px;
    overflow: hidden;
    background: ${colors.surface};
  `;
};

const scrollStyles = (theme: Theme) => css`
  max-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;

  ${inlineMenuScrollbar(theme)}
`;

const groupStyles = (theme: Theme) => css`
  & + & > div:first-child {
    border-top: 1px solid ${inlineMenuColors(theme).borderLight};
  }
`;

const groupHeadingStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    min-height: 18px;
    padding: 0 8px;
    background: ${colors.surfaceAlt};
    color: ${colors.textSubtle};
    font-size: 9px;
    font-weight: 650;
    letter-spacing: 0.06em;
    line-height: 12px;
    text-transform: uppercase;
  `;
};
