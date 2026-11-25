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

interface RowSpec {
  readonly emoji: string;
  readonly labelKey: string;
  readonly valueKey?: string;
  readonly route?: string;
}

interface GroupSpec {
  readonly labelKey: string;
  readonly rows: readonly RowSpec[];
}

const GROUPS: readonly GroupSpec[] = [
  {
    labelKey: "security",
    rows: [
      { emoji: "🔐", labelKey: "masterPassword", route: "/settings-password" },
      {
        emoji: "🔑",
        labelKey: "securityKey",
        valueKey: "securityKeyRegistered",
        route: "/security-key",
      },
      { emoji: "⏱️", labelKey: "autoLock", valueKey: "autoLock15", route: "/settings-security-v2" },
    ],
  },
  {
    labelKey: "backupTitle",
    rows: [
      { emoji: "☁️", labelKey: "backupTitle", valueKey: "backupManual", route: "/backup-settings" },
      { emoji: "⤓", labelKey: "exportData", route: "/export" },
    ],
  },
  {
    labelKey: "tools",
    rows: [
      { emoji: "🔢", labelKey: "importGoogleAuth", route: "/import-google-auth" },
      { emoji: "⚙️", labelKey: "generator", route: "/tabs/generator" },
      { emoji: "🖥️", labelKey: "downloadDesktopApp", route: "/download-localpass" },
    ],
  },
  {
    labelKey: "system",
    rows: [
      { emoji: "🛡️", labelKey: "networkGate", valueKey: "networkGateOn" },
      { emoji: "ℹ️", labelKey: "about", route: "/about" },
    ],
  },
];

/** 设置一级页（方向 C）：四组，右栏值说明当前状态。 */
@Component({
  selector: "settings-list-v2",
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
        [title]="i18n.t('settings')"
        [sub]="i18n.t('settingsSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @for (group of groups; track group.labelKey) {
          <lp-group [label]="i18n.t(group.labelKey)">
            @for (row of group.rows; track row.labelKey) {
              <lp-row
                [emoji]="row.emoji"
                [label]="i18n.t(row.labelKey)"
                [value]="row.valueKey ? i18n.t(row.valueKey) : ''"
                [chevron]="!!row.route"
                [clickable]="!!row.route"
                (activated)="go(row.route)"
              />
            }
          </lp-group>
        }
      </div>
    </div>
  `,
})
export class SettingsListV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly groups = GROUPS;

  protected go(route: string | undefined): void {
    if (route) {
      void this.router.navigateByUrl(route);
    }
  }
}
