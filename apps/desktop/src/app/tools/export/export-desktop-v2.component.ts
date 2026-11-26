import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import { LpPageHeaderComponent } from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { AsyncActionsModule, ButtonModule, DialogModule } from "@localpass/components";
import { ExportComponent } from "@localpass/vault-export-ui";

/**
 * 桌面端导出：与弹窗共用 `tools-export` 表单，只是把提交按钮放到页头。
 *
 * 导出文件始终是加密的；生成后由浏览器/Electron 的下载通道写到用户选的位置。
 */
@Component({
  selector: "export-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    LpPageHeaderComponent,
    ExportComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header [title]="i18n.t('exportNoun')" [sub]="i18n.t('exportSettingsDesc')">
        <button
          bitButton
          bitFormButton
          type="submit"
          form="export_form_exportForm"
          buttonType="primary"
          [disabled]="disabled()"
          [loading]="loading()"
        >
          {{ i18n.t("exportVerb") }}
        </button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        <div
          class="tw-max-w-3xl tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5 tw-shadow-sm"
        >
          <tools-export
            [defaultFormat]="'encrypted_json'"
            [defaultFileEncrypted]="true"
            (formDisabled)="disabled.set($event)"
            (formLoading)="loading.set($event)"
            (onSuccessfulExport)="onSuccessfulExport($event)"
            (skippedAttachmentCountChange)="skippedAttachmentCount.set($event)"
          ></tools-export>
        </div>
      </div>
    </div>
  `,
})
export class ExportDesktopV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly disabled = signal(false);
  protected readonly loading = signal(false);
  protected readonly skippedAttachmentCount = signal(0);

  protected async onSuccessfulExport(_organizationId?: string): Promise<void> {
    // 附件被跳过时留在本页，让用户能看到提示。
    if (this.skippedAttachmentCount() > 0) {
      return;
    }
    await this.router.navigate(["/settings-desktop-v2"]);
  }
}
