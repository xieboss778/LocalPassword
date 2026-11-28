import { DatePipe, Location } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Params, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherRepromptType } from "@localpass/common/vault/enums/cipher-reprompt-type";
import { Cipher } from "@localpass/common/vault/models/domain/cipher";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { DialogService } from "@localpass/components";

import { LpToastService } from "../../local-ui";

import {
  ITEM_ENTRY_PASSWORD_REPROMPT,
  ItemEntryPasswordReprompt,
} from "./item-entry-password-reprompt.token";
import { ItemFormV2Component } from "./item-form-v2.component";

describe("ItemFormV2Component", () => {
  const cipherService = mock<CipherService>();
  const folderService = mock<FolderService>();
  const accountService = mock<AccountService>();
  const i18nService = mock<I18nService>();
  const passwordRepromptService = mock<ItemEntryPasswordReprompt>();
  const router = { navigate: jest.fn(), navigateByUrl: jest.fn() };
  const queryParams$ = new BehaviorSubject<Params>({});

  const protectedView = Object.assign(new CipherView(), {
    id: "protected-id",
    name: "Protected",
    reprompt: CipherRepromptType.Password,
    login: Object.assign(new LoginView(), {
      username: "user",
      password: "secret",
    }),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    queryParams$.next({ cipherId: "protected-id" });
    accountService.activeAccount$ = of({ id: "user-id" } as never);
    cipherService.getAllDecrypted.mockResolvedValue([]);
    cipherService.get.mockResolvedValue(mock<Cipher>());
    cipherService.decrypt.mockResolvedValue(protectedView);
    folderService.folderViews$.mockReturnValue(of([]));
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: FolderService, useValue: folderService },
        { provide: AccountService, useValue: accountService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParams$,
            snapshot: {
              data: { compact: true },
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: Router, useValue: router },
        { provide: Location, useValue: mock<Location>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: DatePipe, useValue: new DatePipe("en-US") },
        { provide: LpToastService, useValue: mock<LpToastService>() },
        { provide: ITEM_ENTRY_PASSWORD_REPROMPT, useValue: passwordRepromptService },
      ],
    }).compileComponents();
  });

  function createComponent(): ItemFormV2Component {
    return TestBed.runInInjectionContext(() => new ItemFormV2Component());
  }

  it.each([
    ["editing", { cipherId: "protected-id" }],
    ["cloning", { cloneFrom: "protected-id" }],
  ])(
    "does not open a protected item for %s before the master password re-prompt passes",
    async (_, params) => {
      queryParams$.next(params);
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);
      const component = createComponent();

      await component.ngOnInit();

      expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(protectedView);
      expect(router.navigateByUrl).toHaveBeenCalledWith("/tabs/vault");
      expect(component["original"]()).toBeNull();
      expect(component["values"]()).toEqual({});
    },
  );

  it("opens the form after the master password re-prompt passes", async () => {
    const component = createComponent();

    await component.ngOnInit();

    expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(protectedView);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(component["original"]()).toBe(protectedView);
    expect(component["values"]()).toMatchObject({
      username: "user",
      password: "secret",
    });
  });

  it("leaves the cached item untouched when the edit fails to save", async () => {
    const component = createComponent();
    await component.ngOnInit();
    component["values"].update((values) => ({
      ...values,
      name: "Renamed",
      username: "changed",
    }));
    cipherService.updateWithServer.mockRejectedValue(new Error("local write failed"));

    await component["save"]();

    expect(cipherService.updateWithServer).toHaveBeenCalled();
    expect(protectedView.name).toBe("Protected");
    expect(protectedView.login.username).toBe("user");
    expect(component["errorMessage"]()).toBe("unexpectedError");
  });
});
