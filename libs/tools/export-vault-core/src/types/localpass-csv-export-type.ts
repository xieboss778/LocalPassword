import { CipherRepromptType } from "@localpass/common/vault/enums/cipher-reprompt-type";

export type LocalPassCsvExportType = {
  type: string;
  name: string;
  notes: string;
  fields: string;
  reprompt: CipherRepromptType;
  // Login props
  login_uri: string[];
  login_username: string;
  login_password: string;
  login_totp: string;
  favorite: number | null;
  archivedDate: string | null;
};

export type LocalPassCsvIndividualExportType = LocalPassCsvExportType & {
  folder: string | null;
};

export type LocalPassCsvOrgExportType = LocalPassCsvExportType & {
  collections: string[] | null;
};
