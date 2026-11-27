import { CommonModule } from "@angular/common";
import { Component, OnInit, input, output } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";
import { UserKey } from "@localpass/common/types/key";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconModule,
  LinkModule,
} from "@localpass/components";

import { WebAuthnPrfUnlockService } from "../services/webauthn-prf-unlock.service";

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-unlock-via-prf",
  standalone: true,
  imports: [CommonModule, JslibModule, ButtonModule, AsyncActionsModule, IconModule, LinkModule],
  template: `
    @if (isAvailable) {
      @if (link()) {
        <button
          type="button"
          bitLink
          class="tw-inline-flex tw-items-center tw-gap-2 tw-px-0 tw-text-sm tw-font-medium"
          (click)="unlockViaPrf()"
          [disabled]="unlocking"
          data-testid="unlock-with-passkey-button"
        >
          @if (linkIcon()) {
            <bit-icon name="bwi-key" aria-hidden="true"></bit-icon>
          }
          {{ "unlockWithSecurityKey" | i18n }}
        </button>
      } @else if (formButton()) {
        <button
          type="button"
          bitButton
          bitFormButton
          buttonType="secondary"
          block
          startIcon="bwi-key"
          (click)="unlockViaPrf()"
          [disabled]="unlocking"
          [loading]="unlocking"
          data-testid="unlock-with-passkey-button"
        >
          {{ "unlockWithSecurityKey" | i18n }}
        </button>
      } @else {
        <button
          type="button"
          bitButton
          buttonType="secondary"
          block
          startIcon="bwi-key"
          (click)="unlockViaPrf()"
          [disabled]="unlocking"
          [loading]="unlocking"
          data-testid="unlock-with-passkey-button"
        >
          {{ "unlockWithSecurityKey" | i18n }}
        </button>
      }
    }
  `,
})
export class UnlockViaPrfComponent implements OnInit {
  readonly formButton = input<boolean>(false);
  /** Renders the quieter text-link form used on the LocalPass lock screens. */
  readonly link = input<boolean>(false);
  readonly linkIcon = input<boolean>(false);
  readonly unlockSuccess = output<UserKey>();

  unlocking = false;
  isAvailable = false;
  private userId: UserId | null = null;

  constructor(
    private accountService: AccountService,
    private webAuthnPrfUnlockService: WebAuthnPrfUnlockService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private logService: LogService,
  ) {}

  async ngOnInit(): Promise<void> {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount?.id) {
      this.userId = activeAccount.id;
      this.isAvailable = await this.webAuthnPrfUnlockService.isPrfUnlockAvailable(this.userId);
    }
  }

  async unlockViaPrf(): Promise<void> {
    if (!this.userId || !this.isAvailable) {
      return;
    }

    this.unlocking = true;

    try {
      const userKey = await this.webAuthnPrfUnlockService.unlockVaultWithPrf(this.userId);
      this.unlockSuccess.emit(userKey);
    } catch (error) {
      this.logService.error("[UnlockViaPrfComponent] Failed to unlock via PRF:", error);

      let errorMessage = this.i18nService.t("unexpectedError");

      // Handle specific PRF error cases
      if (error instanceof Error) {
        if (error.message.includes("No PRF credentials")) {
          errorMessage = this.i18nService.t("noPrfCredentialsAvailable");
        } else if (error.message.includes("canceled")) {
          // User canceled the operation, don't show error
          this.unlocking = false;
          return;
        }
      }

      await this.dialogService.openSimpleDialog({
        title: { key: "error" },
        content: errorMessage,
        acceptButtonText: { key: "ok" },
        type: "danger",
      });
    } finally {
      this.unlocking = false;
    }
  }
}
