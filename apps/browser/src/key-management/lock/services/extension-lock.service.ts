import MainBackground from "@localpass/browser/background/main.background";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { AuthService } from "@localpass/common/auth/abstractions/auth.service";
import { LogoutService } from "@localpass/common/auth/logout";
import { ProcessReloadServiceAbstraction } from "@localpass/common/key-management/process-reload";
import { VaultTimeoutSettingsService } from "@localpass/common/key-management/vault-timeout";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { SdkService } from "@localpass/common/platform/abstractions/sdk/sdk.service";
import { SystemService } from "@localpass/common/platform/abstractions/system.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { BiometricsService, KeyService } from "@localpass/key-management";
import { LogService } from "@localpass/logging";
import { StateEventRunnerService } from "@localpass/state";
import { DefaultLockService, LockSource } from "@localpass/unlock";
import { UserId } from "@localpass/user-core";

export class ExtensionLockService extends DefaultLockService {
  constructor(
    accountService: AccountService,
    biometricService: BiometricsService,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    logoutService: LogoutService,
    messagingService: MessagingService,
    folderService: FolderService,
    stateEventRunnerService: StateEventRunnerService,
    cipherService: CipherService,
    authService: AuthService,
    systemService: SystemService,
    processReloadService: ProcessReloadServiceAbstraction,
    logService: LogService,
    keyService: KeyService,
    sdkService: SdkService,
    private readonly main: MainBackground,
  ) {
    super(
      accountService,
      biometricService,
      vaultTimeoutSettingsService,
      logoutService,
      messagingService,
      folderService,
      stateEventRunnerService,
      cipherService,
      authService,
      systemService,
      processReloadService,
      logService,
      keyService,
      sdkService,
    );
  }

  async runPlatformOnLockActions(userId: UserId, source: LockSource): Promise<void> {
    await super.runPlatformOnLockActions(userId, source);
    await this.main.refreshMenu(true);
  }
}
