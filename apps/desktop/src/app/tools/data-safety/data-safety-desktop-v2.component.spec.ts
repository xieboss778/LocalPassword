import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { LpToastService } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { Cipher } from "@localpass/common/vault/models/domain/cipher";
import { DialogService } from "@localpass/components";
import {
  CIPHER_VERSION_HISTORY,
  VaultBackupService,
  VaultBackupSyncService,
  VaultBackupSettings,
} from "@localpass/local-vault";
import { StateProvider } from "@localpass/state";

import { DataSafetyDesktopV2Component } from "./data-safety-desktop-v2.component";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;

const settings: VaultBackupSettings = {
  backupFrequency: "off",
  backupRetention: 10,
  wrappedBackupPassword: null,
  lastBackupAt: null,
};

describe("DataSafetyDesktopV2Component", () => {
  let fixture: ComponentFixture<DataSafetyDesktopV2Component>;
  let component: DataSafetyDesktopV2Component;
  let cipherService: MockProxy<CipherService>;
  let accountService: MockProxy<AccountService>;
  let backupService: MockProxy<VaultBackupService>;
  let syncService: MockProxy<VaultBackupSyncService>;
  let dialogService: MockProxy<DialogService>;
  let toast: MockProxy<LpToastService>;
  let router: MockProxy<Router>;
  let stateProvider: MockProxy<StateProvider>;
  let historyUpdate: jest.Mock;

  const cipher = (id: string) => ({ id }) as unknown as Cipher;

  beforeEach(async () => {
    cipherService = mock<CipherService>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as never);
    backupService = mock<VaultBackupService>();
    backupService.getSettings.mockResolvedValue(settings);
    syncService = mock<VaultBackupSyncService>();
    syncService.getSyncState.mockResolvedValue({
      manifestEtag: null,
      lastSyncedAt: null,
      generation: null,
      pending: false,
    });
    syncService.hasConfig.mockResolvedValue(false);
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);
    toast = mock<LpToastService>();
    router = mock<Router>();
    router.navigateByUrl.mockResolvedValue(true);
    historyUpdate = jest.fn().mockResolvedValue(undefined);
    stateProvider = mock<StateProvider>();
    stateProvider.getUser.mockReturnValue({ update: historyUpdate } as never);

    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    i18n.locale$ = of("en");

    await TestBed.configureTestingModule({
      imports: [DataSafetyDesktopV2Component],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: VaultBackupService, useValue: backupService },
        { provide: VaultBackupSyncService, useValue: syncService },
        { provide: DialogService, useValue: dialogService },
        { provide: LpToastService, useValue: toast },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: Router, useValue: router },
        { provide: StateProvider, useValue: stateProvider },
      ],
    })
      .overrideComponent(DataSafetyDesktopV2Component, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DataSafetyDesktopV2Component);
    component = fixture.componentInstance;
  });

  it("reports zero server copies", () => {
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector(
      '[data-testid="data_stat_server_copies"]',
    ) as HTMLElement;
    expect(value.textContent?.trim()).toBe("0");
  });

  it("describes file protection and the data directory without platform-specific values", () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain("0600");
    expect(text).not.toContain("~/Library");
    expect(text).toContain("OS");
    expect(text).toContain("dataFileProtection");
    expect(text).toContain("dataDirectoryManaged");
  });

  it("deletes every item in the encrypted state, including trash and archived items", async () => {
    cipherService.getAll.mockResolvedValue([cipher("active"), cipher("trash"), cipher("archived")]);
    component["confirmed"].set(true);

    await component["clearVault"]();

    expect(cipherService.getAll).toHaveBeenCalledWith(userId);
    expect(cipherService.deleteManyWithServer).toHaveBeenCalledWith(
      ["active", "trash", "archived"],
      userId,
    );
    expect(toast.show).toHaveBeenCalledWith("vaultCleared");
    expect(router.navigateByUrl).toHaveBeenCalledWith("/vault");
  });

  it("clears the whole version history so no old password outlives the items", async () => {
    cipherService.getAll.mockResolvedValue([cipher("active")]);
    component["confirmed"].set(true);

    await component["clearVault"]();

    expect(stateProvider.getUser).toHaveBeenCalledWith(userId, CIPHER_VERSION_HISTORY);
    expect(historyUpdate).toHaveBeenCalledTimes(1);
    const update = historyUpdate.mock.calls[0][0] as (state: unknown) => unknown;
    expect(update({ "already-deleted": [{ revisionDate: "2026-01-01T00:00:00.000Z" }] })).toEqual(
      {},
    );
  });

  it("leaves folders and the cloud snapshots alone", async () => {
    cipherService.getAll.mockResolvedValue([cipher("active")]);
    component["confirmed"].set(true);

    await component["clearVault"]();

    expect(syncService.sync).not.toHaveBeenCalled();
    expect(syncService.push).not.toHaveBeenCalled();
    expect(syncService.configure).not.toHaveBeenCalled();
    expect(syncService.disconnect).not.toHaveBeenCalled();
    expect(syncService.restoreSnapshot).not.toHaveBeenCalled();
    expect(backupService.backupNow).not.toHaveBeenCalled();
  });

  it("stops when the first confirmation is declined", async () => {
    cipherService.getAll.mockResolvedValue([cipher("active")]);
    component["confirmed"].set(true);
    dialogService.openSimpleDialog.mockResolvedValueOnce(false);

    await component["clearVault"]();

    expect(cipherService.deleteManyWithServer).not.toHaveBeenCalled();
    expect(historyUpdate).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
  });

  it("stops when the second confirmation is declined", async () => {
    cipherService.getAll.mockResolvedValue([cipher("active")]);
    component["confirmed"].set(true);
    dialogService.openSimpleDialog.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await component["clearVault"]();

    expect(cipherService.deleteManyWithServer).not.toHaveBeenCalled();
    expect(historyUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when the safety checkbox is not checked", async () => {
    await component["clearVault"]();

    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    expect(cipherService.deleteManyWithServer).not.toHaveBeenCalled();
  });

  it("reports a failed deletion instead of claiming the vault was cleared", async () => {
    cipherService.getAll.mockResolvedValue([cipher("active")]);
    component["confirmed"].set(true);
    cipherService.deleteManyWithServer.mockRejectedValue(new Error("state write failed"));

    await component["clearVault"]();

    expect(component["errorMessage"]()).toBe("unexpectedError");
    expect(toast.show).not.toHaveBeenCalled();
    expect(historyUpdate).not.toHaveBeenCalled();
  });
});
