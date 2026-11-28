import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { Cipher } from "@localpass/common/vault/models/domain/cipher";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { CIPHER_VERSION_HISTORY, diffFieldLabelKeys } from "@localpass/local-vault";
import { StateProvider } from "@localpass/state";

export interface CipherVersionRow {
  readonly revisionDate: Date;
  readonly view: CipherView;
  /** i18n keys of the fields this version differs from the current one in. */
  readonly changedFields: readonly string[];
}

/**
 * Reads the device-local encrypted version stack written by the local vault writer.
 *
 * Versions are decrypted only when the history drawer opens, and only long enough to build the
 * display rows. A snapshot the current key cannot open is skipped instead of surfacing an error.
 */
@Injectable({
  providedIn: "root",
})
export class CipherVersionHistoryService {
  private readonly stateProvider = inject(StateProvider);
  private readonly cipherService = inject(CipherService);

  async rows(
    userId: UserId,
    cipherId: string,
    current: CipherView,
  ): Promise<readonly CipherVersionRow[]> {
    const all = await firstValueFrom(
      this.stateProvider.getUser(userId, CIPHER_VERSION_HISTORY).state$,
    );
    const versions = all?.[cipherId] ?? [];

    const rows = await Promise.all(
      versions.map(async (version): Promise<CipherVersionRow | null> => {
        try {
          const view = await this.cipherService.decrypt(new Cipher(version.data), userId);
          return {
            revisionDate: new Date(version.revisionDate),
            view,
            changedFields: diffFieldLabelKeys(view, current),
          };
        } catch {
          return null;
        }
      }),
    );

    return rows.filter((row): row is CipherVersionRow => row != null);
  }
}
