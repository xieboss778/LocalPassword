import { Inject, Injectable, DOCUMENT } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AbstractThemingService } from "@localpass/angular/platform/services/theming/theming.service.abstraction";
import { WINDOW } from "@localpass/angular/services/injection-tokens";
import { AutomationDriver } from "@localpass/automation-driver";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { TokenService } from "@localpass/common/auth/abstractions/token.service";
import { TwoFactorService } from "@localpass/common/auth/two-factor";
import { EventUploadService as EventUploadServiceAbstraction } from "@localpass/common/dirt/event-logs";
import { EventUploadService } from "@localpass/common/dirt/event-logs/services/event-upload.service";
import { SharedUnlockPeerService } from "@localpass/common/key-management/shared-unlock";
import { DefaultVaultTimeoutService } from "@localpass/common/key-management/vault-timeout";
import { I18nService as I18nServiceAbstraction } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@localpass/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@localpass/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@localpass/common/platform/ipc";
import { ServerNotificationsService } from "@localpass/common/platform/server-notifications";
import { ContainerService } from "@localpass/common/platform/services/container.service";
import { MigrationRunner } from "@localpass/common/platform/services/migration-runner";
import { UserId } from "@localpass/common/types/guid";
import { LocalVaultWriter } from "@localpass/common/vault/abstractions/local-vault-writer.abstraction";
import { BiometricsService, KeyService as KeyServiceAbstraction } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, LegacyCompatKeyService } from "@localpass/legacy-crypto";
import { TrashMaintenanceService } from "@localpass/local-vault";
import { limitPerformanceMeasurements, LogService } from "@localpass/logging";
import { StateProvider } from "@localpass/state";
import { UnlockService } from "@localpass/unlock";

import { DesktopAutofillService } from "../../autofill/services/desktop-autofill.service";
import { DesktopAutotypeMvpService } from "../../autofill/services/desktop-autotype-mvp.service";
import { DesktopAutotypeService } from "../../autofill/services/desktop-autotype.service";
import { SshAgentService } from "../../autofill/services/ssh-agent.service";
import { I18nRendererService } from "../../platform/services/i18n.renderer.service";
import { ServerCommunicationConfigService } from "../../platform/services/server-communication-config/server-communication-config.service";
import { VersionService } from "../../platform/services/version.service";
import { BiometricMessageHandlerService } from "../../services/biometric-message-handler.service";
import { NativeMessagingService } from "../../services/native-messaging.service";

import { UpdateRestartService } from "./update-restart.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private vaultTimeoutService: DefaultVaultTimeoutService,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorService,
    private notificationsService: ServerNotificationsService,
    private platformUtilsService: PlatformUtilsServiceAbstraction,
    private keyService: KeyServiceAbstraction,
    private nativeMessagingService: NativeMessagingService,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService,
    private unlockService: UnlockService,
    private accountService: AccountService,
    private tokenService: TokenService,
    private versionService: VersionService,
    private sshAgentService: SshAgentService,
    private autofillService: DesktopAutofillService,
    private autotypeMvpService: DesktopAutotypeMvpService,
    private autotypeService: DesktopAutotypeService,
    private sdkLoadService: SdkLoadService,
    private ipcService: IpcService,
    private sharedUnlockPeerService: SharedUnlockPeerService,
    private biometricMessageHandlerService: BiometricMessageHandlerService,
    private biometricsService: BiometricsService,
    private legacyCompatKeyService: LegacyCompatKeyService,
    @Inject(DOCUMENT) private document: Document,
    private readonly migrationRunner: MigrationRunner,
    private serverCommunicationConfigService: ServerCommunicationConfigService,
    private updateRestartService: UpdateRestartService,
    private logService: LogService,
    private automationDriver: AutomationDriver,
    private localVaultWriter: LocalVaultWriter,
    private stateProvider: StateProvider,
  ) {}

  init() {
    return async () => {
      limitPerformanceMeasurements();
      await this.sdkLoadService.loadAndInit();
      await this.ipcService.init();
      await this.biometricsService.setUnlockService(this.unlockService);
      await this.sshAgentService.init();
      this.nativeMessagingService.init();
      await this.migrationRunner.waitForCompletion(); // Desktop will run migrations in the main process

      const accounts = await firstValueFrom(this.accountService.accounts$);
      const userIds = Object.keys(accounts) as UserId[];
      await this.tokenService.cleanupTokenStorage(userIds);

      // Shared unlock starts before auto unlock, so the peer's unlock hook reports the restored unlock.
      await this.sharedUnlockPeerService.start();

      // 回收站保留 30 天：解锁后清掉已经到期的条目。放在自动解锁之前，never-lock 的本地
      // 保险库在启动时也会被清理；服务内部吞掉错误，不会影响解锁本身。
      const trashMaintenance = new TrashMaintenanceService(
        this.localVaultWriter,
        this.stateProvider,
        this.logService,
      );
      this.unlockService.registerOnUnlockAction(async (userId) => {
        await trashMaintenance.purgeExpiredTrash(userId);
      });

      // For each acct, we must await the process of unlocking with the never-lock key
      // if it is set, to avoid race conditions of any code trying to access the user key
      // from mem. A failure to unlock one account leaves that account locked rather than
      // failing app initialization for every other account.
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            await this.unlockService.unlockWithAutoUnlockKey(userId);
          } catch (e) {
            this.logService.error("[InitService] Failed to auto-unlock user on startup", e);
          }
        }),
      );

      await this.serverCommunicationConfigService.init();
      await this.vaultTimeoutService.init(true);
      await (this.i18nService as I18nRendererService).init();
      (this.eventUploadService as EventUploadService).init(true);
      this.twoFactorService.init();
      this.notificationsService.startListening();
      const htmlEl = this.win.document.documentElement;
      htmlEl.classList.add("os_" + this.platformUtilsService.getDeviceString());
      this.themingService.applyThemeChangesTo(this.document);

      this.versionService.init();
      this.updateRestartService.init();

      const containerService = new ContainerService(
        this.keyService,
        this.encryptService,
        this.legacyCompatKeyService,
      );
      containerService.attachToGlobal(this.win);
      this.automationDriver.attachToGlobal(this.win);

      await this.biometricMessageHandlerService.init();
      await this.autofillService.init();
      await this.autotypeMvpService.init();
      await this.autotypeService.init();
    };
  }
}
