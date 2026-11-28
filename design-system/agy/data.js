/* ==========================================================================
   LocalPass · AGY Compact v4 — Synthetic Dataset
   All values are 100% synthetic. Covers all 8 ItemKind schemas from item-fields.ts.
   ========================================================================== */

const ITEM_KINDS = [
  { id: "login", label: "登录", icon: "key", tone: "blue" },
  { id: "token", label: "令牌", icon: "clock", tone: "violet" },
  { id: "ssh-key", label: "SSH 私钥", icon: "terminal", tone: "slate" },
  { id: "license", label: "许可证", icon: "license", tone: "amber" },
  { id: "card", label: "卡片", icon: "card", tone: "green" },
  { id: "identity", label: "身份", icon: "id", tone: "teal" },
  { id: "server", label: "服务器", icon: "server", tone: "indigo" },
  { id: "note", label: "笔记", icon: "note", tone: "rose" },
];

const FOLDERS = [
  { id: "work", name: "工作", color: "#175ddc", count: 42 },
  { id: "personal", name: "个人", color: "#6d28d9", count: 31 },
  { id: "finance", name: "财务", color: "#047857", count: 9 },
  { id: "infra", name: "服务器", color: "#b45309", count: 7 },
];

const INITIAL_ITEMS = [
  {
    id: "northwind",
    kind: "login",
    kindLabel: "登录",
    name: "Northwind",
    user: "alex@northwind.io",
    host: "northwind.io",
    host2: "sso.northwind.io",
    ini: "N",
    tone: "blue",
    otp: "492 106",
    totpSecret: "JBSW Y3DP EHPK 3PXP",
    folder: "工作",
    folderId: "work",
    favorite: true,
    recent: true,
    siteMatch: true,
    updated: "2 分钟前",
    created: "2025-11-04",
    secret: "N7$kQ2m!rT9@xL4wZ8p",
    strength: { score: 4, label: "强 · 20 位", reuse: "未重复", breach: "未发现" },
    passkey: { rp: "northwind.io", user: "alex@northwind.io", date: "2026-08-12" },
    custom: [
      { name: "环境", value: "Production", hidden: false },
      { name: "租户编号", value: "NW-4209", hidden: false },
      { name: "应急恢复码", value: "8821-4092-1190", hidden: true },
    ],
    note: "生产控制台。仅在发布窗口使用；日常排查请切换 staging 租户，勿直接写入生产数据。",
    versions: [
      {
        ver: 3,
        when: "2 分钟前",
        device: "MacBook Pro",
        summary: "密码已更换 · + 验证码",
        current: true,
        secret: "N7$kQ2m!rT9@xL4wZ8p",
      },
      {
        ver: 2,
        when: "3 天前",
        device: "Chrome 扩展",
        summary: "更新网址与租户备注",
        current: false,
        secret: "M4#pA9v!wK2@zR7qL1x",
      },
      {
        ver: 1,
        when: "2025-11-04",
        device: "MacBook Pro",
        summary: "首次保存",
        current: false,
        secret: "K2!dR8n$qP5@mX3wV9z",
      },
    ],
  },
  {
    id: "northwind-ops",
    kind: "login",
    kindLabel: "登录",
    name: "Northwind 运维",
    user: "ops@northwind.io",
    host: "northwind.io",
    ini: "NO",
    tone: "indigo",
    otp: "831 204",
    totpSecret: "KRUG SIDX NFXG K2LM",
    folder: "工作",
    folderId: "work",
    favorite: false,
    recent: true,
    siteMatch: true,
    updated: "昨天",
    created: "2026-01-18",
    secret: "R9@wP3x!mT6#vL2nQ5c",
    strength: { score: 4, label: "强 · 20 位", reuse: "未重复", breach: "未发现" },
    passkey: null,
    custom: [{ name: "值班权限", value: "On-Call L2", hidden: false }],
    note: "只用于值班排障审计。",
    versions: [
      {
        ver: 2,
        when: "昨天",
        device: "MacBook Pro",
        summary: "添加值班权限字段",
        current: true,
        secret: "R9@wP3x!mT6#vL2nQ5c",
      },
    ],
  },
  {
    id: "northwind-staging",
    kind: "login",
    kindLabel: "登录",
    name: "Northwind Staging",
    user: "staging@northwind.io",
    host: "northwind.io",
    ini: "NS",
    tone: "teal",
    otp: null,
    folder: "工作",
    folderId: "work",
    favorite: false,
    recent: false,
    siteMatch: true,
    updated: "5 天前",
    created: "2026-02-09",
    secret: "T4!kM8p@xR2$vN6wQ9z",
    strength: { score: 3, label: "良 · 16 位", reuse: "未重复", breach: "未发现" },
    passkey: null,
    custom: [],
    note: "测试环境共用凭证。",
    versions: [
      {
        ver: 1,
        when: "5 天前",
        device: "MacBook Pro",
        summary: "首次保存",
        current: true,
        secret: "T4!kM8p@xR2$vN6wQ9z",
      },
    ],
  },
  {
    id: "acme",
    kind: "login",
    kindLabel: "登录",
    name: "Acme Cloud",
    user: "alex.chen@acme.co",
    host: "console.acme.co",
    ini: "A",
    tone: "violet",
    otp: null,
    folder: "工作",
    folderId: "work",
    favorite: false,
    recent: true,
    siteMatch: false,
    updated: "昨天",
    created: "2025-09-12",
    secret: "AcmeDemo2026",
    strength: { score: 2, label: "偏弱 · 12 位", reuse: "未重复", breach: "未开启比对" },
    passkey: { rp: "console.acme.co", user: "alex.chen@acme.co", date: "2026-07-03" },
    custom: [{ name: "角色", value: "Owner", hidden: false }],
    note: "账单与配额控制面板。",
    versions: [
      {
        ver: 1,
        when: "昨天",
        device: "Mac mini",
        summary: "首次保存",
        current: true,
        secret: "AcmeDemo2026",
      },
    ],
  },
  {
    id: "cf-r2-token",
    kind: "token",
    kindLabel: "令牌",
    name: "Cloudflare R2 Sync Token",
    service: "Cloudflare R2",
    accessKeyId: "demo-r2-ak-0001",
    user: "Cloudflare R2",
    host: "dash.cloudflare.com",
    ini: "R2",
    tone: "violet",
    otp: "640 812",
    totpSecret: "MZQW 24LO K5UX 6Z3P",
    folder: "服务器",
    folderId: "infra",
    favorite: false,
    recent: true,
    siteMatch: false,
    updated: "3 天前",
    created: "2026-05-11",
    secret: "demo-r2-tok-0001-0002",
    scope: "Object Read & Write (lp-7f3a)",
    expires: "2027-05-11",
    env: "Production",
    strength: { score: 4, label: "API 令牌", reuse: "不适用", breach: "不适用" },
    custom: [{ name: "关联桶 ARN", value: "r2:lp-7f3a/*", hidden: false }],
    note: "仅授权单桶 lp-7f3a 的对象读写权限。",
    versions: [
      {
        ver: 1,
        when: "3 天前",
        device: "MacBook Pro",
        summary: "创建令牌",
        current: true,
        secret: "demo-r2-tok-0001-0002",
      },
    ],
  },
  {
    id: "ssh-ed25519",
    kind: "ssh-key",
    kindLabel: "SSH 私钥",
    name: "prod-bastion-ed25519",
    algorithm: "Ed25519 · 256-bit",
    user: "SHA256:7fKm9qL2pW4xV8nB...",
    host: "10.0.4.11",
    ini: "SH",
    tone: "slate",
    otp: null,
    folder: "服务器",
    folderId: "infra",
    favorite: false,
    recent: false,
    siteMatch: false,
    updated: "2 周前",
    created: "2025-12-02",
    secret:
      "[OPENSSH PRIVATE KEY 合成示例]\ndemo-only-not-a-real-ssh-private-key-material\n[END OPENSSH PRIVATE KEY]",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHuT0/aZeo... alex@mbp-local",
    passphrase: "SshPass#492mK",
    hosts: "10.0.4.11 (prod-bastion), db-01.internal",
    strength: { score: 4, label: "Ed25519 · 256-bit", reuse: "未重复", breach: "不适用" },
    custom: [{ name: "签发环境", value: "mbp-local-keychain", hidden: false }],
    note: "由服务器条目「prod-bastion」通过引用关联，无需重复复制私钥。",
    versions: [
      {
        ver: 1,
        when: "2 周前",
        device: "MacBook Pro",
        summary: "导入公钥与私钥",
        current: true,
        secret: "...",
      },
    ],
  },
  {
    id: "prod-server",
    kind: "server",
    kindLabel: "服务器",
    name: "prod-bastion",
    hostIp: "10.0.4.11",
    port: "22",
    loginUser: "deploy",
    user: "deploy@10.0.4.11:22",
    host: "10.0.4.11:22",
    ini: "SV",
    tone: "indigo",
    otp: null,
    folder: "服务器",
    folderId: "infra",
    favorite: false,
    recent: false,
    siteMatch: false,
    updated: "上周",
    created: "2025-12-03",
    secret: "Bst#88qW!2mP9$xL4nK",
    protocol: "SSH / WireGuard",
    sudoNote: "需堡垒机硬件令牌二次确认",
    region: "ap-northeast-1",
    linkedSshId: "ssh-ed25519",
    linkedSshName: "prod-bastion-ed25519",
    strength: { score: 4, label: "强 · 19 位", reuse: "未重复", breach: "未发现" },
    custom: [{ name: "跳板网关", value: "wg0 (172.16.0.1)", hidden: false }],
    note: "连接前先开启公司 VPN。",
    versions: [
      {
        ver: 1,
        when: "上周",
        device: "MacBook Pro",
        summary: "关联 SSH 私钥",
        current: true,
        secret: "Bst#88qW!2mP9$xL4nK",
      },
    ],
  },
  {
    id: "visa-card",
    kind: "card",
    kindLabel: "卡片",
    name: "Visa · 4421",
    user: "陈亚历 · 尾号 4421",
    host: "",
    ini: "V",
    tone: "green",
    otp: null,
    folder: "财务",
    folderId: "finance",
    favorite: true,
    recent: false,
    siteMatch: false,
    isDefault: true,
    cardBrand: "Visa",
    cardholder: "ALEX CHEN",
    cardNumber: "4532 8810 2204 4421",
    cardLast4: "4421",
    expiry: "09/29",
    expMonth: "09",
    expYear: "29",
    cardCode: "842",
    pin: "6204",
    billingZip: "200233",
    updated: "上月",
    created: "2025-06-14",
    secret: "4532 8810 2204 4421",
    strength: { score: 4, label: "已开启掩码", reuse: "不适用", breach: "不适用" },
    custom: [{ name: "月度限额", value: "USD 5,000", hidden: false }],
    note: "默认海外软件订阅卡。",
    versions: [
      {
        ver: 1,
        when: "上月",
        device: "MacBook Pro",
        summary: "更新有效期",
        current: true,
        secret: "4532 8810 2204 4421",
      },
    ],
  },
  {
    id: "mc-card",
    kind: "card",
    kindLabel: "卡片",
    name: "Mastercard · 8810",
    user: "陈亚历 · 尾号 8810",
    host: "",
    ini: "M",
    tone: "teal",
    otp: null,
    folder: "财务",
    folderId: "finance",
    favorite: false,
    recent: false,
    siteMatch: false,
    isDefault: false,
    cardBrand: "Mastercard",
    cardholder: "ALEX CHEN",
    cardNumber: "5412 7590 1180 8810",
    cardLast4: "8810",
    expiry: "11/28",
    expMonth: "11",
    expYear: "28",
    cardCode: "319",
    pin: "4108",
    billingZip: "200233",
    updated: "2 个月前",
    created: "2025-05-02",
    secret: "5412 7590 1180 8810",
    strength: { score: 4, label: "已开启掩码", reuse: "不适用", breach: "不适用" },
    custom: [],
    note: "备用结算卡。",
    versions: [
      {
        ver: 1,
        when: "2 个月前",
        device: "MacBook Pro",
        summary: "首次保存",
        current: true,
        secret: "5412 7590 1180 8810",
      },
    ],
  },
  {
    id: "id-alex",
    kind: "identity",
    kindLabel: "身份",
    name: "陈亚历 · 个人证件与地址",
    user: "陈亚历 (Alex Chen)",
    host: "",
    ini: "ID",
    tone: "teal",
    otp: null,
    folder: "个人",
    folderId: "personal",
    favorite: false,
    recent: false,
    siteMatch: false,
    isDefault: true,
    firstName: "亚历",
    lastName: "陈",
    idType: "护照 / 旅行证件",
    idNumber: "E88291042 (合成号)",
    address: "上海市徐汇区漕河泾开发路 100 号 8F",
    postalCode: "200233",
    company: "Studio Kite Design",
    phone: "+86 138 0000 4421",
    email: "alex@studiokite.design",
    updated: "上月",
    created: "2025-08-20",
    secret: "E88291042",
    strength: { score: 4, label: "本机加密", reuse: "不适用", breach: "不适用" },
    custom: [{ name: "紧急联系人", value: "Lin Chen (+86 139 0000 1102)", hidden: false }],
    note: "常用收件与实名信息。",
    versions: [
      {
        ver: 1,
        when: "上月",
        device: "MacBook Pro",
        summary: "更新地址",
        current: true,
        secret: "E88291042",
      },
    ],
  },
  {
    id: "raycast-lic",
    kind: "license",
    kindLabel: "许可证",
    name: "Studio Kit Pro 许可证",
    software: "Studio Kit Pro",
    edition: "Team Pro / 团队版",
    licensedEmail: "alex@studiokite.design",
    user: "Studio Kit Pro",
    host: "",
    ini: "LC",
    tone: "amber",
    otp: null,
    folder: "工作",
    folderId: "work",
    favorite: false,
    recent: false,
    siteMatch: false,
    updated: "上月",
    created: "2025-10-08",
    secret: "SKPRO-8821-FA90-4412-90BC",
    seats: "3 / 5 台设备",
    purchased: "2025-10-08",
    expires: "2027-10-08",
    orderId: "ORD-2025-1008-91A",
    strength: { score: 4, label: "序列号", reuse: "不适用", breach: "不适用" },
    custom: [{ name: "发票抬头", value: "Studio Kite Studio", hidden: false }],
    note: "离线激活码，重装 macOS 后直接粘贴即可。",
    versions: [
      {
        ver: 1,
        when: "上月",
        device: "MacBook Pro",
        summary: "首次保存",
        current: true,
        secret: "SKPRO-8821-FA90-4412-90BC",
      },
    ],
  },
  {
    id: "atlas-bank",
    kind: "login",
    kindLabel: "登录",
    name: "Atlas Bank",
    user: "alex.chen",
    host: "atlasbank.com",
    ini: "AB",
    tone: "green",
    otp: "118 402",
    totpSecret: "NB2W 45DF OIZA 1184",
    folder: "财务",
    folderId: "finance",
    favorite: true,
    recent: false,
    siteMatch: false,
    updated: "3 天前",
    created: "2025-07-01",
    secret: "SharedBankPw#2025",
    strength: { score: 2, label: "重复使用 · 2 处", reuse: "与个人邮箱重复", breach: "未发现" },
    passkey: null,
    custom: [{ name: "账户尾号", value: "8802", hidden: false }],
    note: "个人储蓄账号；切勿与邮箱共用密码。",
    versions: [
      {
        ver: 2,
        when: "3 天前",
        device: "MacBook Pro",
        summary: "新增验证码",
        current: true,
        secret: "SharedBankPw#2025",
      },
    ],
  },
  {
    id: "wifi-note",
    kind: "note",
    kindLabel: "笔记",
    name: "家庭网络与 NAS 应急卡",
    category: "家庭网络与应急",
    recoveryHint: "书房抽屉加密 U 盘 #2（校验后缀 9a4f）",
    user: "安全笔记 · 应急分类",
    host: "",
    ini: "NT",
    tone: "rose",
    otp: null,
    folder: "个人",
    folderId: "personal",
    favorite: false,
    recent: false,
    siteMatch: false,
    updated: "上周",
    created: "2025-04-19",
    secret:
      "主路由管理后台: 192.168.50.1\nGuest Wi-Fi: KiteGuest / k9m2-4401\nNAS RAID 阵列恢复提示: 启用 6-bay Btrfs 加密解锁",
    strength: { score: 4, label: "密文笔记", reuse: "不适用", breach: "不适用" },
    custom: [{ name: "紧急备份介质", value: "加密 U 盘 #2", hidden: false }],
    note: "主路由管理后台: 192.168.50.1\nGuest Wi-Fi: KiteGuest / k9m2-4401\nNAS RAID 阵列恢复提示: 启用 6-bay Btrfs 加密解锁",
    versions: [
      {
        ver: 1,
        when: "上周",
        device: "MacBook Pro",
        summary: "更新 NAS 位置",
        current: true,
        secret: "...",
      },
    ],
  },
];

const ITEM_KIND_SCHEMAS = {
  login: {
    defaults: [
      {
        key: "user",
        label: "用户名",
        placeholder: "alex@example.com",
        sample: "alex@northwind.io",
      },
      {
        key: "secret",
        label: "安全密码",
        secret: true,
        generate: true,
        placeholder: "输入或生成强密码",
        sample: "N7$kQ2m!rT9@xL4w",
      },
      {
        key: "totpSecret",
        label: "动态口令密钥",
        mono: true,
        placeholder: "Base32 TOTP 密钥",
        sample: "JBSW Y3DP EHPK 3PXP",
      },
      { key: "host", label: "主网址", placeholder: "example.com", sample: "app.northwind.io" },
    ],
    optional: [
      {
        key: "host2",
        label: "备用网址",
        placeholder: "sso.example.com",
        sample: "sso.northwind.io",
      },
      {
        key: "note",
        label: "备注",
        multiline: true,
        placeholder: "补充说明…",
        sample: "生产控制台凭据",
      },
    ],
  },
  token: {
    defaults: [
      {
        key: "service",
        label: "所属服务",
        placeholder: "Cloudflare R2 / GitHub",
        sample: "Cloudflare R2",
      },
      {
        key: "accessKeyId",
        label: "Key ID",
        mono: true,
        placeholder: "Access Key ID",
        sample: "demo-r2-ak-0001",
      },
      {
        key: "secret",
        label: "API 令牌",
        secret: true,
        generate: true,
        mono: true,
        placeholder: "令牌密钥值",
        sample: "demo-r2-tok-0001-0002",
      },
      {
        key: "scope",
        label: "权限范围",
        placeholder: "Read / Write",
        sample: "Object Read & Write (lp-7f3a)",
      },
    ],
    optional: [
      {
        key: "expires",
        label: "过期日期",
        mono: true,
        placeholder: "YYYY-MM-DD",
        sample: "2027-05-11",
      },
      {
        key: "env",
        label: "运行环境",
        options: ["Production", "Staging", "Development", "Testing", "Preview"],
        allowCustom: true,
        placeholder: "输入自定义环境",
        sample: "Production",
      },
      {
        key: "totpSecret",
        label: "管理 2FA",
        mono: true,
        placeholder: "可选 TOTP Base32",
        sample: "MZQW 24LO K5UX 6Z3P",
      },
      { key: "note", label: "备注", multiline: true, sample: "单桶隔离凭据" },
    ],
  },
  "ssh-key": {
    defaults: [
      {
        key: "algorithm",
        label: "算法与位数",
        options: ["Ed25519 · 256-bit", "ECDSA P-256", "RSA · 4096-bit", "RSA · 2048-bit"],
        allowCustom: true,
        placeholder: "输入自定义算法与位数",
        sample: "Ed25519 · 256-bit",
      },
      {
        key: "user",
        label: "公钥指纹",
        mono: true,
        placeholder: "SHA256:...",
        sample: "SHA256:7fKm9qL2pW4xV8nB",
      },
      {
        key: "publicKey",
        label: "公钥正文",
        multiline: true,
        mono: true,
        placeholder: "ssh-ed25519 AAAA...",
        sample: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... alex@mbp",
      },
      {
        key: "secret",
        label: "私钥正文",
        secret: true,
        multiline: true,
        mono: true,
        placeholder: "[OPENSSH PRIVATE KEY 合成示例]",
        sample: "[OPENSSH PRIVATE KEY 合成示例]\ndemo-only-not-a-real-key",
      },
    ],
    optional: [
      {
        key: "passphrase",
        label: "保护口令",
        secret: true,
        generate: true,
        sample: "SshPass#492mK",
      },
      {
        key: "hosts",
        label: "适用主机",
        placeholder: "host1, host2",
        sample: "prod-bastion (10.0.4.11)",
      },
      { key: "note", label: "备注", multiline: true, sample: "供服务器条目引用关联" },
    ],
  },
  license: {
    defaults: [
      {
        key: "software",
        label: "软件名称",
        placeholder: "例如 Studio Kit Pro",
        sample: "Studio Kit Pro",
      },
      {
        key: "edition",
        label: "授权档位",
        options: [
          "Personal / 个人版",
          "Pro / 专业版",
          "Team Pro / 团队版",
          "Enterprise / 企业版",
          "Lifetime / 买断版",
        ],
        allowCustom: true,
        placeholder: "输入自定义授权档位",
        sample: "Team Pro / 团队版",
      },
      {
        key: "secret",
        label: "序列号",
        secret: true,
        mono: true,
        placeholder: "XXXX-XXXX-XXXX-XXXX",
        sample: "SKPRO-8821-FA90-4412-90BC",
      },
      {
        key: "licensedEmail",
        label: "授权邮箱",
        placeholder: "license@example.com",
        sample: "alex@studiokite.design",
      },
    ],
    optional: [
      { key: "seats", label: "席位设备数", placeholder: "3 / 5 台", sample: "3 / 5 台设备" },
      { key: "purchased", label: "购买日期", mono: true, sample: "2025-10-08" },
      { key: "expires", label: "到期日期", mono: true, sample: "2027-10-08" },
      { key: "orderId", label: "订单编号", mono: true, sample: "ORD-2025-1008-91A" },
      { key: "note", label: "备注", multiline: true, sample: "离线永久激活" },
    ],
  },
  card: {
    defaults: [
      { key: "cardholder", label: "持卡人姓名", placeholder: "ALEX CHEN", sample: "ALEX CHEN" },
      {
        key: "cardBrand",
        label: "发卡行/组织",
        options: ["Visa", "Mastercard", "银联 UnionPay", "American Express", "JCB", "Discover"],
        allowCustom: true,
        placeholder: "输入自定义发卡行或卡组织",
        sample: "Visa",
      },
      {
        key: "secret",
        label: "银行卡号",
        secret: true,
        mono: true,
        placeholder: "4532 •••• •••• ••••",
        sample: "4532 8810 2204 4421",
      },
      {
        key: "expiry",
        label: "有效期",
        mono: true,
        inputMode: "numeric",
        maxLength: 5,
        placeholder: "MM/YY（如 02/32）",
        sample: "02/32",
      },
      {
        key: "cvv",
        label: "安全码 CVV",
        secret: true,
        mono: true,
        placeholder: "3 或 4 位",
        sample: "842",
      },
    ],
    optional: [
      { key: "pin", label: "交易 PIN", secret: true, mono: true, sample: "6204" },
      { key: "billingZip", label: "账单邮编", mono: true, sample: "200233" },
      { key: "note", label: "备注", multiline: true, sample: "海外订阅专用卡" },
    ],
  },
  identity: {
    defaults: [
      { key: "lastName", label: "姓", placeholder: "陈", sample: "陈" },
      { key: "firstName", label: "名", placeholder: "亚历", sample: "亚历" },
      {
        key: "idType",
        label: "证件类型",
        options: [
          "居民身份证",
          "护照 / 旅行证件",
          "港澳居民来往内地通行证",
          "台湾居民来往大陆通行证",
          "驾驶证",
        ],
        allowCustom: true,
        placeholder: "输入自定义证件类型",
        sample: "护照 / 旅行证件",
      },
      {
        key: "secret",
        label: "证件号",
        secret: true,
        mono: true,
        placeholder: "证件编号",
        sample: "E88291042",
      },
      {
        key: "phone",
        label: "手机号",
        mono: true,
        placeholder: "+86 ...",
        sample: "+86 138 0000 4421",
      },
      {
        key: "email",
        label: "电子邮箱",
        placeholder: "alex@example.com",
        sample: "alex@studiokite.design",
      },
    ],
    optional: [
      {
        key: "address",
        label: "详细地址",
        multiline: true,
        sample: "上海市徐汇区漕河泾开发路 100 号 8F",
      },
      { key: "postalCode", label: "邮政编码", mono: true, sample: "200233" },
      { key: "company", label: "公司名称", sample: "Studio Kite Design" },
      { key: "note", label: "备注", multiline: true, sample: "常用收件实名信息" },
    ],
  },
  server: {
    defaults: [
      {
        key: "hostIp",
        label: "主机地址",
        mono: true,
        placeholder: "10.0.4.11 或域名",
        sample: "10.0.4.11",
      },
      { key: "port", label: "端口", mono: true, placeholder: "22", sample: "22" },
      {
        key: "protocol",
        label: "连接协议",
        options: ["SSH", "SSH / WireGuard", "HTTPS / WebConsole", "SFTP", "RDP", "VNC"],
        allowCustom: true,
        placeholder: "输入自定义协议",
        sample: "SSH / WireGuard",
      },
      { key: "loginUser", label: "登录账号", placeholder: "deploy / root", sample: "deploy" },
      {
        key: "secret",
        label: "登录口令",
        secret: true,
        generate: true,
        placeholder: "服务器口令",
        sample: "Bst#88qW!2mP9$xL4nK",
      },
      {
        key: "linkedSshName",
        label: "关联 SSH 密钥",
        placeholder: "选择 SSH 私钥条目",
        sample: "prod-bastion-ed25519",
      },
    ],
    optional: [
      { key: "sudoNote", label: "特权/sudo备注", sample: "需堡垒机硬件令牌二次确认" },
      { key: "region", label: "区域/机房", mono: true, sample: "ap-northeast-1" },
      { key: "note", label: "备注", multiline: true, sample: "连接前先开启公司 VPN" },
    ],
  },
  note: {
    defaults: [
      {
        key: "category",
        label: "笔记分类",
        options: ["家庭网络与应急", "恢复密钥 / 助记备份", "软件与财务备忘", "工作规范备忘"],
        allowCustom: true,
        placeholder: "输入自定义笔记分类",
        sample: "家庭网络与应急",
      },
      {
        key: "secret",
        label: "加密正文",
        multiline: true,
        placeholder: "输入需加密保管的纯文本内容…",
        sample: "主路由管理后台: 192.168.50.1\nGuest Wi-Fi: KiteGuest / k9m2-4401",
      },
    ],
    optional: [{ key: "recoveryHint", label: "介质存放提示", sample: "书房抽屉加密 U 盘 #2" }],
  },
};

const ARCHIVED_ITEMS = [
  {
    id: "arch-1",
    name: "Legacy Heroku",
    user: "alex@northwind.io",
    kind: "登录",
    ini: "H",
    tone: "slate",
    archivedAt: "2026-10-14",
    folder: "工作",
  },
  {
    id: "arch-2",
    name: "2024 临时域名令牌",
    user: "Namecheap API",
    kind: "令牌",
    ini: "NC",
    tone: "violet",
    archivedAt: "2026-09-28",
    folder: "服务器",
  },
  {
    id: "arch-3",
    name: "旧招行卡 · 1094",
    user: "已销户",
    kind: "卡片",
    ini: "C",
    tone: "green",
    archivedAt: "2026-08-03",
    folder: "财务",
  },
];

const TRASH_ITEMS = [
  {
    id: "tr-1",
    name: "旧版 Figma 测试组",
    user: "alex@studiokite.design",
    ini: "F",
    tone: "slate",
    deletedAt: "2 天前",
    remain: "还剩 28 天",
    folder: "工作",
  },
  {
    id: "tr-2",
    name: "临时 Dropbox 密钥",
    user: "Dropbox API",
    ini: "D",
    tone: "slate",
    deletedAt: "9 天前",
    remain: "还剩 21 天",
    folder: "个人",
  },
  {
    id: "tr-3",
    name: "Staging 压测账户",
    user: "loadtest@northwind.io",
    ini: "L",
    tone: "slate",
    deletedAt: "12 天前",
    remain: "还剩 18 天",
    folder: "工作",
  },
];

const HEALTH_ISSUES = [
  {
    id: "atlas-bank",
    title: "密码在 2 个条目中重复",
    sub: "Atlas Bank 与 个人邮箱 使用同一密码 · 建议立即更换",
    tag: "重复使用",
    tone: "bad",
    action: "去修改",
  },
  {
    id: "acme",
    title: "密码强度偏弱（12 位，无符号）",
    sub: "Acme Cloud · 已支持通行密钥，建议同时升级密码",
    tag: "弱密码",
    tone: "warn",
    action: "去修改",
  },
  {
    id: "northwind-staging",
    title: "密码已 412 天未更换",
    sub: "Northwind Staging · 上次修改于 2025-10-11",
    tag: "超期",
    tone: "warn",
    action: "去更换",
  },
  {
    id: "acme-2fa",
    title: "未配置验证码密钥（2FA）",
    sub: "Acme Cloud · 站点支持 TOTP，补齐后可内联自动填充",
    tag: "缺 2FA",
    tone: "",
    action: "去补充",
  },
];

const IMPORT_SOURCES = [
  {
    id: "1pux",
    name: "1Password（.1pux / .1pif / .csv）",
    sub: "完整保留标签、TOTP、自定义字段与文件夹",
    ext: ".1pux,.1pif,.csv",
    badge: "推荐",
  },
  {
    id: "lpjson",
    name: "LocalPass 加密导出（.json）",
    sub: "需输入生成该文件时的备份口令",
    ext: ".json",
    badge: "原生",
  },
  {
    id: "bwjson",
    name: "Bitwarden 导出（.json / .csv）",
    sub: "支持加密 JSON、明文 JSON 与 CSV",
    ext: ".json,.csv",
    badge: "兼容",
  },
  {
    id: "gauth",
    name: "Google 身份验证器",
    sub: "扫码截图、相册图片或 otpauth-migration URI",
    ext: "image/*",
    badge: "2FA",
  },
  {
    id: "csv",
    name: "通用 CSV 表格（Chrome / Safari）",
    sub: "自动映射网址、用户名与密码列",
    ext: ".csv",
    badge: "通用",
  },
];

const IMPORT_PREVIEW_ROWS = [
  {
    name: "GitHub Enterprise",
    user: "alex@northwind.io",
    status: "new",
    statusLabel: "将新增",
    detail: "含 TOTP · 文件夹：工作",
  },
  {
    name: "Northwind",
    user: "alex@northwind.io",
    status: "dup",
    statusLabel: "重复跳过",
    detail: "匹配规则：名称 + 用户名 + northwind.io",
  },
  {
    name: "AWS Root Console",
    user: "infra@northwind.io",
    status: "new",
    statusLabel: "将新增",
    detail: "含 2 个自定义字段",
  },
  {
    name: "未知格式行 #48",
    user: "缺少密码字段",
    status: "err",
    statusLabel: "无法识别",
    detail: "已跳过，不阻断其余条目导入",
  },
];

const R2_DEVICES = [
  {
    name: "MacBook Pro（本机）",
    os: "macOS 15.2 · 桌面端",
    last: "2 分钟前",
    current: true,
    keyHint: "Ed25519 · gen #42",
  },
  {
    name: "Chrome 扩展（本机）",
    os: "MV3 · 原生消息已连接",
    last: "刚刚",
    current: true,
    keyHint: "com.localpass.desktop",
  },
  {
    name: "Mac mini（工作室）",
    os: "macOS 14.7 · 桌面端",
    last: "昨天 21:04",
    current: false,
    keyHint: "Ed25519 · gen #41",
  },
];

const NETWORK_ALLOWLIST = [
  {
    host: "lp-7f3a.r2.cloudflarestorage.com",
    purpose: "Cloudflare R2 快照同步",
    desc: "仅在用户手动触发同步与恢复时访问（SigV4 签名）",
    on: true,
  },
];

const NETWORK_DEFAULT_RULES = [
  {
    title: "默认拒绝全部未授权出站请求",
    sub: "仅放行你在上方授权的自选 R2 存储域名；无任何隐藏或默认第三方后端",
    badge: "Default Deny",
  },
  {
    title: "锁库状态恒为 0 次网络请求",
    sub: "解锁前、浏览列表、本地搜索与密码生成均在离线内存完成",
    badge: "0 请求",
  },
  {
    title: "不拉取远程网站图标",
    sub: "列表与内联菜单采用本地首字母色标 SVG，杜绝泄露你访问过哪些网站",
    badge: "离线图标",
  },
];

const INITIAL_SHORTCUTS = [
  {
    id: "sc-search",
    key: "⌘K / /",
    title: "应用内快速检索浮窗",
    desc: "在 LocalPass 窗口内快速检索全部字段（已取消系统全局热键监听）",
  },
  { id: "sc-nav", key: "↑↓ · ↵", title: "列表移动与打开详情", desc: "纯键盘切换选中条目" },
  {
    id: "sc-copy",
    key: "⌘C / ⇧⌘C",
    title: "复制用户名 / 密码",
    desc: "针对当前高亮条目直接复制并在 30 秒后自动清空",
  },
  { id: "sc-edit", key: "⌘N · ⌘E", title: "新建 / 编辑当前条目", desc: "就地展开动态字段编辑器" },
  {
    id: "sc-delete",
    key: "Delete / ⌘⌫",
    title: "归档 / 移到回收站（支持撤销）",
    desc: "按下删除快捷键可移入 30 天回收站",
  },
  { id: "sc-lock", key: "⌘L", title: "立即锁定保险库", desc: "同步锁住 Mac 桌面端与 Chrome 扩展" },
];

function withDraftFieldMeta(sp, val) {
  const str = val !== undefined && val !== null ? String(val) : "";
  const hasOpts = Array.isArray(sp.options) && sp.options.length > 0;
  const allowCustom = sp.allowCustom !== false;
  const customMode = hasOpts && allowCustom && str.trim() !== "" && !sp.options.includes(str);
  return { ...sp, value: str, customMode };
}

function buildFormDraft(kind, item = null) {
  const schema = ITEM_KIND_SCHEMAS[kind] || ITEM_KIND_SCHEMAS.login;
  const allSpecs = [...schema.defaults, ...schema.optional];
  const fields = [];

  if (item && item.kind === kind) {
    for (const sp of allSpecs) {
      let val = item[sp.key];
      if (sp.key === "secret" && (val === undefined || val === null)) val = item.secret || "";
      if (
        sp.key === "expiry" &&
        (val === undefined || val === null || val === "") &&
        item.expMonth &&
        item.expYear
      ) {
        val = `${item.expMonth}/${String(item.expYear).slice(-2)}`;
      }
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        fields.push(withDraftFieldMeta(sp, val));
      }
    }
    // Ensure at least defaults are present if editing sparse item
    for (const sp of schema.defaults) {
      if (!fields.some((f) => f.key === sp.key)) {
        fields.push(withDraftFieldMeta(sp, item[sp.key] || ""));
      }
    }
  } else {
    for (const sp of schema.defaults) {
      fields.push(withDraftFieldMeta(sp, sp.sample || ""));
    }
  }

  const custom =
    item && item.kind === kind && Array.isArray(item.custom)
      ? item.custom.map((c, idx) => ({
          id: "cf-" + idx,
          name: c.name || "",
          value: c.value || "",
          hidden: !!c.hidden,
        }))
      : [];

  return {
    kind,
    editingId: item ? item.id : null,
    name: item
      ? item.name
      : {
          login: "新登录凭据",
          token: "新建 API 令牌",
          "ssh-key": "新建 SSH 密钥对",
          license: "新建软件许可证",
          card: "新建银行卡",
          identity: "新建个人身份",
          server: "新建服务器节点",
          note: "新建安全笔记",
        }[kind] || "新条目",
    folder: item ? item.folder : "工作",
    fields,
    custom,
  };
}

function getAvailableDefaultFields(kind, currentFields) {
  const schema = ITEM_KIND_SCHEMAS[kind] || ITEM_KIND_SCHEMAS.login;
  const allSpecs = [...schema.defaults, ...schema.optional];
  const activeKeys = new Set(currentFields.map((f) => f.key));
  return allSpecs.filter((sp) => !activeKeys.has(sp.key));
}

const R2_CONFIG = {
  endpoint: "https://8f1a4c2d90e7.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "lp-7f3a",
  accessKeyId: "demo-r2-ak-0001",
  secretMasked: "••••••••••••••••••••••••8e21",
  backupPassphrase: "amber-vault-9921-k7m2",
  corsJson: `[
  {
    "AllowedOrigins": ["chrome-extension://*", "http://localhost:*"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`,
};

const R2_RESTORE_PREVIEW = {
  anchorFile: "account.json",
  userId: "lp_usr_01J9X4M8Q2K7",
  emailHint: "alex@northwind.io",
  gen: 42,
  updatedAt: "2026-11-27 22:18",
  itemCount: 128,
  folderCount: 4,
  passkeySyncable: 0,
  localCount: 0,
  chunks: 3,
};

const PRF_KEYS = [
  {
    id: "prf-1",
    name: "YubiKey 5C NFC（USB-C）",
    added: "2026-09-14",
    lastUsed: "昨天 19:40",
    rpId: "chrome-extension://lp-local",
  },
  {
    id: "prf-2",
    name: "iCloud 平台安全密钥（本机 Chrome）",
    added: "2026-10-22",
    lastUsed: "刚刚",
    rpId: "chrome-extension://lp-local",
  },
];

const INITIAL_GEN_HISTORY = [
  {
    id: "gh-1",
    value: "N7$kQ2m!rT9@xL4wZ8p",
    meta: "20 位 · 随机密码 · 2 分钟前",
    length: 20,
    kind: "password",
  },
  {
    id: "gh-2",
    value: "R4#vK9x!pT2@mL7nQ5cB8wZ",
    meta: "24 位 · 随机密码 · 昨天 21:04",
    length: 24,
    kind: "password",
  },
  {
    id: "gh-3",
    value: "amber-ridge-cedar-flux-92",
    meta: "5 词短语 · 3 天前",
    length: 25,
    kind: "passphrase",
  },
  {
    id: "gh-4",
    value: "W6@mP3n!kL8$qR2v",
    meta: "16 位 · 随机密码 · 11-21",
    length: 16,
    kind: "password",
  },
];

const CHANGELOG_ENTRIES = [
  {
    ver: "2026.11.1",
    date: "2026-11-27",
    items: [
      "紧凑 4px 栅格工作台 + 极紧 30px 密度切换",
      "8 类条目支持默认字段与自定义字段动态增删",
      "网页内联完整接入银行卡、身份、保存确认与风险改密提示",
    ],
  },
  {
    ver: "2026.11.0",
    date: "2026-11-12",
    items: [
      "R2 同步 v2：手动同步 + 增量分片 + Ed25519 manifest 防回滚签名（自动同步为原型概念，产品未实现）",
      "并发冲突默认「两份都留」，支持并排比对",
      "Chrome 扩展新增桌面端触控 ID 原生消息代理",
    ],
  },
  {
    ver: "2026.10.2",
    date: "2026-10-20",
    items: [
      "原生 8 类条目存储模型（新增 SSH 私钥引用与服务器条目）",
      "ApiService 默认拒绝全部未授权出站请求",
    ],
  },
];

const KNOWN_LIMITS = [
  "Mac 触控 ID 仅桌面端可用；浏览器扩展原生支持 WebAuthn PRF，桌面联动需启用 com.localpass.desktop。",
  "R2 同步采用客户端 AES-256 加密镜像：Cloudflare R2 看不到条目名与密码，但能看到加密分片数量与修改时间戳。",
  "产品仅支持手动触发同步，原型中的自动同步开关为概念演示；安全体检完全离线，不实现 HIBP 或任何泄露查询。",
  "安全密码无法在本地或云端重置；遗忘后只能通过先前导出的加密备份或 R2 桶 + 原安全密码恢复。",
];

const DIAGNOSTIC_SAMPLE = `LocalPass 诊断报告（无敏感数据 · 仅供反馈粘贴）
版本：2026.11.1-compact-v4 | 平台：macOS 15.2 + Chrome MV3
保险库统计：128 条目（归档 3 / 回收站 3）· 4 文件夹
原生消息桥接：com.localpass.desktop（已连接 · 触控 ID 可用）
R2 同步：已配置（gen #42 · 待同步 0 · 未解决冲突 0）
网络闸门：默认拒绝未授权出站 · 当前允许 1 域名（R2）
注：本报告不含任何条目名称、网址、用户名、密码或密钥。`;
