/* ---------- icons ---------- */
function ic(name, size) {
  var s = size || 16;
  var paths = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
    finger: '<path d="M12 4a8 8 0 0 0-8 8v2"/><path d="M20 14v-2a8 8 0 0 0-4-6.9"/><path d="M8 20v-6a4 4 0 0 1 8 0v4"/>',
    shield: '<path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z"/>',
    vault: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M4 12H2m20 0h-2M12 4V2m0 20v-2"/>',
    cloud: '<path d="M17 18a4 4 0 0 0 .6-7.96A6 6 0 0 0 6 9.5 3.5 3.5 0 0 0 6.5 18z"/>',
    key: '<circle cx="8" cy="8" r="4"/><path d="M11 11l9 9M17 17l2-2M15 19l2-2"/>',
    qr: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><path d="M13 13h3v3h-3z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
    alert: '<path d="M12 4l9 16H3l9-16z"/><path d="M12 10v5M12 18h.01"/>',
    wifi: '<path d="M3 9a15 15 0 0 1 18 0M6 13a10 10 0 0 1 12 0M9 17a5 5 0 0 1 6 0M12 20h.01"/>',
    gen: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  };
  return (
    '<svg class="icon" viewBox="0 0 24 24" width="' + s + '" height="' + s +
    '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] || "") + "</svg>"
  );
}

/* ---------- data ---------- */
var DATA = {
  email: "bossxie@xie.dev",
  items: [
    { type: "login", n: "GitHub", u: "bossxie · 登录", otp: "742 913", fav: true },
    { type: "server", n: "生产跳板机", u: "10.0.2.14:22 · SSH" },
    { type: "token", n: "Cloudflare API", u: "令牌 · 生产", otp: "118 402" },
    { type: "sshkey", n: "运维私钥 id_ed25519", u: "SHA256:9f2c…a71b" },
    { type: "license", n: "Sublime Text 授权", u: "序列号 · 3 台设备" },
    { type: "card", n: "招商银行 储蓄卡", u: "•••• 8891 · 借记" },
    { type: "identity", n: "本人身份证", u: "居民身份证" },
    { type: "login", n: "Proton Mail", u: "bossxie@proton.me · 登录" },
    { type: "note", n: "恢复码", u: "笔记 · 12 行" },
  ],
  passkeys: [{ n: "webauthn.me", d: "2026-11-02 登记" }],
  keys: [{ n: "YubiKey 5C NFC", d: "2026-10-18 登记 · 最后使用 3 天前" }],
  gaAccounts: [
    { iss: "GitHub", acc: "bossxie", sec: "JBS…DP" },
    { iss: "Cloudflare", acc: "ops@xie.dev", sec: "K3M…QC" },
    { iss: "Steam", acc: "bossxie", sec: "TX9…AB" },
  ],
};

/* ---------- popup atoms ---------- */
function pTop(title, sub, opts) {
  opts = opts || {};
  var nav = opts.back
    ? '<div class="nav"><span class="link" style="display:flex;gap:4px;align-items:center;font-size:12px;cursor:pointer" data-go="' + opts.back + '">' +
      ic("back", 14) + "返回</span><span></span></div>"
    : "";
  var action = opts.action
    ? '<button class="iconbtn" data-go="' + opts.action + '" aria-label="新建条目" style="margin-left:auto">' + ic("plus", 18) + "</button>"
    : "";
  return (
    '<div class="p-top">' + nav +
    '<div style="display:flex;align-items:flex-start;gap:8px"><div style="flex:1;min-width:0">' +
    "<h1>" + title + '</h1>' + (sub ? '<div class="sub">' + sub + "</div>" : "") + "</div>" + action + "</div></div>"
  );
}
function pSearch(ph) {
  return '<div class="p-search">' + ic("search", 14) + "<span>" + (ph || "搜索条目") + "</span>" +
    '<span class="kbd">⌘K</span></div>';
}
function pGroup(rows) { return '<div class="group">' + rows + "</div>"; }
function pTitle(t) { return '<div class="gtitle">' + t + "</div>"; }

function row(o) {
  var attrs = ' class="row"' + (o.go ? ' data-go="' + o.go + '"' : "");
  var left = o.emoji ? '<span class="emoji">' + o.emoji + "</span>" : o.icon ? '<span class="muted">' + ic(o.icon) + "</span>" : "";
  var main = '<span class="k">' + o.k + (o.sub ? '<span class="sub">' + o.sub + "</span>" : "") + "</span>";
  var right = "";
  if (o.value) right += '<span class="v' + (o.brand ? " brand" : "") + (o.mono ? " mono" : "") + '">' + o.value + "</span>";
  if (o.badge) right += '<span class="badge">' + o.badge + "</span>";
  if (o.toggle) right += '<span class="switch' + (o.toggle === "off" ? " off" : "") + '"></span>';
  if (o.dot) right += '<span class="dot' + (o.dot === "off" ? " amber" : "") + '"></span>';
  if (o.chev !== false && !o.toggle && !o.dot) right += '<span class="chev">' + ic("chev", 14) + "</span>";
  return "<div" + attrs + ">" + left + main + right + "</div>";
}

function pTabbar(active) {
  var tabs = [
    { k: "vault", n: "保险库", i: "vault" },
    { k: "generator", n: "生成器", i: "gen" },
    { k: "settings", n: "设置", i: "gear" },
  ];
  return '<div class="p-tabbar">' + tabs.map(function (t) {
    return '<div class="p-tab" data-go="' + t.k + '" aria-current="' + (t.k === active) + '">' + ic(t.i, 19) + "<span>" + t.n + "</span></div>";
  }).join("") + "</div>";
}

function pHero(icon, title, text) {
  return '<div class="p-hero"><div class="ring">' + ic(icon, 26) + "</div><h2>" + title + "</h2>" +
    (text ? "<p>" + text + "</p>" : "") + "</div>";
}
/* ---------- popup screens ---------- */
var POPUP = {};

POPUP.setup = function () {
  return pTop("首次使用", "没有账号，没有注册。只有这一台电脑。") +
    '<div class="p-scroll">' +
    pHero("shield", "为保险库设一个密码", "它只用来在这台电脑上解密你的数据。忘了就打不开——记得做备份。") +
    '<div class="field"><div class="lab">邮箱（仅本机派生密钥，不会上传）</div><div class="val mono">' + DATA.email + "</div></div>" +
    '<div class="field"><div class="lab">安全密码</div><div class="val mono">••••••••••••••</div></div>' +
    '<div class="field"><div class="lab">再输一次</div><div class="val mono">••••••••••••••</div></div>' +
    '<div class="note">指纹解锁只在桌面端（macOS）的设置里开启 —— 浏览器扩展本身没有这个能力。</div>' +
    '<div class="p-actions"><button class="btn" data-go="vault-empty">创建保险库</button>' +
    '<button class="btn ghost" data-go="restore-cloud">从备份恢复</button></div>' +
    '<div class="note">没有「找回密码」。数据只在你手上 —— 这是离线的代价，也是它的意义。</div>' +
    "</div>";
};

POPUP.unlock = function () {
  return '<div class="p-scroll" style="padding:0">' +
    pHero("lock", "LocalPassword", "本地保险库 · 加密存储") +
    '<div class="field"><div class="lab">安全密码</div><div class="val mono">••••••••••••</div></div>' +
    '<div class="p-actions"><button class="btn" data-go="vault">解锁</button>' +
    '<button class="btn ghost" data-go="restore-cloud">忘记密码，从备份恢复</button></div>' +
    '<div class="note" style="text-align:center">上次同步：今天 14:02 · 仅手动</div>' +
    "</div>";
};

POPUP["unlock-wait"] = function () {
  return '<div class="p-scroll" style="padding:0">' +
    pHero("lock", "LocalPassword", "密码不对") +
    '<div class="note-row warn">' + ic("alert", 14) + " 连续输错 5 次，已等待 30 秒。再错会继续加长。<b>不会登出，也不会删数据。</b></div>" +
    '<div class="field"><div class="lab">安全密码</div><div class="val mono">••••••••</div></div>' +
    '<div class="p-actions"><button class="btn" data-go="vault">解锁</button>' +
    '<button class="btn ghost" data-go="restore-cloud">忘记密码，从备份恢复</button></div>' +
    "</div>";
};

POPUP.vault = function () {
  var fav = DATA.items.filter(function (i) { return i.fav; });
  var rest = DATA.items.filter(function (i) { return !i.fav; });
  return pTop("保险库", "9 个条目 · 已加密 · 离线", { action: "new-type" }) + pSearch() +
    '<div class="p-scroll">' +
    pTitle("收藏") + pGroup(fav.map(function (i) {
      return row({ emoji: typeOf(i.type).icon, k: i.n, sub: i.u, value: i.otp || "", mono: true, brand: !!i.otp, go: "item" });
    }).join("")) +
    pTitle("全部条目") + pGroup(rest.map(function (i) {
      return row({ emoji: typeOf(i.type).icon, k: i.n, sub: i.u, go: "item" });
    }).join("")) +
    "</div>" + pTabbar("vault");
};

POPUP["vault-empty"] = function () {
  return pTop("保险库", "还没有条目", { action: "new-type" }) +
    '<div class="p-scroll">' +
    '<div class="empty"><div class="ring">' + ic("vault", 26) + "</div>" +
    "<h3>空的保险库</h3><p>新建第一条，或者从别处导入 —— 导入不会覆盖现有数据。</p></div>" +
    '<div class="empty actions">' +
    '<button class="btn primary" data-go="new-type">' + ic("plus", 15) + " 新建条目</button>" +
    '<button class="btn secondary" data-go="import-ga">从 Google 认证器导入</button>' +
    '<button class="btn secondary" data-go="restore-cloud">从备份恢复</button></div>' +
    "</div>" + pTabbar("vault");
};





POPUP["item-passkey"] = function () {
  return pTop("Passkey", "不依赖服务器的网站登录", { back: "item" }) +
    '<div class="p-scroll">' +
    pHero("key", "2 个 Passkey 已登记", "登记后，网站会用公钥验证，私钥只在本机。") +
    pGroup(DATA.passkeys.map(function (p) {
      return row({ emoji: "🔑", k: p.n, sub: p.d, chev: false });
    }).join("")) +
    '<div class="p-actions"><button class="btn" data-go="item">在网站上创建新的</button></div>' +
    '<div class="note">断网也能创建和使用 —— 保存走本地写入，不需要服务器。</div>' +
    "</div>";
};

POPUP.qr = function () {
  return pTop("动态口令二维码", "GitHub", { back: "item" }) +
    '<div class="p-scroll" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:24px">' +
    '<div class="qr-box"><div class="code"></div></div>' +
    '<div class="mono mini" style="max-width:300px;word-break:break-all;text-align:center;color:#4b515b">otpauth://totp/GitHub:bossxie?secret=JBSWY3DPEHPK3PXP</div>' +
    '<div class="note" style="text-align:center">用另一台设备扫码，即可把这个动态口令搬过去。</div>' +
    '<button class="btn" data-go="item">完成</button>' +
    "</div>";
};

POPUP.generator = function () {
  return pTop("生成器", "本地生成，不经网络") +
    '<div class="p-scroll">' +
    '<div class="seg"><button aria-pressed="true">密码</button><button>密码短语</button></div>' +
    '<div class="field" style="padding:18px 14px"><div class="val mono" style="font-size:16px;word-break:break-all">vA9#kq2$LmZ7!pR4</div>' +
    '<div class="mini muted" style="margin-top:6px">16 位 · 大小写+数字+符号 · 熵 105 bit</div></div>' +
    '<div class="field"><div class="lab">长度</div><div style="display:flex;align-items:center;gap:10px;margin-top:8px">' +
    '<span class="mini muted">8</span><div style="flex:1;height:4px;background:#e5e7ec;border-radius:999px"><div style="width:62%;height:4px;background:#2f6bff;border-radius:999px"></div></div><span class="mini muted">32</span></div></div>' +
    '<div style="padding:0 12px"><div class="group">' +
      row({ k: "大写字母", value: "", toggle: true, chev: false }) +
      row({ k: "数字", value: "", toggle: true, chev: false }) +
      row({ k: "符号", value: "", toggle: true, chev: false }) +
    "</div></div>" +
    '<div class="p-actions"><button class="btn">复制</button><button class="btn secondary" data-go="item-edit">填入新条目</button></div>' +
    "</div>" + pTabbar("generator");
};

POPUP["import-ga"] = function () {
  return pTop("导入 Google 认证器", "选择截图或粘贴导出链接", { back: "settings" }) +
    '<div class="p-scroll">' +
    '<div class="field"><div class="lab">导出链接（otpauth-migration://…）</div><div class="val mono mini">otpauth-migration://offline?data=…</div></div>' +
    '<div class="p-actions"><button class="btn">选择截图</button><button class="btn secondary" data-go="import-preview">解析</button></div>' +
    '<div class="note">Google Authenticator → 转移账号 → 导出账号 → 截图。截图只在本机解析，不上传。</div>' +
    "</div>";
};

POPUP["import-preview"] = function () {
  return pTop("确认导入", "识别到 3 个账号", { back: "import-ga" }) +
    '<div class="p-scroll">' +
    pGroup(DATA.gaAccounts.map(function (a) {
      return row({ emoji: "🔑", k: a.iss, sub: a.acc + " · " + a.sec, chev: false });
    }).join("")) +
    '<div class="note">3 个可导入；0 个重复；0 个计数器型（HOTP 暂不支持）。</div>' +
    '<div class="p-actions"><button class="btn" data-go="vault">导入 3 条</button></div>' +
    "</div>";
};

POPUP["security-key"] = function () {
  return pTop("安全密钥解锁", "WebAuthn PRF", { back: "settings" }) +
    '<div class="p-scroll">' +
    pHero("key", "已登记 1 把密钥", "解锁时用密钥验证，密码可以不再输入。") +
    pGroup(DATA.keys.map(function (k) {
      return row({ emoji: "🔐", k: k.n, sub: k.d, chev: false });
    }).join("")) +
    '<div class="p-actions"><button class="btn">登记新密钥</button><button class="btn danger">移除全部</button></div>' +
    "</div>";
};

POPUP.settings = function () {
  return pTop("设置", "完全离线 · 无账号") +
    '<div class="p-scroll">' +
    pTitle("安全") + pGroup(
      row({ k: "安全密码", sub: "3 天前修改", value: "", go: "setup" }) +
      row({ k: "安全密钥解锁", sub: "已登记 1 把", go: "security-key" }) +
      row({ k: "自动锁定", value: "15 分钟" })
    ) +
    pTitle("备份（手动）") + pGroup(
      row({ k: "云备份（R2）", sub: "r2://localpass", go: "backup" }) +
      row({ k: "上次同步", value: "今天 14:02" }) +
      row({ k: "立即备份", value: "3 份" })
    ) +
    pTitle("工具") + pGroup(
      row({ k: "Google 认证器导入", go: "import-ga" }) +
      row({ k: "导出加密 JSON", go: "data" })
    ) +
    pTitle("系统") + pGroup(
      row({ k: "网络闸门", sub: "除你配置的存储，全部拦截", go: "offline" }) +
      row({ k: "数据与安全", go: "data" }) +
      row({ k: "版本", value: "2026.11.1", chev: false })
    ) +
    "</div>" + pTabbar("settings");
};

POPUP.backup = function () {
  return pTop("云备份", "只在你点的时候联网", { back: "settings" }) +
    '<div class="p-scroll">' +
    '<div class="note-row warn">没有后台任务：改动条目不会自动上传，也没有定时器。</div>' +
    '<div class="field"><div class="lab">存储</div><div class="val">Cloudflare R2 · r2://localpass</div></div>' +
    '<div class="field"><div class="lab">上次同步</div><div class="val">今天 14:02 · 上传 1 个快照</div></div>' +
    '<div class="field"><div class="lab">上次备份</div><div class="val">今天 14:05 · 共 3 份</div></div>' +
    '<div class="p-actions">' +
    '<button class="btn">立即同步</button>' +
    '<button class="btn secondary">立即备份</button>' +
    '<button class="btn secondary" data-go="backup-config">存储配置</button>' +
    '<button class="btn danger">断开存储</button>' +
    "</div>" +
    '<div class="note">快照与备份都是加密后的密文；服务端读不出内容。</div>' +
    "</div>";
};

POPUP["backup-config"] = function () {
  return pTop("存储配置", "S3 兼容", { back: "backup" }) +
    '<div class="p-scroll">' +
    '<div class="seg"><button aria-pressed="true">R2</button><button>其它 S3</button></div>' +
    '<div class="field"><div class="lab">端点</div><div class="val mono mini">https://&lt;account&gt;.r2.cloudflarestorage.com</div></div>' +
    '<div class="field"><div class="lab">桶</div><div class="val mono">localpass</div></div>' +
    '<div class="field"><div class="lab">Access Key ID</div><div class="val mono mini">AKIA…7QX</div></div>' +
    '<div class="field"><div class="lab">Secret Access Key</div><div class="val mono">••••••••••••</div></div>' +
    '<div class="field"><div class="lab">前缀</div><div class="val mono">localpass</div></div>' +
    '<div class="p-actions"><button class="btn" data-go="backup">保存</button><button class="btn secondary">测试连接</button></div>' +
    "</div>";
};

POPUP["restore-cloud"] = function () {
  return pTop("从备份恢复", "新设备上用它", { back: "setup" }) +
    '<div class="p-scroll">' +
    pHero("cloud", "把保险库拿回来", "填入存储配置和那份保险库的安全密码。") +
    '<div class="field"><div class="lab">端点</div><div class="val mono mini">https://…r2.cloudflarestorage.com</div></div>' +
    '<div class="field"><div class="lab">桶 / 前缀</div><div class="val mono">localpass / localpass</div></div>' +
    '<div class="field"><div class="lab">Access Key / Secret</div><div class="val mono">••••••••</div></div>' +
    '<div class="field"><div class="lab">安全密码</div><div class="val mono">••••••••••••</div></div>' +
    '<div class="p-actions"><button class="btn" data-go="vault">恢复</button></div>' +
    '<div class="note">恢复会先验证密码能解开 account.json，再拉取快照；密码不对不会写入任何东西。</div>' +
    "</div>";
};

POPUP.offline = function () {
  return pTop("网络闸门", "默认拒绝", { back: "settings" }) +
    '<div class="p-scroll">' +
    pGroup(
      row({ icon: "wifi", k: "白名单", sub: "只允许你配置的存储端点", dot: "off" }) +
      row({ k: "api.local.invalid", value: "已拦截", value2: "" }) +
      row({ k: "identity.local.invalid", value: "已拦截" }) +
      row({ k: "r2.cloudflarestorage.com", value: "手动同步时允许", brand: true })
    ) +
    '<div class="note">被拦截的请求抛出 NetworkGateBlockedError，不会触发登出，也不会清空数据。</div>' +
    '<div class="p-actions"><button class="btn secondary" data-go="settings">返回</button></div>' +
    "</div>";
};

POPUP.data = function () {
  return pTop("数据与安全", "导出、导入、销毁", { back: "settings" }) +
    '<div class="p-scroll">' +
    pGroup(
      row({ k: "导出加密 JSON", sub: "标准加密 JSON（兼容格式）", go: "data" }) +
      row({ k: "从加密 JSON 导入", sub: "需要该文件的密码" }) +
      row({ k: "本地数据位置", value: "浏览器扩展存储", chev: false }) +
      row({ k: "data.json.bak", sub: "桌面端滚动备份", chev: false }) +
      row({ k: "回收站", sub: "软删除的条目", go: "trash" })
    ) +
    pTitle("危险操作") + pGroup(
      row({ k: "清空保险库", sub: "需要重新输入安全密码" })
    ) +
    '<div class="note">清理浏览器扩展数据会一并删掉保险库；云备份仍然可以从 R2 恢复。</div>' +
    "</div>";
};



POPUP["autofill"] = function () {
  return pTop("页面内联菜单", "下单时出现在输入框下方", { back: "vault" }) +
    '<div class="p-scroll" style="padding:10px 12px 0">' +
    '<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 3px #10131814">' +
      '<div class="mini muted" style="margin-bottom:6px">github.com/login</div>' +
      '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:9px 10px;font-size:12px;color:#8b919c">用户名或邮箱</div>' +
      '<div style="border:1px solid #2f6bff;border-radius:8px;padding:9px 10px;font-size:12px;margin-top:8px;color:#11131a">bossxie' +
        '<span style="float:right;color:#2f6bff">' + ic("vault", 14) + "</span></div>" +
      '<div style="margin-top:8px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px #1013181f">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid #f0f2f5">' +
          '<span>🔐</span><span style="font-size:12px;font-weight:600">GitHub</span>' +
          '<span class="mini muted" style="margin-left:auto">bossxie</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid #f0f2f5">' +
          '<span class="mini" style="color:#2f6bff">填入</span><span class="mini">用户名 + 密码</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px;padding:9px 11px">' +
          '<span class="mini" style="color:#2f6bff">填入</span><span class="mini">动态口令 742 913</span></div>' +
      "</div></div>" +
    '<div class="note">菜单是本机渲染的，键盘 ↑↓ 选择、↵ 填入；不触发任何网络请求。</div>' +
    "</div>";
};

POPUP["state-loading"] = function () {
  return pTop("从备份恢复", "正在读取 account.json", { back: "restore-cloud" }) +
    '<div class="p-scroll">' +
    '<div style="padding:24px 16px;display:flex;flex-direction:column;gap:14px;align-items:center">' +
      '<div class="spinner"></div>' +
      '<div class="mini muted">验证密码 → 拉取快照 → 写入本地</div>' +
    "</div>" +
    '<div class="field"><div class="lab">进度</div><div class="val mini">已下载 128 KB / 412 KB</div></div>' +
    '<div class="note">中途取消不会破坏现有数据：写入是最后一步。</div>' +
    "</div>";
};

POPUP["state-conflict"] = function () {
  return pTop("同步冲突", "远端与本地不一致", { back: "backup" }) +
    '<div class="p-scroll">' +
    '<div class="note-row warn">' + ic("alert", 14) + " 另一台设备在你之后也改过同一个条目。同步不会覆盖任何一边，先让你选。</div>" +
    '<div class="field"><div class="lab">冲突条目</div><div class="val">GitHub · 密码</div></div>' +
    '<div class="field"><div class="lab">本机</div><div class="val mono mini">•••• (14:02 修改)</div></div>' +
    '<div class="field"><div class="lab">远端</div><div class="val mono mini">•••• (14:19 修改)</div></div>' +
    '<div class="p-actions"><button class="btn" data-go="backup">保留远端</button>' +
    '<button class="btn secondary" data-go="backup">保留本机</button>' +
    '<button class="btn ghost" data-go="item">两边都留（新建副本）</button></div>' +
    "</div>";
};

POPUP["state-error"] = function () {
  return pTop("连接失败", "存储没有回应", { back: "backup" }) +
    '<div class="p-scroll">' +
    '<div class="note-row err">' + ic("alert", 14) + " 403 Forbidden — 密钥没有这个桶的写权限。</div>" +
    '<div class="field"><div class="lab">端点</div><div class="val mono mini">https://…r2.cloudflarestorage.com</div></div>' +
    '<div class="field"><div class="lab">请求</div><div class="val mono mini">PUT /localpass/manifest.json</div></div>' +
    '<div class="p-actions"><button class="btn secondary" data-go="backup-config">改配置</button>' +
    '<button class="btn ghost" data-go="backup">稍后再试</button></div>' +
    '<div class="note">失败不会改动本地数据，也不会有任何重试队列在后台跑。</div>' +
    "</div>";
};






/* ---------- desktop screens ---------- */
var DESK = {};

function dRail(active) {
  var navs = [
    { k: "vault", n: "保险库", i: "vault" },
    { k: "generator", n: "生成器", i: "gen" },
    { k: "settings", n: "设置", i: "gear" },
  ];
  return '<div class="d-rail">' +
    '<div class="who"><div class="av">' + DATA.email.slice(0, 2).toUpperCase() + "</div>" +
    '<div><div class="nm">本地保险库</div><div class="st">离线 · 已加密</div></div></div>' +
    navs.map(function (n) {
      return '<div class="d-nav" data-go="' + (n.k === "vault" ? "vault-desktop" : n.k === "settings" ? "settings-desktop" : "vault-desktop") +
        '" aria-current="' + (n.k === active) + '">' + ic(n.i, 16) + n.n + "</div>";
    }).join("") +
    '<div class="spacer"></div>' +
    '<div class="d-nav" data-go="offline">' + ic("wifi", 16) + "网络闸门</div>" +
    '<div class="d-nav" data-go="data">' + ic("shield", 16) + "数据与安全</div>" +
    "</div>";
}

function dList(title, sub, rows, action, opts) {
  opts = opts || {};
  return '<div class="d-list' + (opts.nav ? " nav" : "") + '">' +
    '<div class="list-head"><div><h2>' + title + "</h2>" +
    '<div class="sub">' + sub + "</div></div>" +
    (action ? '<div class="actions"><button class="btn primary sm" data-go="' + action.go + '">' +
      ic("plus", 13) + action.label + '<span class="kbd">⌘N</span></button></div>' : "") +
    "</div>" +
    (opts.hideSearch ? "" : '<div class="d-search">' + ic("search", 13) + "<span>搜索条目</span>" + '<span class="kbd">⌘K</span></div>') +
    '<div class="d-rows">' + rows + "</div></div>";
}

function dRow(o) {
  return '<div class="d-row"' + (o.current ? ' aria-current="true"' : "") + (o.go ? ' data-go="' + o.go + '"' : "") + ">" +
    '<span class="emoji">' + (o.emoji || "🔐") + "</span>" +
    '<div class="main"><div class="nm">' + o.n + '</div><div class="sub">' + (o.sub || "") + "</div></div>" +
    (o.value ? '<span class="mini mono muted">' + o.value + "</span>" : "") + "</div>";
}

DESK.setup = function () {
  return '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px">' +
    '<div style="width:460px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px #10131812">' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><div style="width:44px;height:44px;border-radius:12px;background:#eef2ff;display:grid;place-items:center;color:#2f6bff">' + ic("shield", 24) + "</div>" +
    '<div><div style="font-size:17px;font-weight:700">为这台电脑设一个密码</div><div class="mini muted">没有账号，没有注册</div></div></div>' +
    '<p class="mini muted" style="line-height:1.6;margin:10px 0 16px">它只用来解密本机数据。忘了就打不开 —— 请同时开启手动备份。</p>' +
    '<div class="field" style="margin:0 0 8px"><div class="lab">邮箱（仅本机派生密钥）</div><div class="val mono">' + DATA.email + "</div></div>" +
    '<div class="field" style="margin:0 0 8px"><div class="lab">安全密码</div><div class="val mono">••••••••••••••</div></div>' +
    '<div class="field" style="margin:0 0 12px"><div class="lab">再输一次</div><div class="val mono">••••••••••••••</div></div>' +
    '<div class="note" style="padding:0 0 12px">创建后可以在「设置 → 安全」里开启 Touch ID 解锁（仅 macOS）。</div>' +
    '<button class="btn" data-go="vault-desktop">创建保险库</button>' +
    '<button class="btn ghost" style="margin-top:8px" data-go="restore-cloud">从备份恢复</button>' +
    "</div></div>";
};

DESK.unlock = function () {
  return '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px">' +
    '<div style="width:380px;background:#fff;border-radius:16px;padding:28px;text-align:center;box-shadow:0 1px 3px #10131812">' +
    '<div style="width:64px;height:64px;border-radius:999px;background:#eef2ff;color:#2f6bff;display:grid;place-items:center;margin:0 auto 14px">' + ic("lock", 28) + "</div>" +
    '<div style="font-size:17px;font-weight:700">LocalPassword</div><div class="mini muted" style="margin-top:4px">本地保险库 · 加密存储</div>' +
    '<div class="field" style="margin:18px 0 10px"><div class="lab">安全密码</div><div class="val mono">••••••••••••</div></div>' +
    '<button class="btn" data-go="vault-desktop">解锁</button>' +
    '<button class="btn secondary" style="margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px" data-go="vault-desktop">' + ic("finger", 15) + " 用 Touch ID 解锁（macOS）</button>" +
    "</div></div>";
};



DESK["settings-desktop"] = function () {
  var list = ["安全", "备份", "工具", "系统"].map(function (s, i) {
    return dRow({ emoji: ["🔐", "☁️", "🧰", "⚙️"][i], n: s, sub: "", current: i === 1, go: "settings-desktop" });
  }).join("");
  var main =
    '<div class="hd"><h2>备份</h2><div class="d-toolbar"><span class="t">测试连接</span><span class="t">存储配置</span><span class="t primary">立即同步</span></div></div>' +
    '<div class="body">' +
    '<div class="p-toast" style="margin:0 22px 10px">没有后台任务：桌面端收进托盘也不会自动上传，所有联网由你触发。</div>' +
    '<div class="gtitle">存储</div><div class="group">' +
      row({ k: "类型", value: "Cloudflare R2", chev: false }) +
      row({ k: "端点", value: "r2://localpass", mono: true, chev: false }) +
      row({ k: "上次同步", value: "今天 14:02" }) +
      row({ k: "上次备份", value: "今天 14:05 · 3 份" }) +
    "</div>" +
    '<div class="gtitle">安全</div><div class="group">' +
      row({ icon: "finger", k: "Touch ID 解锁", sub: "仅 macOS · 使用系统指纹", toggle: true }) +
      row({ k: "备份口令", sub: "用于备份文件的独立口令", value: "••••••••" }) +
    "</div></div>" +
    '<div class="foot"><span>仅手动 · 密文上传</span><span class="mono">R2 · sigv4</span></div>';
  return dRail("settings") + dList("设置", "离线优先 · 无账号", list, null, { hideSearch: true, nav: true }) + '<div class="d-main">' + main + "</div>";
};

DESK["security-desktop"] = function () {
  var list = ["安全", "备份", "工具", "系统"].map(function (s, i) {
    return dRow({ emoji: ["🔐", "☁️", "🧰", "⚙️"][i], n: s, sub: "", current: i === 0, go: i === 1 ? "settings-desktop" : "security-desktop" });
  }).join("");
  var main =
    '<div class="hd"><h2>安全</h2><div class="d-toolbar"><span class="t">修改安全密码</span></div></div>' +
    '<div class="body">' +
    '<div class="gtitle">解锁方式</div><div class="group">' +
      row({ icon: "key", k: "安全密码", sub: "3 天前修改", value: "", chev: true }) +
      row({ icon: "finger", k: "Touch ID 解锁", sub: "仅 macOS · 使用系统指纹", toggle: true }) +
      row({ icon: "key", k: "安全密钥解锁", sub: "已登记 1 把 · WebAuthn PRF", go: "security-key" }) +
    "</div>" +
    '<div class="gtitle">锁定行为</div><div class="group">' +
      row({ k: "闲置自动锁定", value: "15 分钟" }) +
      row({ k: "系统休眠时锁定", toggle: true }) +
      row({ k: "锁定时清空剪贴板", toggle: true }) +
      row({ k: "连续输错后等待", sub: "不会登出，也不会删除数据", value: "开启", chev: false }) +
    "</div>" +
    '<div class="note">指纹只在 macOS 的桌面端可用；浏览器扩展没有生物识别接口，所以扩展里永远不出现这一项。</div>' +
    "</div>" +
    '<div class="foot"><span>本机校验 · 无服务端</span><span class="mono">WebAuthn PRF · Keychain</span></div>';
  return dRail("settings") + dList("设置", "离线优先 · 无账号", list, null, { hideSearch: true, nav: true }) + '<div class="d-main">' + main + "</div>";
};


function vaultRows(current) {
  return DATA.items.map(function (i, idx) {
    return dRow({ emoji: typeOf(i.type).icon, n: i.n, sub: i.u, value: i.otp || "", current: idx === (current || 0), go: "vault-desktop" });
  }).join("");
}









DESK["gen-desktop"] = function () {
  var list = DATA.items.map(function (i) { return dRow({ emoji: typeOf(i.type).icon, n: i.n, sub: i.u, value: i.otp || "" }); }).join("");
  var main =
    '<div class="hd"><h2>生成器</h2><div class="d-toolbar"><span class="t primary">复制</span></div></div>' +
    '<div class="body">' +
    '<div class="gtitle">密码</div><div class="group"><div class="row" style="cursor:default">' +
    '<span class="k mono" style="font-size:16px">vA9#kq2$LmZ7!pR4</span><span class="v">105 bit</span></div></div>' +
    '<div class="gtitle">选项</div><div class="group">' +
      row({ k: "长度", value: "16", chev: false }) +
      row({ k: "大写字母", toggle: true }) + row({ k: "数字", toggle: true }) + row({ k: "符号", toggle: true }) +
    "</div></div>" +
    '<div class="foot"><span>本地生成</span><span class="mono">arc4random</span></div>';
  return dRail("generator") + dList("保险库", "6 个条目", list) + '<div class="d-main">' + main + "</div>";
};
/* ---------- index + render ---------- */
/* ================= CRUD（参照上游 cipher-form / cipher-view 结构重写） ================= */

function star(active) {
  return '<span class="star' + (active ? " on" : "") + '">' + (active ? "★" : "☆") + "</span>";
}
function copyBtn() {
  return '<span class="v" style="color:#2f6bff">' + ic("copy", 14) + "</span>";
}
function uriRow(u, match) {
  return '<div class="row"><span class="k"><span class="mono" style="font-size:12px">' + u + "</span>" +
    '<span class="sub">' + (match || "默认匹配") + "</span></span>" + copyBtn() + "</div>";
}
function kvRow(k, v, opts) {
  opts = opts || {};
  return '<div class="row"><span class="k">' + k + "</span>" +
    '<span class="v' + (opts.mono ? " mono" : "") + (opts.brand ? " brand" : "") + '">' + v + "</span>" +
    (opts.copy ? copyBtn() : "") + (opts.chev ? '<span class="chev">' + ic("chev", 14) + "</span>" : "") + "</div>";
}
function inputRow(label, value, opts) {
  opts = opts || {};
  return '<div class="row"><span class="k">' + label + "</span>" +
    '<span class="v' + (opts.mask ? " mono" : "") + '"' + (opts.mask ? ' style="letter-spacing:.16em"' : "") + ">" + value + "</span>" +
    (opts.action ? '<span class="v brand" style="cursor:pointer">' + opts.action + "</span>" : "") + "</div>";
}

/* ---------- 桌面端：查看 ---------- */
DESK["vault-desktop"] = function () {
  var main =
    '<div class="hd"><div><h2>GitHub</h2><div class="meta">github.com · 登录 · 开发</div></div>' +
    '<div class="d-toolbar">' +
      '<button class="btn secondary sm" aria-label="收藏">' + star(true) + "</button>" +
      '<button class="btn secondary sm" data-go="d-form-login">' + ic("key", 13) + " 编辑</button>" +
      '<button class="btn secondary sm" data-go="d-item-delete">' + ic("alert", 13) + " 删除</button>" +
      '<button class="btn primary sm">' + ic("copy", 13) + ' 复制密码<span class="kbd">⌘C</span></button></div></div>' +
    '<div class="body">' +
    '<div class="gtitle">凭据</div><div class="group">' +
      kvRow("用户名", "bossxie", { mono: true, copy: true }) +
      kvRow("密码", "••••••••••••", { mono: true, copy: true }) +
      kvRow("动态口令", "742 913 · 18s", { mono: true, brand: true, chev: true }) +
    "</div>" +
    '<div class="gtitle">Passkey</div><div class="group">' +
      kvRow("webauthn.me", "2026-11-02 登记", { chev: true }) +
    "</div>" +
    '<div class="gtitle">自动填充（2 个网址）</div><div class="group">' +
      uriRow("github.com") + uriRow("gist.github.com", "精确匹配") +
    "</div>" +
    '<div class="gtitle">自定义字段（2）</div><div class="group">' +
      kvRow("恢复码", "••••••••", { mono: true, copy: true }) +
      kvRow("备用邮箱", "backup@xie.dev", { copy: true }) +
    "</div>" +
    '<div class="gtitle">附加项</div><div class="group">' +
      '<div class="row" style="cursor:default"><span class="k">备注<span class="sub" style="color:#4b515b;font-size:11.5px;line-height:1.5">主力开发账号；开了 2FA，恢复码存在附件里。</span></span></div>' +
      kvRow("密码重提示", "需要主密码", { chev: true }) +
      kvRow("附件", "recovery-codes.txt · 4 KB", { chev: true }) +
    "</div></div>" +
    '<div class="foot"><span>修改于 2026-11-26 14:02 · 创建于 2026-10-12</span><span class="mono">本地 · 无网络请求</span></div>';
  return dRail("vault") + dList("保险库", "6 个条目 · 已加密", vaultRows(0), { label: "＋ 新建条目", go: "d-pick-type" }) +
    '<div class="d-main">' + main + "</div>";
};

/* ---------- 桌面端：新建 / 编辑（同一套表单） ---------- */


/* ---------- 桌面端：回收站 ---------- */
DESK["d-trash"] = function () {
  var rows = [
    { e: "🔐", n: "GitHub", d: "刚刚删除 · 29 天后清除" },
    { e: "🎮", n: "Steam", d: "3 天前删除 · 27 天后清除" },
  ].map(function (r) {
    return '<div class="trash-row"><span class="emoji">' + r.e + "</span>" +
      '<div class="t">' + r.n + '<div class="d">' + r.d + "</div></div>" +
      '<button class="btn ghost sm">恢复</button>' +
      '<button class="btn danger sm">永久删除</button></div>';
  }).join("");
  var main =
    '<div class="hd"><div><h2>回收站</h2><div class="meta">2 个条目 · 30 天后自动清除</div></div>' +
    '<div class="d-toolbar"><button class="btn secondary sm">恢复全部</button>' +
    '<button class="btn danger sm">清空回收站</button></div></div>' +
    '<div class="body"><div class="gtitle">已删除</div><div class="group">' + rows + "</div>" +
    '<div class="note" style="padding:12px 24px">清空后无法恢复；云备份里可能有旧快照，但不包含删除前的最后一次改动。</div></div>' +
    '<div class="foot"><span>软删除 · 可恢复</span><span class="mono">回收站</span></div>';
  var listRows = DATA.items.map(function (i) {
    return dRow({ emoji: typeOf(i.type).icon, n: i.n, sub: i.u }) + "";
  }).join("");
  var list =
    '<div class="d-list"><div class="list-head"><div><h2>保险库</h2><div class="sub">回收站 · 2 个</div></div>' +
    '<div class="actions"><button class="btn primary sm" data-go="d-pick-type">' + ic("plus", 13) + '新建<span class="kbd">⌘N</span></button></div></div>' +
    '<div class="d-search">' + ic("search", 13) + '<span>搜索条目</span><span class="kbd">⌘K</span></div>' +
    '<div class="d-rows"><div class="d-row" data-go="vault-desktop" aria-current="true"><span class="emoji">🗑️</span>' +
    '<div class="main"><div class="nm">回收站</div><div class="sub">2 个条目</div></div></div>' + listRows + "</div></div>";
  return dRail("vault") + list + '<div class="d-main">' + main + "</div>";
};

/* ---------- 弹窗：查看 ---------- */
POPUP.item = function () {
  return pTop("GitHub", "github.com · 登录 · 开发", { back: "vault" }) +
    '<div class="p-scroll">' +
    '<div class="p-item-head">' +
      '<div class="p-item-icon">🔐</div>' +
      '<div class="p-item-main"><div class="p-item-name">GitHub</div>' +
      '<div class="p-item-sub">修改于 2026-11-26 14:02</div></div>' + star(true) + "</div>" +
    pTitle("凭据") + pGroup(
      row({ k: "用户名", value: "bossxie", mono: true, icon: "copy", chev: false }) +
      row({ k: "密码", value: "••••••••••••", mono: true, icon: "copy", chev: false }) +
      row({ k: "动态口令", value: "742 913 · 18s", mono: true, brand: true, icon: "qr", go: "qr" })
    ) +
    pTitle("自动填充") + pGroup(
      row({ k: "github.com", sub: "默认匹配", value: "", chev: false }) +
      row({ k: "gist.github.com", sub: "精确匹配", value: "", chev: false })
    ) +
    pTitle("Passkey") + pGroup(row({ emoji: "🔑", k: "webauthn.me", sub: "2026-11-02 登记", go: "item-passkey" })) +
    pTitle("自定义字段") + pGroup(
      row({ k: "恢复码", value: "••••••••", mono: true, icon: "copy", chev: false }) +
      row({ k: "备用邮箱", value: "backup@xie.dev", icon: "copy", chev: false })
    ) +
    pTitle("附加项") + pGroup(
      row({ k: "备注", sub: "主力开发账号；开了 2FA", chev: false }) +
      row({ k: "密码重提示", value: "需要主密码", chev: true }) +
      row({ emoji: "📎", k: "recovery-codes.txt", sub: "4 KB · 1 个附件", chev: false })
    ) +
    '<div class="p-actions"><button class="btn" data-go="item-edit">编辑</button>' +
    '<button class="btn secondary">克隆</button>' +
    '<button class="btn danger" data-go="item-delete">删除</button></div>' +
    "</div>";
};

/* ---------- 弹窗：编辑（登录） ---------- */


/* ---------- 弹窗：编辑（卡片） ---------- */


/* ---------- 弹窗：删除操作单 ---------- */
POPUP["item-delete"] = function () {
  var sheet =
    '<div class="sheet-wrap"><div class="sheet">' +
      '<div class="card">' +
        '<div class="opt">移到收藏</div>' +
        '<div class="opt">克隆条目</div>' +
        '<div class="opt danger" data-go="trash">移到回收站</div>' +
      "</div>" +
      '<div class="cancel" data-go="item">取消</div>' +
    "</div></div>";
  return pTop("GitHub", "github.com · 登录", { back: "item" }) +
    '<div class="p-scroll">' +
    pTitle("凭据") + pGroup(
      row({ k: "用户名", value: "bossxie", mono: true, chev: false }) +
      row({ k: "密码", value: "••••••••••••", mono: true, chev: false })
    ) +
    "</div>" + sheet;
};

/* ---------- 弹窗：回收站 ---------- */
POPUP.trash = function () {
  return pTop("回收站", "2 个条目 · 30 天后清除", { back: "item-delete" }) +
    '<div class="p-scroll">' +
    pGroup(
      row({ emoji: "🔐", k: "GitHub", sub: "刚刚删除 · 29 天后清除", value: "恢复", brand: true, chev: false }) +
      row({ emoji: "🎮", k: "Steam", sub: "3 天前删除 · 27 天后清除", value: "恢复", brand: true, chev: false })
    ) +
    '<div class="p-actions"><button class="btn secondary" data-go="item">恢复全部</button>' +
    '<button class="btn danger">清空回收站</button></div>' +
    '<div class="note">清空后无法恢复；云备份里可能有旧快照。</div>' +
    "</div>";
};

/* ---------- 桌面端：删除确认（模态） ---------- */
DESK["d-item-delete"] = function () {
  var main =
    '<div class="hd"><div><h2>GitHub</h2><div class="meta">github.com · 登录</div></div>' +
    '<div class="d-toolbar"><button class="btn secondary sm" data-go="d-form-login">编辑</button>' +
    '<button class="btn primary sm">复制密码</button></div></div>' +
    '<div class="body"><div class="gtitle">凭据</div><div class="group">' +
      kvRow("用户名", "bossxie", { mono: true, copy: true }) +
      kvRow("密码", "••••••••••••", { mono: true, copy: true }) +
    "</div></div>";
  var modal =
    '<div class="modal-wrap"><div class="modal narrow">' +
      "<h3>删除「GitHub」？</h3>" +
      '<div class="m-sub">移到回收站后 30 天内可以恢复。<b>只影响本地</b>：云端快照要等你点「立即同步」才会更新。</div>' +
      '<div class="m-actions">' +
        '<button class="btn danger" data-go="d-trash">移到回收站</button>' +
        '<button class="btn secondary" data-go="vault-desktop">取消</button>' +
      "</div></div></div>";
  return dRail("vault") + dList("保险库", "6 个条目 · 已加密", vaultRows(0), { label: " 新建", go: "d-pick-type" }) +
    '<div class="d-main">' + main + "</div>" + modal;
};

/* ================= 类型体系（简约 6 类，覆盖真实使用） ================= */
var TYPES = [
  { key: "login",    name: "登录",     icon: "🔐", blurb: "网站与 App 的账号", hint: "账号" },
  { key: "token",    name: "令牌",     icon: "🔑", blurb: "API Key、访问令牌", hint: "令牌" },
  { key: "sshkey",   name: "SSH 私钥", icon: "🗝️", blurb: "登录服务器用的私钥", hint: "私钥" },
  { key: "license",  name: "许可证",   icon: "📜", blurb: "软件序列号与激活码", hint: "许可证" },
  { key: "card",     name: "卡片",     icon: "💳", blurb: "银行卡与信用卡", hint: "卡" },
  { key: "identity", name: "身份",     icon: "🪪", blurb: "个人资料 / 护照 / 驾照", hint: "证件" },
  { key: "server",   name: "服务器",   icon: "🖥️", blurb: "主机与远程登录凭据", hint: "主机" },
  { key: "note",     name: "笔记",     icon: "📝", blurb: "恢复码、配置片段", hint: "笔记" },
];

function typeOf(key) {
  for (var i = 0; i < TYPES.length; i++) if (TYPES[i].key === key) return TYPES[i];
  return TYPES[0];
}

/** 每种类型的关键字段：简约原则——最多 5 个，其余进「附加选项」。 */
var TYPE_FIELDS = {
  login: [
    ["用户名", "bossxie"],
    ["密码", "••••••••••••", { mask: true, action: "生成" }],
    ["验证码密钥", "JBSWY3DP••••", { action: "扫码" }],
  ],
  token: [
    ["服务", "Cloudflare"],
    ["令牌", "••••••••••••••••", { mask: true, action: "显示" }],
    ["权限范围", "Zone:Edit · DNS:Edit", { chev: true }],
    ["有效期", "2027-03-01", { action: "选择" }],
    ["环境", "生产", { chev: true }],
  ],
  sshkey: [
    ["私钥", "-----BEGIN OPENSSH PRIVATE KEY----- （隐藏）", { mask: true, action: "显示" }],
    ["公钥指纹", "SHA256:9f2c…a71b", { mono: true, action: "复制" }],
    ["口令（passphrase）", "••••••••", { mask: true, action: "显示" }],
    ["用于", "生产跳板机、GitHub", { chev: true }],
  ],
  license: [
    ["软件", "Sublime Text 4"],
    ["序列号 / 激活码", "•••••-•••••-•••••", { mask: true, action: "复制" }],
    ["席位 / 版本", "个人 · 3 台设备"],
    ["购买日期", "2026-01-18", { action: "选择" }],
  ],
  card: [
    ["持卡人", "XIE BOSS"],
    ["卡号", "6214 8888 8891 0000", { mask: true, action: "扫描" }],
    ["有效期 / 安全码", "09/28 · •••", { action: "显示" }],
    ["类型", "借记卡", { chev: true }],
  ],
  identity: [
    ["证件类型", "居民身份证", { chev: true }],
    ["姓名", "谢某某"],
    ["证件号", "••••••••••••••••", { mask: true, action: "显示" }],
    ["有效期", "2031-06-30", { action: "选择" }],
  ],
  server: [
    ["主机", "10.0.2.14:22", { mono: true, action: "复制" }],
    ["协议", "SSH", { chev: true }],
    ["用户名", "root"],
    ["认证方式", "私钥（~/.ssh/id_ed25519）", { chev: true }],
    ["sudo 备注", "需要密码"],
  ],
  note: [
    ["内容", "恢复码：A1B2-C3D4 …（多行）"],
  ],
};

function typePills(active, prefix) {
  return TYPES.map(function (t) {
    var on = t.key === active;
    var go = on ? "" : ' data-go="' + (prefix || "") + t.key + '"';
    return '<span class="type-pill' + (on ? " on" : "") + '"' + go + ">" + t.icon + " " + t.name + "</span>";
  }).join("");
}

/* ---------- 桌面端：类型选择 ---------- */
DESK["d-pick-type"] = function () {
  var grid = TYPES.map(function (t) {
    return '<div class="type-card" data-go="d-form-' + t.key + '">' +
      '<div class="ico">' + t.icon + "</div>" +
      '<div class="nm">' + t.name + "</div>" +
      '<div class="bl">' + t.blurb + "</div></div>";
  }).join("");
  var main =
    '<div class="hd"><div><h2>新建条目</h2><div class="meta">先选类型，字段会按类型变化</div></div>' +
    '<div class="d-toolbar"><button class="btn secondary sm" data-go="vault-desktop">取消</button></div></div>' +
    '<div class="body"><div class="gtitle">类型（6）</div><div class="type-grid">' + grid + "</div>" +
    '<div class="note" style="padding:14px 24px">类型只影响表单字段与展示方式，加密方式完全相同。以后需要新类型时在这里加一格。</div></div>' +
    '<div class="foot"><span>选择后进入右栏内联表单</span><span class="mono">新建</span></div>';
  return dRail("vault") + dList("保险库", "6 个条目 · 已加密", vaultRows(0), { label: "＋ 新建条目", go: "d-pick-type" }) +
    '<div class="d-main">' + main + "</div>";
};

/* ---------- 桌面端：按类型的右栏内联表单 ---------- */
function deskTypeForm(key) {
  var t = typeOf(key);
  var fields = TYPE_FIELDS[key] || [];
  var rows = fields.map(function (f) {
    return inputRow(f[0], f[2] && f[2].editing === false ? "" : f[1], { mask: !!(f[2] && f[2].mask), action: f[2] && f[2].action });
  }).join("");
  var extra =
    key === "login"
      ? '<div class="gtitle">自动填充（网址）</div><div class="group">' +
        inputRow("网址 1", "github.com", { action: "删除" }) +
        inputRow("网址 2", "gist.github.com", { action: "删除" }) +
        '<div class="row"><span class="k" style="color:#2f6bff">＋ 添加网址</span></div></div>' +
        '<div class="gtitle">Passkey</div><div class="group">' +
        kvRow("webauthn.me", "2026-11-02 登记", { chev: true }) + "</div>"
      : key === "server"
      ? '<div class="gtitle">连接</div><div class="group">' +
        kvRow("上次连接", "2026-11-24 09:12", { chev: false }) +
        kvRow("备注的启动命令", "docker compose up -d", { mono: true, chev: false }) + "</div>"
      : "";
  var main =
    '<div class="hd"><div><h2>新建「' + t.name + '」</h2><div class="meta">' + t.blurb + "</div></div>" +
    '<div class="d-toolbar"><button class="btn ghost sm" data-go="d-pick-type">换类型</button>' +
    '<button class="btn secondary sm" data-go="vault-desktop">取消</button>' +
    '<button class="btn primary sm" data-go="vault-desktop">保存<span class="kbd">⌘S</span></button></div></div>' +
    '<div class="body">' +
    '<div class="gtitle">类型</div><div class="group"><div class="type-grid compact">' +
      TYPES.map(function (x) {
        return '<div class="type-card"' + (x.key === key ? ' aria-current="true"' : ' data-go="d-form-' + x.key + '"') + ">" +
          '<div class="ico">' + x.icon + '</div><div class="nm">' + x.name + "</div></div>";
      }).join("") + "</div></div>" +
    '<div class="gtitle">项目</div><div class="group">' +
      inputRow("名称", ({ server: "生产跳板机", token: "Cloudflare API", sshkey: "运维私钥 id_ed25519", license: "Sublime Text 授权", card: "招商银行 储蓄卡", identity: "本人身份证", note: "恢复码" })[key] || "GitHub") +
      inputRow("文件夹", ({ server: "运维", token: "开发", sshkey: "运维", license: "软件", card: "金融", identity: "个人", note: "个人" })[key] || "开发", { action: "选择" }) +
      '<div class="row"><span class="k">收藏</span><span class="switch off"></span></div></div>' +
    '<div class="gtitle">' + t.name + '信息</div><div class="group">' + rows + "</div>" +
    extra +
    '<div class="gtitle">附加选项</div><div class="group">' +
      '<div class="row" style="cursor:default"><span class="k">备注<span class="sub" style="color:#8b919c">可选</span></span></div>' +
      kvRow("密码重提示", "不需要", { chev: true }) +
      '<div class="row"><span class="k">附件</span><span class="v">添加文件（≤ 100 MB）</span></div></div>' +
    "</div>" +
    '<div class="foot"><span>尚未保存</span><span class="mono">新建 · ' + t.name + "</span></div>";
  return dRail("vault") + dList("保险库", "6 个条目 · 已加密", vaultRows(0), { label: "＋ 新建条目", go: "d-pick-type" }) +
    '<div class="d-main">' + main + "</div>";
}
TYPES.forEach(function (t) { DESK["d-form-" + t.key] = function () { return deskTypeForm(t.key); }; });

/* ---------- 弹窗：类型选择 ---------- */
POPUP["new-type"] = function () {
  var grid = TYPES.map(function (t) {
    return '<div class="type-card" data-go="form-' + t.key + '">' +
      '<div class="ico">' + t.icon + "</div>" +
      '<div class="nm">' + t.name + "</div>" +
      '<div class="bl">' + t.blurb + "</div></div>";
  }).join("");
  return pTop("新建条目", "先选类型", { back: "vault" }) +
    '<div class="p-scroll"><div class="type-grid">' + grid + "</div>" +
    '<div class="note">类型只影响字段与展示，加密方式完全一致。</div></div>' + pTabbar("vault");
};

/* ---------- 弹窗：按类型的表单 ---------- */
function popupTypeForm(key) {
  var t = typeOf(key);
  var fields = (TYPE_FIELDS[key] || []).map(function (f) {
    return row({ k: f[0], sub: f[1], value: f[2] && f[2].action ? f[2].action : "", brand: !!(f[2] && f[2].action), chev: false });
  }).join("");
  var extra = "";
  if (key === "login") {
    extra = pTitle("自动填充") + pGroup(
      row({ k: "github.com", value: "删除", brand: true, chev: false }) +
      row({ k: "＋ 添加网址", chev: false })
    ) + pTitle("Passkey") + pGroup(row({ emoji: "🔑", k: "webauthn.me", sub: "2026-11-02 登记", chev: true }));
  }
  return pTop("新建「" + t.name + "」", t.blurb, { back: "new-type" }) +
    '<div class="p-scroll">' +
    pTitle("类型") + '<div class="type-scroll" style="padding:0 12px 6px">' + typePills(key, "form-") + "</div>" +
    pTitle("项目") + pGroup(
      row({ k: "名称", value: "GitHub", chev: false }) +
      row({ k: "文件夹", value: "开发", chev: true })
    ) +
    pTitle(t.name + "信息") + pGroup(fields) +
    extra +
    pTitle("附加选项") + pGroup(
      row({ k: "备注", chev: true }) +
      row({ k: "密码重提示", value: "不需要", chev: true }) +
      row({ k: "附件", value: "添加", chev: true })
    ) +
    '<div class="p-actions"><button class="btn" data-go="vault">保存</button>' +
    '<button class="btn secondary" data-go="vault">取消</button></div></div>';
}
TYPES.forEach(function (t) { POPUP["form-" + t.key] = function () { return popupTypeForm(t.key); }; });

/* ---------- 列表行：按类型显示 ---------- */
function typedRows(items) {
  return items.map(function (i) {
    var t = typeOf(i.type || "login");
    return dRow({ emoji: t.icon, n: i.n, sub: i.u, value: i.value || "", go: "vault-desktop" });
  }).join("");
}

var GROUPS = [
  { g: "首次使用", device: "popup", items: [["setup", "设置安全密码"]] },
  { g: "解锁", device: "popup", items: [["unlock", "解锁（安全密码）"], ["unlock-wait", "输错等待（不登出）"]] },
  { g: "保险库", device: "popup", items: [["vault", "列表"], ["vault-empty", "空状态"], ["autofill", "页面内联菜单"]] },
  { g: "条目", device: "popup", items: [["item", "详情（读）"], ["new-type", "类型选择"], ["form-login", "登录"], ["form-token", "令牌"], ["form-sshkey", "SSH 私钥"], ["form-license", "许可证"], ["form-card", "卡片"], ["form-identity", "身份"], ["form-server", "服务器"], ["form-note", "笔记"], ["item-passkey", "Passkey"], ["qr", "动态口令二维码"]] },
  { g: "工具", device: "popup", items: [["generator", "生成器"], ["import-ga", "Google 认证器导入"], ["import-preview", "导入预览"], ["security-key", "安全密钥"]] },
  { g: "备份（手动）", device: "popup", items: [["backup", "云备份"], ["backup-config", "存储配置"], ["restore-cloud", "从备份恢复"]] },
  { g: "回收站", device: "popup", items: [["item-delete", "删除（操作单）"], ["trash", "回收站（恢复 / 清空）"]] },
  { g: "状态与异常", device: "popup", items: [["state-loading", "恢复中"], ["state-conflict", "同步冲突"], ["state-error", "连接失败"]] },
  { g: "设置 / 系统", device: "popup", items: [["settings", "设置"], ["offline", "网络闸门"], ["data", "数据与安全"]] },
  { g: "桌面端", device: "desktop", items: [["setup", "设置安全密码"], ["unlock", "解锁"], ["vault-desktop", "详情（读 · 全字段）"], ["d-pick-type", "新建 · 选类型"], ["d-form-login", "登录表单"], ["d-form-token", "令牌表单"], ["d-form-sshkey", "SSH 私钥表单"], ["d-form-license", "许可证表单"], ["d-form-card", "卡片表单"], ["d-form-identity", "身份表单"], ["d-form-server", "服务器表单"], ["d-form-note", "笔记表单"], ["d-item-delete", "删除确认（删）"], ["d-trash", "回收站（恢复 / 永久删除）"], ["gen-desktop", "生成器"], ["security-desktop", "安全设置"], ["settings-desktop", "备份设置"]] },
];

var state = { device: "popup", screen: "setup" };

function screenGroups() {
  return GROUPS.filter(function (g) { return g.device === state.device; });
}

var FLOWS = [
  { n: "首次设置 → 建库", s: ["setup", "vault-empty"] },
  { n: "解锁 → 看条目", s: ["unlock", "vault", "item"] },
  { n: "导入 Google 认证器", s: ["import-ga", "import-preview", "vault"] },
  { n: "手动备份 / 恢复", s: ["backup", "backup-config", "state-conflict", "restore-cloud", "state-loading"] },
  { n: "桌面端设置指纹", s: ["security-desktop", "unlock"] },
];

function renderIndex() {
  var html = screenGroups().map(function (g) {
    return "<h4>" + g.g + "</h4>" + g.items.map(function (it) {
      return '<button data-screen="' + it[0] + '" aria-current="' + (it[0] === state.screen) + '">' + it[1] + "</button>";
    }).join("");
  }).join("");
  var flows = '<h4>关键流程</h4>' + FLOWS.map(function (f, i) {
    return '<button data-flow="' + i + '" style="color:#2f6bff">' + "▶ " + f.n + "</button>";
  }).join("");
  document.getElementById("index").innerHTML = html + flows;
}

function renderFrame() {
  var body = state.device === "popup"
    ? (POPUP[state.screen] || POPUP.setup)()
    : (DESK[state.screen] || DESK.setup)();
  var frame = state.device === "popup"
    ? '<div class="popup">' + body + "</div>"
    : '<div class="desk">' + body + "</div>";
  document.getElementById("frame").innerHTML = frame;

  var url = new URL(location.href);
  url.searchParams.set("device", state.device);
  url.searchParams.set("screen", state.screen);
  history.replaceState(null, "", url);
}

function render() {
  renderIndex();
  renderFrame();
  document.querySelectorAll(".devices button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.device === state.device));
  });
}

/* navigation: any element with data-go switches screen on the current device */
document.addEventListener("click", function (e) {
  var nav = e.target.closest("[data-go]");
  if (nav) {
    var target = nav.dataset.go;
    var map = {
      "vault": "vault", "generator": "generator", "settings": "settings",
      "item": "item", "item-edit": "item-edit", "item-passkey": "item-passkey", "qr": "qr",
      "import-ga": "import-ga", "import-preview": "import-preview", "security-key": "security-key",
      "backup": "backup", "backup-config": "backup-config", "restore-cloud": "restore-cloud",
      "setup": "setup", "offline": "offline", "data": "data", "vault-empty": "vault-empty",
      "item-card": "item-card", "autofill": "autofill",
      "state-loading": "state-loading", "state-conflict": "state-conflict", "state-error": "state-error",
      "item-delete": "item-delete", "trash": "trash", "new-type": "new-type", "form-login": "form-login", "form-token": "form-token", "form-sshkey": "form-sshkey", "form-license": "form-license", "form-card": "form-card", "form-identity": "form-identity", "form-server": "form-server", "form-note": "form-note", "d-pick-type": "d-pick-type", "d-form-login": "d-form-login", "d-form-token": "d-form-token", "d-form-sshkey": "d-form-sshkey", "d-form-license": "d-form-license", "d-form-card": "d-form-card", "d-form-identity": "d-form-identity", "d-form-server": "d-form-server", "d-form-note": "d-form-note",
      "vault-desktop": "vault-desktop", "gen-desktop": "gen-desktop", "settings-desktop": "settings-desktop",
      "security-desktop": "security-desktop",
      "d-item-delete": "d-item-delete", "d-trash": "d-trash",
    };
    var found = map[target];
    if (!found) return;
    var exists = state.device === "popup" ? POPUP[found] : DESK[found];
    if (!exists) {
      // cross-device targets (e.g. a popup link pointing at a desktop screen) fall back to the sibling device
      if (POPUP[found] && state.device === "desktop") { state.device = "popup"; }
      else if (DESK[found] && state.device === "popup") { state.device = "desktop"; }
    }
    state.screen = found;
    render();
    return;
  }
  var flow = e.target.closest("#index button[data-flow]");
  if (flow) {
    var f = FLOWS[Number(flow.dataset.flow)];
    var first = f.s[0];
    if (POPUP[first]) state.device = "popup"; else state.device = "desktop";
    state.screen = first;
    render();
    return;
  }
  var idx = e.target.closest("#index button[data-screen]");
  if (idx) { state.screen = idx.dataset.screen; render(); return; }
  var dev = e.target.closest(".devices button");
  if (dev) {
    state.device = dev.dataset.device;
    var groups = screenGroups();
    state.screen = groups[0].items[0][0];
    render();
  }
});

var BACK = { item: "vault", "item-edit": "item", "item-card": "vault", "new-type": "vault",
  "form-login": "new-type", "form-token": "new-type", "form-sshkey": "new-type", "form-license": "new-type",
  "form-card": "new-type", "form-identity": "new-type", "form-server": "new-type", "form-note": "new-type",
  backup: "settings", "backup-config": "backup", "restore-cloud": "setup", "offline": "settings",
  data: "settings", trash: "item-delete", "item-delete": "item", "security-key": "settings",
  "import-ga": "settings", "import-preview": "import-ga", "vault-empty": "vault", qr: "item",
  "d-form-login": "vault-desktop", "d-form-token": "d-pick-type", "d-form-sshkey": "d-pick-type",
  "d-form-license": "d-pick-type", "d-form-card": "d-pick-type", "d-form-identity": "d-pick-type",
  "d-form-server": "d-pick-type", "d-form-note": "d-pick-type", "d-pick-type": "vault-desktop",
  "d-trash": "vault-desktop", "d-item-delete": "vault-desktop", "settings-desktop": "vault-desktop",
  "security-desktop": "settings-desktop", "gen-desktop": "vault-desktop" };

document.addEventListener("keydown", function (e) {
  var typing = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
  if (!typing && (e.metaKey || e.ctrlKey)) {
    var k = (e.key || "").toLowerCase();
    if (k === "n") {
      e.preventDefault();
      state.screen = state.device === "popup" ? "new-type" : "d-pick-type";
      render(); return;
    }
  }
  if (!typing && e.key === "Escape") {
    var back = BACK[state.screen];
    if (back) { state.screen = back; render(); }
    return;
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  var flat = screenGroups().reduce(function (a, g) { return a.concat(g.items.map(function (i) { return i[0]; })); }, []);
  var i = flat.indexOf(state.screen);
  if (i < 0) i = 0;
  var next = e.key === "ArrowDown" ? Math.min(flat.length - 1, i + 1) : Math.max(0, i - 1);
  state.screen = flat[next];
  render();
});

var params = new URLSearchParams(location.search);
if (params.get("device") === "desktop") state.device = "desktop";
state.screen = params.get("screen") || (state.device === "popup" ? "setup" : "setup");
render();
