import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LpToastService } from "@localpass/angular/local-ui";
import { Account, AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { LockService } from "@localpass/unlock";

import { TrayV2Component } from "./tray-v2.component";

const RECENT = new Date("2026-10-01T12:00:00Z");

describe("TrayV2Component", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const accountService = mock<AccountService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const messagingService = mock<MessagingService>();
  const lockService = mock<LockService>();
  const toast = mock<LpToastService>();

  const login = (id: string, name: string, password: string): CipherView =>
    Object.assign(new CipherView(), {
      id,
      name,
      type: CipherType.Login,
      revisionDate: RECENT,
      login: Object.assign(new LoginView(), {
        username: `${id}@example.com`,
        password,
      }),
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    cipherService.cipherViews$.mockReturnValue(
      of([login("alpha", "Alpha", "secret-1"), login("beta", "Beta", "secret-2")]),
    );
    accountService.activeAccount$ = of({
      id: "user-id" as Account["id"],
      email: "local@example.invalid",
      emailVerified: true,
      name: undefined,
      creationDate: undefined,
    } as Account);

    await TestBed.configureTestingModule({
      imports: [TrayV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: MessagingService, useValue: messagingService },
        { provide: LockService, useValue: lockService },
        { provide: LpToastService, useValue: toast },
      ],
    }).compileComponents();
  });

  it("lists recent logins, narrows them by search and copies a password", () => {
    const fixture = TestBed.createComponent(TrayV2Component);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain("Alpha");
    expect(root.textContent).toContain("Beta");

    const search = root.querySelector("#tray_input_search") as HTMLInputElement;
    search.value = "beta";
    search.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    expect(root.textContent).toContain("Beta");
    expect(root.textContent).not.toContain("Alpha");

    const copy = root.querySelector(".agy-tray-row button") as HTMLButtonElement;
    copy.click();

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("secret-2");
    expect(toast.showClipboard).toHaveBeenCalledWith("valueCopied", expect.any(Function));
  });

  it("opens the main window from the footer", () => {
    const fixture = TestBed.createComponent(TrayV2Component);
    fixture.detectChanges();

    const open = (fixture.nativeElement as HTMLElement).querySelector(
      "#tray_button_open_main",
    ) as HTMLButtonElement;
    open.click();

    expect(messagingService.send).toHaveBeenCalledWith("trayOpenMain");
  });
});
