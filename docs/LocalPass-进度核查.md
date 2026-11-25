# LocalPass 进度核查（对照 `docs/LocalPass-实施计划.md`）

> 核查时间：2026-11-25　｜　核查方式：只读代码 + git 历史 + 依赖引用分析（未做任何本地构建，遵守 `docs/LocalPass-开发规则.md`）
> 核查基线：`main` @ `fb81411`（工作区干净）
> **更新（2026-11-25 晚）**：下方结论是核查当时（实现前）的快照。此后代码已推进到 `09af6bf`，
> 阶段 2 数据层与网络层、阶段 3 阻断项、阶段 4 核心均已落地，详见文末「2026-11-25 实施进展」。

## 一句话结论

**阶段 0（基线/改名/阻断项）基本完成，阶段 1（瘦身）基本完成，阶段 2（本地保险库核心）刚起步，阶段 3–7 全部未开始。**
计划里你要求"必须包含"的四项功能——**离线可用、付费全开、Google 动态二维码、Passkey/安全密钥、定时备份与 R2 同步——目前一项都没有落地**。

按计划自带的工作量估算（合计 37 人日）加权计算，**整体约 19%**。

| 阶段                        | 计划工作量 | 实际状态                                     | 估算完成度 |
| --------------------------- | ---------: | -------------------------------------------- | ---------: |
| 0 基线 / 改名 / 阻断项      |     3–4 天 | 基本完成，缺一次性验证记录                   |       ~95% |
| 1 代码瘦身                  |     2–3 天 | 主体完成，残留 beta/多浏览器产物             |       ~85% |
| 2 本地保险库核心 + 扩展接线 |     6–8 天 | 只有 3 个纯逻辑文件 + 1 个状态服务，零消费者 |       ~12% |
| 3 桌面端接入                |     6–8 天 | 未开始（计划内"不做 PRF"除外）               |         0% |
| 4 R2 同步 + 定时备份        |     5–7 天 | 仅 SigV4 签名与快照合并算法（含测试）        |       ~15% |
| 5 Passkey / 安全密钥        |     3–5 天 | 未开始                                       |         0% |
| 6 TOTP 二维码               |     3–4 天 | 未开始                                       |         0% |
| 7 打包发布                  |     3–4 天 | CI 能出未签名产物，发布流程未定              |       ~10% |

## 关键判断：`libs/local-vault` 是死代码

全仓库检索 `@localpass/local-vault` 的 import：**0 处**（`libs/local-vault` 自身 spec 除外）。
库已被 `tsconfig.base.json`、`jest.config.js`、`package.json` workspaces 注册，但没有任何应用使用它。

现有全部内容（706 行，含 4 个 spec / 22 个 `it`）：

| 文件                                   | 行数 | 性质                                                         |
| -------------------------------------- | ---: | ------------------------------------------------------------ |
| `src/account/local-account.service.ts` |   40 | 本地账户标记读取（`isLocalAccount$`），无调用者              |
| `src/network/gate-policy.ts`           |   61 | 纯函数式放行策略，**没有** `ApiService` 子类、没有挂载到两端 |
| `src/s3/sigv4.ts`                      |  187 | 手写 SigV4 签名（阶段 4 的地基）                             |
| `src/sync/snapshot-merge.ts`           |  160 | 快照按 `revisionDate` 合并（阶段 4 的地基）                  |

计划要求的 `create-local-account.service.ts`、`local-cipher.service.ts`、`network-gate.service.ts`（`LocalPassApiService`）、`sync/s3-client.ts`、`sync/vault-backup-sync.service.ts`、`sync/vault-backup-scheduler.service.ts`：**全部不存在**。

## 逐项核查

### 阶段 0

| 计划项                 | 状态      | 证据                                                                                                                                                                              |
| ---------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 关闭桌面自动更新       | ✅        | `apps/desktop/src/main.ts:449-451` 短路注释、`updaterMain.init()` 已不再调用；`electron-builder.json` 的 `publish` 段为 0 处                                                      |
| 扩展改名 + 固定扩展 ID | ✅        | `manifest.v3.json` `short_name/author/homepage_url` 已改；`key` 在 232 行，**实算 SHA256→ID = `gmobddgobjdhbjhedhgaeekhgchkoncm`，与文档一致**                                    |
| 桌面改名               | ✅        | `productName: LocalPass`、`appId: com.localpass.desktop`、`extraMetadata.name: localpass`                                                                             |
| 文案批量替换           | ⚠️ 部分   | 语言包已改；`apps/desktop/electron-builder.json:166` 仍是 `publisherDisplayName: "LocalPass Inc"`，`beta` 配置整份仍是 LocalPass                                                  |
| 六个扩展侧一次性验证   | ❌ 无记录 | `docs/` 下没有验证结论；6 项里 2 项已实质完成（固定 ID、请求拦截策略雏形），4 项（SDK V1 密钥状态、PRF 状态不被清、RP ID=扩展 ID 的 WebAuthn、`chrome.storage.local` 容量）无证据 |
| 四个桌面侧一次性验证   | ❌ 无记录 | 同上                                                                                                                                                                              |

### 阶段 1

| 计划项                                           | 状态    | 证据                                                                                                                              |
| ------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 删 `apps/web` / `apps/cli` / `localpass_license` | ✅      | `apps/` 只剩 `browser` `desktop`；`libs/` 无企业库                                                                                |
| 语言包只留 en + zh_CN                            | ✅      | 两个 locales 目录各只有 `en` `zh_CN`                                                                                              |
| 删无消费者库                                     | ✅      | 已删 `pam/billing/dirt-card`；`pricing/subscription/organization-invite-link` 有消费者，按文档保留                                |
| 清理企业版构建脚本                               | ⚠️ 部分 | `dist:bit*` 已删；但 `apps/desktop/package.json:77,84` 仍有 `pack:*:beta`，`electron-builder.beta.json`、`beta-release.json` 仍在 |
| 只留 Chrome MV3                                  | ❌ 未做 | `apps/browser/package.json` 仍有 `build:firefox/edge/opera/safari`、`dist:*`、`package:dev:chrome`；`project.json` 仍有 edge 目标 |
| 瘦身护栏（每步全量 lint/types/test）             | ❌      | `.github/workflows/localpass.yml` 只有 3 个构建 job，**没有 lint / test:types / jest / lint:dep-ownership**                   |
| 删除清单文档                                     | ✅      | `docs/removed-from-upstream.md` 已建立并记录                                                                                      |

### 阶段 2（本地保险库核心）

| 计划项                                                                                             | 状态 | 证据                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态键 + `LocalAccountService`                                                                     | ✅   | `libs/state/src/core/state-definitions.ts:311-313`（`localVault/localVaultSync/localVaultBackup`）、`local-account.service.ts`                                                                      |
| `create-local-account.service.ts`（写入登录后状态、哨兵环境、自签令牌、密钥状态、`setHasPremium`） | ❌   | 文件不存在；`setHasPremium` 全仓库仅上游登录流程在用（`login.strategy.ts:238`）                                                                                                                     |
| `local-cipher.service.ts`                                                                          | ❌   | 不存在                                                                                                                                                                                              |
| `cipher.service.ts` 7 处本地分支                                                                   | ❌   | 文件里 `local` 命中的全是上游 `localData`（自动填充本地字段），无本地写入分支                                                                                                                       |
| folder / `default-sync` / `import.service` 本地分支                                                | ❌   | 三个文件里 0 处本地分支                                                                                                                                                                             |
| 网络闸门挂载到两端 `ApiService`                                                                    | ❌   | `main.background.ts`、两端 `services.module.ts` 无任何 `local-vault` 引用                                                                                                                           |
| 关掉三个默认联网项                                                                                 | ❌   | 钓鱼检测默认仍开（`phishing-detection-settings.service.ts:26` `?? true`）、网站图标默认仍开（`domain-settings.service.ts:55` `?? true`）、`default-cipher-risk.service.ts:63` `checkExposed = true` |
| 登录页改起始页 / 创建向导                                                                          | ❌   | `apps/browser/src/popup/app-routing.module.ts:535` 仍是上游 `AuthRoute.Login`                                                                                                                       |
| PIN 连错不登出                                                                                     | ❌   | `libs/key-management-ui/src/lock/components/lock.component.ts`（`tryPin`）第 5 次仍 `logoutService.logout`                                                                                          |
| 登出二次确认 / 隐藏 Send / 去掉强制同步 / 本地改主密码                                             | ❌   | 四处均未改动                                                                                                                                                                                        |

### 阶段 3（桌面端）

- 存储适配：`electron-store` 直接用（符合计划"不改存储层"），但 `data.json.bak` 滚动备份**未做**。
- 主进程定时 + 托盘同步：未做。
- 生物识别：上游已可用，未接。
- `native-messaging.main.ts:174,184,188` 仍是 `com.8bit.localpass` 与 LocalPass 扩展 ID `{446900e4-...}`，**未换成 LocalPass**（计划 3.4 明确要求）。
- `sso-cookie.main.ts` 仍被 `main.ts:194,423` 初始化，未按计划禁用。
- `windows_plugin_authenticator` / `mas` 配置：`electron-builder.json` 中已无 → ✅。

### 阶段 4（R2 同步 + 备份）

地基已有（SigV4 + 合并，共 22 个单测）。缺：`s3-client`（GET / 条件 PUT / DELETE / ListObjectsV2）、同步引擎、调度器、`manifest.json` / `snapshots/` / `backups/` 对象布局、凭据加密存储、设置页（`apps/browser/src/tools/popup/settings/backup/` **目录不存在**）、`ScheduledTaskNames` 注册。

### 阶段 5 / 6

- `libs/importer/src/importers/google-authenticator/`：不存在。
- `totp-qr.component.ts`：不存在（`qrious` 依赖在 `package.json:227`，但 0 处使用）。
- `local-webauthn-prf-enrollment.service.ts`：不存在。
- Passkey 保存的 4 处 `fido2-authenticator.service.ts` 服务器调用依赖阶段 2，尚未变成本地写。

### 阶段 7

CI 只在 push 时产出未签名 artifact（`localpass-chrome` / `localpass-windows` / `localpass-macos`）；`dist:chrome` 的 zip 未在 CI 中生成，发布说明、GPL 源码链接、安装指引均无。

## 你要的功能 → 现状

| 你的需求                                | 现状                                                           | 判定                   |
| --------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| 完全离线可用、不依赖任何服务器          | 仍需登录 LocalPass 服务器才能进入保险库；离线分支未写          | ❌                     |
| 所有付费功能免费                        | `setHasPremium(true)` 未在本地账户流程调用（该流程本身不存在） | ❌                     |
| Google 动态二维码：TOTP 导入            | 解析器、页面、入口全无                                         | ❌                     |
| Google 动态二维码：展示（生成二维码）   | 组件不存在，`qrious` 未使用                                    | ❌                     |
| Passkey（网站登录）                     | 上游能力在，但写入仍走服务器 → 离线不可用                      | ❌（上游有、未本地化） |
| 安全密钥 / PRF 解锁                     | 网页端实现已随 `apps/web` 删除，移植工作未开始                 | ❌                     |
| 定时备份                                | 无调度、无导出集成、无保留策略                                 | ❌                     |
| 可选 R2 / S3 同步（断网排队、联网补传） | 只有签名与合并两个纯函数                                       | ❌                     |
| 两端 `account.json` / 快照格式互通      | 无 `account.json` 生成与读取代码                               | ❌                     |

## 与计划文档自述的偏差

计划"执行状态（2026-11-24）"写的是"**未开始：阶段 2**"，但仓库已有 `f5bf2cf`、`ab94343` 两个阶段 2 提交（共享库骨架）。文档应更新为"阶段 2 已起步（约 12%），骨架无消费者"。其余自述（阶段 0/1 完成）与代码基本一致，仅"固定扩展 ID"一项此前曾被我怀疑，已用 SHA256 实算确认**正确**。

## 建议的下一步（有依赖顺序）

1. **补阶段 1 的护栏**：CI 加 `lint` / `test:types` / `jest` / `lint:dep-ownership` 四个 job——否则后面每个阶段都没有回归网。
2. **阶段 2 打通最小闭环**（必须先做，其余全部依赖它）：`create-local-account.service.ts` → 在扩展里能创建一个纯本地账户并解锁 → `cipher.service.ts` 的 create/update/delete 三分支 → 网络闸门挂到 `main.background.ts` 与弹出页 → 起始页路由。
3. **阶段 0 遗留验证**（可与 2 并行）：`chrome.storage.local` 容量、SDK 接受本地 V1 密钥状态、PRF 状态不被清、RP ID=扩展 ID 的 WebAuthn。
4. 阶段 2 闭环后按计划顺序推进 3 → 4 → 5 → 6 → 7。
5. 顺手清理：`electron-builder.beta.json` / `beta-release.json` / `pack:*:beta` 脚本、多浏览器构建脚本、`publisherDisplayName`、`native-messaging` 的主机名与扩展 ID。

## 2026-11-25 实施进展（覆盖上文结论）

| 阶段                 | 现在状态                                         | 主要证据                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 基线/改名/阻断项   | 完成                                             | 扩展 ID 由 manifest `key` 实算为 `gmobddgobjdhbjhedhgaeekhgchkoncm`；`updaterMain.init()` 不调用；`publish` 段已删                                                                                            |
| 1 瘦身               | 完成，另删 3 个依赖 `apps/web` 的 story 与其 mdx | `libs/auth/src/angular/input-password`、`libs/angular/.../registration-start`、`libs/vault/src/cipher-form`                                                                                                   |
| 2 本地保险库核心     | 完成（缺 PRF 相关）                              | `CreateLocalAccountService`、`DefaultLocalVaultWriter`（`CipherService` 9 处分支、`FolderApiService` 4 处、`fullSync`、`ImportService`）、`LocalPassApiService`、两端起始页与向导、PIN/登出/Send 护栏     |
| 3 桌面端接入         | 阻断项完成；调度待接                             | `com.localpass.desktop` 主机名、`ssoCookieMain.init` 关闭、`data.json.bak`                                                                                                                                |
| 4 R2 同步 + 定时备份 | 核心完成；设置页与两端接线待做                   | `s3-client.ts`（SigV4/条件写/分页）、`vault-backup-sync.service.ts`（清单 412 重试合并）、`vault-backup.service.ts`（导出上传/保留）、`vault-backup-scheduler.service.ts`（15s 防抖 / 30min 检查 / 日周节奏） |
| 5 Passkey / PRF      | 未开始                                           | ——                                                                                                                                                                                                            |
| 6 TOTP 二维码        | 未开始                                           | ——                                                                                                                                                                                                            |
| 7 打包发布           | 部分（CI 出未签名产物）                          | `.github/workflows/localpass.yml`                                                                                                                                                                         |

**CI 实测（首次推送）**：`verify-static` 报 19 个严格类型错误与 3 个 web 依赖残留，`Chrome 扩展` webpack 编译报 8 个同源错误；
已在 `09af6bf` 全部修正（`creationDate: Date`、`EncString` 双重断言、WebCrypto `ArrayBuffer` 视图、状态反序列化断言、组件相对路径、故事文件删除、导入测试路径改写）。

## 2026-11-26 追加：阶段 2–7 全部落地

| 阶段 | 交付物                                                                                               | 位置                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2    | 本地账户创建/恢复、本地写入器、网络闸门、起始页、PIN/登出/Send 护栏                                  | `libs/local-vault/src/account`、`src/vault`、`src/network`、`libs/angular/src/auth/local-vault`                                 |
| 3    | 原生消息改名、禁 SSO cookie、`data.json.bak`                                                         | `apps/desktop/src/main`、`apps/desktop/src/platform/main/storage`                                                               |
| 4    | S3 客户端、快照推送/拉取（清单 412 重试）、备份导出与保留、调度器、设置页、`account.json` 与云端恢复 | `libs/local-vault/src/s3`、`src/sync`、`libs/angular/src/tools/backup`、`src/auth/local-vault/restore-vault.component.ts`       |
| 5    | PRF 登记服务 + 设置页；解锁路径 RP ID 回退到扩展主机名                                               | `libs/key-management-ui/src/lock/services/local-webauthn-prf-enrollment.service.ts`、`apps/browser/src/auth/popup/security-key` |
| 6    | `otpauth-migration` 解码器（含单测）、导入页、TOTP 二维码组件与详情页弹窗                            | `libs/importer/src/importers/google-authenticator`、`libs/vault/src/components/totp-qr`、`.../totp-qr-dialog`                   |
| 7    | 扩展 zip 产物、安装与恢复文档                                                                        | `.github/workflows/localpass.yml`、`docs/LocalPass-安装与恢复.md`                                                       |

**CI 收敛记录**：类型检查 46 个项目多次全绿；eslint 从 19 项降到 0；prettier 基线通过一次性 `format.yml` + `chore/prettier` 分支合并建立；Chrome 扩展 webpack 构建成功。仍未跑完的是单元测试与桌面端打包（GitHub runner 排队 + 频繁推送触发 concurrency 取消）。

## 2026-11-26 收尾：CI 收敛完成

- 单测：全量 jest 首轮 9714 passed / 3 failed，三条失败（钓鱼默认值、创建时间类型、204 响应体）已修；改动范围门禁 2158 用例全绿。
- 静态：types/eslint/prettier/locales/dep-ownership 全绿（prettier 基线通过 `format.yml` + 合并 `chore/prettier` 建立）。
- 构建：Chrome 扩展 webpack 生产构建、桌面端 Windows NSIS 打包均成功；macOS 受 runner 排队限制，job 为 `continue-on-error`。
- 验证清单：新增 `docs/LocalPass-验证清单.md`，列出 CI 覆盖不到的人工验证步骤。

## 2026-11-26 最终核对

- `main` @ `fa224eb`：静态检查、改动范围单测（2158 用例）、Chrome 构建、Windows 打包四条全绿。
- macOS：`macos-14` 在本仓库会被立即取消（无 step），已改回 `macos-15` 排队；job 设 `continue-on-error`，不阻塞流水线。
- 文档格式由 `format.yml` → `chore/prettier` → 合并维护，避免手抄 prettier 输出。
- 人工验证清单：`docs/LocalPass-验证清单.md`（扩展 10 条 + 桌面 6 条 + 已知限制 3 条）。
