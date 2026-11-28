/* ==========================================================================
   LocalPass · AGY Compact v4 — Mac Desktop Views (1200 x 760)
   Covers all 8 ItemKinds, Quick Access HUD, Menu Bar Tray, Version History,
   Archive, Trash, Folders, Watchtower Health, 1PUX Import/Dedup, R2 Sync,
   Conflict Resolution, Network Gate, Settings/Shortcuts/Diagnostics.
   ========================================================================== */

function searchItems(items, rawQuery, typeFilter = "all") {
  const q = (rawQuery || "").trim().toLowerCase();
  return items
    .filter((it) => {
      if (typeFilter === "login" && it.kind !== "login") return false;
      if (typeFilter === "card" && it.kind !== "card") return false;
      if (typeFilter === "other" && (it.kind === "login" || it.kind === "card")) return false;
      return true;
    })
    .map((it) => {
      if (!q) return { item: it, matchField: "", matchSnippet: "" };
      if (q === "=favorite")
        return it.favorite ? { item: it, matchField: "收藏", matchSnippet: "已星标" } : null;
      if (q === "=totp")
        return it.otp ? { item: it, matchField: "验证码", matchSnippet: it.otp } : null;
      if (q === "=passkey")
        return it.passkey
          ? { item: it, matchField: "通行密钥", matchSnippet: it.passkey.rp }
          : null;
      if (q === "=ssh")
        return it.kind === "ssh-key" || it.kind === "server"
          ? { item: it, matchField: "类型", matchSnippet: it.kindLabel }
          : null;

      if ((it.name || "").toLowerCase().includes(q))
        return { item: it, matchField: "名称", matchSnippet: "" };
      if ((it.user || "").toLowerCase().includes(q))
        return { item: it, matchField: "用户名", matchSnippet: "" };
      if ((it.host || "").toLowerCase().includes(q) || (it.host2 || "").toLowerCase().includes(q)) {
        return { item: it, matchField: "网址", matchSnippet: it.host || it.host2 };
      }
      if ((it.cardLast4 || "").includes(q))
        return { item: it, matchField: "卡号后四位", matchSnippet: "•••• " + it.cardLast4 };
      if ((it.folder || "").toLowerCase().includes(q))
        return { item: it, matchField: "文件夹", matchSnippet: it.folder };
      const cf = (it.custom || []).find((c) => (c.name + " " + c.value).toLowerCase().includes(q));
      if (cf)
        return {
          item: it,
          matchField: "自定义字段",
          matchSnippet: `${cf.name}: ${cf.hidden ? "••••" : cf.value}`,
        };
      if ((it.note || "").toLowerCase().includes(q)) {
        const idx = it.note.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 6);
        return {
          item: it,
          matchField: "备注",
          matchSnippet: (start > 0 ? "…" : "") + it.note.slice(start, idx + 18) + "…",
        };
      }
      return null;
    })
    .filter(Boolean);
}

/** Maps any of the 8 ItemKinds into structured detail sections matching item-fields.ts */
function getItemSections(item, revealedIds) {
  const isRev = (key) => revealedIds && revealedIds.has(`${item.id}:${key}`);
  const sections = [];

  if (item.kind === "login") {
    const rows = [
      {
        key: "user",
        label: "用户名",
        display: item.user || "—",
        copy: item.user || "",
        mono: false,
      },
      {
        key: "secret",
        label: "安全密码",
        display: isRev("secret") ? syntaxPw(item.secret) : "••••••••••••",
        copy: item.secret,
        mono: true,
        secret: true,
        revealed: isRev("secret"),
        historyBadge: item.versions ? `v${item.versions.length}` : "",
      },
    ];
    if (item.host) {
      rows.push({ key: "host", label: "主网址", display: item.host, copy: item.host, uri: true });
    }
    if (item.host2) {
      rows.push({
        key: "host2",
        label: "备用网址",
        display: item.host2,
        copy: item.host2,
        uri: true,
      });
    }
    sections.push({ title: "登录凭据", hint: "点按整行复制", rows });
  } else if (item.kind === "token") {
    sections.push({
      title: "API 令牌",
      hint: "借用密钥槽 · 独立字段",
      rows: [
        {
          key: "service",
          label: "所属服务",
          display: item.service || item.user || "—",
          copy: item.service || item.user || "",
        },
        item.accessKeyId
          ? {
              key: "ak",
              label: "Key ID",
              display: item.accessKeyId,
              copy: item.accessKeyId,
              mono: true,
            }
          : null,
        {
          key: "secret",
          label: "API 令牌",
          display: isRev("secret") ? syntaxPw(item.secret) : "demo-r2-tok-••••••••••••",
          copy: item.secret,
          mono: true,
          secret: true,
          revealed: isRev("secret"),
        },
        { key: "scope", label: "权限范围", display: item.scope || "—", copy: item.scope || "" },
        {
          key: "expires",
          label: "有效期",
          display: item.expires || "长期",
          copy: item.expires || "",
          mono: true,
        },
        { key: "env", label: "环境", display: item.env || "Production", copy: item.env || "" },
      ].filter(Boolean),
    });
  } else if (item.kind === "ssh-key") {
    sections.push({
      title: "SSH 密钥对",
      hint: "原生 SshKey · 可被服务器条目引用",
      rows: [
        {
          key: "algo",
          label: "算法长度",
          display: item.algorithm || "Ed25519 · 256-bit",
          copy: item.algorithm || "Ed25519",
        },
        { key: "fp", label: "公钥指纹", display: item.user, copy: item.user, mono: true },
        {
          key: "pub",
          label: "公钥正文",
          display: item.publicKey,
          copy: item.publicKey,
          mono: true,
          multiline: true,
        },
        {
          key: "secret",
          label: "私钥正文",
          display: isRev("secret")
            ? escapeHtml(item.secret)
            : "[OPENSSH PRIVATE KEY 合成示例]\n••••••••••••••••••••••••••••••",
          copy: item.secret,
          mono: true,
          secret: true,
          multiline: true,
          revealed: isRev("secret"),
        },
        item.passphrase
          ? {
              key: "passphrase",
              label: "保护口令",
              display: isRev("passphrase") ? syntaxPw(item.passphrase) : "••••••••••",
              copy: item.passphrase,
              mono: true,
              secret: true,
              revealed: isRev("passphrase"),
            }
          : null,
        item.hosts
          ? { key: "hosts", label: "适用主机", display: item.hosts, copy: item.hosts }
          : null,
      ].filter(Boolean),
    });
  } else if (item.kind === "server") {
    sections.push({
      title: "服务器连接",
      hint: "支持跨条目引用 SSH 私钥",
      rows: [
        {
          key: "hostIp",
          label: "主机地址",
          display: item.hostIp || item.host,
          copy: item.hostIp || item.host,
          mono: true,
        },
        item.port
          ? { key: "port", label: "连接端口", display: item.port, copy: item.port, mono: true }
          : null,
        {
          key: "proto",
          label: "协议",
          display: item.protocol || "SSH",
          copy: item.protocol || "SSH",
        },
        item.loginUser
          ? {
              key: "loginUser",
              label: "登录账号",
              display: item.loginUser,
              copy: item.loginUser,
              mono: true,
            }
          : null,
        {
          key: "secret",
          label: "登录口令",
          display: isRev("secret") ? syntaxPw(item.secret) : "••••••••••••",
          copy: item.secret,
          mono: true,
          secret: true,
          revealed: isRev("secret"),
        },
        {
          key: "sshRef",
          label: "认证方式",
          display: `引用 SSH 私钥 · ${item.linkedSshName || "未绑定"}`,
          copy: item.linkedSshName || "",
          linkId: item.linkedSshId,
        },
        {
          key: "sudo",
          label: "sudo 备注",
          display: item.sudoNote || "—",
          copy: item.sudoNote || "",
        },
        item.region
          ? {
              key: "region",
              label: "区域机房",
              display: item.region,
              copy: item.region,
              mono: true,
            }
          : null,
      ].filter(Boolean),
    });
  } else if (item.kind === "card") {
    sections.push({
      title: "银行卡信息",
      hint: "可在网页结账内联菜单一键填充",
      rows: [
        { key: "holder", label: "持卡人", display: item.cardholder, copy: item.cardholder },
        item.cardBrand
          ? { key: "brand", label: "卡组织/行", display: item.cardBrand, copy: item.cardBrand }
          : null,
        {
          key: "secret",
          label: "银行卡号",
          display: isRev("secret") ? item.cardNumber : `•••• •••• •••• ${item.cardLast4}`,
          copy: item.cardNumber,
          mono: true,
          secret: true,
          revealed: isRev("secret"),
        },
        {
          key: "exp",
          label: "有效期",
          display:
            item.expiry ||
            (item.expMonth ? `${item.expMonth}/${String(item.expYear || "").slice(-2)}` : "—"),
          copy:
            item.expiry ||
            (item.expMonth ? `${item.expMonth}/${String(item.expYear || "").slice(-2)}` : ""),
          mono: true,
        },
        {
          key: "cvv",
          label: "安全码",
          display: isRev("cvv") ? item.cardCode : "•••",
          copy: item.cardCode,
          mono: true,
          secret: true,
          revealed: isRev("cvv"),
        },
        item.pin
          ? {
              key: "pin",
              label: "交易 PIN",
              display: isRev("pin") ? item.pin : "••••",
              copy: item.pin,
              mono: true,
              secret: true,
              revealed: isRev("pin"),
            }
          : null,
        item.billingZip
          ? {
              key: "zip",
              label: "账单邮编",
              display: item.billingZip,
              copy: item.billingZip,
              mono: true,
            }
          : null,
      ].filter(Boolean),
    });
  } else if (item.kind === "identity") {
    sections.push({
      title: "个人身份与地址",
      hint: "支持网页地址表单一键填充",
      rows: [
        {
          key: "name",
          label: "姓名",
          display: `${item.lastName}${item.firstName}`,
          copy: `${item.lastName}${item.firstName}`,
        },
        item.idType
          ? { key: "idType", label: "证件类型", display: item.idType, copy: item.idType }
          : null,
        {
          key: "secret",
          label: "证件号",
          display: isRev("secret") ? item.idNumber : "•••••••••",
          copy: item.idNumber,
          mono: true,
          secret: true,
          revealed: isRev("secret"),
        },
        { key: "phone", label: "电话", display: item.phone, copy: item.phone, mono: true },
        { key: "email", label: "邮箱", display: item.email, copy: item.email },
        {
          key: "addr",
          label: "常用地址",
          display: item.address,
          copy: item.address,
          multiline: true,
        },
        item.postalCode
          ? {
              key: "postal",
              label: "邮政编码",
              display: item.postalCode,
              copy: item.postalCode,
              mono: true,
            }
          : null,
        item.company
          ? { key: "company", label: "所属公司", display: item.company, copy: item.company }
          : null,
      ].filter(Boolean),
    });
  } else if (item.kind === "license") {
    sections.push({
      title: "软件许可证",
      hint: "离线序列号",
      rows: [
        { key: "sw", label: "软件名称", display: item.software, copy: item.software },
        item.edition
          ? { key: "edition", label: "授权版本", display: item.edition, copy: item.edition }
          : null,
        {
          key: "secret",
          label: "序列号",
          display: isRev("secret") ? item.secret : "SKPRO-••••-••••-••••-90BC",
          copy: item.secret,
          mono: true,
          secret: true,
          revealed: isRev("secret"),
        },
        item.licensedEmail
          ? {
              key: "lemail",
              label: "授权邮箱",
              display: item.licensedEmail,
              copy: item.licensedEmail,
            }
          : null,
        { key: "seats", label: "席位/设备", display: item.seats, copy: item.seats },
        {
          key: "buy",
          label: "购买日期",
          display: item.purchased,
          copy: item.purchased,
          mono: true,
        },
        item.expires
          ? { key: "exp", label: "到期日期", display: item.expires, copy: item.expires }
          : null,
        item.orderId
          ? {
              key: "order",
              label: "订单编号",
              display: item.orderId,
              copy: item.orderId,
              mono: true,
            }
          : null,
      ].filter(Boolean),
    });
  } else if (item.kind === "note") {
    sections.push({
      title: "安全笔记内容",
      hint: "纯文本端到端加密 · 无多余登录字段",
      rows: [
        item.category
          ? { key: "cat", label: "笔记分类", display: item.category, copy: item.category }
          : null,
        {
          key: "noteBody",
          label: "加密正文",
          display: item.note,
          copy: item.note,
          multiline: true,
        },
        item.recoveryHint
          ? {
              key: "recHint",
              label: "介质提示",
              display: item.recoveryHint,
              copy: item.recoveryHint,
            }
          : null,
      ].filter(Boolean),
    });
  }

  return sections;
}

function macBar(state) {
  const dirtyBadge =
    state.dirtyCount > 0
      ? `<span class="chip warn tnum">待同步 ${state.dirtyCount}</span>`
      : `<span class="chip ok"><span class="dot"></span>${state.lastSyncText}</span>`;
  return `<div class="mac-bar">
    <div class="traffic" aria-hidden="true"><i></i><i></i><i></i></div>
    <button class="bar-pill" data-act="mac-nav" data-nav="sync" title="查看 R2 同步状态">${dirtyBadge}</button>
    <div class="title">LocalPass · macOS 保险库</div>
    <div class="bar-acts">
      <button class="bar-pill" data-act="open-qs" aria-label="打开应用内快速检索">
        ${icon("search", 12)}<span>快速检索</span><kbd>⌘K</kbd>
      </button>
      <button class="iconbtn" data-act="toggle-lock" aria-label="锁定保险库" title="锁定 (⌘L)">${icon("lock", 14)}</button>
      <button class="btn primary sm" data-act="mac-drawer" data-drawer="new">${icon("plus", 12)}新建 <span style="opacity:.75;font-size:9.5px">⌘N</span></button>
    </div>
  </div>`;
}

function macSide(state) {
  const active = state.macSub;
  const countAll = state.items.length;
  const countRecent = state.items.filter((i) => i.recent).length;
  return `<aside class="side lp" aria-label="主导航">
    <button class="lib" data-act="mac-nav" data-nav="vault">
      <span class="av sm av-blue" style="width:24px;height:24px;font-size:9.5px">LP</span>
      <span style="min-width:0;flex:1">
        <span class="name">我的保险库</span>
        <span class="state"><span class="dot ${state.dirtyCount ? "warn" : ""}"></span>${state.nativeBridgeOn ? "Chrome 已联动" : "本地主副本"}</span>
      </span>
      ${icon("chevrond", 13)}
    </button>
    <div class="side-scroll">
      <div class="sect">保险库</div>
      <button class="navrow ${active === "vault" ? "on" : ""}" data-act="mac-nav" data-nav="vault">${icon("grid", 14)}全部条目<span class="count">${countAll}</span></button>
      <button class="navrow ${active === "recent" ? "on" : ""}" data-act="mac-nav" data-nav="recent">${icon("clock", 14)}最近使用<span class="count">${countRecent}</span></button>
      <button class="navrow ${active === "health" ? "on" : ""}" data-act="mac-nav" data-nav="health">${icon("shield", 14)}安全体检<span class="count" style="color:var(--warning);font-weight:600">4</span></button>
      <button class="navrow ${active === "archive" ? "on" : ""}" data-act="mac-nav" data-nav="archive">${icon("archive", 14)}已归档<span class="count">${state.archived.length}</span></button>
      <button class="navrow ${active === "trash" ? "on" : ""}" data-act="mac-nav" data-nav="trash">${icon("trash", 14)}回收站<span class="count">${state.trash.length}</span></button>

      <div class="sect">文件夹 <button class="iconbtn sm" data-act="mac-nav" data-nav="folders" aria-label="管理文件夹">${icon("plus", 12)}</button></div>
      ${FOLDERS.map(
        (
          f,
        ) => `<button class="navrow ${active === "folders" && state.activeFolder === f.id ? "on" : ""}" data-act="mac-folder" data-folder="${f.id}">
        <span class="fdot" style="background:${f.color}"></span>${f.name}<span class="count">${f.count}</span>
      </button>`,
      ).join("")}

      <div class="sect">迁移与同步</div>
      <button class="navrow ${active === "generator" ? "on" : ""}" data-act="mac-nav" data-nav="generator">${icon("wand", 14)}生成器</button>
      <button class="navrow ${active === "import" ? "on" : ""}" data-act="mac-nav" data-nav="import">${icon("upload", 14)}导入<span class="count">1PUX/CSV</span></button>
      <button class="navrow ${active === "export" ? "on" : ""}" data-act="mac-nav" data-nav="export">${icon("download", 14)}导出</button>
      <button class="navrow ${active === "sync" ? "on" : ""}" data-act="mac-nav" data-nav="sync">${icon("cloud", 14)}R2 同步<span class="count">${state.dirtyCount ? "待传" : "正常"}</span></button>
    </div>
    <div class="side-foot">
      <button class="navrow ${active === "network" ? "on" : ""}" data-act="mac-nav" data-nav="network">${icon("wifi", 14)}网络闸门<span class="count">0 泄漏</span></button>
      <button class="navrow ${active === "settings" ? "on" : ""}" data-act="mac-nav" data-nav="settings">${icon("settings", 14)}设置 <span class="count">⌘,</span></button>
    </div>
  </aside>`;
}

function macList(state) {
  const baseItems = state.macSub === "recent" ? state.items.filter((i) => i.recent) : state.items;
  const matched = searchItems(baseItems, state.macQuery, state.macFilter);
  const filters = [
    ["all", "全部", baseItems.length],
    ["login", "登录", baseItems.filter((i) => i.kind === "login").length],
    ["card", "卡片", baseItems.filter((i) => i.kind === "card").length],
    ["other", "其他", baseItems.filter((i) => i.kind !== "login" && i.kind !== "card").length],
  ];

  const renderRow = (entry) => {
    const it = entry.item;
    const isSel = it.id === state.selected;
    const subText = entry.matchSnippet
      ? `${entry.matchField}: ${entry.matchSnippet}`
      : it.user || it.kindLabel;
    return `<div class="row ${isSel ? "on" : ""}" role="option" tabindex="0" aria-selected="${isSel}" data-act="select-item" data-id="${it.id}">
      ${AV(it)}
      <span class="txt">
        <span class="t">
          <span class="t-label">${escapeHtml(it.name)}</span>
          ${it.favorite ? `<span style="color:var(--warning);display:inline-flex">${icon("star", 10)}</span>` : ""}
          <span class="t-sub-inline">${escapeHtml(subText)}</span>
        </span>
        <span class="s">${entry.matchSnippet ? `<span class="match-snip">${escapeHtml(entry.matchField)}</span> ` : ""}${escapeHtml(subText)}</span>
      </span>
      <span class="meta">
        <span class="chip" style="height:16px;font-size:9px;padding:0 4px">${it.kindLabel}</span>
        <span class="hoveracts">
          <button class="iconbtn sm" aria-label="复制用户名" title="复制用户名 (⌘C)" data-act="copy" data-label="用户名" data-copy-key="${it.id}:user">${icon("user", 13)}</button>
          <button class="iconbtn sm" aria-label="复制密码" title="复制密码 (⇧⌘C)" data-act="copy" data-label="密码" data-copy-key="${it.id}:secret">${icon("key", 13)}</button>
        </span>
      </span>
    </div>`;
  };

  let bodyHtml = "";
  if (matched.length === 0) {
    bodyHtml = `<div style="text-align:center;padding:36px 14px;color:var(--text-3)">
      <div style="margin:0 auto 8px;width:32px;height:32px;border-radius:8px;background:var(--bg-alt);display:grid;place-items:center">${icon("search", 16)}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text)">没有匹配条目</div>
      <div style="font-size:10.5px;margin-top:3px">支持搜名称、用户名、网址、备注与自定义字段</div>
      <button class="btn sm" style="margin-top:9px" data-act="clear-mac-search">清除筛选</button>
    </div>`;
  } else if (state.macQuery.trim()) {
    bodyHtml =
      `<div class="grouphead">匹配结果 <span class="n">${matched.length}</span></div>` +
      matched.map(renderRow).join("");
  } else {
    const favs = matched.filter((m) => m.item.favorite);
    const others = matched.filter((m) => !m.item.favorite);
    if (favs.length) {
      bodyHtml +=
        `<div class="grouphead">收藏置顶 <span class="n">${favs.length}</span></div>` +
        favs.map(renderRow).join("");
    }
    bodyHtml +=
      `<div class="grouphead">全部条目 · 按最近使用 <span class="n">${others.length}</span></div>` +
      others.map(renderRow).join("");
  }

  return `<section class="listpane lp" aria-label="条目列表">
    <div class="listhead">
      <label class="search">
        ${icon("search", 13)}
        <input id="macSearchInput" value="${escapeHtml(state.macQuery)}" placeholder="全字段搜索 · =totp · =ssh" aria-label="全字段搜索保险库" autocomplete="off" />
        <span class="kbdrow"><kbd>⌘</kbd><kbd>K</kbd></span>
      </label>
      <div class="filters" role="tablist" aria-label="条目类型筛选">
        ${filters.map(([id, label, n]) => `<button role="tab" aria-selected="${state.macFilter === id}" class="${state.macFilter === id ? "on" : ""}" data-act="mac-filter" data-filter="${id}"><span>${label}</span><span class="n">${n}</span></button>`).join("")}
        <span class="spacer"></span>
        <button class="iconbtn sm" data-act="toggle-density" title="切换紧凑/极紧行高" aria-label="切换行高密度">${icon("layers", 13)}</button>
      </div>
    </div>
    <div class="rows" role="listbox" aria-label="保险库条目">${bodyHtml}</div>
  </section>`;
}

function macDetailView(state) {
  const item = state.items.find((i) => i.id === state.selected) || state.items[0];
  if (!item)
    return `<section class="detail"><div style="margin:auto;text-align:center;color:var(--text-3)">保险库为空</div></section>`;

  const sections = getItemSections(item, state.revealedIds);
  const copyFeedback = (key) =>
    state.copiedKey === `${item.id}:${key}`
      ? `<span class="copy-pill">✓ 已复制 · ${state.clipboard ? state.clipboard.secs : 30}s</span>`
      : "";

  const drawerHtml =
    state.macDrawer === "history"
      ? macHistoryDrawer(item)
      : state.macDrawer === "new"
        ? macFormDrawer(state, true)
        : state.macDrawer === "edit"
          ? macFormDrawer(state, false, item)
          : state.macDrawer === "qr"
            ? macQrDrawer(item)
            : "";

  return `<section class="detail lp" aria-label="条目详情">
    <header class="dhead">
      <span class="crumb">${escapeHtml(item.folder)} ${icon("chevron", 10)} <b>${escapeHtml(item.name)}</b></span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:2px">
        ${item.totpSecret ? `<button class="iconbtn" data-act="mac-drawer" data-drawer="qr" title="打开 Google 动态口令二维码" aria-label="显示 TOTP 二维码">${icon("qr", 14)}</button>` : ""}
        <button class="iconbtn" data-act="mac-drawer" data-drawer="history" title="版本历史 (${item.versions ? item.versions.length : 1})" aria-label="版本历史">${icon("clock", 14)}</button>
        <button class="iconbtn" data-act="archive-item" data-id="${item.id}" title="归档此条目" aria-label="归档此条目">${icon("archive", 14)}</button>
        <button class="iconbtn" data-act="trash-item" data-id="${item.id}" title="移到回收站 (⌘⌫)" aria-label="移到回收站">${icon("trash", 14)}</button>
      </span>
    </header>

    <div class="dbody">
      <div class="dmain">
        <div class="hero">
          ${AV(item, "xl")}
          <div style="min-width:0;flex:1">
            <div class="h1">${escapeHtml(item.name)}</div>
            <div class="h2">
              <span class="chip brand">${item.kindLabel}</span>
              ${item.passkey ? `<span class="chip ok">${icon("key", 10)}通行密钥</span>` : ""}
              ${item.isDefault ? `<span class="chip">默认填充项</span>` : ""}
              <span>修改于 ${item.updated}</span>
            </div>
          </div>
          <div class="acts">
            <button class="iconbtn ${item.favorite ? "star-on" : ""}" data-act="toggle-fav" data-id="${item.id}" title="${item.favorite ? "取消星标置顶" : "星标置顶"}" aria-label="切换星标收藏">${icon("star", 14)}</button>
            <button class="btn primary sm" data-act="mac-drawer" data-drawer="edit">${icon("pencil", 12)}编辑 <span style="opacity:.75;font-size:9.5px">⌘E</span></button>
          </div>
        </div>

        ${
          item.otp
            ? `<div class="otpcard ${state.copiedKey === `${item.id}:otp` ? "copied-flash" : ""}" role="button" tabindex="0" data-act="copy" data-label="验证码" data-copy-key="${item.id}:otp">
          <span class="ring" style="--p:.68"></span>
          <span>
            <span class="code">${item.otp}</span>
            <span class="lbl tnum"> · Google 动态口令 剩余 <span class="secs">20</span>s</span>
          </span>
          <span class="grow"></span>
          ${copyFeedback("otp")}
          <button class="btn sm" data-act="copy" data-label="验证码" data-copy-key="${item.id}:otp">${icon("copy", 12)}复制</button>
        </div>`
            : ""
        }

        ${sections
          .map(
            (sec) => `<div class="fgroup">
          <div class="flabel"><span>${sec.title}</span><span style="letter-spacing:0;text-transform:none;font-weight:400">${sec.hint}</span></div>
          <div class="fbox">
            ${sec.rows
              .map(
                (
                  r,
                ) => `<div class="field ${state.copiedKey === `${item.id}:${r.key}` ? "copied-flash" : ""}" ${r.multiline ? "" : `role="button" tabindex="0" data-act="copy" data-label="${escapeHtml(r.label)}" data-copy-key="${item.id}:${r.key}"`}>
              <span class="k">${escapeHtml(r.label)}</span>
              <span class="v ${r.mono ? "mono" : ""} ${r.multiline ? "multiline" : ""}">
                <span>${r.secret && r.revealed ? r.display : r.mono && r.revealed ? r.display : r.secret ? escapeHtml(r.display) : r.display}</span>
                ${copyFeedback(r.key)}
                ${r.secret && r.revealed ? `<span class="chip warn tnum">30s 后隐藏</span>` : ""}
              </span>
              <span class="a always">
                ${r.historyBadge ? `<button class="btn ghost sm" style="height:19px;font-size:9.5px;padding:0 5px" data-act="mac-drawer" data-drawer="history" title="查看密码历史">${r.historyBadge}</button>` : ""}
                ${r.linkId ? `<button class="btn ghost sm" style="height:19px;font-size:9.5px;padding:0 5px" data-act="select-item" data-id="${r.linkId}">打开私钥</button>` : ""}
                ${r.secret ? `<button class="iconbtn sm" data-act="reveal" data-rev-key="${item.id}:${r.key}" aria-label="显示或隐藏">${icon(r.revealed ? "eyeoff" : "eye", 13)}</button>` : ""}
                ${r.uri ? `<button class="iconbtn sm" data-act="open-url" data-label="${escapeHtml(r.copy)}" aria-label="打开网址">${icon("external", 13)}</button>` : ""}
                <button class="iconbtn sm" data-act="copy" data-label="${escapeHtml(r.label)}" data-copy-key="${item.id}:${r.key}" aria-label="复制${escapeHtml(r.label)}">${icon("copy", 13)}</button>
              </span>
            </div>`,
              )
              .join("")}
          </div>
        </div>`,
          )
          .join("")}

        ${
          item.passkey
            ? `<div class="fgroup">
          <div class="flabel"><span>通行密钥</span></div>
          <div class="fbox">
            <div class="field">
              <span class="k">依赖方</span>
              <span class="v">${icon("key", 13)} ${escapeHtml(item.passkey.rp)} · ${escapeHtml(item.passkey.user)}</span>
              <span class="a always"><span class="chip">本机保存 · ${item.passkey.date}</span></span>
            </div>
          </div>
        </div>`
            : ""
        }

        ${
          item.custom && item.custom.length
            ? `<div class="fgroup">
          <div class="flabel"><span>自定义字段</span><span style="letter-spacing:0;text-transform:none;font-weight:400">参与全字段搜索</span></div>
          <div class="fbox">
            ${item.custom
              .map((cf, idx) => {
                const rev = state.revealedIds && state.revealedIds.has(`${item.id}:cf_${idx}`);
                return `<div class="field ${state.copiedKey === `${item.id}:cf_${idx}` ? "copied-flash" : ""}" role="button" tabindex="0" data-act="copy" data-label="${escapeHtml(cf.name)}" data-copy-key="${item.id}:cf_${idx}">
                <span class="k">${escapeHtml(cf.name)}</span>
                <span class="v ${cf.hidden ? "mono" : ""}">${cf.hidden && !rev ? "••••••••••••" : escapeHtml(cf.value)} ${copyFeedback(`cf_${idx}`)}</span>
                <span class="a always">
                  ${cf.hidden ? `<button class="iconbtn sm" data-act="reveal" data-rev-key="${item.id}:cf_${idx}" aria-label="显示">${icon(rev ? "eyeoff" : "eye", 13)}</button>` : ""}
                  <button class="iconbtn sm" data-act="copy" data-label="${escapeHtml(cf.name)}" data-copy-key="${item.id}:cf_${idx}" aria-label="复制">${icon("copy", 13)}</button>
                </span>
              </div>`;
              })
              .join("")}
          </div>
        </div>`
            : ""
        }

        ${
          item.note && item.kind !== "note"
            ? `<div class="fgroup">
          <div class="flabel"><span>备注</span></div>
          <div class="notecard">${escapeHtml(item.note)}</div>
        </div>`
            : ""
        }
      </div>

      <aside class="inspector" aria-label="条目检查器">
        <h5>安全评估</h5>
        <div class="score">
          <span class="bars">
            ${[1, 2, 3, 4].map((n) => `<i class="${n <= (item.strength?.score || 4) ? ((item.strength?.score || 4) <= 2 ? "warn" : "on") : ""}"></i>`).join("")}
          </span>
          <span>${item.strength?.label || "强"}</span>
        </div>
        <div class="meta-row" style="margin-top:5px"><span class="k">重复检查</span><span class="v">${item.strength?.reuse || "未重复"}</span></div>
        <div class="meta-row"><span class="k">泄露检查</span><span class="v">${state.hibpOn ? item.strength?.breach || "未发现" : "离线未查询"}</span></div>

        <div class="divider"></div>
        <h5>版本历史</h5>
        <div class="hist">
          ${(item.versions || [])
            .slice(0, 3)
            .map(
              (v) => `<button data-act="mac-drawer" data-drawer="history">
            ${icon("clock", 12)}<span>v${v.ver}${v.current ? " 当前" : ""}</span><span class="when">${v.when}</span>
          </button>`,
            )
            .join("")}
        </div>

        <div class="divider"></div>
        <h5>元信息</h5>
        <div class="meta-row"><span class="k">类型</span><span class="v">${item.kindLabel}</span></div>
        <div class="meta-row"><span class="k">文件夹</span><span class="v">${item.folder}</span></div>
        <div class="meta-row"><span class="k">创建</span><span class="v">${item.created}</span></div>
        <div class="meta-row"><span class="k">修改</span><span class="v">${item.updated}</span></div>
      </aside>
    </div>

    <footer class="dfoot">
      <span class="tnum">${state.items.length} 条目</span>
      <span>·</span>
      <span>${state.clipboard ? `剪贴板 ${state.clipboard.secs}s 后清除` : "本机加密存储 · 0 出站"}</span>
      ${state.clipboard ? `<button class="t-act" style="color:var(--brand);font-weight:600" data-act="clear-clip">立即清除</button>` : ""}
      <span class="right">
        <span class="kbdrow"><kbd>↑↓</kbd>切换</span>
        <span class="kbdrow"><kbd>⌘C</kbd>用户名</span>
        <span class="kbdrow"><kbd>⇧⌘C</kbd>密码</span>
        <span class="kbdrow"><kbd>⌘E</kbd>编辑</span>
        <span class="kbdrow"><kbd>⌫</kbd>归档</span>
      </span>
    </footer>
    ${drawerHtml}
  </section>`;
}

function macHistoryDrawer(item) {
  const vers = item.versions || [];
  return `<aside class="drawer lp" role="dialog" aria-modal="true" aria-label="版本历史">
    <div class="drawer-h">${icon("clock", 14)}版本历史 <span class="sub">${escapeHtml(item.name)}</span>
      <button class="iconbtn sm" style="margin-left:auto" data-act="mac-drawer" data-drawer="" aria-label="关闭">${icon("x", 14)}</button>
    </div>
    <div class="drawer-b">
      ${vers
        .map(
          (v) => `<div class="ver ${v.current ? "cur" : ""}">
        <div class="top">
          ${v.current ? icon("check", 12) : icon("clock", 12)}
          <span>版本 v${v.ver} ${v.current ? "· 当前" : ""}</span>
          <span class="when">${v.when}</span>
        </div>
        <div class="diff"><span>${v.device}</span><span>·</span><span>${v.summary}</span></div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:2px;font-size:10.5px">
          <span class="mono" style="color:var(--text-2);flex:1;overflow:hidden;text-overflow:ellipsis">••••••••••••</span>
          <button class="btn sm" data-act="copy" data-label="历史密码 v${v.ver}" data-copy-val="${escapeHtml(v.secret || "")}">${icon("copy", 11)}复制</button>
          ${!v.current ? `<button class="btn sm primary" data-act="restore-ver" data-ver="${v.ver}">恢复此版</button>` : ""}
        </div>
      </div>`,
        )
        .join("")}
    </div>
    <div class="drawer-f">保留最近 10 个版本 · 恢复前自动快照当前版本</div>
  </aside>`;
}

function macQrDrawer(item) {
  return `<aside class="drawer lp" role="dialog" aria-modal="true" aria-label="动态口令二维码">
    <div class="drawer-h">${icon("qr", 14)}验证码二维码 <span class="sub">${escapeHtml(item.name)}</span>
      <button class="iconbtn sm" style="margin-left:auto" data-act="mac-drawer" data-drawer="" aria-label="关闭">${icon("x", 14)}</button>
    </div>
    <div class="drawer-b" style="text-align:center;padding-top:18px">
      <div style="display:inline-block;padding:12px;border-radius:10px;border:1px solid var(--border);background:#fff;color:#0f172a">
        ${svgQrMatrix(136)}
      </div>
      <div style="margin-top:10px;font-size:12px;font-weight:600">${escapeHtml(item.name)}</div>
      <div style="font-size:10.5px;color:var(--text-3);margin-top:2px">${escapeHtml(item.user)}</div>
      <div class="mono" style="margin-top:10px;padding:7px 9px;border-radius:6px;background:var(--bg-alt);border:1px solid var(--border-light);font-size:10.5px">••••••••••••••••</div>
      <button class="btn block" style="margin-top:9px" data-act="copy" data-label="TOTP 密钥" data-copy-val="${escapeHtml(item.totpSecret || "JBSW Y3DP EHPK 3PXP")}">${icon("copy", 12)}复制 Base32 密钥</button>
    </div>
    <div class="drawer-f">本地 Canvas 渲染，不请求任何外部二维码接口</div>
  </aside>`;
}

function renderDynamicFormFields(state, compactExt = false) {
  const draft = state.formDraft || buildFormDraft(state.newKind || "login");
  const kindMeta = ITEM_KINDS.find((k) => k.id === draft.kind) || ITEM_KINDS[0];
  const available = getAvailableDefaultFields(draft.kind, draft.fields);
  const sshChoices = state.items.filter((i) => i.kind === "ssh-key").map((i) => i.name);

  return `
    <div class="seclbl">名称与归属</div>
    <div class="grp">
      <div class="frow">
        <div class="lb">${draft.kind === "note" ? "标题" : "名称"}</div>
        <div class="iv"><input data-form-name value="${escapeHtml(draft.name || "")}" placeholder="条目名称" /></div>
        <span></span>
      </div>
      <div class="frow">
        <div class="lb">文件夹</div>
        <div class="iv">
          <select class="lp-select" data-form-folder aria-label="选择文件夹">
            ${FOLDERS.map((fl) => `<option value="${escapeHtml(fl.name)}" ${(draft.folder || "工作") === fl.name ? "selected" : ""}>${escapeHtml(fl.name)}</option>`).join("")}
          </select>
        </div>
        <span></span>
      </div>
    </div>

    <div class="seclbl" style="display:flex;align-items:center;justify-content:space-between">
      <span>${kindMeta.label} · 默认字段</span>
      <span style="letter-spacing:0;text-transform:none;font-weight:400;color:var(--text-3)">点击右侧 × 可删除</span>
    </div>
    <div class="grp">
      ${
        draft.fields.length === 0
          ? `<div class="prow"><div class="s">已移除全部默认字段，可点击下方胶囊重新添加</div></div>`
          : draft.fields
              .map((f) => {
                const isMasked =
                  f.secret && !(state.revealedIds && state.revealedIds.has(`draft:${f.key}`));
                const hasOpts = Array.isArray(f.options) && f.options.length > 0;
                let controlHtml = "";
                if (f.multiline) {
                  controlHtml = `<textarea class="${f.mono ? "mono" : ""}" data-df-key="${f.key}" placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(f.value || "")}</textarea>`;
                } else if (f.key === "linkedSshName") {
                  const sshOpts = ["未绑定", ...sshChoices];
                  controlHtml = `<select class="lp-select mono" data-df-select="linkedSshName" aria-label="关联 SSH 密钥">
              ${sshOpts.map((opt) => `<option value="${escapeHtml(opt)}" ${(f.value || "未绑定") === opt ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}
            </select>`;
                } else if (hasOpts && !f.customMode) {
                  const curVal = f.value || "";
                  controlHtml = `<select class="lp-select ${f.mono ? "mono" : ""}" data-df-select="${f.key}" aria-label="${escapeHtml(f.label)}">
              ${!curVal ? `<option value="" selected>请选择${escapeHtml(f.label)}…</option>` : ""}
              ${f.options.map((opt) => `<option value="${escapeHtml(opt)}" ${curVal === opt ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}
              ${f.allowCustom !== false ? `<option value="__custom__">自定义其他…</option>` : ""}
            </select>`;
                } else {
                  controlHtml = `<input class="${f.mono ? "mono" : ""}" type="${isMasked ? "password" : "text"}" data-df-key="${f.key}" ${f.maxLength ? `maxlength="${f.maxLength}"` : ""} ${f.inputMode ? `inputmode="${f.inputMode}"` : ""} value="${escapeHtml(f.value || "")}" placeholder="${escapeHtml(f.placeholder || "")}" />
              ${hasOpts ? `<button class="preset-back" data-act="form-use-preset" data-fkey="${f.key}" title="返回预设下拉选项">预设 ▾</button>` : ""}`;
                }
                return `<div class="frow">
            <div class="lb">${escapeHtml(f.label)}</div>
            <div class="iv">
              ${controlHtml}
              ${f.secret ? `<button class="iconbtn sm" data-act="reveal" data-rev-key="draft:${f.key}" title="显示/隐藏" aria-label="切换明文">${icon(isMasked ? "eye" : "eyeoff", 12)}</button>` : ""}
              ${f.generate ? `<button class="iconbtn sm" data-act="gen-pw-draft" data-fkey="${f.key}" title="生成 20 位强密码">${icon("wand", 12)}</button>` : ""}
            </div>
            <button class="iconbtn sm fdel" data-act="form-del-field" data-fkey="${f.key}" title="移除默认字段：${escapeHtml(f.label)}" aria-label="删除字段${escapeHtml(f.label)}">${icon("x", 12)}</button>
          </div>`;
              })
              .join("")
      }
    </div>
    ${
      available.length
        ? `<div class="add-pills">
      <span style="font-size:9.5px;color:var(--text-4);align-self:center">${compactExt ? "添加默认:" : "添加更多默认字段:"}</span>
      ${available.map((sp) => `<button class="add-pill" data-act="form-add-field" data-fkey="${sp.key}">+ ${escapeHtml(sp.label)}</button>`).join("")}
    </div>`
        : ""
    }

    <div class="seclbl" style="display:flex;align-items:center;justify-content:space-between">
      <span>自定义字段 (${draft.custom.length})</span>
      <button style="color:var(--brand);font-weight:600;text-transform:none;letter-spacing:0" data-act="form-add-custom">+ 添加自定义字段</button>
    </div>
    <div class="grp">
      ${
        draft.custom.length === 0
          ? `<div class="frow"><div class="lb">暂无</div><div class="iv" style="color:var(--text-3)">点击右上角「+ 添加自定义字段」</div><span></span></div>`
          : draft.custom
              .map(
                (cf, idx) => `<div class="cfield-row">
          <input class="cname" data-cf-idx="${idx}" data-cf-prop="name" value="${escapeHtml(cf.name)}" placeholder="字段名" aria-label="自定义字段名称" />
          <input type="${cf.hidden ? "password" : "text"}" data-cf-idx="${idx}" data-cf-prop="value" value="${escapeHtml(cf.value)}" placeholder="字段值" aria-label="自定义字段值" />
          <span style="display:flex;align-items:center;gap:1px">
            <button class="iconbtn sm" data-act="form-toggle-custom-hidden" data-idx="${idx}" title="${cf.hidden ? "取消隐私掩码" : "开启隐私掩码"}" aria-label="切换隐私掩码">${icon(cf.hidden ? "lock" : "eye", 12)}</button>
            <button class="iconbtn sm fdel" data-act="form-del-custom" data-idx="${idx}" title="删除自定义字段" aria-label="删除自定义字段">${icon("x", 12)}</button>
          </span>
        </div>`,
              )
              .join("")
      }
    </div>`;
}

function macFormDrawer(state, isNew, item) {
  const draft =
    state.formDraft || buildFormDraft(isNew ? state.newKind : item.kind, isNew ? null : item);
  const kind = draft.kind;
  return `<aside class="drawer lp" role="dialog" aria-modal="true" aria-label="${isNew ? "新建条目" : "编辑条目"}">
    <div class="drawer-h">${icon(isNew ? "plus" : "pencil", 14)}${isNew ? "新建条目" : "编辑条目"}
      <span class="sub">${isNew ? "8 类定制字段表单" : escapeHtml(draft.name || item.name)}</span>
      <button class="iconbtn sm" style="margin-left:auto" data-act="mac-drawer" data-drawer="" aria-label="关闭">${icon("x", 14)}</button>
    </div>
    <div class="drawer-b">
      ${
        isNew
          ? `<div class="seclbl">选择条目类型（每种字段各异）</div>
      <div class="typegrid">
        ${ITEM_KINDS.map((k) => `<button class="${kind === k.id ? "on" : ""}" data-act="pick-kind" data-kind="${k.id}">${icon(k.icon, 15)}<span>${k.label}</span></button>`).join("")}
      </div>`
          : `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        ${AV(item, "sm")}
        <span class="chip brand">${item.kindLabel}</span>
        <span class="chip">v${item.versions ? item.versions.length : 1} 将递增</span>
        <span style="margin-left:auto;font-size:9.5px;color:var(--text-3)">ID: ${item.id}</span>
      </div>`
      }
      ${renderDynamicFormFields(state, false)}
      <div class="seclbl">附加选项</div>
      <div class="grp">
        <div class="setrow"><div><div class="k">查看敏感值重提示</div><div class="d">需再输入安全密码或触控 ID</div></div><div class="right"><span class="toggle ${state.macReprompt ? "" : "off"}" role="switch" aria-checked="${state.macReprompt}" data-act="toggle-reprompt"></span></div></div>
      </div>
    </div>
    <div class="drawer-f" style="gap:6px">
      ${!isNew ? `<button class="btn danger sm" data-act="go-screen" data-surface="mac" data-screen="mac-item-delete" title="查看删除确认">删除</button>` : ""}
      <button class="btn primary" style="flex:1" data-act="save-mac-form">${isNew ? "保存到本机" : "保存更新"} <span style="opacity:.75;font-size:9.5px">⌘↵</span></button>
      <button class="btn" data-act="mac-drawer" data-drawer="">取消</button>
    </div>
  </aside>`;
}

function macQuickAccessModal(state) {
  const results = searchItems(state.items, state.qsQuery || "north", "all");
  const activeIdx = Math.min(state.qsIndex, Math.max(0, results.length - 1));
  return `<div class="overlay lp" data-act="close-qs">
    <div class="qs" role="dialog" aria-label="应用内快速检索" onclick="event.stopPropagation()">
      <div class="qs-in">
        ${icon("search", 15)}
        <input id="qsInput" value="${escapeHtml(state.qsQuery)}" placeholder="全库检索：名称、用户名、网址、备注、卡号后四位…" aria-label="应用内快速检索" />
        <span class="chip brand">全字段索引</span>
        <kbd>esc</kbd>
      </div>
      <div class="qs-body">
        <div class="qs-sect">当前前台推荐 · northwind.io · ${results.length} 条命中</div>
        ${results
          .map(
            (
              r,
              i,
            ) => `<button class="qs-row ${i === activeIdx ? "on" : ""}" data-act="qs-pick" data-id="${r.item.id}">
          ${AV(r.item)}
          <span style="min-width:0">
            <span class="t">${escapeHtml(r.item.name)}</span>
            <span class="s">${escapeHtml(r.item.user || r.item.kindLabel)}</span>
          </span>
          <span class="m">
            ${r.matchField ? `<span class="chip warn">命中${r.matchField}</span>` : ""}
            <span class="chip">${r.item.kindLabel}</span>
            <span class="chip">${r.item.folder}</span>
          </span>
        </button>`,
          )
          .join("")}
        <div class="qs-sect">快捷动作</div>
        <button class="qs-row" data-act="copy" data-label="新生成 20 位密码">${icon("wand", 14)}<span class="t">生成 20 位强密码并复制到剪贴板</span><span class="m"><kbd>⌘G</kbd></span></button>
      </div>
      <div class="qs-foot kbdrow">
        <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
        <span><kbd>↵</kbd> 打开详情</span>
        <span><kbd>⌘C</kbd> 用户名</span>
        <span><kbd>⇧⌘C</kbd> 密码</span>
        <span style="margin-left:auto">仅应用内生效 · 无全局热键监听</span>
      </div>
    </div>
  </div>`;
}

function macHealthPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>安全体检</h1><p>全部本地计算，密码明文永不离开设备。<span class="chip ok">${icon("shield", 10)} 离线规则已开启</span></p></div>
      <div class="right"><button class="btn sm" data-act="toast-msg" data-msg="已重新扫描 ${state.items.length} 个本地条目">重新扫描</button></div>
    </div>
    <div class="stats">
      <div class="stat bad"><div class="n">1</div><div class="l">重复使用密码</div></div>
      <div class="stat warn"><div class="n">2</div><div class="l">弱密码 / 超 365 天</div></div>
      <div class="stat"><div class="n">1</div><div class="l">未配置 2FA</div></div>
      <div class="stat ok"><div class="n">${Math.max(0, state.items.length - 3)}</div><div class="l">强密码条目</div></div>
    </div>
    <div class="panel">
      <div class="panel-h">优先处理项 <span class="sub">按风险影响排序 · 直达编辑页</span></div>
      ${HEALTH_ISSUES.map(
        (iss) => `<div class="prow">
        <span class="chip ${iss.tone}">${iss.tag}</span>
        <div style="min-width:0"><div class="t">${iss.title}</div><div class="s">${iss.sub}</div></div>
        <div class="right"><button class="btn sm primary" data-act="fix-health" data-id="${iss.id}">${iss.action}</button></div>
      </div>`,
      ).join("")}
    </div>
    <div class="panel">
      <div class="panel-h">隐私边界</div>
      <div class="setrow">
        <div><div class="k">HIBP 泄露前缀比对（可选联网）</div><div class="d">默认关闭 · 仅手动开启时向 api.pwnedpasswords.com 发送密码 SHA-1 前 5 位</div></div>
        <div class="right"><span class="toggle ${state.hibpOn ? "" : "off"}" role="switch" aria-checked="${state.hibpOn}" data-act="toggle-hibp"></span></div>
      </div>
    </div>
  </section>`;
}

function macArchivePage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>已归档条目</h1><p>归档 = 收起来，不参与默认检索与内联推荐，但保留在库内与 R2 快照中（区别于回收站）。</p></div>
    </div>
    <div class="panel">
      <div class="panel-h">已归档 <span class="sub">${state.archived.length} 条 · 永不自动清理</span></div>
      ${state.archived
        .map(
          (a) => `<div class="prow">
        ${AV(a)}
        <div><div class="t">${escapeHtml(a.name)}</div><div class="s">${escapeHtml(a.user)} · ${a.kind} · 归档于 ${a.archivedAt}</div></div>
        <div class="right">
          <button class="btn sm" data-act="unarchive" data-id="${a.id}">取消归档</button>
        </div>
      </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

function macTrashPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>回收站</h1><p>删除默认软删除进回收站，30 天后本机自动清理；清空不影响远端历史旧快照。</p></div>
      <div class="right"><button class="btn sm danger" data-act="toast-msg" data-msg="已弹出二次确认：清空将移除全部回收站条目">清空回收站</button></div>
    </div>
    <div class="panel">
      <div class="panel-h">待清理条目 <span class="sub">${state.trash.length} 条</span></div>
      ${state.trash
        .map(
          (t) => `<div class="prow">
        ${AV(t)}
        <div><div class="t">${escapeHtml(t.name)}</div><div class="s">${escapeHtml(t.user)} · 原文件夹 ${t.folder} · 删除于 ${t.deletedAt}</div></div>
        <div class="right">
          <span class="chip warn tnum">${t.remain}</span>
          <button class="btn sm primary" data-act="restore-trash" data-id="${t.id}">恢复</button>
        </div>
      </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

function macFoldersPage(state) {
  const f = FOLDERS.find((x) => x.id === state.activeFolder) || FOLDERS[0];
  const inside = state.items.filter((i) => i.folderId === f.id);
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>文件夹：${f.name}</h1><p>文件夹只做视觉分组，删除文件夹不会删除条目（条目回到未分组）。</p></div>
      <div class="right"><button class="btn sm primary" data-act="mac-drawer" data-drawer="new">${icon("plus", 12)}在文件夹中新建</button></div>
    </div>
    <div class="stats" style="grid-template-columns:repeat(4,1fr)">
      ${FOLDERS.map(
        (
          fl,
        ) => `<button class="stat" style="text-align:left;border-color:${fl.id === f.id ? "var(--brand)" : "var(--border)"}" data-act="mac-folder" data-folder="${fl.id}">
        <div class="n" style="font-size:15px">${fl.count}</div><div class="l">${fl.name}</div>
      </button>`,
      ).join("")}
    </div>
    <div class="panel">
      <div class="panel-h">${f.name} · 示例条目 <span class="sub">${inside.length} 条已载入</span></div>
      ${inside
        .map(
          (
            it,
          ) => `<div class="prow" style="cursor:pointer" data-act="open-from-sub" data-id="${it.id}">
        ${AV(it)}
        <div><div class="t">${escapeHtml(it.name)}</div><div class="s">${escapeHtml(it.user || it.kindLabel)}</div></div>
        <div class="right"><span class="chip">${it.kindLabel}</span><span style="font-size:10px;color:var(--text-3)">${it.updated}</span></div>
      </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

function macGeneratorPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>密码生成器</h1><p>纯本机 WebCrypto 生成。生成历史不写入磁盘也不参与同步，锁定即清空。</p></div>
      <div class="right">
        <button class="btn sm" data-act="gen-pw">${icon("refresh", 12)}重新生成 ⌘R</button>
        <button class="btn sm primary" data-act="copy" data-label="生成密码" data-copy-val="${escapeHtml(state.genValue)}">${icon("copy", 12)}复制</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:10px;margin-top:10px">
      <div>
        <div class="gen-out">
          <div class="segtabs" style="margin-bottom:8px">
            <button class="${state.genMode === "password" ? "on" : ""}" data-act="gen-mode" data-mode="password">随机密码</button>
            <button class="${state.genMode === "passphrase" ? "on" : ""}" data-act="gen-mode" data-mode="passphrase">易记密码短语</button>
          </div>
          <div class="gen-pw">${syntaxPw(state.genValue)}</div>
          <div class="strength"><span class="bars"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></span><span class="txt">强 · ${state.genMode === "password" ? state.genLen + " 位" : "5 个词"}</span><span style="margin-left:auto;font-size:10px;color:var(--text-3)">数字蓝 / 符号绿区分易混淆字符</span></div>
        </div>
        <div class="panel">
          <div class="panel-h">字符规则</div>
          <div class="setrow"><div><div class="k">长度</div><div class="d">推荐 16–24 位</div></div><div class="right"><span class="tnum" style="font-weight:600">${state.genLen} 位</span></div></div>
          <div class="setrow"><div><div class="k">排除易混淆字符</div><div class="d">移除 l / 1 / I / O / 0</div></div><div class="right"><span class="toggle" role="switch" aria-checked="true"></span></div></div>
          <div class="setrow"><div><div class="k">复制后 30 秒清空剪贴板</div></div><div class="right"><span class="toggle" role="switch" aria-checked="true"></span></div></div>
        </div>
      </div>
      <div class="panel" style="margin-top:0">
        <div class="panel-h">本机生成历史 <span class="sub">锁定后自动清空</span>
          <span class="right"><button class="btn sm ghost" data-act="go-screen" data-surface="mac" data-screen="mac-generator-history">完整历史 →</button></span>
        </div>
        ${state.genHistory
          .slice(0, 3)
          .map(
            (g) => `<div class="prow">
          <div style="min-width:0;flex:1"><div class="t mono">${state.genHistoryRevealed.has(g.id) ? syntaxPw(g.value) : "••••••••••••••••"}</div><div class="s">${g.meta}</div></div>
          <div class="right"><button class="iconbtn sm" data-act="copy" data-label="历史密码" data-copy-val="${escapeHtml(g.value)}">${icon("copy", 12)}</button></div>
        </div>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function macGeneratorHistoryPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>生成器历史记录</h1><p>历史仅保存在当前解锁会话内存中，不写入磁盘也不同步到 R2；锁库后立即清空。</p></div>
      <div class="right">
        <button class="btn sm" data-act="mac-nav" data-nav="generator">${icon("back", 12)}返回生成器</button>
        <button class="btn sm danger" data-act="clear-gen-history">清空历史</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h">最近生成（${state.genHistory.length} / 20 上限）<span class="right"><span class="chip ok">锁库即焚 · 0 写盘</span></span></div>
      ${
        state.genHistory.length === 0
          ? `<div style="text-align:center;padding:30px 14px;color:var(--text-3)">生成历史已清空。返回生成器生成新密码会自动记录于本机内存。</div>`
          : state.genHistory
              .map((g) => {
                const rev = state.genHistoryRevealed.has(g.id);
                return `<div class="prow">
            <div style="min-width:0;flex:1">
              <div class="t mono">${rev ? syntaxPw(g.value) : "•".repeat(Math.min(20, g.length))}</div>
              <div class="s">${g.meta}</div>
            </div>
            <div class="right">
              <button class="iconbtn sm" data-act="reveal-gen" data-id="${g.id}" aria-label="显示或隐藏">${icon(rev ? "eyeoff" : "eye", 13)}</button>
              <button class="btn sm" data-act="copy" data-label="历史生成值" data-copy-val="${escapeHtml(g.value)}">${icon("copy", 11)}复制</button>
            </div>
          </div>`;
              })
              .join("")
      }
    </div>
  </section>`;
}

function macImportPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>多源导入（选择文件与格式）</h1><p>已接出 1Password (.1pux/.1pif/.csv)、Bitwarden、Google 认证器与通用 CSV，全部本机解析并去重。</p></div>
      <div class="right"><button class="btn sm primary" data-act="go-screen" data-surface="mac" data-screen="mac-import-preview">${icon("upload", 12)}导入并去重预览 →</button></div>
    </div>
    <div class="stepbar">
      <div class="step on"><span>1 · 选择来源与文件</span></div>
      <div class="step"><span>2 · 去重预览与冲突策略</span></div>
      <div class="step"><span>3 · 加密写入本机库</span></div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 316px;gap:10px;margin-top:10px">
      <div class="panel" style="margin-top:0">
        <div class="panel-h">选择导入来源</div>
        ${IMPORT_SOURCES.map(
          (
            src,
          ) => `<div role="button" tabindex="0" class="prow" style="cursor:pointer;padding:7px 10px;background:${state.importSource === src.id ? "var(--brand-softer)" : ""}" data-act="pick-import" data-src="${src.id}">
          <div style="min-width:0;flex:1"><div class="t">${src.name}</div><div class="s" style="white-space:normal;line-height:1.35">${src.sub}</div></div>
          <span class="chip ${src.id === state.importSource ? "brand" : ""}" style="flex:none">${src.badge}</span>
        </div>`,
        ).join("")}
      </div>
      <div>
        <div class="panel" style="margin-top:0">
          <div class="panel-h">文件与口令准备</div>
          <div style="padding:10px;display:grid;gap:8px">
            <div style="border:1.5px dashed var(--border-strong);border-radius:7px;padding:18px 12px;text-align:center;background:var(--bg-alt)">
              <div style="display:inline-grid;place-items:center;width:30px;height:30px;border-radius:7px;background:var(--brand-soft);color:var(--brand);margin-bottom:6px">${icon("upload", 15)}</div>
              <div style="font-size:11.5px;font-weight:600">选择或拖入导出文件</div>
              <div style="font-size:10px;color:var(--text-3);margin-top:2px">示例：northwind-export-2026.1pux (48 条)</div>
              <button class="btn sm primary" style="margin-top:8px" data-act="go-screen" data-surface="mac" data-screen="mac-import-preview">载入示例并预览 →</button>
            </div>
            ${state.importSource === "lpjson" ? `<div class="frow" style="border:1px solid var(--border);border-radius:6px"><div class="lb">备份口令</div><div class="iv"><input type="password" value="amber-vault-9921-k7m2" /></div></div>` : ""}
          </div>
        </div>
        <div class="callout">${icon("shield", 14)}<div>全部解析在本机内存中完成；确认导入前不会修改现有 <span class="mono">data.json</span>。</div></div>
      </div>
    </div>
  </section>`;
}

function macImportPreviewPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>导入去重预览</h1><p>按「名称 + 用户名 + 主 URI」三元组本机比对去重，无法识别行单独标注而不阻断导入。</p></div>
      <div class="right">
        <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-import">← 重选文件</button>
        <button class="btn sm primary" data-act="toast-msg" data-msg="已导入 2 条新增条目，跳过 1 条重复（写入待同步队列）">确认导入 2 条</button>
      </div>
    </div>
    <div class="stepbar">
      <div class="step done">${icon("check", 11)}<span>1 · 已解析 .1pux (48 条示例)</span></div>
      <div class="step on"><span>2 · 去重预览与冲突策略</span></div>
      <div class="step"><span>3 · 写入本机</span></div>
    </div>
    <div class="stats">
      <div class="stat ok"><div class="n">2</div><div class="l">将新增</div></div>
      <div class="stat warn"><div class="n">1</div><div class="l">重复跳过</div></div>
      <div class="stat bad"><div class="n">1</div><div class="l">无法识别</div></div>
      <div class="stat"><div class="n">100%</div><div class="l">本机解析</div></div>
    </div>
    <div class="panel">
      <div class="panel-h">条目逐行核对
        <span class="right">
          <button class="btn sm ${state.importConflictMode === "skip" ? "primary" : ""}" data-act="import-mode" data-mode="skip">重复则跳过</button>
          <button class="btn sm ${state.importConflictMode === "overwrite" ? "primary" : ""}" data-act="import-mode" data-mode="overwrite">重复则覆盖</button>
        </span>
      </div>
      ${IMPORT_PREVIEW_ROWS.map(
        (r) => `<div class="prow">
        <span class="chip ${r.status === "new" ? "ok" : r.status === "dup" ? "warn" : "bad"}">${r.status === "dup" && state.importConflictMode === "overwrite" ? "将覆盖原条" : r.statusLabel}</span>
        <div style="min-width:0;flex:1"><div class="t">${r.name} <span style="font-weight:400;color:var(--text-3)">· ${r.user}</span></div><div class="s">${r.detail}</div></div>
      </div>`,
      ).join("")}
    </div>
  </section>`;
}

function macExportPage(state) {
  const fmts = [
    ["encrypted_json", "LocalPass 加密 JSON（推荐）", "需备份口令解密，可跨设备安全存储与恢复"],
    ["json", "明文 JSON", "含未加密密码，仅建议临时本地脚本迁移后立即粉碎"],
    ["csv", "通用 CSV 表格", "兼容 Chrome / Safari / 1Password 导入，含明文警告"],
  ];
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>导出标准备份文件</h1><p>导出是带备份口令的独立可迁移文件，不是远端同步快照。</p></div>
      <div class="right"><button class="btn sm primary" data-act="toast-msg" data-msg="已验证安全密码并生成导出文件">${icon("download", 12)}验证密码并导出</button></div>
    </div>
    <div class="panel">
      <div class="panel-h">导出格式 <span class="sub">${state.items.length} 条目 · ${FOLDERS.length} 文件夹</span></div>
      ${fmts
        .map(
          ([
            id,
            t,
            d,
          ]) => `<button class="setrow" style="width:100%;text-align:left;background:${state.exportFormat === id ? "var(--brand-softer)" : ""}" data-act="pick-export" data-fmt="${id}">
        <div><div class="k">${t}</div><div class="d">${d}</div></div>
        <div class="right"><span class="chip ${state.exportFormat === id ? "brand" : ""}">${state.exportFormat === id ? "已选" : "选择"}</span></div>
      </button>`,
        )
        .join("")}
    </div>
    <div class="panel">
      <div class="panel-h">备份口令与安全确认</div>
      <div class="setrow"><div><div class="k">本机加密备份口令</div><div class="d">首次使用随机生成，跨端导入加密文件时需要</div></div><div class="right"><span class="mono" style="font-size:11px">amber-vault-9921-k7m2</span><button class="btn sm" data-act="copy" data-label="备份口令">复制</button></div></div>
      <div class="setrow"><div><div class="k">重新输入安全密码</div><div class="d">导出前必须校验主密码，防止他人趁解锁态导出</div></div><div class="right"><input type="password" value="••••••••••••" aria-label="确认安全密码" style="height:26px;width:180px;border:1px solid var(--border);border-radius:5px;padding:0 8px;background:var(--bg-alt)" /></div></div>
    </div>
  </section>`;
}

function macSyncPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>R2 多端同步（加密镜像）</h1><p>一个桶 = 一座保险库（以 account.json 为唯一恢复锚点）。桶不可用时本机照常读写。</p></div>
      <div class="right">
        <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-backup-config">${icon("sliders", 12)}存储与 CORS 配置</button>
        <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-restore">${icon("download", 12)}从桶恢复</button>
        <button class="btn sm primary" data-act="sync-now">${icon("refresh", 12)}立即同步</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h">同步策略与状态 <span class="right"><span class="chip ${state.dirtyCount ? "warn" : "ok"}">${state.dirtyCount ? `待上传 ${state.dirtyCount}` : "已收敛 · gen #42"}</span></span></div>
      <div class="setrow"><div><div class="k">自动同步（v2 方案 · 可随时关闭）</div><div class="d">本地写入 30 秒去抖上传 / 解锁后先拉后推 / 切回窗口刷新</div></div><div class="right"><span style="font-size:10.5px;color:var(--text-3)">${state.lastSyncText}</span><span class="toggle ${state.autoSync ? "" : "off"}" role="switch" aria-checked="${state.autoSync}" data-act="toggle-autosync"></span></div></div>
      <div class="setrow"><div><div class="k">存储桶 · <span class="mono">lp-7f3a</span></div><div class="d">Cloudflare R2 · 分段 gzip + Ed25519 签名防回滚 · 只存密文与元数据</div></div><div class="right"><button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-backup-config">编辑端点</button><span class="chip ok">已连接</span></div></div>
      <div class="setrow"><div><div class="k">冲突待处理</div><div class="d">发现双端并发修改同一条目，默认不静默覆盖</div></div><div class="right"><span class="chip warn">1 个冲突</span><button class="btn sm primary" data-act="go-screen" data-surface="mac" data-screen="mac-conflict">并排对比解决 →</button></div></div>
    </div>

    <div class="panel">
      <div class="panel-h">已登记设备 <span class="sub">${R2_DEVICES.length} 台</span></div>
      ${R2_DEVICES.map(
        (d) => `<div class="prow">
        ${icon("devices", 14)}
        <div><div class="t">${d.name}</div><div class="s">${d.os} · ${d.keyHint}</div></div>
        <div class="right"><span style="font-size:10px;color:var(--text-3)">${d.last}</span><span class="chip ${d.current ? "ok" : ""}">${d.current ? "当前" : "可信"}</span></div>
      </div>`,
      ).join("")}
    </div>

    <div class="callout">${icon("info", 14)}<div><strong>元数据边界透明告知：</strong>Cloudflare R2 看不到条目名称、用户名、密码或备注，但能看到加密分片大小、条目数量统计及最近同步时间戳。如需完全带走标准化归档，请使用「导出」。</div></div>
  </section>`;
}

function macConflictPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>并发冲突解决（并排比对）</h1><p>当两台离线设备修改了同一条目后联网同步，系统永不静默覆盖后写先覆盖。</p></div>
      <div class="right">
        <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-sync">${icon("back", 12)}返回同步页</button>
        <button class="btn sm primary" data-act="toast-msg" data-msg="已按选定策略提交合并（gen #43）">提交解决方案</button>
      </div>
    </div>
    <div class="callout warn">${icon("alert", 14)}<div>检测到条目 <b>Northwind</b>（<span class="mono">id: northwind</span>）在 <span class="tnum">gen #41 → #42</span> 期间出现并发分支，请选择保留策略。默认推荐「两份都留」。</div></div>
    <div class="panel">
      <div class="panel-h">字段差异对比 <span class="right"><span class="chip warn">2 个字段不同</span></span></div>
      <div style="padding:10px">
        <div class="conflict">
          <div class="col ${state.conflictChoice === "local" ? "pick" : ""}">
            <div class="ch">${icon("devices", 12)}本机 MacBook Pro <span style="margin-left:auto;font-weight:400;font-size:9.5px">2 分钟前 · v4</span></div>
            <div class="cb">
              <div><div class="k">安全密码</div><div class="diff-hl mono">${syntaxPw("N7$kQ2m!rT9@xL4wZ8p")}</div></div>
              <div><div class="k">TOTP 验证码密钥</div><div class="mono">JBSW •••• 3PXP（已配置）</div></div>
              <div><div class="k">备注</div><div class="diff-hl">生产控制台。仅发布窗口使用</div></div>
            </div>
          </div>
          <div class="col ${state.conflictChoice === "remote" ? "pick" : ""}">
            <div class="ch">${icon("cloud", 12)}远端 Mac mini <span style="margin-left:auto;font-weight:400;font-size:9.5px">5 分钟前 · v4b</span></div>
            <div class="cb">
              <div><div class="k">安全密码</div><div class="diff-hl mono">${syntaxPw("K4!mP9x@qR2#vL8wA")}</div></div>
              <div><div class="k">TOTP 验证码密钥</div><div class="mono">JBSW •••• 3PXP（已配置）</div></div>
              <div><div class="k">备注</div><div style="color:var(--text-4)">（未填写）</div></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">
          <button class="panel" style="margin-top:0;padding:8px 10px;text-align:left;border-color:${state.conflictChoice === "both" ? "var(--brand)" : "var(--border)"};background:${state.conflictChoice === "both" ? "var(--brand-softer)" : ""}" data-act="pick-conflict" data-c="both">
            <div style="font-size:11.5px;font-weight:600;color:var(--brand)">两份都留（推荐 · 默认）</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:2px">保留本机条目，并将远端分支存为「Northwind（冲突副本）」</div>
          </button>
          <button class="panel" style="margin-top:0;padding:8px 10px;text-align:left;border-color:${state.conflictChoice === "local" ? "var(--brand)" : "var(--border)"};background:${state.conflictChoice === "local" ? "var(--brand-softer)" : ""}" data-act="pick-conflict" data-c="local">
            <div style="font-size:11.5px;font-weight:600">只留本机版本</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:2px">远端旧版仍保留在历史审计快照中，可再找回</div>
          </button>
          <button class="panel" style="margin-top:0;padding:8px 10px;text-align:left;border-color:${state.conflictChoice === "remote" ? "var(--brand)" : "var(--border)"};background:${state.conflictChoice === "remote" ? "var(--brand-softer)" : ""}" data-act="pick-conflict" data-c="remote">
            <div style="font-size:11.5px;font-weight:600">采用远端版本</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:2px">合并前自动为本机版本打一条本地版本历史快照</div>
          </button>
        </div>
      </div>
    </div>
  </section>`;
}

function macBackupConfigPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>R2 对象存储与 CORS 配置</h1><p>一个 R2 桶对应一座独立保险库（扁平布局：<span class="mono">account.json</span>、<span class="mono">manifest.json</span>、<span class="mono">chunks/</span>）。</p></div>
      <div class="right">
        <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-sync">${icon("back", 12)}返回同步</button>
        <button class="btn sm" data-act="test-r2">${icon("wifi", 12)}测试连接</button>
        <button class="btn sm primary" data-act="toast-msg" data-msg="已加密保存 R2 桶凭据并放行网络闸门白名单">保存配置</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:10px;margin-top:10px">
      <div>
        <div class="panel" style="margin-top:0">
          <div class="panel-h">Cloudflare R2 / S3 兼容端点 <span class="right"><span class="chip ${state.r2TestOk ? "ok" : "brand"}">${state.r2TestOk ? "HEAD 桶校验通过 (38ms)" : "已配置"}</span></span></div>
          <div class="grp" style="border:0;border-radius:0">
            <div class="frow"><div class="lb">端点 URL</div><div class="iv"><input class="mono" value="${R2_CONFIG.endpoint}" /></div></div>
            <div class="frow"><div class="lb">区域 Region</div><div class="iv"><input class="mono" value="${R2_CONFIG.region}" /></div></div>
            <div class="frow"><div class="lb">桶名称</div><div class="iv"><input class="mono" value="${R2_CONFIG.bucket}" /></div></div>
            <div class="frow"><div class="lb">Access Key</div><div class="iv"><input class="mono" value="${R2_CONFIG.accessKeyId}" /></div></div>
            <div class="frow"><div class="lb">Secret Key</div><div class="iv"><input type="password" value="cf_secret_synthetickey_882190" /></div></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h">隔离与断开选项</div>
          <div class="setrow"><div><div class="k">网络闸门自动白名单</div><div class="d">保存后仅放行此端点主机；绝不允许通配外部域名</div></div><div class="right"><span class="chip ok">自动放行</span></div></div>
          <div class="setrow"><div><div class="k">断开同步连接</div><div class="d">解除 R2 绑定，不删除本机保险库，也不删除云桶历史对象</div></div><div class="right"><button class="btn sm danger" data-act="toast-msg" data-msg="已断开 R2 同步配置，本机数据不受影响">断开配置</button></div></div>
        </div>
      </div>
      <div>
        <div class="panel" style="margin-top:0">
          <div class="panel-h">R2 CORS 策略（扩展必需）<span class="right"><button class="btn sm" data-act="copy" data-label="R2 CORS JSON" data-copy-val="${escapeHtml(R2_CONFIG.corsJson)}">${icon("copy", 11)}复制</button></span></div>
          <div style="padding:8px 10px"><pre class="codeblock" style="margin:0">${escapeHtml(R2_CONFIG.corsJson)}</pre></div>
        </div>
        <div class="callout brand">${icon("key", 14)}<div><strong>一个桶 = 一座保险库：</strong>桶根目录的 <span class="mono">account.json</span> 锁定了首次建库身份，不同设备必须先从桶恢复再协同。</div></div>
      </div>
    </div>
  </section>`;
}

function macRestorePage() {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>从 R2 云存储恢复保险库</h1><p>读取桶根 <span class="mono">account.json</span> 锚点并验证原安全密码，从加密分片在本机完整重建。</p></div>
      <div class="right">
        <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-setup">返回建库页</button>
        <button class="btn sm primary" data-act="go-screen" data-surface="mac" data-screen="mac-vault">${icon("download", 12)}验证并重建本机库</button>
      </div>
    </div>
    <div class="stepbar">
      <div class="step done">${icon("check", 11)}<span>1 · 读取桶凭据</span></div>
      <div class="step on"><span>2 · 校验 account.json 归属</span></div>
      <div class="step"><span>3 · 解密重建本机</span></div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 336px;gap:10px;margin-top:10px">
      <div class="panel" style="margin-top:0">
        <div class="panel-h">云端桶快照核验 <span class="right"><span class="chip ok">Ed25519 签名校验通过</span></span></div>
        <div class="setrow"><div><div class="k">恢复锚点文件</div><div class="d">桶根 <span class="mono">${R2_RESTORE_PREVIEW.anchorFile}</span></div></div><div class="right"><span class="mono" style="font-size:10.5px">${R2_RESTORE_PREVIEW.userId}</span></div></div>
        <div class="setrow"><div><div class="k">原主密钥标识</div><div class="d">仅作 KDF 盐值，需与输入的安全密码一致</div></div><div class="right"><span class="mono">${R2_RESTORE_PREVIEW.emailHint}</span></div></div>
        <div class="setrow"><div><div class="k">远端版本代次</div><div class="d">最近写入于 ${R2_RESTORE_PREVIEW.updatedAt}</div></div><div class="right"><span class="chip brand">gen #${R2_RESTORE_PREVIEW.gen} · ${R2_RESTORE_PREVIEW.chunks} 分片</span></div></div>
        <div class="setrow"><div><div class="k">包含内容统计</div><div class="d">本机当前 ${R2_RESTORE_PREVIEW.localCount} 条目 → 恢复后将对齐云端</div></div><div class="right"><span class="tnum" style="font-weight:600">${R2_RESTORE_PREVIEW.itemCount} 条目 · ${R2_RESTORE_PREVIEW.folderCount} 文件夹</span></div></div>
      </div>
      <div>
        <div class="panel" style="margin-top:0">
          <div class="panel-h">输入原安全密码解密</div>
          <div style="padding:10px;display:grid;gap:7px">
            <div style="font-size:10.5px;color:var(--text-3)">请输入创立该桶时的安全密码（离线派生主密钥）：</div>
            <input type="password" value="••••••••••••" aria-label="原安全密码" style="height:30px;border:1px solid var(--border);border-radius:6px;padding:0 9px;background:var(--bg-alt)" />
            <button class="btn primary block lg" data-act="toast-msg" data-msg="已从 R2 解密 3 个分片并在本机重建 ${R2_RESTORE_PREVIEW.itemCount} 条目">解密并覆盖重建本机</button>
          </div>
        </div>
        <div class="callout warn">${icon("alert", 14)}<div>说明：扩展端本地保存的 WebAuthn PRF 密钥不同步进桶，新设备恢复后可在扩展中重新登记。</div></div>
      </div>
    </div>
  </section>`;
}

function macNetworkPage() {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>网络闸门</h1><p>ApiService 层默认拒绝全部出站请求，仅放行你在上方授权的白名单域名。</p></div>
    </div>
    <div class="panel">
      <div class="panel-h">允许出站白名单 <span class="right"><span class="chip ok">锁库状态下恒为 0 请求</span></span></div>
      ${NETWORK_ALLOWLIST.map(
        (n) => `<div class="setrow">
        <div><div class="k mono">${n.host}</div><div class="d">${n.purpose} · ${n.desc}</div></div>
        <div class="right"><span class="chip ${n.on ? "ok" : ""}">${n.on ? "允许" : "关闭"}</span></div>
      </div>`,
      ).join("")}
    </div>
    <div class="panel">
      <div class="panel-h">默认出站守则 <span class="sub">扩展与桌面端共用 gate-policy.ts</span></div>
      ${NETWORK_DEFAULT_RULES.map(
        (r) => `<div class="prow">
        ${icon("shield", 14)}
        <div style="min-width:0;flex:1"><div class="t">${r.title}</div><div class="s">${r.sub}</div></div>
        <div class="right"><span class="chip ok">${r.badge}</span></div>
      </div>`,
      ).join("")}
    </div>
  </section>`;
}

function macDataPage(state) {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>数据与安全边界</h1><p>管理本机保险库磁盘文件、已启用的加密防护与不可逆清空流程。</p></div>
      <div class="right">
        <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-export">${icon("download", 12)}先导出备份文件</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="n">${state.items.length}</div><div class="l">本机密文条目</div></div>
      <div class="stat ok"><div class="n">0600</div><div class="l">data.json 权限</div></div>
      <div class="stat"><div class="n">3 份</div><div class="l">.bak 滚动防损坏</div></div>
      <div class="stat ok"><div class="n">0</div><div class="l">服务端副本数</div></div>
    </div>
    <div class="panel">
      <div class="panel-h">已启用的安全护栏</div>
      <div class="setrow"><div><div class="k">AES-256-GCM 本地全字段加密</div><div class="d">用户名、密码、备注、自定义字段与版本历史均写入密文区</div></div><div class="right"><span class="chip ok">已开启</span></div></div>
      <div class="setrow"><div><div class="k">连错防暴力等待（不销库）</div><div class="d">连续输错 5 次 PIN/密码仅锁定等待，永不擅自销毁本地文件</div></div><div class="right"><span class="chip ok">已开启</span></div></div>
      <div class="setrow"><div><div class="k">macOS 原生消息桥接</div><div class="d">host: <span class="mono">com.localpass.desktop</span>（已启用严格来源校验）</div></div><div class="right"><span class="chip brand">桌面 ↔ 扩展</span></div></div>
    </div>
    <div class="panel danger-zone">
      <div class="panel-h">${icon("alert", 13)}危险操作：退出或清空本机全部数据</div>
      <div style="padding:10px;display:grid;gap:8px">
        <div class="callout bad" style="margin-top:0">${icon("alert", 14)}<div><strong>重要提示：LocalPass 没有服务端账号副本。</strong>清空本机数据后，若无 R2 云桶或此前导出的备份文件，全部密码将永久不可恢复。</div></div>
        <button class="check-btn" data-act="toggle-wipe-confirm">
          <span class="check ${state.wipeConfirmed ? "" : "off"}">${state.wipeConfirmed ? icon("check", 9) : ""}</span>
          <span>我已完成导出或确认拥有 R2 恢复凭据，理解此操作将永久抹除本机 <span class="mono">data.json</span></span>
        </button>
        <div style="display:flex;gap:6px">
          <button class="btn sm primary danger-fill" ${state.wipeConfirmed ? "" : "disabled"} data-act="go-screen" data-surface="mac" data-screen="mac-setup">清空本机保险库并退回首次建库</button>
          <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-export">去导出备份</button>
        </div>
      </div>
    </div>
  </section>`;
}

function macAboutPage() {
  return `<section class="pagearea lp">
    <div class="pagehead">
      <div><h1>关于 LocalPass · 离线诊断与更新日志</h1><p>开源协议 GPL-3.0 · 纯本地离线优先桌面与浏览器密码架构</p></div>
      <div class="right">
        <button class="btn sm primary" data-act="copy" data-label="零敏感诊断报告" data-copy-val="${escapeHtml(DIAGNOSTIC_SAMPLE)}">${icon("copy", 12)}复制零敏感诊断包</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 336px;gap:10px;margin-top:10px">
      <div>
        <div class="panel" style="margin-top:0">
          <div class="panel-h">版本更新记录 <span class="sub">v2026.11.1-compact-v4</span></div>
          ${CHANGELOG_ENTRIES.map(
            (c) => `<div style="padding:8px 10px;border-bottom:1px solid var(--border-light)">
            <div style="display:flex;align-items:center;gap:6px"><span class="chip brand">v${c.ver}</span><span style="font-size:10px;color:var(--text-3)">${c.date}</span></div>
            <ul style="margin:5px 0 0;padding-left:16px;font-size:10.5px;color:var(--text-2);line-height:1.5">${c.items.map((x) => `<li>${x}</li>`).join("")}</ul>
          </div>`,
          ).join("")}
        </div>
        <div class="panel">
          <div class="panel-h">已知设计边界与限制</div>
          ${KNOWN_LIMITS.map((l) => `<div class="prow">${icon("info", 13)}<div class="s" style="color:var(--text-2);white-space:normal">${l}</div></div>`).join("")}
        </div>
      </div>
      <div class="panel" style="margin-top:0">
        <div class="panel-h">离线诊断包（零敏感数据）</div>
        <div style="padding:9px 10px">
          <pre class="codeblock" style="margin:0">${escapeHtml(DIAGNOSTIC_SAMPLE)}</pre>
          <div style="margin-top:8px;font-size:10px;color:var(--text-3)">包含系统版本、条目数量、R2 状态及网络闸门策略状态；绝对不含任何条目名、网址、用户名或密钥。</div>
        </div>
      </div>
    </div>
  </section>`;
}

function macSettingsPage(state) {
  const tabs = [
    ["security", "安全与解锁"],
    ["vault", "剪贴板与数据"],
    ["appearance", "外观与密度"],
    ["shortcuts", "快捷键映射"],
    ["about", "关于与诊断"],
  ];
  let body = "";
  if (state.macSettingsTab === "security") {
    body = `<div class="panel">
      <div class="panel-h">macOS 解锁方式 <span class="right"><span class="chip ok">Touch ID 仅桌面端可用</span></span></div>
      <div class="setrow"><div><div class="k">触控 ID 解锁（macOS）</div><div class="d">解锁保险库、查看重提示密码与响应扩展代理请求时确认</div></div><div class="right"><span class="toggle ${state.touchIdOn ? "" : "off"}" role="switch" aria-checked="${state.touchIdOn}" data-act="toggle-touchid"></span></div></div>
      <div class="setrow"><div><div class="k">浏览器原生消息解锁桥接</div><div class="d">host: com.localpass.desktop · 允许 Chrome 扩展共享桌面端已解锁会话</div></div><div class="right"><span class="toggle ${state.nativeBridgeOn ? "" : "off"}" role="switch" aria-checked="${state.nativeBridgeOn}" data-act="toggle-bridge"></span></div></div>
      <div class="setrow"><div><div class="k">PIN 解锁防暴力护栏</div><div class="d">连续输错 5 次递增等待，不清空本机保险库</div></div><div class="right"><button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-unlock-wait">预览等待态</button></div></div>
      <div class="setrow"><div><div class="k">安全密钥解锁（WebAuthn PRF）</div><div class="d">受限于桌面端域名 RP ID，安全密钥解锁请在 Chrome 扩展中登记使用</div></div><div class="right"><button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-security-key">查看说明 →</button></div></div>
    </div>
    <div class="panel">
      <div class="panel-h">安全密码</div>
      <div class="setrow"><div><div class="k">更改安全密码</div><div class="d">用新密码重新包裹用户密钥，不轮换底层密钥，旧加密导出文件仍可用旧密码打开</div></div><div class="right"><button class="btn sm" data-act="toast-msg" data-msg="安全密码重包裹流程：仅更换顶层包装，不改变底层加密导出键">更改</button></div></div>
    </div>`;
  } else if (state.macSettingsTab === "vault") {
    body = `<div class="panel">
      <div class="panel-h">剪贴板与会话安全</div>
      <div class="setrow"><div><div class="k">复制后自动清空剪贴板</div><div class="d">30 秒后清除敏感内容，状态栏实时显示剩余秒数</div></div><div class="right"><span class="chip brand">30 秒</span></div></div>
      <div class="setrow"><div><div class="k">密码明文显示自动收回</div><div class="d">点击眼睛显示明文 30 秒后自动重新遮罩</div></div><div class="right"><span class="toggle" role="switch" aria-checked="true"></span></div></div>
      <div class="setrow"><div><div class="k">自动锁定超时</div><div class="d">无操作 5 分钟后锁定</div></div><div class="right"><span class="chip">5 分钟</span></div></div>
      <div class="setrow"><div><div class="k">本地数据与清空管理</div><div class="d">查看 data.json 权限、先导出建议与退出保险库双确认</div></div><div class="right"><button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-data">进入数据与安全 →</button></div></div>
    </div>`;
  } else if (state.macSettingsTab === "appearance") {
    body = `<div class="panel">
      <div class="panel-h">主题与信息密度</div>
      <div class="setrow"><div><div class="k">列表行高密度</div><div class="d">紧凑：36px（双行）；极紧：30px（单行内联，多显示 3 条）</div></div><div class="right"><button class="btn sm ${state.density === "compact" ? "primary" : ""}" data-act="set-density" data-d="compact">紧凑 36px</button><button class="btn sm ${state.density === "ultra" ? "primary" : ""}" data-act="set-density" data-d="ultra">极紧 30px</button></div></div>
      <div class="setrow"><div><div class="k">界面语言</div><div class="d">与 Chrome 扩展共用 i18n 词库</div></div><div class="right"><span class="chip">简体中文 / English</span></div></div>
    </div>`;
  } else if (state.macSettingsTab === "shortcuts") {
    const shortcuts = state.shortcuts || INITIAL_SHORTCUTS;
    body = `<div class="panel">
      <div class="panel-h">键盘映射（仅本应用内生效 · 已取消系统全局热键）
        <span class="right">
          <span class="chip">无全局后台监听</span>
          <button class="btn sm" data-act="reset-shortcuts">重置默认</button>
        </span>
      </div>
      ${
        shortcuts.length === 0
          ? `<div style="text-align:center;padding:24px 12px;color:var(--text-3)">已删除全部应用内快捷键。<button class="btn sm primary" style="margin-left:8px" data-act="reset-shortcuts">恢复默认</button></div>`
          : shortcuts
              .map(
                (sc) => `<div class="prow">
          <div style="min-width:0;flex:1"><div class="t">${sc.title}</div><div class="s">${sc.desc}</div></div>
          <div class="right">
            <kbd>${sc.key}</kbd>
            <button class="iconbtn sm fdel" data-act="del-shortcut" data-id="${sc.id}" title="删除此快捷键" aria-label="删除${sc.title}快捷键">${icon("trash", 12)}</button>
          </div>
        </div>`,
              )
              .join("")
      }
    </div>`;
  } else {
    body = `<div class="panel">
      <div class="panel-h">离线诊断包（零敏感信息）<span class="right">
        <button class="btn sm" data-act="go-screen" data-surface="mac" data-screen="mac-about">打开完整关于页 →</button>
        <button class="btn sm primary" data-act="copy" data-label="诊断报告" data-copy-val="${escapeHtml(DIAGNOSTIC_SAMPLE)}">复制诊断信息</button>
      </span></div>
      <div style="padding:9px 10px"><pre class="mono" style="margin:0;font-size:10.5px;line-height:1.5;color:var(--text-2);white-space:pre-wrap">${escapeHtml(DIAGNOSTIC_SAMPLE)}</pre></div>
    </div>`;
  }
  return `<section class="pagearea lp">
    <div class="pagehead"><div><h1>设置</h1><p>所有修改即时写入本机 <span class="mono">data.json</span>（0600 权限 + <span class="mono">.bak</span> 滚动备份）。</p></div></div>
    <div style="display:flex;gap:2px;margin-top:8px;border-bottom:1px solid var(--border)">
      ${tabs.map(([id, label]) => `<button data-act="mac-stab" data-stab="${id}" style="height:26px;padding:0 10px;font-size:11px;color:${state.macSettingsTab === id ? "var(--text)" : "var(--text-3)"};font-weight:${state.macSettingsTab === id ? 600 : 400};border-bottom:2px solid ${state.macSettingsTab === id ? "var(--brand)" : "transparent"};margin-bottom:-1px">${label}</button>`).join("")}
    </div>
    ${body}
  </section>`;
}

function macEmptyPage() {
  return `<section class="pagearea lp" style="display:flex">
    <div class="empty-stage">
      <div class="icon-ring">${icon("key", 18)}</div>
      <div class="eh">欢迎来到你的本地保险库</div>
      <div class="es">当前尚未存入任何条目。一切凭证端到端加密留在本地，无服务端账号，也无任何静默同步。</div>
      <div style="display:flex;gap:7px;margin-top:14px">
        <button class="btn primary lg" data-act="open-empty-new">${icon("plus", 13)}新建第一条记录</button>
        <button class="btn lg" data-act="go-screen" data-surface="mac" data-screen="mac-import">${icon("upload", 13)}导入 1PUX / CSV</button>
        <button class="btn lg" data-act="go-screen" data-surface="mac" data-screen="mac-restore">${icon("cloud", 13)}从 R2 桶恢复</button>
      </div>
      <div class="kbdrow" style="margin-top:14px"><span>随时按</span><kbd>⌘N</kbd><span>新建 ·</span><kbd>⌘⇧Space</kbd><span>全局检索</span></div>
    </div>
  </section>`;
}

function macItemDeleteModal(state) {
  const item = state.items.find((i) => i.id === state.selected) || state.items[0];
  return `<div class="overlay lp" style="align-items:center;padding-top:0">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="deleteModalTitle">
      <span id="deleteModalTitle" class="sr-only">确认删除条目</span>
      <div class="mh">${icon("trash", 14)}<span>将条目移到回收站？</span>
        <button class="iconbtn sm" style="margin-left:auto" data-act="go-screen" data-surface="mac" data-screen="mac-vault" aria-label="关闭">${icon("x", 14)}</button>
      </div>
      <div class="mb">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg-alt);margin-bottom:9px">
          ${AV(item)}
          <div style="min-width:0;flex:1">
            <div style="font-size:12px;font-weight:600;color:var(--text)">${escapeHtml(item.name)}</div>
            <div style="font-size:10px;color:var(--text-3)">${escapeHtml(item.user || item.kindLabel)} · 文件夹 ${item.folder}</div>
          </div>
          <span class="chip">${item.kindLabel}</span>
        </div>
        <div>删除是可逆的：条目会先移入 <strong>回收站保留 30 天</strong>，操作后有 5 秒可立即撤销；若只是暂时停用，建议改用「归档」。</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:6px">提示：后续彻底删除本机条目时，不会清除 R2 桶中过去的历史旧快照。</div>
      </div>
      <div class="mf">
        <button class="btn" data-act="go-screen" data-surface="mac" data-screen="mac-vault">取消</button>
        <button class="btn" data-act="archive-item" data-id="${item.id}">改用归档</button>
        <button class="btn primary danger-fill" data-act="trash-item" data-id="${item.id}">移到回收站 (⌘⌫)</button>
      </div>
    </div>
  </div>`;
}

function macUnlockScreen(state, waitMode = false) {
  return `<div class="mac lp">
    ${macBar(state)}
    <div class="wincard">
      <div class="card" style="text-align:center">
        <span class="av xl av-blue" style="margin:0 auto;border-radius:10px">LP</span>
        <div class="h" style="margin-top:9px">${waitMode ? "连续输错 · 请稍候再试" : "保险库已锁定"}</div>
        <div class="s">${waitMode ? "连续输错 5 次 PIN / 安全密码，触发本地防暴力等待。重启不会清零等待，也绝不销毁本机保险库。" : "输入安全密码或使用触控 ID 解锁。解锁后 Chrome 扩展将同步可用。"}</div>
        ${
          waitMode
            ? `<div class="tnum" style="font-size:28px;font-weight:700;margin-top:12px;color:var(--warning)">00:${String(state.unlockWaitSecs).padStart(2, "0")}</div>`
            : `<input type="password" value="••••••••••••" aria-label="安全密码" />`
        }
        <button class="btn primary block lg" style="margin-top:8px" ${waitMode ? "disabled" : ""} data-act="unlock-all">解锁保险库 ↵</button>
        ${!waitMode ? `<button class="btn block" style="margin-top:6px" data-act="unlock-all">${icon("touchid", 14)}使用触控 ID 解锁</button>` : ""}
        <div style="margin-top:9px;display:flex;justify-content:center;gap:12px;font-size:10px">
          <button style="color:var(--brand)" data-act="go-screen" data-surface="mac" data-screen="mac-restore">从 R2 桶恢复</button>
          <button style="color:var(--text-3)" data-act="go-screen" data-surface="mac" data-screen="${waitMode ? "mac-unlock" : "mac-unlock-wait"}">${waitMode ? "返回常规解锁" : "查看连错等待态"}</button>
        </div>
        <div style="margin-top:9px;font-size:9.5px;color:var(--text-4)">${icon("wifi", 10)} 断网照常解锁 · 连续输错不会销毁本机数据</div>
      </div>
    </div>
  </div>`;
}

function macSecurityKeyScreen(state) {
  return `<div class="mac lp">
    ${macBar(state)}
    <div class="wincard">
      <div class="card" style="width:412px;text-align:center">
        <div class="prf-pulse">${icon("key", 24)}</div>
        <div class="h">WebAuthn PRF 硬件安全密钥说明</div>
        <div class="s">由于浏览器的 WebAuthn PRF 扩展需要绑定扩展自身 <span class="mono">RP ID</span> 推导加解密密钥，桌面端使用「macOS 触控 ID + 安全密码」替代，硬件安全密钥解锁在 Chrome 扩展中独立管理。</div>
        <div class="callout brand" style="text-align:left;margin-top:12px">
          ${icon("shield", 14)}
          <div><strong>三端职责分工明确：</strong>Mac 桌面端通过系统生物识别钥匙串保护主密钥；Chrome 扩展除了通过原生消息复用桌面解锁外，还可单独登记 USB-C / NFC 安全密钥（PRF）离线解锁。</div>
        </div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button class="btn primary block lg" data-act="go-screen" data-surface="ext" data-screen="ext-security-key">前往 Chrome 扩展 PRF 设置 →</button>
          <button class="btn lg" data-act="go-screen" data-surface="mac" data-screen="mac-settings">返回</button>
        </div>
      </div>
    </div>
  </div>`;
}

function macSetupScreen(state) {
  return `<div class="mac lp">
    ${macBar(state)}
    <div class="wincard">
      <div class="card" style="width:368px">
        <div class="h">在本机创建或恢复保险库</div>
        <div class="s">没有账号、没有服务端。邮箱仅用于本机密钥派生标识；安全密码无法找回。</div>
        <input type="email" value="alex@northwind.io" aria-label="标识邮箱" />
        <input type="password" value="••••••••••••" aria-label="设置安全密码" style="margin-top:7px" />
        <input type="password" value="••••••••••••" aria-label="确认安全密码" style="margin-top:7px" />
        <button class="btn primary block lg" style="margin-top:10px" data-act="go-screen" data-surface="mac" data-screen="mac-empty">创建本地保险库</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px">
          <button class="btn block" data-act="go-screen" data-surface="mac" data-screen="mac-restore">${icon("cloud", 13)}从云存储恢复</button>
          <button class="btn block" data-act="go-screen" data-surface="mac" data-screen="mac-import">${icon("upload", 13)}从备份文件恢复</button>
        </div>
        <div style="margin-top:8px;font-size:9.5px;color:var(--text-3);line-height:1.45">已有 R2 同步库？请直接选「从云存储恢复」，勿先建空库再配桶。</div>
      </div>
    </div>
  </div>`;
}

function macTrayScreen(state) {
  return `<div class="tray-stage lp">
    <div class="macos-menubar">
      <span></span><b>LocalPass</b><span>文件</span><span>编辑</span><span>保险库</span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:10px">
        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;background:var(--brand-soft);color:var(--brand)">${icon("shield", 12)}<b>LP</b></span>
        <span class="tnum">22:26</span>
      </span>
    </div>
    <div class="tray-pop" role="dialog" aria-label="Mac 菜单栏托盘弹窗">
      <div style="padding:7px 8px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;gap:6px">
        <label class="search" style="flex:1;height:26px">${icon("search", 12)}<input placeholder="快速查找并复制…" /></label>
        <button class="iconbtn sm" data-act="toggle-lock" title="锁定">${icon("lock", 13)}</button>
      </div>
      <div style="padding:3px 4px">
        <div class="grouphead">常驻置顶 · 1 键复制</div>
        ${state.items
          .slice(0, 4)
          .map(
            (it) => `<div class="ext-row" style="height:34px">
          ${AV(it, "sm")}
          <span style="min-width:0;flex:1"><span class="t">${escapeHtml(it.name)}</span><span class="s">${escapeHtml(it.user)}</span></span>
          <span class="m">
            ${it.otp ? `<span class="chip ok tnum">${it.otp}</span>` : ""}
            <button class="iconbtn sm" data-act="copy" data-label="密码" data-copy-key="${it.id}:secret" aria-label="复制密码">${icon("copy", 12)}</button>
          </span>
        </div>`,
          )
          .join("")}
      </div>
      <div style="border-top:1px solid var(--border-light);padding:6px 8px;display:flex;align-items:center;gap:6px;background:var(--bg-alt)">
        <button class="btn sm" data-act="copy" data-label="新密码 20位">${icon("wand", 12)}生成并复制</button>
        <button class="btn sm primary" style="margin-left:auto" data-act="go-screen" data-surface="mac" data-screen="mac-vault">打开主窗口</button>
      </div>
    </div>
  </div>`;
}

function renderMacWorkspace(state, opts = {}) {
  if (opts.screen === "mac-unlock" || (state.locked && opts.respectLock)) {
    return macUnlockScreen(state, false);
  }
  if (opts.screen === "mac-unlock-wait") return macUnlockScreen(state, true);
  if (opts.screen === "mac-security-key") return macSecurityKeyScreen(state);
  if (opts.screen === "mac-setup") return macSetupScreen(state);
  if (opts.screen === "mac-tray") return macTrayScreen(state);

  const sub = opts.sub || state.macSub;
  let mainPane = "";
  if (sub === "vault" || sub === "recent") {
    mainPane = macList(state) + macDetailView(state);
  } else if (sub === "empty") {
    mainPane = macEmptyPage();
  } else if (sub === "health") {
    mainPane = macHealthPage(state);
  } else if (sub === "archive") {
    mainPane = macArchivePage(state);
  } else if (sub === "trash") {
    mainPane = macTrashPage(state);
  } else if (sub === "folders") {
    mainPane = macFoldersPage(state);
  } else if (sub === "generator") {
    mainPane = macGeneratorPage(state);
  } else if (sub === "generator-history") {
    mainPane = macGeneratorHistoryPage(state);
  } else if (sub === "import") {
    mainPane = macImportPage(state);
  } else if (sub === "import-preview") {
    mainPane = macImportPreviewPage(state);
  } else if (sub === "export") {
    mainPane = macExportPage(state);
  } else if (sub === "sync") {
    mainPane = macSyncPage(state);
  } else if (sub === "conflict") {
    mainPane = macConflictPage(state);
  } else if (sub === "backup-config") {
    mainPane = macBackupConfigPage(state);
  } else if (sub === "restore") {
    mainPane = macRestorePage();
  } else if (sub === "network") {
    mainPane = macNetworkPage();
  } else if (sub === "data") {
    mainPane = macDataPage(state);
  } else if (sub === "settings") {
    mainPane = macSettingsPage(state);
  } else if (sub === "about") {
    mainPane = macAboutPage();
  }

  return `<div class="mac lp">
    ${macBar(state)}
    <div class="mac-body">
      ${macSide(state)}
      ${mainPane}
    </div>
    ${opts.quickSearch ? macQuickAccessModal(state) : ""}
    ${opts.deleteModal ? macItemDeleteModal(state) : ""}
    ${toastMarkup(state, "mac")}
  </div>`;
}

function toastMarkup(state, surfaceKey) {
  if (!state.toast || (state.toast.surface && state.toast.surface !== surfaceKey)) {
    return `<div class="toast"><span class="dot"></span><span class="msg"></span></div>`;
  }
  return `<div class="toast show" role="status" aria-live="polite">
    <span class="dot ${state.toast.tone || ""}"></span>
    <span class="msg">${escapeHtml(state.toast.msg)}</span>
    ${state.toast.undoAction ? `<button class="t-act" data-act="${state.toast.undoAction}">撤销 (${state.toast.secs || 5}s)</button>` : ""}
    ${state.toast.clearClip ? `<button class="t-act" data-act="clear-clip">立即清除</button>` : ""}
  </div>`;
}
