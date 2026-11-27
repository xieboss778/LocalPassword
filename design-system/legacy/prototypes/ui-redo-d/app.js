/*
 * LocalPass 界面原型 — Bitwarden 原生布局
 * 假数据、假交互。所有条目内容均为演示值，不是真实凭据。
 */

/* ========================================================================== */
/* 基础工具                                                                    */
/* ========================================================================== */

const TYPES = {
  login: {
    label: "登录",
    icon: "bwi-globe",
    tile: "tile-login",
    blurb: "网站与 App 的账号",
    sub: "账号 · 密码 · 动态口令",
  },
  token: {
    label: "令牌",
    icon: "bwi-key",
    tile: "tile-token",
    blurb: "API Key、访问令牌",
    sub: "令牌 · 权限范围",
  },
  sshkey: {
    label: "SSH 私钥",
    icon: "bwi-terminal",
    tile: "tile-sshkey",
    blurb: "登录服务器用的私钥",
    sub: "私钥 · 指纹",
  },
  license: {
    label: "许可证",
    icon: "bwi-receipt",
    tile: "tile-license",
    blurb: "软件序列号与激活码",
    sub: "序列号 · 席位",
  },
  card: {
    label: "卡片",
    icon: "bwi-credit-card",
    tile: "tile-card",
    blurb: "银行卡与信用卡",
    sub: "卡号 · 有效期",
  },
  identity: {
    label: "身份",
    icon: "bwi-id-card",
    tile: "tile-identity",
    blurb: "个人资料 / 护照 / 驾照",
    sub: "证件号 · 有效期",
  },
  server: {
    label: "服务器",
    icon: "bwi-desktop",
    tile: "tile-server",
    blurb: "主机与远程登录凭据",
    sub: "主机:端口 · SSH",
  },
  note: {
    label: "笔记",
    icon: "bwi-note",
    tile: "tile-note",
    blurb: "恢复码、配置片段",
    sub: "纯文本内容",
  },
};
const TYPE_ORDER = ["login", "token", "sshkey", "license", "card", "identity", "server", "note"];

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function ic(name, extra) {
  const icon = String(name).replace(/^bwi-/, "");
  return '<i class="bwi bwi-' + icon + (extra ? " " + extra : "") + '" aria-hidden="true"></i>';
}

function tile(type, size) {
  const meta = TYPES[type] || TYPES.login;
  return (
    '<span class="icon-tile ' +
    meta.tile +
    (size ? " " + size : "") +
    '" aria-hidden="true">' +
    ic(meta.icon) +
    "</span>"
  );
}

function typeLabel(type) {
  return (TYPES[type] || TYPES.login).label;
}

function typeSub(type) {
  return (TYPES[type] || TYPES.login).sub;
}

function itemById(id) {
  return DATA.items.find((item) => item.id === id) || DATA.items[0];
}

function selectedItem() {
  return itemById(state.selectedId);
}

function logoMark(className) {
  return (
    '<svg class="' +
    (className || "") +
    '" viewBox="0 0 44 44" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M22 2 40 8.6v15.2C40 32.3 31.8 38.9 22 42 12.2 38.9 4 32.3 4 23.8V8.6L22 2Zm-9.6 11.4v17.2h7.4v-3.4h-3.9V13.4h-3.5Zm11.2 0v17.2h3.5v-6.5h4.1c3.6 0 5.9-2 5.9-5.4 0-3.2-2.2-5.3-5.8-5.3h-7.7Zm3.5 3.1h3.8c1.7 0 2.7 1 2.6 2.6 0 1.8-1 2.7-2.7 2.7h-3.8v-5.3Z"/></svg>'
  );
}

/* ========================================================================== */
/* 数据                                                                        */
/* ========================================================================== */

const DATA = {
  vaultName: "本机保险库",
  owner: "谢",
  folders: [
    { id: "dev", name: "开发", count: 1 },
    { id: "infra", name: "基础设施", count: 3 },
    { id: "fin", name: "金融", count: 1 },
    { id: "soft", name: "软件", count: 1 },
    { id: "personal", name: "个人", count: 3 },
  ],
  items: [
    {
      id: "github",
      type: "login",
      name: "GitHub",
      subtitle: "bossxie",
      favorite: true,
      folder: "开发",
      updated: "11 月 24 日",
      form: {
        username: "bossxie",
        password: "demo-Gh!7x2#pQ",
        totp: "JBSWY3DPEHPK3PXP",
        uris: ["https://github.com", "https://gist.github.com"],
        notes: "主力开发账号，已开启 2FA。恢复码放在书房抽屉的纸质备份里。",
      },
      passkeys: [{ userName: "bossxie", created: "2026/11/2 14:03" }],
      reprompt: true,
      custom: [
        { name: "组织", value: "personal", type: "text" },
        { name: "恢复码位置", value: "纸质备份（书房抽屉）", type: "text" },
        { name: "恢复码密钥", value: "demo-R3cov3ry-K3y-2026", type: "hidden" },
      ],
    },
    {
      id: "proton",
      type: "login",
      name: "Proton Mail",
      subtitle: "bossxie@proton.me",
      favorite: false,
      folder: "个人",
      updated: "11 月 22 日",
      form: {
        username: "bossxie@proton.me",
        password: "demo-Pr0ton!mail",
        totp: "",
        uris: ["https://mail.proton.me"],
        notes: "",
      },
    },
    {
      id: "bank",
      type: "card",
      name: "招商银行 储蓄卡",
      subtitle: "•••• 8891",
      favorite: false,
      folder: "金融",
      updated: "11 月 20 日",
      form: {
        cardholder: "BOSSXIE",
        number: "6225 8801 2345 8891",
        expMonth: "08",
        expYear: "29",
        code: "814",
      },
    },
    {
      id: "jump",
      type: "server",
      name: "生产跳板机",
      subtitle: "10.0.2.14:22 · SSH",
      favorite: false,
      folder: "基础设施",
      updated: "11 月 18 日",
      form: {
        host: "10.0.2.14",
        password: "demo-Ops!2026",
        protocol: "SSH",
        sudo: "sudo 需要二次确认，日志在 /var/log/ops",
      },
    },
    {
      id: "cf",
      type: "token",
      name: "Cloudflare API",
      subtitle: "令牌 · 生产环境",
      favorite: true,
      folder: "基础设施",
      updated: "11 月 15 日",
      form: {
        service: "Cloudflare",
        token: "cf_demo_9x2Kq7Lm4Tz",
        scope: "Zone:Read, DNS:Edit",
        totp: "JBSWY3DPEHPK3PXP",
        expires: "2027-03-01",
        env: "生产",
      },
    },
    {
      id: "ssh",
      type: "sshkey",
      name: "运维私钥 id_ed25519",
      subtitle: "SHA256:9f2c…a71b",
      favorite: false,
      folder: "基础设施",
      updated: "10 月 30 日",
      form: {
        privateKey:
          "-----BEGIN OPENSSH PRIVATE KEY-----\ndemo-only-not-a-real-key\n-----END OPENSSH PRIVATE KEY-----",
        publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDemoOnlyNotARealKeyForPreview",
      },
    },
    {
      id: "sublime",
      type: "license",
      name: "Sublime Text 授权",
      subtitle: "序列号 · 3 台设备",
      favorite: false,
      folder: "软件",
      updated: "10 月 21 日",
      form: {
        software: "Sublime Text",
        serial: "SUBL-DEMO-9X2K-712A",
        seats: "3 台设备 · Build 4180",
        purchased: "2024-06-12",
      },
    },
    {
      id: "idcard",
      type: "identity",
      name: "本人身份证",
      subtitle: "居民身份证",
      favorite: false,
      folder: "个人",
      updated: "10 月 12 日",
      form: {
        firstName: "Boss",
        lastName: "Xie",
        idNumber: "110101********1234",
      },
    },
    {
      id: "codes",
      type: "note",
      name: "恢复码",
      subtitle: "笔记 · 12 行",
      favorite: false,
      folder: "个人",
      updated: "09 月 28 日",
      form: {
        notes:
          "GitHub 恢复码\n- 1234-5678\n- 2345-6789\n\nProton 恢复码\n- 3456-7890\n- 4567-8901\n\n请勿拍照，定期更换。",
      },
    },
  ],
  trash: [
    {
      id: "weibo",
      type: "login",
      name: "旧微博账号",
      subtitle: "weibo.com",
      deleted: "2 天前 · 还剩 28 天",
    },
    {
      id: "test",
      type: "note",
      name: "测试条目",
      subtitle: "笔记",
      deleted: "5 天前 · 还剩 25 天",
    },
  ],
  snapshots: [
    { id: "2026-11-26", label: "2026-11-26 09:12", size: "18.4 KB", current: true },
    { id: "2026-11-19", label: "2026-11-19 21:40", size: "17.9 KB", current: false },
    { id: "2026-11-12", label: "2026-11-12 08:05", size: "17.2 KB", current: false },
  ],
};

/*
 * 网页内联演示：同一个域名下的三个 GitHub 登录账户。
 * 所有用户名、验证码、通行密钥都是合成值。
 */
const INLINE = {
  domain: "github.com",
  accounts: [
    {
      id: "github",
      username: "bossxie",
      label: "个人账户",
      tone: "a",
      passkey: true,
      password: true,
      totpSecret: "JBSWY3DPEHPK3PXP",
      lastUsed: "刚刚",
      current: true,
    },
    {
      id: "github-work",
      username: "bossxie-work",
      label: "工作账户",
      tone: "b",
      passkey: true,
      password: false,
      totpSecret: "",
      lastUsed: "昨天",
      current: false,
    },
    {
      id: "github-ops",
      username: "ops@demo.dev",
      label: "运维账户",
      tone: "c",
      passkey: false,
      password: true,
      totpSecret: "KRSXG5DSNFXGOIDB",
      lastUsed: "3 天前",
      current: false,
    },
  ],
};

const GEN_HISTORY = [
  { value: "vY7!q2#Lm9@Tz4$K", time: "今天 14:02" },
  { value: "correct-horse-battery-demo", time: "今天 11:48" },
  { value: "N3w-Passw0rd-For-GitHub", time: "昨天 20:15" },
  { value: "demo-Gh!7x2#pQ", time: "11 月 24 日" },
];

const state = {
  device: "popup",
  screen: "p-unlock",
  theme: "light",
  query: "",
  filter: { type: "all", folder: "all", fav: false },
  menu: null,
  selectedId: "github",
  revealed: {},
  formType: "login",
  formMode: "new",
  settingsTab: "security",
  genMode: "password",
  genValue: "vY7!q2#Lm9@Tz4$K",
  genLength: 16,
  genWords: 4,
  inline: {
    query: "",
    closed: false,
    filledAccount: null,
    passkeyAuth: null,
    totpAccount: "github",
  },
};

function resetInlineState() {
  state.inline.query = "";
  state.inline.closed = false;
  state.inline.filledAccount = null;
  state.inline.passkeyAuth = null;
  state.inline.totpAccount = "github";
}

/* ========================================================================== */
/* 筛选                                                                        */
/* ========================================================================== */

function matchesQuery(item) {
  const q = state.query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const haystack = [item.name, item.subtitle, item.folder, item.form.username || ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function filteredItems() {
  let items = DATA.items.filter(matchesQuery);
  if (state.filter.fav) {
    items = items.filter((item) => item.favorite);
  }
  if (state.filter.type !== "all") {
    items = items.filter((item) => item.type === state.filter.type);
  }
  if (state.filter.folder !== "all") {
    items = items.filter((item) => item.folder === state.filter.folder);
  }
  return items;
}

function isFiltering() {
  return (
    !!state.query.trim() ||
    state.filter.type !== "all" ||
    state.filter.folder !== "all" ||
    state.filter.fav
  );
}

function countType(type) {
  return DATA.items.filter((item) => !type || item.type === type).length;
}

function countFolder(name) {
  return DATA.items.filter((item) => item.folder === name).length;
}

function clearFilters() {
  state.query = "";
  state.filter = { type: "all", folder: "all", fav: false };
  state.menu = null;
}

/* ========================================================================== */
/* 共用片段                                                                    */
/* ========================================================================== */

function searchBar(desk) {
  return (
    '<div class="search">' +
    ic("search") +
    '<input type="search" data-search autocomplete="off" aria-label="搜索条目" placeholder="搜索名称、账号或文件夹" value="' +
    esc(state.query) +
    '" />' +
    (desk ? '<kbd class="kbd">⌘K</kbd>' : "") +
    "</div>"
  );
}

function filterMenu() {
  let options = "";
  if (state.menu === "type") {
    const rows = [{ value: "all", label: "全部类型", count: DATA.items.length }].concat(
      TYPE_ORDER.map((type) => ({
        value: type,
        label: typeLabel(type),
        count: countType(type),
      })),
    );
    options = rows
      .map(
        (row) =>
          '<button class="filter-option" data-filter-type="' +
          row.value +
          '" aria-pressed="' +
          (state.filter.type === row.value) +
          '">' +
          ic(row.value === "all" ? "list" : TYPES[row.value].icon) +
          "<span>" +
          esc(row.label) +
          '</span><span class="count">' +
          row.count +
          "</span></button>",
      )
      .join("");
  } else {
    const rows = [{ value: "all", label: "全部文件夹", count: DATA.items.length }].concat(
      DATA.folders.map((folder) => ({
        value: folder.name,
        label: folder.name,
        count: countFolder(folder.name),
      })),
    );
    options = rows
      .map(
        (row) =>
          '<button class="filter-option" data-filter-folder="' +
          esc(row.value) +
          '" aria-pressed="' +
          (state.filter.folder === row.value) +
          '">' +
          ic(row.value === "all" ? "list" : "folder") +
          "<span>" +
          esc(row.label) +
          '</span><span class="count">' +
          row.count +
          "</span></button>",
      )
      .join("");
  }
  return '<div class="filter-menu" role="menu">' + options + "</div>";
}

function chipBar() {
  const typeText = state.filter.type === "all" ? "类型" : typeLabel(state.filter.type);
  const folderText = state.filter.folder === "all" ? "文件夹" : state.filter.folder;
  return (
    '<div class="filter-bar">' +
    '<button type="button" class="chip" data-menu="type" aria-expanded="' +
    (state.menu === "type") +
    '">' +
    ic("list") +
    esc(typeText) +
    ic("angle-down") +
    "</button>" +
    '<button type="button" class="chip" data-menu="folder" aria-expanded="' +
    (state.menu === "folder") +
    '">' +
    ic("folder") +
    esc(folderText) +
    ic("angle-down") +
    "</button>" +
    '<button type="button" class="chip" data-filter-fav aria-pressed="' +
    state.filter.fav +
    '">' +
    ic("star-filled") +
    "收藏</button>" +
    (state.menu ? filterMenu() : "") +
    "</div>"
  );
}

function iconBtn(icon, label, go, extra) {
  return (
    '<button type="button" class="icon-btn" data-go="' +
    go +
    '" aria-label="' +
    esc(label) +
    '" title="' +
    esc(label) +
    '"' +
    (extra || "") +
    ">" +
    ic(icon) +
    "</button>"
  );
}

function copyIconBtn(icon, label, value) {
  return (
    '<button type="button" class="icon-btn" data-copy="' +
    esc(value) +
    '" data-copy-label="' +
    esc(label) +
    '" aria-label="复制' +
    esc(label) +
    '" title="复制' +
    esc(label) +
    '">' +
    ic(icon) +
    "</button>"
  );
}

function emptyState(opts) {
  return (
    '<div class="empty">' +
    '<span class="empty-icon">' +
    ic(opts.icon || "vault") +
    "</span>" +
    "<h3>" +
    esc(opts.title || "这里什么都没有") +
    "</h3>" +
    "<p>" +
    esc(opts.text || "") +
    "</p>" +
    (opts.actions ? '<div class="empty-actions">' + opts.actions + "</div>" : "") +
    "</div>"
  );
}

/* ========================================================================== */
/* 条目详情（弹窗与桌面共用）                                                  */
/* ========================================================================== */

function passkeySummary(passkey) {
  const created = "创建于 " + passkey.created;
  return passkey.userName ? passkey.userName + " · " + created : created;
}

function passkeysSection(item) {
  const passkeys = item.passkeys || [];
  if (!passkeys.length) {
    return null;
  }
  return {
    title: "通行密钥",
    rows: passkeys.map((passkey) => ({ kind: "passkey", value: passkeySummary(passkey) })),
  };
}

function customFieldsSection(item) {
  const fields = item.custom || [];
  if (!fields.length) {
    return null;
  }
  return {
    title: "自定义字段",
    rows: fields.map((field) => ({
      label: field.name,
      value: field.value,
      copy: true,
      secret: field.type === "hidden",
    })),
  };
}

function popupFieldRows(type, f) {
  switch (type) {
    case "token":
      return [
        { label: "服务", value: f.service, copy: true, mono: true },
        { label: "令牌", value: f.token, secret: true, copy: true, mono: true },
        { label: "权限范围", value: f.scope, copy: true },
        f.totp ? { label: "验证码 (TOTP)", kind: "totp" } : null,
        { label: "到期", value: f.expires, copy: true },
        { label: "环境", value: f.env, copy: true },
      ].filter(Boolean);
    case "sshkey":
      return [
        {
          label: "SSH 私钥",
          value: f.privateKey,
          secret: true,
          copy: true,
          mono: true,
          multiline: true,
        },
        { label: "公钥", value: f.publicKey, copy: true, mono: true, multiline: true },
      ];
    case "license":
      return [
        { label: "软件", value: f.software, copy: true, mono: true },
        { label: "许可证", value: f.serial, secret: true, copy: true, mono: true },
        { label: "席位 / 版本", value: f.seats, copy: true },
        { label: "购买日期", value: f.purchased, copy: true },
      ];
    case "card":
      return [
        { label: "持卡人姓名", value: f.cardholder, copy: true },
        { label: "号码", value: f.number, secret: true, copy: true, mono: true },
        { label: "过期月份", value: f.expMonth, copy: true },
        { label: "过期年份", value: f.expYear, copy: true },
        { label: "安全码", value: f.code, secret: true, copy: true, mono: true },
      ];
    case "identity":
      return [
        { label: "名字", value: f.firstName, copy: true },
        { label: "姓氏", value: f.lastName, copy: true },
        { label: "证件号", value: f.idNumber, secret: true, copy: true, mono: true },
      ];
    case "server":
      return [
        { label: "主机", value: f.host, copy: true, mono: true },
        { label: "密码", value: f.password, secret: true, copy: true, mono: true },
        { label: "协议", value: f.protocol, copy: true },
        { label: "sudo 备注", value: f.sudo, copy: true },
      ];
    default:
      return [];
  }
}

/** 弹窗详情：字段来自同一份条目定义，登录拆成凭据 / 网址两段。 */
function popupSectionsOf(item) {
  const f = item.form || {};
  const info = {
    title: "项目信息",
    rows: [
      { label: "文件夹", value: item.folder, kind: "static" },
      { label: "最后修改", value: item.updated, kind: "static" },
    ],
  };

  if (item.type === "login") {
    const credentials = [
      { label: "用户名", value: f.username, copy: true, mono: true },
      { label: "密码", value: f.password, secret: true, copy: true, mono: true },
    ];
    if (f.totp) {
      credentials.push({ label: "验证码 (TOTP)", kind: "totp" });
    }
    if (f.uris && f.uris[1]) {
      credentials.push({ label: "网址 2", value: f.uris[1], copy: true, mono: true });
    }

    return [
      {
        title: "登录凭据",
        rows: credentials.filter((row) => row.kind === "totp" || row.value),
      },
      f.uris && f.uris[0]
        ? {
            title: "自动填充选项",
            rows: [{ label: "URI", value: f.uris[0], copy: true, mono: true, uri: true }],
          }
        : null,
      passkeysSection(item),
      customFieldsSection(item),
      info,
    ].filter(Boolean);
  }

  const rows = popupFieldRows(item.type, f).filter((row) => row.kind === "totp" || row.value);
  const notes = f.notes
    ? {
        title: "备注",
        rows: [{ label: "备注", value: f.notes, kind: "notes", copy: true }],
      }
    : null;

  return [
    rows.length ? { title: "项目详细信息", rows } : null,
    notes,
    customFieldsSection(item),
    info,
  ].filter(Boolean);
}

/** 桌面端详情沿用原型的分段布局，字段映射与当前条目定义保持一致。 */
function desktopSectionsOf(item) {
  const f = item.form || {};
  const info = {
    title: "条目信息",
    rows: [
      { label: "文件夹", value: item.folder, kind: "static" },
      { label: "最后修改", value: item.updated, kind: "static" },
    ],
  };
  switch (item.type) {
    case "login":
      return [
        {
          title: "登录信息",
          rows: [
            { label: "用户名", value: f.username, copy: true, mono: true },
            { label: "密码", value: f.password, secret: true, copy: true, mono: true },
          ].concat(f.totp ? [{ label: "验证码 (TOTP)", kind: "totp" }] : []),
        },
        {
          title: "自动填充选项",
          rows: (f.uris || []).map((uri) => ({
            label: "URI",
            value: uri,
            copy: true,
            mono: true,
          })),
        },
        passkeysSection(item),
        customFieldsSection(item),
        {
          title: "附加选项",
          rows: [
            f.notes ? { label: "备注", value: f.notes, kind: "notes" } : null,
            {
              label: "密码重提示",
              value: item.reprompt ? "已开启" : "未开启",
              kind: "static",
            },
          ].filter(Boolean),
        },
        info,
      ].filter(Boolean);
    case "token":
      return [
        {
          title: "令牌",
          rows: [
            { label: "服务", value: f.service, copy: true, mono: true },
            { label: "令牌", value: f.token, secret: true, copy: true, mono: true },
            { label: "权限范围", value: f.scope, kind: "static" },
            f.totp ? { label: "验证码 (TOTP)", kind: "totp" } : null,
            { label: "到期", value: f.expires, kind: "static" },
            { label: "环境", value: f.env, kind: "static" },
          ].filter(Boolean),
        },
        customFieldsSection(item),
        info,
      ].filter(Boolean);
    case "sshkey":
      return [
        {
          title: "密钥",
          rows: [
            {
              label: "SSH 私钥",
              value: f.privateKey,
              secret: true,
              copy: true,
              mono: true,
              multiline: true,
            },
            { label: "公钥", value: f.publicKey, copy: true, mono: true, multiline: true },
          ],
        },
        customFieldsSection(item),
        info,
      ].filter(Boolean);
    case "license":
      return [
        {
          title: "许可证",
          rows: [
            { label: "软件", value: f.software, kind: "static" },
            { label: "许可证", value: f.serial, secret: true, copy: true, mono: true },
            { label: "席位 / 版本", value: f.seats, kind: "static" },
            { label: "购买日期", value: f.purchased, kind: "static" },
          ],
        },
        customFieldsSection(item),
        info,
      ].filter(Boolean);
    case "card":
      return [
        {
          title: "卡片信息",
          rows: [
            { label: "持卡人姓名", value: f.cardholder, copy: true },
            { label: "号码", value: f.number, secret: true, copy: true, mono: true },
            { label: "过期月份", value: f.expMonth, copy: true, mono: true },
            { label: "过期年份", value: f.expYear, copy: true, mono: true },
            { label: "安全码", value: f.code, secret: true, copy: true, mono: true },
          ],
        },
        customFieldsSection(item),
        info,
      ].filter(Boolean);
    case "identity":
      return [
        {
          title: "身份信息",
          rows: [
            { label: "名字", value: f.firstName, copy: true },
            { label: "姓氏", value: f.lastName, copy: true },
            { label: "证件号", value: f.idNumber, secret: true, copy: true, mono: true },
          ],
        },
        customFieldsSection(item),
        info,
      ].filter(Boolean);
    case "server":
      return [
        {
          title: "连接",
          rows: [
            { label: "主机", value: f.host, copy: true, mono: true },
            { label: "密码", value: f.password, secret: true, copy: true, mono: true },
            { label: "协议", value: f.protocol, kind: "static" },
          ],
        },
        {
          title: "备注",
          rows: [{ label: "sudo", value: f.sudo, kind: "notes" }],
        },
        customFieldsSection(item),
        info,
      ].filter(Boolean);
    case "note":
    default:
      return [
        {
          title: "笔记",
          rows: [{ label: "内容", value: f.notes, kind: "notes" }],
        },
        customFieldsSection(item),
        info,
      ].filter(Boolean);
  }
}

function detailRow(row, item) {
  if (!row) {
    return "";
  }
  if (row.kind === "passkey") {
    return (
      '<div class="detail-row static passkey-row">' +
      '<span class="detail-end passkey-icon">' +
      ic("passkey") +
      "</span>" +
      '<span class="detail-value">' +
      esc(row.value) +
      "</span></div>"
    );
  }
  if (row.kind === "totp") {
    return (
      '<div class="detail-row" role="button" tabindex="0" data-totp-row data-copy="" data-copy-label="验证码 (TOTP)">' +
      '<span class="detail-label">验证码 (TOTP)</span>' +
      '<span class="detail-value totp-value" data-totp>742 913</span>' +
      '<span class="detail-end">' +
      '<span class="totp-bar" data-totp-bar><i></i></span>' +
      '<span class="detail-copy-hint">' +
      ic("copy") +
      "</span></span></div>"
    );
  }
  const key = item.id + ":" + row.label;
  const isSecret = !!row.secret;
  const revealed = !!state.revealed[key];
  const copyable = !!row.copy;
  const multiline = !!row.multiline || row.kind === "notes";
  const rowCopy = copyable && !multiline;
  const valueClass =
    "detail-value" +
    (row.mono ? " mono" : "") +
    (row.brand ? " brand" : "") +
    (multiline ? " notes" : "");
  let valueHtml;
  if (isSecret && !revealed) {
    valueHtml = '<span class="' + valueClass + '">••••••••••••</span>';
  } else {
    valueHtml = '<span class="' + valueClass + '">' + esc(row.value) + "</span>";
  }
  const attrs = rowCopy
    ? ' role="button" tabindex="0" data-copy="' +
      esc(row.value) +
      '" data-copy-label="' +
      esc(row.label) +
      '"'
    : "";
  let end = "";
  if (isSecret) {
    end +=
      '<button type="button" class="icon-btn sm" data-reveal="' +
      esc(key) +
      '" aria-label="' +
      (revealed ? "隐藏" : "显示") +
      esc(row.label) +
      '" title="' +
      (revealed ? "隐藏" : "显示") +
      '">' +
      ic(revealed ? "visibility-off" : "visibility") +
      "</button>";
  }
  if (row.uri) {
    end +=
      '<button type="button" class="icon-btn sm" data-launch-uri="' +
      esc(row.value) +
      '" aria-label="打开网站" title="打开网站">' +
      ic("external-link") +
      "</button>";
  }
  if (multiline && copyable && row.value) {
    end +=
      '<button type="button" class="icon-btn sm" data-copy="' +
      esc(row.value) +
      '" data-copy-label="' +
      esc(row.label) +
      '" aria-label="复制' +
      esc(row.label) +
      '" title="复制' +
      esc(row.label) +
      '">' +
      ic("copy") +
      "</button>";
  } else if (rowCopy) {
    end += '<span class="detail-copy-hint">' + ic("copy") + "</span>";
  }
  return (
    '<div class="detail-row' +
    (rowCopy ? "" : " static") +
    '"' +
    attrs +
    ">" +
    '<span class="detail-label">' +
    esc(row.label) +
    "</span>" +
    valueHtml +
    (end ? '<span class="detail-end">' + end + "</span>" : "") +
    "</div>"
  );
}

function detailSectionsHtml(item, desk) {
  const sections = desk ? desktopSectionsOf(item) : popupSectionsOf(item);
  return sections
    .map(
      (section) =>
        '<section class="detail-section' +
        (desk ? " desk-section" : "") +
        '">' +
        '<div class="detail-section-title">' +
        esc(section.title) +
        "</div>" +
        '<div class="detail-card">' +
        section.rows.map((row) => detailRow(row, item)).join("") +
        "</div></section>",
    )
    .join("");
}

function detailHero(item, desk) {
  const f = item.form || {};
  let quick = "";
  if (item.type === "login") {
    quick =
      copyIconBtn("user", "用户名", f.username) +
      copyIconBtn("key", "密码", f.password) +
      '<button type="button" class="icon-btn brand" data-launch aria-label="打开网站" title="打开网站">' +
      ic("external-link") +
      "</button>";
  } else {
    quick =
      '<button type="button" class="icon-btn brand" data-copy="' +
      esc(item.subtitle) +
      '" data-copy-label="' +
      esc(typeLabel(item.type)) +
      '" aria-label="复制识别信息" title="复制识别信息">' +
      ic("copy") +
      "</button>";
  }
  return (
    '<div class="detail-hero' +
    (desk ? " desk-hero" : "") +
    '">' +
    tile(item.type, "lg") +
    '<div class="detail-hero-main"><p>' +
    esc(item.subtitle) +
    " · " +
    esc(item.folder) +
    "</p></div>" +
    '<div class="detail-hero-actions">' +
    quick +
    "</div></div>"
  );
}

/* ========================================================================== */
/* 表单（按类型生成，弹窗与桌面共用）                                          */
/* ========================================================================== */

function formGroups(type, item) {
  const f = (item && item.form) || {};
  const base = [
    {
      key: "item",
      title: "项目信息",
      fields: [
        {
          label: "名称",
          key: "name",
          value: item ? item.name : "",
          placeholder: "给条目起个名字",
        },
        {
          label: "文件夹",
          key: "folder",
          kind: "select",
          value: item ? item.folder : "个人",
          options: DATA.folders.map((folder) => folder.name),
        },
        {
          label: "收藏",
          key: "favorite",
          kind: "switch",
          hint: "在列表里置顶显示",
          value: !!(item && item.favorite),
        },
      ],
    },
  ];
  switch (type) {
    case "login":
      return base.concat([
        {
          key: "login",
          title: "登录信息",
          fields: [
            { label: "用户名", key: "username", value: f.username || "", mono: true },
            {
              label: "密码",
              key: "password",
              kind: "password",
              value: f.password || "",
              generate: true,
              mono: true,
            },
            {
              label: "验证器密钥",
              key: "totp",
              value: f.totp || "",
              placeholder: "Base32 密钥或 otpauth:// 链接",
              hint: "用于生成动态口令，可留空",
            },
          ],
        },
        {
          key: "uri",
          title: "自动填充选项",
          fields: [
            { label: "URI", key: "uri1", value: (f.uris && f.uris[0]) || "", mono: true },
            {
              label: "网址 2",
              key: "uri2",
              value: (f.uris && f.uris[1]) || "",
              mono: true,
            },
          ],
        },
        {
          key: "options",
          title: "附加选项",
          fields: [
            {
              label: "备注",
              key: "notes",
              kind: "textarea",
              value: f.notes || "",
              placeholder: "只对自己可见的说明",
              mono: true,
            },
            {
              label: "密码重提示",
              key: "reprompt",
              kind: "switch",
              value: !!(item && item.reprompt),
            },
          ],
        },
      ]);
    case "token":
      return base.concat([
        {
          key: "token",
          title: "令牌",
          fields: [
            {
              label: "服务",
              key: "service",
              value: f.service || "",
              placeholder: "Cloudflare",
              mono: true,
            },
            {
              label: "令牌",
              key: "token",
              kind: "password",
              value: f.token || "",
              generate: true,
              mono: true,
            },
            {
              label: "权限范围",
              key: "scope",
              value: f.scope || "",
              placeholder: "Zone:Read, DNS:Edit",
            },
            {
              label: "验证器密钥",
              key: "totp",
              value: f.totp || "",
              placeholder: "Base32 密钥或 otpauth:// 链接",
              hint: "用于生成动态口令，可留空",
            },
            { label: "到期", key: "expires", value: f.expires || "", placeholder: "2027-03-01" },
            { label: "环境", key: "env", value: f.env || "生产" },
          ],
        },
      ]);
    case "sshkey":
      return base.concat([
        {
          key: "ssh",
          title: "SSH 私钥",
          fields: [
            {
              label: "SSH 私钥",
              key: "privateKey",
              kind: "textarea",
              value: f.privateKey || "",
              placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----",
              mono: true,
            },
            {
              label: "公钥",
              key: "publicKey",
              kind: "textarea",
              value: f.publicKey || "",
              placeholder: "ssh-ed25519 AAAAC3...",
              mono: true,
            },
          ],
        },
      ]);
    case "license":
      return base.concat([
        {
          key: "license",
          title: "许可证",
          fields: [
            { label: "软件", key: "software", value: f.software || "", mono: true },
            {
              label: "许可证",
              key: "serial",
              kind: "password",
              value: f.serial || "",
              mono: true,
            },
            { label: "席位 / 版本", key: "seats", value: f.seats || "" },
            { label: "购买日期", key: "purchased", value: f.purchased || "" },
          ],
        },
      ]);
    case "card":
      return base.concat([
        {
          key: "card",
          title: "卡片",
          fields: [
            { label: "持卡人姓名", key: "cardholder", value: f.cardholder || "" },
            {
              label: "号码",
              key: "number",
              kind: "password",
              value: f.number || "",
              mono: true,
            },
            {
              label: "过期月份",
              key: "expMonth",
              value: f.expMonth || "",
              placeholder: "MM",
            },
            { label: "过期年份", key: "expYear", value: f.expYear || "", placeholder: "YY" },
            {
              label: "安全码",
              key: "code",
              kind: "password",
              value: f.code || "",
              mono: true,
            },
          ],
        },
      ]);
    case "identity":
      return base.concat([
        {
          key: "identity",
          title: "身份",
          fields: [
            { label: "名字", key: "firstName", value: f.firstName || "" },
            { label: "姓氏", key: "lastName", value: f.lastName || "" },
            {
              label: "证件号",
              key: "idNumber",
              kind: "password",
              value: f.idNumber || "",
              mono: true,
            },
          ],
        },
      ]);
    case "server":
      return base.concat([
        {
          key: "server",
          title: "服务器",
          fields: [
            { label: "主机", key: "host", value: f.host || "", mono: true },
            {
              label: "密码",
              key: "password",
              kind: "password",
              value: f.password || "",
              mono: true,
            },
            { label: "协议", key: "protocol", value: f.protocol || "SSH" },
            { label: "sudo 备注", key: "sudo", value: f.sudo || "" },
          ],
        },
      ]);
    case "note":
    default:
      return base.concat([
        {
          key: "note",
          title: "笔记",
          fields: [
            {
              label: "备注",
              key: "notes",
              kind: "textarea",
              value: f.notes || "",
              placeholder: "恢复码、配置片段……",
              mono: true,
            },
          ],
        },
      ]);
  }
}

function formFieldHtml(field, desk) {
  if (field.kind === "switch") {
    return (
      '<div class="form-switch-row">' +
      '<div><div class="field-label">' +
      esc(field.label) +
      "</div>" +
      (field.hint ? '<div class="field-hint">' + esc(field.hint) + "</div>" : "") +
      "</div>" +
      '<button type="button" class="switch" role="switch" data-toggle aria-checked="' +
      field.value +
      '" aria-label="' +
      esc(field.label) +
      '"></button></div>'
    );
  }
  const label =
    '<label class="field-label" for="field-' +
    esc(field.key) +
    '">' +
    esc(field.label) +
    "</label>";
  let control = "";
  if (field.kind === "select") {
    control =
      '<select class="input" id="field-' +
      esc(field.key) +
      '">' +
      field.options
        .map(
          (option) =>
            "<option" +
            (option === field.value ? " selected" : "") +
            ">" +
            esc(option) +
            "</option>",
        )
        .join("") +
      "</select>";
  } else if (field.kind === "textarea") {
    control =
      '<textarea class="input' +
      (field.mono ? " mono" : "") +
      '" id="field-' +
      esc(field.key) +
      '" rows="4" placeholder="' +
      esc(field.placeholder || "") +
      '">' +
      esc(field.value) +
      "</textarea>";
  } else if (field.kind === "password") {
    control =
      '<div class="input-wrap">' +
      '<input id="field-' +
      esc(field.key) +
      '" data-input-key="' +
      esc(field.key) +
      '" type="password" autocomplete="off" value="' +
      esc(field.value) +
      '" placeholder="' +
      esc(field.placeholder || "") +
      '"' +
      (field.mono ? ' class="mono"' : "") +
      " />" +
      '<button type="button" class="icon-btn sm" data-reveal-input="' +
      esc(field.key) +
      '" aria-label="显示' +
      esc(field.label) +
      '">' +
      ic("visibility") +
      "</button>" +
      (field.generate
        ? '<button type="button" class="icon-btn sm brand" data-generate-into="' +
          esc(field.key) +
          '" aria-label="生成' +
          esc(field.label) +
          '" title="生成">' +
          ic("generate") +
          "</button>"
        : "") +
      "</div>";
  } else {
    control =
      '<div class="input-wrap">' +
      '<input id="field-' +
      esc(field.key) +
      '" data-input-key="' +
      esc(field.key) +
      '" type="text" autocomplete="off" value="' +
      esc(field.value) +
      '" placeholder="' +
      esc(field.placeholder || "") +
      '"' +
      (field.mono ? ' class="mono"' : "") +
      " />" +
      "</div>";
  }
  return (
    '<div class="field">' +
    label +
    control +
    (field.hint ? '<div class="field-hint">' + esc(field.hint) + "</div>" : "") +
    "</div>"
  );
}

function formPasskeyRow(passkey) {
  return (
    '<div class="form-passkey-row" data-passkey-row>' +
    '<span class="form-passkey-label">通行密钥</span>' +
    '<span class="form-passkey-value">' +
    esc(passkeySummary(passkey)) +
    "</span>" +
    '<button type="button" class="icon-btn sm danger" data-passkey-remove aria-label="移除通行密钥" title="移除通行密钥">' +
    ic("trash") +
    "</button></div>"
  );
}

function customRevealButton() {
  return (
    '<button type="button" class="icon-btn sm" data-custom-reveal aria-label="显示值" title="显示值">' +
    ic("visibility") +
    "</button>"
  );
}

function customFieldRowHtml(field) {
  const hidden = field.type === "hidden";
  return (
    '<div class="custom-field" data-custom-row>' +
    '<div class="custom-field-head">' +
    '<div class="input-wrap custom-name">' +
    '<input type="text" value="' +
    esc(field.name) +
    '" placeholder="字段名" aria-label="字段名" autocomplete="off" data-custom-name />' +
    "</div>" +
    '<select class="input custom-type" aria-label="字段类型" data-custom-type>' +
    '<option value="text"' +
    (hidden ? "" : " selected") +
    ">文本</option>" +
    '<option value="hidden"' +
    (hidden ? " selected" : "") +
    ">隐藏</option>" +
    "</select>" +
    '<button type="button" class="icon-btn sm danger" data-custom-remove aria-label="移除" title="移除">' +
    ic("trash") +
    "</button></div>" +
    '<div class="input-wrap custom-value">' +
    '<input type="' +
    (hidden ? "password" : "text") +
    '"' +
    (hidden ? ' class="mono"' : "") +
    ' value="' +
    esc(field.value) +
    '" placeholder="值" aria-label="值" autocomplete="off" data-custom-value />' +
    (hidden ? customRevealButton() : "") +
    "</div></div>"
  );
}

function customFieldsHtml(item) {
  const fields = (item && item.custom) || [];
  return (
    '<section class="form-section">' +
    '<div class="form-section-title">自定义字段</div>' +
    '<div class="form-card custom-card">' +
    "<div data-custom-rows>" +
    fields.map((field) => customFieldRowHtml(field)).join("") +
    "</div>" +
    '<button type="button" class="custom-add" data-custom-add>' +
    ic("plus") +
    "<span>添加字段</span></button>" +
    "</div></section>"
  );
}

function formHtml(type, item, desk) {
  const groups = formGroups(type, item);
  return (
    '<form class="form-stack" autocomplete="off" onsubmit="return false">' +
    groups
      .map((group) => {
        let rows = group.fields.map((field) => formFieldHtml(field, desk)).join("");
        if (group.key === "login" && !desk && item && item.passkeys && item.passkeys.length) {
          rows += formPasskeyRow(item.passkeys[0]);
        }
        return (
          '<section class="form-section">' +
          '<div class="form-section-title">' +
          esc(group.title) +
          "</div>" +
          '<div class="form-card">' +
          rows +
          "</div></section>"
        );
      })
      .join("") +
    customFieldsHtml(item) +
    "</form>"
  );
}

/* ========================================================================== */
/* 弹窗（380×620）                                                             */
/* ========================================================================== */

const P = {};

function pApp(content, opts) {
  const options = opts || {};
  return (
    '<div class="p-app">' +
    content +
    (options.nav === false ? "" : pBottomNav(options.active)) +
    "</div>"
  );
}

function pBottomNav(active) {
  const tabs = [
    { id: "p-vault", icon: "vault", label: "保险库" },
    { id: "p-generator", icon: "generate", label: "生成器" },
    { id: "p-settings", icon: "settings", label: "设置" },
  ];
  return (
    '<nav class="p-bottom-nav" aria-label="主导航">' +
    tabs
      .map(
        (tab) =>
          '<button type="button" class="p-nav-item" data-go="' +
          tab.id +
          '"' +
          (tab.id === active ? ' aria-current="page"' : "") +
          ">" +
          ic(tab.icon) +
          "<span>" +
          tab.label +
          "</span></button>",
      )
      .join("") +
    "</nav>"
  );
}

function pHeader(opts) {
  return (
    '<header class="p-header">' +
    (opts.back
      ? '<button type="button" class="p-back" data-go="' +
        opts.back +
        '" aria-label="返回">' +
        ic("angle-left") +
        "</button>"
      : "") +
    '<div class="p-header-main"><div class="p-title-row"><h1 class="p-title">' +
    esc(opts.title) +
    "</h1>" +
    (opts.titleExtra || "") +
    "</div>" +
    (opts.sub ? '<div class="p-sub">' + esc(opts.sub) + "</div>" : "") +
    "</div>" +
    '<div class="p-header-actions">' +
    (opts.actions || "") +
    "</div></header>"
  );
}

function pFooter(buttons) {
  return '<div class="p-footer">' + buttons + "</div>";
}

function vaultRow(item) {
  const sub = item.subtitle + " · " + item.folder;
  return (
    '<div class="p-row" role="button" tabindex="0" data-go="p-item" data-item="' +
    item.id +
    '">' +
    tile(item.type) +
    '<div class="p-row-main"><div class="p-row-name">' +
    esc(item.name) +
    (item.favorite ? ic("star-filled") : "") +
    "</div>" +
    '<div class="p-row-sub">' +
    esc(sub) +
    "</div></div>" +
    '<div class="p-row-end">' +
    (item.type === "login"
      ? '<button type="button" class="icon-btn sm" data-copy="' +
        esc(item.form.username) +
        '" data-copy-label="用户名" aria-label="复制用户名" title="复制用户名">' +
        ic("user") +
        "</button>"
      : "") +
    ic("angle-right") +
    "</div></div>"
  );
}

function vaultBody() {
  const items = filteredItems();
  if (!items.length) {
    return (
      emptyState({
        icon: "search",
        title: "没有匹配的条目",
        text: "换个关键词，或者清除当前的筛选条件。",
        actions:
          '<button type="button" class="btn btn-secondary" data-clear-filters>清除筛选</button>',
      }) || ""
    );
  }
  if (isFiltering()) {
    return (
      '<div class="p-group"><div class="p-group-head">搜索结果<span class="count">' +
      items.length +
      "</span></div>" +
      items.map(vaultRow).join("") +
      "</div>"
    );
  }
  const favorites = items.filter((item) => item.favorite);
  const rest = items;
  let html = "";
  if (favorites.length) {
    html +=
      '<div class="p-group"><div class="p-group-head">' +
      ic("star-filled") +
      "收藏</div>" +
      favorites.map(vaultRow).join("") +
      "</div>";
  }
  html +=
    '<div class="p-group"><div class="p-group-head">所有条目<span class="count">' +
    items.length +
    "</span></div>" +
    rest.map(vaultRow).join("") +
    "</div>";
  return html;
}

P["p-vault"] = function () {
  return pApp(
    pHeader({
      title: "保险库",
      sub: DATA.items.length + " 个条目 · 本机加密",
      actions:
        '<button type="button" class="icon-btn" data-go="p-unlock" aria-label="锁定保险库" title="锁定保险库">' +
        ic("lock") +
        "</button>" +
        '<button type="button" class="icon-btn brand" data-go="p-new-type" aria-label="新建条目" title="新建条目">' +
        ic("plus") +
        "</button>",
    }) +
      '<div class="p-toolbar">' +
      searchBar(false) +
      chipBar() +
      "</div>" +
      '<div class="p-content">' +
      vaultBody() +
      "</div>",
    { active: "p-vault" },
  );
};

P["p-vault-empty"] = function () {
  return pApp(
    pHeader({
      title: "保险库",
      sub: "还没有条目",
      actions:
        '<button type="button" class="icon-btn brand" data-go="p-new-type" aria-label="新建条目" title="新建条目">' +
        ic("plus") +
        "</button>",
    }) +
      '<div class="p-content">' +
      emptyState({
        icon: "vault",
        title: "保险库是空的",
        text: "先创建一条登录信息，或者导入已有的数据。全部内容只保存在这台电脑上。",
        actions:
          '<button type="button" class="btn btn-primary" data-go="p-new-type">' +
          ic("plus") +
          "新建条目</button>" +
          '<button type="button" class="btn btn-secondary" data-go="p-import">' +
          ic("import") +
          "导入数据</button>",
      }) +
      "</div>",
    { active: "p-vault" },
  );
};

P["p-unlock"] = function () {
  return pApp(
    '<div class="p-scroll">' +
      '<div class="p-hero">' +
      '<span class="p-hero-icon">' +
      logoMark("hero-logo") +
      "</span>" +
      "<h2>解锁保险库</h2>" +
      "<p>数据只在这台电脑上，用一个安全密码打开。</p>" +
      "</div>" +
      '<div class="p-form">' +
      '<div class="field"><label class="field-label" for="unlock-password">安全密码</label>' +
      '<div class="input-wrap"><input id="unlock-password" type="password" autocomplete="current-password" placeholder="输入安全密码" />' +
      '<button type="button" class="icon-btn sm" data-reveal-input="unlock-password" aria-label="显示密码">' +
      ic("visibility") +
      "</button></div></div>" +
      '<button type="button" class="btn btn-primary btn-lg btn-block" data-go="p-vault" data-toast="保险库已解锁">解锁</button>' +
      '<button type="button" class="btn btn-ghost" data-go="p-security-key">' +
      ic("key") +
      "用安全密钥解锁</button>" +
      "</div>" +
      '<div class="footnote-row"><button type="button" class="p-link" data-go="p-restore">忘记密码？从备份恢复</button></div>' +
      '<p class="p-footnote">没有「找回密码」。忘了安全密码就打不开保险库 —— 请务必做备份。</p>' +
      "</div>",
    { nav: false },
  );
};

P["p-unlock-wait"] = function () {
  return pApp(
    '<div class="p-scroll">' +
      '<div class="p-hero">' +
      '<span class="p-hero-icon">' +
      ic("lock") +
      "</span>" +
      "<h2>请稍后再试</h2>" +
      "<p>连续输错 5 次，已进入等待。你的数据没有被删除，也不会登出。</p>" +
      "</div>" +
      '<div class="p-form">' +
      '<div class="callout warning">' +
      ic("warning") +
      "<span>还需要等待 <b>28 秒</b>。等待结束后可以直接重试。</span></div>" +
      '<div class="field"><label class="field-label" for="unlock-wait">安全密码</label>' +
      '<div class="input-wrap"><input id="unlock-wait" type="password" disabled placeholder="等待中…" /></div></div>' +
      '<button type="button" class="btn btn-primary btn-lg btn-block" disabled>解锁</button>' +
      "</div>" +
      '<p class="p-footnote">忘了密码？用 <button type="button" class="p-link" data-go="p-restore">加密备份</button> 恢复。</p>' +
      "</div>",
    { nav: false },
  );
};

P["p-setup"] = function () {
  return pApp(
    '<div class="p-scroll">' +
      '<div class="p-hero">' +
      '<span class="p-hero-icon">' +
      logoMark("hero-logo") +
      "</span>" +
      "<h2>创建本机保险库</h2>" +
      "<p>没有账号，没有注册。安全密码只用来在这台电脑上解密数据。</p>" +
      "</div>" +
      '<div class="p-form">' +
      '<div class="field"><label class="field-label" for="setup-email">邮箱（可选，仅用于备份提示）</label>' +
      '<div class="input-wrap"><input id="setup-email" type="email" value="bossxie@xie.dev" /></div>' +
      '<div class="field-hint">不会上传，也不会用于登录。</div></div>' +
      '<div class="field"><label class="field-label" for="setup-pass">安全密码</label>' +
      '<div class="input-wrap"><input id="setup-pass" type="password" placeholder="至少 12 个字符" />' +
      '<button type="button" class="icon-btn sm" data-reveal-input="setup-pass" aria-label="显示密码">' +
      ic("visibility") +
      "</button></div></div>" +
      '<div class="field"><label class="field-label" for="setup-pass2">再输一次</label>' +
      '<div class="input-wrap"><input id="setup-pass2" type="password" /></div></div>' +
      '<label class="check-row"><input type="checkbox" checked /> 我知道忘记密码无法找回，会定期做加密备份</label>' +
      '<button type="button" class="btn btn-primary btn-lg btn-block" data-go="p-vault-empty" data-toast="保险库已创建">创建保险库</button>' +
      '<button type="button" class="btn btn-secondary btn-block" data-go="p-restore">从备份恢复</button>' +
      "</div>" +
      '<p class="p-footnote">指纹解锁只在 macOS 桌面端的「设置 → 安全」里开启，扩展本身没有这个能力。</p>' +
      "</div>",
    { nav: false },
  );
};

P["p-security-key"] = function () {
  return pApp(
    pHeader({
      title: "安全密钥",
      sub: "WebAuthn PRF · 仅本机验证",
      back: "p-unlock",
    }) +
      '<div class="p-content">' +
      emptyState({
        icon: "key",
        title: "插入安全密钥",
        text: "把已登记的安全密钥插进电脑，按一下按钮完成验证。密钥只用于解开本机保险库。",
        actions:
          '<button type="button" class="btn btn-primary" data-go="p-vault" data-toast="安全密钥验证通过">开始验证</button>',
      }) +
      '<div class="detail-section"><div class="detail-section-title">已登记</div>' +
      '<div class="detail-card"><div class="detail-row static"><span class="detail-label">密钥</span>' +
      '<span class="detail-value">YubiKey 5C NFC</span><span class="detail-end mini muted">2026-10-18</span></div></div></div>' +
      '<p class="p-footnote">安全密钥与安全密码是两条独立的解锁路径，任一条都能打开同一个保险库。</p>' +
      "</div>",
    { nav: false },
  );
};

P["p-item"] = function () {
  const item = selectedItem();
  return pApp(
    pHeader({
      title: item.name,
      sub: typeLabel(item.type) + " · " + item.folder,
      back: "p-vault",
      actions:
        '<button type="button" class="icon-btn" data-go="p-form" data-form-mode="edit" data-form-type="' +
        item.type +
        '" aria-label="编辑条目" title="编辑条目">' +
        ic("pencil-square") +
        "</button>" +
        '<button type="button" class="icon-btn" data-go="p-item-more" aria-label="更多操作" title="更多操作">' +
        ic("more-horizontal") +
        "</button>",
    }) +
      '<div class="p-content">' +
      detailHero(item, false) +
      detailSectionsHtml(item, false) +
      '<button type="button" class="btn btn-secondary btn-block" data-go="p-form" data-form-mode="edit" data-form-type="' +
      item.type +
      '" style="margin-top: 10px">' +
      ic("pencil-square") +
      "编辑项目</button>" +
      "</div>",
    { nav: false },
  );
};

P["p-item-more"] = function () {
  const item = selectedItem();
  return pApp(
    pHeader({
      title: item.name,
      sub: typeLabel(item.type) + " · " + item.folder,
      back: "p-vault",
      actions:
        '<button type="button" class="icon-btn" data-go="p-form" data-form-mode="edit" data-form-type="' +
        item.type +
        '" aria-label="编辑条目" title="编辑条目">' +
        ic("pencil-square") +
        "</button>",
    }) +
      '<div class="p-content">' +
      detailHero(item, false) +
      detailSectionsHtml(item, false) +
      "</div>" +
      '<div class="sheet-scrim open" data-go="p-item" aria-hidden="true"></div>' +
      '<div class="sheet open" role="dialog" aria-label="更多操作">' +
      '<div class="sheet-handle"></div><div class="sheet-title">' +
      esc(item.name) +
      '</div><div class="sheet-body">' +
      '<button type="button" class="sheet-item" data-go="p-form" data-form-mode="edit" data-form-type="' +
      item.type +
      '">' +
      ic("pencil-square") +
      "编辑</button>" +
      '<button type="button" class="sheet-item" data-go="p-item" data-toast="已克隆条目">' +
      ic("clone") +
      "克隆</button>" +
      '<button type="button" class="sheet-item" data-go="p-item" data-toast="已更新收藏状态">' +
      ic("star") +
      (item.favorite ? "取消收藏" : "收藏") +
      "</button>" +
      '<button type="button" class="sheet-item danger" data-go="p-vault" data-toast="已移到回收站">' +
      ic("trash") +
      "移到回收站</button>" +
      "</div></div>",
    { nav: false },
  );
};

P["p-new-type"] = function () {
  return pApp(
    pHeader({
      title: "新增项目",
      sub: "先选类型，字段会跟着类型变",
      back: "p-vault",
    }) +
      '<div class="p-content">' +
      '<div class="type-grid">' +
      TYPE_ORDER.map(
        (type) =>
          '<button type="button" class="type-card" data-go="p-form" data-form-type="' +
          type +
          '" data-form-mode="new">' +
          tile(type) +
          "<b>" +
          typeLabel(type) +
          "</b><span>" +
          TYPES[type].blurb +
          "</span></button>",
      ).join("") +
      "</div>" +
      '<div class="callout">' +
      ic("info") +
      "<span>先选类型，字段会跟着类型变；所有内容都在本地加密。</span>" +
      "</div></div>",
    { nav: false },
  );
};

P["p-form"] = function () {
  const editing = state.formMode === "edit";
  const item = editing ? selectedItem() : null;
  const type = editing ? item.type : state.formType;
  const title = editing ? "编辑项目" : "新增项目";
  return pApp(
    pHeader({
      title: title,
      sub: typeLabel(type),
      back: editing ? "p-item" : "p-new-type",
    }) +
      '<div class="p-content">' +
      formHtml(type, item, false) +
      "</div>" +
      pFooter(
        '<button type="button" class="btn btn-primary" data-go="' +
          (editing ? "p-item" : "p-vault") +
          '" data-toast="' +
          (editing ? "条目已保存" : "条目已创建") +
          '">保存</button>' +
          '<button type="button" class="btn btn-secondary" data-go="' +
          (editing ? "p-item" : "p-vault") +
          '">取消</button>',
      ),
    { nav: false },
  );
};

P["p-totp-qr"] = function () {
  const item = selectedItem();
  return pApp(
    pHeader({
      title: "动态口令二维码",
      sub: item.name,
      back: "p-item",
    }) +
      '<div class="p-content qr-screen">' +
      '<div class="qr-card">' +
      qrSvg() +
      "<p>用认证器扫描，添加到 LocalPass 之外的备份设备。</p>" +
      "</div>" +
      '<div class="detail-section"><div class="detail-section-title">手动输入</div>' +
      '<div class="detail-card"><div class="detail-row" role="button" tabindex="0" data-copy="JBSWY3DPEHPK3PXP" data-copy-label="验证码密钥">' +
      '<span class="detail-label">密钥</span><span class="detail-value mono">JBSWY3DPEHPK3PXP</span>' +
      '<span class="detail-end"><span class="detail-copy-hint">' +
      ic("copy") +
      "</span></span></div></div></div>" +
      '<p class="p-footnote">验证码每 30 秒变化。LocalPass 只在本机计算，不需要联网。</p>' +
      "</div>",
    { nav: false },
  );
};

P["p-generator"] = function () {
  return pApp(
    pHeader({
      title: "生成器",
      sub: "密码只在本机生成",
      actions:
        '<button type="button" class="icon-btn" data-go="p-generator-history" aria-label="生成历史" title="生成历史">' +
        ic("clock") +
        "</button>",
    }) +
      '<div class="p-content">' +
      genTabs() +
      '<div class="gen-value" data-gen-value>' +
      esc(state.genValue) +
      '<button type="button" class="icon-btn sm gen-refresh" data-gen-refresh aria-label="重新生成" title="重新生成">' +
      ic("refresh") +
      "</button></div>" +
      '<div class="gen-actions"><button type="button" class="btn btn-primary" data-gen-copy>' +
      ic("copy") +
      "复制</button>" +
      '<button type="button" class="btn btn-secondary" data-gen-refresh>' +
      ic("refresh") +
      "重新生成</button></div>" +
      genOptions() +
      '<div class="gen-strength"><span class="gen-strength-bar"><i></i></span><span>很强 · 约 104 位熵</span></div>' +
      '<p class="gen-note">密码从未离开本机。复制后 30 秒自动清空剪贴板，可在设置里修改。</p>' +
      "</div>",
    { active: "p-generator" },
  );
};

P["p-generator-history"] = function () {
  const history = GEN_HISTORY;
  return pApp(
    pHeader({
      title: "生成历史",
      sub: "只保留在本机，不会上传",
      back: "p-generator",
    }) +
      '<div class="p-content"><div class="p-list-card">' +
      history
        .map(
          (row) =>
            '<div class="gen-history-row"><span class="val mono">' +
            esc(row.value) +
            '</span><span class="time">' +
            esc(row.time) +
            '</span><button type="button" class="icon-btn sm" data-copy="' +
            esc(row.value) +
            '" data-copy-label="历史密码" aria-label="复制" title="复制">' +
            ic("copy") +
            "</button></div>",
        )
        .join("") +
      '</div><p class="p-footnote">生成历史不会同步，也不会写进日志。</p></div>',
    { nav: false },
  );
};

function genTabs() {
  const tabs = [
    { id: "password", label: "密码" },
    { id: "passphrase", label: "短语" },
    { id: "username", label: "用户名" },
  ];
  return (
    '<div class="gen-tabs" role="tablist">' +
    tabs
      .map(
        (tab) =>
          '<button type="button" class="gen-tab" role="tab" data-gen-mode="' +
          tab.id +
          '" aria-selected="' +
          (state.genMode === tab.id) +
          '">' +
          tab.label +
          "</button>",
      )
      .join("") +
    "</div>"
  );
}

function genOptions() {
  if (state.genMode === "username") {
    return (
      '<div class="gen-options"><div class="gen-option"><span>包含随机数字</span>' +
      '<button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="包含随机数字"></button></div>' +
      '<div class="gen-option"><span>使用连字符</span>' +
      '<button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="使用连字符"></button></div></div>'
    );
  }
  if (state.genMode === "passphrase") {
    return (
      '<div class="gen-options">' +
      '<div class="gen-range"><div class="range-head"><span>单词数量</span><span>' +
      state.genWords +
      '</span></div><input type="range" min="3" max="8" value="' +
      state.genWords +
      '" data-gen-words /></div>' +
      '<div class="gen-option"><span>首字母大写</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="首字母大写"></button></div>' +
      '<div class="gen-option"><span>包含数字</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="包含数字"></button></div>' +
      "</div>"
    );
  }
  return (
    '<div class="gen-options">' +
    '<div class="gen-range"><div class="range-head"><span>长度</span><span data-gen-length>' +
    state.genLength +
    '</span></div><input type="range" min="8" max="64" value="' +
    state.genLength +
    '" data-gen-length-input /></div>' +
    '<div class="gen-option"><span>大写字母</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="大写字母"></button></div>' +
    '<div class="gen-option"><span>小写字母</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="小写字母"></button></div>' +
    '<div class="gen-option"><span>数字</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="数字"></button></div>' +
    '<div class="gen-option"><span>符号</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="符号"></button></div>' +
    '<div class="gen-option"><span>排除易混淆字符</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="排除易混淆字符"></button></div>' +
    "</div>"
  );
}

P["p-settings"] = function () {
  return pApp(
    pHeader({
      title: "设置",
      sub: "本机保险库 · 完全离线",
      actions:
        '<button type="button" class="icon-btn" data-go="p-unlock" aria-label="锁定保险库" title="锁定保险库">' +
        ic("lock") +
        "</button>",
    }) +
      '<div class="p-content">' +
      settingsGroup("账户", [
        ["shield", "安全设置", "主密码、自动锁定、PIN", "p-settings-security"],
        ["key", "安全密钥", "1 个已登记", "p-security-key"],
      ]) +
      settingsGroup("保险库", [
        ["folder", "我的文件夹", DATA.folders.length + " 个", "p-folders"],
        ["trash", "回收站", DATA.trash.length + " 个条目", "p-trash"],
        ["import", "导入", "从备份或其它管理器导入", "p-import"],
        ["download", "导出", "加密 JSON", "p-export"],
      ]) +
      settingsGroup("工具", [
        ["generate", "生成器", "密码与短语", "p-generator"],
        ["palette", "外观", state.theme === "dark" ? "深色" : "浅色", "p-appearance"],
      ]) +
      settingsGroup("备份与隐私", [
        ["download", "云备份", "手动同步到你自己拥有的存储", "p-backup"],
        ["globe", "网络闸门", "拦截未授权的出站请求", "p-network"],
        ["lock", "数据与安全", "本机位置、清空保险库", "p-data"],
        ["info-circle", "关于 LocalPass", "版本 2026.11.1", "p-about"],
      ]) +
      '<p class="p-footnote">LocalPass 没有账号、没有服务器。删除扩展前请先导出或备份。</p>' +
      "</div>",
    { active: "p-settings" },
  );
};

function settingsGroup(title, rows) {
  return (
    '<div class="p-group"><div class="p-group-head">' +
    esc(title) +
    '</div><div class="p-list-card">' +
    rows
      .map(
        (row) =>
          '<button type="button" class="p-list-row" data-go="' +
          row[3] +
          '"><span class="p-list-icon">' +
          ic(row[0]) +
          '</span><span class="p-list-main"><b>' +
          esc(row[1]) +
          "</b><span>" +
          esc(row[2]) +
          '</span></span><i class="bwi bwi-angle-right chev" aria-hidden="true"></i></button>',
      )
      .join("") +
    "</div></div>"
  );
}

P["p-settings-security"] = function () {
  return pApp(
    pHeader({
      title: "安全设置",
      back: "p-settings",
      sub: "解锁与自动锁定",
    }) +
      '<div class="p-content">' +
      '<div class="p-group"><div class="p-list-card">' +
      settingRow("shield", "安全密码", "上次修改 3 天前") +
      settingRow("clock", "自动锁定", "15 分钟") +
      settingSwitchRow("pin", "PIN 解锁", "用 6 位 PIN 快速解锁") +
      settingSwitchRow("finger", "指纹解锁", "仅 macOS 桌面端可用", true) +
      "</div></div>" +
      '<div class="p-group"><div class="p-list-card">' +
      settingRow("key", "安全密钥", "1 个 · YubiKey 5C") +
      settingRow("download", "加密备份", "手动，永不自动上传") +
      "</div></div>" +
      '<div class="p-group"><div class="p-list-card">' +
      '<button type="button" class="p-list-row" data-go="p-unlock"><span class="p-list-icon">' +
      ic("lock") +
      '</span><span class="p-list-main"><b>立即锁定保险库</b><span>不会删除任何数据</span></span>' +
      '<i class="bwi bwi-angle-right chev" aria-hidden="true"></i></button></div></div>' +
      '<p class="p-footnote">扩展端没有生物识别接口；指纹只在 macOS 桌面端的设置里出现。</p>' +
      "</div>",
    { nav: false },
  );
};

function settingRow(icon, label, value) {
  return (
    '<button type="button" class="p-list-row"><span class="p-list-icon">' +
    ic(icon) +
    '</span><span class="p-list-main"><b>' +
    esc(label) +
    "</b><span>" +
    esc(value) +
    '</span></span><i class="bwi bwi-angle-right chev" aria-hidden="true"></i></button>'
  );
}

function settingSwitchRow(icon, label, sub, disabled) {
  return (
    '<div class="p-list-row' +
    (disabled ? " is-disabled" : "") +
    '"><span class="p-list-icon">' +
    ic(icon) +
    '</span><span class="p-list-main"><b>' +
    esc(label) +
    "</b><span>" +
    esc(sub) +
    '</span></span><button type="button" class="switch" role="switch" data-toggle aria-checked="false" aria-label="' +
    esc(label) +
    '"' +
    (disabled ? " disabled" : "") +
    "></button></div>"
  );
}

P["p-appearance"] = function () {
  return pApp(
    pHeader({ title: "外观", back: "p-settings", sub: "主题与语言" }) +
      '<div class="p-content">' +
      '<div class="theme-options">' +
      themeCard("light", "浅色", "始终使用浅色界面") +
      themeCard("dark", "深色", "适合夜间与低光环境") +
      themeCard("system", "跟随系统", "随 macOS 外观自动切换") +
      "</div>" +
      '<div class="p-group"><div class="p-list-card">' +
      settingRow("globe", "语言", "简体中文") +
      "</div></div>" +
      '<p class="p-footnote">主题只影响界面显示，不改变加密或存储方式。</p>' +
      "</div>",
    { nav: false },
  );
};

function themeCard(value, title, sub) {
  const active = state.theme === value;
  return (
    '<button type="button" class="theme-card" data-set-theme="' +
    value +
    '" aria-pressed="' +
    active +
    '">' +
    '<span class="theme-swatch ' +
    value +
    '"></span>' +
    "<b>" +
    esc(title) +
    "</b><span>" +
    esc(sub) +
    "</span>" +
    (active ? '<i class="bwi bwi-check theme-check" aria-hidden="true"></i>' : "") +
    "</button>"
  );
}

P["p-folders"] = function () {
  return pApp(
    pHeader({
      title: "我的文件夹",
      sub: DATA.folders.length + " 个",
      back: "p-settings",
      actions:
        '<button type="button" class="icon-btn brand" data-go="p-folders" data-toast="新建文件夹" aria-label="新建文件夹" title="新建文件夹">' +
        ic("plus") +
        "</button>",
    }) +
      '<div class="p-content"><div class="p-list-card">' +
      DATA.folders
        .map(
          (folder) =>
            '<button type="button" class="p-list-row" data-go="p-vault"><span class="p-list-icon">' +
            ic("folder") +
            '</span><span class="p-list-main"><b>' +
            esc(folder.name) +
            "</b><span>" +
            countFolder(folder.name) +
            ' 个条目</span></span><i class="bwi bwi-angle-right chev" aria-hidden="true"></i></button>',
        )
        .join("") +
      "</div>" +
      '<p class="p-footnote">文件夹只是本地的组织方式，不参与加密，也不会上传到任何地方。</p></div>',
    { nav: false },
  );
};

P["p-trash"] = function () {
  return pApp(
    pHeader({
      title: "回收站",
      sub: "保留 30 天 · 只在本地",
      back: "p-settings",
      actions:
        '<button type="button" class="icon-btn danger" data-go="p-trash" data-toast="回收站已清空" aria-label="清空回收站" title="清空回收站">' +
        ic("trash") +
        "</button>",
    }) +
      '<div class="p-content">' +
      '<div class="p-list-card">' +
      DATA.trash
        .map(
          (item) =>
            '<div class="p-list-row">' +
            tile(item.type, "sm") +
            '<span class="p-list-main"><b>' +
            esc(item.name) +
            "</b><span>" +
            esc(item.deleted) +
            "</span></span>" +
            '<button type="button" class="icon-btn sm" data-go="p-trash" data-toast="条目已恢复" aria-label="恢复" title="恢复">' +
            ic("undo") +
            "</button>" +
            '<button type="button" class="icon-btn sm danger" data-go="p-trash" data-toast="已永久删除" aria-label="永久删除" title="永久删除">' +
            ic("trash") +
            "</button></div>",
        )
        .join("") +
      "</div>" +
      '<p class="p-footnote">清空回收站后无法恢复；云备份里可能仍有旧的加密快照。</p>' +
      "</div>",
    { nav: false },
  );
};

P["p-import"] = function () {
  return pApp(
    pHeader({ title: "导入", sub: "从文件导入到本机", back: "p-settings" }) +
      '<div class="p-content">' +
      '<div class="import-source">' +
      '<button type="button" class="import-card" data-go="p-import-preview">' +
      tile("note", "sm") +
      "<span><b>LocalPass 加密备份</b><span>.json · 需要安全密码</span></span>" +
      ic("angle-right") +
      "</button>" +
      '<button type="button" class="import-card" data-go="p-import-preview">' +
      tile("login", "sm") +
      "<span><b>Bitwarden 加密导出</b><span>兼容格式 · .json</span></span>" +
      ic("angle-right") +
      "</button>" +
      '<button type="button" class="import-card" data-go="p-import-preview">' +
      tile("token", "sm") +
      "<span><b>Google 认证器</b><span>扫描二维码或 otpauth-migration</span></span>" +
      ic("angle-right") +
      "</button>" +
      "</div>" +
      '<div class="drop-zone">' +
      ic("upload") +
      "<b>把文件拖到这里</b><span>或点击选择文件</span></div>" +
      '<p class="p-footnote">导入前会先预览，确认后才写入；不会覆盖现有条目。</p>' +
      "</div>",
    { nav: false },
  );
};

P["p-import-preview"] = function () {
  return pApp(
    pHeader({ title: "导入预览", sub: "确认后再写入", back: "p-import" }) +
      '<div class="p-content">' +
      '<div class="stat-row">' +
      '<div class="stat"><b>12</b><span>将导入</span></div>' +
      '<div class="stat"><b>2</b><span>重复跳过</span></div>' +
      '<div class="stat"><b>0</b><span>无法识别</span></div>' +
      "</div>" +
      '<div class="detail-section"><div class="detail-section-title">预览</div><div class="p-list-card">' +
      [
        ["GitHub", "登录 · bossxie", "login"],
        ["Proton Mail", "登录 · bossxie@proton.me", "login"],
        ["Cloudflare API", "令牌 · 生产", "token"],
        ["招商银行 储蓄卡", "卡片 · •••• 8891", "card"],
      ]
        .map(
          (row) =>
            '<div class="p-list-row">' +
            tile(row[2], "sm") +
            '<span class="p-list-main"><b>' +
            esc(row[0]) +
            "</b><span>" +
            esc(row[1]) +
            "</span></span></div>",
        )
        .join("") +
      "</div></div>" +
      '<div class="callout">' +
      ic("info") +
      "<span>导入的内容会加密后写入本机保险库。导入不会触发任何网络请求。</span></div>" +
      "</div>" +
      pFooter(
        '<button type="button" class="btn btn-primary" data-go="p-vault" data-toast="已导入 12 个条目">导入 12 个条目</button>' +
          '<button type="button" class="btn btn-secondary" data-go="p-import">取消</button>',
      ),
    { nav: false },
  );
};

P["p-export"] = function () {
  return pApp(
    pHeader({ title: "导出", sub: "生成加密 JSON", back: "p-settings" }) +
      '<div class="p-content"><div class="form-stack">' +
      '<div class="callout warning">' +
      ic("warning") +
      "<span>导出文件包含全部条目，但仍然是加密的。请把它放在安全的位置，不要通过聊天工具传输。</span></div>" +
      '<div class="field"><label class="field-label" for="export-pass">安全密码</label>' +
      '<div class="input-wrap"><input id="export-pass" type="password" placeholder="确认是你本人" /></div>' +
      '<div class="field-hint">忘记密码的用户无法恢复数据；请用备份挽救。</div></div>' +
      '<div class="field"><label class="field-label" for="export-format">格式</label>' +
      '<select class="input" id="export-format"><option>加密 JSON（LocalPass 兼容）</option><option>明文 JSON（不推荐）</option></select></div>' +
      '<button type="button" class="btn btn-primary btn-lg btn-block" data-go="p-settings" data-toast="加密导出已生成">导出</button>' +
      '<div class="stat-row">' +
      '<div class="stat"><b>' +
      DATA.items.length +
      "</b><span>条目</span></div>" +
      '<div class="stat"><b>' +
      DATA.folders.length +
      "</b><span>文件夹</span></div>" +
      '<div class="stat"><b>' +
      DATA.trash.length +
      "</b><span>回收站</span></div>" +
      "</div>" +
      '<p class="p-footnote">回收站中的条目也会一并写入加密导出。</p>' +
      "</div></div>",
    { nav: false },
  );
};

P["p-backup"] = function () {
  return pApp(
    pHeader({
      title: "云备份",
      sub: "手动同步 · 只上传密文",
      back: "p-settings",
      actions:
        '<button type="button" class="icon-btn" data-go="p-backup-config" aria-label="存储配置" title="存储配置">' +
        ic("settings") +
        "</button>",
    }) +
      '<div class="p-content">' +
      '<div class="backup-status"><span class="backup-dot"></span><div><b>已连接 · Cloudflare R2</b><span>上次同步：今天 14:02</span></div></div>' +
      '<div class="stat-row">' +
      '<div class="stat"><b>3</b><span>快照</span></div>' +
      '<div class="stat"><b>18.4 KB</b><span>最新大小</span></div>' +
      '<div class="stat"><b>手动</b><span>同步方式</span></div>' +
      "</div>" +
      '<div class="gen-actions" style="padding-top: 4px">' +
      '<button type="button" class="btn btn-primary" data-go="p-backup" data-toast="同步完成 · 已上传密文">立即同步</button>' +
      '<button type="button" class="btn btn-secondary" data-go="p-backup" data-toast="已生成新的加密备份">立即备份</button>' +
      "</div>" +
      '<div class="detail-section"><div class="detail-section-title">最近快照</div><div class="p-list-card">' +
      DATA.snapshots
        .map(
          (snap) =>
            '<div class="p-list-row"><span class="p-list-icon">' +
            ic("download") +
            '</span><span class="p-list-main"><b>' +
            esc(snap.label) +
            (snap.current ? ' <span class="badge success">最新</span>' : "") +
            "</b><span>" +
            esc(snap.size) +
            "</span></span></div>",
        )
        .join("") +
      "</div></div>" +
      '<p class="p-footnote">只有点「立即同步」时才会联网。收进托盘、后台运行都不会自动上传。</p>' +
      "</div>",
    { nav: false },
  );
};

P["p-backup-config"] = function () {
  return pApp(
    pHeader({ title: "存储配置", sub: "S3 兼容 · 你自己拥有", back: "p-backup" }) +
      '<div class="p-content"><div class="form-stack">' +
      '<div class="field"><label class="field-label" for="r2-endpoint">Endpoint</label>' +
      '<div class="input-wrap"><input id="r2-endpoint" class="mono" value="https://demo.r2.cloudflarestorage.com" /></div></div>' +
      '<div class="field"><label class="field-label" for="r2-bucket">Bucket</label>' +
      '<div class="input-wrap"><input id="r2-bucket" class="mono" value="localpassword" /></div></div>' +
      '<div class="field"><label class="field-label" for="r2-key">Access Key</label>' +
      '<div class="input-wrap"><input id="r2-key" class="mono" value="demo-access-key" /></div></div>' +
      '<div class="field"><label class="field-label" for="r2-secret">Secret Key</label>' +
      '<div class="input-wrap"><input id="r2-secret" type="password" value="demo-secret-key" /></div></div>' +
      '<div class="field"><label class="field-label" for="r2-prefix">前缀</label>' +
      '<div class="input-wrap"><input id="r2-prefix" class="mono" value="vault/" /></div></div>' +
      '<div class="callout">' +
      ic("info") +
      "<span>上传内容是加密后的快照；存储服务商无法解读。凭据只保存在本机。</span></div>" +
      "</div></div>" +
      pFooter(
        '<button type="button" class="btn btn-primary" data-go="p-backup" data-toast="存储配置已保存">保存</button>' +
          '<button type="button" class="btn btn-secondary" data-go="p-backup" data-toast="连接成功">测试连接</button>',
      ),
    { nav: false },
  );
};

P["p-restore"] = function () {
  return pApp(
    pHeader({ title: "从备份恢复", sub: "失败不会改动现有数据", back: "p-unlock" }) +
      '<div class="p-content"><div class="form-stack">' +
      '<div class="callout warning">' +
      ic("warning") +
      "<span>恢复会用快照覆盖本机保险库。先把当前数据导出，或确认最新快照就是你要的版本。</span></div>" +
      '<div class="field"><label class="field-label" for="restore-pass">安全密码</label>' +
      '<div class="input-wrap"><input id="restore-pass" type="password" /></div></div>' +
      '<div class="detail-section"><div class="detail-section-title">选择快照</div><div class="p-list-card">' +
      DATA.snapshots
        .map(
          (snap, index) =>
            '<label class="p-list-row"><input type="radio" name="snapshot" ' +
            (index === 0 ? "checked" : "") +
            '/><span class="p-list-main"><b>' +
            esc(snap.label) +
            "</b><span>" +
            esc(snap.size) +
            "</span></span></label>",
        )
        .join("") +
      "</div></div>" +
      '<button type="button" class="btn btn-primary btn-lg btn-block" data-go="p-vault" data-toast="恢复完成">开始恢复</button>' +
      '<p class="p-footnote">恢复前会校验快照与安全密码；任何一步失败都不会改动现有数据。</p>' +
      "</div></div>",
    { nav: false },
  );
};

P["p-network"] = function () {
  return pApp(
    pHeader({ title: "网络闸门", sub: "默认拦截所有出站请求", back: "p-settings" }) +
      '<div class="p-content">' +
      '<div class="callout">' +
      ic("shield") +
      "<span>除了下面白名单里的地址和你主动发起的操作，扩展会拦截其余出站请求。可以用开发者工具的网络面板验证。</span></div>" +
      '<div class="p-group"><div class="p-group-head">白名单</div><div class="p-list-card">' +
      '<div class="p-list-row"><span class="p-list-icon">' +
      ic("download") +
      '</span><span class="p-list-main"><b>Cloudflare R2</b><span>demo.r2.cloudflarestorage.com · 仅手动同步</span></span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="允许 R2"></button></div>' +
      '<div class="p-list-row"><span class="p-list-icon">' +
      ic("search") +
      '</span><span class="p-list-main"><b>泄露查询</b><span>默认关闭，需要手动开启</span></span><button type="button" class="switch" role="switch" data-toggle aria-checked="false" aria-label="允许泄露查询"></button></div>' +
      "</div></div>" +
      '<div class="p-group"><div class="p-group-head">最近拦截</div><div class="p-list-card">' +
      ["sentry.io · 错误上报", "google-analytics.com · 遥测", "cdn.jsdelivr.net · 字体"]
        .map(
          (row) =>
            '<div class="p-list-row"><span class="p-list-icon">' +
            ic("globe") +
            '</span><span class="p-list-main"><b>' +
            esc(row) +
            "</b><span>已阻止</span></span></div>",
        )
        .join("") +
      "</div></div></div>",
    { nav: false },
  );
};

P["p-data"] = function () {
  return pApp(
    pHeader({ title: "数据与安全", sub: "本机存储", back: "p-settings" }) +
      '<div class="p-content">' +
      '<div class="p-group"><div class="p-list-card">' +
      settingRow("folder", "数据位置", "~/Library/Application Support/LocalPass") +
      settingRow("shield", "加密方式", "AES-256-GCM · 本机密钥") +
      settingRow("download", "最近备份", "今天 14:02") +
      "</div></div>" +
      '<div class="p-group"><div class="p-list-card">' +
      '<button type="button" class="p-list-row" data-go="p-export"><span class="p-list-icon">' +
      ic("download") +
      '</span><span class="p-list-main"><b>导出加密备份</b><span>先导出，再清空</span></span><i class="bwi bwi-angle-right chev" aria-hidden="true"></i></button>' +
      "</div></div>" +
      '<div class="danger-zone"><b>危险操作</b><p>清空保险库会删除本机全部条目，无法撤销。云备份里的旧快照不会被删除。</p>' +
      '<button type="button" class="btn btn-danger btn-block" data-go="p-settings" data-toast="需要二次确认">清空保险库</button></div>' +
      "</div>",
    { nav: false },
  );
};

P["p-about"] = function () {
  return pApp(
    pHeader({ title: "关于", back: "p-settings", sub: "LocalPass" }) +
      '<div class="p-content">' +
      '<div class="about-card">' +
      logoMark("about-logo") +
      "<b>LocalPass</b><span>版本 2026.11.1</span><p>完全离线的密码管理器。数据只存在你自己的电脑上，没有账号，也没有服务器。</p></div>" +
      '<div class="p-group"><div class="p-list-card">' +
      settingRow("shield", "隐私", "不上传任何明文") +
      settingRow("file-text", "许可证", "GPL v3.0") +
      settingRow("info-circle", "开源地址", "github.com/xieboss778/LocalPass") +
      "</div></div>" +
      "</div>",
    { nav: false },
  );
};

/* ========================================================================== */
/* 网页内联（1160×760）                                                        */
/* ========================================================================== */

const W = {};

function inlineAccount(id) {
  return INLINE.accounts.find((account) => account.id === id) || INLINE.accounts[0];
}

function inlineMatches(account, query) {
  const value = query.trim().toLowerCase();
  if (!value) {
    return true;
  }
  return (account.username + " " + account.label).toLowerCase().includes(value);
}

function inlineFilteredAccounts(mode) {
  const query = mode === "totp" ? "" : state.inline.query;
  return INLINE.accounts.filter((account) => {
    if (mode === "passkey" && !account.passkey) {
      return false;
    }
    if (mode === "password" && !account.password) {
      return false;
    }
    if (mode === "totp" && !account.totpSecret) {
      return false;
    }
    return inlineMatches(account, query);
  });
}

function inlineLastUsed(account) {
  return account.lastUsed === "刚刚" ? '<span class="inline-pill">上次使用</span>' : "";
}

function inlineAvatar(account, method) {
  return (
    '<span class="inline-avatar tone-' +
    account.tone +
    '" aria-hidden="true">' +
    esc(account.username.charAt(0).toUpperCase()) +
    (method === "passkey" ? '<span class="inline-avatar-badge">' + ic("passkey") + "</span>" : "") +
    "</span>"
  );
}

function inlineAccountRow(account, method, active) {
  const action = method === "passkey" ? "验证" : "填充";
  const attr = method === "passkey" ? "data-inline-passkey" : "data-inline-password";
  const aria =
    method === "passkey"
      ? "使用 " + account.username + " 的通行密钥登录"
      : "填充 " + account.username + " 的密码";
  const methodText =
    method === "passkey" ? "通行密钥" : "密码" + (account.totpSecret ? " + 验证码" : "");
  return (
    '<button type="button" class="inline-row' +
    (active ? " is-active" : "") +
    '" ' +
    attr +
    '="' +
    account.id +
    '" aria-label="' +
    esc(aria) +
    '">' +
    inlineAvatar(account, method) +
    '<span class="inline-row-main"><span class="inline-row-title">' +
    esc(account.username) +
    inlineLastUsed(account) +
    '</span><span class="inline-row-sub">' +
    esc(account.label + " · " + methodText) +
    "</span></span>" +
    '<span class="inline-row-action">' +
    action +
    "</span></button>"
  );
}

function inlineGroup(title, count, rows) {
  return (
    '<div class="inline-group">' +
    '<div class="inline-group-head"><span>' +
    esc(title) +
    "</span><span>" +
    count +
    "</span></div>" +
    rows.join("") +
    "</div>"
  );
}

function inlineMenuHeader(count, context, clearVisible) {
  return (
    '<div class="inline-head">' +
    '<span class="inline-brand-mark">' +
    logoMark("inline-logo") +
    "</span>" +
    '<span class="inline-head-main"><b>LocalPass</b><span>' +
    esc(INLINE.domain) +
    "</span></span>" +
    '<span class="inline-count">' +
    count +
    "</span>" +
    '<button type="button" class="icon-btn sm inline-close" data-inline-close aria-label="关闭自动填充菜单" title="关闭自动填充菜单">' +
    ic("close") +
    "</button></div>" +
    '<div class="inline-context"><span>' +
    context +
    "</span>" +
    (clearVisible
      ? '<button type="button" class="inline-context-action" data-inline-clear>显示全部</button>'
      : "") +
    "</div>"
  );
}

function inlineFooter(hint) {
  return (
    '<div class="inline-foot"><button type="button" class="inline-add" data-inline-new>' +
    ic("plus") +
    "<span>新建登录条目</span></button>" +
    '<span class="inline-keys">' +
    esc(hint) +
    "</span></div>"
  );
}

function inlineEmpty(query) {
  return (
    '<div class="inline-empty">' +
    ic("search") +
    "<b>没有匹配的账户</b><span>“" +
    esc(query) +
    "” 在这个域名下没有匹配项。</span>" +
    '<button type="button" class="inline-context-action" data-inline-clear>显示全部 ' +
    INLINE.accounts.length +
    " 个账户</button></div>"
  );
}

function inlineCollapsedChip(title, detail) {
  return (
    '<button type="button" class="inline-chip" data-inline-open aria-label="展开 LocalPass 自动填充菜单">' +
    '<span class="inline-chip-mark">' +
    logoMark("inline-logo") +
    "</span>" +
    '<span class="inline-chip-main"><b>' +
    esc(title) +
    "</b><span>" +
    esc(detail) +
    '</span></span><span class="inline-chip-action">展开</span></button>'
  );
}

function inlineLoginMenu() {
  const query = state.inline.query.trim();
  const matches = INLINE.accounts.filter((account) => inlineMatches(account, query));
  const passkeys = matches.filter((account) => account.passkey);
  const passwords = matches.filter((account) => account.password);
  const activePasskeyId = passkeys[0] ? passkeys[0].id : null;
  const activePasswordId = !passkeys.length && passwords[0] ? passwords[0].id : null;
  let body = "";
  if (!matches.length) {
    body = inlineEmpty(query);
  } else {
    if (passkeys.length) {
      body += inlineGroup(
        "通行密钥",
        passkeys.length,
        passkeys.map((account) =>
          inlineAccountRow(account, "passkey", account.id === activePasskeyId),
        ),
      );
    }
    if (passwords.length) {
      body += inlineGroup(
        "密码",
        passwords.length,
        passwords.map((account) =>
          inlineAccountRow(account, "password", account.id === activePasswordId),
        ),
      );
    }
  }
  const context = query
    ? "匹配 “" + esc(query) + "” · " + matches.length + " / " + INLINE.accounts.length
    : "同一域名 · 按最近使用排序";
  return (
    '<div class="inline-pop" role="dialog" aria-label="LocalPass 登录建议">' +
    inlineMenuHeader(matches.length + " 个账户", context, !!query && matches.length > 0) +
    '<div class="inline-body">' +
    body +
    "</div>" +
    inlineFooter("↑↓ 选择 · Enter 填充") +
    "</div>"
  );
}

function inlinePasskeyMenu() {
  const accounts = inlineFilteredAccounts("passkey");
  const body = accounts.length
    ? inlineGroup(
        "通行密钥",
        accounts.length,
        accounts.map((account, index) => inlineAccountRow(account, "passkey", index === 0)),
      )
    : inlineEmpty(state.inline.query);
  return (
    '<div class="inline-pop" role="dialog" aria-label="LocalPass 通行密钥">' +
    inlineMenuHeader(accounts.length + " 个可用", "网站正在请求通行密钥 · 由系统完成验证", false) +
    '<div class="inline-body">' +
    body +
    "</div>" +
    '<div class="inline-foot inline-foot-note"><span>' +
    ic("shield") +
    '通行密钥不会离开本机</span><span class="inline-keys">Esc 取消</span></div>' +
    "</div>"
  );
}

function inlinePasskeyVerifying(account) {
  return (
    '<div class="inline-pop inline-verify-pop" role="dialog" aria-label="通行密钥验证中" aria-live="polite">' +
    '<div class="inline-head"><span class="inline-brand-mark">' +
    logoMark("inline-logo") +
    '</span><span class="inline-head-main"><b>LocalPass</b><span>' +
    esc(INLINE.domain) +
    '</span></span><span class="inline-count">验证中</span></div>' +
    '<div class="inline-verify">' +
    '<span class="inline-spinner" aria-hidden="true"></span>' +
    "<b>正在验证 " +
    esc(account.username) +
    " 的通行密钥</b>" +
    "<p>请在系统提示中使用 Touch ID、Windows Hello 或安全密钥完成验证。</p>" +
    '<span class="inline-verify-meta">' +
    esc(INLINE.domain) +
    " · WebAuthn</span>" +
    '<button type="button" class="inline-cancel" data-inline-passkey-cancel>取消</button>' +
    "</div></div>"
  );
}

function inlineTotpRow(account, active) {
  const totp = totpForSecret(account.totpSecret);
  const percent = (totp.remaining / 30) * 100;
  const current = state.inline.totpAccount === account.id;
  return (
    '<button type="button" class="inline-totp-row' +
    (active ? " is-active" : "") +
    '" data-inline-totp="' +
    account.id +
    '" aria-label="填入并复制 ' +
    esc(account.username) +
    ' 的验证码">' +
    '<span class="inline-ring' +
    (totp.remaining <= 7 ? " is-ending" : "") +
    '" data-inline-ring data-secret="' +
    account.totpSecret +
    '" style="--p:' +
    percent.toFixed(1) +
    '%"><span data-inline-count data-secret="' +
    account.totpSecret +
    '">' +
    totp.remaining +
    "</span></span>" +
    '<span class="inline-totp-main"><span class="inline-totp-code" data-totp data-secret="' +
    account.totpSecret +
    '">' +
    esc(totp.code) +
    '</span><span class="inline-row-sub">' +
    esc(account.username + (current ? " · 当前账户" : " · " + account.label)) +
    "</span></span>" +
    '<span class="inline-row-action">填入</span></button>'
  );
}

function inlineTotpMenu() {
  const accounts = inlineFilteredAccounts("totp");
  const activeId = accounts.some((account) => account.id === state.inline.totpAccount)
    ? state.inline.totpAccount
    : accounts[0]
      ? accounts[0].id
      : null;
  const current = inlineAccount(state.inline.totpAccount || "github");
  const body = accounts.length
    ? inlineGroup(
        "验证码",
        accounts.length,
        accounts.map((account) => inlineTotpRow(account, account.id === activeId)),
      )
    : inlineEmpty(state.inline.query);
  return (
    '<div class="inline-pop" role="dialog" aria-label="LocalPass 验证码建议">' +
    inlineMenuHeader(
      accounts.length + " 个账户",
      "当前账户 " + esc(current.username) + " 优先 · 选中后自动填入并复制",
      false,
    ) +
    '<div class="inline-body">' +
    body +
    "</div>" +
    '<div class="inline-foot"><span class="inline-foot-note">' +
    ic("clock") +
    '验证码每 30 秒更新</span><span class="inline-keys">↑↓ 选择 · Enter 填入</span></div>' +
    "</div>"
  );
}

function inlineTotpFilledCard(account) {
  const totp = totpForSecret(account.totpSecret);
  return (
    '<div class="inline-filled-card" role="status" aria-live="polite">' +
    '<div class="inline-filled-main"><span class="inline-check">' +
    ic("check") +
    '</span><span class="inline-filled-text"><b>已填入 ' +
    esc(account.username) +
    " 的验证码</b><span>自动填充 · 已复制到剪贴板</span></span>" +
    '<button type="button" class="icon-btn sm" data-inline-totp-copy aria-label="复制验证码" title="复制验证码">' +
    ic("copy") +
    "</button></div>" +
    '<div class="inline-filled-meta"><span class="inline-code"><span data-totp data-secret="' +
    account.totpSecret +
    '">' +
    esc(totp.code) +
    '</span></span><span class="inline-remaining">剩余 <b data-inline-count data-secret="' +
    account.totpSecret +
    '">' +
    totp.remaining +
    '</b> 秒</span><button type="button" class="inline-context-action" data-inline-switch>切换账户</button></div></div>'
  );
}

function webChrome(tab, url) {
  return (
    '<div class="web-chrome">' +
    '<span class="web-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
    '<span class="web-tab"><span class="web-favicon">G</span><span class="web-tab-title">' +
    esc(tab) +
    '</span><span class="web-tab-close" aria-hidden="true">×</span></span>' +
    '<span class="web-address"><span class="web-lock">' +
    ic("lock") +
    "</span><span>" +
    esc(url) +
    '</span></span><span class="web-ext" title="LocalPass · ' +
    INLINE.accounts.length +
    ' 个账户">' +
    logoMark("web-ext-logo") +
    '<span class="web-ext-badge">' +
    INLINE.accounts.length +
    "</span></span></div>"
  );
}

function webSiteHeader() {
  return (
    '<header class="site-nav"><span class="site-wordmark"><span class="site-mark">G</span>GitHub</span>' +
    '<nav class="site-links" aria-label="站点导航"><span>Product</span><span>Solutions</span><span>Open Source</span><span>Pricing</span></nav>' +
    '<span class="site-actions"><span class="site-search">Search or jump to…</span><span class="site-signin">Sign in</span></span></header>'
  );
}

function inlineLoginPage(menu, mode) {
  const filled = state.inline.filledAccount ? inlineAccount(state.inline.filledAccount) : null;
  const username = filled ? filled.username : state.inline.query;
  const passkeyMode = mode === "passkey";
  return (
    '<div class="login-layout">' +
    '<div class="login-wrap"><div class="login-card">' +
    '<div class="page-brand"><span class="site-mark dark">G</span><span>GitHub</span></div>' +
    "<h1>Sign in to GitHub</h1>" +
    '<div class="page-field"><label class="page-label" for="page-username">Username or email address</label>' +
    '<div class="page-input-wrap"><input id="page-username" class="page-input is-focused" data-inline-username value="' +
    esc(username) +
    '" placeholder="Username or email address" autocomplete="' +
    (passkeyMode ? "username webauthn" : "username") +
    '" aria-haspopup="dialog" /><span class="page-input-icon" aria-hidden="true">' +
    ic(passkeyMode ? "passkey" : "localpass-shield") +
    "</span></div>" +
    menu +
    "</div>" +
    '<div class="page-field"><label class="page-label" for="page-password">Password</label>' +
    '<div class="page-input-wrap"><input id="page-password" class="page-input" type="password" value="' +
    (filled ? "demo-password" : "") +
    '" placeholder="Password" autocomplete="current-password" /><span class="page-input-icon" aria-hidden="true">' +
    ic("key") +
    "</span></div></div>" +
    '<button type="button" class="page-submit">Sign in</button>' +
    '<div class="page-divider"><span>or</span></div>' +
    '<button type="button" class="page-passkey' +
    (passkeyMode ? " is-active" : "") +
    '" data-inline-passkey-page>' +
    ic("passkey") +
    "Sign in with a passkey</button>" +
    '<p class="page-create">New to GitHub? <a href="#" onclick="return false">Create an account</a></p>' +
    "</div></div>" +
    '<aside class="login-aside"><span class="aside-icon">' +
    ic("passkey") +
    "</span><h2>Passkeys are supported</h2><p>If LocalPass has a passkey saved for this domain, it appears inline while you sign in. You can still choose another account.</p>" +
    '<span class="aside-note">演示：同一域名 · 3 个账户</span></aside>' +
    "</div>"
  );
}

function inlineTotpPage(menu, code) {
  return (
    '<div class="login-layout">' +
    '<div class="login-wrap twofa-wrap"><div class="login-card twofa-card">' +
    '<div class="page-brand"><span class="site-mark dark">G</span><span>GitHub</span></div>' +
    "<h1>Two-factor authentication</h1>" +
    '<p class="page-lead">Enter the 6-digit code from your authenticator app.</p>' +
    '<div class="page-field"><label class="page-label" for="page-otp">Authentication code</label>' +
    '<div class="page-input-wrap"><input id="page-otp" class="page-input page-otp is-focused" value="' +
    esc(code || "") +
    '" placeholder="XXXXXX" inputmode="numeric" autocomplete="one-time-code" aria-haspopup="dialog" />' +
    '<span class="page-input-icon' +
    (code ? " is-check" : "") +
    '" aria-hidden="true">' +
    ic(code ? "check" : "localpass-shield") +
    "</span></div>" +
    menu +
    "</div>" +
    '<button type="button" class="page-submit">Verify</button>' +
    '<p class="page-create"><a href="#" onclick="return false">Use a different account</a></p>' +
    "</div></div>" +
    '<aside class="login-aside"><span class="aside-icon">' +
    ic("shield") +
    "</span><h2>Why two-factor?</h2><p>An extra code protects your account even if someone learns your password.</p>" +
    '<span class="aside-note">演示：验证码内联 · 自动填充</span></aside>' +
    "</div>"
  );
}

function webApp(tab, url, body) {
  return (
    '<div class="web-page">' +
    webChrome(tab, url) +
    webSiteHeader() +
    '<main class="site-body">' +
    body +
    "</main></div>"
  );
}

W["w-inline-login"] = function () {
  const filled = state.inline.filledAccount ? inlineAccount(state.inline.filledAccount) : null;
  const matches = INLINE.accounts.filter((account) => inlineMatches(account, state.inline.query));
  const menu = state.inline.closed
    ? inlineCollapsedChip(
        filled
          ? "已填充 " + filled.username
          : state.inline.query.trim()
            ? "LocalPass · " + matches.length + " 个匹配"
            : "LocalPass · " + INLINE.accounts.length + " 个账户",
        filled ? "点击更换账户或查看其他建议" : "点击展开登录建议",
      )
    : inlineLoginMenu();
  return webApp("Sign in to GitHub", "github.com/login", inlineLoginPage(menu, "login"));
};

W["w-inline-passkey"] = function () {
  const verifying = state.inline.passkeyAuth ? inlineAccount(state.inline.passkeyAuth) : null;
  const passkeyCount = INLINE.accounts.filter((account) => account.passkey).length;
  const menu = verifying
    ? inlinePasskeyVerifying(verifying)
    : state.inline.closed
      ? inlineCollapsedChip("通行密钥可用", passkeyCount + " 个账户 · 点击选择", "passkey")
      : inlinePasskeyMenu();
  return webApp("Sign in to GitHub", "github.com/login", inlineLoginPage(menu, "passkey"));
};

W["w-inline-totp"] = function () {
  const totpCount = INLINE.accounts.filter((account) => account.totpSecret).length;
  const menu = state.inline.closed
    ? inlineCollapsedChip("验证码可用", totpCount + " 个账户 · 点击选择", "clock")
    : inlineTotpMenu();
  return webApp(
    "Two-factor authentication",
    "github.com/sessions/two-factor",
    inlineTotpPage(menu, null),
  );
};

W["w-inline-totp-filled"] = function () {
  const account = inlineAccount(state.inline.totpAccount || "github");
  const totp = totpForSecret(account.totpSecret);
  return webApp(
    "Two-factor authentication",
    "github.com/sessions/two-factor",
    inlineTotpPage(inlineTotpFilledCard(account), totp.code),
  );
};

/* ========================================================================== */
/* 桌面端（1160×760）                                                          */
/* ========================================================================== */

const D = {};

function dNav(active) {
  const isActive = (id) => active === id || (active && active.indexOf(id) === 0);
  const navItem = (id, icon, label, badge) =>
    '<button type="button" class="d-nav-item" data-go="' +
    id +
    '"' +
    (isActive(id) ? ' aria-current="page"' : "") +
    ">" +
    ic(icon) +
    "<span>" +
    label +
    "</span>" +
    (badge ? '<span class="nav-badge">' + badge + "</span>" : "") +
    "</button>";
  return (
    '<nav class="d-nav" aria-label="主导航">' +
    '<div class="d-logo">' +
    logoMark("") +
    "<span>本机保险库</span></div>" +
    '<div class="d-nav-group"><div class="d-nav-label">保险库</div>' +
    navItem("d-vault", "vault", "保险库") +
    navItem("d-folders", "folder", "我的文件夹", DATA.folders.length) +
    navItem("d-trash", "trash", "回收站", DATA.trash.length) +
    "</div>" +
    '<div class="d-nav-group"><div class="d-nav-label">工具</div>' +
    navItem("d-generator", "generate", "生成器") +
    navItem("d-import", "import", "导入") +
    navItem("d-export", "download", "导出") +
    navItem("d-backup", "download", "云备份") +
    "</div>" +
    '<div class="d-nav-group"><div class="d-nav-label">管理</div>' +
    navItem("d-settings-security", "settings", "设置") +
    navItem("d-network", "globe", "网络闸门") +
    navItem("d-data", "lock", "数据与安全") +
    "</div>" +
    '<div class="d-nav-spacer"></div>' +
    '<div class="d-nav-account">' +
    '<span class="avatar">' +
    DATA.owner +
    '</span><span class="who"><b>本机保险库</b><span>已加密 · 已解锁</span></span>' +
    '<button type="button" class="icon-btn sm" data-go="d-unlock" aria-label="锁定保险库" title="锁定保险库">' +
    ic("lock") +
    "</button></div>" +
    "</nav>"
  );
}

function dApp(content, opts) {
  const options = opts || {};
  return (
    '<div class="d-app">' +
    dNav(options.active) +
    '<div class="d-main">' +
    content +
    (options.drawer || "") +
    (options.modal || "") +
    "</div></div>"
  );
}

function dPageHead(opts) {
  return (
    '<div class="d-page-head"><div><h1 class="d-page-title">' +
    esc(opts.title) +
    "</h1>" +
    (opts.sub ? '<div class="d-page-sub">' + esc(opts.sub) + "</div>" : "") +
    "</div>" +
    (opts.actions ? '<div class="d-page-actions">' + opts.actions + "</div>" : "") +
    "</div>"
  );
}

function dFolderGrid() {
  return (
    '<div class="d-folder-grid">' +
    DATA.folders
      .map(
        (folder) =>
          '<button type="button" class="d-folder-card" data-go="d-folders"><span class="icon-tile">' +
          ic("folder") +
          "</span><span><b>" +
          esc(folder.name) +
          "</b><span>" +
          countFolder(folder.name) +
          " 个条目</span></span></button>",
      )
      .join("") +
    "</div>"
  );
}

function dTableRow(item, selectedId) {
  return (
    '<div class="d-tr row" role="button" tabindex="0" data-go="d-item" data-item="' +
    item.id +
    '" aria-selected="' +
    (item.id === selectedId) +
    '">' +
    '<div class="d-cell d-check"><input type="checkbox" data-check aria-label="选择 ' +
    esc(item.name) +
    '" /></div>' +
    '<div class="d-cell d-name">' +
    tile(item.type) +
    '<span class="d-name-main"><b>' +
    esc(item.name) +
    (item.favorite ? ' <i class="bwi bwi-star-filled d-fav" aria-label="收藏"></i>' : "") +
    "</b><span>" +
    esc(item.subtitle) +
    "</span></span></div>" +
    '<div class="d-cell d-muted">' +
    esc(item.folder) +
    '</div><div class="d-cell d-muted">' +
    esc(item.updated) +
    '</div><div class="d-cell">' +
    (item.favorite ? '<i class="bwi bwi-star-filled d-fav" aria-hidden="true"></i>' : "") +
    '</div><div class="d-cell d-row-actions">' +
    '<button type="button" class="icon-btn sm" data-copy="' +
    esc(item.subtitle) +
    '" data-copy-label="' +
    esc(typeLabel(item.type)) +
    '" aria-label="复制识别信息" title="复制识别信息">' +
    ic("copy") +
    "</button>" +
    '<button type="button" class="icon-btn sm" data-go="d-item" data-item="' +
    item.id +
    '" aria-label="打开条目" title="打开条目">' +
    ic("more-horizontal") +
    "</button></div></div>"
  );
}

function dVaultPage(selectedId) {
  const items = filteredItems();
  const rows = items.length
    ? items.map((item) => dTableRow(item, selectedId)).join("")
    : '<div class="d-empty">' +
      emptyState({
        icon: "search",
        title: isFiltering() ? "没有匹配的条目" : "保险库是空的",
        text: isFiltering()
          ? "换个关键词，或者清除当前的筛选条件。"
          : "创建第一条登录信息，或者导入已有的数据。",
        actions: isFiltering()
          ? '<button type="button" class="btn btn-secondary" data-clear-filters>清除筛选</button>'
          : '<button type="button" class="btn btn-primary" data-go="d-new">' +
            ic("plus") +
            "新建条目</button>",
      }) +
      "</div>";
  return (
    '<div class="d-page">' +
    dPageHead({
      title: "保险库",
      sub: DATA.items.length + " 个条目 · 本机加密",
      actions:
        '<button type="button" class="btn btn-secondary" data-go="d-import">' +
        ic("import") +
        "导入</button>" +
        '<button type="button" class="btn btn-primary" data-go="d-new">' +
        ic("plus") +
        '新建条目<kbd class="kbd">⌘N</kbd></button>',
    }) +
    '<div class="d-toolbar">' +
    searchBar(true) +
    chipBar() +
    "</div>" +
    '<div class="d-content">' +
    (isFiltering() ? "" : dFolderGrid()) +
    '<div class="d-table-card">' +
    '<div class="d-table-toolbar"><span class="title">' +
    (isFiltering() ? "筛选结果" : "所有条目") +
    '</span><span class="count">' +
    items.length +
    " / " +
    DATA.items.length +
    '</span><span class="spacer"></span><button type="button" class="icon-btn sm" aria-label="排序" title="排序">' +
    ic("numbered-list") +
    "</button></div>" +
    '<div class="d-table" role="table">' +
    '<div class="d-tr head"><div class="d-cell d-check"><input type="checkbox" aria-label="全选" /></div>' +
    '<div class="d-cell">名称</div><div class="d-cell">文件夹</div><div class="d-cell">修改时间</div>' +
    '<div class="d-cell">收藏</div><div class="d-cell" style="text-align:right">选项</div></div>' +
    rows +
    "</div></div></div></div>"
  );
}

function dDrawerHead(title, sub, closeTo, actions) {
  return (
    '<div class="d-drawer-head"><h2>' +
    esc(title) +
    (sub ? '<span class="sub">' + esc(sub) + "</span>" : "") +
    "</h2>" +
    (actions || "") +
    '<button type="button" class="icon-btn" data-go="' +
    closeTo +
    '" aria-label="关闭" title="关闭">' +
    ic("close") +
    "</button></div>"
  );
}

function dItemDrawer(item) {
  return (
    '<aside class="d-drawer" aria-label="条目详情">' +
    dDrawerHead(
      item.name,
      typeLabel(item.type) + " · " + item.folder,
      "d-vault",
      '<button type="button" class="icon-btn" data-go="d-form" aria-label="编辑条目" title="编辑条目">' +
        ic("pencil-square") +
        "</button>",
    ) +
    '<div class="d-drawer-body">' +
    detailHero(item, true) +
    detailSectionsHtml(item, true) +
    "</div>" +
    '<div class="d-drawer-foot">' +
    '<button type="button" class="btn btn-primary" data-go="d-form">' +
    ic("pencil-square") +
    "编辑</button>" +
    '<button type="button" class="btn btn-secondary" data-go="d-vault">关闭</button>' +
    '<span class="spacer"></span>' +
    '<button type="button" class="icon-btn danger" data-go="d-item-delete" aria-label="删除条目" title="删除条目">' +
    ic("trash") +
    "</button></div></aside>"
  );
}

function dFormDrawer(type, editing) {
  const item = editing ? selectedItem() : null;
  const title = editing ? "编辑" + typeLabel(type) : "新建" + typeLabel(type);
  return (
    '<aside class="d-drawer" aria-label="' +
    esc(title) +
    '">' +
    dDrawerHead(title, editing ? item.name : typeSub(type), editing ? "d-item" : "d-new", "") +
    '<div class="d-drawer-body">' +
    formHtml(type, item, true) +
    "</div>" +
    '<div class="d-drawer-foot">' +
    '<button type="button" class="btn btn-primary" data-go="' +
    (editing ? "d-item" : "d-vault") +
    '" data-toast="' +
    (editing ? "条目已保存" : "条目已创建") +
    '">保存</button>' +
    '<button type="button" class="btn btn-secondary" data-go="' +
    (editing ? "d-item" : "d-vault") +
    '">取消</button>' +
    '<span class="spacer"></span></div></aside>'
  );
}

function dNewDrawer() {
  return (
    '<aside class="d-drawer" aria-label="新建条目">' +
    dDrawerHead("新建条目", "选择类型，然后填写字段", "d-vault", "") +
    '<div class="d-drawer-body">' +
    '<div class="type-grid">' +
    TYPE_ORDER.map(
      (type) =>
        '<button type="button" class="type-card" data-go="d-new-form" data-form-type="' +
        type +
        '">' +
        tile(type) +
        "<b>" +
        typeLabel(type) +
        "</b><span>" +
        TYPES[type].blurb +
        "</span></button>",
    ).join("") +
    "</div>" +
    '<div class="callout">' +
    ic("info") +
    "<span>类型只决定字段与展示，加密方式对所有类型一致。</span></div>" +
    "</div></aside>"
  );
}

function dDeleteModal(item) {
  return (
    '<div class="modal-scrim" role="dialog" aria-modal="true" aria-label="移到回收站">' +
    '<div class="modal"><div class="modal-head">删除条目？</div>' +
    '<div class="modal-body">「' +
    esc(item.name) +
    "」会被移到回收站，保留 30 天。云备份里的旧快照不会立刻变化。</div>" +
    '<div class="modal-foot">' +
    '<button type="button" class="btn btn-secondary" data-go="d-item">取消</button>' +
    '<button type="button" class="btn btn-danger" data-go="d-vault" data-toast="已移到回收站">移到回收站</button>' +
    "</div></div></div>"
  );
}

D["d-vault"] = function () {
  return dApp(dVaultPage(null), { active: "d-vault" });
};

D["d-vault-empty"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "保险库",
        sub: "还没有条目",
        actions:
          '<button type="button" class="btn btn-primary" data-go="d-new">' +
          ic("plus") +
          "新建条目</button>",
      }) +
      '<div class="d-content" style="display:grid;place-items:center">' +
      emptyState({
        icon: "vault",
        title: "保险库是空的",
        text: "先创建一条登录信息，或者导入已有的数据。全部内容只保存在这台电脑上。",
        actions:
          '<button type="button" class="btn btn-primary" data-go="d-new">' +
          ic("plus") +
          "新建条目</button>" +
          '<button type="button" class="btn btn-secondary" data-go="d-import">' +
          ic("import") +
          "导入数据</button>",
      }) +
      "</div></div>",
    { active: "d-vault" },
  );
};

D["d-item"] = function () {
  return dApp(dVaultPage(state.selectedId), {
    active: "d-vault",
    drawer: dItemDrawer(selectedItem()),
  });
};

D["d-form"] = function () {
  return dApp(dVaultPage(state.selectedId), {
    active: "d-vault",
    drawer: dFormDrawer(selectedItem().type, true),
  });
};

D["d-new"] = function () {
  return dApp(dVaultPage(null), { active: "d-vault", drawer: dNewDrawer() });
};

D["d-new-form"] = function () {
  return dApp(dVaultPage(null), {
    active: "d-vault",
    drawer: dFormDrawer(state.formType, false),
  });
};

D["d-item-delete"] = function () {
  return dApp(dVaultPage(state.selectedId), {
    active: "d-vault",
    drawer: dItemDrawer(selectedItem()),
    modal: dDeleteModal(selectedItem()),
  });
};

D["d-unlock"] = function () {
  return (
    '<div class="d-app d-app-lock">' +
    '<div class="d-lock">' +
    '<div class="d-lock-card">' +
    '<span class="d-lock-badge">' +
    logoMark("lock-logo") +
    "</span>" +
    "<h1>解锁保险库</h1>" +
    "<p>数据只在这台电脑上。输入安全密码继续。</p>" +
    '<div class="field"><label class="field-label" for="d-unlock-pass">安全密码</label>' +
    '<div class="input-wrap"><input id="d-unlock-pass" type="password" autocomplete="current-password" placeholder="输入安全密码" />' +
    '<button type="button" class="icon-btn sm" data-reveal-input="d-unlock-pass" aria-label="显示密码">' +
    ic("visibility") +
    "</button></div></div>" +
    '<button type="button" class="btn btn-primary btn-lg btn-block" data-go="d-vault" data-toast="保险库已解锁">解锁</button>' +
    '<div class="d-lock-links"><button type="button" class="p-link" data-go="d-security-key">用安全密钥解锁</button>' +
    '<button type="button" class="p-link" data-go="d-restore">从备份恢复</button></div>' +
    "</div>" +
    '<div class="d-lock-foot">完全离线 · 没有账号 · AES-256-GCM 加密</div>' +
    "</div></div>"
  );
};

D["d-security-key"] = function () {
  return (
    '<div class="d-app d-app-lock">' +
    '<div class="d-lock">' +
    '<div class="d-lock-card">' +
    '<span class="d-lock-badge">' +
    ic("key") +
    "</span>" +
    "<h1>用安全密钥解锁</h1>" +
    "<p>把已登记的安全密钥插进电脑，按一下按钮完成验证。密钥只用于解开本机保险库。</p>" +
    '<div class="callout" style="margin-bottom:16px">' +
    ic("shield") +
    "<span>已登记：YubiKey 5C NFC · 2026-10-18</span></div>" +
    '<button type="button" class="btn btn-primary btn-lg btn-block" data-go="d-vault" data-toast="安全密钥验证通过">开始验证</button>' +
    '<div class="d-lock-links"><button type="button" class="p-link" data-go="d-unlock">返回密码解锁</button>' +
    '<button type="button" class="p-link" data-go="d-restore">从备份恢复</button></div>' +
    "</div>" +
    '<div class="d-lock-foot">安全密钥与安全密码是两条独立的解锁路径</div>' +
    "</div></div>"
  );
};

D["d-setup"] = function () {
  return (
    '<div class="d-app d-app-lock">' +
    '<div class="d-lock">' +
    '<div class="d-lock-card">' +
    '<span class="d-lock-badge">' +
    logoMark("lock-logo") +
    "</span>" +
    "<h1>创建本机保险库</h1>" +
    "<p>没有账号，没有注册。安全密码只用来在这台电脑上解密数据。</p>" +
    '<div class="field"><label class="field-label" for="d-setup-email">邮箱（可选，仅用于备份提示）</label>' +
    '<div class="input-wrap"><input id="d-setup-email" type="email" value="bossxie@xie.dev" /></div></div>' +
    '<div class="field"><label class="field-label" for="d-setup-pass">安全密码</label>' +
    '<div class="input-wrap"><input id="d-setup-pass" type="password" placeholder="至少 12 个字符" />' +
    '<button type="button" class="icon-btn sm" data-reveal-input="d-setup-pass" aria-label="显示密码">' +
    ic("visibility") +
    "</button></div></div>" +
    '<div class="field"><label class="field-label" for="d-setup-pass2">再输一次</label>' +
    '<div class="input-wrap"><input id="d-setup-pass2" type="password" /></div></div>' +
    '<button type="button" class="btn btn-primary btn-lg btn-block" data-go="d-vault-empty" data-toast="保险库已创建">创建保险库</button>' +
    '<div class="d-lock-links"><button type="button" class="p-link" data-go="d-restore">从备份恢复</button></div>' +
    "</div>" +
    '<div class="d-lock-foot">Touch ID 只在 macOS 设置里开启 · 备份始终手动</div>' +
    "</div></div>"
  );
};

D["d-generator"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "生成器",
        sub: "密码只在本机生成，复制后不会上传",
        actions:
          '<button type="button" class="btn btn-secondary" data-go="d-generator-history">' +
          ic("clock") +
          "生成历史</button>",
      }) +
      '<div class="d-content"><div class="gen-desk">' +
      '<div class="gen-card">' +
      genTabs() +
      '<div class="gen-value" data-gen-value>' +
      esc(state.genValue) +
      '<button type="button" class="icon-btn sm gen-refresh" data-gen-refresh aria-label="重新生成" title="重新生成">' +
      ic("refresh") +
      "</button></div>" +
      '<div class="gen-actions"><button type="button" class="btn btn-primary" data-gen-copy>' +
      ic("copy") +
      "复制</button>" +
      '<button type="button" class="btn btn-secondary" data-gen-refresh>' +
      ic("refresh") +
      "重新生成</button></div>" +
      '<div class="gen-options" style="padding-top:12px">' +
      genPasswordOptionsDesk() +
      "</div>" +
      '<div class="gen-strength"><span class="gen-strength-bar"><i></i></span><span>很强 · 约 104 位熵</span></div></div>' +
      '<div class="gen-card"><h3>这次生成的规则</h3>' +
      '<div class="gen-option"><span>长度</span><span class="num">' +
      state.genLength +
      "</span></div>" +
      '<div class="gen-option"><span>字符集</span><span class="num">A-Z a-z 0-9 !@#$%</span></div>' +
      '<div class="gen-option"><span>排除易混淆</span><span class="num">0 O l 1</span></div>' +
      '<p class="panel-sub" style="margin-top:14px">生成器不联网、不记录。关闭窗口后历史仍在设置里，可手动清除。</p>' +
      "</div></div></div></div>",
    { active: "d-generator" },
  );
};

D["d-generator-history"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "生成历史",
        sub: "只在本机保留 · 从不联网",
        actions:
          '<button type="button" class="btn btn-secondary" data-go="d-generator">' +
          ic("angle-left") +
          "返回生成器</button>",
      }) +
      '<div class="d-content"><div class="d-table-card">' +
      '<div class="d-table-toolbar"><span class="title">最近生成</span><span class="count">' +
      GEN_HISTORY.length +
      ' 条</span><span class="spacer"></span>' +
      '<button type="button" class="btn btn-ghost" data-go="d-generator-history" data-toast="历史已清空">清空历史</button></div>' +
      '<div class="p-list-card" style="border:0;border-radius:0">' +
      GEN_HISTORY.map(
        (row) =>
          '<div class="p-list-row"><span class="p-list-icon">' +
          ic("clock") +
          '</span><span class="p-list-main"><b class="mono">' +
          esc(row.value) +
          "</b><span>" +
          esc(row.time) +
          '</span></span><button type="button" class="icon-btn sm" data-copy="' +
          esc(row.value) +
          '" data-copy-label="历史密码" aria-label="复制" title="复制">' +
          ic("copy") +
          "</button></div>",
      ).join("") +
      "</div></div></div></div>",
    { active: "d-generator" },
  );
};

function genPasswordOptionsDesk() {
  return (
    '<div class="gen-range"><div class="range-head"><span>密码长度</span><span data-gen-length>' +
    state.genLength +
    '</span></div><input type="range" min="8" max="64" value="' +
    state.genLength +
    '" data-gen-length-input /></div>' +
    '<div class="gen-option"><span>大写字母</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="大写字母"></button></div>' +
    '<div class="gen-option"><span>小写字母</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="小写字母"></button></div>' +
    '<div class="gen-option"><span>数字</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="数字"></button></div>' +
    '<div class="gen-option"><span>符号</span><button type="button" class="switch" role="switch" data-toggle aria-checked="true" aria-label="符号"></button></div>'
  );
}

D["d-settings-security"] = function () {
  return dApp(dSettingsPage("security"), { active: "d-settings-security" });
};
D["d-settings-vault"] = function () {
  return dApp(dSettingsPage("vault"), { active: "d-settings-security" });
};
D["d-settings-appearance"] = function () {
  return dApp(dSettingsPage("appearance"), { active: "d-settings-security" });
};
D["d-settings-backup"] = function () {
  return dApp(dSettingsPage("backup"), { active: "d-settings-security" });
};
D["d-settings-about"] = function () {
  return dApp(dSettingsPage("about"), { active: "d-settings-security" });
};

function dSettingsPage(tab) {
  const tabs = [
    { id: "security", icon: "shield", label: "安全" },
    { id: "vault", icon: "vault", label: "保险库" },
    { id: "appearance", icon: "palette", label: "外观" },
    { id: "backup", icon: "download", label: "备份" },
    { id: "about", icon: "info-circle", label: "关于" },
  ];
  return (
    '<div class="d-page">' +
    dPageHead({ title: "设置", sub: "本机保险库 · 完全离线" }) +
    '<div class="d-settings">' +
    '<div class="d-settings-nav">' +
    tabs
      .map(
        (item) =>
          '<button type="button" data-go="d-settings-' +
          item.id +
          '"' +
          (tab === item.id ? ' aria-current="page"' : "") +
          ">" +
          ic(item.icon) +
          "<span>" +
          item.label +
          "</span></button>",
      )
      .join("") +
    "</div>" +
    '<div class="d-settings-body">' +
    dSettingsBody(tab) +
    "</div></div></div>"
  );
}

function dSettingsBody(tab) {
  if (tab === "vault") {
    return (
      '<div class="d-settings-group-title">保险库</div><div class="d-card">' +
      dCardRow("我的文件夹", DATA.folders.length + " 个文件夹", "管理", "d-folders") +
      dCardRow("回收站", DATA.trash.length + " 个条目 · 30 天", "打开", "d-trash") +
      dCardRow("导入", "从加密备份或其它管理器", "导入", "d-import") +
      dCardRow("导出", "加密 JSON，可迁移到任意兼容客户端", "导出", "d-export") +
      "</div>" +
      '<div class="d-settings-group-title">高级</div><div class="d-card">' +
      dCardRow("网络闸门", "默认拦截所有出站请求", "查看", "d-network") +
      dCardRow("数据与安全", "数据位置、清空保险库", "查看", "d-data") +
      "</div>"
    );
  }
  if (tab === "appearance") {
    return (
      '<div class="d-settings-group-title">主题</div>' +
      '<div class="theme-options">' +
      themeCard("light", "浅色", "始终使用浅色界面") +
      themeCard("dark", "深色", "适合夜间与低光环境") +
      themeCard("system", "跟随系统", "随 macOS 外观自动切换") +
      "</div>" +
      '<div class="d-settings-group-title">语言</div><div class="d-card">' +
      dCardRow("界面语言", "简体中文", "更改", "d-settings-appearance") +
      "</div>" +
      '<p class="d-settings-note">主题只影响显示，不改变加密或存储方式。</p>'
    );
  }
  if (tab === "backup") {
    return (
      '<div class="d-settings-group-title">云备份（手动）</div><div class="d-card">' +
      dCardRow("上次同步", "今天 14:02 · 3 份快照", "立即同步", "d-backup") +
      dCardRow("存储配置", "Cloudflare R2 · 只上传密文", "配置", "d-backup-config") +
      dCardRow("从备份恢复", "失败不会改动现有数据", "恢复", "d-restore") +
      "</div>" +
      '<div class="d-settings-group-title">本地备份</div><div class="d-card">' +
      dCardRow("加密导出", "手动生成，不会自动执行", "导出", "d-export") +
      "</div>" +
      '<p class="d-settings-note">有没有联网，只由你点的按钮决定。后台任务、托盘、自动更新都不会上传。</p>'
    );
  }
  if (tab === "about") {
    return (
      '<div class="about-card desk-about">' +
      logoMark("about-logo") +
      "<b>LocalPass</b><span>版本 2026.11.1</span>" +
      "<p>完全离线的密码管理器。数据只存在你自己的电脑上，没有账号，也没有服务器。</p></div>" +
      '<div class="d-card">' +
      dCardRow("隐私", "不上传任何明文", "", "") +
      dCardRow("许可证", "GPL v3.0", "", "") +
      dCardRow("开源地址", "github.com/xieboss778/LocalPass", "", "") +
      "</div>"
    );
  }
  return (
    '<div class="d-settings-group-title">解锁</div><div class="d-card">' +
    dCardRow("安全密码", "上次修改 3 天前", "更改", "d-settings-security") +
    dCardRow("自动锁定", "15 分钟无操作", "更改", "d-settings-security") +
    dCardRowSwitch("PIN 解锁", "用 6 位 PIN 快速解锁", false) +
    dCardRowSwitch("Touch ID 解锁", "仅 macOS · 触发系统指纹验证", true) +
    "</div>" +
    '<div class="d-settings-group-title">安全密钥</div><div class="d-card">' +
    dCardRow("安全密钥", "1 个 · YubiKey 5C NFC", "管理", "d-settings-security") +
    "</div>" +
    '<div class="d-settings-group-title">会话</div><div class="d-card">' +
    '<div class="d-card-row"><div class="main"><b>立即锁定保险库</b><span>不会删除任何数据</span></div>' +
    '<button type="button" class="btn btn-secondary" data-go="d-unlock">锁定</button></div>' +
    "</div>" +
    '<p class="d-settings-note">指纹入口只在 macOS 上出现；扩展端没有生物识别接口。</p>'
  );
}

function dCardRow(title, sub, endLabel, go) {
  return (
    '<div class="d-card-row"><div class="main"><b>' +
    esc(title) +
    "</b><span>" +
    esc(sub) +
    '</span></div><div class="end">' +
    (endLabel
      ? go
        ? '<button type="button" class="btn btn-ghost" data-go="' +
          go +
          '">' +
          esc(endLabel) +
          "</button>"
        : "<span>" + esc(endLabel) + "</span>"
      : "") +
    "</div></div>"
  );
}

function dCardRowSwitch(title, sub, checked) {
  return (
    '<div class="d-card-row"><div class="main"><b>' +
    esc(title) +
    "</b><span>" +
    esc(sub) +
    '</span></div><button type="button" class="switch" role="switch" data-toggle aria-checked="' +
    !!checked +
    '" aria-label="' +
    esc(title) +
    '"></button></div>'
  );
}

D["d-folders"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "我的文件夹",
        sub: DATA.folders.length + " 个文件夹",
        actions:
          '<button type="button" class="btn btn-primary" data-go="d-folders" data-toast="新建文件夹">' +
          ic("plus") +
          "新建文件夹</button>",
      }) +
      '<div class="d-content"><div class="d-table-card">' +
      '<div class="d-table-toolbar"><span class="title">文件夹</span><span class="count">' +
      DATA.folders.length +
      '</span></div><div class="d-table" role="table">' +
      '<div class="d-tr head" style="grid-template-columns:minmax(220px,1fr) 160px 84px"><div class="d-cell" style="padding-left:16px">名称</div><div class="d-cell">条目数</div><div class="d-cell" style="text-align:right">选项</div></div>' +
      DATA.folders
        .map(
          (folder) =>
            '<div class="d-tr row" role="button" tabindex="0" data-go="d-vault" style="grid-template-columns:minmax(220px,1fr) 160px 84px">' +
            '<div class="d-cell d-name" style="padding-left:16px"><span class="icon-tile">' +
            ic("folder") +
            '</span><span class="d-name-main"><b>' +
            esc(folder.name) +
            "</b><span>我的文件夹</span></span></div>" +
            '<div class="d-cell d-muted">' +
            countFolder(folder.name) +
            " 个条目</div>" +
            '<div class="d-cell d-row-actions"><button type="button" class="icon-btn sm" data-go="d-vault" aria-label="打开文件夹">' +
            ic("angle-right") +
            "</button></div></div>",
        )
        .join("") +
      '</div></div><p class="d-settings-note">文件夹只是本地组织方式，不参与加密。</p></div></div>',
    { active: "d-folders" },
  );
};

D["d-trash"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "回收站",
        sub: DATA.trash.length + " 个条目 · 保留 30 天",
        actions:
          '<button type="button" class="btn btn-secondary" data-go="d-trash" data-toast="回收站已清空">' +
          ic("trash") +
          "清空回收站</button>",
      }) +
      '<div class="d-content"><div class="d-table-card">' +
      '<div class="d-table-toolbar"><span class="title">已删除</span><span class="count">' +
      DATA.trash.length +
      '</span></div><div class="d-table" role="table">' +
      '<div class="d-tr head" style="grid-template-columns:minmax(220px,1fr) 180px 120px"><div class="d-cell" style="padding-left:16px">名称</div><div class="d-cell">删除时间</div><div class="d-cell" style="text-align:right">操作</div></div>' +
      DATA.trash
        .map(
          (item) =>
            '<div class="d-tr row" style="grid-template-columns:minmax(220px,1fr) 180px 120px;cursor:default">' +
            '<div class="d-cell d-name" style="padding-left:16px">' +
            tile(item.type) +
            '<span class="d-name-main"><b>' +
            esc(item.name) +
            "</b><span>" +
            esc(item.subtitle) +
            "</span></span></div>" +
            '<div class="d-cell d-muted">' +
            esc(item.deleted) +
            "</div>" +
            '<div class="d-cell d-row-actions" style="opacity:1">' +
            '<button type="button" class="btn btn-ghost" data-go="d-trash" data-toast="条目已恢复">恢复</button>' +
            '<button type="button" class="icon-btn sm danger" data-go="d-trash" data-toast="已永久删除" aria-label="永久删除">' +
            ic("trash") +
            "</button></div></div>",
        )
        .join("") +
      '</div></div><p class="d-settings-note">清空回收站后无法恢复；云备份里可能仍有旧的加密快照。</p></div></div>',
    { active: "d-trash" },
  );
};

D["d-import"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({ title: "导入", sub: "先预览，确认后才写入" }) +
      '<div class="d-content"><div class="two-col">' +
      '<div class="panel"><h3>选择来源</h3><p class="panel-sub">支持 LocalPass 加密备份、Bitwarden 加密导出、Google 认证器迁移。</p>' +
      '<div class="import-source">' +
      '<button type="button" class="import-card" data-go="d-import-preview">' +
      tile("note", "sm") +
      "<span><b>LocalPass 加密备份</b><span>.json · 需要安全密码</span></span>" +
      ic("angle-right") +
      "</button>" +
      '<button type="button" class="import-card" data-go="d-import-preview">' +
      tile("login", "sm") +
      "<span><b>Bitwarden 加密导出</b><span>兼容格式 · .json</span></span>" +
      ic("angle-right") +
      "</button>" +
      '<button type="button" class="import-card" data-go="d-import-preview">' +
      tile("token", "sm") +
      "<span><b>Google 认证器</b><span>二维码或 otpauth-migration</span></span>" +
      ic("angle-right") +
      "</button>" +
      "</div></div>" +
      '<div class="panel"><h3>文件</h3><p class="panel-sub">拖拽到这里，或选择文件。导入不会发出网络请求。</p>' +
      '<div class="drop-zone">' +
      ic("upload") +
      "<b>把文件拖到这里</b><span>或点击选择文件</span></div>" +
      '<p class="panel-sub" style="margin-top:14px">导入前会显示数量和重复项，确认后才写入本机保险库。</p>' +
      "</div></div></div></div>",
    { active: "d-import" },
  );
};

D["d-import-preview"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "导入预览",
        sub: "12 个将导入 · 2 个重复跳过",
        actions:
          '<button type="button" class="btn btn-secondary" data-go="d-import">取消</button>' +
          '<button type="button" class="btn btn-primary" data-go="d-vault" data-toast="已导入 12 个条目">导入 12 个条目</button>',
      }) +
      '<div class="d-content"><div class="two-col"><div class="panel">' +
      '<h3>将导入</h3><div class="p-list-card">' +
      [
        ["GitHub", "登录 · bossxie", "login"],
        ["Proton Mail", "登录 · bossxie@proton.me", "login"],
        ["Cloudflare API", "令牌 · 生产", "token"],
        ["招商银行 储蓄卡", "卡片 · •••• 8891", "card"],
        ["运维私钥 id_ed25519", "SSH 私钥", "ssh-key"],
      ]
        .map(
          (row) =>
            '<div class="p-list-row">' +
            tile(row[2], "sm") +
            '<span class="p-list-main"><b>' +
            esc(row[0]) +
            "</b><span>" +
            esc(row[1]) +
            "</span></span></div>",
        )
        .join("") +
      '</div><p class="panel-sub" style="margin-top:10px">仅展示前 5 个，共 12 个条目。</p></div>' +
      '<div class="panel"><h3>检查</h3><div class="d-card">' +
      dCardRow("重复条目", "2 个已存在，默认跳过", "", "") +
      dCardRow("无法识别", "0 个", "", "") +
      '</div><div class="callout" style="margin-top:14px">' +
      ic("info") +
      "<span>导入的内容会先加密再写入本机保险库，不会上传。</span></div></div></div></div></div>",
    { active: "d-import" },
  );
};

D["d-export"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({ title: "导出", sub: "生成加密 JSON" }) +
      '<div class="d-content"><div class="two-col">' +
      '<div class="panel"><h3>导出加密备份</h3><p class="panel-sub">导出文件仍是加密的，可以迁移到任意兼容客户端。</p>' +
      '<div class="form-stack"><div class="field"><label class="field-label" for="d-export-pass">安全密码</label>' +
      '<div class="input-wrap"><input id="d-export-pass" type="password" /></div></div>' +
      '<div class="field"><label class="field-label" for="d-export-format">格式</label>' +
      '<select class="input" id="d-export-format"><option>加密 JSON（LocalPass 兼容）</option><option>明文 JSON（不推荐）</option></select></div>' +
      '<button type="button" class="btn btn-primary" data-go="d-settings-vault" data-toast="加密导出已生成">导出</button></div></div>' +
      '<div class="panel"><h3>注意</h3><div class="callout warning">' +
      ic("warning") +
      "<span>导出文件包含全部条目。不要通过聊天工具传输；用完请删除。</span></div>" +
      '<p class="panel-sub" style="margin-top:14px">忘记安全密码无法恢复数据，请用备份挽救。</p></div>' +
      "</div></div></div>",
    { active: "d-export" },
  );
};

D["d-backup"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "云备份",
        sub: "手动同步 · 只上传密文",
        actions:
          '<button type="button" class="btn btn-secondary" data-go="d-backup-config">' +
          ic("settings") +
          "存储配置</button>" +
          '<button type="button" class="btn btn-primary" data-go="d-backup" data-toast="同步完成 · 已上传密文">' +
          ic("download") +
          "立即同步</button>",
      }) +
      '<div class="d-content"><div class="two-col">' +
      '<div class="panel"><h3>状态</h3><p class="panel-sub">上次同步：今天 14:02 · Cloudflare R2</p>' +
      '<div class="stat-row"><div class="stat"><b>3</b><span>快照</span></div><div class="stat"><b>18.4 KB</b><span>最新大小</span></div><div class="stat"><b>手动</b><span>同步方式</span></div></div>' +
      '<div class="gen-actions" style="padding-top:14px"><button type="button" class="btn btn-secondary" data-go="d-backup" data-toast="已生成新的加密备份">立即备份</button>' +
      '<button type="button" class="btn btn-secondary" data-go="d-restore">从备份恢复</button></div>' +
      '<p class="panel-sub" style="margin-top:14px">只有点按钮时才联网。收进托盘、后台运行都不会自动上传。</p></div>' +
      '<div class="panel"><h3>最近快照</h3><div class="p-list-card">' +
      DATA.snapshots
        .map(
          (snap) =>
            '<div class="p-list-row"><span class="p-list-icon">' +
            ic("download") +
            '</span><span class="p-list-main"><b>' +
            esc(snap.label) +
            (snap.current ? ' <span class="badge success">最新</span>' : "") +
            "</b><span>" +
            esc(snap.size) +
            "</span></span></div>",
        )
        .join("") +
      "</div></div></div></div></div>",
    { active: "d-backup" },
  );
};

D["d-backup-config"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "存储配置",
        sub: "S3 兼容 · 你自己拥有",
        actions:
          '<button type="button" class="btn btn-secondary" data-go="d-backup" data-toast="连接成功">测试连接</button>' +
          '<button type="button" class="btn btn-primary" data-go="d-backup" data-toast="存储配置已保存">保存</button>',
      }) +
      '<div class="d-content"><div class="two-col"><div class="panel"><h3>连接</h3>' +
      '<div class="form-stack">' +
      '<div class="field"><label class="field-label" for="d-r2-endpoint">Endpoint</label><div class="input-wrap"><input id="d-r2-endpoint" class="mono" value="https://demo.r2.cloudflarestorage.com" /></div></div>' +
      '<div class="field"><label class="field-label" for="d-r2-bucket">Bucket</label><div class="input-wrap"><input id="d-r2-bucket" class="mono" value="localpassword" /></div></div>' +
      '<div class="field"><label class="field-label" for="d-r2-key">Access Key</label><div class="input-wrap"><input id="d-r2-key" class="mono" value="demo-access-key" /></div></div>' +
      '<div class="field"><label class="field-label" for="d-r2-secret">Secret Key</label><div class="input-wrap"><input id="d-r2-secret" type="password" value="demo-secret-key" /></div></div>' +
      '<div class="field"><label class="field-label" for="d-r2-prefix">前缀</label><div class="input-wrap"><input id="d-r2-prefix" class="mono" value="vault/" /></div></div>' +
      "</div></div>" +
      '<div class="panel"><h3>说明</h3><div class="callout">' +
      ic("shield") +
      "<span>上传内容是加密后的快照，存储服务商无法解读。凭据只保存在本机，不会同步。</span></div>" +
      '<p class="panel-sub" style="margin-top:14px">推荐使用只允许读写该桶的独立密钥。</p></div></div></div></div>',
    { active: "d-backup" },
  );
};

D["d-restore"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({
        title: "从备份恢复",
        sub: "失败不会改动现有数据",
        actions:
          '<button type="button" class="btn btn-primary" data-go="d-vault" data-toast="恢复完成">开始恢复</button>',
      }) +
      '<div class="d-content"><div class="two-col">' +
      '<div class="panel"><h3>选择快照</h3><div class="p-list-card">' +
      DATA.snapshots
        .map(
          (snap, index) =>
            '<label class="p-list-row"><input type="radio" name="d-snapshot" ' +
            (index === 0 ? "checked" : "") +
            ' /><span class="p-list-main"><b>' +
            esc(snap.label) +
            "</b><span>" +
            esc(snap.size) +
            "</span></span></label>",
        )
        .join("") +
      "</div></div>" +
      '<div class="panel"><h3>确认</h3><div class="form-stack">' +
      '<div class="field"><label class="field-label" for="d-restore-pass">安全密码</label><div class="input-wrap"><input id="d-restore-pass" type="password" /></div></div>' +
      '<div class="callout warning">' +
      ic("warning") +
      "<span>恢复会用快照覆盖本机保险库。先把当前数据导出。</span></div>" +
      "</div></div></div></div></div>",
    { active: "d-backup" },
  );
};

D["d-network"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({ title: "网络闸门", sub: "默认拦截所有出站请求" }) +
      '<div class="d-content"><div class="callout">' +
      ic("shield") +
      "<span>除了白名单里的地址和你主动发起的操作，扩展会拦截其余出站请求。可以用开发者工具的网络面板验证。</span></div>" +
      '<div class="d-settings-group-title">白名单</div><div class="d-card">' +
      dCardRowSwitch("Cloudflare R2", "demo.r2.cloudflarestorage.com · 仅手动同步", true) +
      dCardRowSwitch("泄露查询", "默认关闭，需要手动开启", false) +
      "</div>" +
      '<div class="d-settings-group-title">最近拦截</div><div class="d-card">' +
      dCardRow("sentry.io", "错误上报 · 已阻止", "0 次", "") +
      dCardRow("google-analytics.com", "遥测 · 已阻止", "0 次", "") +
      dCardRow("cdn.jsdelivr.net", "字体 · 已阻止", "0 次", "") +
      "</div></div></div>",
    { active: "d-network" },
  );
};

D["d-data"] = function () {
  return dApp(
    '<div class="d-page">' +
      dPageHead({ title: "数据与安全", sub: "本机存储" }) +
      '<div class="d-content"><div class="two-col">' +
      '<div class="panel"><h3>本机位置</h3><div class="d-card">' +
      dCardRow("数据目录", "~/Library/Application Support/LocalPass", "", "") +
      dCardRow("加密", "AES-256-GCM · 本机密钥", "", "") +
      dCardRow("最近备份", "今天 14:02", "查看", "d-backup") +
      "</div></div>" +
      '<div class="panel"><h3>危险操作</h3><div class="callout warning">' +
      ic("warning") +
      "<span>清空保险库会删除本机全部条目，无法撤销。云备份里的旧快照不会被删除。</span></div>" +
      '<button type="button" class="btn btn-danger" style="margin-top:14px" data-go="d-data" data-toast="需要二次确认">清空保险库</button>' +
      "</div></div></div></div>",
    { active: "d-data" },
  );
};

/* ========================================================================== */
/* 二维码（原型里的假 QR）                                                      */
/* ========================================================================== */

function qrSvg() {
  const n = 25;
  const inFinder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const finderOn = (x, y) => {
    const fx = x < 7 ? x : x - (n - 7);
    const fy = y < 7 ? y : y - (n - 7);
    const border = fx === 0 || fx === 6 || fy === 0 || fy === 6;
    const core = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
    return border || core;
  };
  let rects = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const on = inFinder(x, y) ? finderOn(x, y) : (x * 7 + y * 11 + x * y * 3) % 13 < 6;
      if (on) {
        rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
      }
    }
  }
  return (
    '<svg class="qr" viewBox="0 0 ' +
    n +
    " " +
    n +
    '" role="img" aria-label="动态口令二维码">' +
    '<rect width="' +
    n +
    '" height="' +
    n +
    '" fill="#fff"/>' +
    '<g fill="#0f172b">' +
    rects +
    "</g></svg>"
  );
}

/* ========================================================================== */
/* 索引与导航                                                                  */
/* ========================================================================== */

const GROUPS = [
  {
    g: "解锁与首次使用",
    device: "popup",
    items: [
      { id: "p-unlock", label: "解锁" },
      { id: "p-unlock-wait", label: "输错等待（不登出）" },
      { id: "p-setup", label: "首次设置" },
      { id: "p-security-key", label: "安全密钥解锁" },
    ],
  },
  {
    g: "保险库",
    device: "popup",
    items: [
      { id: "p-vault", label: "列表（分组）" },
      { id: "p-vault-empty", label: "空状态" },
    ],
  },
  {
    g: "条目",
    device: "popup",
    items: [
      { id: "p-item", label: "详情 · 登录", item: "github" },
      { id: "p-item", label: "详情 · 卡片", item: "bank" },
      { id: "p-item", label: "详情 · 令牌", item: "cf" },
      { id: "p-item", label: "详情 · SSH 私钥", item: "ssh" },
      { id: "p-item", label: "详情 · 服务器", item: "jump" },
      { id: "p-item", label: "详情 · 许可证", item: "sublime" },
      { id: "p-item", label: "详情 · 身份", item: "idcard" },
      { id: "p-item", label: "详情 · 笔记", item: "codes" },
      { id: "p-item-more", label: "操作单（克隆 / 删除）", item: "github" },
      { id: "p-totp-qr", label: "动态口令二维码", item: "github" },
    ],
  },
  {
    g: "新建与编辑",
    device: "popup",
    items: [
      { id: "p-new-type", label: "类型选择（8 类）" },
      { id: "p-form", label: "登录表单", formType: "login" },
      { id: "p-form", label: "令牌表单", formType: "token" },
      { id: "p-form", label: "SSH 私钥表单", formType: "sshkey" },
      { id: "p-form", label: "许可证表单", formType: "license" },
      { id: "p-form", label: "卡片表单", formType: "card" },
      { id: "p-form", label: "身份表单", formType: "identity" },
      { id: "p-form", label: "服务器表单", formType: "server" },
      { id: "p-form", label: "笔记表单", formType: "note" },
    ],
  },
  {
    g: "工具",
    device: "popup",
    items: [
      { id: "p-generator", label: "生成器" },
      { id: "p-generator-history", label: "生成历史" },
    ],
  },
  {
    g: "设置与组织",
    device: "popup",
    items: [
      { id: "p-settings", label: "设置" },
      { id: "p-settings-security", label: "安全设置" },
      { id: "p-appearance", label: "外观" },
      { id: "p-folders", label: "文件夹" },
      { id: "p-trash", label: "回收站" },
      { id: "p-about", label: "关于" },
    ],
  },
  {
    g: "备份与数据",
    device: "popup",
    items: [
      { id: "p-backup", label: "云备份" },
      { id: "p-backup-config", label: "存储配置" },
      { id: "p-restore", label: "从备份恢复" },
      { id: "p-import", label: "导入" },
      { id: "p-import-preview", label: "导入预览" },
      { id: "p-export", label: "导出" },
      { id: "p-network", label: "网络闸门" },
      { id: "p-data", label: "数据与安全" },
    ],
  },
  {
    g: "网页内联",
    device: "inline",
    items: [
      { id: "w-inline-login", label: "登录 · 多账户 + 通行密钥" },
      { id: "w-inline-passkey", label: "通行密钥 · 选择 / 验证中" },
      { id: "w-inline-totp", label: "验证码 · 内联选择" },
      { id: "w-inline-totp-filled", label: "验证码 · 自动填充 / 切换账户" },
    ],
  },
  {
    g: "桌面端 · 解锁",
    device: "desktop",
    items: [
      { id: "d-unlock", label: "解锁" },
      { id: "d-security-key", label: "安全密钥解锁" },
      { id: "d-setup", label: "首次设置" },
    ],
  },
  {
    g: "桌面端 · 保险库",
    device: "desktop",
    items: [
      { id: "d-vault", label: "保险库（表格 + 文件夹）" },
      { id: "d-vault-empty", label: "空状态" },
      { id: "d-item", label: "详情抽屉 · 登录", item: "github" },
      { id: "d-item", label: "详情抽屉 · 卡片", item: "bank" },
      { id: "d-form", label: "编辑抽屉", item: "github" },
      { id: "d-new", label: "新建 · 选类型" },
      { id: "d-new-form", label: "新建 · 登录表单", formType: "login" },
      { id: "d-item-delete", label: "删除确认" },
      { id: "d-trash", label: "回收站" },
      { id: "d-folders", label: "文件夹" },
    ],
  },
  {
    g: "桌面端 · 工具",
    device: "desktop",
    items: [
      { id: "d-generator", label: "生成器" },
      { id: "d-generator-history", label: "生成历史" },
      { id: "d-import", label: "导入" },
      { id: "d-import-preview", label: "导入预览" },
      { id: "d-export", label: "导出" },
    ],
  },
  {
    g: "桌面端 · 备份",
    device: "desktop",
    items: [
      { id: "d-backup", label: "云备份" },
      { id: "d-backup-config", label: "存储配置" },
      { id: "d-restore", label: "从备份恢复" },
    ],
  },
  {
    g: "桌面端 · 设置",
    device: "desktop",
    items: [
      { id: "d-settings-security", label: "设置 · 安全" },
      { id: "d-settings-vault", label: "设置 · 保险库" },
      { id: "d-settings-appearance", label: "设置 · 外观" },
      { id: "d-settings-backup", label: "设置 · 备份" },
      { id: "d-settings-about", label: "设置 · 关于" },
      { id: "d-network", label: "网络闸门" },
      { id: "d-data", label: "数据与安全" },
    ],
  },
];

const FLOWS = [
  {
    name: "首次设置 → 建库",
    device: "popup",
    steps: [{ id: "p-setup" }, { id: "p-vault-empty" }, { id: "p-new-type" }],
  },
  {
    name: "解锁 → 看条目 → 复制",
    device: "popup",
    steps: [{ id: "p-unlock" }, { id: "p-vault" }, { id: "p-item", item: "github" }],
  },
  {
    name: "桌面端：列表 → 详情 → 编辑",
    device: "desktop",
    steps: [{ id: "d-vault" }, { id: "d-item", item: "github" }, { id: "d-form", item: "github" }],
  },
  {
    name: "生成密码",
    device: "popup",
    steps: [{ id: "p-generator" }, { id: "p-generator-history" }],
  },
  {
    name: "备份 → 恢复",
    device: "popup",
    steps: [{ id: "p-backup" }, { id: "p-backup-config" }, { id: "p-restore" }],
  },
];

function renderIndex() {
  const groups = GROUPS.filter((group) => group.device === state.device);
  const html = groups
    .map(
      (group) =>
        "<h4>" +
        esc(group.g) +
        "</h4>" +
        group.items
          .map((item) => {
            const active =
              item.id === state.screen &&
              (!item.item || item.item === state.selectedId) &&
              (!item.formType || item.formType === state.formType);
            return (
              '<button type="button" data-screen="' +
              item.id +
              '"' +
              (item.item ? ' data-item="' + item.item + '"' : "") +
              (item.formType ? ' data-form-type="' + item.formType + '"' : "") +
              (active ? ' aria-current="true"' : "") +
              ">" +
              esc(item.label) +
              "</button>"
            );
          })
          .join(""),
    )
    .join("");
  const flows =
    "<h4>关键流程</h4>" +
    FLOWS.map((flow, index) => {
      return (
        '<button type="button" class="flow-button" data-flow="' +
        index +
        '">▶ ' +
        esc(flow.name) +
        "</button>"
      );
    }).join("");
  document.getElementById("index").innerHTML = html + flows;
}

function renderFrame() {
  let body = "";
  let frame = "";
  if (state.device === "popup") {
    body = (P[state.screen] || P["p-unlock"])();
    frame = '<div class="popup">' + body + '<div class="toast" id="toast"></div></div>';
  } else if (state.device === "desktop") {
    body = (D[state.screen] || D["d-unlock"])();
    frame = '<div class="desk">' + body + '<div class="toast" id="toast"></div></div>';
  } else {
    body = (W[state.screen] || W["w-inline-login"])();
    frame = '<div class="web">' + body + '<div class="toast" id="toast"></div></div>';
  }
  document.getElementById("frame").innerHTML = frame;
  applyTheme();
  updateTotp();
  const url = new URL(location.href);
  url.searchParams.set("device", state.device);
  url.searchParams.set("screen", state.screen);
  if (state.selectedId) {
    url.searchParams.set("item", state.selectedId);
  }
  history.replaceState(null, "", url);
}

function render() {
  renderIndex();
  renderFrame();
  document.querySelectorAll(".devices button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.device === state.device));
  });
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(state.theme === "dark"));
    const label = toggle.querySelector("span");
    if (label) {
      label.textContent = state.theme === "dark" ? "浅色" : "深色";
    }
  }
}

function applyTheme() {
  document.querySelectorAll(".popup, .desk, .web").forEach((frame) => {
    frame.classList.toggle("theme-dark", state.theme === "dark");
  });
}

/* ========================================================================== */
/* 交互                                                                        */
/* ========================================================================== */

let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }
  toast.innerHTML = ic("check") + "<span>" + esc(message) + "</span>";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1700);
}

function copyText(value, label) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      const write = navigator.clipboard.writeText(value);
      if (write && typeof write.catch === "function") {
        write.catch(() => {});
      }
    }
  } catch (error) {
    /* 原型：剪贴板不可用时也照常给反馈 */
  }
  showToast((label || "内容") + " 已复制");
}

function randomPassword(length) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+";
  const all = upper + lower + digits + symbols;
  let value = "";
  for (let i = 0; i < length; i++) {
    value += all[Math.floor(Math.random() * all.length)];
  }
  return value;
}

function randomPassphrase(words) {
  const list = [
    "harbor",
    "cobalt",
    "meadow",
    "pixel",
    "tundra",
    "lantern",
    "ember",
    "quartz",
    "orbit",
    "willow",
  ];
  const parts = [];
  for (let i = 0; i < words; i++) {
    const word = list[Math.floor(Math.random() * list.length)];
    parts.push(word.charAt(0).toUpperCase() + word.slice(1));
  }
  return parts.join("-") + "-" + Math.floor(Math.random() * 90 + 10);
}

function regenerate() {
  if (state.genMode === "passphrase") {
    state.genValue = randomPassphrase(state.genWords);
  } else if (state.genMode === "username") {
    state.genValue = "quiet-" + randomPassphrase(2).toLowerCase();
  } else {
    state.genValue = randomPassword(state.genLength);
  }
  document.querySelectorAll("[data-gen-value]").forEach((element) => {
    const refresh = element.querySelector("[data-gen-refresh]");
    element.innerHTML = esc(state.genValue) + (refresh ? refresh.outerHTML : "");
  });
}

function totpForSecret(secret) {
  const step = 30;
  const seconds = Math.floor(Date.now() / 1000);
  const slot = Math.floor(seconds / step);
  const remaining = step - (seconds % step);
  const value = secret || "JBSWY3DPEHPK3PXP";
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  const code = String((hash + slot * 7919) % 1000000).padStart(6, "0");
  return {
    code: code.slice(0, 3) + " " + code.slice(3),
    raw: code,
    remaining: remaining,
    period: step,
  };
}

function currentTotp() {
  return totpForSecret("JBSWY3DPEHPK3PXP");
}

function updateTotp() {
  if (typeof document === "undefined") {
    return;
  }
  const fallback = currentTotp();
  document.querySelectorAll("[data-totp]").forEach((element) => {
    const totp = element.dataset.secret ? totpForSecret(element.dataset.secret) : fallback;
    element.textContent = totp.code;
    const row = element.closest("[data-copy]");
    if (row) {
      row.setAttribute("data-copy", totp.raw);
    }
  });
  document.querySelectorAll("[data-inline-count]").forEach((element) => {
    const totp = totpForSecret(element.dataset.secret || "JBSWY3DPEHPK3PXP");
    element.textContent = String(totp.remaining);
    const ring = element.closest("[data-inline-ring]");
    if (ring) {
      ring.style.setProperty("--p", ((totp.remaining / totp.period) * 100).toFixed(1) + "%");
      ring.classList.toggle("is-ending", totp.remaining <= 7);
    }
  });
  document.querySelectorAll("[data-totp-bar]").forEach((bar) => {
    const fill = bar.querySelector("i");
    if (fill) {
      fill.style.width = ((fallback.remaining / 30) * 100).toFixed(1) + "%";
    }
  });
}

function navigate(id) {
  if (!P[id] && !D[id] && !W[id]) {
    return;
  }
  state.screen = id;
  state.menu = null;
  if (W[id]) {
    resetInlineState();
  }
  render();
}

function backTarget() {
  const map = {
    "p-vault": "p-unlock",
    "p-item": "p-vault",
    "p-item-more": "p-item",
    "p-form": state.formMode === "edit" ? "p-item" : "p-new-type",
    "p-new-type": "p-vault",
    "p-generator-history": "p-generator",
    "p-settings-security": "p-settings",
    "p-appearance": "p-settings",
    "p-folders": "p-settings",
    "p-trash": "p-settings",
    "p-import": "p-settings",
    "p-import-preview": "p-import",
    "p-export": "p-settings",
    "p-backup": "p-settings",
    "p-backup-config": "p-backup",
    "p-restore": "p-unlock",
    "p-network": "p-settings",
    "p-data": "p-settings",
    "p-about": "p-settings",
    "p-totp-qr": "p-item",
    "p-security-key": "p-unlock",
    "d-item": "d-vault",
    "d-form": "d-item",
    "d-new": "d-vault",
    "d-new-form": "d-new",
    "d-item-delete": "d-item",
    "d-folders": "d-vault",
    "d-trash": "d-vault",
    "d-import": "d-vault",
    "d-import-preview": "d-import",
    "d-export": "d-vault",
    "d-backup": "d-vault",
    "d-backup-config": "d-backup",
    "d-restore": "d-backup",
    "d-settings-security": "d-vault",
    "d-settings-vault": "d-vault",
    "d-settings-appearance": "d-vault",
    "d-settings-backup": "d-vault",
    "d-settings-about": "d-vault",
    "d-network": "d-vault",
    "d-data": "d-vault",
  };
  return map[state.screen] || null;
}

function passkeyConfirmHtml() {
  return (
    '<div class="modal-scrim passkey-confirm" data-passkey-scrim role="dialog" aria-modal="true" aria-label="删除通行密钥">' +
    '<div class="modal">' +
    '<div class="modal-head">删除通行密钥</div>' +
    '<div class="modal-body">此通行密钥将从您的登录项目中永久删除，无法撤销！</div>' +
    '<div class="modal-foot">' +
    '<button type="button" class="btn btn-secondary" data-passkey-cancel>取消</button>' +
    '<button type="button" class="btn btn-danger" data-passkey-confirm>删除</button>' +
    "</div></div></div>"
  );
}

function applyCustomFieldType(row, hidden) {
  const input = row.querySelector("[data-custom-value]");
  const valueWrap = row.querySelector(".custom-value");
  if (!input || !valueWrap) {
    return;
  }
  input.type = hidden ? "password" : "text";
  input.classList.toggle("mono", hidden);
  const reveal = valueWrap.querySelector("[data-custom-reveal]");
  if (hidden && !reveal) {
    valueWrap.insertAdjacentHTML("beforeend", customRevealButton());
  } else if (!hidden && reveal) {
    reveal.remove();
  }
}

function onDocumentClick(event) {
  const target = event.target;

  const device = target.closest(".devices button");
  if (device) {
    state.device = device.dataset.device;
    state.screen =
      state.device === "popup"
        ? "p-vault"
        : state.device === "desktop"
          ? "d-vault"
          : "w-inline-login";
    state.menu = null;
    if (state.device === "inline") {
      resetInlineState();
    }
    render();
    return;
  }

  if (target.closest("#themeToggle")) {
    state.theme = state.theme === "dark" ? "light" : "dark";
    render();
    return;
  }

  const inlineClose = target.closest("[data-inline-close]");
  if (inlineClose) {
    state.inline.closed = true;
    render();
    return;
  }

  const inlineOpen = target.closest("[data-inline-open]");
  if (inlineOpen) {
    state.inline.closed = false;
    render();
    return;
  }

  const inlineClear = target.closest("[data-inline-clear]");
  if (inlineClear) {
    state.inline.query = "";
    state.inline.filledAccount = null;
    render();
    const input = document.querySelector("[data-inline-username]");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    return;
  }

  const inlinePasskeyPage = target.closest("[data-inline-passkey-page]");
  if (inlinePasskeyPage) {
    state.screen = "w-inline-passkey";
    state.inline.query = "";
    state.inline.closed = false;
    state.inline.passkeyAuth = null;
    render();
    return;
  }

  const inlinePasskey = target.closest("[data-inline-passkey]");
  if (inlinePasskey) {
    state.screen = "w-inline-passkey";
    state.inline.closed = false;
    state.inline.passkeyAuth = inlinePasskey.dataset.inlinePasskey;
    render();
    return;
  }

  const inlinePasskeyCancel = target.closest("[data-inline-passkey-cancel]");
  if (inlinePasskeyCancel) {
    state.inline.passkeyAuth = null;
    render();
    return;
  }

  const inlinePassword = target.closest("[data-inline-password]");
  if (inlinePassword) {
    state.inline.filledAccount = inlinePassword.dataset.inlinePassword;
    state.inline.closed = true;
    render();
    setTimeout(
      () =>
        showToast(
          "已填充 " +
            inlineAccount(inlinePassword.dataset.inlinePassword).username +
            " 的用户名和密码",
        ),
      60,
    );
    return;
  }

  const inlineTotp = target.closest("[data-inline-totp]");
  if (inlineTotp) {
    const account = inlineAccount(inlineTotp.dataset.inlineTotp);
    state.inline.totpAccount = account.id;
    state.inline.closed = false;
    state.screen = "w-inline-totp-filled";
    render();
    setTimeout(() => copyText(totpForSecret(account.totpSecret).raw, "验证码"), 60);
    return;
  }

  const inlineSwitch = target.closest("[data-inline-switch]");
  if (inlineSwitch) {
    state.screen = "w-inline-totp";
    state.inline.closed = false;
    render();
    return;
  }

  const inlineTotpCopy = target.closest("[data-inline-totp-copy]");
  if (inlineTotpCopy) {
    const account = inlineAccount(state.inline.totpAccount || "github");
    copyText(totpForSecret(account.totpSecret).raw, "验证码");
    return;
  }

  const inlineNew = target.closest("[data-inline-new]");
  if (inlineNew) {
    showToast("将在扩展弹窗中打开新建条目");
    return;
  }

  const launchUri = target.closest("[data-launch-uri]");
  if (launchUri) {
    event.stopPropagation();
    showToast("已在浏览器中打开");
    return;
  }

  const customAdd = target.closest("[data-custom-add]");
  if (customAdd) {
    const rows = customAdd.closest(".custom-card").querySelector("[data-custom-rows]");
    rows.insertAdjacentHTML("beforeend", customFieldRowHtml({ name: "", value: "", type: "text" }));
    const nameInput = rows.lastElementChild.querySelector("[data-custom-name]");
    if (nameInput) {
      nameInput.focus();
    }
    return;
  }

  const customRemove = target.closest("[data-custom-remove]");
  if (customRemove) {
    customRemove.closest("[data-custom-row]").remove();
    return;
  }

  const customReveal = target.closest("[data-custom-reveal]");
  if (customReveal) {
    const input = customReveal.closest(".custom-value").querySelector("input");
    input.type = input.type === "password" ? "text" : "password";
    customReveal.innerHTML = ic(input.type === "password" ? "visibility" : "visibility-off");
    customReveal.setAttribute("aria-label", input.type === "password" ? "显示值" : "隐藏值");
    return;
  }

  if (target.closest("[data-passkey-remove]")) {
    const popup = document.querySelector(".popup");
    if (popup && !popup.querySelector("[data-passkey-confirm]")) {
      popup.insertAdjacentHTML("beforeend", passkeyConfirmHtml());
    }
    return;
  }

  if (target.closest("[data-passkey-confirm]")) {
    document.querySelector("[data-passkey-scrim]")?.remove();
    document.querySelector("[data-passkey-row]")?.remove();
    showToast("通行密钥已移除");
    return;
  }

  if (
    target.closest("[data-passkey-cancel]") ||
    target.matches(".modal-scrim[data-passkey-scrim]")
  ) {
    document.querySelector("[data-passkey-scrim]")?.remove();
    return;
  }

  const indexButton = target.closest("#index button[data-screen]");
  if (indexButton) {
    const screen = indexButton.dataset.screen;
    if (W[screen] || D[screen] || P[screen]) {
      state.device = W[screen] ? "inline" : D[screen] ? "desktop" : "popup";
    }
    if (state.device === "inline") {
      resetInlineState();
    }
    state.screen = screen;
    if (indexButton.dataset.item) {
      state.selectedId = indexButton.dataset.item;
    }
    if (indexButton.dataset.formType) {
      state.formType = indexButton.dataset.formType;
      state.formMode = "new";
    }
    state.menu = null;
    render();
    return;
  }

  const flowButton = target.closest("#index button[data-flow]");
  if (flowButton) {
    const flow = FLOWS[Number(flowButton.dataset.flow)];
    if (!flow) {
      return;
    }
    state.device = flow.device;
    const first = flow.steps[0];
    state.screen = first.id;
    if (W[first.id]) {
      resetInlineState();
    }
    if (first.item) {
      state.selectedId = first.item;
    }
    state.menu = null;
    render();
    return;
  }

  const reveal = target.closest("[data-reveal]");
  if (reveal) {
    event.stopPropagation();
    const key = reveal.dataset.reveal;
    state.revealed[key] = !state.revealed[key];
    render();
    return;
  }

  const copyTarget = target.closest("[data-copy]");
  if (copyTarget) {
    copyText(copyTarget.dataset.copy, copyTarget.dataset.copyLabel);
    copyTarget.classList.add("copied");
    const hint = copyTarget.querySelector(".detail-copy-hint");
    if (hint) {
      hint.innerHTML = ic("check");
    }
    setTimeout(() => {
      copyTarget.classList.remove("copied");
      if (hint) {
        hint.innerHTML = ic("copy");
      }
    }, 1300);
    return;
  }

  const revealInput = target.closest("[data-reveal-input]");
  if (revealInput) {
    const button = revealInput;
    const input = button.parentElement.querySelector("input");
    if (input) {
      input.type = input.type === "password" ? "text" : "password";
      button.innerHTML = ic(input.type === "password" ? "visibility" : "visibility-off");
    }
    return;
  }

  const generateInto = target.closest("[data-generate-into]");
  if (generateInto) {
    const key = generateInto.dataset.generateInto;
    const input = document.querySelector('[data-input-key="' + key + '"]');
    if (input) {
      input.value = randomPassword(16);
      input.type = "text";
    }
    showToast("已生成并填入密码");
    return;
  }

  if (target.closest("[data-gen-refresh]")) {
    regenerate();
    return;
  }

  if (target.closest("[data-gen-copy]")) {
    copyText(state.genValue, "密码");
    return;
  }

  if (target.closest("[data-launch]")) {
    showToast("已在浏览器中打开");
    return;
  }

  const genMode = target.closest("[data-gen-mode]");
  if (genMode) {
    state.genMode = genMode.dataset.genMode;
    state.genValue =
      state.genMode === "passphrase"
        ? randomPassphrase(state.genWords)
        : state.genMode === "username"
          ? "quiet-" + randomPassphrase(2).toLowerCase()
          : randomPassword(state.genLength);
    render();
    return;
  }

  const menuButton = target.closest("[data-menu]");
  if (menuButton) {
    const next = menuButton.dataset.menu;
    state.menu = state.menu === next ? null : next;
    render();
    return;
  }

  const filterType = target.closest("[data-filter-type]");
  if (filterType) {
    state.filter.type = filterType.dataset.filterType;
    state.menu = null;
    render();
    return;
  }

  const filterFolder = target.closest("[data-filter-folder]");
  if (filterFolder) {
    state.filter.folder = filterFolder.dataset.filterFolder;
    state.menu = null;
    render();
    return;
  }

  if (target.closest("[data-filter-fav]")) {
    state.filter.fav = !state.filter.fav;
    state.menu = null;
    render();
    return;
  }

  if (target.closest("[data-clear-filters]")) {
    clearFilters();
    render();
    return;
  }

  const setTheme = target.closest("[data-set-theme]");
  if (setTheme) {
    const value = setTheme.dataset.setTheme;
    if (value === "system") {
      state.theme =
        typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    } else {
      state.theme = value;
    }
    render();
    return;
  }

  const toggle = target.closest("[data-toggle]");
  if (toggle) {
    const checked = toggle.getAttribute("aria-checked") === "true";
    toggle.setAttribute("aria-checked", String(!checked));
    return;
  }

  const check = target.closest("[data-check]");
  if (check) {
    event.stopPropagation();
    const row = check.closest(".d-tr.row");
    if (row) {
      row.setAttribute("aria-selected", String(check.checked));
    }
    return;
  }

  const nav = target.closest("[data-go]");
  if (nav) {
    if (nav.dataset.item) {
      state.selectedId = nav.dataset.item;
    }
    if (nav.dataset.formType) {
      state.formType = nav.dataset.formType;
    }
    if (nav.dataset.formMode) {
      state.formMode = nav.dataset.formMode;
    } else if (nav.dataset.go === "p-form" || nav.dataset.go === "d-form") {
      state.formMode = "edit";
    }
    const toast = nav.dataset.toast;
    state.screen = nav.dataset.go;
    state.menu = null;
    render();
    if (toast) {
      setTimeout(() => showToast(toast), 60);
    }
    return;
  }

  if (state.menu) {
    state.menu = null;
    render();
  }
}

function onDocumentInput(event) {
  const inlineUsername = event.target.closest("[data-inline-username]");
  if (inlineUsername) {
    state.inline.query = inlineUsername.value;
    state.inline.filledAccount = null;
    state.inline.closed = false;
    render();
    const next = document.querySelector("[data-inline-username]");
    if (next) {
      next.focus();
      next.setSelectionRange(next.value.length, next.value.length);
    }
    return;
  }

  const search = event.target.closest("[data-search]");
  if (search) {
    state.query = search.value;
    state.menu = null;
    render();
    const next = document.querySelector("[data-search]");
    if (next) {
      next.focus();
      next.setSelectionRange(next.value.length, next.value.length);
    }
    return;
  }

  const lengthInput = event.target.closest("[data-gen-length-input]");
  if (lengthInput) {
    state.genLength = Number(lengthInput.value);
    document.querySelectorAll("[data-gen-length]").forEach((element) => {
      element.textContent = String(state.genLength);
    });
    return;
  }

  const wordsInput = event.target.closest("[data-gen-words]");
  if (wordsInput) {
    state.genWords = Number(wordsInput.value);
    return;
  }
}

function onDocumentChange(event) {
  const type = event.target.closest("[data-custom-type]");
  if (type) {
    const row = type.closest("[data-custom-row]");
    if (row) {
      applyCustomFieldType(row, type.value === "hidden");
    }
  }
}

function onDocumentKeyDown(event) {
  const typing = event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
  if (state.device === "inline" && event.key === "Escape") {
    if (state.inline.passkeyAuth) {
      state.inline.passkeyAuth = null;
      render();
      return;
    }
    if (!state.inline.closed) {
      state.inline.closed = true;
      render();
      return;
    }
  }

  if (!typing && (event.metaKey || event.ctrlKey)) {
    const key = (event.key || "").toLowerCase();
    if (key === "n") {
      event.preventDefault();
      if (state.device === "inline") {
        showToast("请在扩展弹窗中新建条目");
        return;
      }
      navigate(state.device === "popup" ? "p-new-type" : "d-new");
      return;
    }
    if (key === "k") {
      event.preventDefault();
      const search = document.querySelector("[data-search]");
      if (search) {
        search.focus();
      }
      return;
    }
  }

  if (!typing && event.key === "Escape") {
    const back = backTarget();
    if (back) {
      navigate(back);
    }
    return;
  }

  if ((event.key === "Enter" || event.key === " ") && !typing) {
    const active = document.activeElement;
    const nav = active && active.closest ? active.closest("[data-go]") : null;
    if (nav) {
      event.preventDefault();
      nav.click();
    }
  }
}

/* ========================================================================== */
/* 启动                                                                        */
/* ========================================================================== */

function init() {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("input", onDocumentInput);
  document.addEventListener("change", onDocumentChange);
  document.addEventListener("keydown", onDocumentKeyDown);
  const params = new URLSearchParams(location.search);
  if (params.get("device") === "desktop") {
    state.device = "desktop";
  } else if (params.get("device") === "inline") {
    state.device = "inline";
  }
  const screen = params.get("screen");
  if (screen && (P[screen] || D[screen] || W[screen])) {
    state.screen = screen;
    state.device = W[screen] ? "inline" : D[screen] ? "desktop" : "popup";
  } else {
    state.screen =
      state.device === "popup"
        ? "p-unlock"
        : state.device === "desktop"
          ? "d-unlock"
          : "w-inline-login";
  }
  if (state.device === "inline") {
    resetInlineState();
  }
  const item = params.get("item");
  if (item && DATA.items.some((entry) => entry.id === item)) {
    state.selectedId = item;
  }
  const formType = params.get("type");
  if (formType && TYPES[formType]) {
    state.formType = formType;
  }
  const mode = params.get("mode");
  if (mode === "edit" || mode === "new") {
    state.formMode = mode;
  }
  render();
  setInterval(updateTotp, 1000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  init();
}
