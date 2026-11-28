import { CanDeactivateFn } from "@angular/router";

import { VaultDesktopV2Component } from "../../../vault/app/vault-desktop-v2/vault-desktop-v2.component";

export const unsavedVaultEditsGuard: CanDeactivateFn<VaultDesktopV2Component> = (component) => {
  if (component == null) {
    return true;
  }
  return component.confirmNavigationAway();
};
