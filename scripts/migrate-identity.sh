#!/usr/bin/env bash
# 把旧品牌身份下的本地数据迁移到 LocalPass。
# 只复制、不删除任何源数据；旧目录保留作为回滚点。
set -euo pipefail

TARGET_NAME="LocalPass"
case "$(uname -s)" in
  Darwin)
    SUPPORT="$HOME/Library/Application Support"
    CANDIDATES=("$SUPPORT/LocalPassword" "$SUPPORT/localpassword" "$SUPPORT/Bitwarden")
    ;;
  Linux)
    SUPPORT="${XDG_CONFIG_HOME:-$HOME/.config}"
    CANDIDATES=("$SUPPORT/LocalPassword" "$SUPPORT/localpassword" "$SUPPORT/Bitwarden")
    ;;
  *)
    printf 'Unsupported platform: %s\n' "$(uname -s)" >&2; exit 1 ;;
esac

TARGET="$SUPPORT/$TARGET_NAME"
STAMP="$(date +%Y%m%d-%H%M%S)"

printf '== LocalPass 身份迁移 ==\n目标目录: %s\n\n' "$TARGET"

if [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
  printf '目标目录已有数据，先备份到 %s.bak-%s\n' "$TARGET" "$STAMP"
  cp -a "$TARGET" "$TARGET.bak-$STAMP"
fi

mkdir -p "$TARGET"
found=0
for src in "${CANDIDATES[@]}"; do
  [ -d "$src" ] || continue
  [ "$src" = "$TARGET" ] && continue
  printf '发现旧数据: %s（复制，不移动）\n' "$src"
  cp -a "$src/." "$TARGET/"
  found=1
done

if [ "$found" -eq 0 ]; then
  printf '没有找到旧目录，首次启动会创建空库。\n'
fi

cat <<'TEXT'

== 旧钥匙串条目（需手动清理，脚本不代删） ==
钥匙串访问 → 搜索下列服务名，删除属于旧版本/旧厂商的条目：
  LocalPassword, LocalPassword_biometric, Bitwarden, Bitwarden_biometric, *Safe Storage

清理后首次启动 LocalPass 会新建自己的条目：
  LocalPass, LocalPass_biometric, LocalPass Safe Storage

== 说明 ==
- 若系统里还装着官方 Bitwarden 客户端，不要清空它自己的条目，否则会丢失其登录态。
- 迁移后请先在旧客户端里完成一次加密导出，再核对 LocalPass 内的条目数量与最近修改条目。
