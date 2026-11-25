import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@localpass/angular/jslib.module";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { UnionOfValues } from "@localpass/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ButtonModule,
  DialogModule,
  IconModule,
  LinkModule,
  TypographyModule,
  CenterPositionStrategy,
} from "@localpass/components";

export interface LeaveConfirmationDialogParams {
  organizationName: string;
}

export const LeaveConfirmationDialogResult = Object.freeze({
  /**
   * User confirmed they want to leave the organization.
   */
  Confirmed: "confirmed",
  /**
   * User chose to go back instead of leaving the organization.
   */
  Back: "back",
} as const);

export type LeaveConfirmationDialogResultType = UnionOfValues<typeof LeaveConfirmationDialogResult>;

@Component({
  templateUrl: "./leave-confirmation-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule, IconModule, LinkModule, TypographyModule, JslibModule],
})
export class LeaveConfirmationDialogComponent {
  private readonly params = inject<LeaveConfirmationDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<LeaveConfirmationDialogResultType>);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly organizationName = this.params.organizationName;

  protected confirmLeave() {
    void this.dialogRef.close(LeaveConfirmationDialogResult.Confirmed);
  }

  protected goBack() {
    void this.dialogRef.close(LeaveConfirmationDialogResult.Back);
  }

  protected openLearnMore(e: Event) {
    e.preventDefault();
    this.platformUtilsService.launchUri("https://github.com/xieboss778/LocalPass/tree/main/docs");
  }

  static open(dialogService: DialogService, config: DialogConfig<LeaveConfirmationDialogParams>) {
    return dialogService.open<LeaveConfirmationDialogResultType>(LeaveConfirmationDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
      disableClose: true,
      ...config,
    });
  }
}
