import { CollectionView } from "@localpass/common/admin-console/models/collections";
import { OrganizationId } from "@localpass/common/types/guid";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { SafeInjectionToken } from "@localpass/ui-common";

export interface AssignCollectionsParams {
  ciphers: CipherView[];
  organizationId: OrganizationId;
  availableCollections: CollectionView[];
  activeCollection?: CollectionView;
  isSingleCipherAdmin?: boolean;
}

export const AssignCollectionsResult = {
  Saved: "saved",
  Canceled: "canceled",
} as const;

export type AssignCollectionsResult =
  (typeof AssignCollectionsResult)[keyof typeof AssignCollectionsResult];

export interface AssignCollectionsDialogRef {
  open(params: AssignCollectionsParams): Promise<AssignCollectionsResult>;
}

export const ASSIGN_COLLECTIONS_DIALOG = new SafeInjectionToken<AssignCollectionsDialogRef>(
  "ASSIGN_COLLECTIONS_DIALOG",
);
