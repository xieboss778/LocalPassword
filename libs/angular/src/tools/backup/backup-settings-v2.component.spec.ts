import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { UserId } from "@localpass/common/types/guid";
import { DialogService } from "@localpass/components";
import {
  RemoteSnapshotUnavailableError,
  VaultBackupService,
  VaultBackupSyncService,
} from "@localpass/local-vault";

import { LpToastService } from "../../local-ui";

import { BackupSettingsV2Component } from "./backup-settings-v2.component";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;

describe("BackupSettingsV2Component cloud repair", () => {
  let fixture: ComponentFixture<BackupSettingsV2Component>;
  let component: BackupSettingsV2Component;
  let syncService: MockProxy<VaultBackupSyncService>;
  let toast: MockProxy<LpToastService>;
  let dialogService: MockProxy<DialogService>;

  beforeEach(async () => {
    syncService = mock<VaultBackupSyncService>();
    syncService.getConfig.mockResolvedValue(null);
    syncService.getSyncState.mockResolvedValue({
      manifestEtag: null,
      lastSyncedAt: null,
      generation: null,
      pending: false,
    });
    syncService.getPendingConflicts.mockResolvedValue([]);
    syncService.countPendingChanges.mockResolvedValue(0);
    syncService.clientFor.mockResolvedValue(null);
    toast = mock<LpToastService>();
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as never);
    const backupService = mock<VaultBackupService>();
    backupService.getSettings.mockResolvedValue({} as never);
    const router = mock<Router>();
    router.navigateByUrl.mockResolvedValue(true);

    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    i18n.locale$ = of("en");

    await TestBed.configureTestingModule({
      imports: [BackupSettingsV2Component],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: VaultBackupSyncService, useValue: syncService },
        { provide: VaultBackupService, useValue: backupService },
        { provide: AccountService, useValue: accountService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: LpToastService, useValue: toast },
        { provide: DialogService, useValue: dialogService },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BackupSettingsV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("offers repair when the cloud copy cannot be read", async () => {
    syncService.sync.mockRejectedValue(new RemoteSnapshotUnavailableError());

    await component["syncNow"]();
    fixture.detectChanges();

    expect(component["errorMessage"]()).toBe("backupSyncFailed");
    expect(component["canRepair"]()).toBe(true);
    const button = fixture.debugElement.query(By.css('[data-testid="backup_repair_remote"]'));
    expect(button).not.toBeNull();
  });

  it("does not offer repair for failures other than an unreadable cloud copy", async () => {
    syncService.sync.mockRejectedValue(new Error("network unreachable"));

    await component["syncNow"]();
    fixture.detectChanges();

    expect(component["errorMessage"]()).toBe("backupSyncFailed");
    expect(component["canRepair"]()).toBe(false);
    expect(fixture.debugElement.query(By.css('[data-testid="backup_repair_remote"]'))).toBeNull();
  });

  it("repairs only after the user confirms overwriting the cloud manifest", async () => {
    syncService.sync.mockRejectedValue(new RemoteSnapshotUnavailableError());
    syncService.repairRemote.mockResolvedValue({ uploaded: true, snapshotId: "s1" });
    await component["syncNow"]();

    await component["repair"]();

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning" }),
    );
    expect(syncService.repairRemote).toHaveBeenCalledWith(userId);
    expect(toast.show).toHaveBeenCalledWith("backupSynced");
    expect(component["canRepair"]()).toBe(false);
    expect(component["busy"]()).toBe(false);
  });

  it("keeps the repair action when the confirmation is declined", async () => {
    syncService.sync.mockRejectedValue(new RemoteSnapshotUnavailableError());
    dialogService.openSimpleDialog.mockResolvedValue(false);
    await component["syncNow"]();

    await component["repair"]();

    expect(syncService.repairRemote).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
    expect(component["canRepair"]()).toBe(true);
  });
});
