// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { PluralizePipe } from "@localpass/angular/pipes/pluralize.pipe";
import { ButtonModule, DialogConfig, DialogModule, DialogService } from "@localpass/components";
import { I18nPipe } from "@localpass/ui-common";
import {
  AssignCollectionsComponent,
  CollectionAssignmentParams,
  CollectionAssignmentResult,
  Vfo1I18nPipe,
} from "@localpass/vault";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  templateUrl: "./assign-collections-desktop.component.html",
  imports: [
    AssignCollectionsComponent,
    PluralizePipe,
    DialogModule,
    ButtonModule,
    I18nPipe,
    Vfo1I18nPipe,
  ],
})
export class AssignCollectionsDesktopComponent {
  protected editableItemCount: number;
  protected submitButtonText: string;

  constructor(
    @Inject(DIALOG_DATA) public params: CollectionAssignmentParams,
    private dialogRef: DialogRef<CollectionAssignmentResult>,
  ) {}

  protected async onCollectionAssign(result: CollectionAssignmentResult) {
    this.dialogRef.close(result);
  }

  static open(dialogService: DialogService, config: DialogConfig<CollectionAssignmentParams>) {
    return dialogService.open<CollectionAssignmentResult, CollectionAssignmentParams>(
      AssignCollectionsDesktopComponent,
      config,
    );
  }
}
