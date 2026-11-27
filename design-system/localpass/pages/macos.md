# macOS Desktop 平台规范

> **继承自:** `../MASTER.md`
> 若此页面与 Master 有冲突，本页面规则优先

**平台:** macOS 12+  
**应用类型:** Native Electron App (Cocoa-style)  
**屏幕分辨率:** 320pt - 6K+ (Retina display @2x)  
**输入法:** 触控板、键盘、Magic Mouse（可选）

---

## 平台约束

### 窗口设计

- 最小宽度: 640pt（@1x, 320dp）
- 最小高度: 480pt（@1x, 240dp）
- 推荐初始宽高: 1200pt × 800pt
- 原生 macOS 标题栏（traffic lights: 红-黄-绿 按钮，左对齐）
- 窗口圆角: 10pt（macOS Big Sur+ 风格）
- 半透明背景: 支持（使用 vibrancy 效果）

### 菜单栏集成

- App 菜单: `LocalPass` → 关于、偏好设置、退出
- 编辑菜单: 撤销、重做、剪切、复制、粘贴、全选
- 视图菜单: 侧边栏开关、全屏
- 帮助菜单: 搜索帮助、文档链接

### Touch Bar 支持（如适用）

- 锁定保险库按钮
- 搜索输入框
- 新建条目按钮

### 触控板手势

- **双指滑动左右**: 返回 / 前进导航
- **三指向下轻扫**: 查看所有窗口（Mission Control）
- **双指点击**: 右键菜单
- **捏合缩放**: 调整字体大小（可选）

### 字体

- **优先:** Inter (web 加载失败时降级)
- **系统降级:** SF Pro (macOS 系统字体，`.AppleSystemUIFont`)
- **Monospace:** SF Mono (密码、key 显示，系统对等)

### 颜色与深色模式

- 自动适应系统深色 / 浅色模式
- 浅色模式: 白底 + 深灰文字
- 深色模式: Master 色系（#0F172A 背景）

---

## 交互模式

### 键盘快捷键（macOS 约定）

| 快捷键            | 功能                    |
| ----------------- | ----------------------- |
| `Cmd+L`           | 锁定保险库              |
| `Cmd+N`           | 新建条目                |
| `Cmd+F`           | 搜索                    |
| `Cmd+C`           | 复制密码                |
| `Cmd+V`           | 粘贴用户名              |
| `Cmd+Q`           | 退出应用                |
| `Cmd+W`           | 关闭窗口                |
| `Cmd+,`           | 打开设置 / 偏好设置     |
| `Cmd+?`           | 打开帮助 / 显示帮助菜单 |
| `Cmd+[` / `Cmd+]` | 返回 / 前进             |
| `Cmd+Shift+L`     | 显示/隐藏侧边栏         |
| `Cmd+Option+I`    | 开发者工具（开发模式）  |

### 右键菜单（Contextual Menu）

```css
.context-menu {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 4px 0;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
  animation: fadeIn 150ms ease;
}

.context-menu-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
}

.context-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.context-menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px 0;
}
```

### 触控板交互提示

```css
.swipe-hint {
  position: fixed;
  bottom: 20px;
  left: 20px;
  font-size: 12px;
  color: #94a3b8;
  pointer-events: none;
}

.swipe-gesture-indicator {
  display: flex;
  gap: 8px;
  align-items: center;
  opacity: 0.6;
}

/* 两根手指图标：← → */
.gesture-icon {
  width: 24px;
  height: 24px;
  display: inline-block;
}
```

---

## 组件适配

### 侧边栏（Sidebar）- macOS 风格

```css
.sidebar {
  width: 180pt;
  background: rgba(242, 242, 247, 1); /* 浅色模式 */
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  padding: 12pt 0;
  overflow-y: auto;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .sidebar {
    background: rgba(25, 33, 52, 1); /* #192134 */
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }
}

.sidebar-item {
  padding: 8pt 12pt;
  display: flex;
  align-items: center;
  gap: 10pt;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6pt;
  margin: 0 8pt;
  transition: background 150ms ease;
}

.sidebar-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

@media (prefers-color-scheme: dark) {
  .sidebar-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

.sidebar-item.active {
  background: rgba(5, 150, 105, 0.15);
  color: #059669;
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .sidebar-item.active {
    background: rgba(5, 150, 105, 0.2);
  }
}
```

### Sheet Modal（macOS 风格）

```css
/* 不使用 modal-overlay + centered modal，而是 sheet */
.sheet-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.sheet-content {
  background: rgba(255, 255, 255, 1);
  border-radius: 12pt 12pt 0 0;
  width: 100%;
  max-height: 80vh;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
  animation: slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
}

@media (prefers-color-scheme: dark) {
  .sheet-content {
    background: rgba(15, 23, 42, 1);
  }
}

.sheet-header {
  position: sticky;
  top: 0;
  padding: 16pt 24pt;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (prefers-color-scheme: dark) {
  .sheet-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
}

.sheet-close-btn {
  width: 28pt;
  height: 28pt;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 6pt;
  cursor: pointer;
  font-size: 18px;
  color: #333;
  transition: background 150ms ease;
}

@media (prefers-color-scheme: dark) {
  .sheet-close-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
}

.sheet-close-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
```

### Native Buttons

```css
.btn-primary-macos {
  background: #059669;
  color: #ffffff;
  padding: 6pt 16pt;
  border-radius: 6pt;
  border: none;
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-primary-macos:hover {
  opacity: 0.9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.btn-primary-macos:active {
  transform: scale(0.98);
}

.btn-secondary-macos {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
  padding: 6pt 16pt;
  border-radius: 6pt;
  border: none;
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms ease;
}

@media (prefers-color-scheme: dark) {
  .btn-secondary-macos {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
}

.btn-secondary-macos:hover {
  background: rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  .btn-secondary-macos:hover {
    background: rgba(255, 255, 255, 0.15);
  }
}
```

### 条目列表

```css
.vault-item-macos {
  padding: 8pt 12pt;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  border-radius: 6pt;
  margin: 0 8pt;
  transition: background 150ms ease;
}

@media (prefers-color-scheme: dark) {
  .vault-item-macos {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
}

.vault-item-macos:hover {
  background: rgba(0, 0, 0, 0.04);
}

@media (prefers-color-scheme: dark) {
  .vault-item-macos:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}

.vault-item-title {
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

@media (prefers-color-scheme: dark) {
  .vault-item-title {
    color: #ffffff;
  }
}

.vault-item-username {
  color: #999;
  font-size: 11px;
  margin-top: 2pt;
}

@media (prefers-color-scheme: dark) {
  .vault-item-username {
    color: #94a3b8;
  }
}
```

---

## 响应式布局

### 断点设置

| 宽度    | 布局     | 说明                         |
| ------- | -------- | ---------------------------- |
| 320pt   | 单列     | 侧边栏收起为图标             |
| 640pt   | 双列     | 侧边栏 + 条目列表            |
| 1024pt  | 三列     | 侧边栏 + 条目列表 + 详情面板 |
| 1440pt+ | 三列扩展 | 详情面板加宽                 |

### 安全区域

```css
@supports (padding: max(0px)) {
  .app-container {
    padding-left: max(16pt, env(safe-area-inset-left));
    padding-right: max(16pt, env(safe-area-inset-right));
    padding-top: max(16pt, env(safe-area-inset-top));
  }
}
```

---

## 浅色 / 深色模式

### 浅色模式（Light）

```css
@media (prefers-color-scheme: light) {
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f7;
    --text-primary: #000000;
    --text-secondary: #666666;
    --border-color: rgba(0, 0, 0, 0.1);
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
}
```

### 深色模式（Dark）

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0f172a;
    --bg-secondary: #192134;
    --text-primary: #ffffff;
    --text-secondary: #94a3b8;
    --border-color: rgba(255, 255, 255, 0.1);
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}
```

---

## 动效规范

### 页面转换

```js
// 条目列表加载（macOS 风格 - 更温和）
gsap.from(".vault-item-macos", {
  opacity: 0,
  y: -8,
  duration: 0.25,
  stagger: { each: 0.02, from: "start" },
  ease: "sine.out",
});
```

### 触控板手势反馈

```js
// 双指滑动返回时的视觉反馈
gsap.to(".content", {
  x: -20,
  duration: 150,
  ease: "power2.out",
  onComplete: () => {
    gsap.to(".content", { x: 0, duration: 100 });
  },
});
```

### Sheet Modal 出现

```js
gsap.from(".sheet-content", {
  y: "100%",
  duration: 0.3,
  ease: "cubic.inOut",
});
```

---

## 通知系统

### Notification Center Integration

```css
.notification {
  position: fixed;
  top: 20pt;
  right: 20pt;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 8pt;
  padding: 12pt 16pt;
  color: #ffffff;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideInRight 200ms ease;
  z-index: 1001;
}

@media (prefers-color-scheme: light) {
  .notification {
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
}

.notification.success {
  border-left: 3px solid #34c759;
}

.notification.error {
  border-left: 3px solid #ff3b30;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20pt);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## 无障碍合规

✅ **必须遵守:**

- [ ] VoiceOver 兼容性测试（Cmd+F5）
- [ ] 键盘导航全覆盖（Tab / Shift+Tab）
- [ ] 聚焦状态可见（蓝色外轮廓）
- [ ] 文字对比度 4.5:1 以上（浅色模式）
- [ ] `prefers-reduced-motion` 尊重
- [ ] 菜单项有快捷键标签
- [ ] `aria-label` 用于图标按钮

---

## 交付前检查清单

- [ ] 菜单栏集成所有必要功能
- [ ] Touch Bar 按钮（如支持）正常工作
- [ ] 浅色 / 深色模式自动切换
- [ ] 触控板手势有反馈（视觉 + 触觉 if available）
- [ ] 窗口最小化后能正常恢复
- [ ] Sheet modal 从底部滑上（不是中心弹出）
- [ ] 右键菜单显示原生 macOS 风格
- [ ] VoiceOver 能读出所有内容
- [ ] Keyboard-only 操作完全可行
- [ ] @2x Retina 屏幕分辨率正确
- [ ] 应用图标 / 文档图标配置正确
