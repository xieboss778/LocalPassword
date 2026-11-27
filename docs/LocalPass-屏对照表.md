# LocalPass 屏对照表（ui-redo-d ↔ 实现）

原型：`prototype/ui-redo-d`（Bitwarden 原生布局，58 个界面函数：弹窗 27 + 桌面端 27 + 网页内联 4）。
本表是这一轮 UI 对齐的唯一清单：每个原型屏都要能在产品里走到，布局、文案、交互与原型一致，
功能仍走真实的本地保险库服务。状态：**✅ 对齐** / **◐ 已存在、待对齐** / **⬜ 未做**。

> 并行分工（2026-11-27）
>
> - 扩展弹窗 + 共享表单：`apps/browser/src/vault/popup`、`apps/browser/src/tools/popup`、
>   `libs/angular/src/local-ui`、`libs/angular/src/tools/item-entry`
> - 网页内联：`apps/browser/src/autofill/**`
> - 桌面端 + 共享工具页：`apps/desktop/**`、`libs/angular/src/tools/{generator,folders,backup}`、
>   `libs/angular/src/auth/local-vault/restore-vault-v2.component.ts`
>
> 收尾：全量 lint / test:types / jest / `build:chrome` / 桌面构建，然后用
> `playwright-cli --persistent` 在真实扩展与桌面端逐屏走查，发现不一致就修到一致。

> 2026-11-27 收尾结论：弹窗、内联、桌面端主要屏幕已实机截图对照并修到一致；
> 剩余为明确的功能缺口与有意保留差异，见 `.playwright-cli/qa/checklist.md` 的 F 节。
> 桌面 `d-import-preview` 已补齐（`apps/desktop/src/app/tools/import/import-preview-desktop.component.ts`），
> 选文件后先解析、展示前 5 条与检查项，取消不写入，确认后才导入。

## 扩展弹窗（27 屏 / 41 个索引项）

| 原型屏                                               | 实现落点                                               | 现状 |
| ---------------------------------------------------- | ------------------------------------------------------ | ---- |
| p-unlock / p-unlock-wait                             | `LockComponent`（共享）                                | ✅   |
| p-setup                                              | `CreateLocalVaultComponent`                            | ✅   |
| p-security-key                                       | `SecurityKeyComponent`                                 | ✅   |
| p-vault / p-vault-empty                              | `VaultListV2Component`                                 | ✅   |
| p-item（登录/卡片/令牌/SSH/服务器/许可证/身份/笔记） | `VaultItemViewV2Component`                             | ✅   |
| p-item-more                                          | 详情页底部操作单                                       | ✅   |
| p-totp-qr                                            | `TotpQrV2Component`                                    | ✅   |
| p-new-type                                           | `NewItemV2Component`（共享）                           | ✅   |
| p-form（8 类）                                       | `ItemFormV2Component`（共享）                          | ✅   |
| p-generator / p-generator-history                    | `GeneratorV2Component` / `GeneratorHistoryV2Component` | ✅   |
| p-settings                                           | `SettingsListV2Component`                              | ✅   |
| p-settings-security                                  | `SecuritySettingsV2Component`                          | ✅   |
| p-appearance                                         | `AppearanceV2Component`                                | ✅   |
| p-folders                                            | `FoldersV2Component`（共享）                           | ✅   |
| p-trash                                              | `TrashV2Component`                                     | ✅   |
| p-about                                              | `AboutV2Component`                                     | ✅   |
| p-backup / p-backup-config                           | `BackupSettingsV2Component`（共享，拆状态页与配置页）  | ✅   |
| p-restore                                            | `RestoreVaultV2Component`（共享）                      | ✅   |
| p-import / p-import-preview                          | 导入来源页 + 导入预览（真实导入服务）                  | ✅   |
| p-export                                             | `ExportBrowserV2Component`                             | ✅   |
| p-network                                            | `NetworkGateV2Component`                               | ✅   |
| p-data                                               | `DataSafetyV2Component`                                | ✅   |

## 网页内联（4 屏）

| 原型屏               | 实现落点                                                          | 现状 |
| -------------------- | ----------------------------------------------------------------- | ---- |
| w-inline-login       | `autofill/overlay/inline-menu` 列表 iframe + `content/components` | ✅   |
| w-inline-passkey     | 同上（通行密钥分组 / 验证中）                                     | ✅   |
| w-inline-totp        | 同上（验证码行、倒计时环）                                        | ✅   |
| w-inline-totp-filled | 同上 + 填充确认卡（剩余秒数 / 切换账户 / 复制）                   | ✅   |

内联数据流仍走 `overlay.background.ts` 的 `InlineMenuCipherData`；账户优先展示由
`login.username` + 条目名 + 可用方式派生，不新增持久化状态、不上网。

## 桌面端（27 屏）

| 原型屏                                                    | 实现落点                                          | 现状 |
| --------------------------------------------------------- | ------------------------------------------------- | ---- |
| d-unlock / d-security-key / d-setup                       | 共享解锁 / 安全密钥 / 建库                        | ✅   |
| d-vault / d-vault-empty（深蓝 rail + 文件夹卡 + 表格）    | `VaultDesktopV2Component`                         | ✅   |
| d-item / d-form（右侧抽屉）                               | `VaultDesktopV2Component` 抽屉                    | ✅   |
| d-new / d-new-form                                        | 抽屉内选类型 + 表单                               | ✅   |
| d-item-delete                                             | 删除确认模态                                      | ✅   |
| d-trash                                                   | `TrashDesktopV2Component`                         | ✅   |
| d-folders                                                 | `FoldersV2Component`（桌面布局）                  | ✅   |
| d-generator / d-generator-history（两栏）                 | `GeneratorV2Component`（桌面布局）                | ✅   |
| d-import / d-import-preview                               | 桌面导入页（真实导入服务）                        | ✅   |
| d-export                                                  | `ExportDesktopV2Component`                        | ✅   |
| d-backup / d-backup-config / d-restore                    | 共享备份 / 存储配置 / 恢复（桌面布局）            | ✅   |
| d-settings-security / vault / appearance / backup / about | `SettingsDesktopV2Component`（子导航 + 单页切换） | ◐    |
| d-network / d-data                                        | 桌面网络闸门 / 数据与安全                         | ✅   |

## 完成标准

1. 每个原型屏都能在产品中走到，且首屏、分组、标题/副标题、按钮层级与原型一致；文案按原型。
2. 真实功能可用：建库、解锁、CRUD、复制、生成器、TOTP、Passkey 展示、导入/导出、备份/恢复、设置。
3. `npm run lint`、`npm run test:types`、相关 Jest、`build:chrome`、桌面构建全绿。
4. 用 `playwright-cli`（headed + persistent 配置）实机走查弹窗 / 内联 / 桌面端，逐项修到一致。
