import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { ActivatedRoute, Params, Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpFieldComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";
import { LoginUriView } from "@localpass/common/vault/models/view/login-uri.view";
import { ButtonModule } from "@localpass/components";
import { ItemKind, isItemKind, setKind } from "@localpass/local-vault";

/** 一个字段落在原生条目的哪个位置；`custom` 表示写进自定义字段。 */
type FieldTarget =
  | "name"
  | "notes"
  | "loginUsername"
  | "loginPassword"
  | "loginTotp"
  | "loginUri"
  | "sshPrivateKey"
  | "sshPublicKey"
  | "cardholder"
  | "cardNumber"
  | "cardCode"
  | "cardExpMonth"
  | "cardExpYear"
  | "identityFirst"
  | "identityLast"
  | "identityIdNumber"
  | { custom: string };

interface FieldSpec {
  readonly id: string;
  readonly labelKey: string;
  readonly target: FieldTarget;
  readonly password?: boolean;
  readonly multiline?: boolean;
}

const FIELDS: Record<ItemKind, readonly FieldSpec[]> = {
  login: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "username", labelKey: "username", target: "loginUsername" },
    { id: "password", labelKey: "password", target: "loginPassword", password: true },
    { id: "totp", labelKey: "authenticatorKey", target: "loginTotp" },
    { id: "uri", labelKey: "uri", target: "loginUri" },
  ],
  token: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "service", labelKey: "username", target: "loginUsername" },
    { id: "token", labelKey: "itemKindToken", target: "loginPassword", password: true },
    { id: "scope", labelKey: "itemKindTokenScope", target: { custom: "scope" } },
    { id: "env", labelKey: "itemKindTokenEnv", target: { custom: "env" } },
  ],
  "ssh-key": [
    { id: "name", labelKey: "name", target: "name" },
    {
      id: "privateKey",
      labelKey: "itemKindSshKey",
      target: "sshPrivateKey",
      password: true,
      multiline: true,
    },
    { id: "publicKey", labelKey: "itemKindSshKeyPublic", target: "sshPublicKey", multiline: true },
  ],
  license: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "software", labelKey: "username", target: "loginUsername" },
    { id: "serial", labelKey: "itemKindLicense", target: "loginPassword", password: true },
    { id: "seats", labelKey: "itemKindLicenseSeats", target: { custom: "seats" } },
  ],
  card: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "cardholder", labelKey: "cardholderName", target: "cardholder" },
    { id: "number", labelKey: "number", target: "cardNumber" },
    { id: "expMonth", labelKey: "expirationMonth", target: "cardExpMonth" },
    { id: "expYear", labelKey: "expirationYear", target: "cardExpYear" },
    { id: "code", labelKey: "securityCode", target: "cardCode", password: true },
  ],
  identity: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "firstName", labelKey: "firstName", target: "identityFirst" },
    { id: "lastName", labelKey: "lastName", target: "identityLast" },
    { id: "idNumber", labelKey: "identityNumber", target: "identityIdNumber", password: true },
  ],
  server: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "host", labelKey: "itemKindServer", target: "loginUsername" },
    { id: "password", labelKey: "password", target: "loginPassword", password: true },
    { id: "protocol", labelKey: "itemKindServerProtocol", target: { custom: "protocol" } },
    { id: "sudo", labelKey: "itemKindServerSudo", target: { custom: "sudo" } },
  ],
  note: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "notes", labelKey: "notes", target: "notes", multiline: true },
  ],
};

/** 新建 / 编辑表单（方向 C）。同一套组件，靠 query 上的 `kind` 与 `cipherId` 区分。 */
@Component({
  selector: "item-form-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header [title]="heading()" [sub]="i18n.t(kindLabelKey())">
        <button type="button" bitButton buttonType="primary" [disabled]="saving()" (click)="save()">
          {{ i18n.t("save") }}
        </button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <lp-group>
          @for (field of fields(); track field.id) {
            <lp-field
              [label]="i18n.t(field.labelKey)"
              [password]="!!field.password"
              [multiline]="!!field.multiline"
              [value]="values()[field.id] ?? ''"
              (valueChange)="setValue(field.id, $event)"
            />
          }
        </lp-group>
        @if (errorMessage()) {
          <p class="tw-px-4 tw-pt-3 tw-text-[11px] tw-text-[var(--lp-danger)]">
            {{ errorMessage() }}
          </p>
        }
      </div>
    </div>
  `,
})
export class ItemFormV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly values = signal<Record<string, string>>({});
  protected readonly kind = signal<ItemKind>(ItemKind.Login);

  protected readonly fields = computed<readonly FieldSpec[]>(() => FIELDS[this.kind()]);
  protected readonly heading = computed(() => this.i18n.t(this.editing() ? "editItem" : "newItem"));
  protected readonly kindLabelKey = computed(
    () =>
      `itemKind${this.kind()
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")}`,
  );

  private readonly editing = signal(false);
  private original: CipherView | null = null;

  async ngOnInit(): Promise<void> {
    const params: Params = await firstValueFrom(this.route.queryParams);
    const kind = params["kind"];
    if (isItemKind(kind)) {
      this.kind.set(kind);
    }

    const cipherId = params["cipherId"] as string | undefined;
    if (!cipherId) {
      this.values.set({});
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.cipherService.get(cipherId, userId);
    const view = await this.cipherService.decrypt(cipher, userId);
    this.original = view;
    this.editing.set(true);
    this.values.set(this.readValues(view, FIELDS[this.kind()]));
  }

  protected setValue(id: string, value: string): void {
    this.values.update((current) => ({ ...current, [id]: value }));
  }

  protected async save(): Promise<void> {
    this.errorMessage.set(null);
    this.saving.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const view = this.original ?? new CipherView();
      this.applyValues(view, this.fields(), this.values());
      setKind(view, this.kind());

      if (this.original) {
        await this.cipherService.updateWithServer(view, userId);
      } else {
        const created = await this.cipherService.createWithServer(view, userId);
        this.original = created;
      }

      await this.router.navigate(["/vault-list-v2"]);
    } catch {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
    } finally {
      this.saving.set(false);
    }
  }

  private readValues(view: CipherView, fields: readonly FieldSpec[]): Record<string, string> {
    const values: Record<string, string> = {};
    for (const field of fields) {
      values[field.id] = this.readValue(view, field.target);
    }
    return values;
  }

  private readValue(view: CipherView, target: FieldTarget): string {
    switch (target) {
      case "name":
        return view.name ?? "";
      case "notes":
        return view.notes ?? "";
      case "loginUsername":
        return view.login.username ?? "";
      case "loginPassword":
        return view.login.password ?? "";
      case "loginTotp":
        return view.login.totp ?? "";
      case "loginUri":
        return view.login.uris[0]?.uri ?? "";
      case "sshPrivateKey":
        return view.sshKey.privateKey ?? "";
      case "sshPublicKey":
        return view.sshKey.publicKey ?? "";
      case "cardholder":
        return view.card.cardholderName ?? "";
      case "cardNumber":
        return view.card.number ?? "";
      case "cardCode":
        return view.card.code ?? "";
      case "cardExpMonth":
        return view.card.expMonth ?? "";
      case "cardExpYear":
        return view.card.expYear ?? "";
      case "identityFirst":
        return view.identity.firstName ?? "";
      case "identityLast":
        return view.identity.lastName ?? "";
      case "identityIdNumber":
        return view.identity.passportNumber ?? view.identity.licenseNumber ?? "";
      default:
        return this.customField(view, target.custom)?.value ?? "";
    }
  }

  private applyValues(
    view: CipherView,
    fields: readonly FieldSpec[],
    values: Record<string, string>,
  ): void {
    for (const field of fields) {
      this.writeValue(view, field.target, values[field.id] ?? "");
    }
  }

  private writeValue(view: CipherView, target: FieldTarget, value: string): void {
    switch (target) {
      case "name":
        view.name = value;
        return;
      case "notes":
        view.notes = value;
        return;
      case "loginUsername":
        view.login.username = value;
        return;
      case "loginPassword":
        view.login.password = value;
        return;
      case "loginTotp":
        view.login.totp = value;
        return;
      case "loginUri": {
        const uri = new LoginUriView();
        uri.uri = value;
        view.login.uris = value ? [uri] : [];
        return;
      }
      case "sshPrivateKey":
        view.sshKey.privateKey = value;
        return;
      case "sshPublicKey":
        view.sshKey.publicKey = value;
        return;
      case "cardholder":
        view.card.cardholderName = value;
        return;
      case "cardNumber":
        view.card.number = value;
        return;
      case "cardCode":
        view.card.code = value;
        return;
      case "cardExpMonth":
        view.card.expMonth = value;
        return;
      case "cardExpYear":
        view.card.expYear = value;
        return;
      case "identityFirst":
        view.identity.firstName = value;
        return;
      case "identityLast":
        view.identity.lastName = value;
        return;
      case "identityIdNumber":
        view.identity.passportNumber = value;
        return;
      default:
        this.writeCustomField(view, target.custom, value);
    }
  }

  private customField(view: CipherView, name: string): FieldView | undefined {
    return view.fields.find((field) => field.name === name);
  }

  private writeCustomField(view: CipherView, name: string, value: string): void {
    const existing = this.customField(view, name);
    if (existing) {
      existing.value = value;
      return;
    }
    if (!value) {
      return;
    }
    const created = new FieldView();
    created.name = name;
    created.value = value;
    created.type = 0; // FieldType.Text
    view.fields = [...view.fields, created];
  }
}
