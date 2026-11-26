import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import qrcodeParser from "qrcode-parser";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherType } from "@localpass/common/vault/enums";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { ButtonModule, IconModule } from "@localpass/components";
import {
  base32Encode,
  MigrationOtp,
  parseMigrationUri,
  toOtpauthUri,
} from "@localpass/importer-core";
import { ItemKind, setKind } from "@localpass/local-vault";

interface PreviewRow {
  readonly secretB32: string;
  readonly name: string;
  readonly issuer: string;
  readonly totp: string;
  readonly duplicate: boolean;
  readonly included: boolean;
}

type Step = "input" | "preview" | "done";

/**
 * Google 认证器导入（方向 C）：粘贴 → **预览勾选** → 导入。
 *
 * 与旧页面的区别就在中间那一步：每行都能看出「哪个服务、哪个账号、是不是已经有了」，
 * 已有的默认不勾，避免把同一把密钥导两遍。HOTP 计数器条目存不了，只报告数量。
 */
@Component({
  selector: "google-auth-import-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    IconModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('importGoogleAuth')"
          [sub]="subtitle()"
          [back]="true"
          (backTriggered)="goBack()"
        ></lp-popup-header>
      } @else {
        <lp-page-header [title]="i18n.t('importGoogleAuth')" [sub]="subtitle()"></lp-page-header>
      }

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @switch (step()) {
          @case ("input") {
            <div class="tw-mx-3 tw-mb-2">
              <textarea
                class="tw-h-32 tw-w-full tw-resize-none tw-rounded-xl tw-border tw-border-border-light tw-bg-background-alt tw-p-3 tw-text-sm tw-text-main tw-outline-none focus:tw-border-border-focus"
                [attr.placeholder]="i18n.t('importPasteHint')"
                [value]="rawInput()"
                (input)="onInput($event)"
              ></textarea>
            </div>
            <div class="tw-flex tw-flex-wrap tw-gap-2 tw-px-3">
              <button
                type="button"
                bitButton
                buttonType="primary"
                [disabled]="busy()"
                (click)="preview()"
              >
                {{ i18n.t("importPreview") }}
              </button>
              <label class="tw-inline-flex">
                <input type="file" accept="image/*" multiple hidden (change)="readImages($event)" />
                <span bitButton buttonType="secondary">{{ i18n.t("importFromImages") }}</span>
              </label>
            </div>
            @if (errorMessage()) {
              <p class="tw-px-4 tw-pt-3 tw-text-xs tw-text-fg-danger">
                {{ errorMessage() }}
              </p>
            }
          }

          @case ("preview") {
            <lp-group [label]="i18n.t('importPreviewTitle')">
              @for (row of rows(); track row.secretB32) {
                <lp-row
                  [icon]="row.included ? 'bwi-check-circle' : 'bwi-circle'"
                  [label]="row.issuer === '' ? row.name : row.issuer + ' · ' + row.name"
                  [sub]="row.duplicate ? i18n.t('importDuplicate') : row.totp"
                  [value]="row.duplicate ? i18n.t('importSkip') : ''"
                  [clickable]="true"
                  (activated)="toggle(row)"
                />
              }
            </lp-group>

            @if (skippedHotp()) {
              <p class="tw-px-4 tw-pt-2 tw-text-xs tw-text-muted">
                {{ i18n.t("importHotpSkipped").replace("{COUNT}", skippedHotp().toString()) }}
              </p>
            }

            <div class="tw-flex tw-gap-2 tw-px-3 tw-pt-3">
              <button
                type="button"
                bitButton
                buttonType="primary"
                [disabled]="busy() || selectedCount() === 0"
                (click)="doImport()"
              >
                {{ i18n.t("importSelected").replace("{COUNT}", selectedCount().toString()) }}
              </button>
              <button type="button" bitButton buttonType="secondary" (click)="back()">
                {{ i18n.t("back") }}
              </button>
            </div>
          }

          @case ("done") {
            <div class="tw-grid tw-h-60 tw-place-items-center">
              <div class="tw-text-center">
                <bit-icon name="bwi-check-circle" class="tw-text-4xl tw-text-fg-success"></bit-icon>
                <p class="tw-m-0 tw-mt-2 tw-text-base tw-font-semibold tw-text-main">
                  {{ i18n.t("importDone").replace("{COUNT}", importedCount().toString()) }}
                </p>
                <button
                  type="button"
                  bitButton
                  buttonType="primary"
                  class="tw-mt-4"
                  (click)="finish()"
                >
                  {{ i18n.t("continue") }}
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class GoogleAuthImportV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  protected readonly step = signal<Step>("input");
  protected readonly rawInput = signal("");
  protected readonly rows = signal<readonly PreviewRow[]>([]);
  protected readonly skippedHotp = signal(0);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly importedCount = signal(0);
  private readonly knownSecrets = signal<Set<string>>(new Set());

  protected readonly subtitle = signal("");

  protected onInput(event: Event): void {
    this.rawInput.set((event.target as HTMLTextAreaElement).value);
  }

  protected async preview(): Promise<void> {
    this.errorMessage.set(null);
    const uris = this.rawInput()
      .split(/\s+/)
      .map((value) => value.trim())
      .filter((value) => value !== "");

    if (uris.length === 0) {
      this.errorMessage.set(this.i18n.t("importPasteHint"));
      return;
    }

    await this.collect(uris);
    if (this.rows().length === 0) {
      this.errorMessage.set(this.i18n.t("importNothingFound"));
      return;
    }
    this.step.set("preview");
  }

  protected async readImages(event: Event): Promise<void> {
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
      await this.collect(uris);
      if (this.rows().length > 0) {
        this.step.set("preview");
      }
    } catch {
      this.errorMessage.set(this.i18n.t("googleAuthUnreadableImage"));
    } finally {
      input.value = "";
      this.busy.set(false);
    }
  }

  protected toggle(row: PreviewRow): void {
    if (row.duplicate) {
      return;
    }
    this.rows.update((rows) =>
      rows.map((entry) =>
        entry.secretB32 === row.secretB32 ? { ...entry, included: !entry.included } : entry,
      ),
    );
  }

  protected selectedCount(): number {
    return this.rows().filter((row) => row.included && !row.duplicate).length;
  }

  protected back(): void {
    this.step.set("input");
  }

  protected goBack(): void {
    if (this.step() === "preview") {
      this.back();
      return;
    }
    if (this.step() === "done") {
      this.finish();
      return;
    }
    void this.router.navigateByUrl("/import-source-v2");
  }

  protected async doImport(): Promise<void> {
    const chosen = this.rows().filter((row) => row.included && !row.duplicate);
    if (chosen.length === 0) {
      return;
    }

    this.busy.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      for (const row of chosen) {
        const view = new CipherView();
        view.name = row.issuer === "" ? row.name : `${row.issuer} (${row.name})`;
        view.type = CipherType.Login;
        view.login = new LoginView();
        view.login.username = row.name;
        view.login.totp = row.totp;
        setKind(view, ItemKind.Token);

        await this.cipherService.createWithServer(view, userId);
      }

      this.importedCount.set(chosen.length);
      this.step.set("done");
      this.platformUtilsService.showToast("success", "", this.i18n.t("googleAuthImported"));
    } catch {
      this.errorMessage.set(this.i18n.t("errorOccurred"));
    } finally {
      this.busy.set(false);
    }
  }

  protected finish(): void {
    void this.router.navigate(["/tabs/vault"]);
  }

  private async collect(uris: string[]): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (this.knownSecrets().size === 0) {
      const existing = await this.cipherService.getAllDecrypted(userId);
      this.knownSecrets.set(
        new Set(
          existing
            .map((cipher) => cipher.login?.totp)
            .filter((totp): totp is string => typeof totp === "string")
            .map((totp) => secretOf(totp)),
        ),
      );
    }

    const merged = new Map<string, PreviewRow>();
    let hotp = 0;

    for (const uri of uris) {
      let parsed: MigrationOtp[];
      try {
        parsed = parseMigrationUri(uri);
      } catch {
        continue;
      }

      for (const otp of parsed) {
        // HOTP 是计数器型的，这里存不了，只报数量。
        if (otp.type === "HOTP") {
          hotp++;
          continue;
        }
        const secretB32 = base32Encode(otp.secret);
        merged.set(secretB32, {
          secretB32,
          name: otp.name,
          issuer: otp.issuer,
          totp: toOtpauthUri(otp),
          duplicate: this.knownSecrets().has(secretB32),
          included: !this.knownSecrets().has(secretB32),
        });
      }
    }

    this.rows.set([...merged.values()]);
    this.skippedHotp.set(hotp);
    this.subtitle.set(this.i18n.t("importFound").replace("{COUNT}", merged.size.toString()));
  }
}

function secretOf(uri: string): string {
  const query = uri.includes("?") ? uri.slice(uri.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("secret") ?? "";
}
