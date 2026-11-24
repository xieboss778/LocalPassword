# 上游工作流归档

这里保存的是从 [bitwarden/clients](https://github.com/bitwarden/clients) 随源码一起继承的
GitHub Actions 工作流，**默认不启用**。

## 为什么移出 `.github/workflows/`

GitHub 只会执行 `.github/workflows/` 下的工作流。上游的这套流程是为 Bitwarden 官方仓库设计的：

- 大量任务依赖 Bitwarden 内部的 secrets（签名证书、发布令牌、Crowdin、Chromatic、
  Slack / Jira 集成等），在本仓库中必然失败。
- 部分流程（自动打标签、自动回复、cherry-pick、版本号自动提升、发布到应用商店）
  直接对应上游的发布节奏，对本项目没有意义，甚至可能做错事。
- 它们会在每次 push / PR 时制造大量红色 ✗，把真正需要注意的问题淹没掉。

因此这些文件被整体移动到这里作为参考，而不是删除 —— 需要的时候可以把单个文件搬回
`.github/workflows/`，并修改其中依赖 secrets 的部分。

## 对本项目有参考价值的

| 文件 | 用途 |
|---|---|
| `lint.yml` | ESLint / Prettier 检查，可作为本项目 CI 的起点 |
| `test.yml` | 单元测试 |
| `build-browser.yml` | 浏览器扩展构建（`npm run build:chrome`） |
| `build-browser-target.yml` | 构建流程的可复用工作流 |

如果需要搭建本项目的 CI，建议基于上面几个精简重写，去掉 secrets 依赖，
只保留 `npm ci` → `npm run lint` → `npm test` → `npm run build:prod:chrome`。
