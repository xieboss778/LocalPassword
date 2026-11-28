import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  LpKindTileComponent,
  LpPageHeaderComponent,
  LpToastService,
  kindLabelKey,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, CalloutModule, DialogService } from "@localpass/components";
import { ImportResult, ImportUpgradeServiceAbstraction } from "@localpass/importer-core";
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
 * 桌面端导入预览。
 *
 * 文件只在内存里解析一次：展示数量、前五个条目与无法识别的行，只有点「导入」才写入本机
 * 保险库。读取的是用户刚选的文件，解密后的内容不落盘、不进日志。
 */
@Component({
  selector: "import-preview-desktop",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [ButtonModule, CalloutModule, LpKindTileComponent, LpPageHeaderComponent],
  providers: [...ImportUpgradeProviders],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header [title]="i18n.t('importPreviewTitle')" [sub]="subtitle()">
        <button
          type="button"
          bitButton
          buttonType="secondary"
          data-testid="import_preview_cancel"
          (click)="cancel()"
        >
          {{ i18n.t("cancel") }}
        </button>
        <button
          type="button"
          bitButton
          buttonType="primary"
          [disabled]="!parsed() || importing() || importableCount() === 0"
          [loading]="importing()"
          data-testid="import_preview_import"
          (click)="importNow()"
        >
          {{ importActionLabel() }}
        </button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        @if (busy()) {
          <div class="tw-grid tw-min-h-52 tw-place-items-center">
            <div class="tw-text-center">
              <div
                class="tw-mx-auto tw-mb-3 tw-size-7 tw-animate-spin tw-rounded-full tw-border-2 tw-border-border-light tw-border-t-border-brand"
              ></div>
              <p class="tw-m-0 tw-text-sm tw-text-main">{{ i18n.t("loading") }}</p>
            </div>
          </div>
        } @else if (error()) {
          <div
            class="tw-mt-3 tw-rounded-xl tw-border tw-border-border-danger-soft tw-bg-bg-danger-soft tw-p-4 tw-text-sm tw-leading-relaxed tw-text-fg-danger-strong"
          >
            {{ error() }}
          </div>
        } @else if (parsed(); as result) {
          <div class="tw-mb-4 tw-grid tw-grid-cols-4 tw-gap-2">
            <div class="agy-stat">
              <div class="agy-n">{{ result.ciphers.length }}</div>
              <div class="agy-l">{{ i18n.t("totalItems") }}</div>
            </div>
            <div class="agy-stat" [class.agy-ok]="importableCount() > 0">
              <div class="agy-n">{{ importableCount() }}</div>
              <div class="agy-l">{{ i18n.t("willImport") }}</div>
            </div>
            <div class="agy-stat" [class.agy-warn]="duplicateCount() > 0">
              <div class="agy-n">{{ duplicateCount() }}</div>
              <div class="agy-l">{{ i18n.t("importPreviewDuplicatesLabel") }}</div>
            </div>
            <div class="agy-stat" [class.agy-bad]="result.errors.length > 0">
              <div class="agy-n">{{ result.errors.length }}</div>
              <div class="agy-l">{{ i18n.t("unrecognized") }}</div>
            </div>
          </div>

          <div class="tw-flex tw-items-start tw-gap-4">
            <div
              class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
            >
              <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
                {{ i18n.t("willImport") }}
              </h2>
              @if (rows().length) {
                <div
                  class="tw-mt-3 tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
                >
                  @for (row of rows(); track row.key) {
                    <div
                      class="tw-flex tw-min-h-14 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 last:tw-border-b-0"
                    >
                      <lp-kind-tile [kind]="row.kind" size="sm"></lp-kind-tile>
                      <span class="tw-min-w-0 tw-flex-1">
                        <span class="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-main">{{
                          row.name
                        }}</span>
                        <span class="tw-block tw-truncate tw-text-xs tw-text-muted">{{
                          row.sub
                        }}</span>
                      </span>
                    </div>
                  }
                </div>
                @if (importableCount() > rows().length) {
                  <p class="tw-mb-0 tw-mt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
                    {{ firstFiveNote(importableCount()) }}
                  </p>
                }
              } @else {
                <p class="tw-mb-0 tw-mt-3 tw-text-sm tw-text-muted">
                  {{ i18n.t("importPreviewNoRows") }}
                </p>
              }
            </div>

            <div
              class="tw-w-5/12 tw-flex-none tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
            >
              <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
                {{ i18n.t("importPreviewChecks") }}
              </h2>
              <div
                class="tw-mt-3 tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div
                  class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-p-3"
                >
                  <div class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                      i18n.t("importPreviewDuplicatesLabel")
                    }}</span>
                    <span class="tw-mt-0.5 tw-block tw-text-xs tw-text-muted">{{
                      duplicateNote()
                    }}</span>
                  </div>
                  @if (duplicateCount() > 0) {
                    <button
                      type="button"
                      class="agy-btn agy-sm"
                      (click)="skipDuplicates.set(!skipDuplicates())"
                    >
                      {{ i18n.t(skipDuplicates() ? "importSkip" : "importKeepBoth") }}
                    </button>
                  }
                </div>
                <div class="tw-p-3">
                  <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                    i18n.t("unrecognized")
                  }}</span>
                  <span class="tw-mt-0.5 tw-block tw-text-xs tw-text-muted">{{
                    unrecognizedNote(result.errors.length)
                  }}</span>
                </div>
              </div>

              <div class="tw-mt-4">
                <bit-callout type="info" [title]="null">{{
                  i18n.t("importPreviewEncryptionNote")
                }}</bit-callout>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ImportPreviewDesktopComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
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

  protected readonly importableCiphers = computed<readonly CipherView[]>(() =>
    this.skipDuplicates()
      ? (this.dedupe()?.ciphers ?? this.parsed()?.ciphers ?? [])
      : (this.parsed()?.ciphers ?? []),
  );
  protected readonly importableCount = computed(() => this.importableCiphers().length);

  protected readonly rows = computed<PreviewRow[]>(() =>
    this.importableCiphers()
      .slice(0, 5)
      .map((cipher, index) => this.rowOf(cipher, index)),
  );

  /** 与本机保险库比中的条目默认跳过；统计只来自内存里的真实比对。 */
  protected readonly duplicateCount = computed(() => this.dedupe()?.duplicateCount ?? 0);

  protected readonly importActionLabel = computed(() =>
    this.i18n.t("importNItems", String(this.importableCount())),
  );

  protected subtitle(): string {
    const result = this.parsed();
    if (!result) {
      return "";
    }
    return this.i18n.t(
      "importPreviewSubtitle",
      String(this.importableCount()),
      String(this.duplicateCount()),
    );
  }

  protected firstFiveNote(count: number): string {
    return this.i18n.t("importPreviewFirstFive", String(count));
  }

  protected duplicateNote(): string {
    return this.i18n.t("importPreviewDuplicateCount", String(this.duplicateCount()));
  }

  protected unrecognizedNote(count: number): string {
    return this.i18n.t("importPreviewUnrecognizedCount", String(count));
  }

  async ngOnInit(): Promise<void> {
    const staged = this.staging.take();
    if (!staged) {
      void this.router.navigateByUrl("/import");
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
      const dedupe = this.dedupe();
      const payload = new ImportResult();
      payload.success = result.success;
      payload.folders = [...result.folders];
      payload.collections = [...result.collections];
      payload.errors = [...result.errors];
      if (this.skipDuplicates() && dedupe) {
        payload.ciphers = [...dedupe.ciphers];
        payload.folderRelationships = dedupe.folderRelationships.map(
          ([itemIndex, targetIndex]) => [itemIndex, targetIndex] as [number, number],
        );
        payload.collectionRelationships = dedupe.collectionRelationships.map(
          ([itemIndex, targetIndex]) => [itemIndex, targetIndex] as [number, number],
        );
      } else {
        payload.ciphers = [...result.ciphers];
        payload.folderRelationships = [...result.folderRelationships];
        payload.collectionRelationships = [...result.collectionRelationships];
      }
      await this.importService.importImportResult(payload, undefined, undefined, false);
      this.toast.show(this.i18n.t("importSuccess"));
      await this.router.navigateByUrl("/vault");
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t("errorOccurred")));
    } finally {
      this.importing.set(false);
    }
  }

  protected cancel(): void {
    this.staging.clear();
    void this.router.navigateByUrl("/import");
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
