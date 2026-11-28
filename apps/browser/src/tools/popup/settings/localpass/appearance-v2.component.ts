import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpPopupHeaderComponent,
  VaultDensity,
  VaultDensityService,
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { Theme, ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";
import { ThemeStateService } from "@localpass/common/platform/theming/theme-state.service";
import { IconModule } from "@localpass/components";

import { PopupWidthOption } from "../../../../platform/browser/popup-view";
import { PopupSizeService } from "../../../../platform/popup/layout/popup-size.service";

interface ThemeOption {
  readonly value: Theme;
  readonly labelKey: string;
  readonly descKey: string;
  /** 小预览条：用主题自己的底色，直观区分浅色 / 深色 / 跟随系统。 */
  readonly swatch: string;
}

const THEMES: readonly ThemeOption[] = [
  {
    value: ThemeTypes.Light,
    labelKey: "light",
    descKey: "themeLightDesc",
    swatch: "linear-gradient(180deg, var(--color-white) 0 62%, var(--color-gray-050) 62%)",
  },
  {
    value: ThemeTypes.Dark,
    labelKey: "dark",
    descKey: "themeDarkDesc",
    swatch: "linear-gradient(180deg, var(--color-brand-950) 0 62%, var(--color-gray-950) 62%)",
  },
  {
    value: ThemeTypes.System,
    labelKey: "systemDefault",
    descKey: "themeSystemDesc",
    swatch: "linear-gradient(90deg, var(--color-white) 0 50%, var(--color-brand-950) 50%)",
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
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('appearance')"
        [sub]="i18n.t('appearanceSubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="agy-ext-scroll">
        <h2 class="agy-seclbl">{{ i18n.t("theme") }}</h2>
        <div class="agy-grp">
          @for (theme of themes; track theme.value) {
            <button
              type="button"
              class="agy-setrow"
              [attr.aria-pressed]="selectedTheme() === theme.value"
              (click)="setTheme(theme.value)"
            >
              <span
                class="tw-h-7 tw-w-9 tw-flex-none tw-rounded-md tw-border tw-border-border-light"
                [style.background]="theme.swatch"
                aria-hidden="true"
              ></span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="agy-k tw-block">{{ i18n.t(theme.labelKey) }}</span>
                <span class="agy-d tw-block">{{ i18n.t(theme.descKey) }}</span>
              </span>
              @if (selectedTheme() === theme.value) {
                <bit-icon name="bwi-check" class="tw-text-xs tw-text-fg-brand"></bit-icon>
              }
            </button>
          }
        </div>

        <h2 class="agy-seclbl tw-pt-2">{{ i18n.t("listDensity") }}</h2>
        <div class="agy-segtabs">
          <button
            type="button"
            [class.agy-on]="density() === 'compact'"
            [attr.aria-pressed]="density() === 'compact'"
            (click)="setDensity('compact')"
          >
            {{ i18n.t("densityCompact") }}
          </button>
          <button
            type="button"
            [class.agy-on]="density() === 'ultra'"
            [attr.aria-pressed]="density() === 'ultra'"
            (click)="setDensity('ultra')"
          >
            {{ i18n.t("densityUltra") }}
          </button>
        </div>
        <p class="agy-hint">
          {{ i18n.t(density() === "ultra" ? "densityUltraDesc" : "densityCompactDesc") }}
        </p>

        <h2 class="agy-seclbl tw-pt-2">{{ i18n.t("popupWidth") }}</h2>
        <div class="agy-segtabs">
          <button
            type="button"
            [class.agy-on]="popupWidth() !== 'wide'"
            [attr.aria-pressed]="popupWidth() !== 'wide'"
            (click)="setWidth('default')"
          >
            {{ i18n.t("default") }} (380px)
          </button>
          <button
            type="button"
            [class.agy-on]="popupWidth() === 'wide'"
            [attr.aria-pressed]="popupWidth() === 'wide'"
            (click)="setWidth('wide')"
          >
            {{ i18n.t("wide") }} (600px)
          </button>
        </div>

        <h2 class="agy-seclbl tw-pt-2">{{ i18n.t("language") }}</h2>
        <div class="agy-grp">
          <div class="agy-setrow">
            <span class="agy-iconbtn agy-sm tw-bg-background-alt">
              <bit-icon name="bwi-globe" class="tw-text-xs"></bit-icon>
            </span>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="agy-k tw-block">{{ i18n.t("language") }}</span>
              <span class="agy-d tw-block">{{ languageLabel() }}</span>
            </span>
          </div>
        </div>

        <p class="agy-hint tw-text-center">
          {{ i18n.t("themeOnlyDisplayNotice") }}
        </p>
      </div>
    </div>
  `,
})
export class AppearanceV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly densityService = inject(VaultDensityService);
  private readonly popupSizeService = inject(PopupSizeService);
  private readonly router = inject(Router);

  protected readonly themes = THEMES;
  protected readonly selectedTheme = signal<Theme>(ThemeTypes.System);
  protected readonly density = toSignal(this.densityService.density$, {
    initialValue: VaultDensity.Compact,
  });
  protected readonly popupWidth = toSignal(this.popupSizeService.width$, {
    initialValue: "default" as PopupWidthOption,
  });
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });
  protected readonly languageLabel = computed(() =>
    this.locale().toLowerCase().startsWith("zh") ? this.i18n.t("simplifiedChinese") : "English",
  );

  async ngOnInit(): Promise<void> {
    this.selectedTheme.set(await firstValueFrom(this.themeStateService.selectedTheme$));
  }

  protected async setTheme(theme: Theme): Promise<void> {
    await this.themeStateService.setSelectedTheme(theme);
    this.selectedTheme.set(theme);
  }

  protected setDensity(density: VaultDensity): void {
    void this.densityService.setDensity(density);
  }

  protected setWidth(width: PopupWidthOption): void {
    void this.popupSizeService.setWidth(width);
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }
}
