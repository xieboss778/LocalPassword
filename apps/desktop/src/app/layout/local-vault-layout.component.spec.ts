import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { LockService } from "@localpass/unlock";

import { LocalVaultLayoutComponent } from "./local-vault-layout.component";

describe("LocalVaultLayoutComponent", () => {
  const i18nService = mock<I18nService>();
  const accountService = mock<AccountService>();
  accountService.activeAccount$ = of(null);

  beforeEach(async () => {
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [LocalVaultLayoutComponent, RouterTestingModule],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: accountService },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: FolderService, useValue: mock<FolderService>() },
        { provide: LockService, useValue: mock<LockService>() },
      ],
    }).compileComponents();
  });

  it("renders the local vault wordmark instead of the upstream logo", () => {
    const fixture = TestBed.createComponent(LocalVaultLayoutComponent);
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector("nav") as HTMLElement;
    expect(nav.textContent).toContain("localVault");
    expect(nav.querySelector("bit-svg[aria-label]")).not.toBeNull();
  });

  it("offers the local-vault destinations", () => {
    const fixture = TestBed.createComponent(LocalVaultLayoutComponent);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll("nav button"),
    ) as HTMLElement[];
    const labels = buttons
      .map((button) => button.textContent?.trim())
      .filter((label): label is string => !!label);

    expect(labels).toEqual([
      "vault",
      "myFolders",
      "trash",
      "generator",
      "importNoun",
      "exportNoun",
      "cloudBackup",
      "settings",
      "networkGate",
      "dataAndSafety",
    ]);
  });

  it("navigates when a rail entry is clicked", () => {
    const fixture = TestBed.createComponent(LocalVaultLayoutComponent);
    const router = TestBed.inject(Router);
    jest.spyOn(router, "navigateByUrl").mockResolvedValue(true);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll("nav button"),
    ) as HTMLElement[];
    const generator = buttons.find((button) => button.textContent?.trim() === "generator");
    generator?.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith("/generator");
  });
});
