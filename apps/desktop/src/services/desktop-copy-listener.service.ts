import { Injectable } from "@angular/core";

import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { CopyClickListener } from "@localpass/components";

@Injectable()
export class DesktopCopyListenerService implements CopyClickListener {
  constructor(private messagingService: MessagingService) {}

  onCopy(_value: string): void {
    this.messagingService.send("minimizeOnCopy");
  }
}
