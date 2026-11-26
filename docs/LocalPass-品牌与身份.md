# LocalPass 品牌与身份边界

本文是「本地代码零上游品牌」的执行清单与验收依据。

## 一、运行期身份（改了会直接影响数据与权限）

| 项                                  | 取值                                                                           | 落点                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Electron `app.name` / `productName` | `LocalPass`                                                                    | `apps/desktop/build/package.json`                                  |
| bundle id / `appId`                 | `com.localpass.desktop`                                                        | `apps/desktop/electron-builder.json`                               |
| userData                            | `~/Library/Application Support/LocalPass`                                      | Electron 派生                                                      |
| 钥匙串服务名                        | `LocalPass` / `LocalPass_biometric` / `LocalPass Safe Storage`                 | `app.getName()` 派生                                               |
| URL scheme                          | `localpass://`                                                                 | `electron-builder.json` → `protocols`                              |
| 浏览器 ↔ 桌面 host                  | `com.localpass.desktop`                                                        | `apps/desktop/src/main/native-messaging.main.ts`                   |
| 代码签名                            | 关闭（`mac.identity = null`，无 entitlements、无 hardened runtime）            | `apps/desktop/electron-builder.json`                               |
| Linux polkit action                 | `com.localpass.LocalPass.unlock`                                               | `biometric/src/linux.rs`、`os-biometrics-linux.service.ts`         |
| 默认服务域名                        | **无**。区域表收敛为单一离线哨兵 `https://local.invalid`（保留域名，永不解析） | `libs/common/src/platform/services/default-environment.service.ts` |

`productName` 必须写在 **build/package.json**（被打进 asar 的那份）。只改 `electron-builder.json` 的 `productName`
只会改 bundle 与 Info.plist，Electron 运行时仍会拿到旧名字，导致 keychain 项与 userData 继续与旧厂商共用。

本项目不签名：不提供 Developer ID、不需要 Team ID、不配置 entitlements/App Group。
打包产物是 ad-hoc/linker-signed 的普通 app；钥匙串 ACL 只能隐式信任当前二进制，重新打包后可能再问一次授权。

## 二、代码与包标识

- npm 作用域：`@localpass/*`（54 个 workspace 包 + 根包 `@xieboss778/LocalPassword`）。
- 路径别名：`tsconfig.base.json` 的 `paths`、`nx.json` 插件、webpack/jest/storybook 全部跟随作用域。
- 资源文件：`com.localpass.desktop.{desktop,policy,devel.yaml}`、`localpass.nuspec`、`localpass-*.icon.ts`。
- 图标：`apps/browser/src/images/icon*.png`、`apps/desktop/resources/{icon,dmg}*.icns`、`libs/assets` 的 logo/icon SVG。

## 三、允许保留上游名字的位置（不是遗漏）

1. `package.json` 的 npm alias：`@localpass/sdk-internal → npm:@bitwarden/sdk-internal@…`（WASM 二进制，不能改名）。
2. `apps/desktop/desktop_native/Cargo.toml` 的 `package = "bitwarden-crypto"` 等 3 行（Cargo 依赖别名，源码里只用 `localpass_*`）。
3. `libs/importer/src/importers/bitwarden*`：解析 Bitwarden 备份格式的兼容层（`spec-data/bitwarden-json` 是真实测试向量，禁止改名）。
4. `libs/common/src/tools/extension/vendor/bitwarden.ts`：第三方密码管理器厂商标识。
5. 密码学 SDK 的**外部 API 名**：`BitwardenClient`、`bitwardenClientVersion`、`bitwarden_wasm_internal*.wasm`（改了就编译不过）。
6. `LICENSE`、`NOTICE`、`LICENSE_BITWARDEN.txt`：GPLv3 版权声明，移除即不可分发。
7. `.npmrc` 的 `min-release-age-exclude`：需要真实包名才能生效。

## 四、验收命令

```bash
# 1) 类型检查（应输出 0 个 error）
node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/browser/tsconfig.json --noEmit

# 2) Rust 编译（依赖别名正确）
(cd apps/desktop/desktop_native && cargo check --workspace)

# 3) 品牌残留审计（只应命中第三节列出的位置）
grep -rli --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target \
  --exclude-dir=dist --exclude-dir=build -i bitwarden .

# 4) 打包产物身份
npx electron-builder --mac --config apps/desktop/electron-builder.json
codesign -dvvv "apps/desktop/dist/mac-arm64/LocalPass.app" 2>&1 | grep -E "Identifier|TeamIdentifier"
```

## 五、迁移

见 `scripts/migrate-identity.sh`：复制旧 userData、列出待清理的旧钥匙串条目（不代删）。

## 六、旧身份已清理（本机执行记录）

- 旧 userData 目录已迁移到 `~/Library/Application Support/LocalPass` 并删除原目录；
  备份在 `~/Library/Application Support/LocalPass-backups/`。
- 登录钥匙串已删除：`Bitwarden`(2)、`Bitwarden_biometric`(1)、`Bitwarden Safe Storage`(2)。
- 复现命令：`./scripts/purge-legacy-identity.sh`（迁移 + 备份 + 删除 + 清钥匙串）。

## 七、离线化收敛（无默认服务端）

- `PRODUCTION_REGIONS` 的 US/EU/Gov 三套地址表已合并为同一份 `OFFLINE_URLS`：所有 `api/identity/icons/webVault/notifications/events/scim/send` 都指向 `https://local.invalid`。
- `send` 的云悖论 URL 特判、FillAssist 远程规则地址、帮助/条款/隐私/社交/应用商店菜单项全部移除或改指项目仓库。
- 桌面 `Help` 菜单只剩「报告问题」「故障排查」「关于」；`Account` 菜单去掉付费、设备、两步验证三个需要服务端页面的入口。
- 网络层仍按白名单拦截（仅你自己的 S3 与主动泄露查询）。
