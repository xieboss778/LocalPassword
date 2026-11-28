import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

import { readFieldValues } from "./item-fields";
import { ItemKind, kindOf } from "./item-kind";

/** 导入结果里的关系是「条目下标 → 文件夹/集合下标」，去重后要同步重排。 */
export type ImportRelationship = readonly [itemIndex: number, targetIndex: number];

export interface ImportDedupeResult {
  readonly ciphers: CipherView[];
  readonly folderRelationships: ImportRelationship[];
  readonly collectionRelationships: ImportRelationship[];
  readonly duplicateCount: number;
}

/**
 * 导入去重：先和本机现有条目比对，再丢弃同一文件内的重复条目，比中即跳过。
 *
 * 指纹只看条目标识（类型 + 名称 + 用户名/主机/卡号后四位），
 * 不读取密码、备注、TOTP 等敏感值，也不把指纹写进任何存储或日志。
 *
 * 文件内比对只使用标识足够具体的指纹：备注没有标识，卡片只有卡号后四位
 * （不同卡片可能撞号），这两类不参与文件内去重，宁可留下重复也不误删不同条目；
 * 其余类别的标识（用户名/主 URI、服务名、密钥指纹、软件名、主机、姓名）为空时
 * 同样不参与。和本机保险库的比对不受此限制，保持原有行为。
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
  // 只记录标识足够具体的指纹，弱标识（备注、卡片）永远不会按文件内重复跳过。
  const seenInFile = new Set<string>();

  ciphers.forEach((cipher, index) => {
    const identity = importIdentityOf(cipher);
    if (existingFingerprints.has(identity.fingerprint)) {
      return;
    }
    if (identity.discriminating && seenInFile.has(identity.fingerprint)) {
      return;
    }
    if (identity.discriminating) {
      seenInFile.add(identity.fingerprint);
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
  return importIdentityOf(cipher).fingerprint;
}

interface ImportIdentity {
  /** 类型 + 名称 + 标识；指纹相同即视为同一来源。 */
  readonly fingerprint: string;
  /** 标识是否具体到足以区分两个不同条目（备注、卡号后四位不算）。 */
  readonly discriminating: boolean;
}

function importIdentityOf(cipher: CipherView): ImportIdentity {
  const kind = kindOf(cipher);
  const values = readFieldValues(cipher, kind);

  let identity = "";
  let discriminating = false;
  if (kind === ItemKind.Login) {
    const username = normalize(cipher.login?.username);
    const primaryUri = normalizeUri(cipher.login?.uris?.[0]?.uri);
    identity = [username, primaryUri].join("\u0001");
    discriminating = username !== "" || primaryUri !== "";
  } else if (kind === ItemKind.Token) {
    identity = normalize(values["service"]);
    discriminating = identity !== "";
  } else if (kind === ItemKind.SshKey) {
    identity = normalize(cipher.sshKey?.keyFingerprint);
    discriminating = identity !== "";
  } else if (kind === ItemKind.License) {
    identity = normalize(values["software"]);
    discriminating = identity !== "";
  } else if (kind === ItemKind.Server) {
    identity = normalize(values["host"]);
    discriminating = identity !== "";
  } else if (kind === ItemKind.Card) {
    identity = normalize(lastFour(cipher.card?.number ?? ""));
  } else if (kind === ItemKind.Identity) {
    identity = normalize(
      [cipher.identity?.firstName, cipher.identity?.lastName].filter(Boolean).join(" "),
    );
    discriminating = identity !== "";
  }

  return {
    fingerprint: [kind, normalize(cipher.name), identity].join("\u0000"),
    discriminating,
  };
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
