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
  LpGroupComponent,
  LpKindTileComponent,
  LpPopupHeaderComponent,
  kindLabelKey,
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, DialogService, IconModule } from "@localpass/components";
import { ImportResult, ImportUpgradeServiceAbstraction } from "@localpass/importer-core";
import {
  FilePasswordPromptComponent,
  ImportPreviewStagingService,
  ImportUpgradeProviders,
} from "@localpass/importer-ui";
import { ItemKind, kindOf, readFieldValues } from "@localpass/local-vault";

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
  imports: [
    ButtonModule,
    IconModule,
    LpGroupComponent,
    LpKindTileComponent,
    LpPopupHeaderComponent,
  ],
  providers: [...ImportUpgradeProviders],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('importPreviewTitle')"
        [sub]="i18n.t('importPreviewSubtitle')"
        [back]="true"
        (backTriggered)="cancel()"
      ></lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
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
            class="tw-mt-3 tw-rounded-xl tw-border tw-border-border-danger-soft tw-bg-bg-danger-soft tw-p-3 tw-text-xs tw-leading-relaxed tw-text-fg-danger-strong"
          >
            {{ error() }}
          </div>
        } @else {
          @if (parsed(); as result) {
            <div class="tw-grid tw-grid-cols-3 tw-gap-2 tw-pt-2">
              <div
                class="tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-center"
              >
                <div class="tw-text-lg tw-font-semibold tw-text-main">
                  {{ result.ciphers.length }}
                </div>
                <div class="tw-text-xs tw-text-muted">{{ i18n.t("willImport") }}</div>
              </div>
              <div
                class="tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-center"
              >
                <div class="tw-text-lg tw-font-semibold tw-text-main">0</div>
                <div class="tw-text-xs tw-text-muted">{{ i18n.t("duplicateSkipped") }}</div>
              </div>
              <div
                class="tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-center"
              >
                <div class="tw-text-lg tw-font-semibold tw-text-main">
                  {{ result.errors.length }}
                </div>
                <div class="tw-text-xs tw-text-muted">{{ i18n.t("unrecognized") }}</div>
              </div>
            </div>

            @if (rows().length) {
              <lp-group class="tw-pt-2" [label]="i18n.t('preview')">
                @for (row of rows(); track row.key) {
                  <div
                    class="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 last:tw-border-b-0"
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
              </lp-group>
            }

            <div
              class="tw-mt-3 tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-border tw-border-border-brand-soft tw-bg-bg-brand-softer tw-p-3 tw-text-xs tw-leading-relaxed tw-text-main"
            >
              <bit-icon
                name="bwi-info-circle"
                class="tw-mt-0.5 tw-flex-none tw-text-fg-brand"
              ></bit-icon>
              <span>{{ i18n.t("importPreviewNote") }}</span>
            </div>
          }
        }
      </div>

      @if (!busy() && parsed()) {
        <div
          class="tw-flex tw-flex-none tw-gap-2 tw-border-t tw-border-border-light tw-px-3.5 tw-py-3"
        >
          <button
            id="import-preview_button_import"
            type="button"
            bitButton
            buttonType="primary"
            class="tw-flex-1"
            [disabled]="importing()"
            [loading]="importing()"
            (click)="importNow()"
          >
            {{ importActionLabel() }}
          </button>
          <button
            id="import-preview_button_cancel"
            type="button"
            bitButton
            buttonType="secondary"
            class="tw-flex-1"
            (click)="cancel()"
          >
            {{ i18n.t("cancel") }}
          </button>
        </div>
      } @else if (!busy()) {
        <div class="tw-flex tw-flex-none tw-border-t tw-border-border-light tw-px-3.5 tw-py-3">
          <button
            id="import-preview_button_back"
            type="button"
            bitButton
            buttonType="primary"
            block
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
  private readonly dialogService = inject(DialogService);
  private readonly importService = inject(ImportUpgradeServiceAbstraction);
  private readonly staging = inject(ImportPreviewStagingService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly busy = signal(true);
  protected readonly importing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly parsed = signal<ImportResult | null>(null);

  protected readonly rows = computed<PreviewRow[]>(() => {
    const result = this.parsed();
    if (!result) {
      return [];
    }
    return result.ciphers.slice(0, 4).map((cipher, index) => this.rowOf(cipher, index));
  });
  protected readonly importActionLabel = computed(() =>
    this.i18n.t("importNItems", String(this.parsed()?.ciphers.length ?? 0)),
  );

  async ngOnInit(): Promise<void> {
    const staged = this.staging.take();
    if (!staged) {
      void this.router.navigateByUrl("/import-source-v2");
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
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t("importFormatError")));
    } finally {
      this.busy.set(false);
    }
  }

  protected async importNow(): Promise<void> {
    const result = this.parsed();
    if (!result || this.importing()) {
      return;
    }

    this.importing.set(true);
    this.error.set(null);
    try {
      await this.importService.importImportResult(result, undefined, undefined, false);
      this.platformUtilsService.showToast("success", "", this.i18n.t("importSuccess"));
      await this.router.navigateByUrl("/tabs/vault");
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t("errorOccurred")));
    } finally {
      this.importing.set(false);
    }
  }

  protected cancel(): void {
    this.staging.clear();
    void this.router.navigateByUrl("/import-source-v2");
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
