import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { Observable, Subject, map } from "rxjs";

import { AvailableRegionsService } from "@localpass/common/platform/abstractions/available-regions.service";
import {
  EnvironmentService,
  Region,
  RegionConfig,
} from "@localpass/common/platform/abstractions/environment.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import {
  DialogService,
  IconModule,
  LinkModule,
  MenuModule,
  ToastService,
  TypographyModule,
} from "@localpass/components";
import { I18nPipe } from "@localpass/ui-common";

import { SelfHostedEnvConfigDialogComponent } from "../self-hosted-env-config-dialog";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "environment-selector",
  templateUrl: "environment-selector.component.html",
  standalone: true,
  imports: [CommonModule, I18nPipe, IconModule, LinkModule, MenuModule, TypographyModule],
})
export class EnvironmentSelectorComponent implements OnDestroy {
  protected ServerEnvironmentType = Region;
  protected availableRegions$: Observable<RegionConfig[]> =
    this.availableRegionsService.availableRegions$;
  protected selectedRegion$: Observable<RegionConfig | undefined> =
    this.environmentService.globalEnvironment$.pipe(
      map((env) =>
        this.environmentService.availableRegions().find((ar) => ar.key === env.getRegion()),
      ),
    );

  /**
   * LocalPass 的地址固定指向哨兵域名，没有任何服务器可选。此时环境选择器只会在解锁页
   * 暴露一个不存在的地址，直接不渲染。
   */
  protected localOnly$: Observable<boolean> = this.environmentService.globalEnvironment$.pipe(
    map((env) => isSentinelUrl(env.getApiUrl())),
  );

  private destroy$ = new Subject<void>();

  constructor(
    public environmentService: EnvironmentService,
    private availableRegionsService: AvailableRegionsService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async toggle(option: Region) {
    if (option === null) {
      return;
    }

    /**
     * Opens the self-hosted settings dialog when the self-hosted option is selected.
     */
    if (option === Region.SelfHosted) {
      const dialogResult = await SelfHostedEnvConfigDialogComponent.open(this.dialogService);
      if (dialogResult) {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("environmentSaved"),
        });
      }
      // Don't proceed to setEnvironment when the self-hosted dialog is cancelled
      return;
    }

    await this.environmentService.setEnvironment(option);
  }
}

/** `.invalid` 是保留域名，本地保险库用它占位；这样的地址没有可选的环境。 */
function isSentinelUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".invalid");
  } catch {
    return false;
  }
}
