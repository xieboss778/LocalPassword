import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpHeroComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { AsyncActionsModule, ButtonModule, TypographyModule } from "@localpass/components";
import { LocalWebAuthnPrfEnrollmentService } from "@localpass/key-management-ui";

/**
 * Registers a security key (PRF) as an unlock method for the extension. The vault must be
 * unlocked, because the credential wraps the user key.
 */
@Component({
  selector: "auth-security-key",
  templateUrl: "./security-key.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    TypographyModule,
    LpGroupComponent,
    LpHeroComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
})
export class SecurityKeyComponent implements OnInit {
  private readonly enrollmentService = inject(LocalWebAuthnPrfEnrollmentService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);

  protected readonly supported = signal(false);
  protected readonly registeredCount = signal(0);
  protected readonly busy = signal(false);
  protected readonly registeredText = computed(() =>
    this.i18nService.t("registeredKeysCount", this.registeredCount().toString()),
  );

  protected goBack(): void {
    void this.router.navigateByUrl("/settings-security-v2");
  }

  async ngOnInit(): Promise<void> {
    this.supported.set(this.enrollmentService.isSupported());
    await this.refresh();
  }

  protected readonly enroll = async (): Promise<void> => {
    this.busy.set(true);
    try {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      if (account == null) {
        return;
      }

      await this.enrollmentService.enroll(account.id, account.email, account.name ?? account.email);
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
