import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { PendingVaultConflict, VaultBackupSyncService } from "@localpass/local-vault";

import { BackupConflictResolutionV2Component } from "./backup-conflict-resolution.component";

describe("BackupConflictResolutionV2Component", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const accountService = mock<AccountService>();
  const syncService = mock<VaultBackupSyncService>();

  const conflict: PendingVaultConflict = {
    id: "c1",
    kind: "cipher",
    copyId: "0b7a9f2e-3a6d-5b6f-8f0a-1c2d3e4f5a6b",
    local: {
      id: "c1",
      revisionDate: "2026-11-28T09:00:00.000Z",
      data: {
        id: "c1",
        revisionDate: "2026-11-28T09:00:00.000Z",
        creationDate: "2026-11-01T09:00:00.000Z",
      },
    },
    remote: {
      id: "c1",
      revisionDate: "2026-11-28T10:00:00.000Z",
      data: {
        id: "c1",
        revisionDate: "2026-11-28T10:00:00.000Z",
        creationDate: "2026-11-01T09:00:00.000Z",
      },
    },
  };

  let fixture: ComponentFixture<BackupConflictResolutionV2Component>;
  let component: BackupConflictResolutionV2Component;

  function translated(key: string, ...args: string[]): string {
    return args.length > 0 ? `${key}:${args.join("|")}` : key;
  }

  async function settle(): Promise<void> {
    // ngOnChanges is async; let the account lookup, decrypts, and signal writes run.
    for (let index = 0; index < 4; index++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  }

  function buttonWithText(text: string): HTMLButtonElement {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>("button"),
    );
    const button = buttons.find((candidate) => candidate.textContent?.includes(text));
    if (button == null) {
      throw new Error(`No button containing ${text}`);
    }
    return button;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation(translated);
    i18nService.locale$ = of("en");
    accountService.activeAccount$ = of({
      id: "user-id" as Account["id"],
      email: "local@example.invalid",
      emailVerified: true,
      name: undefined,
      creationDate: undefined,
    } as Account);
    const names = ["Northwind", "Northwind (cloud)"];
    let decryptCall = 0;
    cipherService.decrypt.mockImplementation(async () => {
      const name = names[Math.min(decryptCall++, names.length - 1)];
      return Object.assign(new CipherView(), { id: "c1", name });
    });
    syncService.resolveConflicts.mockResolvedValue({ uploaded: true, snapshotId: "snap-1" });

    await TestBed.configureTestingModule({
      imports: [BackupConflictResolutionV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: VaultBackupSyncService, useValue: syncService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BackupConflictResolutionV2Component);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("conflicts", [conflict]);
    fixture.detectChanges();
    await settle();
  });

  it("shows both sides with their own names and defaults every conflict to keep-both", () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Northwind");
    expect(text).toContain("Northwind (cloud)");
    expect(text).toContain("syncConflictLocalSide");
    expect(text).toContain("syncConflictRemoteSide");
    expect(text).toContain("syncConflictUpdatedAt");

    const selected = fixture.nativeElement.querySelectorAll('button[aria-pressed="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("syncConflictKeepBoth");
  });

  it("names the differing fields without rendering their values", async () => {
    let decryptCall = 0;
    cipherService.decrypt.mockImplementation(async () =>
      Object.assign(new CipherView(), {
        id: "c1",
        name: "Northwind",
        login: Object.assign(new LoginView(), {
          username: "alex@sync.test",
          password: decryptCall++ === 0 ? "local-side-2026" : "remote-side-2026",
        }),
      }),
    );
    fixture.componentRef.setInput("conflicts", [{ ...conflict, id: "c3" }]);
    fixture.detectChanges();
    await settle();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("syncConflictFieldsDiffer:1");
    expect(text).toContain("password");
    expect(text).not.toContain("local-side-2026");
    expect(text).not.toContain("remote-side-2026");
  });

  it("submits the default keep-both choice and reports success", async () => {
    const resolved = jest.fn();
    component.resolved.subscribe(resolved);

    buttonWithText("syncConflictResolve").click();
    await settle();

    expect(syncService.resolveConflicts).toHaveBeenCalledWith("user-id", { c1: "both" });
    expect(resolved).toHaveBeenCalled();
  });

  it("submits the choice picked for each conflict", async () => {
    buttonWithText("syncConflictKeepRemote").click();
    fixture.detectChanges();
    buttonWithText("syncConflictResolve").click();
    await settle();

    expect(syncService.resolveConflicts).toHaveBeenCalledWith("user-id", { c1: "remote" });
  });

  it("keeps the choices pending and shows an error when the upload does not happen", async () => {
    const resolved = jest.fn();
    component.resolved.subscribe(resolved);
    syncService.resolveConflicts.mockResolvedValue({ uploaded: false, snapshotId: null });

    buttonWithText("syncConflictResolve").click();
    await settle();

    expect(resolved).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain("syncConflictFailed");
    expect(buttonWithText("syncConflictResolve").disabled).toBe(false);
  });

  it("falls back to a neutral label when a record cannot be decrypted", async () => {
    cipherService.decrypt.mockRejectedValue(new Error("boom"));
    fixture.componentRef.setInput("conflicts", [{ ...conflict, id: "c2" }]);
    fixture.detectChanges();
    await settle();

    expect(fixture.nativeElement.textContent).toContain("syncConflictUntitledItem");
    expect(fixture.nativeElement.textContent).not.toContain("boom");
  });
});
