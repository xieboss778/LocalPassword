import { Component, inject } from "@angular/core";

import { JslibModule } from "@localpass/angular/jslib.module";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  DIALOG_DATA,
  LinkComponent,
} from "@localpass/components";

export type AdvancedUriOptionDialogParams = {
  contentKey: string;
  onCancel: () => void;
  onContinue: () => void;
};

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "advanced-uri-option-dialog.component.html",
  imports: [LinkComponent, ButtonModule, DialogModule, JslibModule],
})
export class AdvancedUriOptionDialogComponent {
  constructor(private dialogRef: DialogRef<boolean>) {}

  protected platformUtilsService = inject(PlatformUtilsService);
  protected params = inject<AdvancedUriOptionDialogParams>(DIALOG_DATA);

  get contentKey(): string {
    return this.params.contentKey;
  }

  onCancel() {
    this.params.onCancel?.();
    void this.dialogRef.close(false);
  }

  onContinue() {
    this.params.onContinue?.();
    void this.dialogRef.close(true);
  }

  openLink(event: Event) {
    event.preventDefault();
    this.platformUtilsService.launchUri("https://github.com/xieboss778/LocalPass/tree/main/docs");
  }

  static open(
    dialogService: DialogService,
    params: AdvancedUriOptionDialogParams,
  ): DialogRef<boolean> {
    return dialogService.open<boolean>(AdvancedUriOptionDialogComponent, {
      data: params,
      disableClose: true,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
