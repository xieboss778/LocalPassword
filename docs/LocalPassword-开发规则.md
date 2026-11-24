# LocalPassword 开发规则

本仓库是 bitwarden/clients 的二开，产品为 LocalPassword：只做本地保险库，Chrome 扩展 + 桌面端（Electron）两个客户端。实施细节见 `docs/LocalPassword-实施计划.md`。

## 构建与验证（硬规则）

- **本地不做任何构建。** 不运行 `npm run build*`、`dist*`、`pack*`、`electron-builder`、`cargo build`、`npm test`、`npm run lint`、`tsc`。本机不必装 Rust、MSVC、Electron。
- **所有构建与测试都在 GitHub Actions 完成**，流水线见 `.github/workflows/localpassword.yml`。产物（扩展 zip、Windows 安装包、macOS dmg）从 Actions 的 artifact 下载。
- 本地允许做的事：读代码、改代码、`git` 操作、JSON/YAML 解析、`grep` 与 import 依赖分析、核对文件路径与行号。
- 提交即视为交给 CI。CI 失败就看日志改，不要在本地装工具链绕过。

## 品牌与标识

- 产品名统一 `LocalPassword`；`productName`、`appId`（`com.localpassword.desktop`）、manifest 的 `short_name`/`author`/`homepage_url` 均已改。
- 扩展 ID 固定为 `gmobddgobjdhbjhedhgaeekhgchkoncm`，由 `manifest.v3.json` 的 `key` 决定。**私钥 `.keys/extension.pem` 不入库**，丢失即丢失扩展身份。
- 桌面钥匙串服务名取自 `app.getName()`，随 `productName` 变为 LocalPassword，不要硬编码回 Bitwarden。

## 架构约定

- 业务逻辑进 `libs/local-vault`（不 import `chrome.*` / `electron`）；两端只写适配器：存储、调度、解锁。
- 安全密钥解锁分平台：扩展用 WebAuthn PRF（RP ID = 扩展 ID），桌面用系统生物识别，桌面不做 PRF。
- 上游 GPL-3.0：分发二进制必须公开源码；`bitwarden_license/` 已删除，不得恢复。
- 不追上游 `main`，只按版本拣安全/加密补丁手工移植；删除映射记在 `docs/removed-from-upstream.md`。

## 提交约定

- 一步一个提交，中文提交信息；文档改在 `docs/`。
- **对话、文档、注释一律用中文。**
- 不提交任何密钥、令牌、备份文件；`.keys/`、`.localpassword-ext-id` 已在 `.gitignore`。
