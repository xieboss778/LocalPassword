import { inject } from "@angular/core";
import { EMPTY, Observable } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@localpass/angular/billing/components";
import { PremiumUpgradePromptService } from "@localpass/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService } from "@localpass/components";

/**
 * This class handles the premium upgrade process for the desktop.
 */
export class DesktopPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private dialogService = inject(DialogService);

  readonly upgradeConfirmed$: Observable<boolean> = EMPTY;

  async promptForPremium() {
    PremiumUpgradeDialogComponent.open(this.dialogService);
  }
}
