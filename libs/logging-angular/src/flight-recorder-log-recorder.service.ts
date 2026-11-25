import { Injectable } from "@angular/core";

import { SdkLoadService } from "@localpass/common/platform/abstractions/sdk/sdk-load.service";
import { FlightRecorderLogRecorder } from "@localpass/logging";
import { FlightRecorderClient } from "@localpass/sdk-internal";

/**
 * Angular wrapper for {@link FlightRecorderLogRecorder}.
 */
@Injectable({ providedIn: "root" })
export class FlightRecorderLogRecorderService extends FlightRecorderLogRecorder {
  constructor() {
    super(SdkLoadService.Ready.then(() => new FlightRecorderClient()));
  }
}
