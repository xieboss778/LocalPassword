import { SdkLoadService } from "@localpass/common/platform/abstractions/sdk/sdk-load.service";
import { importSdkWasm } from "@localpass/common/platform/services/sdk/wasm-simd";
import * as sdk from "@localpass/sdk-internal";

export class MainSdkLoadService extends SdkLoadService {
  async load(): Promise<void> {
    const module = await importSdkWasm();
    (sdk as any).init(module);
  }
}
