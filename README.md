<div align="center">

# LocalPassword

**完全离线的密码管理器浏览器扩展**

数据只存在你自己的电脑上 · 不需要注册账号 · 不需要服务器 · 所有付费功能免费

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge-lightgrey.svg)](#安装)
[![Built with](https://img.shields.io/badge/built%20with-Angular%20%7C%20TypeScript-DD0031.svg)](https://angular.dev)
[![Based on Bitwarden](https://img.shields.io/badge/based%20on-bitwarden%2Fclients-175DDC.svg)](https://github.com/bitwarden/clients)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](#功能)

</div>

---

## 这是什么

LocalPassword 是基于 [Bitwarden clients](https://github.com/bitwarden/clients) 二次开发的 Chrome 浏览器扩展。它保留了 Bitwarden 成熟的密码管理能力（加密、自动填充、Passkey、动态口令），同时**移除了对密码管理服务器的全部依赖**：

- **只做本地保险库**：没有注册、没有登录服务器、没有同步到厂商云端。
- **加密在本地完成**：条目写入前由 Bitwarden 的 Rust/WASM 加密引擎加密，只保存在浏览器的本地存储里。
- **付费功能全部开放**：动态口令、Passkey、安全密钥解锁、导出等功能不再需要订阅。
- **网络闸门**：除你自己配置的备份存储和主动发起的泄露查询外，扩展会拦截所有出站请求 —— 你可以用开发者工具的网络面板自行验证。

> **一句话**：一个属于你自己的、不会把密码发到任何地方的密码管理器。

## 功能

| 功能 | 状态 | 说明 |
|---|---|---|
| 本地保险库 | 🚧 规划中 | 创建、解锁、增删改条目与文件夹，回收站 |
| 自动填充 | 🚧 规划中 | 沿用上游的自动填充与内联菜单 |
| 主密码 / PIN 解锁 | 🚧 规划中 | 纯本地校验，重启浏览器后仍可解锁 |
| Passkey（网站登录） | 🚧 规划中 | 在网站上创建和使用 Passkey |
| 安全密钥 / Passkey 解锁保险库 | 🚧 规划中 | WebAuthn PRF，RP ID 使用扩展自身 ID |
| Google 动态二维码 | 🚧 规划中 | 从 Google Authenticator 二维码批量导入，反向生成二维码 |
| Cloudflare R2 同步（可选） | 🚧 规划中 | 自带 S3 兼容存储，只上传密文；断网排队、联网补传 |
| 定时加密备份 | 🚧 规划中 | 按日 / 周自动备份，可保留多份并清理旧备份 |
| 加密导出 / 导入 | ✅ 上游已有 | 标准 Bitwarden 加密 JSON，可迁移到任意 Bitwarden 客户端 |

功能状态会在对应阶段合并后更新。完整的实施路线、技术决策与风险说明见 [docs/](docs/LocalPassword-%E5%AE%9E%E6%96%BD%E8%AE%A1%E5%88%92.md) 中的《LocalPassword 实施计划》。

## 设计原则

1. **离线优先。** 断网时所有核心功能必须完整可用，联网只是可选的增强。
2. **不伪造服务器。** 本地写入逻辑集中在少数几个服务方法里，而不是拦截或模拟 HTTP 请求。
3. **只同步密文。** 可选的云备份使用你自己拥有的存储桶，上传内容全部是加密后的数据，服务端无法解读。
4. **可迁移。** 备份采用标准 Bitwarden 加密格式，任何 Bitwarden 客户端都能导入。
5. **对上游改动最小。** 新逻辑尽量放在新文件里，便于按版本合并上游更新。

## 安装

目前只支持以「开发者模式」加载未打包扩展（Chrome 官方要求 macOS 上外部安装的扩展必须经由商店分发，因此不提供自动更新的安装包）。

```bash
# 1. 克隆到本地
git clone https://github.com/xieboss778/LocalPassword.git
cd LocalPassword

# 2. 安装依赖（需要 Node.js，版本见 .nvmrc）
npm ci

# 3. 构建 Chrome 扩展
npm run build:chrome
```

然后在浏览器中打开 `chrome://extensions` → 开启右上角「开发者模式」→ 点击「加载已解压的扩展程序」→ 选择 `apps/browser/build` 目录。

也可以直接打包出 zip：

```bash
npm run dist:chrome   # 产物：dist-chrome.zip
```

### 开发

这是一个 [Nx](https://nx.dev) monorepo，常用命令：

```bash
npm run build:chrome      # 构建扩展（开发模式）
npm run build:prod:chrome # 构建扩展（生产模式）
npm test                  # 单元测试
npm run lint              # 代码检查
```

更多请参考上游的 [贡献文档](https://contributing.bitwarden.com/)。

## 数据与安全

- **保险库数据不会离开你的电脑**，除非你主动配置了备份存储。
- **没有「找回密码」**。主密码遗忘或泄露都无法通过服务端恢复 —— 这是离线的代价，因此请务必启用定时备份或定期导出。
- **请自行审查代码**。这是一个要处理你最敏感数据的工具，README 里的任何承诺都不应代替你自己阅读代码。
- 发现安全问题请阅读 [SECURITY.md](SECURITY.md)，不要在公开 issue 中披露未修复的漏洞。

## 与 Bitwarden 的关系

LocalPassword 是 Bitwarden clients 的**独立衍生作品**，与 Bitwarden Inc. **没有任何隶属、赞助或背书关系**。

- 上游项目：[bitwarden/clients](https://github.com/bitwarden/clients)（GPL-3.0 / Bitwarden License v1.0 双许可）
- 本仓库**不包含** `bitwarden_license/` 目录下的专有代码，整体按 **GNU GPL v3.0** 分发。
- 上游版权归 Bitwarden Inc. 及其贡献者所有，详见 [NOTICE](NOTICE)。
- Bitwarden 名称与 logo 是 Bitwarden Inc. 的商标。本项目不使用其商标、logo 或品牌标识作为自身标识，仅保留出于来源说明所必需的引用。

## 参与贡献

欢迎 issue 与 pull request。开始之前请阅读：

- [CONTRIBUTING.md](CONTRIBUTING.md) —— 开发流程与提交规范
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) —— 社区行为准则
- [SECURITY.md](SECURITY.md) —— 漏洞报告流程

## 许可证

本项目基于 **GNU General Public License v3.0** 发布，全文见 [LICENSE](LICENSE)。

这意味着你可以自由使用、修改和分发，但**分发修改后的版本时必须同样公开源码**。这正是本项目存在的前提 —— 密码管理器不应是黑盒。
