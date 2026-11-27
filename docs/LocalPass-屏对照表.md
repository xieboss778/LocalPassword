# LocalPass 屏对照表（ui-redo-d ↔ 实现）

原型：`design-system/legacy/prototypes/ui-redo-d/index.html`
（Bitwarden 原生布局，58 个界面函数：弹窗 27 + 桌面端 27 + 网页内联 4）。

本表是界面落点的唯一清单：每个原型屏都要能在产品里走到，布局、文案、交互与原型一致，
功能仍走真实的本地保险库服务。状态：**✅ 对齐** / **◐ 已存在、有已知缺口** / **⬜ 未做**。
规范见 [LocalPass-界面规范.md](./LocalPass-界面规范.md)；人工验证步骤见
[LocalPass-验证清单.md](./LocalPass-验证清单.md)。

> 2026-11-27 收尾结论：弹窗、内联、桌面端主要屏幕已实机截图对照并修到一致；
> 剩余项是明确的功能缺口或有意保留差异，列在文末「已知差异」。

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

动效、键盘与复制反馈的细则见界面规范第 8 节。连错等待屏的界面与逻辑已实现，
但“连续输错 5 次”的截图验证尚未单独留存，按功能回归项处理。

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

`d-settings-*` 的已知缺口：安全密码“更改”已可用；已登记安全密钥的“管理”入口缺失
（桌面没有对应管理页，新增会触及密钥登记）；外观页语言切换没有入口。

## 完成标准

1. 每个原型屏都能在产品中走到，且首屏、分组、标题/副标题、按钮层级与原型一致；文案按原型。
2. 真实功能可用：建库、解锁、CRUD、复制、生成器、TOTP、Passkey 展示、导入/导出、同步/恢复、设置。
3. `npm run lint`、`npm run test:types`、相关 Jest、`build:chrome`、桌面构建全绿。
4. 在真实扩展与桌面端逐屏走查；发现不一致就修到一致，或登记到下面的已知差异。

## 已知差异 / 有意保留

下表是当前仍与原型不同、但已确认不阻塞对齐的项。新增差异必须登记，不能默认“以后再说”。

| #   | 差异                                                                   | 处理                                                     |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | 桌面导入预览不识别重复条目，重复数恒为 0；原型示意为 2                 | 未加去重逻辑，避免误删用户条目；预览仍显示可识别的检查项 |
| 2   | 桌面设置缺已登记安全密钥的“管理”入口；外观页语言切换无“更改”入口       | 需要新的密钥管理页，涉及加密/登记路径，单独立项          |
| 3   | 桌面导入的 Google 认证器卡片进入通用导入器；原型有独立扫码/迁移流程    | 浏览器已有独立 Google 认证器页；桌面端待补               |
| 4   | 文件夹排序按名称，原型按演示数据顺序                                   | 数据顺序差异，不视为缺陷                                 |
| 5   | 桌面文件夹行保留悬停编辑/删除入口，原型没有                            | 功能需要，有意保留                                       |
| 6   | 桌面 d-data 多“导出加密备份”、about 多“打开”链接、备份配置多“断开连接” | 有意保留的入口                                           |
| 7   | 弹窗设置使用“安全密码”，原型写“主密码”                                 | 产品既有术语，不跟随原型改文案                           |
| 8   | 重提示 TOTP 在内联菜单掩码显示，原型显示明文                           | 安全行为，保留掩码                                       |
| 9   | 解锁“连错等待”屏未单独截图                                             | 逻辑与界面已实现，待补验证截图                           |

## 原型与实现的边界

- 原型只作视觉与交互参考，不把原型里的假数据、文案、内联样式带进产品代码。
- 新增持久化状态时注册到对应的 `state-definitions.ts`；不把原型状态直接当产品状态。
- 加密与存储仍走本地保险库服务；不新增加密逻辑，不在日志、错误或存储里出现明文。
- 涉及加密、同步、本地写入的改动必须补单测，并实际构建扩展验证。
