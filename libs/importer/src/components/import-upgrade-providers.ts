// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@localpass/admin-console/common";
import { safeProvider, SafeProvider } from "@localpass/angular/platform/utils/safe-provider";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { SdkService } from "@localpass/common/platform/abstractions/sdk/sdk.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { RestrictedItemTypesService } from "@localpass/common/vault/services/restricted-item-types.service";
import { KeyService } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, KeyGenerationService } from "@localpass/legacy-crypto";

import {
  ImportApiServiceAbstraction,
  ImportUpgradeService,
  ImportUpgradeServiceAbstraction,
} from "../services";

import { ImporterProviders } from "./importer-providers";

/** `ImporterProviders` plus the upgraded flow's import service. Provided only by the upgraded
 *  import hosts.
 *
 *  TODO: remove once pm-35053-import-upgrade is retired */
export const ImportUpgradeProviders: SafeProvider[] = [
  ...ImporterProviders,
  safeProvider({
    provide: ImportUpgradeServiceAbstraction,
    useClass: ImportUpgradeService,
    deps: [
      CipherService,
      FolderService,
      ImportApiServiceAbstraction,
      I18nService,
      CollectionService,
      KeyService,
      EncryptService,
      KeyGenerationService,
      AccountService,
      RestrictedItemTypesService,
      ConfigService,
      SdkService,
      LogService,
    ],
  }),
];
