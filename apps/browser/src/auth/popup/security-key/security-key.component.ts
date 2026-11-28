import { CommonModule, Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { DialogService, IconModule } from "@localpass/components";
import { LocalWebAuthnPrfEnrollmentService } from "@localpass/key-management-ui";
import type { WebAuthnPrfUnlockOption } from "@localpass/sdk-internal";

/**
 * Registers a security key (PRF) as an unlock method for the extension. The vault must be
 * unlocked, because the credential wraps the user key.
 */
@Component({
  selector: "auth-security-key",
  templateUrl: "./security-key.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    JslibModule,
    IconModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
})
export class SecurityKeyComponent implements OnInit {
  private readonly enrollmentService = inject(LocalWebAuthnPrfEnrollmentService);
  private readonly accountService = inject(AccountService);
  private readonly toast = inject(LpToastService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);

  protected readonly supported = signal(false);
  protected readonly registeredKeys = signal<WebAuthnPrfUnlockOption[]>([]);
  protected readonly busy = signal(false);

  protected goBack(): void {
    const next = this.route.snapshot.queryParamMap.get("next");
    if (next) {
      void this.router.navigateByUrl(next);
      return;
    }
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
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
      this.toast.show(this.i18nService.t("securityKeyEnrolled"));
      await this.refresh();
    } catch {
      this.toast.show(this.i18nService.t("securityKeyEnrollFailed"));
    } finally {
      this.busy.set(false);
    }
  };

  protected maskedCredentialId(option: WebAuthnPrfUnlockOption): string {
    const id = option.credentialId;
    if (id == null || id.length <= 8) {
      return "••••";
    }
    return `${id.slice(0, 4)}…${id.slice(-4)}`;
  }

  protected readonly removeKey = async (option: WebAuthnPrfUnlockOption): Promise<void> => {
    const credentialId = option.credentialId;
    if (credentialId == null) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "securityKeyRemoveOne" },
      content: { key: "securityKeyRemoveOneConfirm" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    this.busy.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.enrollmentService.removeOne(userId, credentialId);
      await this.refresh();
      this.toast.show(this.i18nService.t("securityKeyRemovedOne"));
    } finally {
      this.busy.set(false);
    }
  };

  protected readonly removeAll = async (): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "securityKeyRemove" },
      content: { key: "securityKeyRemoveConfirm" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    this.busy.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.enrollmentService.removeAll(userId);
      await this.refresh();
      this.toast.show(this.i18nService.t("securityKeyRemoved"));
    } finally {
      this.busy.set(false);
    }
  };

  private async refresh(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const keys = await this.enrollmentService.list(userId);
    this.registeredKeys.set(keys);
  }
}
