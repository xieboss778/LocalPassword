import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { LpToastService } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { UserId } from "@localpass/common/types/guid";
import { DialogService } from "@localpass/components";
import {
  RemoteSnapshotUnavailableError,
  VaultBackupService,
  VaultBackupSyncService,
} from "@localpass/local-vault";

import { BackupStatusDesktopV2Component } from "./backup-status-desktop-v2.component";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;

describe("BackupStatusDesktopV2Component", () => {
  let fixture: ComponentFixture<BackupStatusDesktopV2Component>;
  let component: BackupStatusDesktopV2Component;
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
    toast = mock<LpToastService>();
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as never);
    const router = mock<Router>();
    router.navigateByUrl.mockResolvedValue(true);

    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    i18n.locale$ = of("en");

    await TestBed.configureTestingModule({
      imports: [BackupStatusDesktopV2Component],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: VaultBackupSyncService, useValue: syncService },
        { provide: VaultBackupService, useValue: mock<VaultBackupService>() },
        { provide: AccountService, useValue: accountService },
        { provide: LpToastService, useValue: toast },
        { provide: DialogService, useValue: dialogService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BackupStatusDesktopV2Component);
    component = fixture.componentInstance;
  });

  it("surfaces a localized sync error when the cloud snapshot is missing or unreadable", async () => {
    syncService.sync.mockRejectedValue(new RemoteSnapshotUnavailableError());

    await component["syncNow"]();

    expect(component["errorMessage"]()).toBe("backupSyncFailed");
    expect(toast.show).not.toHaveBeenCalled();
    expect(component["busy"]()).toBe(false);
    expect(component["canRepair"]()).toBe(true);
  });

  it("shows the repair action for an unreadable cloud copy", async () => {
    syncService.sync.mockRejectedValue(new RemoteSnapshotUnavailableError());

    fixture.detectChanges();
    await component["syncNow"]();
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('[data-testid="backup_repair_remote"]'));
    expect(button).not.toBeNull();
  });

  it("does not offer repair for failures other than an unreadable cloud copy", async () => {
    syncService.sync.mockRejectedValue(new Error("network unreachable"));

    await component["syncNow"]();

    expect(component["errorMessage"]()).toBe("backupSyncFailed");
    expect(component["canRepair"]()).toBe(false);
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

  it("does not repair when the confirmation is declined", async () => {
    syncService.sync.mockRejectedValue(new RemoteSnapshotUnavailableError());
    dialogService.openSimpleDialog.mockResolvedValue(false);
    await component["syncNow"]();

    await component["repair"]();

    expect(syncService.repairRemote).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
    expect(component["canRepair"]()).toBe(true);
  });

  it("does not announce success when the sync uploaded nothing", async () => {
    syncService.sync.mockResolvedValue({
      pulled: { applied: 0, upToDate: false, conflicts: [] },
      pushed: { uploaded: false, snapshotId: null },
    });

    await component["syncNow"]();

    expect(component["errorMessage"]()).toBe("backupSyncFailed");
    expect(toast.show).not.toHaveBeenCalled();
    expect(component["canRepair"]()).toBe(false);
  });
});
