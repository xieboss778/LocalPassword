import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ValidationService } from "@localpass/common/platform/abstractions/validation.service";
import { ButtonModule, IconComponent, LinkModule } from "@localpass/components";
import { CreateLocalAccountService } from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import { LpFieldComponent, LpHeroComponent } from "../../local-ui";

import {
  createLocalVaultForm,
  LocalVaultField,
  LocalVaultFieldErrors,
  localVaultFieldError,
  localVaultFormErrors,
} from "./create-local-vault.validation";

/**
 * Creates the vault that lives on this device. Nothing is sent anywhere: the whole key chain is
 * derived locally and the account it registers is marked local.
 */
@Component({
  selector: "auth-create-local-vault",
  templateUrl: "./create-local-vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    ButtonModule,
    IconComponent,
    LinkModule,
    LpFieldComponent,
    LpHeroComponent,
  ],
})
export class CreateLocalVaultComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly createLocalAccountService = inject(CreateLocalAccountService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly validationService = inject(ValidationService);

  protected readonly formGroup = createLocalVaultForm(this.formBuilder);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Messages shown under each field; empty until the field is left or the form is submitted. */
  protected readonly fieldErrors = signal<LocalVaultFieldErrors>({
    email: null,
    masterPassword: null,
    confirmMasterPassword: null,
  });
  /** 桌面端原型不显示备份确认勾选，默认视为已知晓；弹窗形态保留勾选（默认勾上）。 */
  protected readonly backupAcknowledged = signal(true);
  /** Desktop mounts this screen in the centered auth card; the popup keeps its stacked hero. */
  protected readonly isDesktop =
    this.route.snapshot.data["localVaultLayout"] === "desktop" ||
    this.route.parent?.snapshot.data["localVaultLayout"] === "desktop";

  protected setField(field: LocalVaultField, value: string): void {
    this.formGroup.controls[field].setValue(value);

    // Keep an already-visible message honest while the user fixes the value. A change to the
    // password also affects the confirmation's match message.
    if (this.fieldErrors()[field] != null) {
      this.refreshFieldError(field);
    }
    if (field === "masterPassword" && this.fieldErrors().confirmMasterPassword != null) {
      this.refreshFieldError("confirmMasterPassword");
    }
  }

  protected onFieldBlur(field: LocalVaultField): void {
    this.refreshFieldError(field);
  }

  private refreshFieldError(field: LocalVaultField): void {
    this.fieldErrors.update((errors) => ({
      ...errors,
      [field]: localVaultFieldError(this.formGroup, field, this.i18nService),
    }));
  }

  protected onBackupAcknowledged(event: Event): void {
    this.backupAcknowledged.set((event.target as HTMLInputElement).checked);
  }

  protected restoreFromBackup(): void {
    void this.router.navigate(["/restore-vault"]);
  }

  get email() {
    return this.formGroup.controls.email;
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
    this.fieldErrors.set(localVaultFormErrors(this.formGroup, this.i18nService));

    if (this.formGroup.invalid) {
      return;
    }

    if (!this.backupAcknowledged()) {
      this.errorMessage.set(this.i18nService.t("setupBackupConfirmRequired"));
      return;
    }

    this.submitting.set(true);
    try {
      await this.createLocalAccountService.createAccount({
        email: this.email.value ?? "",
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
