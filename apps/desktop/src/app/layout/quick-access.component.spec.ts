import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LpToastService } from "@localpass/angular/local-ui";
import { Account, AccountService } from "@localpass/common/auth/abstractions/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { GlobalStateProvider } from "@localpass/common/platform/state";
import { FakeGlobalStateProvider } from "@localpass/common/spec";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { PasswordRepromptService } from "@localpass/vault";

import { LocalQuickAccessComponent } from "./quick-access.component";

describe("LocalQuickAccessComponent", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const folderService = mock<FolderService>();
  const accountService = mock<AccountService>();
  const passwordRepromptService = mock<PasswordRepromptService>();
  const autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
  const router = { navigate: jest.fn().mockResolvedValue(true) };

  const login = Object.assign(new LoginView(), {
    username: "ada",
    password: "correct-horse-battery",
    totp: "otpauth://totp/LocalPass:ada?secret=JBSWY3DPEHPK3PXP",
  });
  const cipher = Object.assign(new CipherView(), {
    id: "cipher-1",
    name: "Northwind",
    favorite: true,
    login,
    notes: "edge gateway",
    revisionDate: new Date("2026-11-01T10:00:00Z"),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    cipherService.getAllDecrypted.mockResolvedValue([cipher]);
    folderService.folderViews$.mockReturnValue(of([]));
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);
    autofillSettingsService.clearClipboardDelay$ = of(ClearClipboardDelay.TenSeconds);
    accountService.activeAccount$ = of({
      id: "user-id" as Account["id"],
      email: "local@example.invalid",
      emailVerified: true,
      name: undefined,
      creationDate: undefined,
    } as Account);

    await TestBed.configureTestingModule({
      imports: [LocalQuickAccessComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: FolderService, useValue: folderService },
        { provide: AccountService, useValue: accountService },
        { provide: Router, useValue: router },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: AutofillSettingsServiceAbstraction, useValue: autofillSettingsService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    }).compileComponents();
  });

  async function open(): Promise<ComponentFixture<LocalQuickAccessComponent>> {
    const fixture = TestBed.createComponent(LocalQuickAccessComponent);
    fixture.componentRef.setInput("open", true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function search(fixture: ComponentFixture<LocalQuickAccessComponent>, query: string): void {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      ".agy-qs-input",
    );
    expect(input).not.toBeNull();
    input!.value = query;
    input!.dispatchEvent(new Event("input"));
    fixture.detectChanges();
  }

  it("searches all fields and opens the selected vault item", async () => {
    const fixture = await open();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain("Northwind");

    search(fixture, "ada");

    const input = root.querySelector<HTMLInputElement>(".agy-qs-input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(router.navigate).toHaveBeenCalledWith(["/vault"], {
      queryParams: { cipherId: "cipher-1" },
    });
  });

  it("filters with =totp and reports an empty result instead of fake rows", async () => {
    const fixture = await open();
    const root = fixture.nativeElement as HTMLElement;

    search(fixture, "=totp");
    expect(root.textContent).toContain("Northwind");

    search(fixture, "=ssh");
    expect(root.textContent).not.toContain("Northwind");
    expect(root.textContent).toContain("noResultsFor");
  });

  it("does not find an item by its password or TOTP seed", async () => {
    const fixture = await open();
    const root = fixture.nativeElement as HTMLElement;

    search(fixture, "correct-horse-battery");
    expect(root.textContent).not.toContain("Northwind");

    search(fixture, "JBSWY3DPEHPK3PXP");
    expect(root.textContent).not.toContain("Northwind");

    search(fixture, "edge gateway");
    expect(root.textContent).toContain("Northwind");
  });

  it("uses the clipboard-clear setting for generated passwords", async () => {
    const fixture = await open();
    const toast = TestBed.inject(LpToastService);
    const showClipboard = jest.spyOn(toast, "showClipboard").mockImplementation();

    fixture.componentInstance["generateAndCopy"]();

    expect(showClipboard).toHaveBeenCalledWith("passwordGenerated", expect.any(Function), 10);
  });
});
