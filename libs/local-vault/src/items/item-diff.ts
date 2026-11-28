import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

import { fieldGroups, readCustomFields, readFieldValues } from "./item-fields";
import { kindOf } from "./item-kind";

/**
 * i18n keys for the fields whose values differ between two decrypted views of one item.
 *
 * The comparison happens in memory; callers only get labels so no field value has to leave the
 * vault UI. Used by the conflict review and the local version history.
 */
export function diffFieldLabelKeys(left: CipherView, right: CipherView): readonly string[] {
  const leftKind = kindOf(left);
  const labels: string[] = [];

  if (leftKind !== kindOf(right)) {
    labels.push("type");
  }

  const leftValues = readFieldValues(left, leftKind);
  const rightValues = readFieldValues(right, leftKind);
  for (const field of fieldGroups(leftKind).flatMap((group) => group.fields)) {
    if ((leftValues[field.id] ?? "") !== (rightValues[field.id] ?? "")) {
      labels.push(field.labelKey);
    }
  }

  const leftCustom = JSON.stringify(readCustomFields(left, leftKind));
  const rightCustom = JSON.stringify(readCustomFields(right, leftKind));
  if (leftCustom !== rightCustom) {
    labels.push("customFields");
  }

  return [...new Set(labels)];
}
