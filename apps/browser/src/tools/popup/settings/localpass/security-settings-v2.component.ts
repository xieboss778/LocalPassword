import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router, RouterModule } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";

/**
 * 安全设置（扩展弹窗）。
 *
 * Touch ID 是 macOS 桌面端的能力，扩展里不出现这个开关——只在页尾说一句它在哪里。
 */
@Component({
  selector: "security-settings-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header
        [title]="i18n.t('security')"
        [sub]="i18n.t('securitySubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <lp-group [label]="i18n.t('unlockAndAccess')">
          <lp-row
            emoji="🔐"
            [label]="i18n.t('masterPassword')"
            [value]="i18n.t('change')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/settings-password')"
          />
          <lp-row
            emoji="🔑"
            [label]="i18n.t('securityKey')"
            [value]="i18n.t('securityKeyRegistered')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/security-key')"
          />
          <lp-row
            emoji="⏱️"
            [label]="i18n.t('autoLock')"
            [value]="i18n.t('autoLock15')"
            [clickable]="false"
          />
        </lp-group>

        <lp-group [label]="i18n.t('advanced')">
          <lp-row
            emoji="🧹"
            [label]="i18n.t('clearClipboard')"
            [value]="i18n.t('clearClipboard30s')"
            [clickable]="false"
          />
          <lp-row
            emoji="🚫"
            [label]="i18n.t('networkGate')"
            [value]="i18n.t('networkGateOn')"
            [clickable]="false"
          />
        </lp-group>

        <p class="tw-px-4 tw-pt-4 tw-text-[10.5px] tw-leading-relaxed tw-text-[var(--lp-ink-3)]">
          {{ i18n.t("touchIdDesktopOnly") }}
        </p>
      </div>
    </div>
  `,
})
export class SecuritySettingsV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }
}
