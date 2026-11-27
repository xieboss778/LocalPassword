# Android 平台规范

> **继承自:** `../MASTER.md`
> 若此页面与 Master 有冲突，本页面规则优先

**平台:** Android 11+  
**应用类型:** Native Android App (Material Design 3)  
**屏幕分辨率:** 320dp - 1440dp+ (支持折叠屏)  
**输入法:** 触摸、Back按钮、音量键（可选）

---

## 平台约束

### 安全区域

- 状态栏: 24dp 高度 (或使用 insets API)
- 底部导航: 56dp 高度
- 软键盘: 自动调整 (android:windowSoftInputMode="adjustResize")
- 折叠屏: 使用 FoldingFeature API，检测折叠线位置

### 屏幕分辨率与断点

- **小屏 (320-479dp):** 单列布局，底部导航
- **中屏 (480-719dp):** 双列 (侧边栏 + 条目)
- **大屏 (720+dp):** 三列 (侧边栏 + 条目 + 详情)
- **平板 (1024+dp):** 多窗格，Master-Detail

### 触摸目标

- 最小尺寸: 48×48dp (Material 3 标准)
- 间距: 8dp 最小
- 长按反馈: 400-600ms，显示 Tooltip

### 字体

- **Headline Font:** Inter (web 加载失败时降级)
- **Body Font:** Inter (web 加载失败时降级)
- **系统降级:** Roboto (Android 系统字体)
- **Monospace:** Roboto Mono

### 颜色与深色模式

- 自动适应系统深色 / 浅色模式
- 浅色模式: 白底 + 深灰文字
- 深色模式: Master 色系 (#0F172A 背景)
- 高对比度模式: 自动适应 (android:textColorPrimary 访问系统颜色)

---

## 交互模式

### 手势

- **向下滑动:** 下拉刷新 (SwipeRefreshLayout)
- **长按:** 显示上下文菜单 (ActionMode)
- **双指捏合:** 缩放 (ScaleGestureDetector)
- **返回按钮:** 返回上级，双按退出应用

### 键盘快捷键

- **返回按钮:** 返回 / 锁定保险库
- **搜索按钮:** 打开搜索
- **菜单按钮 (三点):** 更多操作 (OverflowMenu)
- **音量+:** 显示条目详情 (可选)

### 右键菜单 (ActionMode)

- 复制用户名
- 复制密码
- 编辑
- 删除
- 分享 (如果启用)

---

## 组件适配

### FloatingActionButton (FAB)

```css
/* FAB 主色 */
.fab {
  width: 56dp;
  height: 56dp;
  background: #059669;
  color: #000000;
  border-radius: 16dp; /* Material 3 FAB shape */
  box-shadow: 0 4dp 12dp rgba(0, 0, 0, 0.15);
  position: fixed;
  bottom: 16dp;
  right: 16dp;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24sp;
  cursor: pointer;
  transition: all 200ms ease;
  z-index: 100;
}

.fab:hover {
  box-shadow: 0 6dp 16dp rgba(0, 0, 0, 0.2);
  transform: scale(1.1);
}

.fab:active {
  transform: scale(0.95);
  box-shadow: 0 2dp 8dp rgba(0, 0, 0, 0.1);
}
```

### BottomSheet Modal

```css
.bottom-sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.bottom-sheet-content {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #0f172a;
  border-radius: 16dp 16dp 0 0;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideUpAndroid 300ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 -1dp 3dp rgba(0, 0, 0, 0.1);
  -webkit-overflow-scrolling: touch;
}

@media (prefers-color-scheme: light) {
  .bottom-sheet-content {
    background: #ffffff;
  }
}

.bottom-sheet-handle {
  width: 32dp;
  height: 4dp;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2dp;
  margin: 8dp auto 12dp;
}

@keyframes slideUpAndroid {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### TopAppBar

```css
.top-app-bar {
  height: 56dp;
  padding: 0 4dp 0 16dp;
  display: flex;
  align-items: center;
  gap: 8dp;
  background: #0f172a;
  position: sticky;
  top: 0;
  z-index: 10;
}

.top-app-bar-title {
  flex: 1;
  font-size: 22sp;
  font-weight: 600;
  color: #f8fafc;
}

.top-app-bar-action {
  width: 48dp;
  height: 48dp;
  border-radius: 24dp;
  display: flex;
  align-items: center;
  justify-content: center;
}

.top-app-bar-action:active {
  background: rgba(255, 255, 255, 0.08);
}
```

### 列表项 (Vault Item)

```css
.vault-item {
  min-height: 72dp;
  padding: 12dp 16dp;
  display: flex;
  align-items: center;
  gap: 16dp;
}

.vault-item-icon {
  width: 40dp;
  height: 40dp;
  border-radius: 10dp; /* 苹果式圆角方形图标 */
  background: #1e293b;
}

.vault-item-title {
  font-size: 16sp;
  font-weight: 500;
  color: #f8fafc;
}

.vault-item-subtitle {
  font-size: 14sp;
  color: #94a3b8;
}
```

### Snackbar

```css
.snackbar {
  position: fixed;
  left: 16dp;
  right: 16dp;
  bottom: 16dp; /* 有 FAB 时上移到 FAB 之上 */
  min-height: 48dp;
  padding: 0 8dp 0 16dp;
  border-radius: 8dp;
  background: #1e293b;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4dp 12dp rgba(0, 0, 0, 0.2);
}

.snackbar-action {
  min-width: 48dp;
  height: 40dp;
  color: #10b981;
  font-weight: 600;
}
```

- 复制用户名 / 密码后显示 "已复制，30 秒后清除剪贴板"
- 删除后显示 "已删除" + "撤销" 操作，停留 4 秒
- Snackbar 文案不得包含条目名称以外的保险库内容，绝不包含密码

### 底部导航 (BottomNavigation)

- 最多 4 项: 保险库 / 生成器 / 发送 / 设置
- 高度 80dp (含标签)，激活项使用胶囊形指示器 (64×32dp, 16dp 圆角)
- 每项都有文字标签，不允许只有图标

---

## 动画 (Material Motion)

```css
.list-enter {
  animation: fadeUp 400ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

.list-enter:nth-child(n) {
  animation-delay: calc(var(--index) * 40ms); /* 最多错开 8 项 */
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8dp);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

| 场景              | 时长  | 缓动                  |
| ----------------- | ----- | --------------------- |
| 按压反馈 (Ripple) | 150ms | standard              |
| BottomSheet 进入  | 300ms | emphasized decelerate |
| BottomSheet 退出  | 200ms | emphasized accelerate |
| 页面切换 (共享轴) | 300ms | standard              |
| 列表错开进入      | 400ms | standard              |

---

## 安全相关 UI

- 密码字段默认遮罩，"显示" 按钮需要 48dp 触摸目标
- 敏感页面设置 `FLAG_SECURE`，禁止截屏和最近任务缩略图
- 解锁支持 BiometricPrompt (指纹 / 人脸)，失败 3 次后回退到主密码
- 应用切到后台超过设定时间后自动锁定，最近任务中显示锁定遮罩

---

## 无障碍 (TalkBack)

- 所有图标按钮设置 contentDescription，例如 "复制密码"、"更多操作"
- 列表项合并为一个可聚焦单元，朗读 "标题，用户名，按钮: 复制"
- 长按操作在 TalkBack 中提供自定义操作 (Custom Actions)
- 测试: 开启 TalkBack 后用单指左右滑动遍历，三指上滑打开菜单
- 文字随系统字体缩放到 200% 时不截断、不重叠

---

## 响应式断点

| 断点                 | 布局                          | 导航           |
| -------------------- | ----------------------------- | -------------- |
| 320-479dp            | 单列                          | 底部导航       |
| 480-719dp            | 列表 + 详情双列               | NavigationRail |
| 720dp+               | 侧边栏 + 列表 + 详情          | 常驻侧边栏     |
| 1024dp+ / 折叠屏展开 | Master-Detail，详情避开折叠线 | 常驻侧边栏     |

---

## 交付检查清单

- [ ] 所有触摸目标 ≥ 48×48dp，间距 ≥ 8dp
- [ ] 深色 / 浅色模式文字对比度 ≥ 4.5:1
- [ ] 返回按钮行为可预测，BottomSheet 打开时先关闭 Sheet
- [ ] 软键盘弹出时输入框不被遮挡
- [ ] 系统字体 200% 下布局不破
- [ ] TalkBack 能读出每个按钮的用途
- [ ] 敏感页面启用 FLAG_SECURE
- [ ] Snackbar、日志、通知中不出现密码或解密内容
- [ ] prefers-reduced-motion 下动画关闭
- [ ] 折叠屏展开 / 折叠时状态不丢失
