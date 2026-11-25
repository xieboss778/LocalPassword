import * as sdk from "@localpass/sdk-internal";

import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";

import { importSdkWasm } from "./wasm-simd";

/**
 * Directly imports the LocalPass SDK and initializes it.
 *
 * **Warning**: This requires WASM support and will fail if the environment does not support it.
 */
export class DefaultSdkLoadService extends SdkLoadService {
  async load(): Promise<void> {
    (sdk as any).init(await importSdkWasm());
  }
}
