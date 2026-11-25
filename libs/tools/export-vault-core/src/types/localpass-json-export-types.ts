import {
  CipherWithIdExport,
  CollectionWithIdExport,
  FolderWithIdExport,
} from "@localpass/common/models/export";

// Base
export type LocalPassJsonExport = LocalPassUnEncryptedJsonExport | LocalPassEncryptedJsonExport;

// Decrypted
export type LocalPassUnEncryptedJsonExport =
  LocalPassUnEncryptedIndividualJsonExport | LocalPassUnEncryptedOrgJsonExport;

export type LocalPassUnEncryptedIndividualJsonExport = {
  encrypted: false;
  items: CipherWithIdExport[];
  folders: FolderWithIdExport[];
};

export type LocalPassUnEncryptedOrgJsonExport = {
  encrypted: false;
  items: CipherWithIdExport[];
  collections: CollectionWithIdExport[];
};

// Account-encrypted
export type LocalPassEncryptedJsonExport =
  LocalPassEncryptedIndividualJsonExport | LocalPassEncryptedOrgJsonExport;

export type LocalPassEncryptedIndividualJsonExport = {
  encrypted: true;
  encKeyValidation_DO_NOT_EDIT: string;
  items: CipherWithIdExport[];
  folders: FolderWithIdExport[];
};

export type LocalPassEncryptedOrgJsonExport = {
  encrypted: true;
  encKeyValidation_DO_NOT_EDIT: string;
  items: CipherWithIdExport[];
  collections: CollectionWithIdExport[];
};

// Password-protected
export type LocalPassPasswordProtectedFileFormat = {
  encrypted: true;
  passwordProtected: true;
  salt: string;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
  kdfType: number;
  encKeyValidation_DO_NOT_EDIT: string;
  data: string;
};

// Unencrypted type guards
export function isUnencrypted(
  data: LocalPassJsonExport | null | undefined,
): data is LocalPassUnEncryptedJsonExport {
  return data != null && (data as { encrypted?: unknown }).encrypted !== true;
}

export function isIndividualUnEncrypted(
  data: LocalPassJsonExport | null | undefined,
): data is LocalPassUnEncryptedIndividualJsonExport {
  return isUnencrypted(data) && (data as { folders?: unknown }).folders != null;
}

export function isOrgUnEncrypted(
  data: LocalPassJsonExport | null | undefined,
): data is LocalPassUnEncryptedOrgJsonExport {
  return isUnencrypted(data) && (data as { collections?: unknown }).collections != null;
}

// Encrypted type guards
export function isEncrypted(
  data: LocalPassJsonExport | null | undefined,
): data is LocalPassEncryptedJsonExport {
  return data != null && (data as { encrypted?: unknown }).encrypted === true;
}
export function isPasswordProtected(
  data: LocalPassPasswordProtectedFileFormat | LocalPassJsonExport | null | undefined,
): data is LocalPassPasswordProtectedFileFormat {
  return (
    data != null &&
    (data as { encrypted?: unknown }).encrypted === true &&
    (data as { passwordProtected?: unknown }).passwordProtected === true
  );
}

export function isIndividualEncrypted(
  data: LocalPassJsonExport | null | undefined,
): data is LocalPassEncryptedIndividualJsonExport {
  return isEncrypted(data) && (data as { folders?: unknown }).folders != null;
}

export function isOrgEncrypted(
  data: LocalPassJsonExport | null | undefined,
): data is LocalPassEncryptedOrgJsonExport {
  return isEncrypted(data) && (data as { collections?: unknown }).collections != null;
}
