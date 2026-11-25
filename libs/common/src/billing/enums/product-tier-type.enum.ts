import { ProductTierType as SdkProductTierType } from "@localpass/sdk-internal";

// Re-export the SdkProductTierType so we have a single source of truth
export {
  /** @deprecated Import directly from @localpass/sdk-internal instead. **/
  SdkProductTierType as ProductTierType,
};

export function isNotSelfUpgradable(productType: SdkProductTierType): boolean {
  return (
    productType !== SdkProductTierType.Free &&
    productType !== SdkProductTierType.TeamsStarter &&
    productType !== SdkProductTierType.Families
  );
}
