# 从上游删除的内容（来源映射）

目的：记录删了什么、为什么、原来在哪里，便于审计本仓库与来源基线的差异。
**这不是上游跟踪计划**：本仓库只使用 `origin`，不添加上游 remote，不拉取、合并或拣选上游代码。

## 2026-11-24 阶段 1（整应用）

| 删除项               |    体积 / 文件 | 原因                                     | 上游路径            |
| -------------------- | -------------: | ---------------------------------------- | ------------------- |
| `apps/web`           |  68 MB / 1,404 | 只做扩展 + 桌面端                        | `apps/web`          |
| `apps/cli`           |   1.2 MB / 158 | 不发布 CLI                               | `apps/cli`          |
| `localpass_license/` | 9.9 MB / 1,311 | 企业版（PAM/SM/bit-*），扩展与桌面零引用 | `localpass_license` |

同步清理：`jest.config.js` 项目列表、`angular.json` 的 `web` / `bit-web`、`tsconfig.base.json` 的 `@localpass/web-vault/*`、`@localpass/cli/*`、`@localpass/bit-*` 别名、`apps/browser/package.json` 的 `build:bit*` / `dist:bit*` / 企业版脚本、`apps/browser/project.json` 与 `apps/desktop/project.json` 的 `commercial-*` 构建配置、根 `package.json` 的 `test:e2e:web`、`e2e/playwright.web.config.ts`、`e2e/tests/web`、`.github/codecov.yml`。

## 2026-11-24 阶段 1（CI 与素材）

| 删除项                                               | 原因                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `.github/workflows/*`（38 个，保留 `localpass.yml`） | 上游 CI 依赖 30+ 个 Azure / 签名 Secrets 与 Chromatic、Crowdin、自动回复机器人，在 fork 中必然失败 |
| `apps/browser/store`（5.0 MB / 97 文件）             | Chrome 商店上架素材，自用不需要                                                                    |

## 2026-11-24 阶段 1（语言包）

| 目录                        | 原状             | 现                |
| --------------------------- | ---------------- | ----------------- |
| `apps/browser/src/_locales` | 64 个语言，22 MB | 仅 `en` + `zh_CN` |
| `apps/desktop/src/locales`  | 67 个语言，18 MB | 仅 `en` + `zh_CN` |

保留机制不变：`default_locale: en`，中文缺键回退英文。上游新增语言包可直接拷回目录，无需改代码。

## 2026-11-24 阶段 1（无消费者的库）

| 删除项           | 体积  | 依据                                                   |
| ---------------- | ----- | ------------------------------------------------------ |
| `libs/pam`       | 17 KB | `grep -r @localpass/pam` 全仓库 0 引用                 |
| `libs/billing`   | 14 KB | 0 引用（`libs/common/src/billing` 是另一套模型，未动） |
| `libs/dirt/card` | 28 KB | 别名 `@localpass/dirt-card`，0 引用                    |

保留但**未删**的库（仍有消费者，删了会断）：`libs/pricing`（`libs/common` 的发票/折扣模型在用）、`libs/subscription`（`libs/common` 存储容量模型在用）、`libs/organization-invite-link`（`libs/angular` 服务在用）、`libs/automation-driver`（浏览器与桌面的 init 服务在用）。

## 瘦身结果

- 源码：188 MB / 10,510 文件 → **71 MB / 7,831 文件**（不含 `.git`、`node_modules`、构建产物）。
- 提交后 CI 会给出最终数字；`libs/pricing` 等剩余项要等对应业务改动一起评估。

## 2026-11-27 首次安装欢迎页

| 删除项                                                  | 原因                                                                                                                           | 上游路径                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 首次安装自动打开 `https://local.invalid/browser-start/` | 上游的欢迎页在本仓库指向永不解析的离线哨兵域名，打开后只有加载失败。首次安装的其余默认值（内联菜单可见性、托管环境 URL）保留。 | `apps/browser/src/platform/services/browser-initial-install.service.ts`          |
| `skipWelcomeOnInstall` dev flag                         | 只用于控制上面的欢迎页，随欢迎页一起删除。                                                                                     | `libs/common/src/platform/misc/flags.ts`、`apps/browser/config/development.json` |
