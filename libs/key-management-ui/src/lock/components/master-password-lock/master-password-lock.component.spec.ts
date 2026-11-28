import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { ClientType } from "@localpass/client-type";
import { Account, AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@localpass/common/spec";
import { UserKey } from "@localpass/common/types/key";
import {
  AsyncActionsModule,
  BUTTON_SPINNER_DELAY_MS,
  ButtonModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@localpass/components";
import { BiometricsStatus, KeyService } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@localpass/legacy-crypto";
import { LogService } from "@localpass/logging";
import { UnlockService } from "@localpass/unlock";
import { UserId } from "@localpass/user-core";

import { UnlockOptions } from "../../services/lock-component.service";
import { WebAuthnPrfUnlockService } from "../../services/webauthn-prf-unlock.service";

import { MasterPasswordLockComponent } from "./master-password-lock.component";

describe("MasterPasswordLockComponent", () => {
  let component: MasterPasswordLockComponent;
  let fixture: ComponentFixture<MasterPasswordLockComponent>;

  const accountService = mock<AccountService>();
  const i18nService = mock<I18nService>();
  const toastService = mock<ToastService>();
  const logService = mock<LogService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const webAuthnPrfUnlockService = mock<WebAuthnPrfUnlockService>();
  const dialogService = mock<DialogService>();
  const unlockService = mock<UnlockService>();
  const keyService = mock<KeyService>();

  const mockMasterPassword = "testExample";
  const activeAccount: Account = {
    id: "user-id" as UserId,
    ...mockAccountInfoWith({
      email: "user@example.com",
      name: "User",
    }),
  };
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;

  const setupComponent = (
    unlockOptions: Partial<UnlockOptions> = {},
    biometricUnlockBtnText: string = "default",
    account: Account | null = activeAccount,
  ) => {
    const defaultOptions: UnlockOptions = {
      masterPassword: { enabled: true },
      pin: { enabled: false },
      biometrics: {
        enabled: false,
        biometricsStatus: BiometricsStatus.NotEnabledLocally,
      },
      prf: { enabled: false },
    };

    accountService.activeAccount$ = of(account);
    fixture.componentRef.setInput("unlockOptions", { ...defaultOptions, ...unlockOptions });
    fixture.componentRef.setInput("biometricUnlockBtnText", biometricUnlockBtnText);
    fixture.detectChanges();

    return {
      form: fixture.debugElement.query(By.css("form")),
      component,
      ...getFormElements(fixture.debugElement.query(By.css("form"))),
    };
  };

  const getFormElements = (form: DebugElement) => ({
    masterPasswordInput: form.query(By.css('input[formControlName="masterPassword"]')),
    submitButton: form.query(By.css('button[type="submit"]')),
    logoutButton: form.query(By.css('[data-testid="lock-master-password-logout-button"]')),
    biometricsSwapButton: form.query(By.css('[data-testid="lock-biometric-swap-button"]')),
    pinSwapButton: form.query(By.css('[data-testid="lock-pin-swap-button"]')),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [
        MasterPasswordLockComponent,
        JslibModule,
        ReactiveFormsModule,
        ButtonModule,
        FormFieldModule,
        AsyncActionsModule,
        IconButtonModule,
      ],
      providers: [
        FormBuilder,
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: WebAuthnPrfUnlockService, useValue: webAuthnPrfUnlockService },
        { provide: DialogService, useValue: dialogService },
        { provide: UnlockService, useValue: unlockService },
        { provide: KeyService, useValue: keyService },
      ],
    }).compileComponents();

    // The lock card is shared by the browser and desktop clients.
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    fixture = TestBed.createComponent(MasterPasswordLockComponent);
    component = fixture.componentInstance;
  });

  describe("form rendering", () => {
    let elements: ReturnType<typeof setupComponent>;

    beforeEach(() => {
      elements = setupComponent();
    });

    it("creates form with proper structure", () => {
      expect(component.formGroup).toBeDefined();
      expect(component.formGroup.controls.masterPassword).toBeDefined();
    });

    const formElementTests = [
      {
        name: "master password input",
        selector: "masterPasswordInput",
        expectations: (el: HTMLInputElement) => {
          expect(el).toMatchObject({
            type: "password",
            name: "masterPassword",
            required: true,
          });
          expect(el.classList.contains("agy-unlock-input")).toBe(true);
        },
      },
      {
        name: "unlock submit button",
        selector: "submitButton",
        expectations: (el: HTMLButtonElement) => {
          expect(el).toMatchObject({
            type: "submit",
            textContent: expect.stringContaining("unlock"),
          });
          expect(el.classList.contains("agy-btn")).toBe(true);
        },
      },
      {
        name: "logout button",
        selector: "logoutButton",
        expectations: (el: HTMLButtonElement) => {
          expect(el).toMatchObject({
            type: "button",
            textContent: expect.stringContaining("logOut"),
          });
        },
      },
    ];

    test.each(formElementTests)("renders $name correctly", ({ selector, expectations }) => {
      const element = elements[selector as keyof typeof elements] as DebugElement;
      expect(element).toBeTruthy();
      expectations(element.nativeElement);
    });

    const hiddenButtonTests = [
      {
        case: "biometrics swap button when biometrics is undefined",
        setup: () =>
          setupComponent(
            {
              pin: { enabled: false },
              biometrics: {
                enabled: undefined as unknown as boolean,
                biometricsStatus: BiometricsStatus.PlatformUnsupported,
              },
            },
            "swapBiometrics",
          ),
        selector: "biometricsSwapButton",
        expectHidden: true,
      },
      {
        case: "biometrics swap button when biometrics is disabled",
        setup: () => setupComponent({}, "swapBiometrics"),
        selector: "biometricsSwapButton",
        expectHidden: true,
      },
      {
        case: "PIN swap button when PIN is disabled",
        setup: () => setupComponent({}),
        selector: "pinSwapButton",
        expectHidden: true,
      },
      {
        case: "PIN swap button when PIN is undefined",
        setup: () =>
          setupComponent({
            pin: { enabled: undefined as unknown as boolean },
            biometrics: {
              enabled: undefined as unknown as boolean,
              biometricsStatus: BiometricsStatus.PlatformUnsupported,
            },
          }),
        selector: "pinSwapButton",
        expectHidden: true,
      },
    ];

    test.each(hiddenButtonTests)("doesn't render $case", ({ setup, selector, expectHidden }) => {
      const element = setup()[selector as "biometricsSwapButton" | "pinSwapButton"];
      expect(!!element).toBe(!expectHidden);
    });
  });

  describe("password input", () => {
    let setup: ReturnType<typeof setupComponent>;
    beforeEach(() => {
      setup = setupComponent();
    });

    it("should bind form input to masterPassword form control", async () => {
      const input = setup.masterPasswordInput;
      expect(input).toBeTruthy();
      expect(input.nativeElement).toBeInstanceOf(HTMLInputElement);
      expect(component.formGroup).toBeTruthy();
      const masterPasswordControl = component.formGroup!.get("masterPassword");
      expect(masterPasswordControl).toBeTruthy();

      masterPasswordControl!.setValue("test-password");
      fixture.detectChanges();

      const inputElement = input.nativeElement as HTMLInputElement;
      expect(inputElement.value).toEqual("test-password");
    });

    it("should validate required master password field", async () => {
      const formGroup = component.formGroup;

      // Initially form should be invalid (empty required field)
      expect(formGroup?.invalid).toEqual(true);
      expect(formGroup?.get("masterPassword")?.hasError("required")).toBe(true);

      // Set a value
      formGroup?.get("masterPassword")?.setValue("test-password");

      expect(formGroup?.invalid).toEqual(false);
      expect(formGroup?.get("masterPassword")?.hasError("required")).toBe(false);
    });
  });

  describe("logout", () => {
    it("emits logOut event when logout button is clicked", () => {
      const setup = setupComponent();
      let logoutEmitted = false;
      component.logOut.subscribe(() => {
        logoutEmitted = true;
      });

      expect(setup.logoutButton).toBeTruthy();
      expect(setup.logoutButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
      const logoutButtonElement = setup.logoutButton.nativeElement as HTMLButtonElement;

      // Click logout button
      logoutButtonElement.click();

      expect(logoutEmitted).toBe(true);
    });
  });

  describe("swap buttons", () => {
    const swapButtonScenarios = [
      {
        name: "PIN swap button when PIN is enabled",
        unlockOptions: {
          pin: { enabled: true },
          biometrics: {
            enabled: false,
            biometricsStatus: BiometricsStatus.PlatformUnsupported,
          },
        },
        expectedText: "unlockWithPin",
        selector: "pinSwapButton",
        shouldShow: true,
        shouldEnable: true,
      },
      {
        name: "PIN swap button when PIN is disabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: {
            enabled: false,
            biometricsStatus: BiometricsStatus.PlatformUnsupported,
          },
        },
        expectedText: "unlockWithPin",
        selector: "pinSwapButton",
        shouldShow: false,
        shouldEnable: false,
      },
      {
        name: "biometrics swap button when biometrics status is available and enabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
        },
        expectedText: "swapBiometrics",
        selector: "biometricsSwapButton",
        shouldShow: true,
        shouldEnable: true,
      },
      {
        name: "biometrics swap button when biometrics status is available and disabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.Available },
        },
        expectedText: "swapBiometrics",
        selector: "biometricsSwapButton",
        shouldShow: true,
        shouldEnable: false,
      },
      {
        name: "biometrics swap button when biometrics biometrics status is unsupported and enabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.PlatformUnsupported },
        },
        expectedText: "swapBiometrics",
        selector: "biometricsSwapButton",
        shouldShow: false,
        shouldEnable: false,
      },
      {
        name: "biometrics swap button when biometrics status is unsupported and disabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.PlatformUnsupported },
        },
        expectedText: "swapBiometrics",
        selector: "biometricsSwapButton",
        shouldShow: false,
        shouldEnable: false,
      },
    ];

    test.each(swapButtonScenarios)(
      "renders and handles $name",
      ({ unlockOptions, expectedText, selector, shouldShow, shouldEnable }) => {
        const element = setupComponent(unlockOptions, expectedText)[
          selector as "biometricsSwapButton" | "pinSwapButton"
        ];

        if (shouldShow) {
          expect(element).toBeTruthy();
          expect(element.nativeElement.textContent?.trim()).toBe(expectedText);
          expect((element.nativeElement as HTMLButtonElement).disabled).toBe(!shouldEnable);
        } else {
          expect(element).toBeFalsy();
        }
      },
    );

    it("emits swapToBiometrics when biometrics swap button is clicked", () => {
      const { biometricsSwapButton } = setupComponent(
        {
          pin: { enabled: false },
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
        },
        "swapBiometrics",
      );
      let emitted = false;
      component.swapToBiometrics.subscribe(() => {
        emitted = true;
      });

      biometricsSwapButton.nativeElement.click();

      expect(emitted).toBe(true);
    });

    it("emits swapToPin when PIN swap button is clicked", () => {
      const { pinSwapButton } = setupComponent({
        pin: { enabled: true },
        biometrics: {
          enabled: false,
          biometricsStatus: BiometricsStatus.PlatformUnsupported,
        },
      });
      let emitted = false;
      component.swapToPin.subscribe(() => {
        emitted = true;
      });

      pinSwapButton.nativeElement.click();

      expect(emitted).toBe(true);
    });
  });

  describe("submit", () => {
    let requestAnimationFrameSpy: jest.SpyInstance | undefined;

    afterEach(() => {
      requestAnimationFrameSpy?.mockRestore();
    });

    it("waits for the button spinner to render before unlocking", async () => {
      let renderFrame: FrameRequestCallback | undefined;
      requestAnimationFrameSpy = jest
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          renderFrame = callback;
          return 0;
        });
      unlockService.unlockWithMasterPassword.mockResolvedValue(undefined);
      keyService.userKey$.mockReturnValue(of(mockUserKey));
      accountService.activeAccount$ = of(activeAccount);
      component.formGroup.controls.masterPassword.setValue(mockMasterPassword);

      const submitPromise = component.submit();
      // Let the component's timers elapse; the frame itself is still held back.
      await new Promise((resolve) => setTimeout(resolve, BUTTON_SPINNER_DELAY_MS * 2));

      expect(renderFrame).toBeDefined();
      expect(unlockService.unlockWithMasterPassword).not.toHaveBeenCalled();

      renderFrame!(0);
      await submitPromise;

      expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        activeAccount.id,
        mockMasterPassword,
      );
    });

    test.each([null, undefined as unknown as string, ""])(
      "won't unlock and show password invalid toast when master password is %s",
      async (value) => {
        component.formGroup.controls.masterPassword.setValue(value);

        await component.submit();

        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: i18nService.t("errorOccurred"),
          message: i18nService.t("masterPasswordRequired"),
        });
        expect(unlockService.unlockWithMasterPassword).not.toHaveBeenCalled();
      },
    );

    test.each([null as unknown as Account, undefined as unknown as Account])(
      "throws error when active account is %s",
      async (value) => {
        accountService.activeAccount$ = of(value);
        component.formGroup.controls.masterPassword.setValue(mockMasterPassword);

        await expect(component.submit()).rejects.toThrow("Null or undefined account");

        expect(unlockService.unlockWithMasterPassword).not.toHaveBeenCalled();
      },
    );

    it("shows an error toast and logs the error when unlock with master password fails", async () => {
      const customError = new Error("Specialized error message");
      unlockService.unlockWithMasterPassword.mockRejectedValue(customError);
      accountService.activeAccount$ = of(activeAccount);
      component.formGroup.controls.masterPassword.setValue(mockMasterPassword);

      await component.submit();

      expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        activeAccount.id,
        mockMasterPassword,
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: i18nService.t("errorOccurred"),
        message: i18nService.t("invalidMasterPassword"),
      });
      expect(logService.error).toHaveBeenCalledWith(
        "[MasterPasswordLockComponent] Failed to unlock via master password",
        customError,
      );
    });

    it("pauses the form after five wrong passwords instead of logging out", async () => {
      setupComponent();
      unlockService.unlockWithMasterPassword.mockRejectedValue(new Error("Wrong password"));
      accountService.activeAccount$ = of(activeAccount);

      for (let attempt = 0; attempt < 5; attempt++) {
        component.formGroup.controls.masterPassword.setValue("wrong-password");
        await component.submit();
      }
      fixture.detectChanges();

      const submitButton = fixture.debugElement.query(By.css('button[type="submit"]'))
        .nativeElement as HTMLButtonElement;
      expect(component.formGroup.controls.masterPassword.disabled).toBe(true);
      expect(submitButton.disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain("unlockWaitTitle");
      expect(fixture.nativeElement.textContent).toContain("unlockWaitRemaining");

      const attemptsBeforeWait = unlockService.unlockWithMasterPassword.mock.calls.length;
      await component.submit();
      expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledTimes(attemptsBeforeWait);

      // Stop the countdown so the test process does not keep a timer alive.
      fixture.destroy();
    });

    it("emits userKey when unlock is successful", async () => {
      unlockService.unlockWithMasterPassword.mockResolvedValue(undefined);
      keyService.userKey$.mockReturnValue(of(mockUserKey));
      accountService.activeAccount$ = of(activeAccount);
      component.formGroup.controls.masterPassword.setValue(mockMasterPassword);
      let emittedEvent: { userKey: UserKey; masterPassword: string } | undefined;
      component.successfulUnlock.subscribe(
        (event: { userKey: UserKey; masterPassword: string }) => {
          emittedEvent = event;
        },
      );

      await component.submit();

      expect(emittedEvent?.userKey).toEqual(mockUserKey);
      expect(emittedEvent?.masterPassword).toEqual(mockMasterPassword);
      expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        activeAccount.id,
        mockMasterPassword,
      );
    });

    it("emits an error when user key is missing after unlock", async () => {
      unlockService.unlockWithMasterPassword.mockResolvedValue(undefined);
      keyService.userKey$.mockReturnValue(of(null));
      accountService.activeAccount$ = of(activeAccount);
      component.formGroup.controls.masterPassword.setValue(mockMasterPassword);

      await component.submit();

      expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        activeAccount.id,
        mockMasterPassword,
      );
      expect(logService.error).toHaveBeenCalledWith(
        "[MasterPasswordLockComponent] Failed to retrieve user key after master password unlock",
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: i18nService.t("errorOccurred"),
        message: i18nService.t("invalidMasterPassword"),
      });
    });
  });
});
