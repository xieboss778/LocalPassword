import { Injectable } from "@angular/core";

import { SdkLoadService } from "@localpass/common/platform/abstractions/sdk/sdk-load.service";
import { FlightRecorder } from "@localpass/logging";

/**
 * Angular wrapper for {@link FlightRecorder}.
 *
 * Provides the flight recorder as an injectable service, wiring it
 * to {@link SdkLoadService.Ready} automatically.
 */
@Injectable({ providedIn: "root" })
export class FlightRecorderService extends FlightRecorder {
  constructor() {
    super(SdkLoadService.Ready);
  }
}
