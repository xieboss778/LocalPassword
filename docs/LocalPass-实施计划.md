# LocalPass（localpass/clients 二开）实施计划

> 初版：2026-11-24　｜　修订 v2：2026-11-24（加入桌面端、代码瘦身、桌面端阻断项）

## v2 修订说明

相对 v1 的三处结构性变化：

1. **客户端从 1 个变成 2 个。** 除 Chrome 扩展外，同时做 **桌面端（Electron：Windows / macOS / Linux）**。Web 与 CLI 明确不做，并从仓库中删除。
2. **新增"代码瘦身"阶段，且排在功能开发之前。** 当前仓库 188 MB / 10,510 个文件，其中约 123 MB 是本次不用的 Web、CLI、企业版代码和多余语言包。先瘦身能把构建时间、`lint`/`tsc`/`jest` 的耗时压下来，后续每个阶段都受益。
3. **架构从"单客户端改分支"改为"共享核心库 + 平台适配层"。** 否则同样的本地写入、同步、备份逻辑要在扩展和桌面各写一遍。

另外记录三个在桌面端发现的**必须先处理的上游阻断项**（v1 未覆盖，见"阶段 0"）：

- 桌面端自动更新指向 `https://artifacts.local.invalid/desktop`（`apps/desktop/electron-builder.json:28-30`），不关掉会把我们的构建直接替换成 LocalPass 官方版。
- 浏览器↔桌面通信硬编码了 `com.8bit.localpass` 和 LocalPass 扩展 ID（`apps/desktop/src/main/native-messaging.main.ts:174-188`、`473-478`）。
- 桌面端构建强制需要 Rust 工具链（`apps/desktop/desktop_native/`），本机目前没有，v1 的"没有 Rust 就停下来"必须升级为"先装工具链"。

## 执行状态（2026-11-26，阶段 2–7 完成）

- **开发规则**：见 `docs/LocalPass-开发规则.md`。硬规则：本地不做构建/打包/测试，全部在 GitHub Actions 完成。
- **阶段 2（本地账户与本地读写）**：完成。`CreateLocalAccountService`（创建 + 从 `account.json` 恢复）、`DefaultLocalVaultWriter`、`CipherService`/`FolderApiService` 的本地分支、`DefaultSyncService` 本地分支、导入器本地分支。
- **阶段 3（桌面端接入）**：完成。原生消息改名 `com.localpass.desktop`、禁 SSO cookie、`data.json.bak` 滚动备份。
- **阶段 4（R2 同步与手动备份）**：完成。SigV4 + S3 客户端、快照合并（清单 412 重试）、备份导出与保留、`account.json` 上传、云端恢复页；调度器已移除，同步/备份改为纯手动。
- **阶段 5（Passkey/PRF）**：代码完成。`LocalWebAuthnPrfEnrollmentService` + 安全密钥页；解锁 RP ID 回退到扩展主机名。
- **阶段 6（TOTP）**：完成。Google Authenticator `otpauth-migration` 解码器（含单测）、导入页、条目详情二维码弹窗。
- **阶段 7（打包）**：Windows NSIS 由 CI 成功产出；macOS 的 Safari appex 硬依赖已移除，job 为 `continue-on-error`，等 macos-15 runner 产出 dmg。

### CI 证据（`main` @ `fa224eb`）

| Job                                                                          | 结论                    |
| ---------------------------------------------------------------------------- | ----------------------- |
| 静态检查（46 个 tsc 项目 + eslint + prettier + 语言包 + 依赖归属）           | ✅                      |
| 单元测试（local-vault / importer / key-management-ui / 钓鱼检测，2158 用例） | ✅                      |
| Chrome 扩展生产构建 + `localpass-chrome` 产物                                | ✅                      |
| 桌面端 Windows（Rust native → 应用 → NSIS → `localpass-windows`）            | ✅                      |
| 桌面端 macOS                                                                 | 排队（runner 供给问题） |

未由 CI 覆盖的内容与人工步骤见 `docs/LocalPass-验证清单.md`。

## Context

在 localpass/clients 基础上做 **LocalPass**，两个客户端：

- **Chrome 扩展**（主战场，MV3）
- **桌面端**（Electron，Windows 优先，兼顾 macOS / Linux）

共同要求：

- 完全离线可用，不依赖任何密码管理服务器。
- 所有付费功能免费。
- 必须包含：Google 动态二维码（TOTP 导入 / 展示）、Passkey 与安全密钥、定时备份。
- 可选授权 Cloudflare R2（或其他 S3 兼容存储）：联网时自动同步，断网排队，联网后补传。
- 两端的保险库数据格式互通（同一个 `account.json`，同一套快照格式）。

已确认的决定：

- **只做本地保险库**，移除登录 LocalPass / Vaultwarden 的入口。
- 附件排在必做功能之后。
- 品牌名 LocalPass。
- **不再追上游 `main`**，只按版本拣安全补丁。原因见"阶段 1"末尾。

上游现状（本地克隆，已逐项核实）：

- **保险库引擎是编译成 WASM 的 Rust SDK。** 条目、文件夹、导入、Passkey 的写入最终都由 SDK 向服务器发 HTTP。SDK 没有注入 HTTP 的接口，也没有"只写本地"的创建接口。
- **本地能力是齐的。** SDK 有本地加密（`ciphers().encrypt`）；`CipherService` 有 `upsert / replace / delete / softDelete / restore`；`FolderService` 有 `encrypt / upsert / delete`。
- **主密码解锁、主密码校验、导出解密都是纯本地操作。** 只有登录、注册、同步、写入需要服务器。
- **上游已有"用安全密钥 / Passkey（PRF）解锁"**，登记功能只在网页端；桌面端走的是系统生物识别（`desktop-lock-component.service.ts:43-77`：Windows Hello / Touch ID / polkit）。
- **上游没有 Google Authenticator 导入**，扩展也不生成二维码。
- 扩展与桌面**共用 `libs/angular` 的 vault / auth 组件**，很多界面改动写一次两端生效；但路由和平台服务各写一份。

## 总体设计（双客户端）

```
                  ┌──────────────── libs/local-vault（新，平台无关）────────────────┐
                  │  本地账户引导 · 本地读写分支 · 同步引擎 · 备份调度 · 网络闸门策略   │
                  └───────┬───────────────────────────────┬───────────────────────┘
                          │ 适配：StorageService           │ 适配：定时器 / 后台执行
        ┌─────────────────▼──────────────┐   ┌────────────▼─────────────────────┐
        │ Chrome 扩展（MV3）              │   │ 桌面端（Electron）                │
        │ chrome.storage（密文）          │   │ electron-store data.json（密文）   │
        │ service worker + alarms        │   │ 主进程 timer + 托盘常驻            │
        │ 解锁：主密码 / PIN / PRF 安全密钥│   │ 解锁：主密码 / PIN / 系统生物识别   │
        │ 自动填充：content script       │   │ 自动填充：autotype + 原生消息中继  │
        └─────────────────┬──────────────┘   └────────────┬─────────────────────┘
                          └───────────┬───────────────────┘
                                      ▼
                        同步引擎（快照 + 按修改时间合并）
                                      │ 仅在已授权且联网时
                                      ▼
                    Cloudflare R2 / 其他 S3 兼容存储（只存密文）

网络闸门：两端都在 ApiService 层拦截，只放行存储服务和用户主动点击的泄露查询
```

**关键决策**

1. **本地分支加在 TypeScript 服务层，不伪造服务器。** 写入收口在少数几个方法里。伪造服务器行不通：SDK 的 HTTP 无法注入，任何 401/403 都会触发登出。
2. **本地账户复用上游"登录成功后"的状态。** 创建保险库时在本地生成全部密钥，再按登录流程的顺序写入同样的状态。之后锁定、解锁、PIN、自动填充全部沿用现有代码，两端都是。
3. **两端共用一个核心库，平台能力通过接口注入。** 差异只有三处：存储后端、定时器/后台生命周期、解锁方式。核心库不 import 任何 `chrome.*` 或 `electron`。
4. **R2 同步采用"快照 + 清单 + 按条目合并"。** 每次推送上传完整快照，清单指向最新快照；拉取时逐条比较修改时间，新者胜；删除用墓碑传播。
5. **R2 凭据用用户密钥加密后存储。** 扩展没有系统级安全存储；桌面有 `safeStorage`（DPAPI / Keychain），桌面端可优先用它。
6. **两端的解锁方式不同，不强行统一。** 扩展用 WebAuthn PRF（RP ID = 扩展 ID）；桌面用系统生物识别。`account.json` 里同时保存两类解锁数据，各自只读自己那类。

## 阶段 0：基线与阻断项

**仓库**

- 完整历史已确认（非 shallow）。新建分支 `local-password`；添加 `upstream` 远源备用。
- 除非明确要求，不提交、不推送。

**先关桌面端自动更新（在做任何桌面构建之前）**

- `apps/desktop/electron-builder.json:28-30` 删除 `publish` 段（或改为自有地址）。
- `apps/desktop/src/main/updater.main.ts` 在 `bootstrap` 直接返回，不再注册 `autoUpdater` 事件；保留 `ELECTRON_NO_UPDATER=1` 作为双保险。
- 理由：`electron-updater` 会定期访问 LocalPass 官方源下载并安装更新，等于把 LocalPass 替换掉，同时暴露固定指纹的请求。

**工具链（桌面端把 Rust 变成硬前置）**

- Node 24（`.nvmrc` 写明 v24；本机当前 v26.13.1，需要切换，否则构建脚本行为可能有差异）。
- `npm ci`（会触发 `electron-rebuild`；国内建议先设 Electron 镜像）。
- Rust stable + MSVC Build Tools + Python（`apps/desktop/desktop_native/` 下 napi、biometric、autotype、autofill_provider、process_isolation 全是 Rust）。
- 逐一验证：`npm run build-native --workspace @localpass/desktop` 成功产出 `.node`。

**构建两端原版**

- 扩展：`npm run build:chrome --workspace @localpass/browser`，用"加载已解压的扩展程序"确认可用。
- 桌面：`npm run build:oss --workspace @localpass/desktop` + `npm run pack:win --workspace @localpass/desktop`，确认能装能开。

**改名 LocalPass（两端一起改）**

- 扩展：`apps/browser/src/manifest.v3.json` 的 `short_name`、`author`、`homepage_url`；固定 `key` 让扩展 ID 稳定。
- 桌面：`apps/desktop/electron-builder.json` 的 `productName`、`appId`（`com.localpass.desktop` → `com.localpass.desktop`）、`nsis.uninstallDisplayName`、各处 `artifactName`。
- 文案：`apps/browser/src/_locales/*/messages.json`、`apps/desktop/src/locales/*/messages.json`，用脚本批量替换含 LocalPass 的名称和描述，键名不变。
- 图标：扩展 `apps/browser/src/images`、`apps/browser/src/popup/images`；桌面 `apps/desktop/resources`、`apps/desktop/src/images`。先占位，后续可换。
- 移除设置页里"下载 LocalPass""更多 LocalPass 产品"等入口（`apps/browser/src/tools/popup/settings/settings-v2.component.html`；桌面共用 `libs/angular` 的设置组件，需逐个确认）。

**六个扩展侧一次性验证**（写临时测试，验证完删除；失败即停下来报告）

1. SDK 接受本地生成的 V1 密钥状态，并且能加解密。
2. 直接写入 `WEBAUTHN_PRF_OPTIONS` 状态后，SDK 初始化不会把它清掉。
3. Chrome 接受"RP ID = 扩展 ID"的 WebAuthn 创建和读取，弹出页和独立窗口各试一次。
4. `qrious` 能被 webpack 打包进扩展。
5. 请求被拦截时不会触发登出。
6. `chrome.storage.local` 在 `unlimitedStorage` 下的实际容量与写入延迟（快照可能到几 MB）。

**四个桌面侧一次性验证**

1. `electron-store` 后端（`apps/desktop/src/platform/main/storage/electron-store-backend.ts`）能读写任意状态键，重启后仍在。

- 系统钥匙串可用：`@localpass/desktop-napi` 的 `passwords`（Windows 凭据管理器 / macOS Keychain / Linux Secret Service）能读写，且服务名（`main.ts:335` 传 `app.getName()`）已随 `productName` 改成 LocalPass，不会与已安装的 LocalPass 抢同名条目。

3. Windows Hello 生物识别在当前机器上可登记、可解锁（`BiometricsService` 走 Rust 模块）。
4. 自行打包的 NSIS 安装包能装、能开、卸载能清干净。

以上任何一项失败，我停下来报告并给替代方案。

## 阶段 1：代码瘦身（先于功能开发）

### 现状实测（2026-11-24）

| 目标                                                         |                  体积 |        文件数 | 说明                                      |
| ------------------------------------------------------------ | --------------------: | ------------: | ----------------------------------------- |
| `apps/web`                                                   |                 68 MB |         1,404 | Web 端，不做                              |
| `apps/cli`                                                   |                1.2 MB |           158 | CLI，不做                                 |
| `localpass_license`                                          |                9.9 MB |         1,311 | 企业版 PAM / SM，浏览器与桌面端零直接引用 |
| `apps/browser/src/_locales`                                  |                 22 MB | 64 个语言文件 | 只保留 `en` + `zh_CN`                     |
| `apps/desktop/src/locales`                                   |                 18 MB | 67 个语言文件 | 同上                                      |
| `apps/browser/store`                                         |                5.0 MB |            97 | Chrome 商店素材，自用不需要               |
| `.github`                                                    |                519 KB |             — | 只留浏览器/桌面相关 workflow              |
| `libs/pricing` / `subscription` / `organization-invite-link` |     351 / 203 / 83 KB |            95 | 仅 Web 直接引用                           |
| `libs/pam` / `billing` / `automation-driver` / `dirt`        | 17 / 14 / 108 / 28 KB |            62 | 删除应用后基本无消费者                    |
| `libs/storybook` + `.storybook`                              |                 96 KB |             — | 开发辅助，可选                            |

合计源码 **188 MB → 预计约 65 MB**，文件数 **10,510 → 约 7,300**。

### 1.1 删除整个应用（收益最大、风险最低）

- 删除 `apps/web`、`apps/cli`、`localpass_license/`。
- 同步清理：根 `package.json` 的 workspaces 条目、`angular.json` 对应项目、`tsconfig.base.json` 的 `@localpass/web-vault/*`、`@localpass/cli/*`、`@localpass/bit-*` 别名、`eslint.config.mjs` 的项目列表、`jest.config.js` 的项目列表、`nx.json` 的相关输入、`e2e/` 里 web 相关 spec 与配置。
- 删除 `apps/web/Dockerfile`、`entrypoint.sh`、`dev-server.shared.pem` 等 Web 专有文件。

### 1.2 语言包裁剪

- 只保留 `en` 与 `zh_CN`，其余目录整体删除；`manifest` 的 `default_locale` 保持 `en`。
- 跑 `npm run test:locales`，确认键集合一致、无缺失。
- 注意：`messages.json` 的键名一律不改，中文缺键自动回退英文，这条上游机制保留。

### 1.3 移除 Web 专属库（需依赖图验证）

- 候选：`libs/pricing`、`libs/subscription`、`libs/organization-invite-link`、`libs/pam`、`libs/billing`、`libs/automation-driver`、`libs/dirt/card`。
- 验证方式：先 `npx nx graph --focus=@localpass/browser` 与 `--focus=@localpass/desktop` 导出依赖，确认候选库不在闭包内；再全量 `npm run test:types`。
- **不做"半删"**：不为了瘦身去拆 `libs/common`、`libs/vault`、`libs/admin-console` 内部的 Web 代码。这些库两端都用，拆内部结构会让后续同步上游补丁变难，性价比低。`admin-console` 保留，只在 UI 上隐藏组织/企业入口。

### 1.4 清理构建与打包配置

- 删除 `dist:bit:*`、`build:bit*`、`bit:beta` 等企业版脚本与 `electron-builder.beta.json` 的企业变体。
- `apps/desktop/electron-builder.json`：删除 macOS 的 `mas`（App Store）配置与 `windows_plugin_authenticator` 相关 `extraResources`（见阶段 3）。
- 删除 Firefox / Edge / Opera / Safari 的构建脚本与 manifest 变体，只留 Chrome MV3。
- `apps/desktop/src/locales` 的脚本、`snap` / `flatpak` 清单里的 LocalPass 标识一并改或删。

### 1.5 开发辅助（可选，最后做）

- 删除 `.storybook/`、`libs/storybook/`、`build-storybook*` 脚本、`test-stories*` 脚本。组件里的 `*.stories.ts` 保留（删 400+ 个文件收益小、冲突大）。

### 瘦身的护栏

- **每一步一个独立 commit**，删除清单写进 `docs/removed-from-upstream.md`（删了什么、为什么、对应上游路径）。
- 每步之后必过：`npm run lint`、`npm run test:types`、`npm test`、`npm run build:prod:chrome --workspace @localpass/browser`、`npm run build:oss --workspace @localpass/desktop`。
- 全部完成后跑一次两端手动冒烟：解锁、增删改、导入、自动填充。
- **上游策略变更**：瘦身之后与上游 `main` 已无法逐行合并，因此不再追 `main`；改为按上游 release tag 只拣安全与加密相关补丁，手工移植。这个取舍要在项目记录里写明，避免以后误判。

## 阶段 2：本地保险库核心（共享库 + 扩展接线）

**新库 `libs/local-vault`**（包名 `@localpass/local-vault`，不 import `chrome.*` / `electron`）

- `local-account.service.ts`：本地账户标记，`isLocalAccount$(userId)`。
- `create-local-account.service.ts`：创建和恢复共用的"写入登录后状态"逻辑。
- `local-cipher.service.ts`：条目与文件夹的本地写入（含批量导入）。
- `network-gate.service.ts`：`LocalPassApiService extends ApiService` 的实现主体，覆盖 `fetch`、`nativeFetch`、`nativeXMLHttpRequest`；放行白名单由配置注入。
- `sync/`：快照生成、合并、墓碑（阶段 4 填充）。

状态键加在 `libs/state/src/core/state-definitions.ts`，新键不需要迁移。

**创建保险库时写入的状态**（照 `libs/auth/src/common/login-strategies/login.strategy.ts:186-278` 的顺序）

- 账户记录。
- 环境：所有地址用哨兵 `https://vault.local.invalid`，通知地址用 `"http://-"`（上游自带的关闭开关）。
- 解锁选项 `hasMasterPassword: true`。缺了它，锁定会变成登出。
- 主密码解锁数据。
- 自签访问令牌：`sub` 是 GUID，带 `email` 和远期 `exp`。
- KDF 配置：沿用上游默认 PBKDF2 600,000 次。
- `setHasPremium(true)`：付费功能全部开放。
- 密钥状态 `{ V1: { private_key } }`：用 `legacyCompatKeyService.makeKeyPair` 生成（仓库里 `key-connector.service.ts:270-309` 有同样的先例）。
- 解锁，然后写入"上次同步时间"。

**本地写入分支**

- `libs/common/src/vault/services/cipher.service.ts` 加 7 处分支：`createWithServer`、`updateWithServer`、`moveManyWithServer`、`deleteWithServer`、`softDeleteWithServer`、`restoreWithServer`（811–945、1232、1259、1394、1442 行），分支体调用 `libs/local-vault`。
- 本地实现：SDK 加密 → 补上原本由服务器给的字段（`id`、`creationDate`、`revisionDate`、`edit`、`viewPassword`）→ `upsert` 或 `delete` → 登记到待同步队列 → 返回解密后的条目。
- `libs/common/src/vault/services/folder/folder-api.service.ts:17-36`：`save` 和 `delete` 加同样分支。
- `libs/common/src/platform/sync/default-sync.service.ts:126`：`fullSync` 开头加本地分支，只更新"上次同步时间"。弹出页要等这个值才显示条目列表（`vault-popup-items.service.ts:492`）。
- `libs/importer/src/services/import.service.ts:593-607`：`handleIndividualImport` 加本地分支，批量写入。

**网络闸门（两端各自挂载）**

- 扩展：替换 `apps/browser/src/background/main.background.ts:968-979` 和 `apps/browser/src/popup/services/services.module.ts:295` 的 `ApiService`。
- 桌面：替换 `apps/desktop/src/app/services/services.module.ts` 的 `ApiService`；主进程侧禁用 `updater`、`sso-cookie`（`apps/desktop/src/main/sso-cookie.main.ts`）。
- 关掉三个默认联网项：
  - 钓鱼网站列表下载（`phishing-detection-settings.service.ts:18-25`）。
  - 打开条目时的密码泄露检查（`default-cipher-risk.service.ts:60-85`，`checkExposed: false`）。
  - 网站图标（`domain-settings.service.ts:55`，默认关闭）。

**登录页改为起始页（两端路由各改一次）**

- 扩展：`apps/browser/src/popup/app-routing.module.ts` 的登录路由（534–562 行）和注册路由（481–510 行）。
- 桌面：`apps/desktop/src/app/app-routing.module.ts` 的 `AuthRoute.Login`（217 行起）与 `AuthRoute.SignUp`（170 行起）。
- 起始页三个入口：创建保险库、从 R2 恢复、从备份文件导入。向导不调用上游的"新密码泄露检查"。

**安全护栏**

- 连续输错 PIN 不再登出（`libs/key-management-ui/src/lock/components/lock.component.ts:533-549`），改为递增等待。
- 登出前弹确认框，说明会清空本机全部数据，并提供"先导出"（扩展 `apps/browser/src/auth/popup/logout/extension-logout.service.ts`；桌面找同类实现）。
- 本地账户隐藏 Send：扩展改 `tabs-v2.component.ts:64-100`；桌面直接让 `SendPolicyService.disableSend$` 恒为 `true`（`desktop-layout.component.ts:51`、`send.component.html:3` 已有判断），比改模板稳。同时隐藏管理设备、两步登录、紧急访问等依赖服务器的入口。
- 不再执行登录后的强制同步（`default-login-success-handler.service.ts:19-34`），不再提示"升级到 V2 加密"。
- 修改主密码（`default-change-password.service.ts:94`）：服务器调用换成在本地用新密码重新包装用户密钥。**不轮换密钥**，旧备份仍能用旧密码打开，界面上注明。

## 阶段 3：桌面端接入

**3.1 存储适配**

- 桌面端状态已由主进程 `electron-store`（`data.json`，文件权限 0600）持久化，`ElectronRendererStorageService` 通过 IPC 读写，直接用即可，**不需要改存储层**。
- 需要确认两点：单文件写入体量（快照可能数 MB）与启动时反序列化耗时；快照类大对象建议独立文件存放，不进 `data.json`。
- `electron-store` 底层 `atomically` 保证原子写；额外加一份 `data.json.bak` 滚动备份，用于极端情况恢复。

**3.2 后台与定时**

- 桌面端没有 service worker 生命周期问题，定时任务放主进程 `setInterval` + 托盘常驻；窗口关闭后仍可同步。
- 与扩展共用 `sync/` 核心：扩展用 `chrome.alarms`，桌面用主进程 timer，只替换调度适配器。
- 应用退出前若队列非空，提示"还有未上传的修改"。

**3.3 解锁方式**

- 主密码 + PIN 沿用现有代码。
- 生物识别：`BiometricsService`（Rust，Windows Hello / Touch ID）已可用，登记与解锁路径基本不用改。
- **桌面端不做 WebAuthn PRF 解锁**：Electron 的 WebAuthn 需要与域名绑定的 RP ID，无法像扩展那样用扩展 ID；强行做会引入不可靠依赖。`account.json` 里保留 PRF 数据只是为了另一端能读，桌面端忽略即可，界面上写明"安全密钥解锁仅在浏览器扩展中可用"。

**3.4 自动填充**

- 桌面内置 autotype（全局快捷键键入）与 Windows autofill provider，均为本地能力，保留。
- 浏览器↔桌面中继若要保留：改掉 `native-messaging.main.ts` 里的 `com.8bit.localpass` 主机名与硬编码扩展 ID（`{446900e4-71c2-419f-a6a7-df9c091e268b}`，174-188 行、473-478 行的注册表/路径清单），换成 LocalPass 自己的固定扩展 ID（阶段 0 已固定 `key`）。
- **Windows plugin authenticator 在 v1 关闭**：它需要 Authenticode 签名与商店/系统注册，属于额外发布成本。删掉 `electron-builder.json` 里对应的 `extraResources` 与 `windows_plugin_authenticator_*` 配置。

**3.5 清理服务器相关入口（桌面）**

- 删除/隐藏：SSO 登录、登录请求审批、设备管理、组织与成员管理、两步登录、紧急访问、LocalPass Send 的服务端部分。
- 桌面端"清除数据"与"重新加载"要确认不会连服务器；`window.main.ts` 里若有关联的清理逻辑一并检查。

**3.6 打包**

- Windows：`npm run pack:win --workspace @localpass/desktop` 产出 NSIS 安装包（`LocalPass-Setup-x.y.z.exe`）。
- macOS：`pack:mac`（dmg）。未签名 + 未公证，首次打开需右键→打开；`entitlements.mac.plist` 保留 keychain / 生物识别权限。
- Linux：flatpak / snap 清单里的 LocalPass ID 与 URL 必须改，否则清单无效；v1 可只出 AppImage。
- 不签名意味着 SmartScreen 警告，安装说明里写清"更多信息→仍要运行"。

## 阶段 4：R2 同步与定时备份（两端共用）

**核心库 `libs/local-vault/src/sync/`**

- `s3-client.ts`：自己用 WebCrypto 实现 AWS SigV4 签名，不新增依赖。支持 GET、带条件的 PUT、DELETE、ListObjectsV2。
  - Cloudflare R2 预设：端点按账户 ID 和辖区拼接，region 为 `auto`。
  - 通用 S3 兼容：自定义端点、region、路径风格。MinIO、Backblaze B2、阿里云 OSS、腾讯云 COS 都走这一套。
- `vault-backup-sync.service.ts`：同步引擎。
- `vault-backup-scheduler.service.ts`：**已移除**。备份/同步只由用户手动触发，进程内不再有任何定时器。
- 状态键 `StateDefinition("vaultBackup", "disk")`：配置（密文）、待同步队列、墓碑、同步状态、备份设置。

**"授权 Cloudflare"的实际形式**

Cloudflare 没有第三方登录授权流程。做法是：在 Cloudflare 控制台创建 R2 API 令牌（限定单桶、对象读写），把账户 ID、Access Key ID、Secret Access Key、桶名填进设置页。设置页提供跳转链接和步骤说明。

**R2 上的对象**（前缀 `<桶>/<自定义前缀>/<用户ID>/`，全部密文）

- `account.json`：KDF、主密码包装的用户密钥、密钥状态、两类解锁数据。换设备/换端恢复时用。
- `manifest.json`：指向最新快照。
- `snapshots/<快照ID>.json`：全部条目、文件夹、墓碑。
- `backups/<年-月>/<时间戳>.json`：定时备份，标准 LocalPass 加密 JSON 格式（两端都能导入）。

**同步算法**

- **推送**：本地状态生成快照 → 上传 → 用 `If-Match` 条件更新清单。清单被别的设备改过（412）就先拉取合并再重试，最多 3 次。成功后才清空队列。
- **拉取**：读清单，有变化就下载快照，逐条按 `revisionDate` 合并。
- **触发**：本地写入后 15 秒防抖；解锁后；打开弹出页 / 桌面主窗口（5 分钟节流）；点"立即同步"；每 30 分钟定时检查。未授权、未解锁或离线时跳过，队列保留。
- **冲突**：同一条目多端都改过时，修改时间新的胜出，界面上说明。

**定时备份**

- 默认每天一次，可改每周或关闭。已授权、已解锁、联网时执行；否则跳过，解锁后补做。桌面端需要应用在运行（托盘常驻即可）。
- 内容用 `IndividualVaultExportService.getPasswordProtectedExport`（`libs/tools/export-vault-core/src/services/individual-vault-export.service.ts:74`）。
- 备份口令：启用时随机生成，用用户密钥加密保存，设置页可查看和复制。恢复到任何 LocalPass 客户端都要用它。
- 按保留数量清理，默认 10 份。

**恢复**

- **从 R2 恢复**（新设备/另一端）：填凭据 → 下载 `account.json` → 输入主密码 → 本地解出用户密钥 → 写入登录后状态 → 拉取全部条目。
- **从文件恢复**：先创建空保险库，再用导入页导入备份文件，走阶段 2 的本地导入。

**设置页**：扩展 `apps/browser/src/tools/popup/settings/backup/`，桌面复用同一 Angular 组件（放 `libs/angular` 或已有 settings 区块）。入口加在 `vault-settings.component.html`。内容：配置表单、测试连接、同步状态、立即同步、立即备份、定时开关、备份列表、备份口令、断开。

**注册到两端**

- 扩展：`libs/scheduling/src/scheduled-task-name.enum.ts` 加任务名；`MainBackground` 构造服务并注册；`services.module.ts` 的 `safeProviders` 注册弹出页版本；耗时操作走 `runtime.background.ts` 的 `messagesWithResponse`（关掉弹出页不中断）。
- 桌面：主进程注册 timer 与任务处理；渲染进程通过既有 IPC 通道触发。

## 阶段 5：Passkey 与安全密钥

**为网站保存 Passkey（两端）**

- `libs/common/src/platform/services/fido2/fido2-authenticator.service.ts` 的 4 处服务器调用（111–117、195、259–269、321–335 行）都走 `cipherService.updateWithServer` 和 `syncService.fullSync`，阶段 2 完成后自动变成本地操作。
- 扩展在测试站点验证创建与断言；桌面端用内置浏览器/autofill 流程验证。

**用安全密钥 / Passkey 解锁保险库**

- **扩展（新）**：把网页端 `webauthn-login-admin.service.ts:113-178` 的 `createCredential` 和 `createKeySet` 移植为 `libs/key-management-ui/src/lock/services/local-webauthn-prf-enrollment.service.ts`。选项本地构造，RP ID 用扩展 ID。复用 `WebAuthnLoginPrfKeyService`（盐为常量）与 `RotateableKeySetService.createKeySet`。
- 存储：`WEBAUTHN_PRF_OPTIONS`（`libs/common/src/key-management/state-definitions.ts:120`）。
- 解锁：沿用 `UnlockViaPrfComponent` 与 `DefaultWebAuthnPrfUnlockService`；`default-webauthn-prf-unlock.service.ts:249-269` 的 RP ID 改为直接取扩展 ID。
- **桌面**：不做 PRF（见 3.3），用 Windows Hello / Touch ID。设置页按平台显示不同项。
- 多设备：解锁数据随 `account.json` 同步；PRF 凭据只在扩展端有效，桌面端显示"不可用"。
- 弹出页被关闭的情况：如果 Chrome 弹系统验证框时关闭了弹出页，改在独立窗口完成（仓库已有弹出窗口工具）。

## 阶段 6：Google 动态二维码（两端）

**从 Google Authenticator 导入**

- 解析器放 `libs/importer/src/importers/google-authenticator/`：解码 `otpauth-migration://offline?data=...`（protobuf），手写小型解码器，不新增依赖。
- 页面放 `apps/browser/src/tools/popup/settings/import/`，入口加在 `vault-settings.component.html`（桌面复用）。
- 三种输入：选二维码图片（可多张）、粘贴 URI、截取当前页面。
  - 扩展：`qrcode-parser` + `BrowserApi.captureVisibleTab`。
  - 桌面：选图片/粘贴为主；截屏需 `desktopCapturer`，作为增强项。
- 流程：解析 → 预览（发行方、账号）→ 批量创建带动态口令的登录条目（复用阶段 2 的批量本地写入）。按 `secret` 去重。
- HOTP（基于计数器）条目 LocalPass 不支持，跳过并提示数量。

**生成二维码**

- 新组件 `libs/vault`（共用）里的 `totp-qr.component.ts`，用已有依赖 `qrious`；条目详情加"显示二维码"。阶段 0 验证不通过就换小型 ESM 库。
- 桌面端同样可用（Electron 渲染进程能跑 canvas）。

**动态口令免费**：本地账户已标记付费，自动填充、右键"复制验证码"、详情页显示全部开放。

## 阶段 7：打包与发布

- 扩展：`npm run dist:chrome --workspace @localpass/browser` → `dist-chrome.zip` + 安装说明。
  - Chrome 官方文档写明：macOS 上外部安装的更新地址必须指向应用商店。所以只能开发者模式"加载已解压的扩展程序"，或上架。
- 桌面：Windows NSIS 安装包（主）、macOS dmg + AppImage。
- 附数据安全说明：没有服务器，数据只在本机；建议尽早授权 R2 或定期导出。
- **许可**：上游 GPL-3.0，分发二进制（尤其是桌面安装包）需公开源码。`localpass_license/` 已在阶段 1 删除，不涉及。

## 复用的现有代码

| 用途             | 位置                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| 本地加密         | `DefaultCipherEncryptionService.encrypt / encryptMany`                                                |
| 本地读写         | `CipherService.upsert / delete / softDelete / restore`、`FolderService.encrypt / upsert / delete`     |
| 生成密钥对       | `LegacyCompatKeyService.makeKeyPair`                                                                  |
| 本地校验主密码   | `DefaultMasterPasswordUnlockService.proofOfDecryption`                                                |
| 加密导出         | `IndividualVaultExportService.getPasswordProtectedExport`                                             |
| 加密导出的导入   | `localpass-password-protected-importer.ts`                                                            |
| 定时任务         | `ScheduledTaskNames`、`TaskSchedulerService`                                                          |
| 请求拦截         | `ApiService.addMiddleware`                                                                            |
| 安全密钥解锁     | `DefaultWebAuthnPrfUnlockService`、`UnlockViaPrfComponent`、`RotateableKeySetService`                 |
| 桌面持久化       | `ElectronStoreBackend`、`ElectronRendererStorageService`（IPC）                                       |
| 桌面密钥保护     | `@localpass/desktop-napi` 的 `passwords`（系统钥匙串，经 `DesktopCredentialStorageListener` IPC）     |
| 桌面生物识别     | `BiometricsService` + `desktop_native/biometric`（Rust）                                              |
| 桌面自动填充     | `apps/desktop/src/autofill/`、`autotype`（Rust）                                                      |
| 二维码识别、生成 | `qrcode-parser`、`qrious`（都已依赖）                                                                 |
| 设置页模板       | `export-browser-v2.component.ts`、`import-browser-v2.component.ts`                                    |
| 文案             | `apps/browser/src/_locales/*/messages.json`、`apps/desktop/src/locales/*/messages.json`，中文 `zh_CN` |

## 验证

**自动化**

- 每个新模块配单元测试：创建后正确密码可解锁、错误密码失败；本地增删改后条目能被 SDK 正确解密；SigV4 与 AWS 官方测试向量一致；快照合并（新增、修改、删除、冲突）。
- 每阶段结束跑：`npm run lint`、`npm run test:types`、`npm run lint:dep-ownership`、`npm test`、`npm run build:prod:chrome --workspace @localpass/browser`、`npm run build:oss --workspace @localpass/desktop`。

**手动（两端，全程断网）**

| 场景                                              | 扩展             | 桌面                        |
| ------------------------------------------------- | ---------------- | --------------------------- |
| 创建保险库 / 锁定 / 主密码解锁 / 重启后解锁       | ✅               | ✅                          |
| 增删改条目与文件夹、回收站、自动填充              | content script   | autotype / Windows autofill |
| 在测试站点创建并使用 Passkey                      | ✅               | ✅                          |
| 截图/粘贴导入 Google Authenticator、显示二维码    | ✅               | ✅（粘贴/选图）             |
| 登记安全密钥并解锁                                | PRF              | Windows Hello / Touch ID    |
| 断网操作无异常，恢复联网后无 `local.invalid` 请求 | DevTools Network | Fiddler / 主进程日志        |
| 升级安装后保险库仍在                              | 扩展重载         | 安装包覆盖安装              |

**R2（需要你提供测试用 R2 令牌和存储桶）**

1. 配置并测试连接。
2. 修改条目后自动上传；断网修改，联网后补传。
3. 扩展 + 桌面同时使用，确认双向同步与冲突规则。
4. 手动或等待定时备份，用备份口令在另一个客户端导入成功。
5. 全新环境走"从 R2 恢复"。

## 风险与对策

| 风险                                                  | 对策                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| **桌面端自动更新把应用替换成 LocalPass 官方版**       | 阶段 0 第一步就删 `publish` 与 updater 注册；打包后断网验证不发起更新请求  |
| Rust SDK 黑盒，本地数据格式可能不一致                 | 阶段 0 验证 + "导出再导入"交叉验证；失败停下来给替代方案                   |
| 服务器下发的功能开关默认全关                          | 测试时逐个确认，确需的本地给默认值                                         |
| 桌面构建链（Rust + MSVC + Electron 下载）在国内易失败 | 先单独跑通 `build-native`，配 Electron 镜像；失败即报，不硬试              |
| 桌面未签名：SmartScreen / Gatekeeper 拦截             | 安装说明写明绕过步骤；后续可买证书                                         |
| macOS 生物识别与 keychain 需要 entitlements           | 保留并核对 `entitlements.mac.plist`；不做公证则只能右键打开                |
| MV3 后台会被随时终止                                  | 上传中断后队列不清空，下次触发重试；每次推送新快照，重试不会损坏           |
| 桌面端不在运行就没法定时备份                          | 托盘常驻 + 启动时补做；设置页说明                                          |
| 修改主密码不轮换密钥                                  | 旧备份仍能用旧密码打开；真正轮换放到附件之后                               |
| 瘦身造成上游补丁难合并                                | 已决策不追 `main`；保留 `docs/removed-from-upstream.md` 做映射             |
| 许可（GPL-3.0）                                       | 分发即公开源码；桌面安装包附源码链接                                       |
| 两端功能漂移                                          | 阶段 2 起所有业务逻辑进 `libs/local-vault`；两端只写适配器，代码评审时检查 |

## 工作量估算（单人）

| 阶段                                   | 估算          |
| -------------------------------------- | ------------- |
| 0 基线（工具链、双端构建、改名、验证） | 3–4 天        |
| 1 瘦身                                 | 2–3 天        |
| 2 本地保险库核心 + 扩展接线            | 6–8 天        |
| 3 桌面端接入                           | 6–8 天        |
| 4 R2 同步 + 定时备份                   | 5–7 天        |
| 5 Passkey / 安全密钥                   | 3–5 天        |
| 6 TOTP 二维码                          | 3–4 天        |
| 7 打包发布                             | 3–4 天        |
| **合计**                               | **约 5–6 周** |

## 不在本次范围

- 离线附件（必做功能完成后的下一阶段）。
- WebDAV（S3 兼容已覆盖大部分私有存储）。
- HOTP（基于计数器）条目。
- Web 端、CLI 的改动（直接从仓库删除）。
- 移动端。
- 扩展上架应用商店 / 桌面代码签名与公证（需账号与费用）。
- 密钥轮换（改主密码时）。
