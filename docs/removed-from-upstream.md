# 从上游删除的内容（映射表）

目的：瘦身之后仍能定位上游对应实现，便于后续按版本拣补丁。每删除一项，在此登记：删了什么、为什么、上游路径。

## 2026-11-24 阶段 1（整应用）

| 删除项 | 体积 / 文件 | 原因 | 上游路径 |
|---|---:|---|---|
| `apps/web` | 68 MB / 1,404 | 只做扩展 + 桌面端 | `apps/web` |
| `apps/cli` | 1.2 MB / 158 | 不发布 CLI | `apps/cli` |
| `bitwarden_license/` | 9.9 MB / 1,311 | 企业版（PAM/SM/bit-*），扩展与桌面零引用 | `bitwarden_license` |

同步清理：`jest.config.js` 项目列表、`angular.json` 的 `web` / `bit-web`、`tsconfig.base.json` 的 `@bitwarden/web-vault/*`、`@bitwarden/cli/*`、`@bitwarden/bit-*` 别名、`apps/browser/package.json` 的 `build:bit*` / `dist:bit*` / 企业版脚本、`apps/browser/project.json` 与 `apps/desktop/project.json` 的 `commercial-*` 构建配置、根 `package.json` 的 `test:e2e:web`、`e2e/playwright.web.config.ts`、`e2e/tests/web`、`.github/codecov.yml`。

## 2026-11-24 阶段 1（CI 与素材）

| 删除项 | 原因 |
|---|---|
| `.github/workflows/*`（38 个，保留 `localpassword.yml`） | 上游 CI 依赖 30+ 个 Azure / 签名 Secrets 与 Chromatic、Crowdin、自动回复机器人，在 fork 中必然失败 |
| `apps/browser/store`（5.0 MB / 97 文件） | Chrome 商店上架素材，自用不需要 |

## 2026-11-24 阶段 1（语言包）

| 目录 | 原状 | 现 |
|---|---|---|
| `apps/browser/src/_locales` | 64 个语言，22 MB | 仅 `en` + `zh_CN` |
| `apps/desktop/src/locales` | 67 个语言，18 MB | 仅 `en` + `zh_CN` |

保留机制不变：`default_locale: en`，中文缺键回退英文。上游新增语言包可直接拷回目录，无需改代码。

## 2026-11-24 阶段 1（无消费者的库）

| 删除项 | 体积 | 依据 |
|---|---|---|
| `libs/pam` | 17 KB | `grep -r @bitwarden/pam` 全仓库 0 引用 |
| `libs/billing` | 14 KB | 0 引用（`libs/common/src/billing` 是另一套模型，未动） |
| `libs/dirt/card` | 28 KB | 别名 `@bitwarden/dirt-card`，0 引用 |

保留但**未删**的库（仍有消费者，删了会断）：`libs/pricing`（`libs/common` 的发票/折扣模型在用）、`libs/subscription`（`libs/common` 存储容量模型在用）、`libs/organization-invite-link`（`libs/angular` 服务在用）、`libs/automation-driver`（浏览器与桌面的 init 服务在用）。

## 瘦身结果

- 源码：188 MB / 10,510 文件 → **71 MB / 7,831 文件**（不含 `.git`、`node_modules`、构建产物）。
- 提交后 CI 会给出最终数字；`libs/pricing` 等剩余项要等对应业务改动一起评估。
