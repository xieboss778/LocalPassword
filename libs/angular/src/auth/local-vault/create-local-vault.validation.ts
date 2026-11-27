import { AbstractControl, FormBuilder, ValidationErrors, Validators } from "@angular/forms";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";

/** Minimum length a local master password must have; deliberately longer than the server's floor. */
export const MIN_MASTER_PASSWORD_LENGTH = 12;

export type LocalVaultField = "email" | "masterPassword" | "confirmMasterPassword";

export type LocalVaultFieldErrors = Record<LocalVaultField, string | null>;

const REQUIRED_MESSAGE_KEYS: Record<LocalVaultField, string> = {
  email: "emailRequired",
  masterPassword: "masterPasswordRequired",
  confirmMasterPassword: "confirmMasterPasswordRequired",
};

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get("masterPassword")?.value;
  const confirmation = control.get("confirmMasterPassword")?.value;
  if (password != null && password !== confirmation) {
    return { passwordsDoNotMatch: true };
  }
  return null;
}

/** The form shared by both the desktop card and the popup stack. */
export function createLocalVaultForm(formBuilder: FormBuilder) {
  return formBuilder.group(
    {
      email: ["", [Validators.required, Validators.email]],
      masterPassword: ["", [Validators.required, Validators.minLength(MIN_MASTER_PASSWORD_LENGTH)]],
      confirmMasterPassword: ["", [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );
}

export type LocalVaultForm = ReturnType<typeof createLocalVaultForm>;

/**
 * The message shown under one field, or `null` when that field is fine.
 *
 * Required messages win over the cross-field match so an untouched confirmation field reports
 * "required" rather than claiming the two passwords differ.
 */
export function localVaultFieldError(
  form: LocalVaultForm,
  field: LocalVaultField,
  i18n: I18nService,
): string | null {
  const control = form.controls[field];

  if (control.hasError("required")) {
    return i18n.t(REQUIRED_MESSAGE_KEYS[field]);
  }
  if (field === "email" && control.hasError("email")) {
    return i18n.t("invalidEmail");
  }
  if (field === "masterPassword" && control.hasError("minlength")) {
    return i18n.t("masterPasswordMinlength", MIN_MASTER_PASSWORD_LENGTH);
  }
  if (field === "confirmMasterPassword" && form.hasError("passwordsDoNotMatch")) {
    return i18n.t("passwordsDoNotMatch");
  }
  return null;
}

/** Every field's current message; computed on submit so a silent click is impossible. */
export function localVaultFormErrors(
  form: LocalVaultForm,
  i18n: I18nService,
): LocalVaultFieldErrors {
  return {
    email: localVaultFieldError(form, "email", i18n),
    masterPassword: localVaultFieldError(form, "masterPassword", i18n),
    confirmMasterPassword: localVaultFieldError(form, "confirmMasterPassword", i18n),
  };
}
