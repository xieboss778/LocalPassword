import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ValidationService } from "@localpass/common/platform/abstractions/validation.service";
import { ButtonModule, LinkModule } from "@localpass/components";
import { CreateLocalAccountService } from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import { LpFieldComponent, LpGroupComponent, LpPageHeaderComponent } from "../../local-ui";

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
    ButtonModule,
    LinkModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
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
      masterPassword: ["", [Validators.required, Validators.minLength(MIN_MASTER_PASSWORD_LENGTH)]],
      confirmMasterPassword: ["", [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected setField(
    field: "email" | "name" | "masterPassword" | "confirmMasterPassword",
    value: string,
  ): void {
    this.formGroup.get(field)?.setValue(value);
  }

  protected restoreFromBackup(): void {
    void this.router.navigate(["/restore-vault"]);
  }

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

  readonly submit = async (): Promise<void> => {
    if (this.submitting()) {
      return;
    }

    this.formGroup.markAllAsTouched();
    this.errorMessage.set(null);

    if (this.formGroup.invalid) {
      if (this.formGroup.hasError("passwordsDoNotMatch")) {
        this.errorMessage.set(this.i18nService.t("passwordsDoNotMatch"));
      }
      return;
    }

    this.submitting.set(true);
    try {
      await this.createLocalAccountService.createAccount({
        email: this.email.value ?? "",
        name: this.name.value || undefined,
        masterPassword: this.masterPassword.value ?? "",
      });

      // Restoring from a file goes straight to the importer; otherwise the vault is ready.
      // The import destination lives in route data because the browser and desktop import at
      // different routes: the popup has its own LocalPass picker, the desktop window the shared one.
      const next = this.route.snapshot.queryParamMap.get("next");
      const importRoute: string = this.route.snapshot.data["importRoute"] ?? "/import";
      await this.router.navigate([next === "import" ? importRoute : "/"]);
    } catch (error) {
      this.validationService.showError(error);
      this.errorMessage.set(this.i18nService.t("errorOccurred"));
    } finally {
      this.submitting.set(false);
    }
  };
}
