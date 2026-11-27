import { FormBuilder } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";

import {
  createLocalVaultForm,
  LocalVaultForm,
  localVaultFieldError,
  localVaultFormErrors,
  MIN_MASTER_PASSWORD_LENGTH,
} from "./create-local-vault.validation";

describe("create-local-vault validation", () => {
  const validPassword = "a-long-enough-password";

  let formBuilder: FormBuilder;
  let i18n: MockProxy<I18nService>;
  let form: LocalVaultForm;

  const fill = (email: string, password: string, confirmation: string) => {
    form.setValue({
      email,
      masterPassword: password,
      confirmMasterPassword: confirmation,
    });
  };

  beforeEach(() => {
    formBuilder = new FormBuilder();
    i18n = mock<I18nService>();
    // Keep the key and the interpolated value so tests can assert both.
    i18n.t.mockImplementation((key, value) => (value == null ? key : `${key}:${value}`));
    form = createLocalVaultForm(formBuilder);
  });

  it("reports the minimum length for a short master password", () => {
    fill("test@local.invalid", "short", "short");

    expect(localVaultFormErrors(form, i18n)).toEqual({
      email: null,
      masterPassword: `masterPasswordMinlength:${MIN_MASTER_PASSWORD_LENGTH}`,
      confirmMasterPassword: null,
    });
  });

  it("reports every required field on an untouched form", () => {
    expect(localVaultFormErrors(form, i18n)).toEqual({
      email: "emailRequired",
      masterPassword: "masterPasswordRequired",
      confirmMasterPassword: "confirmMasterPasswordRequired",
    });
  });

  it("reports required rather than a mismatch for an empty confirmation", () => {
    fill("test@local.invalid", validPassword, "");

    expect(localVaultFieldError(form, "confirmMasterPassword", i18n)).toBe(
      "confirmMasterPasswordRequired",
    );
  });

  it("reports an invalid email address", () => {
    fill("not-an-email", validPassword, validPassword);

    expect(localVaultFieldError(form, "email", i18n)).toBe("invalidEmail");
  });

  it("reports a differing confirmation instead of the password", () => {
    fill("test@local.invalid", validPassword, `${validPassword}-other`);

    expect(localVaultFormErrors(form, i18n)).toEqual({
      email: null,
      masterPassword: null,
      confirmMasterPassword: "passwordsDoNotMatch",
    });
  });

  it("reports nothing when the form is valid", () => {
    fill("test@local.invalid", validPassword, validPassword);

    expect(localVaultFormErrors(form, i18n)).toEqual({
      email: null,
      masterPassword: null,
      confirmMasterPassword: null,
    });
  });
});
