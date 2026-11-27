/* ==========================================================================
   LocalPass · AGY Compact v4 — Shared Interactive State & Linkage Engine
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STATE = {
  surface: "linkage",
  screen: "link-sandbox",
  _screenInit: null,
  theme: "light",
  density: "compact",
  spec: true,
  grid: false,

  // Shared live vault data (synced across Mac, Extension & Web)
  items: INITIAL_ITEMS.map((it) => ({
    ...it,
    cvv: it.cardCode || it.cvv || "",
    custom: it.custom ? it.custom.map((c) => ({ ...c })) : [],
    versions: it.versions ? it.versions.map((v) => ({ ...v })) : [],
  })),
  archived: [...ARCHIVED_ITEMS],
  trash: [...TRASH_ITEMS],
  selected: "northwind",
  lastUndo: null,

  // Cross-surface lock & native bridge
  locked: false,
  unlockWaitSecs: 24,
  touchIdOn: true,
  nativeBridgeOn: true,
  hibpOn: false,

  // Mac state
  macSub: "vault",
  macLinkSub: "vault",
  macFilter: "all",
  macQuery: "",
  macDrawer: null,
  macSettingsTab: "security",
  activeFolder: "work",
  newKind: "login",
  qsQuery: "north",
  qsIndex: 0,
  formDraft: buildFormDraft("login"),
  macReprompt: false,
  shortcuts: INITIAL_SHORTCUTS.map((s) => ({ ...s })),

  // Extension state
  extFilter: "all",
  extQuery: "",
  extSheet: false,
  extQr: false,
  extKeyCheat: false,
  extFormMode: "edit",
  extLinkScreen: "ext-detail",
  extSecurityKeyState: "waiting",

  // Web inline & save state
  siteStep: "login",
  inlineMode: "login",
  inlineIndex: 0,
  saveBarOpen: false,
  saveNewMode: false,
  saveConfirmedMode: false,
  atRiskBarOpen: false,
  multiSaveMode: false,
  multiSaveTarget: "northwind",
  webSaveFolder: "工作",
  autofillToastOpen: false,
  autofillUndoDone: false,
  webFilterQuery: "ops-temp",

  // Generator, Sync, Import, Export
  genMode: "password",
  genLen: 20,
  genValue: "N7$kQ2m!rT9@xL4wZ8p",
  genHistory: INITIAL_GEN_HISTORY.map((g) => ({ ...g })),
  genHistoryRevealed: new Set(),
  autoSync: true,
  dirtyCount: 0,
  lastSyncText: "2 分钟前",
  r2TestOk: false,
  wipeConfirmed: false,
  importSource: "1pux",
  importConflictMode: "skip",
  exportFormat: "encrypted_json",
  conflictChoice: "both",

  // Ephemeral UI feedback
  revealedIds: new Set(),
  copiedKey: null,
  clipboard: null,
  toast: null,
  ipcLogs: [
    {
      ts: "22:25:48",
      bus: "com.localpass.desktop",
      msg: "触控 ID 解锁完成 → 广播解锁会话至 Chrome 扩展",
    },
    {
      ts: "22:25:52",
      bus: "content-script",
      msg: "匹配域名 northwind.io → 载入 1 个通行密钥 + 3 个登录账户",
    },
    { ts: "22:26:01", bus: "r2-sync-v2", msg: "manifest gen #42 已对齐 · 0 个待上传增量" },
  ],
};

function enterScreenOnce(key, initFn) {
  if (STATE._screenInit !== key) {
    STATE._screenInit = key;
    initFn();
  }
}

function ensureDraftFor(isNew) {
  const it = STATE.items.find((x) => x.id === STATE.selected) || STATE.items[0];
  if (isNew) {
    if (
      !STATE.formDraft ||
      STATE.formDraft.editingId !== null ||
      STATE.formDraft.kind !== STATE.newKind
    ) {
      STATE.formDraft = buildFormDraft(STATE.newKind || "login");
    }
  } else if (it && (!STATE.formDraft || STATE.formDraft.editingId !== it.id)) {
    STATE.formDraft = buildFormDraft(it.kind, it);
  }
}

function commitFormDraft() {
  const draft = STATE.formDraft;
  if (!draft) return;
  const schema = ITEM_KIND_SCHEMAS[draft.kind] || ITEM_KIND_SCHEMAS.login;
  const allSchemaKeys = [...schema.defaults, ...schema.optional].map((s) => s.key);
  const kindMeta = ITEM_KINDS.find((k) => k.id === draft.kind) || ITEM_KINDS[0];
  const folderObj = FOLDERS.find((f) => f.name === draft.folder) || FOLDERS[0];

  const existing = draft.editingId ? STATE.items.find((i) => i.id === draft.editingId) : null;
  const target = existing || {
    id: "item-" + Date.now().toString(36),
    kind: draft.kind,
    kindLabel: kindMeta.label,
    ini: (draft.name || kindMeta.label).trim().slice(0, 2).toUpperCase() || "LP",
    tone: "blue",
    favorite: false,
    recent: true,
    siteMatch: false,
    created: "刚刚",
    strength: { score: 4, label: "已加密", reuse: "未重复", breach: "未发现" },
    versions: [],
  };

  target.kind = draft.kind;
  target.kindLabel = kindMeta.label;
  target.name = (draft.name || "").trim() || kindMeta.label;
  target.ini = target.name.slice(0, 2).toUpperCase() || "LP";
  target.folder = folderObj ? folderObj.name : draft.folder || "工作";
  target.folderId = folderObj ? folderObj.id : "work";
  target.updated = "刚刚";

  allSchemaKeys.forEach((k) => {
    target[k] = "";
  });
  if (draft.kind === "card") {
    target.cardNumber = "";
    target.cardCode = "";
    target.cardLast4 = "0000";
    target.expiry = "";
    target.expMonth = "";
    target.expYear = "";
  }
  if (draft.kind === "identity") {
    target.idNumber = "";
  }
  if (draft.kind === "login") {
    target.otp = "";
  }

  draft.fields.forEach((f) => {
    target[f.key] = f.value || "";
  });

  if (draft.kind === "login" && target.totpSecret) {
    target.otp = (existing && existing.otp) || "492 106";
  }
  if (draft.kind === "card") {
    target.cardNumber = target.secret || "";
    target.cardCode = target.cvv || "";
    const digits = (target.secret || "").replace(/\D/g, "");
    target.cardLast4 = digits.slice(-4) || "0000";
    const [mm = "", yy = ""] = (target.expiry || "").split("/");
    target.expMonth = mm;
    target.expYear = yy;
  }
  if (draft.kind === "identity") {
    target.idNumber = target.secret || "";
  }
  if (draft.kind === "note") {
    target.note = target.secret || "";
  }
  if (draft.kind === "server" && target.linkedSshName) {
    const ssh = STATE.items.find((i) => i.kind === "ssh-key" && i.name === target.linkedSshName);
    target.linkedSshId = ssh ? ssh.id : "";
  }

  target.user =
    target.user ||
    target.service ||
    target.software ||
    target.loginUser ||
    (target.cardLast4 ? `尾号 ${target.cardLast4}` : "") ||
    target.email ||
    target.category ||
    target.kindLabel;

  target.custom = (draft.custom || [])
    .filter((c) => (c.name && c.name.trim()) || (c.value && c.value.trim()))
    .map((c) => ({ name: c.name || "自定义字段", value: c.value || "", hidden: !!c.hidden }));

  if (!Array.isArray(target.versions)) target.versions = [];
  const nextVer = (target.versions[0]?.ver || 0) + 1;
  target.versions.unshift({
    ver: nextVer,
    when: "刚刚",
    device: STATE.surface === "ext" ? "Chrome 扩展" : "MacBook Pro",
    summary: existing ? "更新字段" : "新建条目",
    current: true,
    secret: target.secret || "••••",
  });
  target.versions.forEach((v, idx) => {
    v.current = idx === 0;
  });

  if (!existing) STATE.items.unshift(target);
  STATE.selected = target.id;
  STATE.formDraft = buildFormDraft(target.kind, target);
}

function logIpc(bus, msg) {
  const now = new Date();
  const ts = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  STATE.ipcLogs.unshift({ ts, bus, msg });
  if (STATE.ipcLogs.length > 8) STATE.ipcLogs.length = 8;
}

const nSpec = (id, name, tag, title, lead, points, specs, keys, render, group = "核心流程") => ({
  id,
  name,
  group,
  render,
  notes: { tag, title, lead, points, specs, keys },
});

const SCREENS = {
  linkage: [
    nSpec(
      "link-sandbox",
      "三端实时联动沙盒",
      "跨端 · 实时联动",
      "一次解锁 · 页内填充 · 改密同步",
      "Mac 桌面端、Chrome 扩展与浏览器页面共享同一套内存状态。任意一端的锁定、解锁、改密、编辑字段、复制或解决冲突都可实时联动。",
      [
        "点击顶部「锁定三端」→ Mac、扩展与网页内联浮层同步锁库；在网页浮层点「Mac 触控 ID」可原地唤起桌面生物识别解锁。",
        "三张画布右上角均带子画面切换条（Mac 保险库/体检/同步/冲突；扩展 列表/详情/编辑/PRF；网页 10 大内联场景）。",
        "点击「模拟网页改密保存」→ 浏览器右上角确认条出现 → 点「更新条目 (v4)」→ Mac 版本历史与扩展详情同步升级为 v4。",
      ],
      [
        ["Mac 缩放", "60%"],
        ["扩展缩放", "94%"],
        ["网页缩放", "73%"],
        ["消息总线", "com.localpass.desktop"],
      ],
      ["⌘K", "↑↓", "↵", "esc"],
      () => renderLinkageWorkspace(STATE),
    ),
  ],
  mac: [
    nSpec(
      "mac-vault",
      "保险库 · 三栏工作台",
      "桌面 · 主视图",
      "4px 紧凑栅格，第二栏列表纯净聚焦",
      "侧栏 196 / 列表 296 / 详情自适应 + 常驻 188px 检查器。第二栏只显示名称、账号与条目类型（不显示动态验证码），把 Google 动态口令集中放在详情页展示（不直接展开绑定二维码），并去掉冗余的「复制主要值」按钮。",
      [
        "全仓 8 类条目各自拥有专属结构化字段（如令牌 Access Key、SSH 指纹/公钥/私钥、许可证序列号/订单号、服务器端口与 SSH 引用、纯密文笔记等）。",
        "点按详情任何单行字段直接复制，行底变绿并显示 30 秒剪贴板倒计时；密码显示 30 秒自动收回。",
        "含 TOTP 条目在详情页直接展现 6 位实时动态口令与 30 秒倒计时（点击即复制，不占版面展示绑定二维码）。",
      ],
      [
        ["窗口", "1200 × 760"],
        ["侧栏 / 列表", "196 / 296"],
        ["列表行", "36px / 30px"],
        ["字段行", "30px"],
        ["底栏", "24px"],
      ],
      ["⌘K", "⌘F", "↑↓", "⌘C", "⇧⌘C", "⌘E", "⌘⌫"],
      () => {
        enterScreenOnce("mac-vault", () => {
          STATE.macSub = "vault";
          STATE.macDrawer = null;
        });
        return renderMacWorkspace(STATE);
      },
      "主视图与取用",
    ),
    nSpec(
      "mac-empty",
      "空保险库 · 引导出口",
      "桌面 · 空态",
      "空态只给明确出口，不画装饰插画",
      "建库完成零条目时，不展示空洞插画或假数据，直接并列「新建第一条记录」「导入 1PUX / CSV」「从 R2 桶恢复」三个可执行出口。",
      [
        "点击「新建第一条记录」原地切回工作台并打开新建抽屉。",
        "明确告知用户所有凭证端到端加密留在本地，无服务端账号。",
      ],
      [
        ["主操作按钮", "3 个"],
        ["快捷提示", "⌘N / ⌘K"],
      ],
      ["⌘N", "⌘K"],
      () => {
        STATE.macSub = "empty";
        return renderMacWorkspace(STATE);
      },
      "主视图与取用",
    ),
    nSpec(
      "mac-quick-access",
      "快速检索 · ⌘K",
      "桌面 · 应用内检索",
      "无全局热键监听，窗口内 3 秒全字段检索",
      "已取消跨应用全局键盘监听，改为窗口内按下 ⌘K 或 / 唤起 520px 浮窗。名称、用户名、URL、备注、自定义字段、卡号后四位同权检索。",
      [
        "命中结果明确标出「命中备注 / 命中自定义字段 / 命中网址」，让用户一眼知道为何匹配。",
        "支持 =totp、=favorite、=ssh 等过滤语法；列表保持纯净不堆验证码。",
        "纯键盘操作：↑↓ 选择，↵ 打开详情，⌘C 复制用户名，⇧⌘C 复制密码。",
      ],
      [
        ["浮窗宽", "520px"],
        ["输入框", "40px"],
        ["结果行", "36px"],
        ["作用域", "仅应用内"],
      ],
      ["⌘K", "↑↓", "↵", "⌘C", "⇧⌘C", "esc"],
      () => {
        STATE.macSub = "vault";
        STATE.macDrawer = null;
        return renderMacWorkspace(STATE, { quickSearch: true });
      },
      "主视图与取用",
    ),
    nSpec(
      "mac-tray",
      "菜单栏托盘弹窗",
      "桌面 · TrayMain",
      "驻留 macOS 菜单栏的轻量取用面板",
      "对应代码里的 TrayMain 托盘驻留模式：无需打开 1200px 主窗口即可快速查找并一键复制或生成强密码。",
      [
        "304px 紧贴菜单栏右上角，展示 4 条置顶/最近条目与一键复制。",
        "支持原地一键生成 20 位强密码并写入 30 秒倒计时剪贴板。",
        "提供单键锁定与直达主窗口入口。",
      ],
      [
        ["弹窗宽", "304px"],
        ["条目行", "34px"],
        ["搜索框", "26px"],
      ],
      ["⌘L 锁定"],
      () => renderMacWorkspace(STATE, { screen: "mac-tray" }),
      "主视图与取用",
    ),
    nSpec(
      "mac-history",
      "版本历史 · 后悔药",
      "桌面 · 抽屉",
      "改错密码不再丢上一版",
      "332px 右侧抽屉保留最近 10 个版本，字段级列出变更摘要，支持直接复制旧值或一键恢复。",
      [
        "恢复前自动将当前版本写入历史快照，保证任何操作可逆。",
        "版本历史随条目加密同步至 R2 桶，换设备同样可回滚。",
      ],
      [
        ["抽屉宽", "332px"],
        ["版本卡", "74px"],
        ["保留上限", "10 版"],
      ],
      ["esc 关闭"],
      () => {
        enterScreenOnce("mac-history", () => {
          STATE.macSub = "vault";
          STATE.macDrawer = "history";
        });
        return renderMacWorkspace(STATE);
      },
      "条目与组织",
    ),
    nSpec(
      "mac-new",
      "新建条目 · 8 类动态表单",
      "桌面 · 抽屉",
      "类型不同字段各异，默认与自定义字段均可增删",
      "4×2 宫格切换 LocalPass 全部 8 类条目时，下方默认字段立即按该类实际需求切换（如笔记没有账号/网址；SSH 展示算法/指纹/公私钥/保护口令），且每个默认字段都能删除（×）与点胶囊加回。",
      [
        "点击任何默认字段右侧 × 可移除；点击下方「添加更多默认字段」胶囊可实时加回。",
        "自定义字段支持独立添加、改名、设敏感掩码与删除；保存即时写入当前内存库。",
      ],
      [
        ["抽屉宽", "332px"],
        ["宫格", "4 × 2"],
        ["字段编辑", "默认/自定义全支持增删"],
      ],
      ["⌘N", "⌘↵ 保存", "esc"],
      () => {
        enterScreenOnce("mac-new", () => {
          STATE.macSub = "vault";
          STATE.macDrawer = "new";
          ensureDraftFor(true);
        });
        return renderMacWorkspace(STATE);
      },
      "条目与组织",
    ),
    nSpec(
      "mac-form",
      "编辑条目 · 默认/自定义增删",
      "桌面 · 表单",
      "编辑当前条目：任何默认或自定义字段都可增删",
      "加载选中条目真实字段并标明递增版本号：每类字段严格贴合类型（如登录、令牌、SSH、许可证、卡片、身份、服务器、笔记），全部默认字段与自定义字段均支持增删改与掩码保护。",
      [
        "服务器类型支持直接切换关联的 SSH 私钥条目。",
        "左下角「删除」按钮直通软删除二次确认弹窗，或直接在列表按下 Delete / ⌘⌫。",
      ],
      [
        ["抽屉宽", "332px"],
        ["字段高", "30px"],
        ["增删支持", "默认字段 + 自定义字段"],
      ],
      ["⌘E", "⌘↵ 保存", "⌘⌫", "esc"],
      () => {
        enterScreenOnce("mac-edit", () => {
          STATE.macSub = "vault";
          STATE.macDrawer = "edit";
          ensureDraftFor(false);
        });
        return renderMacWorkspace(STATE);
      },
      "条目与组织",
    ),
    nSpec(
      "mac-item-delete",
      "删除确认 · 软删防误触",
      "桌面 · 确认弹窗",
      "删除是可逆的，界面要说清楚",
      "将条目的关键信息卡片化展示，默认主操作是「移到回收站（保留 30 天 + 5s 撤销）」，并提供「改用归档」退路与 R2 旧快照不受影响说明。",
      [
        "彻底区分归档（只是收起）与移入回收站（30 天后本机清理）。",
        "明确告知本地删除不影响远端历史旧快照。",
      ],
      [
        ["弹窗宽", "396px"],
        ["保留期", "30 天"],
      ],
      ["⌘⌫ 删除", "esc 取消"],
      () => {
        STATE.macSub = "vault";
        STATE.macDrawer = null;
        return renderMacWorkspace(STATE, { deleteModal: true });
      },
      "条目与组织",
    ),
    nSpec(
      "mac-folders",
      "文件夹管理",
      "桌面 · 组织",
      "轻量分组，解散不影响条目本身",
      "4 枚文件夹色标卡片 + 条目快速预览，点击即定位详情。",
      [
        "删除文件夹仅解除分组关联，条目回到未分组。",
        "文件夹不参与 R2 同步冲突判定，保持合并规则简单可靠。",
      ],
      [["卡片", "4 列"]],
      [],
      () => {
        STATE.macSub = "folders";
        return renderMacWorkspace(STATE);
      },
      "条目与组织",
    ),
    nSpec(
      "mac-archive",
      "已归档条目",
      "桌面 · 归档",
      "收起来但不删除，不进默认搜索",
      "承接 CipherArchiveService：把历史旧账号从日常列表中收起，避免误删。",
      ["已归档永不自动清理，随时可一键恢复到列表。", "默认搜索与网页内联不展示归档项。"],
      [["行高", "32px"]],
      ["Delete 归档"],
      () => {
        STATE.macSub = "archive";
        return renderMacWorkspace(STATE);
      },
      "条目与组织",
    ),
    nSpec(
      "mac-trash",
      "回收站 · 30 天",
      "桌面 · 可逆删除",
      "软删除留余地，倒计时清晰可见",
      "所有删除默认进回收站保留 30 天；列表显示剩余天数，恢复为主操作。",
      ["删除动作同时触发 5 秒 Toast「撤销」，防止误触。", "明确提示彻底删除不影响远端桶内旧快照。"],
      [
        ["行高", "32px"],
        ["保留期", "30 天"],
      ],
      ["⌘⌫ 删除"],
      () => {
        STATE.macSub = "trash";
        return renderMacWorkspace(STATE);
      },
      "条目与组织",
    ),
    nSpec(
      "mac-health",
      "安全体检 · 离线规则",
      "桌面 · Watchtower",
      "不联网也能给出可执行的安全评分",
      "弱密码、重复使用、超 365 天未改、缺 2FA 全部在本地计算；HIBP 泄露检查默认关闭且明确告知仅发 5 位前缀。",
      [
        "每条风险右侧直接提供「去修改」按钮，点击即跳转对应条目编辑态。",
        "4 张统计卡仅展示待处理数量与强密码基数。",
      ],
      [
        ["统计卡", "4 列 · gap 8px"],
        ["风险行", "32px"],
      ],
      ["⌘R 扫描"],
      () => {
        STATE.macSub = "health";
        return renderMacWorkspace(STATE);
      },
      "工具与迁移",
    ),
    nSpec(
      "mac-generator",
      "生成器与侧栏历史",
      "桌面 · 工具",
      "语法着色防混淆，生成即护航",
      "字母默认色、数字蓝色、符号绿色，一眼分辨 0/O 与 1/l；生成历史只存内存，锁库即清。",
      [
        "支持随机密码与易记密码短语双模式切换。",
        "每次生成自动前置写入当前会话内存历史，右侧点击「完整历史」可展开管理。",
      ],
      [
        ["左栏", "自适应"],
        ["右栏历史", "290px"],
      ],
      ["⌘R 生成", "⌘C"],
      () => {
        STATE.macSub = "generator";
        return renderMacWorkspace(STATE);
      },
      "工具与迁移",
    ),
    nSpec(
      "mac-generator-history",
      "生成历史 · 锁库即焚",
      "桌面 · 历史列表",
      "掩码保护、只存内存、绝不写盘或同步",
      "独立全页展示当前解锁周期内生成过的密码与短语，默认遮罩，可逐条点击眼睛查看或复制，支持一键清空。",
      [
        "最多保留最近 20 条在内存中，锁库瞬间自动销毁。",
        "解决忘记刚生成的密码还没来得及点保存的找回痛点。",
      ],
      [
        ["内存上限", "20 条"],
        ["持久写入", "0 次"],
      ],
      ["⌘C 复制"],
      () => {
        STATE.macSub = "generator-history";
        return renderMacWorkspace(STATE);
      },
      "工具与迁移",
    ),
    nSpec(
      "mac-import",
      "导入来源选择",
      "桌面 · 迁移 1/3",
      "支持 1PUX / 1PIF / Bitwarden / Google Auth / CSV",
      "接出项目中全部本地解析器，1Password .1pux 可完整迁移标签、TOTP、自定义字段与文件夹结构。",
      [
        "选择 LocalPass 加密 JSON 时原地展开备份口令输入框。",
        "强调确认写入前不改动磁盘 data.json。",
      ],
      [
        ["来源", "5 类格式"],
        ["解析", "100% 本地"],
      ],
      [],
      () => {
        STATE.macSub = "import";
        return renderMacWorkspace(STATE);
      },
      "工具与迁移",
    ),
    nSpec(
      "mac-import-preview",
      "导入去重预览",
      "桌面 · 迁移 2/3",
      "按「名称 + 用户名 + 主 URI」自动防重复",
      "导入前清晰统计新增 / 重复 / 无法识别行，支持「重复则跳过」与「重复则覆盖」策略切换，坏行单独标注而不阻断其余导入。",
      ["3 步步骤条标清当前所处阶段。", "点击确认导入后一次批量写入并计入待同步队列。"],
      [
        ["统计卡", "4 列"],
        ["去重策略", "跳过 / 覆盖"],
      ],
      [],
      () => {
        STATE.macSub = "import-preview";
        return renderMacWorkspace(STATE);
      },
      "工具与迁移",
    ),
    nSpec(
      "mac-export",
      "多格式导出",
      "桌面 · 导出",
      "随时可带走的标准 JSON 与 CSV",
      "暴露导出服务已支持的 CSV 格式与加密/明文 JSON，导出前必须二次输入安全密码并展示明文风险。",
      [
        "加密 JSON 使用独立的「备份口令」，页面提供一键查看与复制。",
        "明文 JSON / CSV 显式标注安全警示，遵守术语与隐私红线。",
      ],
      [["设置行", "34px"]],
      [],
      () => {
        STATE.macSub = "export";
        return renderMacWorkspace(STATE);
      },
      "工具与迁移",
    ),
    nSpec(
      "mac-sync",
      "R2 同步与设备状态",
      "桌面 · 同步 v2",
      "把「同步镜像」与「导出备份」彻底拆清",
      "展示 30 秒去抖自动同步、Ed25519 防回滚、已登记设备列表及元数据边界说明，并直通存储配置、桶恢复与冲突解决。",
      [
        "桶不可用时本机继续正常读写，仅计入待同步增量计数。",
        "诚实告知 R2 元数据可见边界：「看不到密码，但能看到条目数与改动时间」。",
      ],
      [
        ["去抖间隔", "30 秒"],
        ["校验算法", "Ed25519"],
      ],
      [],
      () => {
        STATE.macSub = "sync";
        return renderMacWorkspace(STATE);
      },
      "R2 同步与恢复",
    ),
    nSpec(
      "mac-conflict",
      "冲突解决 · 并排比对",
      "桌面 · 冲突合并",
      "两份都留，默认绝不静默覆盖",
      "当两台离线设备修改同一条目后协同，并排高亮差异字段（密码 / 备注），默认选「两份都留」避免密码永久丢失。",
      [
        "选择「采用远端」前也自动在本机为原版本写入历史快照。",
        "右侧明确标出远端设备名、版本代次与改动时间戳。",
      ],
      [
        ["对比列", "1fr 1fr"],
        ["合并策略", "3 选 1"],
      ],
      [],
      () => {
        STATE.macSub = "conflict";
        return renderMacWorkspace(STATE);
      },
      "R2 同步与恢复",
    ),
    nSpec(
      "mac-backup-config",
      "R2 存储与 CORS 配置",
      "桌面 · 存储端点",
      "一个桶 = 一座保险库，扁平对象布局",
      "配置 Cloudflare R2 端点、Region (auto)、桶名称与密钥，右侧提供扩展端必备的 R2 CORS 策略一键复制与测试连接反馈。",
      [
        "保存后仅将配置的 R2 主机加入网络闸门白名单。",
        "断开连接只解除同步关系，不删本地库，也不删云端历史对象。",
      ],
      [
        ["测试延迟", "HEAD 38ms"],
        ["CORS 策略", "一键复制"],
      ],
      [],
      () => {
        STATE.macSub = "backup-config";
        return renderMacWorkspace(STATE);
      },
      "R2 同步与恢复",
    ),
    nSpec(
      "mac-restore",
      "从 R2 云存储恢复",
      "桌面 · 恢复向导",
      "锚点直指 account.json，整库端到端重建",
      "从空设备或重装电脑恢复时，校验桶根目录 account.json 的 userId 与 Ed25519 签名，预览条目数与代次后输入原安全密码离线解密重建。",
      [
        "3 步恢复向导防呆提醒：已有 R2 同步库应直接从此恢复，勿先建空库。",
        "明确说明扩展端 PRF 密钥不随桶同步，恢复后需在扩展重绑。",
      ],
      [
        ["步骤", "3 步"],
        ["锚点", "account.json"],
      ],
      [],
      () => {
        STATE.macSub = "restore";
        return renderMacWorkspace(STATE);
      },
      "R2 同步与恢复",
    ),
    nSpec(
      "mac-network",
      "网络闸门",
      "桌面 · 隐私自证",
      "默认拒绝一切未授权出站，白名单全透明",
      "基于 gate-policy.ts：默认拒绝全部未授权出站请求，仅在主动同步或手动安全比对时放行你授权的白名单域名（已清除遗留冗余拦截清单）。",
      [
        "锁库状态下恒为 0 次网络请求，列表头像全部本机生成不拉取远程网站图标。",
        "与 Chrome 扩展共用同一份 Default Deny 白名单策略。",
      ],
      [
        ["策略模型", "Default Deny"],
        ["锁库出站", "0 请求"],
      ],
      [],
      () => {
        STATE.macSub = "network";
        return renderMacWorkspace(STATE);
      },
      "隐私、安全与引导",
    ),
    nSpec(
      "mac-data",
      "数据与安全边界",
      "桌面 · 数据安全",
      "本地无服务端副本，清空前先提示导出",
      "集中展示 data.json (0600 权限) 与 .bak 滚动备份统计、已启用的防暴力与加密护栏，以及带二次勾选确认的危险清空区。",
      [
        "未勾选风险确认开关前，红色清空按钮保持禁用状态。",
        "紧邻危险操作放置「先导出备份文件」直达入口。",
      ],
      [
        ["文件权限", "0600"],
        ["滚动备份", "3 份 .bak"],
      ],
      [],
      () => {
        STATE.macSub = "data";
        return renderMacWorkspace(STATE);
      },
      "隐私、安全与引导",
    ),
    nSpec(
      "mac-settings",
      "设置中心 · 应用内键位",
      "桌面 · 设置",
      "触控 ID、原生消息桥接与可删快捷键映射",
      "页内单行 Tab 切换（安全与解锁 / 剪贴板与数据 / 外观密度 / 快捷键映射 / 诊断）。「快捷键映射」已取消系统全局热键监听，并支持逐行删除绑定与重置恢复。",
      [
        "明确区分平台边界：触控 ID 仅 macOS 桌面端可用，PRF 安全密钥仅 Chrome 扩展可用。",
        "支持 Delete / ⌘⌫ 删除快捷键及一键清空/重置单个键位绑定。",
      ],
      [
        ["Tab 高度", "26px"],
        ["键位作用域", "仅应用内"],
      ],
      ["⌘,", "Delete / ⌘⌫"],
      () => {
        STATE.macSub = "settings";
        return renderMacWorkspace(STATE);
      },
      "隐私、安全与引导",
    ),
    nSpec(
      "mac-about",
      "关于、更新日志与诊断",
      "桌面 · 关于",
      "GPL-3.0 开源、更新日志、已知限制与零敏感诊断",
      "一屏呈现版本发布历史、三端平台能力边界坦诚清单、以及绝不含条目名/URL/用户名/密码的零敏感诊断包一键复制。",
      [
        "所有技术限制写给用户看懂（不甩黑盒报错）。",
        "诊断信息纯本地拼装，复制给开发者排障零泄露风险。",
      ],
      [
        ["协议", "GPL-3.0"],
        ["诊断含密文", "0 字节"],
      ],
      [],
      () => {
        STATE.macSub = "about";
        return renderMacWorkspace(STATE);
      },
      "隐私、安全与引导",
    ),
    nSpec(
      "mac-unlock",
      "锁定窗口",
      "桌面 · 解锁",
      "断网照常解锁，同步唤醒扩展",
      "单卡聚焦安全密码与触控 ID，连错不会清空数据；解锁事件通过原生消息立即共享给扩展。",
      ["底部写清离线承诺与恢复出口。", "可点击预览「连错等待态」。"],
      [
        ["卡片宽", "336px"],
        ["输入高", "30px"],
      ],
      ["↵ 解锁"],
      () => renderMacWorkspace(STATE, { screen: "mac-unlock" }),
      "隐私、安全与引导",
    ),
    nSpec(
      "mac-unlock-wait",
      "连错等待防暴力",
      "桌面 · 安全护栏",
      "连续输错只等待，绝不销毁本地保险库",
      "桌面端连错 5 次 PIN/安全密码后的等宽倒计时锁定视图：明确告知重启不会清零等待，也绝不清除本机数据。",
      ["提供从 R2 云存储恢复作为兜底出口。"],
      [
        ["倒计时", "28px tabular-nums"],
        ["错误阈值", "5 次"],
      ],
      [],
      () => renderMacWorkspace(STATE, { screen: "mac-unlock-wait" }),
      "隐私、安全与引导",
    ),
    nSpec(
      "mac-security-key",
      "平台能力说明 · PRF",
      "桌面 · 平台边界",
      "写清为何安全密钥解锁只在扩展端提供",
      "按界面规范第 5 节澄清平台能力：桌面端由 macOS 触控 ID 保护主密钥，WebAuthn PRF 因绑定浏览器 Origin RP ID 归属 Chrome 扩展管理。",
      ["提供一键跳转按钮前往 Chrome 扩展 PRF 设置画面。"],
      [["卡片宽", "412px"]],
      [],
      () => renderMacWorkspace(STATE, { screen: "mac-security-key" }),
      "隐私、安全与引导",
    ),
    nSpec(
      "mac-setup",
      "首次建库 / 三入口恢复",
      "桌面 · 引导",
      "无账号无服务器，恢复锚点直指 account.json",
      "首次打开给出建库、从 R2 云存储恢复、从备份文件恢复三条清晰路径，并防呆提醒勿先建空库再配旧桶。",
      ["邮箱仅作本机密钥派生标识，不发验证邮件。", "建库完成后进入干净明确的空保险库引导态。"],
      [["卡片宽", "368px"]],
      ["↵ 创建"],
      () => renderMacWorkspace(STATE, { screen: "mac-setup" }),
      "隐私、安全与引导",
    ),
  ],
  ext: [
    nSpec(
      "ext-list",
      "保险库列表 · 380×600",
      "扩展 · 主屏",
      "当前站点置顶 + 无验证码干扰的紧凑列表",
      "38px 头部 + 28px 全字段搜索 + 22px 筛选条 + 36px 紧凑行 + 38px 底栏。列表行不直接展示 2FA 动态验证码以免分散视线与泄露旁窥，悬停即现填充/复制操作。",
      [
        "当前标签页（northwind.io）账户自动置顶并支持一键填充。",
        "头部实时显示「Mac 已联动」原生消息状态徽标与快捷键速查按钮。",
      ],
      [
        ["弹窗", "380 × 600"],
        ["行高", "36px / 32px"],
        ["头 / 脚", "38 / 38"],
      ],
      ["⌘⇧Y", "↑↓", "↵", "⌘C", "⇧⌘C"],
      () => renderExtWorkspace(STATE, "ext-list"),
      "主视图与条目",
    ),
    nSpec(
      "ext-empty",
      "空保险库 · 3 出口",
      "扩展 · 空态",
      "空态只留清晰可行的三条路",
      "建库后 0 条目在 380×600 内并列「新建第一条」「导入 1PUX/CSV」「从 R2 桶恢复」，不浪费首屏高度。",
      ["文案简洁克制，直接导向操作。"],
      [
        ["弹窗", "380 × 600"],
        ["主操作", "3 按钮"],
      ],
      [],
      () => renderExtWorkspace(STATE, "ext-empty"),
      "主视图与条目",
    ),
    nSpec(
      "ext-detail",
      "条目详情 · 固定底栏",
      "扩展 · 详情",
      "点行即复制 + 完整字段 + 无冗余复制主值按钮",
      "完整呈现该类条目字段与自定义字段、Google 动态口令实时倒计时环与二维码入口，去掉底部冗余的「复制主要值」按钮，让主动作聚焦为「填充到当前网页」或「编辑字段」。",
      [
        "点「⋯」升起底部半层动作单；点二维码打开本地 Canvas 绘制页。",
        "底栏历史版本可直达 Mac 桌面端查看字段级 diff。",
      ],
      [
        ["字段行", "31px"],
        ["OTP 卡", "38px"],
        ["底栏", "44px"],
      ],
      ["↵ 填充", "esc 返回"],
      () => renderExtWorkspace(STATE, "ext-detail"),
      "主视图与条目",
    ),
    nSpec(
      "ext-item-more",
      "更多操作 · 底部动作单",
      "扩展 · 动作单",
      "动作收进底部，详情不被挤走",
      "独立展示详情页触发「⋯」后升起的底部半层动作单：编辑条目与字段、查看 Google 动态二维码、收藏置顶、归档与移到回收站。",
      ["危险动作「移到回收站」居最底并用红色视觉警示区分。"],
      [
        ["遮罩", "半透深色"],
        ["动作行", "32px"],
      ],
      ["esc 收起"],
      () => renderExtWorkspace(STATE, "ext-item-more"),
      "主视图与条目",
    ),
    nSpec(
      "ext-totp-qr",
      "动态口令 · 二维码页",
      "扩展 · 2FA",
      "本地 Canvas 绘制，绝不触网",
      "将选定条目的 TOTP 凭证在扩展本机渲染为 148px 二维码，下方直接附带 Base32 密钥一键复制与 30 秒实时步长。",
      ["用于在其他设备扫码迁移单个 2FA 密钥，零外网请求。"],
      [
        ["二维码", "148 × 148"],
        ["密钥行", "31px"],
      ],
      ["esc 返回"],
      () => renderExtWorkspace(STATE, "ext-totp-qr"),
      "主视图与条目",
    ),
    nSpec(
      "ext-new",
      "新建 · 8 类选型",
      "扩展 · 新建",
      "4×2 宫格选定类别即载入专属字段",
      "紧凑 4×2 类型宫格与桌面端保持完全一致的图标和色彩体系；选择类型点下一步即进入对应类型的动态表单。",
      ["不同类型拥有截然不同的默认字段集合。", "提示仅登录与卡/身份参与网页内联推荐。"],
      [
        ["宫格", "4 × 2"],
        ["格子高", "50px"],
      ],
      [],
      () => renderExtWorkspace(STATE, "ext-new"),
      "主视图与条目",
    ),
    nSpec(
      "ext-form",
      "新建 / 编辑 · 动态表单",
      "扩展 · 表单",
      "8 类全支持默认字段与自定义字段实时增删",
      "顶部可直接切换 8 种类型对比字段结构（登录/令牌/SSH/许可证/卡/身份/服务器/笔记）。任何默认字段都支持单行 × 删除与点胶囊补加；自定义字段支持添加、改名、掩码保护与删除。",
      ["所有增删操作保存后即时写入内存保险库并同步桌面端详情。", "输入绑定状态草稿，切屏不丢失。"],
      [
        ["字段行", "30px"],
        ["动态支持", "默认+自定义增删"],
      ],
      [],
      () => {
        ensureDraftFor(STATE.extFormMode === "new");
        return renderExtWorkspace(STATE, "ext-form");
      },
      "主视图与条目",
    ),
    nSpec(
      "ext-generator",
      "生成器与侧栏历史",
      "扩展 · 工具",
      "结果置顶 + 彩色字符区分",
      "打开即可一键复制，2 列紧凑选项开关加上下屏可滚动的本机历史。",
      ["字母/数字/符号三色区分易混淆字符。", "点击可跳往独立生成历史页查看与清空。"],
      [["选项行", "28px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-generator"),
      "工具与组织",
    ),
    nSpec(
      "ext-generator-history",
      "本机生成历史",
      "扩展 · 工具",
      "历史掩码、只留内存、锁库清空",
      "在 380×600 内独立展示最近生成的密码列表，默认遮罩显示，逐条支持显示明文或复制，顶部说明不落盘不同步。",
      ["一键清空只清理当前会话生成队列，不影响已存条目。"],
      [
        ["列表行", "32px"],
        ["持久化", "0 写入"],
      ],
      [],
      () => renderExtWorkspace(STATE, "ext-generator-history"),
      "工具与组织",
    ),
    nSpec(
      "ext-folders",
      "文件夹管理",
      "扩展 · 组织",
      "全部条目置顶，其余按数量排",
      "紧致呈现「全部条目」与各颜色分组文件夹，注明解散文件夹不影响条目本身，并可直接新建。",
      ["与桌面端共用同一份文件夹分组规则。"],
      [["行高", "32px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-folders"),
      "工具与组织",
    ),
    nSpec(
      "ext-archive",
      "已归档条目",
      "扩展 · 组织",
      "收起旧账号但不自动清理",
      "展示扩展端已归档凭证与归档日期，一键「取消归档」即恢复为正常可搜索条目。",
      ["严格区分于 30 天回收站。"],
      [["行高", "32px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-archive"),
      "工具与组织",
    ),
    nSpec(
      "ext-trash",
      "回收站 · 30 天",
      "扩展 · 数据",
      "恢复在前，彻底清空在后",
      "显示每条软删除记录的剩余保留天数与原文件夹，主按钮为蓝色「恢复」，底部提供确认清空按钮。",
      ["清空本机回收站不影响 R2 桶中的历史快照。"],
      [
        ["行高", "32px"],
        ["保留期", "30 天"],
      ],
      [],
      () => renderExtWorkspace(STATE, "ext-trash"),
      "工具与组织",
    ),
    nSpec(
      "ext-health",
      "离线安全体检",
      "扩展 · Watchtower",
      "在弹窗内快速扫雷并直达改密",
      "3 列紧凑统计卡（重复 / 弱超期 / 强密码）+ 风险列表，「去改」一键载入该条目真实字段进入编辑表单。",
      ["全部在扩展本地离线计算，不泄露任何密码。"],
      [["统计卡", "3 列"]],
      [],
      () => renderExtWorkspace(STATE, "ext-health"),
      "工具与组织",
    ),
    nSpec(
      "ext-import",
      "导入来源（含 1PUX）",
      "扩展 · 导入",
      "不再局限于 .json，支持主流格式与截屏 2FA",
      "列出 1Password (.1pux/.1pif/.csv)、LocalPass JSON、Bitwarden、Google 认证器截屏与通用 CSV。",
      ["保留扩展独有的「截取当前标签页二维码导入 2FA」能力。", "点击任意来源进入去重预览。"],
      [["列表行", "36px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-import"),
      "导入、导出与 R2 同步",
    ),
    nSpec(
      "ext-import-preview",
      "导入去重预览",
      "扩展 · 导入",
      "导入前先看统计与重复策略",
      "380px 内以 3 列统计 + 跳过/覆盖分段控件展示将新增/重复/无法识别行，确认后写入。",
      ["按名称+用户名+主 URI 自动去重。"],
      [
        ["统计卡", "3 列"],
        ["分段按钮", "22px"],
      ],
      [],
      () => renderExtWorkspace(STATE, "ext-import-preview"),
      "导入、导出与 R2 同步",
    ),
    nSpec(
      "ext-export",
      "导出备份（含 CSV）",
      "扩展 · 导出",
      "加密 JSON 推荐 + CSV 风险警示",
      "补齐 CSV 导出入口与备份口令显示，提交前要求二次校验安全密码。",
      ["明文格式强提示安全风险。"],
      [["选项行", "34px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-export"),
      "导入、导出与 R2 同步",
    ),
    nSpec(
      "ext-sync",
      "同步与跨端状态",
      "扩展 · 同步",
      "状态、自动开关、设备与配置入口",
      "在 380px 内清晰呈现 R2 同步状态、待上传计数、桌面端连接状态与 R2 存储配置 / 恢复入口。",
      ["详细字段级冲突比对引导至桌面端处理。"],
      [["状态卡", "44px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-sync"),
      "导入、导出与 R2 同步",
    ),
    nSpec(
      "ext-backup-config",
      "R2 存储与 CORS 配置",
      "扩展 · 同步",
      "S3 端点、桶名、测试连接与复制 CORS",
      "在扩展内直接完成 Cloudflare R2 桶凭据配置、测试连通性与复制必备 CORS 白名单。",
      ["端点自动加入扩展网络闸门白名单。"],
      [["字段行", "30px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-backup-config"),
      "导入、导出与 R2 同步",
    ),
    nSpec(
      "ext-restore",
      "从 R2 云存储恢复",
      "扩展 · 恢复",
      "校验 account.json 并覆盖重建扩展库",
      "展示远端代次 gen #42、条目数与文件夹数核验结果，明确提示 PRF 密钥不同步。",
      ["输入原安全密码离线解密桶分片。"],
      [["核验卡", "48px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-restore"),
      "导入、导出与 R2 同步",
    ),
    nSpec(
      "ext-settings",
      "设置一级页",
      "扩展 · 设置",
      "分组清晰，直达 13 项子设置与功能",
      "按「安全与解锁」「组织与体检」「迁移、同步与系统」三组分块排布，平台能力差异一目了然。",
      ["绝不出现扩展原生不支持的指纹开关；所有组织/导入/导出/网络/数据子屏全链路可达。"],
      [
        ["设置行", "34px"],
        ["分组", "3 组"],
      ],
      [],
      () => renderExtWorkspace(STATE, "ext-settings"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-security",
      "安全设置",
      "扩展 · 安全",
      "自动锁定、剪贴板、触控 ID 桥接与 PRF 入口",
      "集中配置自动清除剪贴板 30s、明文收回、Mac 触控 ID 原生消息桥接，并提供进入 PRF 硬件安全密钥管理的入口。",
      ["连错保护原则清楚写入页底。"],
      [["设置行", "34px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-security"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-security-key",
      "WebAuthn PRF 安全密钥",
      "扩展 · 硬件密钥",
      "等设备触摸，而不是等进度条",
      "展示扩展专属 WebAuthn PRF 硬件密钥等待触摸反馈、已登记密钥清单（YubiKey 5C NFC / iCloud 密钥）与不同步声明。",
      ["点击可模拟触摸金手指切换完成态。", "PRF 密钥只保存在登记它的扩展本机。"],
      [
        ["状态区", "居中脉冲环"],
        ["已登记列表", "2 条"],
      ],
      [],
      () => renderExtWorkspace(STATE, "ext-security-key"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-appearance",
      "外观与紧凑密度",
      "扩展 · 外观",
      "两档密度即时切换",
      "点击即可切换全局紧凑（36px）与极紧（32px）行高，并同步预览深浅主题。",
      ["同步联动顶部密度开关预览效果。"],
      [["分段控件", "22px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-appearance"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-network",
      "网络闸门",
      "扩展 · 隐私",
      "Default Deny + 仅放行用户授权白名单",
      "对齐 gate-policy.ts 策略：默认拒绝全部未授权出站请求，仅放行配置的 R2 域名（与手动 HIBP 查询），彻底移除遗留遥测清单。",
      ["锁库状态下 0 次网络请求。"],
      [["策略", "Default Deny"]],
      [],
      () => renderExtWorkspace(STATE, "ext-network"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-data",
      "数据与安全",
      "扩展 · 安全清空",
      "先导出的明确劝导 + 二次勾选解锁",
      "高危页面强调「本机无服务端副本」，先提供「导出备份」捷径，必须勾选确认才激活红色清空按钮。",
      ["符合破坏性操作的防呆交互规范。"],
      [["警告区", "100% 宽度"]],
      [],
      () => renderExtWorkspace(STATE, "ext-data"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-about",
      "关于与零敏感诊断",
      "扩展 · 关于",
      "版本号、原生桥接状态与零敏感诊断复制",
      "展示 GPL-3.0 与原生消息健康度，可一键复制不含任何敏感值的诊断摘要。",
      ["与桌面端共维护同一套零敏感诊断模板。"],
      [["诊断框", "等宽字体"]],
      [],
      () => renderExtWorkspace(STATE, "ext-about"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-unlock",
      "解锁（含桌面触控 ID 代理）",
      "扩展 · 解锁",
      "三条解锁路径并列，离线可用",
      "支持安全密码、通过 Mac 桌面端触控 ID 代理解锁（com.localpass.desktop）、以及扩展原生 WebAuthn PRF 安全密钥。",
      ["解锁后实时广播给网页内联浮层。"],
      [["按钮高", "30px"]],
      ["↵ 解锁"],
      () => renderExtWorkspace(STATE, "ext-unlock"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-unlock-wait",
      "连错等待防暴力",
      "扩展 · 安全护栏",
      "连续输错只等待，绝不销毁本地保险库",
      "连续输错 5 次进入等宽数字倒计时，重启不清零，永远不自动删库，下方保留从 R2 桶恢复退路。",
      ["保留恢复包重建兜底出口。"],
      [["倒计时", "26px tabular-nums"]],
      [],
      () => renderExtWorkspace(STATE, "ext-unlock-wait"),
      "设置、安全与引导",
    ),
    nSpec(
      "ext-setup",
      "首次创建保险库",
      "扩展 · 首次",
      "首屏写清无账号与恢复成本",
      "首屏直入创建本地保险库（随后进空库引导）或从 R2 云存储恢复。",
      ["强调安全密码无法找回，建库后建议立即做导出或配置 R2。"],
      [["输入高", "32px"]],
      [],
      () => renderExtWorkspace(STATE, "ext-setup"),
      "设置、安全与引导",
    ),
  ],
  web: [
    nSpec(
      "web-login",
      "登录内联菜单 · 账户优先",
      "网页 · 内联",
      "贴在输入框 4px 下方，312px 紧凑不挡提交按钮",
      "通行密钥分组置顶，密码账户按最近使用排列；同一域名 3 个账户清晰可辨，列表行保持干净不堆动态码数字，支持 ↑↓ 与 ↵ 一键填充。",
      [
        "右侧 18px 品牌微标是唯一页内驻留元素，绝不篡改原网页表单排版。",
        "底部整合「生成密码」「在扩展中搜全部」与「只读域名」隐私声明。",
      ],
      [
        ["浮层宽", "312px"],
        ["账户行", "36px"],
        ["锚点距", "4px"],
        ["头部", "28px"],
      ],
      ["↑↓", "↵ 填充", "esc 关闭"],
      () => {
        enterScreenOnce("web-login", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "login";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "登录、无匹配与 2FA",
    ),
    nSpec(
      "web-no-match",
      "新站点无凭据 · 首次引导",
      "网页 · 0 匹配",
      "访问库内零条目新网站时的正确引导",
      "区别于「输入关键字过滤无结果」，当访问库内确实 0 条凭据的新域名（newvendor.io）时，不出现无效的显示全部按钮，直接引导「在此站点新建」或「生成强密码」。",
      ["提供「从其他网站借用/搜全部」应对跨子域/改名登录。"],
      [
        ["浮层宽", "312px"],
        ["域名态", "0 条记录"],
      ],
      ["esc 关闭"],
      () => {
        enterScreenOnce("web-no-match", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "no-match";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "登录、无匹配与 2FA",
    ),
    nSpec(
      "web-inline-empty",
      "过滤无匹配 · 内联空态",
      "网页 · 过滤空态",
      "输入过滤词无结果时，给足全站总条数与清除退路",
      "当用户在用户名输入框输入「ops-temp」导致过滤无结果，内联浮层明确提示「此站点共保存 3 个条目」，一键可清除筛选恢复全列表。",
      ["避免用户误以为保险库丢了账号。", "提供「在扩展新建」补充入口。"],
      [
        ["浮层宽", "312px"],
        ["主操作", "清除筛选"],
      ],
      ["esc 关闭"],
      () => {
        enterScreenOnce("web-inline-empty", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "empty";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "登录、无匹配与 2FA",
    ),
    nSpec(
      "web-totp",
      "验证码内联 · 填充与确认胶囊",
      "网页 · 2FA",
      "聚焦 2FA 框时一屏看码、填充并自动复制",
      "聚焦两步验证输入框才自动切为验证码内联卡片；点击填充后收窄为 38px 成功胶囊，展示剩余秒数与「撤销」入口。",
      [
        "验证码 14px 等宽字号 + 实时 SVG 倒计时环。",
        "提供「只复制到剪贴板，不填充」的独立快捷行（⌘C）。",
      ],
      [
        ["验证码行", "42px"],
        ["确认胶囊", "38px"],
      ],
      ["↵ 填充", "⌘C 只复制"],
      () => {
        enterScreenOnce("web-totp", () => {
          STATE.siteStep = "totp";
          STATE.inlineMode = "totp";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "登录、无匹配与 2FA",
    ),
    nSpec(
      "web-card-identity",
      "结账银行卡与身份内联",
      "网页 · P1-5 闭环",
      "补齐内联菜单的银行卡与收件地址能力",
      "点击卡号框弹出默认隐藏卡号的银行卡列表（默认项标记置顶）；点击收件人框可切换身份与常用地址一键填充。",
      [
        "卡号默认仅展示尾号 4421 / 8810，防止旁人窥屏。",
        "点击任意行后触发底部 Toast「已填尾号 4421」。",
      ],
      [
        ["卡号行", "36px"],
        ["掩码", "•••• 4421"],
      ],
      ["↑↓", "↵ 填充"],
      () => {
        enterScreenOnce("web-card-identity", () => {
          STATE.siteStep = "checkout";
          STATE.inlineMode = "card";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "结账与通行密钥",
    ),
    nSpec(
      "web-passkey",
      "通行密钥 · 条件式登录",
      "网页 · Passkey",
      "与密码同浮层触发，确认态透明可取消",
      "用户选择通行密钥后原地切为等待系统触控 ID 确认态，告知 30 秒超时且网站只会收到一次签名。",
      ["支持随时取消或退回密码登录。", "私钥始终不出本机。"],
      [["状态行", "46px"]],
      ["↵ 继续", "esc 取消"],
      () => {
        enterScreenOnce("web-passkey", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "passkey";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "结账与通行密钥",
    ),
    nSpec(
      "web-register",
      "注册 / 改密强密码建议",
      "网页 · 注册",
      "聚焦新密码框即给 20 位高强度密码",
      "提供彩色分色密码预览与一键刷新；点击填入后自动拉起右上角保存/更新确认条。",
      ["消除用户新建账户还要先开弹窗再生成再粘贴的 5 步操作。"],
      [["建议行", "40px"]],
      ["↵ 填入"],
      () => {
        enterScreenOnce("web-register", () => {
          STATE.siteStep = "register";
          STATE.inlineMode = "register";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "保存、回执、提醒与解锁",
    ),
    nSpec(
      "web-save-new",
      "首次保存新登录 · 文件夹与排除",
      "网页 · 新增保存",
      "首次在新站点登录：支持选文件夹与永不提示",
      "对应 NotificationTypes.Add：首次访问新域名提交登录后，右上角询问保存并支持即时切换归属文件夹（工作/个人/财务）或加入「从不提示此站」。",
      ["点击「保存到」后无缝切换为保存成功确认卡片。"],
      [
        ["确认条", "320px"],
        ["归属切换", "即时选择"],
      ],
      ["↵ 保存", "esc 忽略"],
      () => {
        enterScreenOnce("web-save-new", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "collapsed";
          STATE.saveBarOpen = true;
          STATE.saveNewMode = true;
          STATE.saveConfirmedMode = false;
          STATE.multiSaveMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "保存、回执、提醒与解锁",
    ),
    nSpec(
      "web-save-bar",
      "更新密码确认条",
      "网页 · 更新保存",
      "智能识别已有条目：默认「更新」，而非重复新建",
      "对应 NotificationTypes.Change：当同域名已存在同名账户时，主按钮明确写「更新条目 (v4)」，保留 v3 到历史版本，不污染保险库。",
      [
        "点「更新条目 (v4)」后，Mac 与扩展版本实时变为 v4。",
        "支持点击「切换/存为新建」展开多账户选单。",
      ],
      [
        ["确认条", "294px"],
        ["头部", "32px"],
      ],
      ["↵ 更新", "esc 忽略"],
      () => {
        enterScreenOnce("web-save-bar", () => {
          STATE.siteStep = "register";
          STATE.inlineMode = "collapsed";
          STATE.saveBarOpen = true;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.multiSaveMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "保存、回执、提醒与解锁",
    ),
    nSpec(
      "web-multi-save",
      "多账户保存 · 精确选择目标",
      "网页 · 保存消歧",
      "同域名多个账号时让用户决定更新哪一条",
      "northwind.io 同时存有 alex@ 与 ops@ 多个条目且无法静态判定用户名时，列出候选条目与「存为第 4 条新条目」，绝不静默覆盖或盲目造重复项。",
      ["切换单选框实时改变主提交按钮文案内标示的目标账户。"],
      [
        ["确认条", "320px"],
        ["候选项", "3 行"],
      ],
      ["↵ 确认提交", "esc 忽略"],
      () => {
        enterScreenOnce("web-multi-save", () => {
          STATE.siteStep = "register";
          STATE.inlineMode = "collapsed";
          STATE.saveBarOpen = true;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.multiSaveMode = true;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "保存、回执、提醒与解锁",
    ),
    nSpec(
      "web-save-confirm",
      "保存成功确认态",
      "网页 · 后置确认",
      "对应 isConfirmation：写入后立即给明确确认与补充 2FA 入口",
      "提交保存后右上角通知条平滑转为绿色成功确认态，提示已加密入库，并给「补充 2FA / 编辑条目」出口方便继续完善自定义字段或动态口令。",
      ["避免保存完毕窗口直接消失引发「到底存没存上」的不安感。"],
      [
        ["确认卡", "316px"],
        ["自动收起", "2 分钟"],
      ],
      ["↵ 完成"],
      () => {
        enterScreenOnce("web-save-confirm", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "collapsed";
          STATE.saveBarOpen = true;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = true;
          STATE.multiSaveMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "保存、回执、提醒与解锁",
    ),
    nSpec(
      "web-at-risk",
      "弱/重用密码网页改密提醒",
      "网页 · 主动风控",
      "对应 AtRiskPasswordNotification：刚填完弱密码即提醒去改密",
      "当使用离线体检检出的弱密码/重复使用密码（如 Atlas Bank）登录时，右上角弹出醒目但克制的橙色提示条，点击一键跳转网页改密与强密码生成。",
      ["把 Watchtower 安全体检能力真正推到网页现场闭环。"],
      [
        ["提示卡", "326px"],
        ["触发来源", "离线体检结果"],
      ],
      ["↵ 去改密"],
      () => {
        enterScreenOnce("web-at-risk", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "collapsed";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = true;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "保存、回执、提醒与解锁",
    ),
    nSpec(
      "web-autofill-toast",
      "填充回执与撤销卡",
      "网页 · 填充反馈",
      "一次填多字段后的右下角轻量撤销卡片",
      "自动填充完用户名 + 密码 + 2FA 后，内联列表退避以免遮挡表单与登录按钮，仅在页面右下角保留 320px 非侵入式回执卡，支持一键撤销清空表单。",
      ["不遮挡账号输入框、密码输入框或登录提交按钮。"],
      [
        ["卡片宽", "320px"],
        ["定位", "bottom-right 12px"],
      ],
      [],
      () => {
        enterScreenOnce("web-autofill-toast", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "none";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = true;
          STATE.autofillUndoDone = false;
        });
        return renderWebWorkspace(STATE);
      },
      "保存、回执、提醒与解锁",
    ),
    nSpec(
      "web-unlock",
      "内联就地解锁（含 Mac 触控 ID）",
      "网页 · 解锁联动",
      "不把用户踢去扩展弹窗，原地解锁即填",
      "锁库时聚焦网页输入框直接提供安全密码输入与「Mac 触控 ID」桥接解锁按钮，解完立即切换为匹配账户列表。",
      ["头注明要访问的域名 northwind.io，防范钓鱼。", "解锁后桌面端与扩展弹窗同步解锁。"],
      [
        ["浮层宽", "312px"],
        ["输入", "28px"],
      ],
      ["↵ 解锁", "esc 关闭"],
      () => {
        enterScreenOnce("web-unlock", () => {
          STATE.siteStep = "login";
          STATE.inlineMode = "unlock";
          STATE.saveBarOpen = false;
          STATE.saveNewMode = false;
          STATE.saveConfirmedMode = false;
          STATE.atRiskBarOpen = false;
          STATE.autofillToastOpen = false;
        });
        return renderWebWorkspace(STATE);
      },
      "保存、回执、提醒与解锁",
    ),
  ],
};

function currentScreenObj() {
  const list = SCREENS[STATE.surface] || SCREENS.linkage;
  return list.find((s) => s.id === STATE.screen) || list[0];
}

let toastTimer = null;
function showToast(surface, msg, opts = {}) {
  STATE.toast = { surface, msg, ...opts };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      STATE.toast = null;
      render();
    },
    opts.undoAction ? 5000 : 2800,
  );
  render();
}

function triggerCopy(copyKey, label, explicitVal) {
  let surface = STATE.surface === "linkage" ? "mac" : STATE.surface;
  if (copyKey) STATE.copiedKey = copyKey;
  STATE.clipboard = { label, secs: 30 };
  if (explicitVal && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(explicitVal).catch(() => {});
  }
  logIpc("clipboard", `已复制「${label}」· 30 秒后自动清空`);
  showToast(surface, `${label}已复制 · 30 秒后自动清空`, { clearClip: true, tone: "" });
}

function renderIndex() {
  const list = SCREENS[STATE.surface] || [];
  const labels = {
    linkage: "跨端联动沙盒",
    mac: `Mac 桌面端 · ${list.length} 屏`,
    ext: `浏览器扩展 · ${list.length} 屏`,
    web: `网页内联 · ${list.length} 屏`,
  };
  let lastGroup = "";
  let itemsHtml = "";
  list.forEach((s, i) => {
    if (s.group && s.group !== lastGroup) {
      lastGroup = s.group;
      itemsHtml += `<h3>${s.group}</h3>`;
    }
    itemsHtml += `<button data-go-idx="${s.id}" aria-current="${s.id === STATE.screen}">
      <i>${String(i + 1).padStart(2, "0")}</i>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</span>
    </button>`;
  });
  $("#index").innerHTML =
    `<h3>${labels[STATE.surface]}</h3>` +
    itemsHtml +
    `<h3>说明</h3>
     <div style="padding:2px 8px;font-size:10.5px;line-height:1.5;color:var(--text-3)">
       全部界面均可交互：点选 8 类条目、搜索全字段、点行复制、切暗色/极紧密度、或在「三端实时联动」同步操作。数据均为合成值。
     </div>`;
}

function renderNotes(sc) {
  const n = sc.notes;
  if (!n) return;
  $("#notes").innerHTML = `
    <span class="tag">${n.tag}</span>
    <h2>${n.title}</h2>
    <p>${n.lead}</p>
    <h4>关键设计细节</h4>
    <ul>${n.points.map((p) => `<li>${p}</li>`).join("")}</ul>
    <h4>尺寸与密度规格</h4>
    <table class="spec">${n.specs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>
    ${n.keys && n.keys.length ? `<h4>快捷键</h4><div class="keys">${n.keys.map((k) => `<kbd>${k}</kbd>`).join("")}</div>` : ""}`;
}

function fit() {
  const box = $(".framebox");
  const stage = $("#stage");
  const holder = $("#scaler");
  if (!box || !stage || !holder) return;
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  if (!w || !h) return;
  const pad = STATE.surface === "linkage" ? 28 : 44;
  const scale = Math.min(1, (stage.clientWidth - pad) / w, (stage.clientHeight - pad) / h);
  box.style.transform = `scale(${scale})`;
  holder.style.width = `${Math.round(w * scale)}px`;
  holder.style.height = `${Math.round(h * scale)}px`;
}

function render() {
  const activeSearchId = document.activeElement && document.activeElement.id;
  const selPos =
    document.activeElement && typeof document.activeElement.selectionStart === "number"
      ? document.activeElement.selectionStart
      : null;

  $$(".surfaces button").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.surface === STATE.surface)),
  );
  $(".body").classList.toggle("no-index", STATE.surface === "linkage");
  renderIndex();
  const sc = currentScreenObj();
  $("#scaler").innerHTML = `<div class="framebox">${sc.render()}</div>`;
  renderNotes(sc);
  requestAnimationFrame(fit);

  if (activeSearchId) {
    const el = document.getElementById(activeSearchId);
    if (el) {
      el.focus();
      if (selPos !== null && el.setSelectionRange) el.setSelectionRange(selPos, selPos);
    }
  }
}

function go(surface, screen) {
  STATE.surface = surface;
  const list = SCREENS[surface] || SCREENS.linkage;
  STATE.screen = screen && list.some((s) => s.id === screen) ? screen : list[0].id;
  STATE._screenInit = null;
  history.replaceState(null, "", `#${STATE.surface}/${STATE.screen}`);
  render();
}

function applyHash() {
  const [surface, screen] = location.hash.slice(1).split("/");
  if (SCREENS[surface]) {
    STATE.surface = surface;
    STATE.screen = SCREENS[surface].some((s) => s.id === screen) ? screen : SCREENS[surface][0].id;
    STATE._screenInit = null;
  }
}

document.addEventListener("click", (e) => {
  const sBtn = e.target.closest(".surfaces button");
  if (sBtn) {
    go(sBtn.dataset.surface);
    return;
  }

  const idxBtn = e.target.closest("[data-go-idx]");
  if (idxBtn) {
    if (idxBtn.dataset.goIdx === "ext-form") {
      STATE.extFormMode = "edit";
      STATE.formDraft = null;
    }
    go(STATE.surface, idxBtn.dataset.goIdx);
    return;
  }

  const actEl = e.target.closest("[data-act]");
  if (!actEl) return;
  const act = actEl.dataset.act;

  if (act === "go-screen") {
    if (actEl.dataset.screen === "ext-form") {
      STATE.extFormMode = "edit";
      STATE.formDraft = null;
    }
    go(actEl.dataset.surface || STATE.surface, actEl.dataset.screen);
    return;
  }
  if (act === "select-item" || act === "qs-pick") {
    STATE.selected = actEl.dataset.id;
    STATE.macSub = "vault";
    if (act === "qs-pick") go("mac", "mac-vault");
    else render();
    return;
  }
  if (act === "open-from-sub") {
    STATE.selected = actEl.dataset.id;
    STATE.macSub = "vault";
    render();
    return;
  }
  if (act === "mac-nav") {
    STATE.macSub = actEl.dataset.nav;
    render();
    return;
  }
  if (act === "mac-folder") {
    STATE.activeFolder = actEl.dataset.folder;
    STATE.macSub = "folders";
    render();
    return;
  }
  if (act === "mac-filter") {
    STATE.macFilter = actEl.dataset.filter;
    render();
    return;
  }
  if (act === "clear-mac-search") {
    STATE.macQuery = "";
    STATE.macFilter = "all";
    render();
    return;
  }
  if (act === "mac-drawer") {
    const drawer = actEl.dataset.drawer || null;
    STATE.macDrawer = drawer;
    if (drawer === "new") {
      STATE.formDraft = buildFormDraft(STATE.newKind || "login");
    } else if (drawer === "edit") {
      const it = STATE.items.find((x) => x.id === STATE.selected) || STATE.items[0];
      STATE.formDraft = it ? buildFormDraft(it.kind, it) : buildFormDraft("login");
    }
    render();
    return;
  }
  if (act === "mac-stab") {
    STATE.macSettingsTab = actEl.dataset.stab;
    render();
    return;
  }
  if (act === "open-qs") {
    go("mac", "mac-quick-access");
    return;
  }
  if (act === "close-qs") {
    go("mac", "mac-vault");
    return;
  }
  if (act === "pick-kind") {
    STATE.newKind = actEl.dataset.kind;
    STATE.formDraft = buildFormDraft(STATE.newKind);
    if (
      STATE.surface === "ext" ||
      (STATE.surface === "linkage" && STATE.extLinkScreen === "ext-form")
    ) {
      STATE.extFormMode = "new";
    }
    render();
    return;
  }
  if (act === "ext-open-new-form") {
    STATE.extFormMode = "new";
    STATE.formDraft = buildFormDraft(STATE.newKind || "login");
    STATE.extSheet = false;
    if (STATE.surface === "linkage") {
      STATE.extLinkScreen = "ext-form";
      render();
    } else go("ext", "ext-form");
    return;
  }
  if (act === "open-ext-edit") {
    const id = actEl.dataset.id || STATE.selected;
    STATE.selected = id;
    const it = STATE.items.find((x) => x.id === id) || STATE.items[0];
    STATE.extFormMode = "edit";
    STATE.formDraft = it ? buildFormDraft(it.kind, it) : buildFormDraft("login");
    STATE.extSheet = false;
    if (STATE.surface === "linkage") {
      STATE.extLinkScreen = "ext-form";
      render();
    } else go("ext", "ext-form");
    return;
  }
  if (act === "form-del-field") {
    const fkey = actEl.dataset.fkey;
    if (STATE.formDraft) {
      STATE.formDraft.fields = STATE.formDraft.fields.filter((f) => f.key !== fkey);
      render();
    }
    return;
  }
  if (act === "form-add-field") {
    const fkey = actEl.dataset.fkey;
    if (STATE.formDraft) {
      const schema = ITEM_KIND_SCHEMAS[STATE.formDraft.kind] || ITEM_KIND_SCHEMAS.login;
      const sp = [...schema.defaults, ...schema.optional].find((s) => s.key === fkey);
      if (sp && !STATE.formDraft.fields.some((f) => f.key === fkey)) {
        STATE.formDraft.fields.push(withDraftFieldMeta(sp, sp.sample || ""));
        render();
      }
    }
    return;
  }
  if (act === "form-use-preset") {
    const fkey = actEl.dataset.fkey;
    if (STATE.formDraft) {
      const f = STATE.formDraft.fields.find((x) => x.key === fkey);
      if (f && Array.isArray(f.options)) {
        f.customMode = false;
        if (!f.options.includes(f.value)) f.value = f.options[0] || f.sample || "";
        render();
      }
    }
    return;
  }
  if (act === "form-add-custom") {
    if (STATE.formDraft) {
      STATE.formDraft.custom.push({ id: "cf-" + Date.now(), name: "", value: "", hidden: false });
      render();
    }
    return;
  }
  if (act === "form-del-custom") {
    const idx = Number(actEl.dataset.idx);
    if (STATE.formDraft && idx >= 0) {
      STATE.formDraft.custom.splice(idx, 1);
      render();
    }
    return;
  }
  if (act === "form-toggle-custom-hidden") {
    const idx = Number(actEl.dataset.idx);
    if (STATE.formDraft && STATE.formDraft.custom[idx]) {
      STATE.formDraft.custom[idx].hidden = !STATE.formDraft.custom[idx].hidden;
      render();
    }
    return;
  }
  if (act === "gen-pw-draft") {
    const fkey = actEl.dataset.fkey || "secret";
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    const pw = Array.from(
      { length: 20 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
    if (STATE.formDraft) {
      const f = STATE.formDraft.fields.find((x) => x.key === fkey);
      if (f) f.value = pw;
      render();
    }
    return;
  }
  if (act === "toggle-fav") {
    e.stopPropagation();
    const id = actEl.dataset.id || STATE.selected;
    const it = STATE.items.find((x) => x.id === id);
    if (it) {
      it.favorite = !it.favorite;
      showToast(
        STATE.surface === "ext" ? "ext" : "mac",
        it.favorite ? `已收藏置顶「${it.name}」` : `已取消收藏「${it.name}」`,
      );
    }
    return;
  }
  if (act === "del-shortcut") {
    const id = actEl.dataset.id;
    const removed = STATE.shortcuts.find((s) => s.id === id);
    STATE.shortcuts = STATE.shortcuts.filter((s) => s.id !== id);
    logIpc("keymap", `已移除应用内快捷键「${removed ? removed.title : id}」`);
    showToast("mac", `已删除快捷键：${removed ? removed.key : id}`);
    return;
  }
  if (act === "reset-shortcuts") {
    STATE.shortcuts = INITIAL_SHORTCUTS.map((s) => ({ ...s }));
    logIpc("keymap", "已恢复默认应用内快捷键映射（不含系统全局热键）");
    showToast("mac", "已恢复默认应用内快捷键（6 项）");
    return;
  }
  if (act === "save-mac-form" || act === "save-ext-form") {
    commitFormDraft();
    STATE.macDrawer = null;
    STATE.extFormMode = "edit";
    STATE.dirtyCount += 1;
    logIpc("vault-writer", "本地写入完成 · 已标记待同步增量 (+1)");
    if (act === "save-ext-form") {
      if (STATE.surface === "linkage") {
        STATE.extLinkScreen = "ext-detail";
        showToast("ext", "已加密写入本机保险库");
      } else {
        go("ext", "ext-detail");
        showToast("ext", "已加密写入本机保险库");
      }
    } else showToast("mac", "已加密写入本机保险库");
    return;
  }
  if (act === "restore-ver") {
    STATE.macDrawer = null;
    STATE.dirtyCount += 1;
    logIpc("version-restore", `已将 v${actEl.dataset.ver} 恢复为当前版本`);
    showToast("mac", `已恢复版本 v${actEl.dataset.ver}（原当前版已留存历史）`);
    return;
  }
  if (act === "archive-item") {
    const idx = STATE.items.findIndex((i) => i.id === actEl.dataset.id);
    if (idx >= 0) {
      const [removed] = STATE.items.splice(idx, 1);
      STATE.archived.unshift({
        id: removed.id,
        name: removed.name,
        user: removed.user,
        kind: removed.kindLabel,
        ini: removed.ini,
        tone: removed.tone,
        archivedAt: "刚刚",
        folder: removed.folder,
      });
      STATE.lastUndo = { type: "archive", item: removed };
      STATE.selected = STATE.items[0]?.id || "";
      STATE.extSheet = false;
      STATE.dirtyCount += 1;
      logIpc("cipher-archive", `已归档 ${removed.name}`);
      showToast(STATE.surface === "ext" ? "ext" : "mac", `已归档「${removed.name}」`, {
        undoAction: "undo-last",
        secs: 5,
      });
    }
    return;
  }
  if (act === "trash-item") {
    const idx = STATE.items.findIndex((i) => i.id === actEl.dataset.id);
    if (idx >= 0) {
      const [removed] = STATE.items.splice(idx, 1);
      STATE.trash.unshift({
        id: removed.id,
        name: removed.name,
        user: removed.user,
        ini: removed.ini,
        tone: "slate",
        deletedAt: "刚刚",
        remain: "还剩 30 天",
        folder: removed.folder,
      });
      STATE.lastUndo = { type: "trash", item: removed };
      STATE.selected = STATE.items[0]?.id || "";
      STATE.extSheet = false;
      STATE.dirtyCount += 1;
      logIpc("soft-delete", `已移入回收站 ${removed.name}`);
      showToast(STATE.surface === "ext" ? "ext" : "mac", `已移到回收站「${removed.name}」`, {
        undoAction: "undo-last",
        secs: 5,
      });
    }
    return;
  }
  if (act === "undo-last" && STATE.lastUndo) {
    const u = STATE.lastUndo;
    if (u.type === "archive") STATE.archived = STATE.archived.filter((a) => a.id !== u.item.id);
    if (u.type === "trash") STATE.trash = STATE.trash.filter((t) => t.id !== u.item.id);
    STATE.items.unshift(u.item);
    STATE.selected = u.item.id;
    STATE.lastUndo = null;
    logIpc("undo", `已撤销并还原 ${u.item.name}`);
    showToast(STATE.surface === "ext" ? "ext" : "mac", `已撤销并还原「${u.item.name}」`);
    return;
  }
  if (act === "unarchive") {
    STATE.archived = STATE.archived.filter((a) => a.id !== actEl.dataset.id);
    showToast("mac", "已取消归档并恢复至主列表");
    return;
  }
  if (act === "restore-trash") {
    STATE.trash = STATE.trash.filter((t) => t.id !== actEl.dataset.id);
    showToast("mac", "已从回收站恢复条目");
    return;
  }
  if (act === "copy") {
    e.preventDefault();
    e.stopPropagation();
    triggerCopy(actEl.dataset.copyKey, actEl.dataset.label || "内容", actEl.dataset.copyVal);
    return;
  }
  if (act === "clear-clip") {
    e.stopPropagation();
    STATE.clipboard = null;
    STATE.copiedKey = null;
    STATE.toast = null;
    logIpc("clipboard", "已手动立即清空剪贴板");
    render();
    return;
  }
  if (act === "reveal") {
    e.preventDefault();
    e.stopPropagation();
    const k = actEl.dataset.revKey;
    if (STATE.revealedIds.has(k)) STATE.revealedIds.delete(k);
    else STATE.revealedIds.add(k);
    render();
    return;
  }
  if (act === "open-url") {
    e.stopPropagation();
    showToast("mac", `正在浏览器打开 https://${actEl.dataset.label}`);
    return;
  }
  if (act === "toggle-lock") {
    STATE.locked = !STATE.locked;
    logIpc(
      "com.localpass.desktop",
      STATE.locked ? "主动锁库 → 三端同步进入锁定态" : "触控 ID 解锁 → 三端会话同步恢复",
    );
    if (STATE.surface !== "linkage") {
      if (STATE.surface === "mac") go("mac", STATE.locked ? "mac-unlock" : "mac-vault");
      else if (STATE.surface === "ext") go("ext", STATE.locked ? "ext-unlock" : "ext-list");
      else render();
    } else render();
    return;
  }
  if (act === "unlock-all") {
    STATE.locked = false;
    STATE.inlineMode = "login";
    logIpc("com.localpass.desktop", "验证通过 → Mac / Chrome 扩展 / 网页内联三端同步解锁");
    if (STATE.surface === "mac") go("mac", "mac-vault");
    else if (STATE.surface === "ext") go("ext", "ext-list");
    else render();
    return;
  }
  if (act === "ext-open") {
    STATE.selected = actEl.dataset.id;
    if (STATE.surface === "linkage") {
      STATE.extLinkScreen = "ext-detail";
      render();
    } else go("ext", "ext-detail");
    return;
  }
  if (act === "ext-back") {
    const parentMap = {
      "ext-totp-qr": "ext-detail",
      "ext-item-more": "ext-detail",
      "ext-form": "ext-detail",
      "ext-generator-history": "ext-generator",
      "ext-import-preview": "ext-import",
      "ext-backup-config": "ext-sync",
      "ext-restore": "ext-sync",
      "ext-security-key": "ext-security",
      "ext-security": "ext-settings",
      "ext-folders": "ext-settings",
      "ext-archive": "ext-settings",
      "ext-trash": "ext-settings",
      "ext-health": "ext-settings",
      "ext-import": "ext-settings",
      "ext-export": "ext-settings",
      "ext-appearance": "ext-settings",
      "ext-network": "ext-settings",
      "ext-data": "ext-settings",
      "ext-about": "ext-settings",
    };
    const nextExt =
      parentMap[STATE.surface === "linkage" ? STATE.extLinkScreen : STATE.screen] || "ext-list";
    if (STATE.surface === "linkage") {
      STATE.extLinkScreen = nextExt;
      render();
    } else go("ext", nextExt);
    return;
  }
  if (act === "ext-go") {
    if (STATE.surface === "linkage") {
      STATE.extLinkScreen = actEl.dataset.ext;
      render();
    } else go("ext", actEl.dataset.ext);
    return;
  }
  if (act === "link-mac") {
    STATE.macLinkSub = actEl.dataset.sub;
    render();
    return;
  }
  if (act === "link-ext") {
    STATE.extLinkScreen = actEl.dataset.ext;
    render();
    return;
  }
  if (act === "ext-filter") {
    STATE.extFilter = actEl.dataset.filter;
    render();
    return;
  }
  if (act === "clear-ext-search") {
    STATE.extQuery = "";
    STATE.extFilter = "all";
    render();
    return;
  }
  if (act === "toggle-ext-sheet") {
    STATE.extSheet = !STATE.extSheet;
    render();
    return;
  }
  if (act === "toggle-ext-qr") {
    e.stopPropagation();
    STATE.extQr = !STATE.extQr;
    render();
    return;
  }
  if (act === "toggle-ext-keys") {
    STATE.extKeyCheat = !STATE.extKeyCheat;
    render();
    return;
  }
  if (act === "toggle-link-ext") {
    STATE.extLinkScreen = STATE.extLinkScreen === "ext-list" ? "ext-detail" : "ext-list";
    render();
    return;
  }
  if (act === "fill-from-ext") {
    e.stopPropagation();
    const it = STATE.items.find((x) => x.id === actEl.dataset.id);
    logIpc("autofill", `扩展主动填充「${it ? it.name : ""}」到 northwind.io`);
    showToast(
      STATE.surface === "linkage" ? "web" : "ext",
      `已填充「${it ? it.name : ""}」到当前网页`,
    );
    return;
  }
  if (act === "set-site-step") {
    STATE.siteStep = actEl.dataset.step;
    STATE.inlineMode =
      STATE.siteStep === "totp"
        ? "totp"
        : STATE.siteStep === "checkout"
          ? "card"
          : STATE.siteStep === "register"
            ? "register"
            : "login";
    render();
    return;
  }
  if (act === "set-inline") {
    e.stopPropagation();
    STATE.inlineMode = actEl.dataset.imode;
    render();
    return;
  }
  if (act === "fill-login") {
    const it = STATE.items.find((x) => x.id === actEl.dataset.id);
    STATE.selected = it ? it.id : STATE.selected;
    STATE.inlineMode = "collapsed";
    if (it && it.otp) STATE.siteStep = "totp";
    logIpc("autofill", `内联填充 ${it ? it.user : ""} → 进入 2FA 阶段`);
    showToast("web", `已填充 ${it ? it.user : ""}`);
    return;
  }
  if (act === "fill-totp") {
    STATE.inlineMode = "totp-filled";
    STATE.clipboard = { label: "验证码", secs: 30 };
    logIpc("autofill-totp", "已填入 492 106 并自动写入剪贴板（30s 清空）");
    showToast("web", "验证码已填入并复制 · 30 秒后清除");
    return;
  }
  if (act === "fill-card") {
    const card = STATE.items.find((x) => x.id === actEl.dataset.id);
    STATE.inlineMode = "collapsed";
    logIpc("autofill-card", `已填充尾号 ${card ? card.cardLast4 : "4421"}`);
    showToast("web", `已填充银行卡尾号 ${card ? card.cardLast4 : "4421"}`);
    return;
  }
  if (act === "trigger-save-bar") {
    STATE.saveBarOpen = true;
    STATE.inlineMode = "collapsed";
    logIpc("notification-bar", "检测到改密提交 → 匹配已有条目 Northwind");
    render();
    return;
  }
  if (act === "close-save-bar") {
    STATE.saveBarOpen = false;
    STATE.saveNewMode = false;
    STATE.saveConfirmedMode = false;
    STATE.atRiskBarOpen = false;
    render();
    return;
  }
  if (act === "commit-web-save-new") {
    const folderObj = FOLDERS.find((f) => f.name === STATE.webSaveFolder) || FOLDERS[0];
    const newId = "newvendor-" + Date.now().toString(36);
    const created = {
      id: newId,
      kind: "login",
      kindLabel: "登录",
      name: "NewVendor Console",
      user: "alex@northwind.io",
      host: "newvendor.io",
      ini: "NV",
      tone: "indigo",
      otp: null,
      folder: folderObj.name,
      folderId: folderObj.id,
      favorite: false,
      recent: true,
      siteMatch: false,
      updated: "刚刚",
      created: "刚刚",
      secret: "Nv$9qK2m!pL7@wR4x",
      strength: { score: 4, label: "强 · 17 位", reuse: "未重复", breach: "未发现" },
      custom: [],
      note: "由网页首次保存条录入。",
      versions: [
        {
          ver: 1,
          when: "刚刚",
          device: "网页保存条",
          summary: "首次保存",
          current: true,
          secret: "Nv$9qK2m!pL7@wR4x",
        },
      ],
    };
    STATE.items.unshift(created);
    STATE.selected = created.id;
    STATE.dirtyCount += 1;
    STATE.saveNewMode = false;
    STATE.saveBarOpen = true;
    STATE.saveConfirmedMode = true;
    logIpc("vault-ripple", `首次保存 NewVendor 至「${folderObj.name}」并同步三端`);
    showToast("web", `已保存到「${folderObj.name}」· 已进入确认态`);
    return;
  }
  if (act === "commit-web-update") {
    const target = STATE.items.find((i) => i.id === "northwind");
    if (target) {
      target.versions.forEach((v) => {
        v.current = false;
      });
      const nextVer = (target.versions[0]?.ver || 3) + 1;
      target.versions.unshift({
        ver: nextVer,
        when: "刚刚",
        device: "网页保存条",
        summary: "在 northwind.io 改密并更新",
        current: true,
        secret: STATE.genValue,
      });
      target.secret = STATE.genValue;
      target.updated = "刚刚";
      STATE.selected = "northwind";
      STATE.dirtyCount += 1;
    }
    STATE.saveBarOpen = false;
    logIpc("vault-ripple", "Northwind 更新至新版并实时同步至 Mac 与 Chrome 扩展");
    showToast("web", "已更新 Northwind · 三端版本历史已同步");
    return;
  }
  if (act === "link-scenario") {
    const sc = actEl.dataset.sc;
    STATE.saveBarOpen = false;
    STATE.saveNewMode = false;
    STATE.saveConfirmedMode = false;
    STATE.atRiskBarOpen = false;
    STATE.multiSaveMode = false;
    STATE.autofillToastOpen = false;
    if (sc === "login") {
      STATE.siteStep = "login";
      STATE.inlineMode = "login";
    }
    if (sc === "totp") {
      STATE.siteStep = "totp";
      STATE.inlineMode = "totp";
    }
    if (sc === "card") {
      STATE.siteStep = "checkout";
      STATE.inlineMode = "card";
    }
    if (sc === "passkey") {
      STATE.siteStep = "login";
      STATE.inlineMode = "passkey";
    }
    if (sc === "no-match") {
      STATE.siteStep = "login";
      STATE.inlineMode = "no-match";
    }
    if (sc === "empty") {
      STATE.siteStep = "login";
      STATE.inlineMode = "empty";
    }
    if (sc === "register") {
      STATE.siteStep = "register";
      STATE.inlineMode = "register";
    }
    if (sc === "save-new") {
      STATE.siteStep = "login";
      STATE.inlineMode = "collapsed";
      STATE.saveBarOpen = true;
      STATE.saveNewMode = true;
    }
    if (sc === "save-confirm") {
      STATE.siteStep = "login";
      STATE.inlineMode = "collapsed";
      STATE.saveBarOpen = true;
      STATE.saveConfirmedMode = true;
    }
    if (sc === "at-risk") {
      STATE.siteStep = "login";
      STATE.inlineMode = "collapsed";
      STATE.atRiskBarOpen = true;
    }
    if (sc === "multi-save") {
      STATE.siteStep = "register";
      STATE.inlineMode = "collapsed";
      STATE.saveBarOpen = true;
      STATE.multiSaveMode = true;
    }
    if (sc === "toast") {
      STATE.siteStep = "login";
      STATE.inlineMode = "none";
      STATE.autofillToastOpen = true;
      STATE.autofillUndoDone = false;
    }
    render();
    return;
  }
  if (act === "gen-pw") {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    STATE.genValue =
      STATE.genMode === "passphrase"
        ? "amber-ridge-cedar-flux-92"
        : Array.from(
            { length: STATE.genLen },
            () => chars[Math.floor(Math.random() * chars.length)],
          ).join("");
    STATE.genHistory.unshift({
      id: "gh-" + Date.now(),
      value: STATE.genValue,
      meta:
        STATE.genMode === "passphrase" ? "5 词短语 · 刚刚" : `${STATE.genLen} 位 · 随机密码 · 刚刚`,
      length: STATE.genValue.length,
      kind: STATE.genMode,
    });
    if (STATE.genHistory.length > 20) STATE.genHistory.length = 20;
    render();
    return;
  }
  if (act === "gen-mode") {
    STATE.genMode = actEl.dataset.mode;
    STATE.genValue =
      STATE.genMode === "passphrase" ? "amber-ridge-cedar-flux-92" : "N7$kQ2m!rT9@xL4wZ8p";
    render();
    return;
  }
  if (act === "clear-gen-history") {
    STATE.genHistory = [];
    STATE.genHistoryRevealed.clear();
    showToast(STATE.surface === "ext" ? "ext" : "mac", "已清空本机内存中的生成历史");
    return;
  }
  if (act === "reveal-gen") {
    const id = actEl.dataset.id;
    if (STATE.genHistoryRevealed.has(id)) STATE.genHistoryRevealed.delete(id);
    else STATE.genHistoryRevealed.add(id);
    render();
    return;
  }
  if (act === "add-custom-field") {
    STATE.formCustomCount += 1;
    render();
    return;
  }
  if (act === "toggle-reprompt") {
    STATE.macReprompt = !STATE.macReprompt;
    render();
    return;
  }
  if (act === "open-empty-new") {
    STATE.macSub = "vault";
    STATE.macDrawer = "new";
    STATE.formDraft = buildFormDraft(STATE.newKind || "login");
    go("mac", "mac-new");
    return;
  }
  if (act === "test-r2") {
    STATE.r2TestOk = true;
    showToast(
      STATE.surface === "ext" ? "ext" : "mac",
      "HEAD lp-7f3a 连通校验通过（38ms · TLS 1.3）",
    );
    return;
  }
  if (act === "toggle-wipe-confirm") {
    STATE.wipeConfirmed = !STATE.wipeConfirmed;
    render();
    return;
  }
  if (act === "ext-prf-toggle") {
    STATE.extSecurityKeyState = STATE.extSecurityKeyState === "waiting" ? "registered" : "waiting";
    logIpc(
      "webauthn-prf",
      STATE.extSecurityKeyState === "registered"
        ? "YubiKey 5C NFC 触摸响应成功 · PRF 解封完成"
        : "已重触发 WebAuthn PRF 等待触摸状态",
    );
    showToast(
      "ext",
      STATE.extSecurityKeyState === "registered"
        ? "PRF 硬件密钥响应成功"
        : "请轻触或插入你的安全密钥",
    );
    return;
  }
  if (act === "pick-multi-save") {
    STATE.multiSaveTarget = actEl.dataset.id;
    render();
    return;
  }
  if (act === "toggle-multi-save") {
    STATE.multiSaveMode = !STATE.multiSaveMode;
    render();
    return;
  }
  if (act === "toggle-autofill-undo") {
    STATE.autofillUndoDone = !STATE.autofillUndoDone;
    showToast(
      "web",
      STATE.autofillUndoDone ? "已撤销网页输入框填充内容" : "已重新填充 Northwind 凭据",
    );
    return;
  }
  if (act === "sync-now") {
    STATE.dirtyCount = 0;
    STATE.lastSyncText = "刚刚";
    logIpc("r2-sync-v2", "SigV4 条件写提交 manifest 成功 · 0 待传");
    showToast(STATE.surface === "ext" ? "ext" : "mac", "R2 加密快照同步完成（gen #43）");
    return;
  }
  if (act === "toggle-autosync") {
    STATE.autoSync = !STATE.autoSync;
    render();
    return;
  }
  if (act === "toggle-touchid") {
    STATE.touchIdOn = !STATE.touchIdOn;
    render();
    return;
  }
  if (act === "toggle-bridge") {
    STATE.nativeBridgeOn = !STATE.nativeBridgeOn;
    render();
    return;
  }
  if (act === "toggle-hibp") {
    STATE.hibpOn = !STATE.hibpOn;
    render();
    return;
  }
  if (act === "pick-import") {
    STATE.importSource = actEl.dataset.src;
    render();
    return;
  }
  if (act === "import-mode") {
    STATE.importConflictMode = actEl.dataset.mode;
    render();
    return;
  }
  if (act === "pick-export") {
    STATE.exportFormat = actEl.dataset.fmt;
    render();
    return;
  }
  if (act === "pick-conflict") {
    STATE.conflictChoice = actEl.dataset.c;
    render();
    return;
  }
  if (act === "fix-health") {
    STATE.selected = actEl.dataset.id === "acme-2fa" ? "acme" : actEl.dataset.id;
    const it = STATE.items.find((x) => x.id === STATE.selected) || STATE.items[0];
    STATE.formDraft = it ? buildFormDraft(it.kind, it) : buildFormDraft("login");
    STATE.macSub = "vault";
    STATE.macDrawer = "edit";
    render();
    return;
  }
  if (act === "set-density") {
    STATE.density = actEl.dataset.d;
    document.documentElement.dataset.density = STATE.density;
    $("#densityBtn").textContent = STATE.density === "ultra" ? "紧凑" : "极紧";
    $("#densityBtn").setAttribute("aria-pressed", String(STATE.density === "ultra"));
    render();
    return;
  }
  if (act === "toggle-density") {
    STATE.density = STATE.density === "compact" ? "ultra" : "compact";
    document.documentElement.dataset.density = STATE.density;
    $("#densityBtn").textContent = STATE.density === "ultra" ? "紧凑" : "极紧";
    $("#densityBtn").setAttribute("aria-pressed", String(STATE.density === "ultra"));
    render();
    return;
  }
  if (act === "toast-msg") {
    showToast(STATE.surface === "linkage" ? "mac" : STATE.surface, actEl.dataset.msg);
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "macSearchInput") {
    STATE.macQuery = e.target.value;
    render();
  } else if (e.target.id === "extSearchInput") {
    STATE.extQuery = e.target.value;
    render();
  } else if (e.target.id === "qsInput") {
    STATE.qsQuery = e.target.value;
    STATE.qsIndex = 0;
    render();
  } else if (e.target.hasAttribute("data-form-name") && STATE.formDraft) {
    STATE.formDraft.name = e.target.value;
  } else if (e.target.hasAttribute("data-df-key") && STATE.formDraft) {
    let val = e.target.value;
    if (e.target.dataset.dfKey === "expiry") {
      const digits = val.replace(/\D/g, "").slice(0, 4);
      const deleting = (e.inputType || "").startsWith("delete");
      val =
        digits.length > 2
          ? `${digits.slice(0, 2)}/${digits.slice(2)}`
          : digits.length === 2 && !deleting
            ? `${digits}/`
            : digits;
      if (e.target.value !== val) e.target.value = val;
    }
    const f = STATE.formDraft.fields.find((x) => x.key === e.target.dataset.dfKey);
    if (f) f.value = val;
  } else if (e.target.hasAttribute("data-cf-idx") && STATE.formDraft) {
    const idx = Number(e.target.dataset.cfIdx);
    const prop = e.target.dataset.cfProp;
    if (STATE.formDraft.custom[idx] && (prop === "name" || prop === "value")) {
      STATE.formDraft.custom[idx][prop] = e.target.value;
    }
  }
});

document.addEventListener("change", (e) => {
  if (e.target.hasAttribute("data-form-folder") && STATE.formDraft) {
    STATE.formDraft.folder = e.target.value;
  } else if (e.target.hasAttribute("data-df-select") && STATE.formDraft) {
    const fkey = e.target.dataset.dfSelect;
    const f = STATE.formDraft.fields.find((x) => x.key === fkey);
    if (f) {
      if (e.target.value === "__custom__") {
        f.customMode = true;
        if (Array.isArray(f.options) && f.options.includes(f.value)) f.value = "";
        render();
        const inp = document.querySelector(`[data-df-key="${fkey}"]`);
        if (inp) inp.focus();
      } else {
        f.customMode = false;
        f.value = e.target.value;
        render();
      }
    }
  } else if (e.target.hasAttribute("data-web-folder")) {
    STATE.webSaveFolder = e.target.value;
    render();
  }
});

document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  const inInput = tag === "INPUT" || tag === "TEXTAREA";
  if (
    (e.key === "Enter" || e.key === " ") &&
    !inInput &&
    document.activeElement?.getAttribute("role") === "button" &&
    document.activeElement.hasAttribute("data-act")
  ) {
    e.preventDefault();
    document.activeElement.click();
    return;
  }
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === "k" && STATE.shortcuts.some((s) => s.id === "sc-search")) {
    e.preventDefault();
    go("mac", "mac-quick-access");
    return;
  }
  if (
    !inInput &&
    (e.key === "Delete" || (meta && e.key === "Backspace")) &&
    STATE.shortcuts.some((s) => s.id === "sc-delete")
  ) {
    if (STATE.surface === "mac" && STATE.macSub === "vault" && !STATE.macDrawer && STATE.selected) {
      e.preventDefault();
      const idx = STATE.items.findIndex((i) => i.id === STATE.selected);
      if (idx >= 0) {
        const [removed] = STATE.items.splice(idx, 1);
        STATE.trash.unshift({
          id: removed.id,
          name: removed.name,
          user: removed.user,
          ini: removed.ini,
          tone: "slate",
          deletedAt: "刚刚",
          remain: "还剩 30 天",
          folder: removed.folder,
        });
        STATE.lastUndo = { type: "trash", item: removed };
        STATE.selected = STATE.items[0]?.id || "";
        STATE.dirtyCount += 1;
        logIpc("soft-delete", `快捷键删除并移入回收站 ${removed.name}`);
        showToast("mac", `已移到回收站「${removed.name}」`, { undoAction: "undo-last", secs: 5 });
      }
      return;
    }
  }
  if (e.key === "Escape") {
    if (STATE.macDrawer) {
      STATE.macDrawer = null;
      render();
      return;
    }
    if (STATE.screen === "mac-quick-access") {
      go("mac", "mac-vault");
      return;
    }
    if (STATE.extSheet || STATE.extQr || STATE.extKeyCheat) {
      STATE.extSheet = false;
      STATE.extQr = false;
      STATE.extKeyCheat = false;
      render();
      return;
    }
    if (STATE.saveBarOpen) {
      STATE.saveBarOpen = false;
      render();
      return;
    }
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const dir = e.key === "ArrowDown" ? 1 : -1;
    if (STATE.screen === "mac-quick-access") {
      e.preventDefault();
      const res = searchItems(STATE.items, STATE.qsQuery || "north", "all");
      if (res.length) STATE.qsIndex = (STATE.qsIndex + dir + res.length) % res.length;
      render();
    } else if (STATE.surface === "mac" && STATE.macSub === "vault") {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT") return;
      e.preventDefault();
      const res = searchItems(STATE.items, STATE.macQuery, STATE.macFilter);
      const cur = res.findIndex((r) => r.item.id === STATE.selected);
      if (res.length) {
        STATE.selected = res[(Math.max(0, cur) + dir + res.length) % res.length].item.id;
        render();
      }
    }
  }
});

$("#specBtn").addEventListener("click", (e) => {
  STATE.spec = !STATE.spec;
  e.currentTarget.setAttribute("aria-pressed", String(STATE.spec));
  $(".body").classList.toggle("no-notes", !STATE.spec);
  requestAnimationFrame(fit);
});
$("#gridBtn").addEventListener("click", (e) => {
  STATE.grid = !STATE.grid;
  e.currentTarget.setAttribute("aria-pressed", String(STATE.grid));
  $("#grid").classList.toggle("on", STATE.grid);
});
$("#densityBtn").addEventListener("click", (e) => {
  STATE.density = STATE.density === "compact" ? "ultra" : "compact";
  document.documentElement.dataset.density = STATE.density;
  e.currentTarget.setAttribute("aria-pressed", String(STATE.density === "ultra"));
  e.currentTarget.textContent = STATE.density === "ultra" ? "紧凑" : "极紧";
  render();
});
$("#themeBtn").addEventListener("click", (e) => {
  STATE.theme = STATE.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = STATE.theme;
  e.currentTarget.setAttribute("aria-pressed", String(STATE.theme === "dark"));
  e.currentTarget.textContent = STATE.theme === "dark" ? "亮色" : "暗色";
});
window.addEventListener("resize", () => requestAnimationFrame(fit));

setInterval(() => {
  const left = 30 - (Math.floor(Date.now() / 1000) % 30);
  document
    .querySelectorAll(".ring")
    .forEach((ring) => ring.style.setProperty("--p", String(left / 30)));
  document.querySelectorAll(".secs").forEach((s) => {
    s.textContent = String(left);
  });
  if (STATE.clipboard && STATE.clipboard.secs > 0) {
    STATE.clipboard.secs -= 1;
    if (STATE.clipboard.secs === 0) {
      STATE.clipboard = null;
      STATE.copiedKey = null;
      render();
    }
  }
}, 1000);

applyHash();
render();
