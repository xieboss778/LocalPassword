# LocalPass 实现计划（按 prototype/ui-redo-c 定稿原型落地）

定稿原型：`prototype/ui-redo-c/`（分支 `prototype/ui-redo-c`，自检 `node prototype/ui-redo-c/check.js`）。
界面语言与规则：`docs/LocalPass-界面规范.md`。本文只管「怎么落成代码」。

## 0. 不变式（实现时不许破的六条）

1. **没有账号语义**：全程无注册/登录/账号字样；首次是「设置安全密码」，邮箱仅作本机派生密钥。
2. **备份纯手动**：进程内不得出现定时器；任何写入都不触发上传。
3. **Touch ID 仅 macOS**，入口只在「设置 → 安全」；扩展侧永不出现。
4. **点行即复制**，不设「复制密码」按钮、不给 `⌘C`；浮层 + 行高亮 + ✓ 三重反馈。
5. **一次只允许一个主按钮**；危险操作白底红边、放页尾。
6. **加密不变**：8 类条目共用同一套 SDK 加密与状态键，新增类型不得引入新的存储格式。

## 1. 已落地（本轮）

| 交付                                                                | 位置                                          | 状态                                        |
| ------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| 设计令牌（颜色/圆角/品牌色/焦点环）                                 | `libs/angular/src/local-ui/local-ui.scss`     | ✅ 已接入 browser popup 与 desktop 全局样式 |
| UI 原语：`lp-page-header` `lp-group` `lp-row` `lp-empty` `lp-toast` | `libs/angular/src/local-ui/`                  | ✅ 类型检查 / eslint / prettier 全绿        |
| 点行复制与三重反馈                                                  | `lp-row.component.ts` + `lp-toast.service.ts` | ✅ 剪贴板写失败也照常给反馈                 |

`lp-row` 是整站的基本单元：右端只允许「值 / 开关 / chevron / 复制提示」之一，复制行为内置。

## 2. 需要先拍板的一件事：8 类 vs 4 类

存储层只有 4 个 `CipherType`（登录 / 卡片 / 身份 / 笔记），原型要 8 类。三条路：

| 方案                                   | 代价                                   | 兼容性                              |
| -------------------------------------- | -------------------------------------- | ----------------------------------- |
| A. 扩展 `CipherType` + SDK             | 要改 SDK、状态格式、导入导出映射       | 破坏与 Bitwarden 格式的互操作       |
| **B. 原生 4 类 + `kind` 标记（推荐）** | 在 `libs/local-vault` 加一层 kind 映射 | 完全兼容（导出仍是 Bitwarden JSON） |
| C. 全部塞进笔记 + 自定义字段           | 丧失原生字段语义                       | 兼容但体验退化                      |

**推荐 B**，映射如下（新增 `libs/local-vault/src/items/item-kind.ts`）：

| 原型类型 | 存储 `CipherType` | 字段映射                                                 |
| -------- | ----------------- | -------------------------------------------------------- |
| 登录     | Login             | 原生                                                     |
| 令牌     | Login             | 用户名=服务、密码=令牌、自定义字段：权限范围/有效期/环境 |
| SSH 私钥 | Login             | 用户名=用于、密码=私钥、自定义字段：公钥指纹/口令        |
| 许可证   | Login             | 用户名=软件、密码=序列号、自定义字段：席位/购买日期      |
| 服务器   | Login             | 用户名=主机:端口、密码=认证、自定义字段：协议/sudo 备注  |
| 卡片     | Card              | 原生                                                     |
| 身份     | Identity          | 原生（证件类型做下拉）                                   |
| 笔记     | SecureNote        | 原生                                                     |

`kind` 存在自定义字段 `lp:kind` 里（导出可见、导入可还原），缺省视为 `login`。

## 3. 阶段与验收

每个阶段单独一票，CI 绿 + 能在浏览器/桌面端手动点通才算完成。

| 阶段                          | 内容                                                                                                | 验收                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **P1 条目层**                 | `item-kind.ts`（kind → 原生类型的读写映射）+ 单测                                                   | 8 类都能存能读，导出后仍是标准 JSON                   |
| **P2 列表与详情**（扩展弹窗） | 列表（分组、类型图标、副标题）+ 详情（点行复制）+ 空状态                                            | 契约见原型 vault / item / vault-empty                 |
| **P3 表单**（扩展弹窗）       | 类型选择网格 + 8 份表单 + 保存/取消                                                                 | 原型 new-type / form-*                                |
| **P4 桌面端三栏**             | 左 rail + 列表 + 右栏详情/表单（同一套 `lp-*` 原语）                                                | 原型 vault-desktop / d-form-*                         |
| **P5 设置与系统**             | 设置一级、安全（Touch ID 仅 macOS）、网络闸门、数据与安全                                           | 原型 settings / security-desktop / offline / data     |
| **P6 备份与恢复**             | 云备份面板、存储配置、恢复中/冲突/失败三态                                                          | 原型 backup / backup-config / restore-cloud / state-* |
| **P7 工具**                   | 生成器、Google 认证器导入与预览、安全密钥、二维码                                                   | 原型 generator / import-* / security-key / qr         |
| **P8 上游铺平**               | `libs/auth` 等存量组件跑 `angular-modernization` schematic（standalone → `@if` → signals → inject） | 类型与 lint 全绿，视觉不回归                          |

顺序：P1 → P2 →（P4 与 P3 可并行）→ P5 → P6 → P7 → P8。

## 4. 屏幕映射（原型 → 目标位置）

**扩展弹窗（33 屏）**

| 原型屏                                           | 目标                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| setup / unlock / unlock-wait                     | `libs/angular/src/auth/local-vault/`（改造现有 3 个组件）          |
| vault / vault-empty                              | `apps/browser/src/vault/popup/components/vault/`（重写列表与空态） |
| new-type + form-*（8 份）                        | 新增 `apps/browser/src/vault/popup/components/item-form/`          |
| item / item-passkey / qr                         | `libs/vault/src/cipher-view/`（改造详情，接入 `lp-row` 复制）      |
| item-delete / trash                              | `apps/browser/src/vault/popup/settings/trash-*`（操作单 + 回收站） |
| autofill                                         | `apps/browser/src/autofill/content/`（内联菜单样式对齐）           |
| generator / import-* / security-key              | 现有页面套 `lp-*` 原语                                             |
| backup / backup-config / restore-cloud / state-* | `libs/angular/src/tools/backup/` + 新增恢复向导                    |
| settings / offline / data                        | `apps/browser/src/tools/popup/settings/`                           |

**桌面端（17 屏）**：`apps/desktop/src/app/` 下新增三栏壳（rail + list + main），除解锁/首次设置用居中 paper，其余复用弹窗的组件，仅容器不同。

## 5. 风险

1. **kind 映射的边界**：用户从 Bitwarden 导入的条目没有 `lp:kind`，一律按 `login` 显示——可接受，但要在导入完成页说明。
2. **服务端字段语义被借用**（令牌用 Login.password 存密钥）——搜索、复制、导出都还能工作，但「密码历史」会把它当密码记录；P1 需要显式排除。
3. **桌面端三栏壳**会替换现有 desktop layout，Send/组织相关入口已删，注意别把 `桌面端设置` 里还活着的项丢掉。

## 6. 本地验证方式（每轮收工必须三绿）

| 端       | 类型检查                                             | 模板检查                                                  | 构建                                                       |
| -------- | ---------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| 扩展弹窗 | `npx tsc -p apps/browser/tsconfig.json --noEmit`     | 由 webpack 构建覆盖                                       | `npm run build:prod:chrome --workspace @localpass/browser` |
| 桌面端   | `npx tsc -p apps/desktop/tsconfig.json --noEmit`     | `npx ngc -p apps/desktop/tsconfig.renderer.json --noEmit` | **本地不可用**，见下                                       |
| 共享库   | `npx tsc -p libs/local-vault/tsconfig.json --noEmit` | —                                                         | `npx jest --config libs/local-vault/jest.config.js`        |

**桌面端 renderer 构建本地跑不了**：`npm run build:bit:renderer` 依赖 `localpass_license/bit-desktop/webpack.config.js`，本仓库没有这个覆盖层目录，webpack 直接报找不到配置。这不是代码问题——用 `ngc`（`strictTemplates: true`）做模板类型检查，等价覆盖 `NG8001` 这类模板错误。

CI 的 windows / chrome / 静态检查三个 job 仍然能验证真实构建，所以本地补齐 `ngc` 即可。

## 7. 写代码前先 grep 真实 import 路径

这个仓库的包名与 tsconfig 别名并不总是一致（`@localpass/importer` 是 package.json 的名字，实际别名是 `@localpass/importer-core` / `-ui`；`AutoUnlockService` 在 `@localpass/unlock` 而不在 `@localpass/angular/key-management`）。这几轮已经因此红了四次构建。

规则：

1. 写 `import` 之前先 `grep -rn "SymbolName" apps libs --include=*.ts | head`，照着已有文件的路径抄
2. 类型不确定时看声明处，不要凭印象给参数加窄类型（`ImportOption.id` 是 `string`，不是 `ImportType`）
3. 改已有字段前先 `grep` 出真实行再替换——`eslint --fix` 会给字段加 `readonly`，凭记忆写的补丁会连续失手

## 8. 剩余屏清单（截至第 21 轮）

**已完成（方向 C）**：首次设置、保险库列表（含搜索/空态/悬浮新建）、条目详情（点行复制、TOTP 实时码、二维码屏）、选类型 + 8 类表单、设置一级/安全/数据与安全、备份设置（含同步三态）、恢复向导（四态）、导入来源选择、Google 认证器导入（三步）、生成器、桌面三栏壳 + 内联表单 + 桌面设置（Touch ID）+ 桌面备份/恢复。

**未完成**：

| 屏                        | 现状                                     | 说明                                                                                                              |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 自动填充确认（autofill）  | 上游 AutofillConfirmationDialogComponent | 功能完整、样式沿用上游；换方向 C 需要改 dialog 壳                                                                 |
| 导入确认/结果             | 上游 importer-ui 流程                    | 只在导入后出现，方向 C 未覆盖                                                                                     |
| 组织范围保险库            | **已移植**（第 24 轮）                   | 新列表按 `organizationId` 收窄，`my-items` 再收缩到「不属于任何集合」；旧 806 行组件已删除                        |
| 集合级下钻 / 保险库切换器 | 未做                                     | 上游 `VaultScope` 完整语义（集合、共享文件夹下钻、vault switcher）不在这一版里；`shared-folders` 路由仍用各自组件 |
| 桌面端文件夹 / Send       | 上游组件                                 | Send 功能已从产品移除，应直接不渲染而非改样式                                                                     |
| 解锁屏（unlock）          | 上游 LockComponent                       | 与首次设置同源，可下一轮换                                                                                        |

对齐原则：能复用同一份组件的就复用到两端；不能复用的先记在这里，不假装修好了。
