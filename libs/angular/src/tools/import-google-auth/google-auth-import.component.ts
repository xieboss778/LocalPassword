import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherType } from "@localpass/common/vault/enums";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { IconModule } from "@localpass/components";
import {
  base32Encode,
  MigrationOtp,
  parseMigrationUri,
  toOtpauthUri,
} from "@localpass/importer-core";
import { ItemKind, setKind } from "@localpass/local-vault";

import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
  LpToastService,
} from "../../local-ui";

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
 * Google 认证器导入（扩展与桌面共用）：粘贴或读取截图 → 预览勾选 → 写入本机库。
 *
 * 预览按 TOTP 密钥去重，已有的默认不勾，避免同一把密钥导两遍；HOTP 存不了，只报告数量。
 * 解析、去重和写入全在本机内存中完成，不发任何网络请求。
 */
@Component({
  selector: "lp-google-auth-import",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    IconModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('importGoogleAuth')"
          [sub]="subtitle()"
          [back]="true"
          (backTriggered)="goBack()"
        ></lp-popup-header>
      } @else {
        <lp-page-header [title]="i18n.t('importGoogleAuth')" [sub]="subtitle()">
          <button type="button" class="agy-btn agy-sm" (click)="goBack()">
            {{ i18n.t("back") }}
          </button>
        </lp-page-header>
      }

      <div class="agy-ext-scroll">
        @switch (step()) {
          @case ("input") {
            <div class="agy-grp">
              <textarea
                class="agy-input tw-h-32 tw-resize-none tw-p-2"
                [attr.placeholder]="i18n.t('importPasteHint')"
                [value]="rawInput()"
                (input)="onInput($event)"
              ></textarea>
            </div>
            <div class="tw-flex tw-flex-wrap tw-gap-1.5 tw-pt-2">
              <button
                type="button"
                class="agy-btn agy-primary agy-lg"
                [disabled]="busy()"
                (click)="preview()"
              >
                {{ i18n.t("importPreview") }}
              </button>
              @if (captureTabQr()) {
                <button
                  type="button"
                  class="agy-btn agy-lg"
                  [disabled]="busy()"
                  (click)="scanActiveTab()"
                >
                  <bit-icon name="bwi-camera" class="tw-text-xs"></bit-icon>
                  {{ i18n.t("importFromActiveTab") }}
                </button>
              }
              <label class="agy-btn agy-lg tw-cursor-pointer">
                <input type="file" accept="image/*" multiple hidden (change)="readImages($event)" />
                {{ i18n.t("importFromImages") }}
              </label>
            </div>
            @if (errorMessage()) {
              <p class="agy-hint agy-hint-error tw-px-0">
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
                  [sub]="row.duplicate ? i18n.t('importDuplicate') : ''"
                  [value]="row.duplicate ? i18n.t('importSkip') : ''"
                  [clickable]="true"
                  (activated)="toggle(row)"
                />
              }
            </lp-group>

            @if (skippedHotp()) {
              <p class="agy-hint">
                {{ i18n.t("importHotpSkipped").replace("{COUNT}", skippedHotp().toString()) }}
              </p>
            }

            <div class="tw-flex tw-gap-1.5 tw-pt-2">
              <button
                type="button"
                class="agy-btn agy-primary agy-lg"
                [disabled]="busy() || selectedCount() === 0"
                (click)="doImport()"
              >
                {{ i18n.t("importSelected").replace("{COUNT}", selectedCount().toString()) }}
              </button>
              <button type="button" class="agy-btn agy-lg" (click)="back()">
                {{ i18n.t("back") }}
              </button>
            </div>
          }

          @case ("done") {
            <div class="tw-grid tw-h-60 tw-place-items-center">
              <div class="tw-text-center">
                <bit-icon name="bwi-check-circle" class="tw-text-4xl tw-text-fg-success"></bit-icon>
                <p class="agy-eh tw-m-0 tw-mt-2">
                  {{ i18n.t("importDone").replace("{COUNT}", importedCount().toString()) }}
                </p>
                <button type="button" class="agy-btn agy-primary agy-lg tw-mt-3" (click)="finish()">
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
export class GoogleAuthImportComponent {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly toast = inject(LpToastService);
  private readonly router = inject(Router);

  /** 扩展弹窗的紧凑头部；桌面端使用带返回按钮的页头。 */
  readonly compact = input(false);
  /** 返回所选来源页的路由。 */
  readonly backRoute = input("/import");
  /** 导入完成后的落地路由。 */
  readonly doneRoute = input("/vault");
  /** 可选：浏览器扩展注入的当前标签页二维码截取能力。 */
  readonly captureTabQr = input<(() => Promise<string | null>) | null>(null);

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

  protected async scanActiveTab(): Promise<void> {
    const capture = this.captureTabQr();
    if (!capture || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const decoded = await capture();
      if (!decoded) {
        this.errorMessage.set(this.i18n.t("importNothingFound"));
        return;
      }
      await this.collect([decoded]);
      if (this.rows().length > 0) {
        this.step.set("preview");
      } else {
        this.errorMessage.set(this.i18n.t("importNothingFound"));
      }
    } catch {
      this.errorMessage.set(this.i18n.t("googleAuthUnreadableImage"));
    } finally {
      this.busy.set(false);
    }
  }

  protected async readImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      // 二维码解析器是 ESM-only；按需加载，避免拖慢入口和测试环境。
      const { default: qrcodeParser } = await import("qrcode-parser");
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
      } else {
        this.errorMessage.set(this.i18n.t("importNothingFound"));
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
    void this.router.navigateByUrl(this.backRoute());
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
      this.toast.show(this.i18n.t("googleAuthImported"));
    } catch {
      this.errorMessage.set(this.i18n.t("errorOccurred"));
    } finally {
      this.busy.set(false);
    }
  }

  protected finish(): void {
    void this.router.navigateByUrl(this.doneRoute());
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
      if (uri.toLowerCase().startsWith("otpauth://totp/")) {
        const single = parseSingleTotpUri(uri);
        if (single) {
          merged.set(single.secretB32, {
            ...single,
            duplicate: this.knownSecrets().has(single.secretB32),
            included: !this.knownSecrets().has(single.secretB32),
          });
        }
        continue;
      }

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
  const trimmed = uri.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes("?")) {
    const query = trimmed.slice(trimmed.indexOf("?") + 1);
    return (new URLSearchParams(query).get("secret") ?? "").replace(/\s+/g, "").toUpperCase();
  }
  return trimmed.replace(/\s+/g, "").toUpperCase();
}

function parseSingleTotpUri(uri: string): Omit<PreviewRow, "duplicate" | "included"> | null {
  try {
    const parsed = new URL(uri);
    const secret = (parsed.searchParams.get("secret") ?? "").replace(/\s+/g, "").toUpperCase();
    if (!secret) {
      return null;
    }
    const rawLabel = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    const colonIndex = rawLabel.indexOf(":");
    const labelIssuer = colonIndex >= 0 ? rawLabel.slice(0, colonIndex).trim() : "";
    const name = (colonIndex >= 0 ? rawLabel.slice(colonIndex + 1) : rawLabel).trim() || secret;
    const issuer = (parsed.searchParams.get("issuer") ?? labelIssuer).trim();
    return {
      secretB32: secret,
      name,
      issuer,
      totp: uri,
    };
  } catch {
    return null;
  }
}
