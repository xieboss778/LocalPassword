<div align="center">

# LocalPass

**完全离线的密码管理器：浏览器扩展 + 桌面端**

数据只存在你自己的电脑上 · 不需要注册账号 · 不需要服务器 · 所有付费功能免费

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge-lightgrey.svg)](#安装)
[![Built with](https://img.shields.io/badge/built%20with-Angular%20%7C%20TypeScript-DD0031.svg)](https://angular.dev)
[![Identity](https://img.shields.io/badge/identity-LocalPass-175DDC.svg)](#品牌与身份)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](#功能)

</div>

---

## 这是什么

LocalPass 是一个**完全离线的密码管理器**：浏览器扩展 + 桌面端（Windows / macOS；Linux 可自行打包）。它的产品身份（应用名、bundle id、数据目录、钥匙串服务名、包名体系、界面文案、图标）全部为 LocalPass 自有，不依赖任何厂商服务器；密码学内核沿用 GPLv3 开源实现，来源与边界见[品牌与身份](#品牌与身份)。

- **只做本地保险库**：没有注册、没有登录服务器、没有同步到厂商云端。
- **加密在本地完成**：条目写入前由 LocalPass 的 Rust/WASM 加密引擎加密，只保存在浏览器的本地存储里。
- **付费功能全部开放**：动态口令、Passkey、安全密钥解锁、导出等功能不再需要订阅。
- **网络闸门**：除你自己配置的同步存储和主动发起的泄露查询外，扩展会拦截所有出站请求 —— 你可以用开发者工具的网络面板自行验证。
- **没有默认服务端**：US/EU/Gov 三套云端地址表已删除，所有环境 URL 收敛为一个不可解析的离线哨兵。

> **一句话**：一个属于你自己的、不会把密码发到任何地方的密码管理器。

## 功能

| 功能                       | 状态          | 说明                                                                      |
| -------------------------- | ------------- | ------------------------------------------------------------------------- |
| 本地保险库                 | ✅ 可用       | 创建、解锁、条目与文件夹增删改、回收站；写入走 SDK 加密后存本地           |
| 自动填充                   | ✅ 可用       | 沿用上游的自动填充与内联菜单，数据源换成本地保险库                        |
| 主密码 / PIN 解锁          | ✅ 可用       | 纯本地校验；PIN 连续输错只进入等待，不会登出或丢数据                      |
| Google 动态口令            | ✅ 可用       | 从 Google Authenticator 的导出二维码批量导入；条目详情可反向生成二维码    |
| Passkey（网站登录）        | ✅ 代码完成   | 创建/使用 Passkey 均写入本地，不依赖服务器；真机验证步骤见验证清单        |
| 安全密钥解锁保险库         | ✅ 扩展端可用 | WebAuthn PRF，RP ID 为扩展自身 ID；桌面端暂不支持                         |
| Cloudflare R2 同步（可选） | ✅ 可用       | 自带 S3 兼容存储，只上传密文；点「同步」才推送/拉取，没有后台定时器       |
| 加密导出 / 导入            | ✅ 可用       | 设置页「导出」或云备份页「导出备份」生成标准加密 JSON，可迁移到兼容客户端 |
| 桌面端（Windows / macOS）  | ✅ 可用       | Electron + Rust 原生模块；Linux 可自行打包，CI 暂不产出                   |

「✅ 可用」表示代码与 CI 构建均已通过；标注「代码完成」的两项依赖真实认证器，人工验证步骤见 [docs/LocalPass-验证清单.md](docs/LocalPass-%E9%AA%8C%E8%AF%81%E6%B8%85%E5%8D%95.md)。

本表是功能状态的唯一来源；完整的实施路线、技术决策与风险说明见 [实施计划](docs/LocalPass-%E5%AE%9E%E6%96%BD%E8%AE%A1%E5%88%92.md)。

## 设计原则

1. **离线优先。** 断网时所有核心功能必须完整可用，联网只是可选的增强。
2. **不伪造服务器。** 本地写入逻辑集中在少数几个服务方法里，而不是拦截或模拟 HTTP 请求。
3. **只同步密文。** 可选的云同步使用你自己拥有的存储桶，上传内容全部是加密后的数据，服务端无法解读。
4. **可迁移。** 导出采用标准 LocalPass 加密格式，任何 LocalPass 客户端都能导入。
5. **供应链透明。** 自有代码零上游品牌；仅密码学 SDK / crate 通过别名引用，集中在两处声明。

## 安装

两种方式：**用 CI 产物**（不需要本地环境）或**自己构建**。

### 方式一：下载 CI 产物

推送到 `main` 且改动涉及代码时，GitHub Actions 会产出 `localpass-chrome`（扩展目录）、
`localpass-chrome-zip`、`localpass-windows`（Windows 安装包）与 `localpass-macos`（dmg）四个 artifact；
仅修改 `docs/` 或 Markdown 不会触发流水线。在仓库的 Actions 页面打开最近一次成功运行即可下载。
解压 zip 后按下文「加载已解压的扩展程序」导入。

### 方式二：本地构建

目前只支持以「开发者模式」加载未打包扩展（Chrome 官方要求 macOS 上外部安装的扩展必须经由商店分发，因此不提供自动更新的安装包）。

```bash
# 1. 克隆到本地
git clone https://github.com/xieboss778/LocalPass.git
cd LocalPass

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

更多请参考 [CONTRIBUTING.md](CONTRIBUTING.md) 与本仓库的 [文档索引](docs/README.md)。

## 文档

| 文档                                                                                                                            | 用途                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [docs/README.md](docs/README.md)                                                                                                | 文档索引与维护规则                 |
| [实施计划](docs/LocalPass-%E5%AE%9E%E6%96%BD%E8%AE%A1%E5%88%92.md)                                                              | 阶段、当前执行状态与验证基线       |
| [离线优先与 R2 同步设计](docs/LocalPass-%E7%A6%BB%E7%BA%BF%E4%BC%98%E5%85%88%E4%B8%8ER2%E5%90%8C%E6%AD%A5%E8%AE%BE%E8%AE%A1.md) | 自动同步的待评审设计（尚未实施）   |
| [界面规范](docs/LocalPass-%E7%95%8C%E9%9D%A2%E8%A7%84%E8%8C%83.md)                                                              | 视觉、组件、条目类型与平台能力矩阵 |
| [安装与恢复](docs/LocalPass-%E5%AE%89%E8%A3%85%E4%B8%8E%E6%81%A2%E5%A4%8D.md)                                                   | 安装、云存储配置、同步与恢复步骤   |
| [验证清单](docs/LocalPass-%E9%AA%8C%E8%AF%81%E6%B8%85%E5%8D%95.md)                                                              | CI 覆盖不到的人工验证与已知限制    |

## 数据与安全

- **保险库数据不会离开你的电脑**，除非你主动配置了同步存储。
- **没有「找回密码」**。主密码遗忘或泄露都无法通过服务端恢复 —— 这是离线的代价，
  因此请务必配置云同步并定期导出，或至少保留一份离线导出文件。
- **请自行审查代码**。这是一个要处理你最敏感数据的工具，README 里的任何承诺都不应代替你自己阅读代码。
- 发现安全问题请阅读 [SECURITY.md](SECURITY.md)，不要在公开 issue 中披露未修复的漏洞。

## 与 Bitwarden 的关系

LocalPass 是 [Bitwarden clients](https://github.com/bitwarden/clients) 的**独立衍生作品**，与 Bitwarden Inc. **没有任何隶属、赞助或背书关系**。

- 上游项目：[bitwarden/clients](https://github.com/bitwarden/clients)（GPL-3.0 / Bitwarden License v1.0 双许可）
- 本仓库**不包含**上游 bitwarden_license/ 目录下的专有代码，整体按 **GNU GPL v3.0** 分发。
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

## 品牌与身份

LocalPass 的应用身份是自有的，不再与任何密码管理器厂商共享运行期标识：

| 维度                   | 取值                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------ |
| 产品名 / `productName` | `LocalPass`                                                                          |
| bundle id / `appId`    | `com.localpass.desktop`                                                              |
| npm 作用域             | `@localpass/*`                                                                       |
| userData 目录          | `~/Library/Application Support/LocalPass`                                            |
| 钥匙串服务名           | `LocalPass`、`LocalPass_biometric`、`LocalPass Safe Storage`                         |
| URL scheme             | `localpass://`                                                                       |
| 浏览器 ↔ 桌面 host     | `com.localpass.desktop`                                                              |
| App Group              | 不设置（构建不签名，`identity: null`）                                               |
| 默认服务域名           | **无**：区域表收敛为单一离线哨兵 `local.invalid`（保留域名永不解析，网络层直接拒绝） |

> 本项目按“不签名”方式构建：`mac/identity: null`，不启用 hardened runtime，不带 entitlements。
> 代价是钥匙串 ACL 只能隐式信任当前二进制，重新打包后系统可能再问一次授权；这是预期的，不是逻辑缺陷。

## 供应链边界

仓库自有代码里不出现上游品牌。以下几处是**外部依赖或法律要求**，属于有意保留：

1. **密码学 SDK**：`@localpass/sdk-internal` 在 `package.json` 里用 npm alias 指向上游 `@bitwarden/sdk-internal`（WASM 二进制，无法改名）。只有 `package.json` 两行出现上游包名。
2. **Rust 密码学 crate**：`apps/desktop/desktop_native/Cargo.toml` 用 Cargo 的 `package =` 别名把 `bitwarden-crypto` 等映射为 `localpass-*` crate 名；源码里只写 `localpass_*`。
3. **格式互操作**：`libs/importer/src/importers/bitwarden*` 解析 Bitwarden 备份格式，保留原命名（否则无法表达"导入谁的数据"）。
4. **许可证与署名**：`LICENSE`、`NOTICE`、`LICENSE_BITWARDEN.txt` 保留原始版权声明（GPLv3 义务，移除即不可分发）。

## 从旧版迁移

旧版本（`LocalPassword`）以及更早的上游同名版本把数据写在共享目录里，换名后首次启动会看不到旧库。迁移一次即可：

```bash
./scripts/migrate-identity.sh
```

脚本会备份并复制旧目录到 `~/Library/Application Support/LocalPass`，并列出需要手动清理的旧钥匙串条目（不会自动删除）。
