# Changelog

本项目的所有重要变更都会记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

本项目源自开源密码管理器客户端代码（GPLv3），产品身份与版本号由 LocalPass 独立维护，
上游的具体版本记录请查阅原始项目仓库。

## [Unreleased]

### Added

- 本地保险库核心：创建/恢复本机账户、条目与文件夹本地读写、回收站、导入器本地分支、
  网络闸门（`LocalPassApiService`）；所有写入先经 SDK 加密再落盘。
- Google Authenticator `otpauth-migration` 导入、条目详情动态口令与二维码展示。
- 网站 Passkey 的本地保存与使用；扩展端 WebAuthn PRF 安全密钥解锁。
- 可选 Cloudflare R2 / S3 兼容同步：SigV4、条件写清单（412 合并重试）、
  快照保留、云端恢复；`account.json` 升至 version 2 并作为唯一恢复锚点。
- 手动「导出备份」：带独立备份口令的标准加密 JSON，按保留数量清理。
- 桌面端接入：原生消息 host `com.localpass.desktop`、禁 SSO cookie、
  `data.json.bak` 滚动备份、从桶根 `account.json` 恢复。
- 界面按 `ui-redo-d` 原型对齐弹窗、桌面端与网页内联菜单；8 类条目经 `lp:kind`
  映射到原生存储类型。
- 文档体系：`docs/README.md` 索引、`GLOSSARY.md`、`docs/adr/`、`docs/agents/`；
  删除已过期的实现计划、进度核查、开发规则与上游参考文档。
- 项目开源化：统一 `GPL-3.0` 许可证文件（`LICENSE`）、上游归属声明（`NOTICE`）、
  贡献指南、行为准则、issue / PR 模板、依赖更新配置；上游的 GitHub Actions 工作流
  移入 `.github/upstream-workflows/` 归档。
- 新增 `docs/LocalPass-品牌与身份.md`（边界与验收）与 `scripts/migrate-identity.sh`（旧数据迁移）。

### Changed

- 移除自动备份调度：同步与导出全部改为手动触发，进程内没有定时器
  （守护测试 `sync/vault-backup-sync.manual-only.spec.ts`）。
- 移除默认服务域名：US/EU/Gov 三套云端地址表合并为单一离线哨兵 `https://local.invalid`；
  删除 `send` 云 URL 特判、FillAssist 远程规则地址、桌面菜单里指向服务端的帮助/条款/商店项。
- 移除 macOS 代码签名：`mac.identity = null`，删除 hardened runtime、全部 entitlements、
  after-sign 公证脚本与 Xcode 工程里的签名/描述文件配置；不再需要 Apple Team ID。
- 完成品牌与身份剥离：`productName`/`appId`/userData/钥匙串服务名/URL scheme/
  native messaging host/App Group 全部改为 LocalPass 自有标识；npm 作用域改为
  `@localpass/*`；默认服务域名改为不可解析的 `*.local.invalid`；图标与 Logo 重做。
- 修正桌面端运行时应用名：`build/package.json` 的 `productName` 由上游名字改为
  `LocalPass`，不再与已安装的上游客户端共用 userData 与钥匙串条目。
- 清理旧身份：旧 userData 已迁移并删除（保留 tar 备份），登录钥匙串中的旧品牌条目已删除。
- Rust 密码学 crate 通过 Cargo `package =` 别名映射为 `localpass-*`，源码不再出现上游标识。
- CI 升级到 Node 24；macOS dmg 改为必过任务；新增 gitleaks 密钥扫描与格式化任务。

### Fixed

- 修复扩展更新后弹出页按钮无响应：替换构建后旧 MV3 service worker 未退出，
  现在会清理旧 worker 并避免重复写入弹窗缓存。
- 处理 `browser` 命名空间下消息无接收端、弹窗关闭时 `sendMessage` 的预期竞态错误。
- 修复本地保险库建库后的导航卡死、缺密钥时的空值写入、环境 URL 冻结常量被原地改写等问题。
- 本地保险库创建页展示逐字段校验错误与 loading 状态。

### Removed

- 删除 `apps/web`、`apps/cli`、`localpass_license/` 及无消费者的库，
  删除映射见 `docs/removed-from-upstream.md`。
- 删除根目录 `prototype/` 与 `prototype-inline-menu.html` 的重复副本，
  设计原型统一放在 `design-system/legacy/prototypes/`。

### Notes

- 当前实现是**手动同步 / 手动导出**。自动同步、分段快照、设备签名与冲突选择仍是
  `docs/LocalPass-离线优先与R2同步设计.md` 中的待评审设计，尚未实施。
- 功能状态见 [README](README.md)；阶段与验证基线见
  [实施计划](docs/LocalPass-%E5%AE%9E%E6%96%BD%E8%AE%A1%E5%88%92.md)。

## [0.0.1] - 2026-11-24

### Added

- 基于 `localpass/clients` 建立仓库。
- 新增 `docs/LocalPass-实施计划.md`，记录离线化改造的技术方案、
  阶段划分与风险对策。
