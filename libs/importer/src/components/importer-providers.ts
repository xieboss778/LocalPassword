// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@localpass/admin-console/common";
import { safeProvider, SafeProvider } from "@localpass/angular/platform/utils/safe-provider";
import { ApiService } from "@localpass/common/abstractions/api.service";
import { PolicyService } from "@localpass/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@localpass/common/platform/abstractions/sdk/sdk.service";
import { KeyServiceLegacyEncryptorProvider } from "@localpass/common/tools/cryptography/key-service-legacy-encryptor-provider";
import { LegacyEncryptorProvider } from "@localpass/common/tools/cryptography/legacy-encryptor-provider";
import { ExtensionRegistry } from "@localpass/common/tools/extension/extension-registry.abstraction";
import { buildExtensionRegistry } from "@localpass/common/tools/extension/factory";
import {
  createSystemServiceProvider,
  SystemServiceProvider,
} from "@localpass/common/tools/providers";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { LocalVaultWriter } from "@localpass/common/vault/abstractions/local-vault-writer.abstraction";
import { RestrictedItemTypesService } from "@localpass/common/vault/services/restricted-item-types.service";
import { KeyService } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, KeyGenerationService } from "@localpass/legacy-crypto";
import { StateProvider } from "@localpass/state";
import { SafeInjectionToken } from "@localpass/ui-common";

import {
  ImportApiService,
  ImportApiServiceAbstraction,
  ImportService,
  ImportServiceAbstraction,
} from "../services";

// FIXME: unify with `SYSTEM_SERVICE_PROVIDER` when migrating it from the generator component module
//        to a general module.
export const SYSTEM_SERVICE_PROVIDER = new SafeInjectionToken<SystemServiceProvider>(
  "SystemServices",
);

/** Import service factories */
export const ImporterProviders: SafeProvider[] = [
  safeProvider({
    provide: ImportApiServiceAbstraction,
    useClass: ImportApiService,
    deps: [ApiService],
  }),
  safeProvider({
    provide: LegacyEncryptorProvider,
    useClass: KeyServiceLegacyEncryptorProvider,
    deps: [EncryptService, KeyService, SdkService],
  }),
  safeProvider({
    provide: ExtensionRegistry,
    useFactory: () => {
      return buildExtensionRegistry();
    },
    deps: [],
  }),
  safeProvider({
    provide: SYSTEM_SERVICE_PROVIDER,
    useFactory: createSystemServiceProvider,
    deps: [
      LegacyEncryptorProvider,
      StateProvider,
      PolicyService,
      ExtensionRegistry,
      LogService,
      PlatformUtilsService,
      ConfigService,
    ],
  }),
  safeProvider({
    provide: ImportServiceAbstraction,
    useClass: ImportService,
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
      LocalVaultWriter,
    ],
  }),
];
