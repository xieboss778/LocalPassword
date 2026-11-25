import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import { CreateLocalAccountService } from "@bitwarden/local-vault";

import { JslibModule } from "../../jslib.module";

/** Minimum length a local master password must have; deliberately longer than the server's floor. */
const MIN_MASTER_PASSWORD_LENGTH = 8;

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get("masterPassword")?.value;
  const confirmation = control.get("confirmMasterPassword")?.value;
  if (password != null && password !== confirmation) {
    return { passwordsDoNotMatch: true };
  }
  return null;
}

/**
 * Creates the vault that lives on this device. Nothing is sent anywhere: the whole key chain is
 * derived locally and the account it registers is marked local.
 */
@Component({
  selector: "auth-create-local-vault",
  templateUrl: "./create-local-vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    TypographyModule,
  ],
})
export class CreateLocalVaultComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly createLocalAccountService = inject(CreateLocalAccountService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly validationService = inject(ValidationService);

  protected readonly formGroup = this.formBuilder.group(
    {
      email: ["", [Validators.required, Validators.email]],
      name: [""],
      masterPassword: [
        "",
        [Validators.required, Validators.minLength(MIN_MASTER_PASSWORD_LENGTH)],
      ],
      confirmMasterPassword: ["", [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );

  protected submitting = false;
  protected errorMessage: string | null = null;

  get email() {
    return this.formGroup.controls.email;
  }

  get name() {
    return this.formGroup.controls.name;
  }

  get masterPassword() {
    return this.formGroup.controls.masterPassword;
  }

  get confirmMasterPassword() {
    return this.formGroup.controls.confirmMasterPassword;
  }

  submit = async (): Promise<void> => {
    if (this.submitting) {
      return;
    }

    this.formGroup.markAllAsTouched();
    this.errorMessage = null;

    if (this.formGroup.invalid) {
      if (this.formGroup.hasError("passwordsDoNotMatch")) {
        this.errorMessage = this.i18nService.t("passwordsDoNotMatch");
      }
      return;
    }

    this.submitting = true;
    try {
      await this.createLocalAccountService.createAccount({
        email: this.email.value ?? "",
        name: this.name.value || undefined,
        masterPassword: this.masterPassword.value ?? "",
      });

      // Restoring from a file goes straight to the importer; otherwise the vault is ready.
      const next = this.route.snapshot.queryParamMap.get("next");
      await this.router.navigate([next === "import" ? "/import" : "/"]);
    } catch (error) {
      this.validationService.showError(error);
      this.errorMessage = this.i18nService.t("errorOccurred");
    } finally {
      this.submitting = false;
    }
  };
}
