import {
  DefaultNewDeviceVerificationComponentService,
  NewDeviceVerificationComponentService,
} from "@localpass/auth/angular";

export class ExtensionNewDeviceVerificationComponentService
  extends DefaultNewDeviceVerificationComponentService
  implements NewDeviceVerificationComponentService
{
  showBackButton() {
    return false;
  }
}
