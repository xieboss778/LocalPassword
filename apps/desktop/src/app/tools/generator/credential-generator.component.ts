import { Component } from "@angular/core";

import {
  ButtonModule,
  DialogModule,
  DialogService,
  IconComponent,
  ItemModule,
} from "@localpass/components";
import {
  CredentialGeneratorHistoryDialogComponent,
  GeneratorModule,
} from "@localpass/generator-components";
import { I18nPipe } from "@localpass/ui-common";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "credential-generator",
  templateUrl: "credential-generator.component.html",
  imports: [IconComponent, DialogModule, ButtonModule, I18nPipe, GeneratorModule, ItemModule],
})
export class CredentialGeneratorComponent {
  constructor(private dialogService: DialogService) {}

  openHistoryDialog = () => {
    // open history dialog
    this.dialogService.open(CredentialGeneratorHistoryDialogComponent);
  };
}
