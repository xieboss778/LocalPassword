# LocalPassword（bitwarden/clients 二开）实施计划

> 生成日期：2026-11-24

## Context

你要在 bitwarden/clients 基础上做一个 Chrome 扩展 **LocalPassword**：

- 完全离线可用，不依赖任何密码管理服务器。
- 所有付费功能免费。
- 必须包含：Google 动态二维码、Passkey 与安全密钥、定时备份。
- 可选授权 Cloudflare R2：联网时自动同步，断网时排队，联网后补传。

已确认的决定：**只做本地保险库**（移除登录 Bitwarden / Vaultwarden 的入口）；附件排在必做功能之后；扩展名 LocalPassword。

上游现状（本地克隆 `main@0e54e98`，已逐项核实）：

- **保险库引擎是编译成 WASM 的 Rust SDK。** 条目、文件夹、导入、Passkey 的写入最终都由 SDK 向服务器发 HTTP。SDK 没有注入 HTTP 的接口，也没有“只写本地”的创建接口。
- **本地能力是齐的。** SDK 有本地加密（`ciphers().encrypt`）；`CipherService` 有 `upsert / replace / delete / softDelete / restore`；`FolderService` 有 `encrypt / upsert / delete`。
- **主密码解锁、主密码校验、导出解密都是纯本地操作。** 只有登录、注册、同步、写入需要服务器。
- **上游已有“用安全密钥 / Passkey（PRF）解锁”**，但登记功能只在网页端。
- **上游没有 Google Authenticator 导入**，扩展也不生成二维码。

## 总体设计

```
界面（弹出页 / 独立窗口）
   │  现有条目 / 文件夹 / 导入 / Passkey 流程
   ▼
本地写入分支 ──► 加密（SDK，本地）──► 本地状态（chrome.storage，密文）
   │                                   │
   └─► 待同步队列（断网时积压）          ▼
                          同步引擎（快照 + 按修改时间合并）
                                     │  仅在已授权且联网时
                                     ▼
                          Cloudflare R2 / 其他 S3 兼容存储（只存密文）

网络闸门：除存储服务和用户主动点击的泄露查询外，拦截所有出站请求
```

**五个关键决策**

1. **在 TypeScript 服务层加本地分支，不伪造服务器。** 写入收口在少数几个方法里，分支集中、改动小。伪造服务器行不通：SDK 的 HTTP 无法注入，而且任何 401/403 都会触发登出。
2. **本地账户复用上游“登录成功后”的状态。** 创建保险库时在本地生成全部密钥，再按登录流程的顺序写入同样的状态。之后锁定、解锁、PIN、自动填充全部沿用现有代码。
3. **R2 同步采用“快照 + 清单 + 按条目合并”。** 每次推送上传一份完整快照，用一个清单文件指向最新快照。拉取时逐条比较修改时间，新者胜；删除用“墓碑记录”传播，保证多台设备能收敛。
4. **R2 凭据用用户密钥加密后存储。** 浏览器扩展没有系统级安全存储（上游的访问令牌也是明文存放的），这是能做到的最好方式。自动同步只在保险库解锁时运行，所以够用。
5. **安全密钥的 WebAuthn 标识用扩展自己的 ID。** Chrome 团队的公开说明里，扩展始终可以用自己的 ID 作为 RP ID，不需要你提供域名。实施第一步会实测确认。

## 阶段 0：基线与验证

- **仓库。** 确认完整历史已拉取（未完成就重跑 `git fetch --unshallow`）；新建分支 `local-password`；添加 `upstream` 远源。不提交、不推送，除非你要求。
- **构建原版。** 根目录 `npm ci`，再 `npm run build:chrome`，产物在 `apps/browser/build`，用“加载已解压的扩展程序”确认原版可用。`npm ci` 会触发桌面端的 `electron-rebuild`，本机没有 Rust，如果它因此失败，我停下来问你。
- **改名 LocalPassword。**
  - `apps/browser/src/manifest.v3.json`：`short_name`、`author`、`homepage_url`。
  - `apps/browser/src/_locales/*/messages.json`：用脚本批量替换含 Bitwarden 的名称和描述，键名不变。
  - 图标目录 `apps/browser/src/images`、`apps/browser/src/popup/images` 先用占位图，你之后可随时替换。
  - 在 manifest 里固定 `key`，让扩展 ID 稳定（上游 `scripts/update-manifest-dev.sh` 的做法）。
  - 移除 `settings-v2.component.html` 里“下载 Bitwarden”“更多 Bitwarden 产品”等入口。
- **五个一次性验证。** 每个写临时测试，验证完删除。任何一个失败，我停下来报告并给出替代方案。
  1. SDK 接受本地生成的 V1 密钥状态，并且能加解密。
  2. 直接写入 `WEBAUTHN_PRF_OPTIONS` 状态后，SDK 初始化不会把它清掉。
  3. Chrome 接受“RP ID = 扩展 ID”的 WebAuthn 创建和读取，弹出页和独立窗口各试一次。
  4. `qrious` 能被 webpack 打包进扩展。
  5. 请求被拦截时不会触发登出。

## 阶段 1：本地保险库（离线核心）

**新代码**

- `libs/common/src/auth/services/local-account.service.ts`：本地账户标记，`isLocalAccount$(userId)`。状态键加在 `libs/state/src/core/state-definitions.ts`，新键不需要迁移。
- `libs/auth/src/common/local-account/create-local-account.service.ts`：创建和恢复共用的“写入登录后状态”逻辑。
- `libs/common/src/vault/services/local-vault/local-cipher.service.ts`：条目和文件夹的本地写入。
- `apps/browser/src/platform/services/local-password-api.service.ts`：网络闸门。
- `apps/browser/src/auth/popup/local-vault/`：起始页和“创建保险库”向导。

**创建保险库时写入的状态**（照 `libs/auth/src/common/login-strategies/login.strategy.ts:186-278` 的顺序）

- 账户记录。
- 环境：所有地址用哨兵 `https://vault.local.invalid`，通知地址用 `"http://-"`（上游自带的关闭开关）。
- 解锁选项 `hasMasterPassword: true`。缺了它，锁定会变成登出。
- 主密码解锁数据。
- 自签访问令牌：`sub` 是 GUID，带 `email` 和远期 `exp`。
- KDF 配置：沿用上游默认的 PBKDF2 600,000 次。
- `setHasPremium(true)`：付费功能全部开放。
- 密钥状态 `{ V1: { private_key } }`：用 `legacyCompatKeyService.makeKeyPair` 生成，仓库里 `key-connector.service.ts:270-309` 有同样的先例。
- 解锁，然后写入“上次同步时间”。

**本地写入**

- `libs/common/src/vault/services/cipher.service.ts` 加 7 处分支：`createWithServer`、`updateWithServer`、`moveManyWithServer`、`deleteWithServer`、`softDeleteWithServer`、`restoreWithServer`（811–945、1232、1259、1394、1442 行）。
- 本地实现：SDK 加密 → 补上原本由服务器给的字段（`id`、`creationDate`、`revisionDate`、`edit`、`viewPassword`）→ `upsert` 或 `delete` → 登记到待同步队列 → 返回解密后的条目。
- `libs/common/src/vault/services/folder/folder-api.service.ts:17-36`：`save` 和 `delete` 加同样的分支。
- `libs/common/src/platform/sync/default-sync.service.ts:126`：`fullSync` 开头加本地分支，只更新“上次同步时间”。弹出页要等这个值才显示条目列表（`vault-popup-items.service.ts:492`）。
- `libs/importer/src/services/import.service.ts:593-607`：`handleIndividualImport` 加本地分支，批量写入。

**网络闸门**

- `LocalPasswordApiService extends ApiService`，覆盖 `fetch`、`nativeFetch`、`nativeXMLHttpRequest`。只放行两类：已配置的存储服务地址；用户点击“检查密码是否泄露”时对 `api.pwnedpasswords.com` 的查询。
- 在 `apps/browser/src/background/main.background.ts:968-979` 和 `apps/browser/src/popup/services/services.module.ts:295` 替换原来的 `ApiService`。
- 关掉三个默认联网项：
  - 钓鱼网站列表下载（`phishing-detection-settings.service.ts:18-25`）。
  - 打开条目时的密码泄露检查（`default-cipher-risk.service.ts:60-85`，`checkExposed: false`）。
  - 网站图标（`domain-settings.service.ts:55`，默认关闭）。

**登录页改为起始页**

- `apps/browser/src/popup/app-routing.module.ts`：把登录路由（534–562 行）和注册路由（481–510 行）指向新的起始页。
- 起始页提供三个入口：创建保险库、从 R2 恢复、从备份文件导入。
- 向导不调用上游的“新密码泄露检查”。

**安全护栏**

- 连续输错 PIN 不再登出（`libs/key-management-ui/src/lock/components/lock.component.ts:533-549`），改为递增等待。
- 登出前弹确认框，说明会清空本机全部数据，并提供“先导出”（`apps/browser/src/auth/popup/logout/extension-logout.service.ts`）。
- 本地账户隐藏 Send 标签（`apps/browser/src/popup/tabs-v2.component.ts:64-100`）、管理设备、两步登录等依赖服务器的入口。
- 不再执行登录后的强制同步（`default-login-success-handler.service.ts:19-34`），不再提示“升级到 V2 加密”。
- 修改主密码（`libs/angular/src/auth/password-management/change-password/default-change-password.service.ts:94`）：服务器调用换成在本地用新密码重新包装用户密钥。不轮换密钥，旧备份仍能用旧密码打开，界面上注明。

## 阶段 2：R2 同步与定时备份

**新库 `libs/tools/vault-backup-core`**，包名 `@bitwarden/vault-backup-core`，照 `libs/tools/export-vault-core` 的结构。

- `s3-client.ts`：自己用 WebCrypto 实现 AWS SigV4 签名，不新增依赖。支持 GET、带条件的 PUT、DELETE、ListObjectsV2。
  - Cloudflare R2 预设：端点按账户 ID 和辖区拼接，region 为 `auto`。
  - 通用 S3 兼容：自定义端点、region、路径风格。MinIO、Backblaze B2、阿里云 OSS、腾讯云 COS 都走这一套。
- `vault-backup-sync.service.ts`：同步引擎。
- `vault-backup-scheduler.service.ts`：定时备份和保留数量。
- 状态键 `StateDefinition("vaultBackup", "disk")`：配置（密文）、待同步队列、墓碑、同步状态、备份设置。

**“授权 Cloudflare”的实际形式**

Cloudflare 没有第三方登录授权流程。做法是：你在 Cloudflare 控制台创建一个 R2 API 令牌（建议限定为单个存储桶、对象读写），然后把账户 ID、Access Key ID、Secret Access Key、存储桶名填进设置页。设置页提供跳转链接和步骤说明。

**R2 上的对象**（前缀 `<存储桶>/<自定义前缀>/<用户ID>/`，全部是密文）

- `account.json`：KDF、主密码包装的用户密钥、密钥状态、安全密钥解锁数据。换设备恢复时用。
- `manifest.json`：指向最新快照。
- `snapshots/<快照ID>.json`：全部条目、文件夹、墓碑。
- `backups/<年-月>/<时间戳>.json`：定时备份，标准 Bitwarden 加密 JSON 格式。

**同步算法**

- **推送**：从本地状态生成快照 → 上传 → 用 `If-Match` 条件更新清单。清单被别的设备改过（返回 412）就先拉取合并再重试，最多 3 次。成功后才清空待同步队列。
- **拉取**：读清单，有变化就下载快照，逐条按 `revisionDate` 合并到本地。
- **触发时机**：本地写入后 15 秒防抖；解锁后；打开弹出页（5 分钟节流）；点击“立即同步”；每 30 分钟一次定时检查。未授权、未解锁或离线时跳过，队列保留到下次。
- **冲突**：同一条目多台设备都改过时，修改时间新的胜出。界面上说明这一规则。

**定时备份**

- 默认每天一次，可改为每周或关闭。在已授权、已解锁、联网时执行；否则跳过，解锁后补做。
- 内容用上游现成的 `IndividualVaultExportService.getPasswordProtectedExport`（`libs/tools/export-vault-core/src/services/individual-vault-export.service.ts:74`）。
- 备份口令：启用时随机生成，用用户密钥加密保存，设置页可查看和复制。恢复到任何 Bitwarden 客户端都要用它。
- 按保留数量清理旧备份，默认保留 10 份。

**恢复**

- **从 R2 恢复**（新设备）：填写 R2 凭据 → 下载 `account.json` → 输入主密码 → 本地解出用户密钥 → 写入登录后状态 → 拉取全部条目。
- **从文件恢复**：先创建空保险库，再用现有导入页导入备份文件，走阶段 1 的本地导入。

**设置页**：`apps/browser/src/tools/popup/settings/backup/`，入口加在 `vault-settings.component.html`。内容包括配置表单、测试连接、同步状态、立即同步、立即备份、定时开关、备份列表、备份口令、断开。

**注册到扩展**

- `libs/scheduling/src/scheduled-task-name.enum.ts` 加两个任务名。
- `MainBackground` 构造这两个服务并注册任务处理，在 `bootstrap()` 里设置定时间隔。
- `services.module.ts` 的 `safeProviders` 里注册弹出页用的版本。
- 耗时操作在后台执行：`apps/browser/src/background/runtime.background.ts` 的 `messagesWithResponse` 加命令，弹出页用 `BrowserApi.sendMessageWithResponse` 调用，进度和结果写入状态。这样关掉弹出页也不会中断上传。

## 阶段 3：Passkey 与安全密钥

**为网站保存 Passkey**

- `libs/common/src/platform/services/fido2/fido2-authenticator.service.ts` 的 4 处服务器调用（111–117、195、259–269、321–335 行）都走 `cipherService.updateWithServer` 和 `syncService.fullSync`，阶段 1 完成后自动变成本地操作。这个阶段做端到端验证。

**用安全密钥 / Passkey 解锁保险库**

- **登记（新）**：把网页端 `apps/web/src/app/auth/core/services/webauthn-login/webauthn-login-admin.service.ts:113-178` 的 `createCredential` 和 `createKeySet` 移植为共享服务 `libs/key-management-ui/src/lock/services/local-webauthn-prf-enrollment.service.ts`。选项在本地构造，RP ID 用扩展 ID。复用已有的 `WebAuthnLoginPrfKeyService`（盐是常量）和 `RotateableKeySetService.createKeySet`。
- **存储**：结果写入 `WEBAUTHN_PRF_OPTIONS`（`libs/common/src/key-management/state-definitions.ts:120`）。
- **解锁**：沿用上游的 `UnlockViaPrfComponent` 和 `DefaultWebAuthnPrfUnlockService`。`default-webauthn-prf-unlock.service.ts:249-269` 的 RP ID 改为直接取扩展 ID。
- **设置页**：`apps/browser/src/auth/popup/settings/` 新增“安全密钥 / Passkey 解锁”页，支持列表、添加、删除。入口加在 `account-security.component.html` 的解锁方式区。
- **多设备**：解锁数据随 `account.json` 同步，同一把钥匙在新设备上可用。
- **弹出页被关闭的情况**：如果 Chrome 弹出系统验证框时关闭了弹出页，就改成在独立窗口里完成（仓库已有弹出窗口工具）。

## 阶段 4：Google 动态二维码

**从 Google Authenticator 导入**

- 解析器放在 `libs/importer/src/importers/google-authenticator/`：解码“导出账号”二维码里的 `otpauth-migration://offline?data=...` 数据（protobuf 格式），用小型手写解码器，不新增依赖。
- 页面放在 `apps/browser/src/tools/popup/settings/import/`，入口加在 `vault-settings.component.html`。
- 三种输入：选二维码图片（可多张）、粘贴那段 URI、截取当前标签页。二维码识别复用 `qrcode-parser` 和 `BrowserApi.captureVisibleTab`。
- 流程：解析 → 预览（发行方、账号）→ 批量创建带动态口令的登录条目（复用阶段 1 的批量本地写入）。按_secret_ 去重。
- 基于计数器的 HOTP 条目 Bitwarden 不支持，跳过并提示数量。

**生成二维码**

- 新组件 `apps/browser/src/vault/popup/components/cipher-view/totp-qr.component.ts`，用已有依赖 `qrious`。条目详情里加“显示二维码”，扫码即可加入 Google Authenticator。阶段 0 验证不通过的话，换一个小型 ESM 库。

**动态口令免费**：本地账户已标记为付费，自动填充、右键“复制验证码”、详情页显示都开放。这个阶段做端到端验证。

## 阶段 5：打包

- `npm run dist:chrome` 产出 `dist-chrome.zip`，附安装说明。
- Chrome 官方文档写明：macOS 上外部安装的更新地址必须指向应用商店。所以只能用开发者模式“加载已解压的扩展程序”安装，或上架商店。
- 附数据安全说明：没有服务器，数据只在本机；建议尽早授权 R2 或定期导出。

## 复用的现有代码

| 用途 | 位置 |
|---|---|
| 本地加密 | `DefaultCipherEncryptionService.encrypt / encryptMany` |
| 本地读写 | `CipherService.upsert / delete / softDelete / restore`、`FolderService.encrypt / upsert / delete` |
| 生成密钥对 | `LegacyCompatKeyService.makeKeyPair` |
| 本地校验主密码 | `DefaultMasterPasswordUnlockService.proofOfDecryption` |
| 加密导出 | `IndividualVaultExportService.getPasswordProtectedExport` |
| 加密导出的导入 | `bitwarden-password-protected-importer.ts` |
| 定时任务 | `ScheduledTaskNames`、`TaskSchedulerService` |
| 请求拦截 | `ApiService.addMiddleware` |
| 安全密钥解锁 | `DefaultWebAuthnPrfUnlockService`、`UnlockViaPrfComponent`、`RotateableKeySetService` |
| 二维码识别、生成 | `qrcode-parser`、`qrious`（都已是依赖） |
| 设置页模板 | `export-browser-v2.component.ts`、`import-browser-v2.component.ts` |
| 文案 | `apps/browser/src/_locales/*/messages.json`，中文用 `zh_CN`，缺的键自动回退到英文 |

## 验证

**自动化**

- 每个新模块配单元测试：创建后能用正确密码解锁、错误密码失败；本地增删改后的条目能被 SDK 正确解密；SigV4 签名与 AWS 官方测试向量一致；快照合并的各种情况（新增、修改、删除、冲突）。
- 每个阶段结束跑：`npm run lint`、`npm run test:types`、`npm run lint:dep-ownership`、`npm test`、`npm run build:prod:chrome`。

**手动（全程断网）**

1. 创建保险库，锁定后用主密码解锁，重启浏览器后仍可解锁。
2. 增删改条目和文件夹，回收站，自动填充。
3. 在测试网站上创建并使用 Passkey。
4. 截图添加动态口令，导入 Google Authenticator 二维码，显示二维码。
5. 登记安全密钥，锁定后用它解锁。
6. 开发者工具的网络面板设为“离线”再操作一遍，功能不受影响；恢复联网后确认没有任何发往 `bitwarden.com` 的请求。

**R2（需要你提供一个测试用的 R2 令牌和存储桶）**

1. 配置并测试连接。
2. 修改条目后确认自动上传；断网修改，联网后确认补传。
3. 两个 Chrome 配置文件模拟两台设备，确认双向同步和冲突规则。
4. 等待或手动触发定时备份，用备份口令在另一个客户端导入成功。
5. 在全新配置文件里走“从 R2 恢复”。

## 风险与对策

- **Rust SDK 是黑盒。** 本地生成的条目和密钥状态必须与服务器生成的格式一致。靠阶段 0 的验证和“导出后再导入”交叉验证；失败就停下来给你替代方案。
- **服务器下发的功能开关默认全关。** 可能有少数界面功能不显示。测试时逐个确认，确实需要的在本地给默认值。
- **MV3 后台会被浏览器随时终止。** 上传中断后队列不清空，下次触发自动重试；每次推送上传新快照，重试不会造成损坏。
- **修改主密码不轮换密钥。** 旧备份仍能用旧密码打开。真正的密钥轮换放到附件之后的阶段。
- **上游变动很快。** 改动尽量收在新文件里，对上游文件的改动保持最小；后续按版本号合并上游，而不是追 `main`。
- **许可。** 上游默认 GPL-3.0，分发时需公开源码；`bitwarden_license/` 目录是另一套许可，本计划不触碰。

## 不在本次范围

- 离线附件（必做功能完成后的下一阶段）。
- WebDAV（S3 兼容已覆盖大部分私有存储，有需要再加）。
- HOTP（基于计数器）条目。
- 桌面端、网页端、CLI 的改动（只做 Chrome 扩展）。
