#!/usr/bin/env bash
# 迁移到 LocalPass 后清理旧身份：旧 userData 目录 + 登录钥匙串里的旧条目。
# 删除前会先在 LocalPass-backups/ 里做一份 tar.gz 备份。
set -euo pipefail

SUPPORT="$HOME/Library/Application Support"
TARGET="$SUPPORT/LocalPass"
BACKUPS="$SUPPORT/LocalPass-backups"
LEGACY=("$SUPPORT/Bitwarden" "$SUPPORT/LocalPassword" "$SUPPORT/localpassword")
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$TARGET" "$BACKUPS"

# 1) 先把旧库内容搬进新目录，保证删除后数据仍在
for src in "${LEGACY[@]}"; do
  [ -d "$src" ] || continue
  [ "$src" = "$TARGET" ] && continue
  echo "迁移: $src -> $TARGET"
  cp -a "$src/." "$TARGET/" 2>/dev/null || true
done

# 2) 备份旧目录
for src in "${LEGACY[@]}"; do
  [ -d "$src" ] || continue
  [ "$src" = "$TARGET" ] && continue
  out="$BACKUPS/$(basename "$src")-$STAMP.tar.gz"
  echo "备份: $src -> $out"
  tar -czf "$out" -C "$SUPPORT" "$(basename "$src")" 2>/dev/null || true
done

# 3) 删除旧目录
for src in "${LEGACY[@]}"; do
  [ -d "$src" ] || continue
  [ "$src" = "$TARGET" ] && continue
  echo "删除: $src"
  rm -rf "$src"
done

# 4) 删除登录钥匙串里的旧条目（iCloud 同步条目 CLI 不可见，需在“钥匙串访问”里删）
for svc in Bitwarden Bitwarden_biometric "Bitwarden Safe Storage" \
           LocalPassword LocalPassword_biometric "LocalPassword Safe Storage"; do
  n=0
  while security delete-generic-password -s "$svc" >/dev/null 2>&1; do n=$((n+1)); [ $n -ge 10 ] && break; done
  printf '登录钥匙串 %-28s 删除 %s 条\n' "$svc" "$n"
done

cat <<'TEXT'

如果“钥匙串访问”里仍能看到 Bitwarden / LocalPassword 开头的条目，那些在 iCloud 钥匙串中，
CLI 删不到：打开“钥匙串访问”→ 搜索 Bitwarden → 逐条删除（或系统设置 → 密码）。
备份位置：~/Library/Application Support/LocalPass-backups/
TEXT
