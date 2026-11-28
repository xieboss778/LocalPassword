import { Injectable, inject } from "@angular/core";
import { Observable, map } from "rxjs";

import {
  GlobalStateProvider,
  KeyDefinition,
  LOCAL_UI_DISK,
} from "@localpass/common/platform/state";

/** 列表密度只影响显示，不涉及保险库数据。 */
export const VaultDensity = Object.freeze({
  Compact: "compact",
  Ultra: "ultra",
} as const);
export type VaultDensity = (typeof VaultDensity)[keyof typeof VaultDensity];

export const VAULT_DENSITY = new KeyDefinition<VaultDensity>(LOCAL_UI_DISK, "vaultDensity", {
  deserializer: (value) =>
    value === VaultDensity.Ultra ? VaultDensity.Ultra : VaultDensity.Compact,
});

@Injectable({ providedIn: "root" })
export class VaultDensityService {
  private readonly densityState = inject(GlobalStateProvider).get(VAULT_DENSITY);

  readonly density$: Observable<VaultDensity> = this.densityState.state$.pipe(
    map((density) => density ?? VaultDensity.Compact),
  );

  async setDensity(density: VaultDensity): Promise<void> {
    await this.densityState.update(() => density, {
      shouldUpdate: (current) => current !== density,
    });
  }
}
