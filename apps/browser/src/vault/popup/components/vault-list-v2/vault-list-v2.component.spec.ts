import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LpToastService, VaultDensity, VaultDensityService } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherRepromptType } from "@localpass/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { Cipher } from "@localpass/common/vault/models/domain/cipher";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { CipherListView } from "@localpass/sdk-internal";
import { LockService } from "@localpass/unlock";
import { PasswordRepromptService } from "@localpass/vault";

import { ImportConfirmationPopupService } from "../../../../tools/popup/settings/import/import-confirmation-popup.service";
import { VaultPopupAutofillService } from "../../services/vault-popup-autofill.service";

import { VaultListV2Component } from "./vault-list-v2.component";

describe("VaultListV2Component", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const folderService = mock<FolderService>();
  const accountService = mock<AccountService>();
  const toast = mock<LpToastService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const passwordRepromptService = mock<PasswordRepromptService>();
  const router = { navigate: jest.fn(), navigateByUrl: jest.fn() };

  const view = Object.assign(new CipherView(), {
    id: "cipher-1",
    name: "Northwind",
    type: CipherType.Login,
    reprompt: CipherRepromptType.Password,
    login: Object.assign(new LoginView(), { password: "protected-secret" }),
  });
  const listView = {
    id: "cipher-1",
    name: "Northwind",
    type: { login: { username: "northwind-user", uris: [] } },
    favorite: false,
    organizationId: null,
    collectionIds: [],
    fields: [],
    revisionDate: "2025-01-01T00:00:00.000Z",
    copyableFields: [],
  } as unknown as CipherListView;

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    accountService.activeAccount$ = of({ id: "user-id" } as never);
    cipherService.cipherListViewsIncludingRestricted$.mockReturnValue(of([]));
    cipherService.get.mockResolvedValue(mock<Cipher>());
    cipherService.decrypt.mockResolvedValue(view);
    folderService.folderViews$.mockReturnValue(of([]));
    platformUtilsService.copyToClipboard.mockReturnValue(true);
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [VaultListV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: FolderService, useValue: folderService },
        { provide: AccountService, useValue: accountService },
        { provide: LockService, useValue: mock<LockService>() },
        { provide: LpToastService, useValue: toast },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
              paramMap: convertToParamMap({}),
            },
            queryParamMap: of(convertToParamMap({})),
          },
        },
        {
          provide: ImportConfirmationPopupService,
          useValue: { conditionallyOpen: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: VaultPopupAutofillService,
          useValue: { currentAutofillTab$: of(null) },
        },
        {
          provide: VaultDensityService,
          useValue: { density$: of(VaultDensity.Compact) },
        },
        {
          provide: AutofillSettingsServiceAbstraction,
          useValue: { clearClipboardDelay$: of(ClearClipboardDelay.ThirtySeconds) },
        },
      ],
    }).compileComponents();
  });

  async function createCopyTarget(withListView = false) {
    if (withListView) {
      cipherService.cipherListViewsIncludingRestricted$.mockReturnValue(of([listView]));
    }

    const fixture = TestBed.createComponent(VaultListV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  it("opens a vault row when Enter is pressed on the row itself", async () => {
    const fixture = await createCopyTarget(true);
    const row = fixture.nativeElement.querySelector('[role="button"][data-row]') as HTMLElement;

    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(router.navigate).toHaveBeenCalledWith(["/view-cipher-v2"], {
      queryParams: { cipherId: "cipher-1" },
    });
  });

  it("does not open the vault row when Enter is pressed on its copy button", async () => {
    const fixture = await createCopyTarget(true);
    const copyUsername = fixture.nativeElement.querySelector(
      'button[aria-label="copyUsername"]',
    ) as HTMLButtonElement;

    copyUsername.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does not copy a protected password until the master password re-prompt passes", async () => {
    const fixture = await createCopyTarget();
    const component = fixture.componentInstance as unknown as {
      copyPassword(event: Event, id: string): Promise<void>;
    };
    const event = { stopPropagation: jest.fn() } as unknown as Event;

    await component.copyPassword(event, "cipher-1");

    expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(view);
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("copies the password after the master password re-prompt passes", async () => {
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);
    const fixture = await createCopyTarget();
    const component = fixture.componentInstance as unknown as {
      copyPassword(event: Event, id: string): Promise<void>;
    };
    const event = { stopPropagation: jest.fn() } as unknown as Event;

    await component.copyPassword(event, "cipher-1");

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("protected-secret", {
      window,
    });
  });
});
