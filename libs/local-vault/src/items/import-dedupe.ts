import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

import { readFieldValues } from "./item-fields";
import { kindOf } from "./item-kind";

/** 导入结果里的关系是「条目下标 → 文件夹/集合下标」，去重后要同步重排。 */
export type ImportRelationship = readonly [itemIndex: number, targetIndex: number];

export interface ImportDedupeResult {
  readonly ciphers: CipherView[];
  readonly folderRelationships: ImportRelationship[];
  readonly collectionRelationships: ImportRelationship[];
  readonly duplicateCount: number;
}

/**
 * 导入去重：只和本机现有条目比对，比中即跳过。
 *
 * 指纹只看条目标识（类型 + 名称 + 用户名/主机/卡号后四位），
 * 不读取密码、备注、TOTP 等敏感值，也不把指纹写进任何存储或日志。
 */
export function dedupeImportCiphers(
  ciphers: readonly CipherView[],
  existing: readonly CipherView[],
  folderRelationships: readonly ImportRelationship[] = [],
  collectionRelationships: readonly ImportRelationship[] = [],
): ImportDedupeResult {
  const existingFingerprints = new Set(
    existing.filter((cipher) => !cipher.isDeleted).map(importFingerprint),
  );

  const kept: CipherView[] = [];
  const indexMap = new Map<number, number>();
  ciphers.forEach((cipher, index) => {
    if (existingFingerprints.has(importFingerprint(cipher))) {
      return;
    }
    indexMap.set(index, kept.length);
    kept.push(cipher);
  });

  return {
    ciphers: kept,
    folderRelationships: remapRelationships(folderRelationships, indexMap),
    collectionRelationships: remapRelationships(collectionRelationships, indexMap),
    duplicateCount: ciphers.length - kept.length,
  };
}

/** 条目在本机保险库里的稳定标识。 */
export function importFingerprint(cipher: CipherView): string {
  const kind = kindOf(cipher);
  const values = readFieldValues(cipher, kind);

  let identity = "";
  if (kind === "login") {
    const primaryUri = normalizeUri(cipher.login?.uris?.[0]?.uri);
    identity = [normalize(cipher.login?.username), primaryUri].join("\u0001");
  } else if (kind === "token") {
    identity = normalize(values["service"]);
  } else if (kind === "ssh-key") {
    identity = normalize(cipher.sshKey?.keyFingerprint);
  } else if (kind === "license") {
    identity = normalize(values["software"]);
  } else if (kind === "server") {
    identity = normalize(values["host"]);
  } else if (kind === "card") {
    identity = normalize(lastFour(cipher.card?.number ?? ""));
  } else if (kind === "identity") {
    identity = normalize(
      [cipher.identity?.firstName, cipher.identity?.lastName].filter(Boolean).join(" "),
    );
  }

  return [kind, normalize(cipher.name), identity].join("\u0000");
}

function normalizeUri(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().toLowerCase().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname + (parsed.pathname === "/" ? "" : parsed.pathname);
  } catch {
    return trimmed;
  }
}

function remapRelationships(
  relationships: readonly ImportRelationship[],
  indexMap: ReadonlyMap<number, number>,
): ImportRelationship[] {
  return relationships.flatMap(([itemIndex, targetIndex]) => {
    const newIndex = indexMap.get(itemIndex);
    return newIndex == null ? [] : [[newIndex, targetIndex] as const];
  });
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function lastFour(number: string): string {
  const digits = number.replace(/\s+/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}
