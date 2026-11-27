# LocalPass 设计系统

> **状态（2026-11-27）：设计探索，未落地。**
> 本目录描述的是一套尚未接入产品的视觉方向（深蓝/绿、360×600 弹窗、四平台 mockup）。
> 产品当前界面以 `design-system/legacy/prototypes/ui-redo-d/` 为准，
> 规范见 `docs/LocalPass-界面规范.md`。采用本设计系统前，必须先更新界面规范与屏对照表，
> 避免两份规范并行。

此目录包含 LocalPass 的设计系统及四个平台原型。

## 架构概览

### Master + 页面覆盖模式

设计系统采用双层架构：

1. **MASTER.md** — 全局设计规范，所有平台共享的基础规则
2. **pages/\*.md** — 平台特定覆盖规则，针对单一平台的细化约束

当页面规范与 Master 冲突时，**页面规则优先**。

### 目录结构

```
design-system/localpass/
├── MASTER.md              # 全局设计源
├── tokens.json            # W3C DTCG 格式设计令牌
├── preview.html           # 设计系统静态预览页
├── README.md              # 本文档
├── pages/                 # 平台特定规范
│   ├── windows.md         # Windows Fluent Design
│   ├── macos.md           # macOS Human Interface Guidelines
│   ├── android.md         # Android Material Design 3
│   └── popup-extension.md # 浏览器扩展弹窗 (Manifest V3)
└── prototypes/            # 交互式原型
    ├── windows-mockup.html
    ├── macos-mockup.html
    ├── android-mockup.html
    └── popup-mockup.html
```

## 如何使用

### 1. 阅读设计规范

**对于新功能或页面：**

1. 首先阅读 `MASTER.md` 了解全局设计语言
2. 然后阅读对应平台的 `pages/<platform>.md`
3. 页面规则覆盖 Master 中的冲突项

**示例：** 实现 Android 界面时

- 读取 `MASTER.md` → 获得颜色调色板、间距基准、动画时长
- 读取 `pages/android.md` → 获得 Material Design 3 特定组件、dp/sp 单位、48×48dp 触摸目标

### 2. 使用设计令牌

`tokens.json` 包含所有设计令牌的机器可读格式（W3C DTCG 标准）：

```json
{
  "color": {
    "primary": {
      "$value": "#1E3A5F",
      "$type": "color"
    }
  },
  "font": {
    "heading": {
      "$value": "Inter",
      "$type": "fontFamily"
    }
  }
}
```

**语义层：** 使用 `color.primary`、`color.on-primary`、`color.background`、`font.heading` 等语义令牌，而非直接硬编码色值。

### 3. 修改原型

所有原型均为**自包含 HTML 文件**，无需构建工具，可直接在浏览器中打开。

**修改步骤：**

1. 用文本编辑器打开 `prototypes/<platform>-mockup.html`
2. 修改 `<style>` 标签内的 CSS 或 `<script>` 内的交互逻辑
3. 在浏览器中刷新查看效果

**重要提醒：**

- 所有颜色必须使用 CSS 自定义属性（如 `var(--color-primary)`）
- 所有间距遵循 4px 基准网格（`4px`、`8px`、`12px`、`16px`...）
- 动画时长遵循 `MASTER.md` 中定义的缓动函数和时长

### 4. Tailwind CSS 集成

**关键规则：** 在实际项目中使用 Tailwind 时，**所有类名必须带 `tw-` 前缀**

```html
<!-- ✅ 正确 -->
<div class="tw-flex tw-p-4 tw-bg-background-alt2">
  <!-- ❌ 错误 (前缀缺失会导致样式失效) -->
  <div class="flex p-4 bg-background-alt2"></div>
</div>
```

**主题令牌：** 使用语义令牌而非原始 Tailwind 颜色：

- ✅ `tw-bg-background-alt2`、`tw-text-main`
- ❌ `tw-bg-gray-100`、`tw-text-red-500`

**禁止任意值：** 不要使用 Tailwind 任意值语法（如 `tw-[12px]`、`tw-text-[#ff0000]`）

主题令牌定义位于 `libs/components/tailwind.config.base.js`。

## 设计原则

### Apple 设计语言核心特征

1. **SF 风格排版** — 使用 Inter 字体（SF Pro 回退），清晰层级
2. **浅色/深色双模式** — 完整支持系统主题切换
3. **半透明材质** — 毛玻璃效果、背景模糊、透明度层次
4. **系统蓝强调色** — 主强调色 `#059669`（LocalPass 品牌绿）
5. **SF Symbols 兼容图标** — 所有图标使用 SVG（原型中为演示用 emoji，实际实现需替换为 SVG）
6. **宽松留白** — 慷慨的间距和内边距，视觉呼吸感

### 跨平台一致性

虽然每个平台有其特定设计系统（Fluent、HIG、Material Design 3），但 LocalPass 在以下方面保持一致：

- **颜色调色板：** `#1E3A5F`（主色）、`#059669`（强调色）、`#192134/#0F172A`（背景）
- **排版：** Inter 字体家族，统一字阶
- **间距基准：** 4px 网格系统
- **动画预设：** 150ms 悬停、200ms 进入、流畅缓动

## 无障碍指南

所有原型和实现必须满足 **WCAG AA** 标准：

### 对比度

- 正常文本：≥ 4.5:1
- 大号文本（18px 粗体 / 24px 常规）：≥ 3:1

### 焦点指示器

```css
button:focus-visible,
input:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

### 键盘导航

- Tab 键遍历所有交互元素
- Enter / Space 激活按钮
- ESC 关闭模态框和弹窗
- 焦点环始终可见（2px 蓝色边框，2px 偏移）

### ARIA 标签

- 所有按钮带 `aria-label`
- 图标按钮必须有可访问名称
- 表单输入带 `aria-describedby`
- 动态内容使用 `aria-live` 区域

### 减少动画

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 平台特定约束

### Windows (Fluent Design)

- **网格：** 4px 基准
- **窗口控件：** 右侧最小化/最大化/关闭按钮
- **云母材质：** 半透明背景效果
- **流畅动画：** 连接性动画、隐式过渡

### macOS (HIG)

- **网格：** 10pt 基准
- **交通灯按钮：** 左侧红/黄/绿窗口控件
- **SF Pro 字体：** 系统默认（原型使用 Inter 回退）
- **表单模态：** 从顶部滑入的 Sheet 动画

### Android (Material Design 3)

- **单位：** dp（密度无关像素）、sp（缩放像素用于文本）
- **触摸目标：** 最小 48×48dp
- **TopAppBar：** 56dp 高度标准应用栏
- **BottomSheet：** 从底部滑入的模态面板
- **Snackbar：** 底部消息通知

### 浏览器扩展弹窗 (Manifest V3)

- **固定尺寸：** 360px × 600px（不可调整）
- **Service Worker：** 30 秒超时限制
- **深色模式：** 强制深色主题（`#192134` 背景）
- **键盘快捷键：** `Ctrl/Cmd+Shift+L` 锁定、`Ctrl/Cmd+Shift+P` 切换弹窗
- **Toast 通知：** 右上角显示，200ms 滑入动画
- **剪贴板倒计时：** 复制后 30 秒自动清除

## 安全与隐私

**敏感数据处理：**

- 原型不连接真实保险库数据
- 仅使用合成示例数据
- 不在日志、`chrome.storage` 或错误消息中明文保存密码
- 复制后剪贴板自动清除（30 秒倒计时）

**实现要求：**

- 所有加密逻辑保持在既有仓库中
- 不向 API 服务发送未加密的保险库数据
- 不记录解密数据、加密密钥或 PII

## 验证检查清单

实现任何设计前，确保满足：

- [ ] 颜色使用 CSS 自定义属性或语义令牌
- [ ] 间距遵循 4px 网格（或平台特定网格）
- [ ] 所有动画时长与 `MASTER.md` 一致
- [ ] 图标为 SVG（非 emoji）
- [ ] 对比度满足 WCAG AA（≥ 4.5:1）
- [ ] 焦点环可见（2px 蓝色，2px 偏移）
- [ ] Tab 键可遍历所有交互元素
- [ ] `prefers-reduced-motion` 下动画禁用
- [ ] 触摸目标 ≥ 44×44px（或平台特定最小尺寸）
- [ ] ARIA 标签完整（按钮、表单、动态内容）

## 交付物清单

### 已完成

✅ `MASTER.md` — 全局设计规范  
✅ `tokens.json` — W3C DTCG 设计令牌  
✅ `preview.html` — 设计系统静态预览  
✅ `pages/windows.md` — Windows Fluent Design 规范  
✅ `pages/macos.md` — macOS HIG 规范  
✅ `pages/android.md` — Material Design 3 规范  
✅ `pages/popup-extension.md` — 浏览器扩展弹窗规范（584 行完整 CSS 类定义）  
✅ `prototypes/windows-mockup.html` — Windows 交互式原型  
✅ `prototypes/macos-mockup.html` — macOS 交互式原型  
✅ `prototypes/android-mockup.html` — Android 交互式原型  
✅ `prototypes/popup-mockup.html` — 浏览器扩展弹窗交互式原型（400+ 行）

### 待优化（已知质量问题）

⚠️ Windows/macOS/Android 原型需替换 emoji 图标为 SVG  
⚠️ 验证并修复 CSS 单位错误  
⚠️ 确保固定定位覆盖层不溢出设备框架  
⚠️ 添加 ESC 键实现（部分原型缺失）  
⚠️ 验证 WCAG AA 对比度合规性  
⚠️ 确保可点击 div 可聚焦（添加 `tabindex="0"`、`role="button"`）

## 资源链接

- [Web Clients Architecture](https://contributing.bitwarden.com/architecture/clients)
- [Fluent Design System](https://fluent2.microsoft.design/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design 3](https://m3.material.io/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [W3C Design Tokens Community Group](https://design-tokens.github.io/community-group/format/)

## 下一步

1. **迁移旧原型** — 将 `./prototype/*` 移至 `design-system/legacy/prototypes/`（已完成）
2. **创建导航页** — `design-system/localpass/index.html` 链接所有四个平台原型
3. **修复既有原型质量问题** — 替换 emoji、修复焦点管理、添加 ESC 键支持
4. **集成到实际代码库** — 在 Angular 组件中应用设计系统规范

---

**设计系统版本：** 1.0  
**最后更新：** 2026-11-27  
**维护者：** LocalPass Design Team
