# LocalPass 屏对照表（原型 ↔ 实现）

原型：`prototype/ui-redo-c`（方向 C 分组原生，50 屏：弹窗 33 + 桌面 17）。
本表逐屏对到实现，状态分三种：**✅ 方向 C**（这一版按原型做的）、**◐ 外壳方向 C**（容器/标题是我们的，内部控件沿用上游）、**▷ 上游保留**（功能在位，视觉未换，附原因）。

## 弹窗（33 屏）

| 原型屏                                                                  | 实现                                                               | 状态                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| setup                                                                   | `CreateLocalVaultComponent`（`libs/angular/src/auth/local-vault`） | ✅                                                                               |
| unlock                                                                  | `LockComponent`（`libs/key-management-ui`）                        | ◐ 外壳方向 C，四条解锁路径逻辑未改                                               |
| unlock-wait                                                             | `LockComponent` 的 spinner 状态                                    | ◐ 同上                                                                           |
| vault                                                                   | `VaultListV2Component`                                             | ✅                                                                               |
| vault-empty                                                             | 同上空态（`lp-empty` + 新建/导入）                                 | ✅                                                                               |
| autofill                                                                | `AutofillConfirmationDialogComponent`                              | ✅（保留 callout 结构与 testid）                                                 |
| item                                                                    | `VaultItemViewV2Component`                                         | ✅ 点行复制 + TOTP 实时码                                                        |
| new-type                                                                | `NewItemV2Component`（共享库）                                     | ✅                                                                               |
| form-login / token / sshkey / license / card / identity / server / note | `ItemFormV2Component` + `FIELDS`（共享库）                         | ✅ 8 类字段映射有单测                                                            |
| item-passkey                                                            | 详情页 Passkey 组（桌面版已有；弹窗版只显示凭据/自动填充）         | ◐ 弹窗侧缺一行 Passkey 计数                                                      |
| qr                                                                      | `TotpQrV2Component`                                                | ✅                                                                               |
| generator                                                               | `GeneratorV2Component`（共享库）                                   | ✅                                                                               |
| import-ga / import-preview                                              | `GoogleAuthImportV2Component` 三步流                               | ✅                                                                               |
| security-key                                                            | 上游 `SecurityKeyComponent`                                        | ▷ 注册流程涉及系统弹窗，视觉未换                                                 |
| backup / backup-config                                                  | `BackupSettingsV2Component`（共享库）                              | ✅ 含同步三态                                                                    |
| restore-cloud                                                           | `RestoreVaultV2Component`                                          | ✅ 四态                                                                          |
| item-delete                                                             | 详情页 `DialogService` 确认框                                      | ◐ 弹窗确认，非独立屏                                                             |
| trash                                                                   | `TrashV2Component`                                                 | ✅                                                                               |
| state-loading / conflict / error                                        | 备份页内联三态                                                     | ✅ 由真实 sync 调用驱动                                                          |
| settings                                                                | `SettingsListV2Component`                                          | ✅                                                                               |
| offline（网络闸门）                                                     | 设置/数据页的只读行                                                | ▷ 尚无独立页：闸门规则写在 `libs/local-vault/src/network/gate-policy.ts`，有单测 |
| data                                                                    | `DataSafetyV2Component`                                            | ✅                                                                               |

## 桌面端（17 屏）

| 原型屏                              | 实现                                            | 状态                                           |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| setup                               | 共享 `CreateLocalVaultComponent`                | ✅                                             |
| unlock                              | 共享 `LockComponent`                            | ◐                                              |
| vault-desktop                       | `VaultDesktopV2Component`（rail + 列表 + 右栏） | ✅                                             |
| d-pick-type                         | `/new-item-v2`（共享 `NewItemV2Component`）     | ✅                                             |
| d-form-*（8 份）                    | 右栏**内联表单**（同一份 `FIELDS` 映射）        | ✅ 不是 8 个独立页面，而是同一栏切换           |
| d-item-delete                       | 右栏删除走确认框                                | ◐                                              |
| d-trash                             | 桌面端暂无回收站路由                            | ▷ 待补：桌面目前只能软删除，回收站入口在扩展里 |
| gen-desktop                         | `/generator`（共享组件）                        | ✅                                             |
| security-desktop / settings-desktop | `SettingsDesktopV2Component`                    | ✅ 含 Touch ID（仅 macOS）                     |

## 三条硬约束的落点

| 约束                     | 证据                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 无注册登录               | `setup` 屏无账号语义；`create-local-vault.component.html` 只收邮箱/名字/安全密码                                                  |
| Touch ID 仅 macOS 设置页 | `settings-desktop-v2.component.ts`：`getDevice() === MacOsDesktop` 且 `canEnableBiometricUnlock()` 才渲染；扩展端只留一句指向说明 |
| 备份纯手动               | `vault-backup-sync.manual-only.spec.ts` 读源码断言无 `setInterval/setTimeout/scheduler`；上传只由按钮触发                         |

## 明说没做的

1. 集合级下钻 / vault switcher 未移植（`shared-folders` 仍用各自组件）
2. 安全密钥注册页视觉沿用上游
3. 导入确认/结果屏沿用上游 importer-ui 状态组件

这五条都写在这里，而不是说成「已完成」。
