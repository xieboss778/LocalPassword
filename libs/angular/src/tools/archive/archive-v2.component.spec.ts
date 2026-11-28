import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";

import { LpToastService } from "../../local-ui";

import { ArchiveV2Component } from "./archive-v2.component";

describe("ArchiveV2Component", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const accountService = mock<AccountService>();
  const toast = mock<LpToastService>();
  const router = { navigateByUrl: jest.fn().mockResolvedValue(true) };

  const archived = Object.assign(new CipherView(), {
    id: "cipher-1",
    name: "Old GitHub",
    archivedDate: new Date("2026-11-20T10:00:00Z"),
    login: Object.assign(new LoginView(), { username: "ada@example.com" }),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    i18nService.locale$ = of("en");
    cipherService.getAllDecrypted.mockResolvedValue([archived]);
    cipherService.updateWithServer.mockResolvedValue(archived);
    accountService.activeAccount$ = of({
      id: "user-id" as Account["id"],
      email: "local@example.invalid",
      emailVerified: true,
      name: undefined,
      creationDate: undefined,
    } as Account);

    await TestBed.configureTestingModule({
      imports: [ArchiveV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: LpToastService, useValue: toast },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { compact: false } } },
        },
      ],
    }).compileComponents();
  });

  it("lists archived items and clears archivedDate when unarchiving", async () => {
    const fixture = TestBed.createComponent(ArchiveV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain("Old GitHub");

    const button = root.querySelector("button.agy-btn") as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(archived.archivedDate).toBeUndefined();
    expect(root.textContent).not.toContain("Old GitHub");
    expect(toast.show).toHaveBeenCalledWith("itemUnarchivedToast");
  });
});
