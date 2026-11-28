import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { LpToastService } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { UserId } from "@localpass/common/types/guid";
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
  });

  it("does not announce success when the sync uploaded nothing", async () => {
    syncService.sync.mockResolvedValue({
      pulled: { applied: 0, upToDate: false, conflicts: [] },
      pushed: { uploaded: false, snapshotId: null },
    });

    await component["syncNow"]();

    expect(component["errorMessage"]()).toBe("backupSyncFailed");
    expect(toast.show).not.toHaveBeenCalled();
  });
});
