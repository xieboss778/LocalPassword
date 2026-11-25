// eslint-disable-next-line no-restricted-imports
import { EncryptedString } from "@localpass/legacy-crypto";

export class OrganizationUserConfirmRequest {
  key: EncryptedString | undefined;
  defaultUserCollectionName: EncryptedString | undefined;
}
