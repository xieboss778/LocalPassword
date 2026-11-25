import { ModuleWithProviders, NgModule } from "@angular/core";
import { DefaultNoComponentGlobalConfig, GlobalConfig, TOAST_CONFIG } from "ngx-toastr";

import { ToastContainerComponent } from "./toast-container.component";
import { LocalPassToastrComponent } from "./toastr.component";

@NgModule({
  imports: [LocalPassToastrComponent, ToastContainerComponent],
  exports: [LocalPassToastrComponent, ToastContainerComponent],
})
export class ToastModule {
  static forRoot(config: Partial<GlobalConfig> = {}): ModuleWithProviders<ToastModule> {
    return {
      ngModule: ToastModule,
      providers: [
        {
          provide: TOAST_CONFIG,
          useValue: {
            default: LocalPassToastrGlobalConfig,
            config: config,
          },
        },
      ],
    };
  }
}

export const LocalPassToastrGlobalConfig: GlobalConfig = {
  ...DefaultNoComponentGlobalConfig,
  toastComponent: LocalPassToastrComponent,
  tapToDismiss: false,
  timeOut: 5000,
  extendedTimeOut: 2000,
  maxOpened: 5,
  autoDismiss: true,
  progressBar: true,
};
