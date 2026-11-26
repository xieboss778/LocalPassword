import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { LpPopupHeaderComponent } from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { Theme, ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";
import { ThemeStateService } from "@localpass/common/platform/theming/theme-state.service";
import { IconModule, LocalPassIcon } from "@localpass/components";

interface ThemeOption {
  readonly value: Theme;
  readonly labelKey: string;
  readonly descKey: string;
  readonly icon: LocalPassIcon;
}

const THEMES: readonly ThemeOption[] = [
  { value: ThemeTypes.Light, labelKey: "light", descKey: "themeLightDesc", icon: "bwi-brush" },
  { value: ThemeTypes.Dark, labelKey: "dark", descKey: "themeDarkDesc", icon: "bwi-palette" },
  {
    value: ThemeTypes.System,
    labelKey: "default",
    descKey: "themeSystemDesc",
    icon: "bwi-desktop",
  },
];

/**
 * 弹窗外观：三张主题卡 + 当前界面语言。主题改变只影响显示，不触碰保险库数据。
 */
@Component({
  selector: "appearance-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [JslibModule, IconModule, LpPopupHeaderComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('appearance')"
        [sub]="i18n.t('appearanceSubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        <h2 class="tw-m-0 tw-px-0.5 tw-pt-2 tw-pb-1.5 tw-text-xs tw-font-semibold tw-text-muted">
          {{ i18n.t("theme") }}
        </h2>
        <div class="tw-grid tw-gap-2">
          @for (theme of themes; track theme.value) {
            <button
              type="button"
              class="tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-p-3 tw-text-start"
              [class.tw-border-border-brand]="selectedTheme() === theme.value"
              [class.tw-bg-bg-brand-softer]="selectedTheme() === theme.value"
              [class.tw-border-border-light]="selectedTheme() !== theme.value"
              [class.tw-bg-background]="selectedTheme() !== theme.value"
              [attr.aria-pressed]="selectedTheme() === theme.value"
              (click)="setTheme(theme.value)"
            >
              <span
                class="tw-grid tw-size-9 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
              >
                <bit-icon [name]="theme.icon" class="tw-text-base"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                  i18n.t(theme.labelKey)
                }}</span>
                <span class="tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
                  i18n.t(theme.descKey)
                }}</span>
              </span>
              @if (selectedTheme() === theme.value) {
                <bit-icon name="bwi-check" class="tw-text-base tw-text-fg-brand"></bit-icon>
              }
            </button>
          }
        </div>

        <h2 class="tw-m-0 tw-px-0.5 tw-pt-3 tw-pb-1.5 tw-text-xs tw-font-semibold tw-text-muted">
          {{ i18n.t("language") }}
        </h2>
        <div
          class="tw-flex tw-items-center tw-gap-2.5 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3"
        >
          <span
            class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
          >
            <bit-icon name="bwi-globe" class="tw-text-base"></bit-icon>
          </span>
          <span class="tw-min-w-0 tw-flex-1">
            <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
              i18n.t("language")
            }}</span>
            <span class="tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
              i18n.t("simplifiedChinese")
            }}</span>
          </span>
        </div>

        <p class="tw-px-0.5 tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
          {{ i18n.t("themeOnlyDisplayNotice") }}
        </p>
      </div>
    </div>
  `,
})
export class AppearanceV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly router = inject(Router);

  protected readonly themes = THEMES;
  protected readonly selectedTheme = signal<Theme>(ThemeTypes.System);

  async ngOnInit(): Promise<void> {
    this.selectedTheme.set(await firstValueFrom(this.themeStateService.selectedTheme$));
  }

  protected async setTheme(theme: Theme): Promise<void> {
    await this.themeStateService.setSelectedTheme(theme);
    this.selectedTheme.set(theme);
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }
}
