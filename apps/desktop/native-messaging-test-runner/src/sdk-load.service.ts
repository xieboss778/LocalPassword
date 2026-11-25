import { SdkLoadService } from "@localpass/common/platform/abstractions/sdk/sdk-load.service";

import { LogUtils } from "./log-utils";

/**
 * SDK Load Service for the native messaging test runner.
 * For Node.js environments, the SDK's Node.js build automatically loads WASM from the filesystem.
 * No additional initialization is needed.
 */
export class TestRunnerSdkLoadService extends SdkLoadService {
  async load(): Promise<void> {
    // In Node.js, @localpass/sdk-internal automatically loads the WASM file
    // from the SDK package's wasm binary using fs.readFileSync.
    // No explicit loading is required.
  }

  override async loadAndInit(): Promise<void> {
    LogUtils.logInfo("Initializing SDK");
    await super.loadAndInit();
    LogUtils.logSuccess("SDK initialized");
  }
}
