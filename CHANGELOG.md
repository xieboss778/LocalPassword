# Changelog

本项目的所有重要变更都会记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

由于本项目是 [bitwarden/clients](https://github.com/bitwarden/clients) 的衍生作品，
版本号独立于上游，上游的具体版本记录请查阅上游仓库。

## [Unreleased]

### Added

- 项目开源化：统一 `GPL-3.0` 许可证文件（`LICENSE`）、上游归属声明（`NOTICE`）、
  贡献指南、行为准则、issue / PR 模板、依赖更新配置。
- 重写 README，说明 LocalPassword 的定位、设计原则、安装与构建方式，
  以及与 Bitwarden 的商标与许可关系。
- 上游的 GitHub Actions 工作流移入 `.github/upstream-workflows/` 归档，
  避免因缺失 Bitwarden 内部 secrets 而产生大量失败状态。

### Notes

- 当前代码仍为上游 Bitwarden clients 的基线，LocalPassword 的离线改造
  （本地保险库、网络闸门、R2 同步、Google 动态二维码、Passkey 解锁）
  处于规划阶段，实施路线见 `docs/` 中的实施计划。

## [0.0.1] - 2026-11-24

### Added

- 基于 `bitwarden/clients` 建立仓库。
- 新增 `docs/LocalPassword-实施计划.md`，记录离线化改造的技术方案、
  阶段划分与风险对策。
