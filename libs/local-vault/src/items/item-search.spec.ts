import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";

import { applyFieldValues } from "./item-fields";
import { ItemKind, setKind } from "./item-kind";
import { isSecretCustomField, isSecretField, searchableFieldValues } from "./item-search";

function loginView(password: string, totp: string): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.Login);
  applyFieldValues(view, ItemKind.Login, {
    name: "GitHub",
    username: "bossxie",
    password,
    totp,
    uri: "https://github.com",
    notes: "work account",
  });
  return view;
}

function customField(name: string, value: string, type = FieldType.Text): FieldView {
  const field = new FieldView();
  field.name = name;
  field.value = value;
  field.type = type;
  return field;
}

describe("searchableFieldValues", () => {
  it("keeps ordinary login fields searchable", () => {
    const values = searchableFieldValues(loginView("hunter2", "JBSWY3DP"), ItemKind.Login);

    expect(values).toContain("GitHub");
    expect(values).toContain("bossxie");
    expect(values).toContain("https://github.com");
    expect(values).toContain("work account");
  });

  it("leaves the password and TOTP seed out of the search string", () => {
    const values = searchableFieldValues(loginView("hunter2", "JBSWY3DP"), ItemKind.Login);

    expect(values.join(" ")).not.toContain("hunter2");
    expect(values.join(" ")).not.toContain("JBSWY3DP");
  });

  it("keeps hidden custom field names but not their values", () => {
    const view = loginView("hunter2", "JBSWY3DP");
    view.fields = [
      ...(view.fields ?? []),
      customField("recovery code", "abcd-efgh", FieldType.Hidden),
      customField("pin hint", "left drawer"),
    ];

    const joined = searchableFieldValues(view, ItemKind.Login).join(" ");

    expect(joined).toContain("recovery code");
    expect(joined).not.toContain("abcd-efgh");
    expect(joined).toContain("pin hint");
    expect(joined).toContain("left drawer");
  });

  it("omits secrets of the other kinds too", () => {
    const card = new CipherView();
    setKind(card, ItemKind.Card);
    applyFieldValues(card, ItemKind.Card, {
      name: "Visa",
      number: "4111111111111111",
      code: "123",
      pin: "9999",
    });

    const joined = searchableFieldValues(card, ItemKind.Card).join(" ");

    expect(joined).toContain("Visa");
    expect(joined).not.toContain("4111111111111111");
    expect(joined).not.toContain("123");
    expect(joined).not.toContain("9999");
  });
});

describe("secret field predicates", () => {
  it("marks password fields and the TOTP seed as secret", () => {
    expect(
      isSecretField({
        id: "password",
        labelKey: "password",
        target: "loginPassword",
        password: true,
      }),
    ).toBe(true);
    expect(isSecretField({ id: "totp", labelKey: "authenticatorKey", target: "loginTotp" })).toBe(
      true,
    );
    expect(isSecretField({ id: "username", labelKey: "username", target: "loginUsername" })).toBe(
      false,
    );
  });

  it("treats only hidden custom fields as secret", () => {
    expect(isSecretCustomField({ type: FieldType.Hidden })).toBe(true);
    expect(isSecretCustomField({ type: FieldType.Text })).toBe(false);
  });
});
