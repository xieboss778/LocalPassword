import { Observable } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@localpass/legacy-crypto";

export abstract class KdfConfigService {
  abstract setKdfConfig(userId: UserId, KdfConfig: KdfConfig): Promise<void>;
  abstract getKdfConfig(userId: UserId): Promise<KdfConfig>;
  abstract getKdfConfig$(userId: UserId): Observable<KdfConfig | null>;
}
