import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { DevicePendingAuthRequest } from "@localpass/common/auth/abstractions/devices/responses/device.response";
import { BadgeModule, ItemModule } from "@localpass/components";
import { I18nPipe } from "@localpass/ui-common";

import { DeviceDisplayData } from "./device-management.component";

/** Displays user devices in an item list view */
// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  selector: "auth-device-management-item-group",
  templateUrl: "./device-management-item-group.component.html",
  imports: [BadgeModule, CommonModule, ItemModule, I18nPipe],
})
export class DeviceManagementItemGroupComponent {
  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() devices: DeviceDisplayData[] = [];
  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onAuthRequestAnswered = new EventEmitter<DevicePendingAuthRequest>();

  protected answerAuthRequest(pendingAuthRequest: DevicePendingAuthRequest | null) {
    if (pendingAuthRequest == null) {
      return;
    }
    this.onAuthRequestAnswered.emit(pendingAuthRequest);
  }
}
