import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  PlatformUtilsService,
} from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AsyncActionsModule, ButtonModule, TypographyModule } from "@bitwarden/components";
import { LocalWebAuthnPrfEnrollmentService } from "@bitwarden/key-management-ui";

import { JslibModule } from "../../../jslib.module";

/**
 * Registers a security key (PRF) as an unlock method for the extension. The vault must be
 * unlocked, because the credential wraps the user key.
 */
@Component({
  selector: "auth-security-key",
  templateUrl: "./security-key.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, JslibModule, AsyncActionsModule, ButtonModule, TypographyModule],
})
export class SecurityKeyComponent implements OnInit {
  private readonly enrollmentService = inject(LocalWebAuthnPrfEnrollmentService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);

  protected readonly supported = signal(false);
  protected readonly registeredCount = signal(0);
  protected readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    this.supported.set(this.enrollmentService.isSupported());
    await this.refresh();
  }

  protected readonly enroll = async (): Promise<void> => {
    this.busy.set(true);
    try {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

      await this.enrollmentService.enroll(userId, account.email, account.name ?? account.email);
      this.platformUtilsService.showToast("success", "", this.i18nService.t("securityKeyEnrolled"));
      await this.refresh();
    } catch {
      this.platformUtilsService.showToast(
        "error",
        "",
        this.i18nService.t("securityKeyEnrollFailed"),
      );
    } finally {
      this.busy.set(false);
    }
  };

  protected readonly removeAll = async (): Promise<void> => {
    this.busy.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.enrollmentService.removeAll(userId);
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  };

  private async refresh(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.registeredCount.set(await this.enrollmentService.count(userId));
  }
}
