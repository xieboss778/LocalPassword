import { CommonModule } from "@angular/common";
import { Component, ElementRef, ViewChild } from "@angular/core";
import { Observable, combineLatest, defer, map } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@localpass/common/platform/abstractions/environment.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@localpass/common/platform/abstractions/sdk/sdk.service";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  IconComponent,
  ToastService,
  TypographyModule,
} from "@localpass/components";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "about-dialog.component.html",
  imports: [IconComponent, CommonModule, JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class AboutDialogComponent {
  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("version") protected version!: ElementRef;

  protected year = new Date().getFullYear();
  protected version$: Observable<string>;

  protected data$ = combineLatest([
    this.configService.serverConfig$,
    this.environmentService.environment$.pipe(map((env) => env.isCloud())),
  ]).pipe(map(([serverConfig, isCloud]) => ({ serverConfig, isCloud })));

  protected sdkVersion$ = this.sdkService.version$;

  constructor(
    private dialogRef: DialogRef,
    private configService: ConfigService,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private sdkService: SdkService,
  ) {
    this.version$ = defer(() => this.platformUtilsService.getApplicationVersion());
  }

  protected copyVersion() {
    this.platformUtilsService.copyToClipboard(this.version.nativeElement.innerText);
    this.toastService.showToast({
      message: this.i18nService.t("copySuccessful"),
      variant: "success",
    });
    void this.dialogRef.close();
  }
}
