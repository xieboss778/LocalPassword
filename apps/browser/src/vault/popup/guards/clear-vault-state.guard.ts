import { inject } from "@angular/core";
import { CanDeactivateFn } from "@angular/router";
import { catchError, map, of, take, timeout } from "rxjs";

import { FeatureFlag } from "@localpass/common/enums/feature-flag.enum";
import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";

import { VaultPopupItemsService } from "../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../services/vault-popup-list-filters.service";

/**
 * The flag only decides whether legacy filter state is reset. Config can be unavailable for an
 * offline local vault, so never let the guard block navigation waiting for it.
 */
const VFO1_FLAG_TIMEOUT_MS = 250;

/**
 * Guard to clear the vault state (search and filter) when navigating away from the vault view.
 * This ensures the search and filter state is reset when navigating between different tabs,
 * except viewing or editing a cipher.
 *
 * VFO1 intentionally persists search/filter state across navigation (see
 * `VaultPopupListTableFiltersService`'s per-user state-backed filters and search text), so this
 * guard is a no-op when the flag is on. Once VFO1 is fully rolled out and the legacy
 * `VaultPopupListFiltersService` path is removed, this guard becomes dead code and can be deleted
 * entirely.
 */
export const clearVaultStateGuard: CanDeactivateFn<object> = (
  _component: object,
  currentRoute,
  currentState,
  nextState,
) => {
  if (!nextState || isCipherOpen(nextState.url)) {
    return true;
  }

  const configService = inject(ConfigService);
  const vaultPopupItemsService = inject(VaultPopupItemsService);
  const vaultPopupListFiltersService = inject(VaultPopupListFiltersService);

  return configService.getFeatureFlag$(FeatureFlag.VFO1Foundation).pipe(
    take(1),
    timeout({ first: VFO1_FLAG_TIMEOUT_MS, with: () => of(false) }),
    catchError(() => of(false)),
    map((vfo1Enabled) => {
      if (!vfo1Enabled) {
        vaultPopupItemsService.applyFilter("");
        vaultPopupListFiltersService.resetFilterForm();
      }
      return true;
    }),
  );
};

const isCipherOpen = (url: string): boolean =>
  url.includes("view-cipher") ||
  url.includes("assign-collections") ||
  url.includes("edit-cipher") ||
  url.includes("clone-cipher");
