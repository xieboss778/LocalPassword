# 浏览器扩展弹窗规范

> **继承自:** `../MASTER.md`
> 若此页面与 Master 有冲突，本页面规则优先

**平台:** Chrome / Edge / Firefox / Safari  
**清单:** Manifest V3  
**尺寸:** 360px × 600px（固定，不可调整）  
**生命周期:** Service Worker (30s 超时)

---

## 平台约束

### 固定尺寸

- **宽度:** 360px (包含滚动条 6px)
- **高度:** 600px
- **最小内容区:** 348px × 600px
- **DPI 适配:** `window.devicePixelRatio` 处理 HiDPI 屏幕

### Service Worker 生命周期

- 活跃时间: 30 秒后自动休眠
- 后台任务: 使用 `chrome.alarms` (唤醒可靠)
- 状态同步: 存储到 `chrome.storage.local`，弹窗打开时读取
- 长时间任务: 避免阻塞事件循环，分片处理

### 权限模型

- Manifest `permissions`: `"storage"`, `"tabs"`, `"commands"`
- Manifest `host_permissions`: 匹配被管理网站
- 自动填充: 通过 `chrome.tabs.sendMessage()` 通信
- 内容脚本 ↔ Service Worker: 双向消息队列，收不到回复时超时处理

### 键盘快捷键

```json
{
  "commands": {
    "lock_vault": {
      "suggested_key": {
        "default": "Ctrl+Shift+L",
        "mac": "Cmd+Shift+L"
      },
      "description": "Lock the vault"
    },
    "toggle_popup": {
      "suggested_key": {
        "default": "Ctrl+Shift+P",
        "mac": "Cmd+Shift+P"
      }
    }
  }
}
```

---

## 组件布局

### 弹窗结构 (固定高度管理)

```css
.popup-container {
  width: 360px;
  height: 600px;
  display: flex;
  flex-direction: column;
  background: #192134;
  color: #e2e8f0;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  overflow: hidden;
}

.popup-header {
  position: sticky;
  top: 0;
  flex-shrink: 0;
  height: 56px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #192134;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.popup-search {
  flex-shrink: 0;
  height: 40px;
  margin: 8px 12px;
  padding: 0 12px;
  border: 1px solid #334155;
  border-radius: 4px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 14px;
}

.popup-search:focus {
  outline: none;
  border-color: #059669;
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.1);
}

.popup-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 468px;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

.popup-list::-webkit-scrollbar {
  width: 6px;
}

.popup-list::-webkit-scrollbar-track {
  background: transparent;
}

.popup-list::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

.popup-footer {
  flex-shrink: 0;
  height: 56px;
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  background: #192134;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
}
```

### 搜索框

```css
.popup-search {
  width: calc(100% - 24px);
  display: flex;
  align-items: center;
  gap: 8px;
}

.popup-search input {
  flex: 1;
  border: none;
  background: transparent;
  color: #e2e8f0;
  font-size: 14px;
}

.popup-search input::placeholder {
  color: #64748b;
}

.popup-search-icon {
  width: 20px;
  height: 20px;
  color: #94a3b8;
}

.popup-search input:focus {
  outline: none;
}

.popup-search:focus-within {
  border-color: #059669;
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.1);
}
```

### 保险库条目列表

```css
.vault-item {
  min-height: 60px;
  padding: 12px 12px;
  margin: 2px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 150ms ease;
  border-radius: 4px;
}

.vault-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.vault-item:active {
  background: rgba(255, 255, 255, 0.08);
}

.vault-item-icon {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 6px;
  background: #1e3a5f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.vault-item-info {
  flex: 1;
  min-width: 0;
}

.vault-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-item-subtitle {
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-item-actions {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 150ms ease;
}

.vault-item:hover .vault-item-actions {
  opacity: 1;
}

.vault-item-action {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vault-item-action:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.vault-item-action:active {
  background: rgba(255, 255, 255, 0.15);
}
```

### 快速操作按钮 (底部固定)

```css
.popup-footer {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #192134;
}

.quick-action-btn {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 150ms ease;
}

.quick-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.quick-action-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

.quick-action-btn.primary {
  background: #059669;
  color: #000000;
}

.quick-action-btn.primary:hover {
  background: #04945b;
}

.quick-action-btn.primary:active {
  background: #03804a;
}

.quick-action-icon {
  width: 16px;
  height: 16px;
}
```

### 空状态

```css
.empty-state {
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #64748b;
}

.empty-state-icon {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

.empty-state-title {
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
}

.empty-state-hint {
  font-size: 12px;
  color: #64748b;
  text-align: center;
}
```

### Toast 通知 (顶部右侧)

```css
.toast {
  position: fixed;
  top: 8px;
  right: 8px;
  max-width: 320px;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 4px;
  background: #1e3a5f;
  color: #f8fafc;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: slideIn 200ms ease;
  z-index: 1000;
}

.toast.success {
  border-left: 3px solid #059669;
}

.toast.error {
  border-left: 3px solid #ef4444;
}

.toast.info {
  border-left: 3px solid #3b82f6;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## 自动填充对话框

### 检测与触发

- 用户在登录表单输入用户名/邮箱
- 内容脚本向 Service Worker 发送 `detectForm` 消息
- Service Worker 返回匹配的保险库条目列表
- 弹窗通过 `chrome.action.openPopup()` 打开（或显示 Badge）

### 对话框样式

```css
.autofill-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 320px;
  max-height: 400px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 16px;
  z-index: 10000;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.autofill-item {
  min-height: 48px;
  padding: 8px 12px;
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 150ms ease;
}

.autofill-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.autofill-item:active {
  background: rgba(5, 150, 105, 0.2);
}

.autofill-confirm {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.autofill-confirm button {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.autofill-confirm .btn-confirm {
  background: #059669;
  color: #000000;
}

.autofill-confirm .btn-cancel {
  background: transparent;
  border: 1px solid #334155;
  color: #e2e8f0;
}
```

---

## 动画与过渡

| 场景         | 时长  | 缓动     |
| ------------ | ----- | -------- |
| 列表项进入   | 200ms | sine.out |
| 鼠标悬停     | 150ms | ease     |
| Toast 进入   | 200ms | ease     |
| 对话框淡入   | 200ms | ease-out |
| 弹窗内容转换 | 150ms | ease     |

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 通信协议 (Content Script ↔ Service Worker)

### 消息格式

```typescript
interface PopupMessage {
  type: "detectForm" | "getVaultItems" | "autofill" | "lock" | "unlock";
  payload?: Record<string, unknown>;
}

interface PopupResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### 时序

- 请求发送后 5 秒无回复 → 显示错误 Toast
- Service Worker 收到消息后 100ms 内必须 `sendResponse()`
- 长时间任务异步处理，回复 `{success:true}`，完成后通过 `chrome.runtime.sendMessage()` 通知

---

## 深色模式（强制）

扩展 UI 只支持深色模式，自动适应浅色系统主题但使用深色背景：

```css
/* 无论系统设置，始终深色 */
:root {
  color-scheme: dark;
  --bg-primary: #192134;
  --bg-secondary: #0f172a;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent: #059669;
}

@media (prefers-color-scheme: light) {
  /* 光照模式下仍使用深色调 */
  :root {
    --bg-primary: #192134;
    --bg-secondary: #0f172a;
  }
}
```

---

## 安全相关 UI

- **密码显示:** 点击眼睛图标切换
- **敏感数据:** 不在日志、Storage 中明文保存
- **剪贴板清除:** 复制后自动在 30 秒后清空，显示倒计时
- **错误消息:** 不包含密码或任何保险库数据，仅说明操作结果

---

## 无障碍 (a11y)

- 所有按钮带 `aria-label`
- 搜索框带 `aria-describedby` 说明
- 列表项使用 `role="listbox"` 和 `role="option"`
- Tab 键导航完整，Enter / Space 激活按钮
- 焦点始终可见（4px 蓝色边框）

```css
button:focus-visible,
input:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

---

## 交付检查清单

- [ ] 360×600px 固定尺寸，无滚动条占用
- [ ] 搜索框焦点时绿色边框 (#059669)
- [ ] 列表项悬停显示操作按钮，立即生效（无延迟）
- [ ] 底部快速操作按钮始终可见，无滚动影响
- [ ] 复制后显示 "已复制" Toast，30s 自动消失
- [ ] 密码字段鼠标悬停时显示 "复制密码" 按钮
- [ ] 自动填充对话框居中，遮罩半透明
- [ ] Tab 键可遍历所有交互元素
- [ ] 焦点环始终可见 (4px 蓝色)
- [ ] Service Worker 无长时间阻塞（>30s）
- [ ] 收不到消息时显示友好错误，不崩溃
- [ ] 敏感页面 iframe 中不显示弹窗
- [ ] prefers-reduced-motion 下所有动画关闭
