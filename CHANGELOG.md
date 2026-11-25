# Changelog

本项目的所有重要变更都会记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

本项目源自开源密码管理器客户端代码（GPLv3），产品身份与版本号由 LocalPass 独立维护，
上游的具体版本记录请查阅原始项目仓库。

## [Unreleased]

### Changed

- 移除默认服务域名：US/EU/Gov 三套云端地址表合并为单一离线哨兵 `https://local.invalid`；
  删除 `send` 云 URL 特判、FillAssist 远程规则地址、桌面菜单里指向服务端的帮助/条款/商店项。

- 移除 macOS 代码签名：`mac.identity = null`，删除 hardened runtime、全部 entitlements、
  after-sign 公证脚本与 Xcode 工程里的签名/描述文件配置；不再需要 Apple Team ID。
- 清理旧身份：旧 userData 已迁移并删除（保留 tar 备份），登录钥匙串中的旧品牌条目已删除。

- 完成品牌与身份剥离：`productName`/`appId`/userData/钥匙串服务名/URL scheme/
  native messaging host/App Group 全部改为 LocalPass 自有标识；npm 作用域改为
  `@localpass/*`；默认服务域名改为不可解析的 `*.local.invalid`；图标与 Logo 重做。
- 修正桌面端运行时应用名：`build/package.json` 的 `productName` 由上游名字改为
  `LocalPass`，不再与已安装的上游客户端共用 userData 与钥匙串条目。
- Rust 密码学 crate 通过 Cargo `package =` 别名映射为 `localpass-*`，源码不再出现上游标识。
- 新增 `docs/LocalPass-品牌与身份.md`（边界与验收）与 `scripts/migrate-identity.sh`（旧数据迁移）。

### Added

- 项目开源化：统一 `GPL-3.0` 许可证文件（`LICENSE`）、上游归属声明（`NOTICE`）、
  贡献指南、行为准则、issue / PR 模板、依赖更新配置。
- 重写 README，说明 LocalPass 的定位、设计原则、安装与构建方式，
  以及与上游项目的商标与许可关系。
- 上游的 GitHub Actions 工作流移入 `.github/upstream-workflows/` 归档，
  避免因缺失 LocalPass 内部 secrets 而产生大量失败状态。

### Notes

- 当前代码仍为上游 LocalPass clients 的基线，LocalPass 的离线改造
  （本地保险库、网络闸门、R2 同步、Google 动态二维码、Passkey 解锁）
  处于规划阶段，实施路线见 `docs/` 中的实施计划。

## [0.0.1] - 2026-11-24

### Added

- 基于 `localpass/clients` 建立仓库。
- 新增 `docs/LocalPass-实施计划.md`，记录离线化改造的技术方案、
  阶段划分与风险对策。
