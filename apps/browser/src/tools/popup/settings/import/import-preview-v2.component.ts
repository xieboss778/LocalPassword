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

import {
  LpGroupComponent,
  LpKindTileComponent,
  LpPopupHeaderComponent,
  LpToastService,
  kindLabelKey,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { DialogService, IconModule } from "@localpass/components";
import {
  ImportRecordError,
  ImportRecordErrorReason,
  ImportResult,
  ImportUpgradeServiceAbstraction,
} from "@localpass/importer-core";
import {
  FilePasswordPromptComponent,
  ImportPreviewStagingService,
  ImportUpgradeProviders,
} from "@localpass/importer-ui";
import {
  dedupeImportCiphers,
  ImportDedupeResult,
  ItemKind,
  kindOf,
  readFieldValues,
} from "@localpass/local-vault";

interface PreviewRow {
  readonly key: string;
  readonly name: string;
  readonly kind: ItemKind;
  readonly sub: string;
}

/**
 * 导入预览（弹窗）。
 *
 * 文件只在内存里过一次：先按所选格式解析（密码保护的导出会在这里询问文件密码），
 * 把统计与头几条摊开给用户确认，只有点「导入」才真正写入本机保险库。
 */
@Component({
  selector: "import-preview-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpGroupComponent, LpKindTileComponent, LpPopupHeaderComponent],
  providers: [...ImportUpgradeProviders],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('importPreviewTitle')"
        [sub]="i18n.t('importPreviewSubtitle')"
        [back]="true"
        (backTriggered)="cancel()"
      ></lp-popup-header>

      <div class="agy-ext-scroll">
        @if (busy()) {
          <div class="tw-grid tw-min-h-52 tw-place-items-center">
            <div class="tw-text-center">
              <div
                class="tw-mx-auto tw-mb-3 tw-size-7 tw-animate-spin tw-rounded-full tw-border-2 tw-border-border-light tw-border-t-border-brand"
              ></div>
              <p class="agy-hint tw-px-0">{{ i18n.t("loading") }}</p>
            </div>
          </div>
        } @else if (error()) {
          <div class="agy-callout agy-bad">
            <bit-icon name="bwi-exclamation-triangle" class="tw-text-xs"></bit-icon>
            <div>{{ error() }}</div>
          </div>
        } @else {
          @if (parsed(); as result) {
            <div class="tw-grid tw-grid-cols-3 tw-gap-1.5">
              <div class="agy-stat">
                <div class="agy-n">{{ importableCount() }}</div>
                <div class="agy-l">{{ i18n.t("willImport") }}</div>
              </div>
              <div class="agy-stat" [class.agy-warn]="duplicateCount() > 0">
                <div class="agy-n">{{ duplicateCount() }}</div>
                <div class="agy-l">{{ i18n.t("duplicateSkipped") }}</div>
              </div>
              <div class="agy-stat" [class.agy-bad]="result.errors.length > 0">
                <div class="agy-n">{{ result.errors.length }}</div>
                <div class="agy-l">{{ i18n.t("unrecognized") }}</div>
              </div>
            </div>

            @if (duplicateCount() > 0) {
              <div class="agy-segtabs tw-mt-2">
                <button
                  type="button"
                  [class.agy-on]="skipDuplicates()"
                  [attr.aria-pressed]="skipDuplicates()"
                  (click)="skipDuplicates.set(true)"
                >
                  {{ i18n.t("duplicateSkipped") }}
                </button>
                <button
                  type="button"
                  [class.agy-on]="!skipDuplicates()"
                  [attr.aria-pressed]="!skipDuplicates()"
                  (click)="skipDuplicates.set(false)"
                >
                  {{ i18n.t("importKeepBoth") }}
                </button>
              </div>
            }

            @if (rows().length) {
              <lp-group class="tw-pt-2" [label]="i18n.t('preview')">
                @for (row of rows(); track row.key) {
                  <div class="agy-setrow">
                    <lp-kind-tile [kind]="row.kind" size="sm"></lp-kind-tile>
                    <span class="tw-min-w-0 tw-flex-1">
                      <span class="agy-k tw-block tw-truncate">{{ row.name }}</span>
                      <span class="agy-d tw-block tw-truncate">{{ row.sub }}</span>
                    </span>
                  </div>
                }
              </lp-group>
            }

            @if (result.errors.length) {
              <div class="agy-callout agy-bad tw-mt-2">
                <bit-icon name="bwi-exclamation-triangle" class="tw-text-xs"></bit-icon>
                <div class="tw-min-w-0 tw-flex-1">
                  @for (err of result.errors.slice(0, 3); track $index) {
                    <div class="tw-truncate">{{ formatRecordError(err) }}</div>
                  }
                </div>
              </div>
            }

            <div class="agy-callout tw-mt-2">
              <bit-icon name="bwi-info-circle" class="tw-text-xs"></bit-icon>
              <div>{{ i18n.t("importPreviewNote") }}</div>
            </div>
          }
        }
      </div>

      @if (!busy() && parsed()) {
        <div class="agy-ext-foot">
          <button
            id="import-preview_button_import"
            type="button"
            class="agy-btn agy-primary agy-lg tw-flex-1"
            [disabled]="importing() || importableCount() === 0"
            (click)="importNow()"
          >
            {{ importActionLabel() }}
          </button>
          <button
            id="import-preview_button_cancel"
            type="button"
            class="agy-btn agy-lg tw-flex-1"
            (click)="cancel()"
          >
            {{ i18n.t("cancel") }}
          </button>
        </div>
      } @else if (!busy()) {
        <div class="agy-ext-foot">
          <button
            id="import-preview_button_back"
            type="button"
            class="agy-btn agy-primary agy-lg tw-flex-1"
            (click)="cancel()"
          >
            {{ i18n.t("back") }}
          </button>
        </div>
      }
    </div>
  `,
})
export class ImportPreviewV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogService = inject(DialogService);
  private readonly importService = inject(ImportUpgradeServiceAbstraction);
  private readonly staging = inject(ImportPreviewStagingService);
  private readonly toast = inject(LpToastService);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);

  protected readonly busy = signal(true);
  protected readonly importing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly parsed = signal<ImportResult | null>(null);
  protected readonly dedupe = signal<ImportDedupeResult | null>(null);
  protected readonly skipDuplicates = signal(true);

  protected readonly importableCiphers = computed<readonly CipherView[]>(() => {
    if (this.skipDuplicates()) {
      return this.dedupe()?.ciphers ?? this.parsed()?.ciphers ?? [];
    }
    return this.parsed()?.ciphers ?? [];
  });
  protected readonly importableCount = computed(() => this.importableCiphers().length);
  protected readonly duplicateCount = computed(() => this.dedupe()?.duplicateCount ?? 0);

  protected readonly rows = computed<PreviewRow[]>(() =>
    this.importableCiphers()
      .slice(0, 4)
      .map((cipher, index) => this.rowOf(cipher, index)),
  );
  protected readonly importActionLabel = computed(() =>
    this.i18n.t("importNItems", String(this.importableCount())),
  );

  async ngOnInit(): Promise<void> {
    const staged = this.staging.take();
    if (!staged) {
      this.cancel();
      return;
    }

    try {
      const importer = this.importService.getImporter(staged.importType, () =>
        this.promptForPassword(),
      );
      if (!importer) {
        throw new Error(this.i18n.t("importFormatError"));
      }
      this.parsed.set(await this.importService.parse(importer, staged.contents));
      const result = this.parsed();
      if (result) {
        const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
        const existing = await this.cipherService.getAllDecrypted(userId);
        this.dedupe.set(
          dedupeImportCiphers(
            result.ciphers,
            existing,
            result.folderRelationships,
            result.collectionRelationships,
          ),
        );
      }
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t("importFormatError")));
    } finally {
      this.busy.set(false);
    }
  }

  protected async importNow(): Promise<void> {
    const result = this.parsed();
    if (!result || this.importing() || this.importableCount() === 0) {
      return;
    }

    this.importing.set(true);
    this.error.set(null);
    try {
      const dedupe = this.skipDuplicates() ? this.dedupe() : null;
      const payload = Object.assign(new ImportResult(), result, {
        ciphers: [...(dedupe ? dedupe.ciphers : result.ciphers)],
        folderRelationships: (dedupe ? dedupe.folderRelationships : result.folderRelationships).map(
          ([itemIndex, targetIndex]) => [itemIndex, targetIndex] as [number, number],
        ),
        collectionRelationships: (dedupe
          ? dedupe.collectionRelationships
          : result.collectionRelationships
        ).map(([itemIndex, targetIndex]) => [itemIndex, targetIndex] as [number, number]),
      });
      await this.importService.importImportResult(payload, undefined, undefined, false);
      this.toast.show(this.i18n.t("importSuccess"));
      await this.router.navigateByUrl("/tabs/vault");
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t("errorOccurred")));
    } finally {
      this.importing.set(false);
    }
  }

  protected formatRecordError(err: ImportRecordError): string {
    const reasonKey =
      err.reason === ImportRecordErrorReason.SshKeyParseFailed
        ? "importSkipReasonSshKeyParse"
        : err.reason === ImportRecordErrorReason.UnsupportedType
          ? "importSkipReasonUnsupportedType"
          : "importSkipReasonGeneric";
    const reason = this.i18n.t(reasonKey);
    const id = err.id?.trim();
    return id ? `${id} · ${reason}` : reason;
  }

  protected cancel(): void {
    this.staging.clear();
    const next = this.route.snapshot.queryParamMap.get("next");
    void this.router.navigate(["/import-source-v2"], {
      queryParams: next ? { next } : undefined,
    });
  }

  private async promptForPassword(): Promise<string> {
    const dialog = this.dialogService.open<string>(FilePasswordPromptComponent, {
      ariaModal: true,
    });
    return (await firstValueFrom(dialog.closed)) ?? "";
  }

  private rowOf(cipher: CipherView, index: number): PreviewRow {
    const kind = kindOf(cipher);
    const values = readFieldValues(cipher, kind);
    let detail = "";
    if (kind === ItemKind.Login) {
      detail = cipher.login?.username ?? "";
    } else if (kind === ItemKind.Token) {
      detail = values["env"] ?? "";
    } else if (kind === ItemKind.Server) {
      detail = values["host"] ?? "";
    } else if (kind === ItemKind.Card) {
      detail = maskCardNumber(cipher.card?.number ?? "");
    }

    return {
      key: String(index),
      name: cipher.name,
      kind,
      sub: [this.i18n.t(kindLabelKey(kind)), detail].filter(Boolean).join(" · "),
    };
  }
}

function maskCardNumber(number: string): string {
  const digits = number.replace(/\s+/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
