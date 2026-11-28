import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

import { FIELDS, FieldSpec, FieldTarget, readFieldValues } from "./item-fields";
import { ItemKind, withoutKindField } from "./item-kind";

/**
 * The field text an item search may match against.
 *
 * Secrets — passwords, TOTP seeds and hidden custom fields — are deliberately left out.
 * Otherwise a fragment of a secret could be typed into the search box to confirm which item
 * holds it (and, by narrowing results, to reconstruct it one character at a time).
 *
 * Secret field names stay searchable; only their values are secret.
 */
export function searchableFieldValues(view: CipherView, kind: ItemKind): string[] {
  const values = readFieldValues(view, kind);
  const visibleFieldValues = FIELDS[kind]
    .filter((field) => !isSecretField(field))
    .map((field) => values[field.id] ?? "");

  const secretCustomNames = secretCustomFieldNames(kind);
  const customFields = withoutKindField(view.fields).flatMap((field) => {
    const name = field.name ?? "";
    if (secretCustomNames.has(name) || isSecretCustomField(field)) {
      return [name];
    }
    return [name, field.value ?? ""];
  });

  return [...visibleFieldValues, ...customFields];
}

/** Whether a field declared in {@link FIELDS} holds a secret and must not join a search string. */
export function isSecretField(field: FieldSpec): boolean {
  return field.password === true || field.target === "loginTotp";
}

/** A hidden custom field's value is secret; its name is not. */
export function isSecretCustomField(field: { readonly type?: FieldType }): boolean {
  return field.type === FieldType.Hidden;
}

/**
 * Names of custom fields that a kind declares as secret (card PIN, SSH passphrase, …).
 * Their stored value must be withheld from search even though it lives in a custom field.
 */
export function secretCustomFieldNames(kind: ItemKind): ReadonlySet<string> {
  const names = FIELDS[kind]
    .filter((field) => field.password === true)
    .map(customNameOf)
    .filter((name): name is string => name != null);
  return new Set(names);
}

function customNameOf(field: FieldSpec): string | null {
  const target: FieldTarget = field.target;
  return typeof target === "object" && "custom" in target ? target.custom : null;
}
