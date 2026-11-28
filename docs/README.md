# LocalPass 文档索引

> 最后核对：2026-11-28　｜　原型基线：`design-system/agy/`（73 屏）　｜　代码基线：`main` @ `5fbb3f1e`（含当前工作树）
>
> 本索引只列**当前有效**的文档。过期文档直接删除，不留在 `docs/` 里制造第二份事实；
> 历史版本从 git 记录取。

## 先读什么

| 角色           | 阅读顺序                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 第一次接触项目 | 根目录 [README](../README.md) → 本文 → [实施计划](./LocalPass-实施计划.md)                                                |
| 改代码         | 根目录 [AGENTS.md](../AGENTS.md) / [CONTRIBUTING](../CONTRIBUTING.md) → 相关规范                                          |
| 改界面         | [界面规范](./LocalPass-界面规范.md) → [屏对照表](./LocalPass-屏对照表.md) → [AGY 原型](../design-system/agy/index.html)   |
| 改同步/存储    | [实施计划](./LocalPass-实施计划.md) 阶段 4 → [R2 同步设计](./LocalPass-离线优先与R2同步设计.md) → `libs/local-vault/src/` |
| 发布前验证     | [验证清单](./LocalPass-验证清单.md)                                                                                       |

## 当前文档

| 文档                                                                     | 说明                                                              | 对应代码/事实来源                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [LocalPass-实施计划.md](./LocalPass-实施计划.md)                         | 阶段 0–7、当前执行状态、验证基线、风险与不在范围                  | `apps/`、`libs/local-vault`、`.github/workflows/localpass.yml`          |
| [LocalPass-离线优先与R2同步设计.md](./LocalPass-离线优先与R2同步设计.md) | 自动同步 v2 的**待评审设计**；当前未实施，现状是手动同步          | `libs/local-vault/src/sync`、`src/s3`、`src/network`                    |
| [LocalPass-界面规范.md](./LocalPass-界面规范.md)                         | **AGY Compact v4** 令牌、4px 紧凑密度、8 类条目、平台与隐私规则   | [design-system/agy/](../design-system/agy/)、`tw-theme.css`、`local-ui` |
| [LocalPass-屏对照表.md](./LocalPass-屏对照表.md)                         | 73 个 AGY 原型屏 → 实现落点 → 当前完成度（72 ✅ + 1 —）与已知差异 | `apps/browser`、`apps/desktop`、`libs/angular`                          |
| [LocalPass-安装与恢复.md](./LocalPass-安装与恢复.md)                     | 扩展/桌面安装、R2 配置（一桶一库）、同步、导出、恢复与安全说明    | 设置页、`account.json`、`backup-layout.ts`                              |
| [LocalPass-验证清单.md](./LocalPass-验证清单.md)                         | CI 覆盖不到的人工验证步骤与已知限制                               | 实机验证、CI jobs                                                       |
| [LocalPass-品牌与身份.md](./LocalPass-品牌与身份.md)                     | 运行期身份、包标识、允许保留的上游名字、验收命令                  | `manifest.v3.json`、`electron-builder.json`、`build/package.json`       |
| [LocalPass-竞品分析-1Password.md](./LocalPass-竞品分析-1Password.md)     | 1Password 对比、体验差距、P0–P3 缺口与规格级建议                  | 调研报告（非实现承诺）                                                  |
| [removed-from-upstream.md](./removed-from-upstream.md)                   | 删除项与来源路径映射；只用于追溯，不是上游跟踪计划                | git 历史 / 来源基线                                                     |

根目录另有两份跨文档约定：

- [GLOSSARY.md](../GLOSSARY.md)：账号、保险库、桶、同步、快照、导出、恢复等术语。
  文档与代码命名以此为准；「备份」不得单独作为机制名。
- [AGENTS.md](../AGENTS.md)：代理工作流、验证要求、代码边界。

## 设计参考（不是产品代码）

| 位置                                                                                        | 状态                                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [design-system/agy/](../design-system/agy/)                                                 | **当前目标 UI/UX 规范**（73 屏：三端联动 1 + Mac 29 + 扩展 29 + 网页内联 14）；72 个产品屏已对齐（✅），`link-sandbox` 为演示辅助页（—），逐屏落点见屏对照表 |
| [design-system/legacy/prototypes/ui-redo-d/](../design-system/legacy/prototypes/ui-redo-d/) | 旧版视觉基准（58 屏，已被 AGY 原型取代；仅作已上线初版代码追溯对照）                                                                                         |
| [design-system/legacy/prototypes/ui-redo-c/](../design-system/legacy/prototypes/ui-redo-c/) | 已归档的方向 C 原型；只作历史对照，不再作为落地依据                                                                                                          |
| [design-system/legacy/prototypes/ui-redo/](../design-system/legacy/prototypes/ui-redo/)     | 更早的草图；历史资料                                                                                                                                         |
| [design-system/localpass/](../design-system/localpass/)                                     | 另一套早期探索 mockup；历史参考，不作为实现依据                                                                                                              |

原型只作视觉与交互参考；数据全部为合成值，不接入真实保险库，也不进产品构建。`design-system/agy/` 附带交互自检脚本 `node design-system/agy/check.js`。

## 已删除的过期文档

以下文档或目录已被取代并从工作树移除，需要时从 git 历史取：

| 删除项                                            | 原因                                                             | 现在看哪里                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/adr/`                                       | 单条 R2 一桶一库决策已并入同步设计与实施计划，不再单设目录       | [实施计划](./LocalPass-实施计划.md)、[R2 同步设计](./LocalPass-离线优先与R2同步设计.md) |
| `docs/agents/`                                    | 未启用外部 issue-tracker/triage 技能流，规范统一收口 `AGENTS.md` | [AGENTS.md](../AGENTS.md)、[GLOSSARY.md](../GLOSSARY.md)                                |
| `docs/prototypes/ui-next/`                        | 被交互式全端原型 `design-system/agy/` 取代                       | [design-system/agy/](../design-system/agy/)                                             |
| `LocalPass-实现计划.md`                           | 基于已归档的 ui-redo-c；屏幕映射、阶段清单与验证矩阵均过期       | 界面规范、屏对照表、实施计划                                                            |
| `LocalPass-进度核查.md`                           | 2026-11-25 的中间快照，仍称 `libs/local-vault` 为死代码          | 实施计划「执行状态」与验证基线                                                          |
| `LocalPass-开发规则.md`                           | “本地不构建/不测试”与 AGENTS.md、CLAUDE.md 及实际流程冲突        | AGENTS.md、CONTRIBUTING.md、本索引                                                      |
| `docs/cipher-types.md`                            | 上游 cipher type 参考，仍描述已删除的 CLI/Server 与旧类型集合    | `libs/common/src/vault/enums/cipher-type.ts`                                            |
| `docs/using-nx-to-build-projects.md`              | 命令含已删除的 CLI 与 commercial/localpass license 配置          | 根 `package.json`、各项目 `project.json`                                                |
| 根目录 `prototype/`、`prototype-inline-menu.html` | 与 `design-system/legacy/prototypes/` 完全重复                   | 上面的设计参考                                                                          |

## 维护规则

1. **同一次改动里更新文档。** 改代码行为、路径、命令或状态时，同步更新对应文档；
   不要留下“以后补”。
2. **文档只描述已存在的事实。** 未实施的方案必须显式标注「待评审 / 未实施」
   （参考同步设计文档的头部状态块与屏对照表状态列）。
3. **一份事实一个来源。** 界面目标以 [design-system/agy/](../design-system/agy/) + [屏对照表](./LocalPass-屏对照表.md) 为准，同步与实现以代码 + [实施计划](./LocalPass-实施计划.md) 为准；
   出现第二份重复文档时，合并或删除，而不是两边都改。
4. **跨文档使用 GLOSSARY 的术语。** 「同步」是快照镜像，「导出」是标准 JSON；
   「备份」只在 UI 名称或用户口语里出现。
5. **不添加上游 remote。** 文档中的「上游」只用于来源说明，不构成拉取、合并、
   拣选补丁或同步的计划。

## 文档状态标记

需要在文档头部写清状态时，使用这三档：

- **当前（current）**：与代码一致，可以直接照做。
- **设计（proposed）**：已评审或待评审的方案，代码尚未实现；必须写「未实施 / 待实施」。
- **归档（archived）**：仅供追溯，不再维护；链接到替代文档。
