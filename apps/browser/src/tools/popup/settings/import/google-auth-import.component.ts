import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import qrcodeParser from "qrcode-parser";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  PlatformUtilsService,
} from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import {
  base32Encode,
  MigrationOtp,
  parseMigrationUri,
  toOtpauthUri,
} from "@bitwarden/importer-core";

/** One account read out of a migration export, ready to be previewed. */
type PreviewedAccount = MigrationOtp & { readonly totp: string };

/**
 * Imports Google Authenticator's `otpauth-migration://` export: paste the URI, or pick screenshot
 * images of the export QR code. Every account becomes a login with its TOTP seed filled in.
 */
@Component({
  selector: "tools-google-auth-import",
  templateUrl: "./google-auth-import.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    TypographyModule,
  ],
})
export class GoogleAuthImportComponent {
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly accounts = signal<PreviewedAccount[]>([]);
  protected readonly skippedHotp = signal(0);
  protected readonly busy = signal(false);
  protected rawInput = "";

  /** Parses whatever is currently in the textarea into a preview. */
  protected readonly readInput = (): void => {
    const uris = this.rawInput
      .split(/\s+/)
      .map((value) => value.trim())
      .filter((value) => value !== "");

    this.collect(uris);
  };

  /** Reads QR codes out of the selected images and merges them into the preview. */
  protected readonly readImages = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }

    this.busy.set(true);
    try {
      const uris: string[] = [];
      for (const file of files) {
        const objectUrl = URL.createObjectURL(file);
        try {
          const decoded = await qrcodeParser(objectUrl);
          if (typeof decoded === "string") {
            uris.push(decoded);
          }
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
      this.collect(uris);
    } catch {
      this.platformUtilsService.showToast(
        "error",
        "",
        this.i18nService.t("googleAuthUnreadableImage"),
      );
    } finally {
      input.value = "";
      this.busy.set(false);
    }
  };

  /** Creates one login per previewed account and opens the vault. */
  protected readonly doImport = async (): Promise<void> => {
    const accounts = this.accounts();
    if (accounts.length === 0) {
      return;
    }

    this.busy.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const existing = await this.cipherService.getAllDecrypted(userId);
      const knownSecrets = new Set(
        existing
          .map((cipher) => cipher.login?.totp)
          .filter((totp): totp is string => typeof totp === "string")
          .map((totp) => secretOf(totp)),
      );

      let imported = 0;
      for (const account of accounts) {
        if (knownSecrets.has(base32Encode(account.secret))) {
          continue;
        }

        const view = new CipherView();
        view.type = CipherType.Login;
        view.name = account.issuer === "" ? account.name : `${account.issuer} (${account.name})`;
        view.login = new LoginView();
        view.login.username = account.name;
        view.login.totp = account.totp;

        await this.cipherService.createWithServer(view, userId);
        imported++;
      }

      this.platformUtilsService.showToast(
        "success",
        "",
        this.i18nService.t("googleAuthImported"),
      );
      await this.router.navigate(["/tabs/vault"]);
    } catch {
      this.platformUtilsService.showToast("error", "", this.i18nService.t("errorOccurred"));
    } finally {
      this.busy.set(false);
    }
  };

  private collect(uris: string[]): void {
    const merged = new Map<string, PreviewedAccount>();
    let hotp = 0;

    for (const uri of uris) {
      let parsed: MigrationOtp[];
      try {
        parsed = parseMigrationUri(uri);
      } catch {
        continue;
      }

      for (const otp of parsed) {
        // Bitwarden cannot store counter-based HOTP entries; they are reported, not imported.
        if (otp.type === "HOTP") {
          hotp++;
          continue;
        }
        merged.set(base32Encode(otp.secret), { ...otp, totp: toOtpauthUri(otp) });
      }
    }

    this.accounts.set([...merged.values()]);
    this.skippedHotp.set(hotp);
  }
}

/** The base32 secret inside an `otpauth://` uri, for de-duplication. */
function secretOf(uri: string): string {
  const query = uri.includes("?") ? uri.slice(uri.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("secret") ?? "";
}
