# Windows Desktop 平台规范

> **继承自:** `../MASTER.md`
> 若此页面与 Master 有冲突，本页面规则优先

**平台:** Windows 10/11  
**应用类型:** Electron 桌面应用  
**屏幕分辨率:** 375px - 4K+  
**输入法:** 鼠标、键盘、触摸屏（部分设备）

---

## 平台约束

### 窗口尺寸

- 最小宽度: 600px
- 最小高度: 400px
- 推荐初始宽高: 1200px × 700px
- 支持最大化、最小化、关闭按钮（标题栏右上）

### 任务栏集成

- 支持任务栏固定（Win+Shift+右键菜单）
- 跳转列表（Jump List）：显示最近的 5 个条目
- 窗口预览（Alt+Tab）显示缩略图
- 进度条显示在任务栏按钮（同步进度）

### 原生 UI 元素

- 滚动条: Windows 原生样式（深色: `#2D3748`）
- 右键菜单: Windows 上下文菜单风格
- 对话框: 居中于父窗口
- 通知: Windows 10 Toast（右下角）

### 字体

- 优先: **Inter** (web 加载失败时降级)
- 降级: **Segoe UI** (Windows 系统字体)
- Monospace: **Consolas** (密码、加密 key 显示)

---

## 交互模式

### 键盘快捷键

| 快捷键   | 功能        |
| -------- | ----------- |
| `Ctrl+L` | 锁定保险库  |
| `Ctrl+N` | 新建条目    |
| `Ctrl+F` | 搜索        |
| `Ctrl+C` | 复制密码    |
| `Ctrl+V` | 粘贴用户名  |
| `Ctrl+Q` | 退出应用    |
| `Alt+F4` | 关闭窗口    |
| `Ctrl+,` | 打开设置    |
| `F1`     | 帮助 / 文档 |
| `Alt+←`  | 返回上级    |

### 右键菜单

- **条目上右键:**
  - 复制用户名
  - 复制密码
  - 编辑
  - 删除
  - 分享（如果启用）

### 拖放（Drag & Drop）

- 条目可拖放到文件夹中重新分类
- 密码可拖放到浏览器表单自动填充
- 文件可拖放到密码条目的附件区域

### 鼠标动作

- 悬停: 显示"复制"按钮、编辑按钮
- 双击: 打开编辑模态框
- Ctrl+Click: 多选条目

---

## 组件适配

### 按钮

```css
/* 主按钮 */
.btn-primary {
  background: #059669;
  color: #000000;
  padding: 10px 20px;
  border-radius: 4px; /* Windows Fluent 风格 */
  border: none;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

.btn-primary:focus {
  outline: 2px solid #059669;
  outline-offset: 2px;
}
```

### 侧边栏

```css
.sidebar {
  width: 200px;
  background: #192134;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 0;
  overflow-y: auto;
}

.sidebar-item {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background 150ms ease;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.sidebar-item.active {
  background: #1e3a5f;
  border-left: 3px solid #059669;
  padding-left: 13px;
}
```

### 条目列表

```css
.vault-list {
  flex: 1;
  overflow-y: auto;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 280px;
}

.vault-item {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: background 100ms ease;
}

.vault-item:hover {
  background: rgba(5, 150, 105, 0.1);
}

.vault-item-info {
  flex: 1;
}

.vault-item-title {
  font-weight: 600;
  color: #ffffff;
  font-size: 14px;
}

.vault-item-username {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 4px;
}

.vault-item-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
}

.vault-item:hover .vault-item-actions {
  opacity: 1;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(5, 150, 105, 0.2);
  color: #059669;
  border-radius: 4px;
  cursor: pointer;
  transition: all 100ms ease;
}

.action-btn:hover {
  background: #059669;
  color: #000000;
}
```

### 搜索框

```css
.search-box {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 8px 12px;
  margin: 16px;
  transition: all 150ms ease;
}

.search-box:focus-within {
  border-color: #059669;
  background: rgba(5, 150, 105, 0.1);
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
}

.search-box input {
  background: transparent;
  border: none;
  color: #ffffff;
  flex: 1;
  font-size: 14px;
  outline: none;
}

.search-box input::placeholder {
  color: #64748b;
}
```

### 模态对话框

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 24px;
  max-width: 500px;
  width: 90vw;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.3);
  animation: slideUp 200ms ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 16px;
}

.modal-body {
  margin-bottom: 24px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
```

---

## 响应式布局

### 断点设置

| 宽度    | 布局     | 说明                         |
| ------- | -------- | ---------------------------- |
| 375px   | 单列     | 侧边栏收起为图标，列表全宽   |
| 600px   | 双列     | 侧边栏 + 条目列表            |
| 1024px  | 三列     | 侧边栏 + 条目列表 + 详情面板 |
| 1440px+ | 三列扩展 | 详情面板加宽，显示预览       |

### 侧边栏响应式

```css
/* < 768px: 收起侧边栏 */
@media (max-width: 768px) {
  .sidebar {
    width: 60px;
    padding: 12px 0;
  }

  .sidebar-item {
    padding: 12px;
    justify-content: center;
  }

  .sidebar-label {
    display: none;
  }

  .sidebar-toggle {
    display: block;
  }
}

/* < 600px: 完全隐藏侧边栏 */
@media (max-width: 600px) {
  .sidebar {
    position: absolute;
    left: -200px;
    width: 200px;
    height: 100vh;
    z-index: 999;
    transition: left 200ms ease;
  }

  .sidebar.open {
    left: 0;
  }

  .sidebar-toggle {
    display: block;
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 1000;
  }
}
```

---

## 深色模式

默认启用深色模式，遵循 Master 色彩方案。

| 元素       | 颜色                     | 说明     |
| ---------- | ------------------------ | -------- |
| 背景       | `#0F172A`                | 主背景   |
| 卡片       | `#192134`                | 次级容器 |
| 边框       | `rgba(255,255,255,0.08)` | 分隔线   |
| 文字       | `#FFFFFF`                | 主文字   |
| 文字(辅助) | `#94A3B8`                | 辅助文字 |
| 强调       | `#059669`                | CTA/选中 |

---

## 动效规范

### 页面转换

```js
// 条目列表加载
gsap.from(".vault-item", {
  opacity: 0,
  x: -16,
  duration: 0.3,
  stagger: { each: 0.03, from: "start" },
  ease: "back.out(1.2)",
});
```

### 按钮交互

- **正常 → 悬停**: 150ms，opacity 变化 + 1px 上移
- **按下**: 50ms，向下压效果
- **释放**: 100ms，回弹到正常态

### 模态出现

```js
gsap.from(".modal", {
  opacity: 0,
  y: 20,
  scale: 0.95,
  duration: 250,
  ease: "back.out(1.4)",
});
```

---

## 通知系统

### 系统 Toast

```css
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #192134;
  border: 1px solid rgba(5, 150, 105, 0.5);
  border-left: 3px solid #059669;
  padding: 12px 16px;
  border-radius: 4px;
  color: #ffffff;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideInRight 200ms ease;
  z-index: 1001;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.toast.error {
  border-left-color: #dc2626;
}

.toast.success {
  border-left-color: #059669;
}
```

---

## 无障碍合规

✅ **必须遵守:**

- [ ] 所有交互元素 TAB 可聚焦
- [ ] 聚焦状态可见 (2px 外轮廓)
- [ ] 键盘快捷键说明在帮助菜单
- [ ] 文字对比 4.5:1 以上 (WCAG AA)
- [ ] `prefers-reduced-motion: reduce` 禁用动效
- [ ] 屏幕阅读器标签 (`aria-label`)

---

## 交付前检查清单

- [ ] 所有按钮 hover 状态在 150-300ms 内完成
- [ ] 右键菜单显示正确
- [ ] 窗口最小化后能正常恢复
- [ ] 搜索框焦聚时显示蓝色边框
- [ ] 条目删除后有撤销按钮（5秒）
- [ ] 锁定后需要重新输入主密码
- [ ] 同步进度显示在进度条
- [ ] 离线模式显示警告横幅
