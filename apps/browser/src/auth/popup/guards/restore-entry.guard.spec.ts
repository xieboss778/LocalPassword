import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { of } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { AuthService } from "@localpass/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@localpass/common/auth/enums/authentication-status";
import { FakeAccountService, mockAccountServiceWith } from "@localpass/common/spec";
import { UserId } from "@localpass/common/types/guid";

import { restoreEntryGuard } from "./restore-entry.guard";

const USER_ID = "f0c8b4c4-7a1e-4c5e-8d1a-2b3c4d5e6f70" as UserId;

describe("restoreEntryGuard", () => {
  let accountService: AccountService;
  let authService: AuthService;
  const router = { createUrlTree: jest.fn((commands: string[]) => ({ commands })) } as unknown as {
    createUrlTree: jest.Mock;
  };

  const setUp = (account: AccountService, status: AuthenticationStatus) => {
    accountService = account;
    authService = { authStatusFor$: () => of(status) } as unknown as AuthService;
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  };

  beforeEach(() => router.createUrlTree.mockClear());

  it("allows a device with no account", async () => {
    const fakeAccountService = new FakeAccountService({}, {});
    fakeAccountService.activeAccountSubject.next(null);
    setUp(fakeAccountService, AuthenticationStatus.LoggedOut);

    const result = await TestBed.runInInjectionContext(() => restoreEntryGuard());

    expect(result).toBe(true);
  });

  it("allows a locked account", async () => {
    setUp(mockAccountServiceWith(USER_ID), AuthenticationStatus.Locked);

    const result = await TestBed.runInInjectionContext(() => restoreEntryGuard());

    expect(result).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it("allows a logged-out account", async () => {
    setUp(mockAccountServiceWith(USER_ID), AuthenticationStatus.LoggedOut);

    const result = await TestBed.runInInjectionContext(() => restoreEntryGuard());

    expect(result).toBe(true);
  });

  it("sends an unlocked user back to the vault", async () => {
    setUp(mockAccountServiceWith(USER_ID), AuthenticationStatus.Unlocked);

    const result = await TestBed.runInInjectionContext(() => restoreEntryGuard());

    expect(result).toEqual({ commands: ["/tabs/current"] });
    expect(router.createUrlTree).toHaveBeenCalledWith(["/tabs/current"]);
  });
});
