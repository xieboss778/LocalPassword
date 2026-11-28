import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";
import { ZXCVBNResult } from "zxcvbn";

import { Account, AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";

import { LpToastService } from "../../local-ui";

import { HealthV2Component } from "./health-v2.component";

const RECENT = new Date("2026-10-01T12:00:00Z");

describe("HealthV2Component", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const accountService = mock<AccountService>();
  const passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
  const toast = mock<LpToastService>();
  const router = { navigate: jest.fn().mockResolvedValue(true) };

  const reused = (id: string, name: string): CipherView =>
    Object.assign(new CipherView(), {
      id,
      name,
      type: CipherType.Login,
      revisionDate: RECENT,
      login: Object.assign(new LoginView(), {
        username: `${id}@example.com`,
        password: "correct-horse-battery-staple",
        passwordRevisionDate: RECENT,
        totp: `totp-${id}`,
      }),
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) =>
      key === "healthCheckSharedWith" ? "Shared with {NAMES}" : key,
    );
    i18nService.locale$ = of("en");
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 4 } as ZXCVBNResult);
    cipherService.getAllDecrypted.mockResolvedValue([
      reused("cipher-b", "Beta"),
      reused("cipher-a", "Alpha"),
    ]);
    accountService.activeAccount$ = of({
      id: "user-id" as Account["id"],
      email: "local@example.invalid",
      emailVerified: true,
      name: undefined,
      creationDate: undefined,
    } as Account);

    await TestBed.configureTestingModule({
      imports: [HealthV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: PasswordStrengthServiceAbstraction, useValue: passwordStrengthService },
        { provide: LpToastService, useValue: toast },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { compact: false } } },
        },
      ],
    }).compileComponents();
  });

  it("shows the reused group once and opens the first item in the vault editor", async () => {
    const fixture = TestBed.createComponent(HealthV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain("Alpha");
    expect(root.textContent).toContain("Beta");
    expect(root.textContent).toContain("healthCheckReusedChip");
    expect(root.querySelectorAll(".agy-prow")).toHaveLength(1);

    const fix = root.querySelector(".agy-prow button") as HTMLButtonElement;
    fix.click();

    expect(router.navigate).toHaveBeenCalledWith(["/vault"], {
      queryParams: { cipherId: "cipher-a", edit: "1" },
    });
  });
});
