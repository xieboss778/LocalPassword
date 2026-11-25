import { NgModule } from "@angular/core";

import { DialogService } from "@localpass/components";
import { safeProvider } from "@localpass/ui-common";
import { UserCryptoDialogService } from "@localpass/user-crypto-management";

import { DefaultUserCryptoDialogService } from "./trust/default-user-crypto-dialog.service";

/**
 * Angular module that wires the Angular-dialog implementations of the
 * user-crypto-management abstractions. Import this module in an app's root
 * services module to get the dialog-based trust verification flow.
 */
@NgModule({
  imports: [],
  providers: [
    safeProvider({
      provide: UserCryptoDialogService,
      useClass: DefaultUserCryptoDialogService,
      deps: [DialogService],
    }),
  ],
  exports: [],
})
export class KeyManagementUiModule {}
