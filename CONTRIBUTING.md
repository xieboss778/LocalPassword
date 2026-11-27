# 参与贡献

感谢你愿意为 LocalPass 出力。这是一个离线密码管理器，安全性和可审查性比功能速度更重要，因此下面这些约定请认真读一遍。

## 开始之前

- 先看 [README](README.md) 了解项目定位，再看 [文档索引](docs/README.md) 与 [docs/LocalPass-实施计划.md](docs/LocalPass-实施计划.md) 了解架构决策和当前状态。
- 较大的改动（新增依赖、修改保险库写入路径、改动加密相关代码）请**先开 issue 讨论**，避免白做工。
- 参与本项目即表示你同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 环境准备

需要 Node.js（版本见 `.nvmrc`）与 npm。

```bash
git clone https://github.com/xieboss778/LocalPass.git
cd LocalPass
npm ci
npm run build:chrome
```

构建产物在 `apps/browser/build`，用 `chrome://extensions` 的「加载已解压的扩展程序」加载即可调试。

## 分支与提交

- 从 `main` 切出功能分支：`feat/xxx`、`fix/xxx`、`docs/xxx`；合并后删除该分支，长期只保留 `main`。
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：
  - `feat: 支持从 Google Authenticator 导入`
  - `fix(popup): 弹出页关闭后同步中断`
  - `docs: 补充 R2 配置说明`
- 一个 PR 只做一件事。格式化、重命名之类的无关改动请单独提交。
- 提交前请确保 `npm run lint` 与 `npm test` 通过。

## 代码要求

1. **不要引入网络请求。** 除备份存储和用户主动触发的泄露查询外，任何新的出站请求都需要在 PR 里说明理由，并经过维护者确认。
2. **不要绕过加密。** 条目必须先经 SDK 加密再落盘，明文不得写入 `chrome.storage`、日志或错误上报。
3. **改动保持局部化。** 优先新建文件承载逻辑；必须改共享文件时，把改动控制在尽量少的行数，并在 PR 描述里列出位置，便于审计与后续维护。本仓库独立维护，**不合并上游代码**，不要为了“方便以后同步”而设计改动。
4. **不要碰 `localpass_license/` 目录。** 该目录在上游适用另一套许可，本项目不包含、也不修改其中的代码。
5. **补充测试。** 涉及加密、同步合并、本地写入的改动必须有单元测试覆盖。

## 文档

- 文档在 `docs/`，索引是 [docs/README.md](docs/README.md)。改代码行为、路径、命令或状态时，在同一个 PR 里更新对应文档。
- 不保留重复或过期文档：一份事实一个来源；被取代的文档直接删除，需要历史时从 git 取。
- 未实施的方案必须在文档头部标注「待评审 / 未实施」，不能写得像现状。
- 界面以 [design-system/agy/](design-system/agy/) 与 [屏对照表](docs/LocalPass-%E5%B1%8F%E5%AF%B9%E7%85%A7%E8%A1%A8.md) 为目标规范（各屏当前实现程度见对照表「现状」列）；同步以 `libs/local-vault` 与 [离线优先与 R2 同步设计](docs/LocalPass-%E7%A6%BB%E7%BA%BF%E4%BC%98%E5%85%88%E4%B8%8ER2%E5%90%8C%E6%AD%A5%E8%AE%BE%E8%AE%A1.md) 为准。
- 术语按 [GLOSSARY.md](GLOSSARY.md)：区分「同步」「导出」「恢复」，不要把「备份」当机制名。

## 数据库 / 状态变更

新增持久化状态时，需在对应的 `state-definitions.ts` 中注册，并说明是否兼容旧数据。破坏性变更必须在 PR 中写明迁移方案。

## 报告问题

- 功能缺陷或建议：使用 issue 模板提交。
- 安全漏洞：**不要开公开 issue**，请按 [SECURITY.md](SECURITY.md) 的流程私下报告。

## 许可

你提交的代码将以 [GNU GPL v3.0](LICENSE) 发布。提交 PR 即表示你确认自己有权提交这些代码，并同意以上许可条款。
