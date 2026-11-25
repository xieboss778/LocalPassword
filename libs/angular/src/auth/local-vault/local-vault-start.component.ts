import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import { ButtonModule, TypographyModule } from "@bitwarden/components";

import { JslibModule } from "../../jslib.module";

/**
 * The first screen of a local-only vault. There is no account to log into, so it offers the ways to
 * get a vault: create one on this device, or restore one from a backup file.
 */
@Component({
  selector: "auth-local-vault-start",
  templateUrl: "./local-vault-start.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, JslibModule, ButtonModule, TypographyModule],
})
export class LocalVaultStartComponent {
  private readonly router = inject(Router);

  /** Creates a brand new vault on this device. */
  createVault = async (): Promise<void> => {
    await this.router.navigate(["/create-local-vault"]);
  };

  /**
   * Restoring from a file means creating an empty vault first and then importing into it, because
   * the importer needs somewhere to write.
   */
  restoreFromFile = async (): Promise<void> => {
    await this.router.navigate(["/create-local-vault"], { queryParams: { next: "import" } });
  };
}
