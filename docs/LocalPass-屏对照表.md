# LocalPass 屏对照表（AGY Compact v4 · 73 屏 ↔ 代码实现）

> 更新：2026-11-28　｜　目标原型：[design-system/agy/index.html](../design-system/agy/index.html)（共 **73** 屏：联动 `1` + 桌面 `29` + 扩展 `29` + 网页内联 `14`）
>
> 本表是原型向客户端落地的唯一清单：说明每一屏在代码中的落点与当前完成状态。
> 状态含义：**✅ 已按目标对齐** / **◐ 已实现旧版(`ui-redo-d`)或有交互缺口，待按 AGY 细化升级** / **⬜ 目标新增屏，尚未在产品代码中实现**。
>
> 设计规范见 [LocalPass-界面规范.md](./LocalPass-界面规范.md)；人工验证步骤见 [LocalPass-验证清单.md](./LocalPass-验证清单.md)。

---

## 一、三端联动沙盒（1 屏）

| 原型 ID (`app.js`) | 原型名称         | 实现落点                                                                                 | 现状 | 说明 / 缺口                                                                              |
| ------------------ | ---------------- | ---------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `link-sandbox`     | 三端实时联动沙盒 | 原型联动演示沙盒（对应 `com.localpass.desktop` Native Messaging 跨端解锁与本地写入刷新） | ⬜   | 跨端解锁已有原生消息基础；页面改密实时版本联动与三端一体化联动仍按分端各自路径待联调补全 |

---

## 二、Mac / 桌面端（29 屏）

| 原型 ID                 | 原型名称                   | 实现落点                                                                   | 现状 | 说明 / AGY 对齐差距                                                                                                            |
| ----------------------- | -------------------------- | -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| `mac-vault`             | 保险库 · 三栏工作台        | `VaultDesktopV2Component` (`apps/desktop/src/vault/app/vault-desktop-v2/`) | ◐    | 已有深蓝 rail + 列表 + 右栏；待按 AGY 升级 4px 紧凑栅格、检查器常驻、确认第二栏无 TOTP/详情无「复制主要值」/无绑定二维码卡片   |
| `mac-empty`             | 空保险库 · 引导出口        | `VaultDesktopV2Component` 空态分支                                         | ◐    | 已有新建/导入/恢复出口；样式待对齐 AGY                                                                                         |
| `mac-quick-access`      | 快速检索 · `⌘K`            | 未实现（原桌面仅有列表内搜索框）                                           | ⬜   | AGY 新增：应用内 `⌘K` 检索浮窗（无系统全局热键）、全字段 + `=totp` / `=ssh` 语法                                               |
| `mac-tray`              | 菜单栏托盘弹窗             | `apps/desktop/src/main/tray.main.ts`（仅有基础托盘菜单）                   | ⬜   | `300×380` 独立快捷托盘弹出面板尚未实现                                                                                         |
| `mac-history`           | 版本历史 · 后悔药          | `libs/vault/src/cipher-view/item-history/`（密码历史已有，整条版本栈无）   | ⬜   | 仅登录密码有旧值历史；8 类条目级版本回滚栈（`vN` diff 与还原）未实施                                                           |
| `mac-new`               | 新建条目 · 8 类动态表单    | `NewItemV2Component` + `ItemFormV2Component`（共享抽屉）                   | ◐    | 已有 8 类选型与表单；**待按 AGY 升级：所有默认字段支持删改找回、自定义字段增删、枚举 `<select>`+自定义、卡有效期单个 `MM/YY`** |
| `mac-form`              | 编辑条目 · 默认/自定义增删 | `ItemFormV2Component`（桌面右侧抽屉）                                      | ◐    | 同上，待接入可删除默认字段胶囊机制与新版表单规则                                                                               |
| `mac-item-delete`       | 删除确认 · 软删防误触      | `VaultDesktopV2Component` 删除确认弹窗                                     | ◐    | 已有软删移入回收站；待补 5 秒底部撤销 Toast 与 `Delete`/`⌘⌫` 一致反馈                                                          |
| `mac-folders`           | 文件夹管理                 | `FoldersV2Component` (`libs/angular/src/tools/folders/`)                   | ◐    | 已可用（保留悬停编辑/删除）；待对齐 AGY 紧凑行高                                                                               |
| `mac-archive`           | 已归档条目                 | `CipherService` 已有底层数据支持，**桌面 UI 无入口**                       | ⬜   | AGY 新增独立归档列表与「取消归档」入口，待实现                                                                                 |
| `mac-trash`             | 回收站 · 30 天             | `TrashDesktopV2Component`                                                  | ◐    | 功能可用，待对齐 AGY 紧凑密度与撤销交互                                                                                        |
| `mac-health`            | 安全体检 · 离线规则        | 服务层无完整桌面健康视图                                                   | ⬜   | AGY 新增离线规则检查（重复/超 365 天/弱密码/缺 2FA）与可选 HIBP 前缀比对页                                                     |
| `mac-generator`         | 生成器与侧栏历史           | `GeneratorV2Component` (`libs/angular/src/tools/generator/`)               | ◐    | 已可用；待对齐 AGY 字符着色、20 位默认强密码与双栏历史联动                                                                     |
| `mac-generator-history` | 生成历史 · 锁库即焚        | `GeneratorHistoryV2Component`                                              | ◐    | 已可用；需确认锁库即清空内存与统一明文掩码交互                                                                                 |
| `mac-import`            | 导入来源选择               | `ImportLandingDesktopV2Component`                                          | ◐    | 已接入（1PUX/JSON/CSV）；桌面独立 Google Authenticator 扫码/截图入口待与扩展对齐                                               |
| `mac-import-preview`    | 导入去重预览               | `ImportLandingDesktopV2Component` 预览分支                                 | ◐    | 预览可展示检测项，但当前桌面导入预览未去重（重复数恒为 0）                                                                     |
| `mac-export`            | 多格式导出                 | `ExportDesktopV2Component`                                                 | ◐    | 支持加密 JSON / 明文 JSON / CSV 与安全密码校验；待对齐 AGY 风险提示细节                                                        |
| `mac-sync`              | R2 同步与设备状态          | `BackupSettingsV2Component` + `BackupStatusDesktopV2Component`             | ◐    | 当前代码仅支持**手动同步 / 手动导出**；AGY 展示的设备列表、自动去抖与状态面板对应同步 v2 待实施目标                            |
| `mac-conflict`          | 冲突解决 · 并排比对        | `libs/local-vault/src/sync/snapshot-merge.ts`（当前仅按时间自动判胜负）    | ⬜   | 并排三选一（保留本机 / 保留远端 / 各存一份）交互界面尚未实现                                                                   |
| `mac-backup-config`     | R2 存储与 CORS 配置        | `BackupSettingsV2Component`（桌面布局）                                    | ◐    | 已有端点/桶/密钥配置与测试连接；待补一键 R2 CORS JSON 指引展开区                                                               |
| `mac-restore`           | 从 R2 云存储恢复           | `RestoreVaultV2Component`（桌面布局）                                      | ✅   | 已复用桶根 `account.json` v2（一桶一库，无前缀字段）恢复                                                                       |
| `mac-network`           | 网络闸门                   | `NetworkGateDesktopV2Component`                                            | ◐    | 底层 `gate-policy.ts` 已是 Default Deny；界面需对齐「仅授权白名单 + 默认拒绝守则」，不列静态遥测黑名单                         |
| `mac-data`              | 数据与安全边界             | `DataSafetyDesktopV2Component`                                             | ◐    | 已可用；保留「导出加密备份」入口并对齐二次危险确认                                                                             |
| `mac-settings`          | 设置中心 · 应用内键位      | `SettingsDesktopV2Component`                                               | ◐    | 安全/外观/同步/关于已存在；「安全密钥管理 / 外观语言更改 / **可删除的应用内快捷键映射标签页**」仍缺口待补                      |
| `mac-about`             | 关于、更新日志与诊断       | `SettingsDesktopV2Component` 关于子页                                      | ◐    | 已有基础信息；待补零敏感离线自检报告导出面板                                                                                   |
| `mac-unlock`            | 锁定窗口                   | `LockComponent`（共享）                                                    | ◐    | 已可用；待对齐 AGY 布局与错误提示文案                                                                                          |
| `mac-unlock-wait`       | 连错等待防暴力             | `LockComponent` PIN / 递增等待分支                                         | ✅   | 连错只递增等待，**不登出、不清数据**                                                                                           |
| `mac-security-key`      | 平台能力说明 · PRF         | `SettingsDesktopV2Component` 安全说明                                      | ✅   | 明确说明 WebAuthn PRF 仅扩展可用，macOS 桌面走 Touch ID / Windows Hello                                                        |
| `mac-setup`             | 首次建库 / 三入口恢复      | `CreateLocalVaultComponent`                                                | ◐    | 三入口（建库 / 导入 / R2 恢复）已可用；待对齐 AGY 紧凑表单样式                                                                 |

---

## 三、Chrome 扩展弹窗（29 屏）

| 原型 ID                 | 原型名称                   | 实现落点                                                                          | 现状 | 说明 / AGY 对齐差距                                                                                               |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `ext-list`              | 保险库列表 · `380×600`     | `VaultListV2Component` (`apps/browser/src/vault/popup/components/vault-list-v2/`) | ◐    | 已有站点匹配置顶与列表；**待按 AGY 去除列表中 2FA 动态验证码、压缩行高至 36px/32px 并支持悬停一键填充**           |
| `ext-empty`             | 空保险库 · 3 出口          | `VaultListV2Component` 空态分支                                                   | ◐    | 已有新建 / 导入 / R2 恢复 3 出口                                                                                  |
| `ext-detail`            | 条目详情 · 固定底栏        | `apps/browser/src/vault/popup/components/item-view-v2/item-view-v2.component.ts`  | ◐    | **待按 AGY 移除底部冗余「复制主要值」按钮**，主动作聚焦「填充到当前网页 / 编辑字段」，完整渲染自定义字段          |
| `ext-item-more`         | 更多操作 · 底部动作单      | `item-view-v2` 更多动作半层弹窗                                                   | ◐    | 已有二维码/编辑/删除等；待对齐收藏星标与「归档」动作项                                                            |
| `ext-totp-qr`           | 动态口令 · 二维码页        | `TotpQrV2Component` (`apps/browser/src/vault/popup/components/totp-qr-v2/`)       | ✅   | 本机 Canvas / `qrious` 绘制，不触网                                                                               |
| `ext-new`               | 新建 · 8 类选型            | `NewItemV2Component` (`libs/angular/src/tools/item-entry/`)                       | ◐    | 已有 8 类 4×2 选型网格；待与新表单链路衔接                                                                        |
| `ext-form`              | 新建 / 编辑 · 动态表单     | `ItemFormV2Component` (`libs/angular/src/tools/item-entry/`)                      | ◐    | **待按 AGY 补齐：8 类默认字段实时删除/胶囊加回、自定义字段增删掩码、有限枚举下拉+自定义、卡片有效期单框 `MM/YY`** |
| `ext-generator`         | 生成器与侧栏历史           | `GeneratorV2Component` (`apps/browser/src/tools/popup/generator/`)                | ◐    | 已可用；待对齐 AGY 密度与配色                                                                                     |
| `ext-generator-history` | 本机生成历史               | `GeneratorHistoryV2Component`                                                     | ◐    | 已可用                                                                                                            |
| `ext-folders`           | 文件夹管理                 | `FoldersV2Component`                                                              | ◐    | 已可用                                                                                                            |
| `ext-archive`           | 已归档条目                 | 未实现独立扩展页面                                                                | ⬜   | AGY 新增归档列表与恢复入口                                                                                        |
| `ext-trash`             | 回收站 · 30 天             | `TrashV2Component` (`apps/browser/src/vault/popup/components/trash-v2/`)          | ◐    | 已可用；待对齐 30 天文案与撤销反馈                                                                                |
| `ext-health`            | 离线安全体检               | 未实现独立扩展页面                                                                | ⬜   | AGY 新增弱/重复/超期/缺 2FA 扫描列表与一键直达编辑页                                                              |
| `ext-import`            | 导入来源（含 1PUX）        | `ImportSourceV2Component` + `GoogleAuthImportV2Component`                         | ◐    | 已实现；待对齐统一入口排版与 1PUX/CSV 引导                                                                        |
| `ext-import-preview`    | 导入去重预览               | `ImportPreviewV2Component`                                                        | ◐    | 已有预览统计与校验项                                                                                              |
| `ext-export`            | 导出备份（含 CSV）         | `ExportBrowserV2Component`                                                        | ◐    | 已可用；待对齐明文 CSV 警告层级                                                                                   |
| `ext-sync`              | 同步与跨端状态             | `BackupSettingsV2Component`（扩展设置挂载）                                       | ◐    | 现状仅手动同步；AGY 中的自动化开关/待传计数与冲突入口对应同步 v2 目标设计                                         |
| `ext-backup-config`     | R2 存储与 CORS 配置        | `BackupSettingsV2Component` 配置视图                                              | ◐    | 已可用                                                                                                            |
| `ext-restore`           | 从 R2 云存储恢复           | `RestoreVaultV2Component`                                                         | ✅   | 已复用桶根 `account.json` v2 恢复                                                                                 |
| `ext-settings`          | 设置一级页                 | `SettingsListV2Component`                                                         | ◐    | 已有核心分组入口；需确认扩展设置使用「安全密码」术语规范                                                          |
| `ext-security`          | 安全设置                   | `SecuritySettingsV2Component`                                                     | ◐    | 已有自动锁定/剪贴板清除/PIN                                                                                       |
| `ext-security-key`      | WebAuthn PRF 安全密钥      | `SecurityKeyComponent` (`apps/browser/src/auth/popup/security-key/`)              | ✅   | 已有 PRF 登记、等待硬件触摸态与解锁                                                                               |
| `ext-appearance`        | 外观与紧凑密度             | `AppearanceV2Component`                                                           | ◐    | 已有亮暗主题/图标微标；AGY 新增「紧凑 / 极紧」密度切换待落地                                                      |
| `ext-network`           | 网络闸门                   | `NetworkGateV2Component` (`apps/browser/src/tools/popup/settings/localpass/`)     | ◐    | `gate-policy.ts` 逻辑正确；文案与展示对齐 Default Deny + 仅白名单（不写虚假拦截清单）                             |
| `ext-data`              | 数据与安全                 | `DataSafetyV2Component`                                                           | ◐    | 已可用；二次危险确认锁定清晰                                                                                      |
| `ext-about`             | 关于与零敏感诊断           | `AboutV2Component`                                                                | ◐    | 已可用；待补 AGY 零敏感诊断清单视图                                                                               |
| `ext-unlock`            | 解锁（含桌面触控 ID 代理） | `LockComponent` + 原生消息桥接                                                    | ◐    | 密码/PIN/PRF 已可用；经 `com.localpass.desktop` 向扩展代理桌面 Touch ID 仍需联动调优                              |
| `ext-unlock-wait`       | 连错等待防暴力             | `LockComponent`                                                                   | ✅   | 连错递增等待，不登出不清库                                                                                        |
| `ext-setup`             | 首次创建保险库             | `CreateLocalVaultComponent`                                                       | ◐    | 三入口就绪；待对齐 AGY 紧凑风格                                                                                   |

---

## 四、网页内联联动（14 屏）

| 原型 ID              | 原型名称                       | 实现落点                                                                                          | 现状 | 说明 / AGY 对齐差距                                                                            |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `web-login`          | 登录内联菜单 · 账户优先        | `apps/browser/src/autofill/content/components/inline-menu/login-menu.ts` + `overlay/inline-menu`  | ◐    | 已有账户建议与 Passkey 展示；**待按 AGY 去除账户行右侧 2FA 验证码徽标、补齐生成/扩展搜索底栏** |
| `web-no-match`       | 新站点无凭据 · 首次引导        | `apps/browser/src/autofill/content/components/inline-menu/empty-state.ts` (`totalAccounts === 0`) | ✅   | 已有零条目空态提示与新建入口，样式待对齐 AGY                                                   |
| `web-inline-empty`   | 过滤无匹配 · 内联空态          | `empty-state.ts`（过滤无结果分支）                                                                | ✅   | 已有全站总条目提示与清除筛选退路                                                               |
| `web-totp`           | 验证码内联 · 填充与确认胶囊    | `autofill/overlay/inline-menu` + TOTP 卡片                                                        | ◐    | 已有 2FA 内联建议；AGY 的填充后 38px 收窄确认胶囊（含秒数+撤销）待对齐                         |
| `web-card-identity`  | 结账银行卡与身份内联           | `autofill/overlay/inline-menu`（卡片/身份建议列表）                                               | ◐    | 底层支持卡片/身份填充；AGY 的「默认项置顶 + 尾号掩码卡片行（含 `09/29` 格式）」待逐项走查      |
| `web-passkey`        | 通行密钥 · 条件式登录          | `apps/browser/src/autofill/fido2/` + `inline-menu`                                                | ✅   | 本地 Passkey 创建与断言已实现；确认态透明度待与 AGY 对齐                                       |
| `web-register`       | 注册 / 改密强密码建议          | `autofill/overlay/inline-menu` 强密码生成器菜单                                                   | ◐    | 已有密码生成内联行；AGY 分色预览与点击即弹右上角保存条待联动                                   |
| `web-save-new`       | 首次保存新登录 · 文件夹与排除  | `apps/browser/src/autofill/content/components/notification/container.ts` (`Add`)                  | ◐    | 已存在保存通知容器；文件夹即席切换与 AGY 样式待对齐                                            |
| `web-save-bar`       | 更新密码确认条                 | `notification/container.ts` (`Change`)                                                            | ◐    | 已有更新条；主按钮「更新条目 (vN)」版本号展示待版本历史链路齐备后接入                          |
| `web-multi-save`     | 多账户保存 · 精确选择目标      | `notification/container.ts` 多账号匹配分支                                                        | ⬜   | 同域多账号精确单选 + 「存为第 N 条新条目」确认交互尚未完整对齐                                 |
| `web-save-confirm`   | 保存成功确认态                 | `notification/container.ts` (`isConfirmation`)                                                    | ◐    | 已有确认态标志；AGY 绿色成功卡 +「补充 2FA / 编辑条目」出口待对齐                              |
| `web-at-risk`        | 弱/重用密码网页改密提醒        | `apps/browser/src/autofill/content/components/notification/at-risk-password/container.ts`         | ◐    | 已有组件骨架；需与本地体检规则结果全面打通并隐藏无关内联胶囊                                   |
| `web-autofill-toast` | 填充回执与撤销卡               | 填充后右下角非侵入回执                                                                            | ⬜   | AGY 新增右下角 `320px` 一键撤销清空表单回执卡                                                  |
| `web-unlock`         | 内联就地解锁（含 Mac 触控 ID） | `inline-menu` 锁定分支 + 原生消息代理                                                             | ◐    | 原地密码解锁已有；一键桥接 Mac Touch ID 解锁体验待联调                                         |

---

## 五、完成标准与已知差异

### 落地完成标准

1. **73 屏全覆盖对齐**：`design-system/agy/` 中列出的核心布局、紧凑密度（`4px` 栅格 / `30px` 字段行 / `36px` 列表行）与新增入口（归档、体检、冲突并排选择、应用内 `⌘K`、网页全部 14 态）均可在产品中真实走通。
2. **严格遵守交互底线**：
   - 桌面列表、Quick Access、扩展列表与网页内联登录行不展示 TOTP 动态验证码；
   - 桌面登录详情不内联展示 Google 验证器绑定二维码；
   - 桌面与扩展详情页不出现「复制主要值」冗余按钮；
   - 8 类表单均支持默认字段与自定义字段增删、有限枚举下拉+自定义，且**卡片有效期使用 `MM/YY` 单框**；
   - 设置键位取消系统全局热键监听，支持应用内键位删除；
   - 网络闸门不列出虚假遗留拦截域名清单，坚持 Default Deny + 锁库 0 出站。
3. **工程门禁全绿**：`npm run lint`、`npm run test:types`、`npm test`（改动范围相关单测）、`build:chrome` 与桌面端构建全部通过。

### 既有已知差异 / 保留事项

| #   | 差异项                                       | 说明与处理方式                                                                                          |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | `ui-redo-d`（58 屏）→ AGY（73 屏）的增量入口 | 归档、离线安全体检、完整版本历史栈、冲突并排比对、应用内 `⌘K` 与托盘面板目前多数标为 `⬜`，需按批次补齐 |
| 2   | 桌面导入去重与独立 Google 认证器导入页       | 当前桌面导入预览重复数恒为 0，且 Google 认证器导入入口需与扩展统一增强                                  |
| 3   | 桌面端 WebAuthn PRF 与外观语言入口           | PRF 安全密钥在桌面不适用（保持仅说明、不伪装支持）；桌面「已登记安全密钥管理 / 语言切换」待补           |
| 4   | 术语与安全掩码保护                           | 扩展设置继续遵循「安全密码」（不出现向服务器「登录 / 注册」），重提示 TOTP 在网页内联保持安全掩码不泄密 |
| 5   | 原型与产品的严格隔离                         | `design-system/agy/` 数据全为合成值，绝不把原型假数据、内联演示状态写入产品构建或持久化存储             |
