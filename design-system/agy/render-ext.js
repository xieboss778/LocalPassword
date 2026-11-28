/* ==========================================================================
   LocalPass · AGY Compact v4 — Browser Extension Popup Views (380 x 600)
   MV3 Fixed Viewport · Current-Tab Priority · 9-10 Visible Rows · PRF Security Key
   ========================================================================== */

function extHeader(title, state, opts = {}) {
  const bridgePill = state.nativeBridgeOn
    ? `<span class="bridge-pill ${state.locked ? "locked" : ""}" title="原生消息 com.localpass.desktop">${state.locked ? "已锁定" : "Mac 已联动"}</span>`
    : "";
  return `<header class="ext-h lp">
    ${
      opts.back
        ? `<button class="iconbtn" data-act="ext-back" aria-label="返回">${icon("back", 15)}</button>`
        : `<span class="av sm av-blue" style="width:20px;height:20px;font-size:9px">LP</span>`
    }
    <span class="name">${escapeHtml(title)}</span>
    ${!opts.back ? bridgePill : ""}
    <span class="right">
      ${opts.showHelp ? `<button class="iconbtn" data-act="toggle-ext-keys" aria-label="快捷键速查" title="快捷键速查 (?)">${icon("command", 13)}</button>` : ""}
      <button class="iconbtn" data-act="toggle-lock" aria-label="锁定保险库" title="锁定">${icon("lock", 14)}</button>
      ${opts.showNew ? `<button class="iconbtn" style="color:var(--brand)" data-act="ext-go" data-ext="ext-new" aria-label="新建条目" title="新建">${icon("plus", 15)}</button>` : ""}
    </span>
  </header>`;
}

function extNav(active) {
  const tabs = [
    ["ext-list", "保险库", "grid"],
    ["ext-generator", "生成器", "wand"],
    ["ext-sync", "同步", "cloud"],
    ["ext-settings", "设置", "sliders"],
  ];
  return `<nav class="ext-nav lp" aria-label="扩展主导航">
    ${tabs.map(([id, label, ic]) => `<button class="${id === active ? "on" : ""}" data-act="ext-go" data-ext="${id}" aria-current="${id === active ? "page" : "false"}">${icon(ic, 16)}<span>${label}</span></button>`).join("")}
  </nav>`;
}

function extListView(state) {
  const matched = searchItems(state.items, state.extQuery, state.extFilter);
  const filters = [
    ["all", "全部", state.items.length],
    ["login", "登录", state.items.filter((i) => i.kind === "login").length],
    ["card", "卡片", state.items.filter((i) => i.kind === "card").length],
    ["other", "其他", state.items.filter((i) => i.kind !== "login" && i.kind !== "card").length],
  ];

  const rowHtml = (entry, isSite = false) => {
    const it = entry.item;
    const sub = entry.matchSnippet
      ? `${entry.matchField}: ${entry.matchSnippet}`
      : it.user || it.kindLabel;
    return `<div class="ext-row ${it.id === state.selected ? "on" : ""}" role="option" tabindex="0" aria-selected="${it.id === state.selected}" data-act="ext-open" data-id="${it.id}">
      ${AV(it, "sm")}
      <span style="min-width:0;flex:1">
        <span class="t">${escapeHtml(it.name)}</span>
        <span class="s">${escapeHtml(sub)}</span>
      </span>
      <span class="m">
        <span class="idle-meta">
          <span class="chip" style="height:16px;font-size:9px;padding:0 4px">${it.kindLabel}</span>
        </span>
        <span class="hoveracts">
          <button class="iconbtn sm" aria-label="复制用户名" data-act="copy" data-label="用户名" data-copy-key="${it.id}:user" title="复制用户名">${icon("user", 12)}</button>
          <button class="iconbtn sm" aria-label="复制密码" data-act="copy" data-label="密码" data-copy-key="${it.id}:secret" title="复制密码">${icon("key", 12)}</button>
          ${isSite ? `<button class="btn sm primary" aria-label="填充 ${escapeHtml(it.name)}" style="height:20px;padding:0 6px;font-size:9.5px" data-act="fill-from-ext" data-id="${it.id}">填充</button>` : ""}
        </span>
      </span>
    </div>`;
  };

  let listContent = "";
  if (matched.length === 0) {
    listContent = `<div style="text-align:center;padding:42px 18px;color:var(--text-3)">
      <div style="font-size:12px;font-weight:600;color:var(--text)">没有匹配条目</div>
      <div style="font-size:10px;margin-top:3px">已检索名称、用户名、网址、备注与自定义字段</div>
      <button class="btn sm" style="margin-top:9px" data-act="clear-ext-search">清除搜索</button>
    </div>`;
  } else if (state.extQuery.trim()) {
    listContent =
      `<div class="grouphead">全字段匹配 <span class="n">${matched.length}</span></div>` +
      matched.map((m) => rowHtml(m, m.item.siteMatch)).join("");
  } else {
    const siteMatched = matched.filter((m) => m.item.siteMatch);
    const others = matched.filter((m) => !m.item.siteMatch);
    if (siteMatched.length) {
      listContent +=
        `<div class="grouphead">当前标签页 · northwind.io <span class="n">${siteMatched.length}</span></div>` +
        siteMatched.map((m) => rowHtml(m, true)).join("");
    }
    listContent +=
      `<div class="grouphead">最近与全部 <span class="n">${others.length}</span></div>` +
      others.map((m) => rowHtml(m, false)).join("");
  }

  return `<div class="ext lp">
    ${extHeader("保险库", state, { showHelp: true, showNew: true })}
    <label class="search ext-search">
      ${icon("search", 13)}
      <input id="extSearchInput" value="${escapeHtml(state.extQuery)}" placeholder="搜索名称、用户名、网址、备注…" aria-label="搜索扩展保险库" autocomplete="off" />
    </label>
    <div class="ext-tabs" role="tablist" aria-label="条目类型筛选">
      ${filters.map(([id, label, n]) => `<button role="tab" aria-selected="${state.extFilter === id}" class="${state.extFilter === id ? "on" : ""}" data-act="ext-filter" data-filter="${id}">${label}<span class="n">${n}</span></button>`).join("")}
    </div>
    <div class="ext-list" role="listbox" aria-label="扩展保险库条目">${listContent}</div>
    ${
      state.extKeyCheat
        ? `<div class="sheetwrap" data-act="toggle-ext-keys"><div class="sheet" onclick="event.stopPropagation()">
      <div class="st">扩展快捷键速查</div>
      <div class="prow"><div><div class="t">打开扩展弹窗</div></div><div class="right"><kbd>⌘⇧Y</kbd></div></div>
      <div class="prow"><div><div class="t">当前页自动填充</div></div><div class="right"><kbd>⌘⇧L</kbd></div></div>
      <div class="prow"><div><div class="t">列表上下移动 / 打开</div></div><div class="right"><kbd>↑↓</kbd> <kbd>↵</kbd></div></div>
      <div class="prow"><div><div class="t">复制用户名 / 密码</div></div><div class="right"><kbd>⌘C</kbd> <kbd>⇧⌘C</kbd></div></div>
    </div></div>`
        : ""
    }
    ${extNav("ext-list")}
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extDetailView(state, opts = {}) {
  const item = state.items.find((i) => i.id === state.selected) || state.items[0];
  const sections = getItemSections(item, state.revealedIds);
  const copyFeedback = (key) =>
    state.copiedKey === `${item.id}:${key}`
      ? `<span class="copy-pill">✓ ${state.clipboard ? state.clipboard.secs : 30}s</span>`
      : "";
  const showSheet = opts.forceSheet || state.extSheet;

  return `<div class="ext lp">
    ${extHeader(item.name, state, { back: true })}
    <div class="ext-scroll">
      <div class="ext-hero">
        ${AV(item, "lg")}
        <div style="min-width:0;flex:1">
          <div class="h1">${escapeHtml(item.name)}</div>
          <div class="h2">${escapeHtml(item.user || item.kindLabel)} · ${item.folder}</div>
        </div>
        <button class="iconbtn ${item.favorite ? "star-on" : ""}" data-act="toggle-fav" data-id="${item.id}" aria-label="收藏星标">${icon("star", 14)}</button>
        <button class="iconbtn" data-act="toggle-ext-sheet" aria-label="更多操作">${icon("more", 15)}</button>
      </div>

      ${
        item.otp
          ? `<div class="ext-otp ${state.copiedKey === `${item.id}:otp` ? "copied-flash" : ""}" role="button" tabindex="0" data-act="copy" data-label="验证码" data-copy-key="${item.id}:otp">
        <span class="ring" style="--p:.68"></span>
        <span class="code">${item.otp}</span>
        <span class="tnum" style="font-size:10px;color:var(--text-3)"><span class="secs">20</span>s</span>
        <span style="flex:1"></span>
        ${copyFeedback("otp")}
        <button class="iconbtn sm" data-act="ext-go" data-ext="ext-totp-qr" aria-label="查看 Google 动态二维码" title="查看二维码">${icon("qr", 13)}</button>
        <button class="iconbtn sm" data-act="copy" data-label="验证码" data-copy-key="${item.id}:otp" aria-label="复制验证码">${icon("copy", 13)}</button>
      </div>`
          : ""
      }

      ${sections
        .map(
          (sec) => `<div style="margin-top:8px">
        <div class="seclbl">${sec.title}</div>
        <div class="fbox">
          ${sec.rows
            .map(
              (
                r,
              ) => `<div class="ext-field ${state.copiedKey === `${item.id}:${r.key}` ? "copied-flash" : ""}" ${r.multiline ? "" : `role="button" tabindex="0" data-act="copy" data-label="${escapeHtml(r.label)}" data-copy-key="${item.id}:${r.key}"`}>
            <span class="k">${escapeHtml(r.label)}</span>
            <span class="v ${r.mono ? "mono" : ""}">${r.secret && r.revealed ? r.display : r.mono && r.revealed ? r.display : r.secret ? escapeHtml(r.display) : r.display} ${copyFeedback(r.key)}</span>
            <span style="display:flex;align-items:center;gap:1px">
              ${r.secret ? `<button class="iconbtn sm" data-act="reveal" data-rev-key="${item.id}:${r.key}" aria-label="显示">${icon(r.revealed ? "eyeoff" : "eye", 12)}</button>` : ""}
              <button class="iconbtn sm" data-act="copy" data-label="${escapeHtml(r.label)}" data-copy-key="${item.id}:${r.key}" aria-label="复制">${icon("copy", 12)}</button>
            </span>
          </div>`,
            )
            .join("")}
        </div>
      </div>`,
        )
        .join("")}

      ${
        item.custom && item.custom.length
          ? `<div style="margin-top:8px">
        <div class="seclbl">自定义字段</div>
        <div class="fbox">
          ${item.custom
            .map((cf, idx) => {
              const rev = state.revealedIds && state.revealedIds.has(`${item.id}:cf_${idx}`);
              return `<div class="ext-field ${state.copiedKey === `${item.id}:cf_${idx}` ? "copied-flash" : ""}" role="button" tabindex="0" data-act="copy" data-label="${escapeHtml(cf.name)}" data-copy-key="${item.id}:cf_${idx}">
              <span class="k">${escapeHtml(cf.name)}</span>
              <span class="v ${cf.hidden ? "mono" : ""}">${cf.hidden && !rev ? "••••••••" : escapeHtml(cf.value)} ${copyFeedback(`cf_${idx}`)}</span>
              <span style="display:flex;align-items:center;gap:1px">
                ${cf.hidden ? `<button class="iconbtn sm" data-act="reveal" data-rev-key="${item.id}:cf_${idx}" aria-label="显示">${icon(rev ? "eyeoff" : "eye", 12)}</button>` : ""}
                <button class="iconbtn sm" data-act="copy" data-label="${escapeHtml(cf.name)}" data-copy-key="${item.id}:cf_${idx}" aria-label="复制">${icon("copy", 12)}</button>
              </span>
            </div>`;
            })
            .join("")}
        </div>
      </div>`
          : ""
      }

      ${item.note && item.kind !== "note" ? `<div class="notecard" style="margin-top:8px;font-size:10.5px">${escapeHtml(item.note)}</div>` : ""}

      <div style="display:flex;align-items:center;gap:6px;margin-top:9px;font-size:10px;color:var(--text-3)">
        <span>修改于 ${item.updated}</span><span>·</span>
        <button style="color:var(--brand);font-weight:550" data-act="go-screen" data-surface="mac" data-screen="mac-history">在桌面端查看历史 v${item.versions ? item.versions.length : 1}</button>
      </div>
    </div>

    <div class="ext-foot">
      ${
        item.kind === "login" || item.kind === "card" || item.kind === "identity"
          ? `<button class="btn primary lg" style="flex:1" data-act="fill-from-ext" data-id="${item.id}">填充到当前网页 ↵</button>
           <button class="btn lg" data-act="open-ext-edit" data-id="${item.id}" aria-label="编辑">${icon("pencil", 14)}</button>`
          : `<button class="btn primary lg" style="flex:1" data-act="open-ext-edit" data-id="${item.id}">${icon("pencil", 13)}编辑${item.kindLabel}字段</button>`
      }
      <button class="btn lg" data-act="toggle-ext-sheet" aria-label="更多操作">${icon("more", 14)}</button>
    </div>

    ${
      showSheet
        ? `<div class="sheetwrap" data-act="toggle-ext-sheet"><div class="sheet" onclick="event.stopPropagation()">
      <div class="st">${escapeHtml(item.name)} · ${item.folder}</div>
      <button class="sb" data-act="open-ext-edit" data-id="${item.id}">${icon("pencil", 14)}编辑条目与字段</button>
      ${item.totpSecret ? `<button class="sb" data-act="ext-go" data-ext="ext-totp-qr">${icon("qr", 14)}查看 Google 动态二维码</button>` : ""}
      <button class="sb" data-act="toggle-fav" data-id="${item.id}">${icon("star", 14)}${item.favorite ? "取消收藏" : "设为收藏置顶"}</button>
      <button class="sb" data-act="archive-item" data-id="${item.id}">${icon("archive", 14)}归档（收起但不删除）</button>
      <button class="sb danger" data-act="trash-item" data-id="${item.id}">${icon("trash", 14)}移到回收站</button>
    </div></div>`
        : ""
    }

    ${
      state.extQr
        ? `<div class="sheetwrap" data-act="toggle-ext-qr"><div class="sheet" style="text-align:center;padding:14px" onclick="event.stopPropagation()">
      <div class="st">${escapeHtml(item.name)} · 动态口令二维码</div>
      <div style="display:inline-block;padding:10px;border-radius:8px;background:#fff;color:#0f172a;border:1px solid var(--border)">${svgQrMatrix(124)}</div>
      <div style="font-size:10px;color:var(--text-3);margin-top:6px">本地合成示意二维码（占位，不可扫描）</div>
      <button class="btn block" style="margin-top:9px" data-act="toggle-ext-qr">关闭</button>
    </div></div>`
        : ""
    }
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extEmptyView(state) {
  return `<div class="ext lp">
    ${extHeader("保险库", state, { showHelp: true, showNew: true })}
    <div class="empty-stage">
      <div class="icon-ring">${icon("key", 18)}</div>
      <div class="eh">保险库还没有条目</div>
      <div class="es" style="font-size:10.5px">建库完成。你可以手动添加凭证、导入现有 1PUX / CSV，或从 R2 桶恢复整座保险库。</div>
      <button class="btn primary block lg" style="margin-top:12px" data-act="ext-go" data-ext="ext-new">${icon("plus", 13)}新建第一条记录</button>
      <button class="btn block" style="margin-top:6px" data-act="ext-go" data-ext="ext-import">${icon("upload", 13)}导入 1PUX / CSV / JSON</button>
      <button class="btn block" style="margin-top:6px" data-act="ext-go" data-ext="ext-restore">${icon("cloud", 13)}从 R2 云存储恢复</button>
    </div>
    ${extNav("ext-list")}
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extTotpQrView(state) {
  const item = state.items.find((i) => i.id === state.selected) || state.items[0];
  const secret = item.totpSecret || "JBSW Y3DP EHPK 3PXP";
  return `<div class="ext lp">
    ${extHeader("动态口令二维码", state, { back: true })}
    <div class="ext-scroll" style="text-align:center;padding-top:12px">
      <div style="display:inline-block;padding:12px;border-radius:10px;background:#fff;color:#0f172a;border:1px solid var(--border)">
        ${svgQrMatrix(148)}
      </div>
      <div style="margin-top:10px;font-size:13px;font-weight:650">${escapeHtml(item.name)}</div>
      <div style="font-size:10.5px;color:var(--text-3);margin-top:2px">${escapeHtml(item.user || "")}</div>
      <div class="grp" style="margin-top:12px;text-align:left">
        <div class="ext-field" role="button" tabindex="0" data-act="copy" data-label="Base32 密钥" data-copy-val="${escapeHtml(secret)}">
          <span class="k">Base32</span><span class="v mono">${secret}</span>
          <button class="iconbtn sm" data-act="copy" data-label="Base32 密钥">${icon("copy", 12)}</button>
        </div>
        <div class="ext-field">
          <span class="k">步长</span><span class="v tnum">SHA1 · 6 位 · 30 秒</span><span class="chip ok">剩余 <span class="secs">20</span>s</span>
        </div>
      </div>
      <div class="callout" style="text-align:left">${icon("shield", 14)}<div>本地合成示意二维码（占位，不可扫描），不调用任何外部二维码生成接口；真实可扫描二维码由产品端使用 qrious 在本地生成。</div></div>
    </div>
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extGeneratorView(state) {
  return `<div class="ext lp">
    ${extHeader("生成器", state, {})}
    <div class="ext-scroll">
      <div class="segtabs" style="margin-bottom:8px">
        <button class="${state.genMode === "password" ? "on" : ""}" data-act="gen-mode" data-mode="password">随机密码</button>
        <button class="${state.genMode === "passphrase" ? "on" : ""}" data-act="gen-mode" data-mode="passphrase">密码短语</button>
      </div>
      <div class="gen-out">
        <div class="gen-pw">${syntaxPw(state.genValue)}</div>
        <div class="strength"><span class="bars"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></span><span class="txt">强 · ${state.genMode === "password" ? state.genLen + " 位" : "5 个词"}</span></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:7px">
        <button class="btn" style="flex:1" data-act="gen-pw">${icon("refresh", 12)}重新生成</button>
        <button class="btn primary" style="flex:1" data-act="copy" data-label="生成密码" data-copy-val="${escapeHtml(state.genValue)}">${icon("copy", 12)}复制</button>
      </div>
      <div class="optgrid" style="margin-top:9px">
        <div class="opt"><span class="check">${icon("check", 9)}</span>大写 A–Z</div>
        <div class="opt"><span class="check">${icon("check", 9)}</span>数字 0–9</div>
        <div class="opt"><span class="check">${icon("check", 9)}</span>符号 !@#$</div>
        <div class="opt"><span class="check">${icon("check", 9)}</span>排除易混淆</div>
      </div>
      <div class="seclbl" style="display:flex;align-items:center;justify-content:space-between">
        <span>本机生成历史（锁定清空）</span>
        <button style="color:var(--brand);font-weight:600;text-transform:none;letter-spacing:0" data-act="ext-go" data-ext="ext-generator-history">完整历史 (${state.genHistory.length}) →</button>
      </div>
      <div class="grp">
        ${state.genHistory
          .slice(0, 2)
          .map(
            (g) =>
              `<div class="prow"><div><div class="t mono">${state.genHistoryRevealed.has(g.id) ? syntaxPw(g.value) : "••••••••••••"}</div><div class="s">${g.meta}</div></div><div class="right"><button class="iconbtn sm" data-act="copy" data-label="历史密码" data-copy-val="${escapeHtml(g.value)}">${icon("copy", 12)}</button></div></div>`,
          )
          .join("")}
      </div>
    </div>
    ${extNav("ext-generator")}
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extGenHistoryView(state) {
  return `<div class="ext lp">
    ${extHeader("本机生成历史", state, { back: true })}
    <div class="ext-scroll">
      <div class="callout" style="margin-top:0">${icon("lock", 13)}<div>历史默认掩码仅暂存在扩展内存中，不落盘、不同步，锁库自动清空。</div></div>
      <div class="grp" style="margin-top:8px">
        ${
          state.genHistory.length === 0
            ? `<div style="text-align:center;padding:24px 10px;font-size:11px;color:var(--text-3)">暂无生成历史记录</div>`
            : state.genHistory
                .map((g) => {
                  const rev = state.genHistoryRevealed.has(g.id);
                  return `<div class="prow">
              <div style="min-width:0;flex:1"><div class="t mono">${rev ? syntaxPw(g.value) : "•".repeat(16)}</div><div class="s">${g.meta}</div></div>
              <div class="right">
                <button class="iconbtn sm" data-act="reveal-gen" data-id="${g.id}" aria-label="显示">${icon(rev ? "eyeoff" : "eye", 12)}</button>
                <button class="iconbtn sm" data-act="copy" data-label="历史生成值" data-copy-val="${escapeHtml(g.value)}" aria-label="复制">${icon("copy", 12)}</button>
              </div>
            </div>`;
                })
                .join("")
        }
      </div>
      <button class="btn danger block" style="margin-top:9px" data-act="clear-gen-history">清空本机生成历史</button>
    </div>
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extSyncView(state) {
  return `<div class="ext lp">
    ${extHeader("同步与恢复", state, {})}
    <div class="ext-scroll">
      <div class="panel" style="margin-top:0">
        <div class="prow">
          <span class="dot ${state.dirtyCount ? "warn" : ""}"></span>
          <div><div class="t">${state.dirtyCount ? `待上传 ${state.dirtyCount} 项改动` : "已同步 · 加密镜像"}</div><div class="s">上次 ${state.lastSyncText} · 桶 lp-7f3a</div></div>
          <div class="right"><button class="btn sm primary" data-act="sync-now">立即同步</button></div>
        </div>
      </div>
      <div class="panel">
        <div class="setrow"><div><div class="k">自动同步（原型概念 · 产品未实现）</div><div class="d">产品仅支持手动同步；此开关只演示 30 秒去抖自动上传的概念</div></div><div class="right"><span class="toggle ${state.autoSync ? "" : "off"}" role="switch" aria-checked="${state.autoSync}" data-act="toggle-autosync"></span></div></div>
        <div class="setrow"><div><div class="k">桌面端原生联动</div><div class="d">com.localpass.desktop</div></div><div class="right"><span class="chip ${state.nativeBridgeOn ? "ok" : ""}">${state.nativeBridgeOn ? "已连接" : "未连接"}</span></div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
        <button class="btn block" data-act="ext-go" data-ext="ext-backup-config">${icon("sliders", 12)}配置 R2 存储</button>
        <button class="btn block" data-act="ext-go" data-ext="ext-restore">${icon("download", 12)}从桶恢复</button>
      </div>
      <div class="seclbl">本机与远端设备</div>
      <div class="grp">
        ${R2_DEVICES.map((d) => `<div class="prow"><div><div class="t">${d.name}</div><div class="s">${d.last}</div></div><div class="right"><span class="chip ${d.current ? "ok" : ""}">${d.current ? "当前" : "可信"}</span></div></div>`).join("")}
      </div>
    </div>
    ${extNav("ext-sync")}
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extSettingsView(state) {
  const secRows = [
    ["ext-security", "shield", "安全设置与自动锁定", "剪贴板 30s · 密码收回 · 触控 ID 桥接"],
    ["ext-security-key", "key", "硬件安全密钥 (WebAuthn PRF)", "扩展专属 · 已登记 2 个安全密钥"],
    ["ext-network", "wifi", "网络闸门", "仅允许 R2 白名单 · 0 遥测"],
  ];
  const orgRows = [
    ["ext-health", "alert", "离线安全体检", "4 项待改善（弱密码 / 重复 / 缺 2FA）"],
    ["ext-folders", "folder", "文件夹管理", `${FOLDERS.length} 个分组 · 解散不影响条目`],
    ["ext-archive", "archive", "已归档条目", `${state.archived.length} 条 · 不进默认推荐`],
    ["ext-trash", "trash", "回收站（30 天）", `${state.trash.length} 条待清理 · 可一键恢复`],
  ];
  const dataRows = [
    ["ext-import", "upload", "导入（1PUX / CSV / JSON）", "支持 Google Authenticator 当前页截屏"],
    ["ext-export", "download", "导出备份（JSON / CSV）", "含加密 JSON 推荐与明文警示"],
    ["ext-backup-config", "cloud", "R2 存储配置与 CORS", "桶 lp-7f3a · Ed25519 防回滚"],
    [
      "ext-appearance",
      "sliders",
      "外观与紧凑密度",
      state.density === "ultra" ? "极紧模式 32px" : "紧凑模式 36px",
    ],
    ["ext-data", "lock", "数据与安全清空", "清空本机扩展库前提醒先导出"],
    ["ext-about", "info", "关于与零敏感诊断", "v2026.11.2 · GPL-3.0"],
  ];
  const groupHtml = (arr) =>
    `<div class="grp">${arr
      .map(
        ([
          go,
          ic,
          t,
          d,
        ]) => `<button class="setrow" style="width:100%;text-align:left" data-act="ext-go" data-ext="${go}">
    ${icon(ic, 14)}<div><div class="k">${t}</div><div class="d">${d}</div></div><div class="right">${icon("chevron", 12)}</div>
  </button>`,
      )
      .join("")}</div>`;

  return `<div class="ext lp">
    ${extHeader("设置", state, {})}
    <div class="ext-scroll">
      <div class="seclbl">安全与解锁（扩展能力边界）</div>
      ${groupHtml(secRows)}
      <div class="seclbl">组织与体检</div>
      ${groupHtml(orgRows)}
      <div class="seclbl">迁移、同步与系统</div>
      ${groupHtml(dataRows)}
    </div>
    ${extNav("ext-settings")}
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extSecurityView(state) {
  return `<div class="ext lp">
    ${extHeader("安全设置", state, { back: true })}
    <div class="ext-scroll">
      <div class="grp">
        <div class="setrow" style="cursor:pointer" data-act="ext-go" data-ext="ext-security-key"><div><div class="k">硬件安全密钥 (WebAuthn PRF)</div><div class="d">已登记 ${PRF_KEYS.length} 个（仅保存于此扩展本机）</div></div><div class="right"><span class="chip ok">已就绪</span>${icon("chevron", 12)}</div></div>
        <div class="setrow"><div><div class="k">桌面端触控 ID 代理桥接</div><div class="d">通过 <span class="mono">com.localpass.desktop</span> 请求 Mac 解锁</div></div><div class="right"><span class="toggle ${state.nativeBridgeOn ? "" : "off"}" role="switch" tabindex="0" aria-checked="${state.nativeBridgeOn}" aria-label="桌面端触控 ID 代理桥接" data-act="toggle-bridge"></span></div></div>
        <div class="setrow"><div><div class="k">剪贴板自动清除</div><div class="d">复制密码 30 秒后自动清空</div></div><div class="right"><span class="chip brand">30 秒</span></div></div>
        <div class="setrow"><div><div class="k">密码显示自动收回</div><div class="d">30 秒后恢复掩码</div></div><div class="right"><span class="toggle" role="switch" tabindex="0" aria-checked="true" aria-label="密码显示自动收回"></span></div></div>
      </div>
      <button class="btn primary block" style="margin-top:9px" data-act="ext-go" data-ext="ext-security-key">管理 WebAuthn PRF 安全密钥 →</button>
      <div style="margin-top:8px;font-size:9.5px;color:var(--text-3);line-height:1.5">说明：浏览器扩展不提供原生指纹按钮，触控 ID 依赖 Mac 桌面端运行桥接；连续输错 5 次只递增等待，绝不销毁本地库。</div>
    </div>
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extSecurityKeyView(state) {
  return `<div class="ext lp">
    ${extHeader("WebAuthn PRF 安全密钥", state, { back: true })}
    <div class="ext-scroll">
      <div style="border:1px solid var(--border);border-radius:9px;padding:16px 12px;text-align:center;background:var(--bg-alt)">
        <div class="prf-pulse">${icon("key", 22)}</div>
        <div style="font-size:13px;font-weight:650">${state.extSecurityKeyState === "waiting" ? "请轻触或插入你的安全密钥" : "已验证扩展专属 PRF 密钥"}</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;line-height:1.45">${state.extSecurityKeyState === "waiting" ? "正在等待 Chrome 原生 WebAuthn PRF 返回硬件派生密钥（无需等待进度条，碰触即完成）" : "YubiKey 5C NFC 响应正常 · 已使用 PRF 算法解封本机主密钥"}</div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn primary block sm" data-act="ext-prf-toggle">${state.extSecurityKeyState === "waiting" ? "模拟触摸钥匙完成" : "再次触发触摸"}</button>
          <button class="btn block sm" data-act="ext-go" data-ext="ext-unlock">切回密码解锁</button>
        </div>
      </div>
      <div class="seclbl">本机已登记密钥（不同步到 R2 / 桌面）</div>
      <div class="grp">
        ${PRF_KEYS.map(
          (k) => `<div class="prow">
          ${icon("key", 13)}
          <div style="min-width:0;flex:1"><div class="t">${k.name}</div><div class="s">登记于 ${k.added} · 最近 ${k.lastUsed}</div></div>
          <button class="iconbtn sm" data-act="toast-msg" data-msg="已解除绑定 ${k.name}">${icon("trash", 12)}</button>
        </div>`,
        ).join("")}
      </div>
      <div class="callout" style="margin-top:8px">${icon("info", 13)}<div>PRF 凭据绑定扩展本机 Origin，不随 <span class="mono">account.json</span> 同步到其他浏览器或桌面端。</div></div>
    </div>
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extUnlockView(state, waitMode = false) {
  return `<div class="ext lp">
    ${extHeader("LocalPass", state, {})}
    <div class="unlock">
      <span class="av xl av-blue">LP</span>
      <div class="h">${waitMode ? "请稍候再试" : "保险库已锁定"}</div>
      <div class="s">${waitMode ? "连续输错 5 次 PIN / 密码，为防暴力尝试需等待（重启不清零，绝不删库）" : "输入安全密码、插入 PRF 安全密钥，或使用 Mac 触控 ID 代理"}</div>
      ${
        waitMode
          ? `<div class="tnum" style="font-size:26px;font-weight:700;margin-top:12px;color:var(--warning)">00:${String(state.unlockWaitSecs).padStart(2, "0")}</div>`
          : `<input type="password" value="••••••••••••" aria-label="安全密码" />`
      }
      <button class="btn primary block lg" style="margin-top:9px" ${waitMode ? "disabled" : ""} data-act="unlock-all">解锁 ↵</button>
      ${!waitMode && state.nativeBridgeOn ? `<button class="btn block" style="margin-top:6px" data-act="unlock-all">${icon("touchid", 13)}通过 Mac 桌面端触控 ID 解锁</button>` : ""}
      ${!waitMode ? `<button class="btn block" style="margin-top:6px" data-act="ext-go" data-ext="ext-security-key">${icon("key", 13)}使用安全密钥 (WebAuthn PRF)</button>` : ""}
      ${waitMode ? `<button class="btn block" style="margin-top:8px" data-act="ext-go" data-ext="ext-restore">忘记密码？从 R2 桶恢复</button>` : ""}
      <div class="foot">${icon("wifi", 11)} 离线可用 · 忘记密码只能从恢复包重建</div>
    </div>
    ${toastMarkup(state, "ext")}
  </div>`;
}

function extSubpageView(state, id) {
  if (id === "ext-new") {
    return `<div class="ext lp">${extHeader("新建条目", state, { back: true })}<div class="ext-scroll">
      <div class="seclbl">选择 8 类条目（每种默认字段不同）</div>
      <div class="typegrid">${ITEM_KINDS.map((k) => `<button class="${state.newKind === k.id ? "on" : ""}" data-act="pick-kind" data-kind="${k.id}">${icon(k.icon, 15)}<span>${k.label}</span></button>`).join("")}</div>
      <button class="btn primary block lg" style="margin-top:10px" data-act="ext-open-new-form">下一步：填写字段</button>
      <div style="margin-top:8px;font-size:10px;color:var(--text-3)">提示：仅「登录」与「卡片 / 身份」会参与网页自动匹配与内联弹出。</div>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-form") {
    const draft = state.formDraft || buildFormDraft(state.newKind || "login");
    const kindObj = ITEM_KINDS.find((x) => x.id === draft.kind) || ITEM_KINDS[0];
    return `<div class="ext lp">${extHeader(`${draft.editingId ? "编辑" : "新建"}${kindObj.label}`, state, { back: true })}<div class="ext-scroll">
      <div class="segtabs" style="margin-bottom:8px;overflow-x:auto">
        ${ITEM_KINDS.slice(0, 4)
          .map(
            (k) =>
              `<button class="${draft.kind === k.id ? "on" : ""}" data-act="pick-kind" data-kind="${k.id}">${k.label}</button>`,
          )
          .join("")}
      </div>
      <div class="segtabs" style="margin-bottom:8px;margin-top:-4px;overflow-x:auto">
        ${ITEM_KINDS.slice(4)
          .map(
            (k) =>
              `<button class="${draft.kind === k.id ? "on" : ""}" data-act="pick-kind" data-kind="${k.id}">${k.label}</button>`,
          )
          .join("")}
      </div>
      ${renderDynamicFormFields(state, true)}
      <button class="btn primary block lg" style="margin-top:10px" data-act="save-ext-form">${draft.editingId ? "保存更新" : "保存到本机"}</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-folders") {
    return `<div class="ext lp">${extHeader("文件夹管理", state, { back: true })}<div class="ext-scroll">
      <div class="grp">
        <button class="prow" style="width:100%;text-align:left" data-act="ext-go" data-ext="ext-list">
          ${icon("grid", 14)}<div><div class="t">全部条目</div><div class="s">包含未分组与全部文件夹</div></div><span class="chip brand">${state.items.length}</span>
        </button>
        ${FOLDERS.map(
          (
            f,
          ) => `<button class="prow" style="width:100%;text-align:left" data-act="toast-msg" data-msg="已筛选文件夹：${f.name}">
          <span class="fdot" style="width:9px;height:9px;border-radius:3px;background:${f.color}"></span>
          <div><div class="t">${f.name}</div><div class="s">解散文件夹不影响条目本身</div></div>
          <span class="chip">${f.count}</span>
        </button>`,
        ).join("")}
      </div>
      <button class="btn block" style="margin-top:9px" data-act="toast-msg" data-msg="已新建文件夹「开发测试」">${icon("plus", 12)}新建文件夹</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-archive") {
    return `<div class="ext lp">${extHeader("已归档条目", state, { back: true })}<div class="ext-scroll">
      <div class="callout" style="margin-top:0">${icon("archive", 13)}<div>归档只收起旧凭证，不进搜索与内联推荐，永不自动清理。</div></div>
      <div class="grp" style="margin-top:8px">
        ${state.archived
          .map(
            (a) => `<div class="prow">
          ${AV(a, "sm")}
          <div style="min-width:0;flex:1"><div class="t">${escapeHtml(a.name)}</div><div class="s">${escapeHtml(a.user)} · ${a.archivedAt}</div></div>
          <button class="btn sm" data-act="unarchive" data-id="${a.id}">取消归档</button>
        </div>`,
          )
          .join("")}
      </div>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-trash") {
    return `<div class="ext lp">${extHeader("回收站（30 天）", state, { back: true })}<div class="ext-scroll">
      <div class="grp">
        ${state.trash
          .map(
            (t) => `<div class="prow">
          ${AV(t, "sm")}
          <div style="min-width:0;flex:1"><div class="t">${escapeHtml(t.name)}</div><div class="s">${t.remain} · ${t.folder}</div></div>
          <button class="btn sm primary" data-act="restore-trash" data-id="${t.id}">恢复</button>
        </div>`,
          )
          .join("")}
      </div>
      <button class="btn danger block" style="margin-top:9px" data-act="toast-msg" data-msg="已确认清空扩展回收站（不影响云端旧快照）">清空回收站</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-health") {
    const shortSub = {
      "atlas-bank": "Atlas Bank · 与个人邮箱共用同一密码",
      acme: "Acme Cloud · 12 位无符号（已支持通行密钥）",
      "northwind-staging": "Northwind Staging · 412 天未更换",
      "acme-2fa": "Acme Cloud · 站点支持 2FA 验证",
    };
    return `<div class="ext lp">${extHeader("离线安全体检", state, { back: true })}<div class="ext-scroll">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        <div class="stat bad" style="padding:6px 8px"><div class="n" style="font-size:15px">1</div><div class="l">重复密码</div></div>
        <div class="stat warn" style="padding:6px 8px"><div class="n" style="font-size:15px">2</div><div class="l">弱/超期</div></div>
        <div class="stat ok" style="padding:6px 8px"><div class="n" style="font-size:15px">${Math.max(0, state.items.length - 3)}</div><div class="l">强密码</div></div>
      </div>
      <div class="grp" style="margin-top:8px">
        ${HEALTH_ISSUES.map(
          (h) => `<div class="prow">
          <span class="chip ${h.tone}">${h.tag}</span>
          <div style="min-width:0;flex:1"><div class="t">${h.title}</div><div class="s">${shortSub[h.id] || h.sub}</div></div>
          <button class="btn sm primary" data-act="open-ext-edit" data-id="${h.id === "acme-2fa" ? "acme" : h.id}">去改</button>
        </div>`,
        ).join("")}
      </div>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-import") {
    return `<div class="ext lp">${extHeader("导入来源", state, { back: true })}<div class="ext-scroll">
      <div class="grp">
        ${IMPORT_SOURCES.map(
          (
            s,
          ) => `<button class="prow" style="width:100%;text-align:left" data-act="ext-go" data-ext="ext-import-preview">
          <div style="min-width:0;flex:1"><div class="t">${s.name}</div><div class="s">${s.sub}</div></div><span class="chip">${s.badge}</span>
        </button>`,
        ).join("")}
      </div>
      <button class="btn block" style="margin-top:9px" data-act="toast-msg" data-msg="已截取当前标签页识别 otpauth:// 二维码">${icon("qr", 12)}截取当前标签页二维码导入 2FA</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-import-preview") {
    return `<div class="ext lp">${extHeader("导入去重预览", state, { back: true })}<div class="ext-scroll">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        <div class="stat ok" style="padding:6px 8px"><div class="n" style="font-size:15px">2</div><div class="l">将新增</div></div>
        <div class="stat warn" style="padding:6px 8px"><div class="n" style="font-size:15px">1</div><div class="l">重复跳过</div></div>
        <div class="stat bad" style="padding:6px 8px"><div class="n" style="font-size:15px">1</div><div class="l">无法识别</div></div>
      </div>
      <div class="segtabs" style="margin-top:8px">
        <button class="${state.importConflictMode === "skip" ? "on" : ""}" data-act="import-mode" data-mode="skip">重复跳过</button>
        <button class="${state.importConflictMode === "overwrite" ? "on" : ""}" data-act="import-mode" data-mode="overwrite">重复覆盖</button>
      </div>
      <div class="grp" style="margin-top:8px">
        ${IMPORT_PREVIEW_ROWS.map(
          (r) => `<div class="prow">
          <span class="chip ${r.status === "new" ? "ok" : r.status === "dup" ? "warn" : "bad"}">${r.statusLabel}</span>
          <div style="min-width:0;flex:1"><div class="t">${r.name}</div><div class="s">${r.detail}</div></div>
        </div>`,
        ).join("")}
      </div>
      <button class="btn primary block lg" style="margin-top:9px" data-act="toast-msg" data-msg="已写入 2 条新条目并跳过 1 条重复">确认导入 2 条</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-export") {
    return `<div class="ext lp">${extHeader("导出备份", state, { back: true })}<div class="ext-scroll">
      <div class="grp">
        <button class="setrow" style="width:100%;text-align:left;background:${state.exportFormat === "encrypted_json" ? "var(--brand-softer)" : ""}" data-act="pick-export" data-fmt="encrypted_json"><div><div class="k">加密 JSON（推荐）</div><div class="d">带备份口令，安全可迁移</div></div><div class="right"><span class="chip brand">推荐</span></div></button>
        <button class="setrow" style="width:100%;text-align:left;background:${state.exportFormat === "csv" ? "var(--brand-softer)" : ""}" data-act="pick-export" data-fmt="csv"><div><div class="k">通用 CSV / 明文 JSON</div><div class="d">含明文密码风险警示</div></div><div class="right"><span class="chip">可选</span></div></button>
      </div>
      <div class="grp" style="margin-top:8px">
        <div class="ext-field" role="button" tabindex="0" data-act="copy" data-label="备份口令" data-copy-val="${escapeHtml(R2_CONFIG.backupPassphrase)}"><span class="k">备份口令</span><span class="v mono">••••••••••••</span><button class="iconbtn sm" data-act="copy" data-label="备份口令" data-copy-val="${escapeHtml(R2_CONFIG.backupPassphrase)}" aria-label="复制备份口令">${icon("copy", 12)}</button></div>
      </div>
      <input type="password" value="••••••••••••" aria-label="输入安全密码确认" style="width:100%;height:30px;margin-top:8px;border:1px solid var(--border);border-radius:6px;padding:0 8px;background:var(--bg-alt)" />
      <button class="btn primary block lg" style="margin-top:9px" data-act="toast-msg" data-msg="已校验密码并下载导出文件">验证并导出</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-backup-config") {
    return `<div class="ext lp">${extHeader("R2 存储配置", state, { back: true })}<div class="ext-scroll">
      <div class="grp">
        <div class="frow"><div class="lb">端点</div><div class="iv"><input class="mono" value="${R2_CONFIG.endpoint}" /></div></div>
        <div class="frow"><div class="lb">桶名</div><div class="iv"><input class="mono" value="${R2_CONFIG.bucket}" /></div></div>
        <div class="frow"><div class="lb">Key ID</div><div class="iv"><input class="mono" value="${R2_CONFIG.accessKeyId}" /></div></div>
        <div class="frow"><div class="lb">Secret</div><div class="iv"><input type="password" value="••••••••••••" /></div></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn" style="flex:1" data-act="test-r2">测试连接</button>
        <button class="btn" style="flex:1" data-act="copy" data-label="R2 CORS" data-copy-val="${escapeHtml(R2_CONFIG.corsJson)}">复制 CORS</button>
      </div>
      <button class="btn primary block lg" style="margin-top:6px" data-act="toast-msg" data-msg="已保存 R2 存储配置与 CORS 白名单">保存并启用</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-restore") {
    return `<div class="ext lp">${extHeader("从 R2 云存储恢复", state, { back: true })}<div class="ext-scroll">
      <div class="panel" style="margin-top:0">
        <div class="prow"><div><div class="t">锚点校验通过 · account.json</div><div class="s">gen #${R2_RESTORE_PREVIEW.gen} · ${R2_RESTORE_PREVIEW.itemCount} 条目 · ${R2_RESTORE_PREVIEW.folderCount} 文件夹</div></div><span class="chip ok">已对齐</span></div>
      </div>
      <div class="callout warn">${icon("alert", 13)}<div>恢复将用云端快照覆盖本机扩展存储；WebAuthn PRF 硬件密钥不同步，恢复后需重绑。</div></div>
      <input type="password" value="••••••••••••" aria-label="输入原安全密码" style="width:100%;height:30px;margin-top:8px;border:1px solid var(--border);border-radius:6px;padding:0 8px;background:var(--bg-alt)" />
      <button class="btn primary block lg" style="margin-top:8px" data-act="ext-go" data-ext="ext-list">验证并重建扩展保险库</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-network") {
    return `<div class="ext lp">${extHeader("网络闸门", state, { back: true })}<div class="ext-scroll">
      <div class="seclbl">允许出站白名单（锁库为 0 请求）</div>
      <div class="grp">${NETWORK_ALLOWLIST.map((n) => `<div class="prow"><div style="min-width:0;flex:1"><div class="t mono">${n.host}</div><div class="s">${n.purpose}</div></div><span class="chip ${n.on ? "ok" : ""}">${n.on ? "允许" : "关"}</span></div>`).join("")}</div>
      <div class="seclbl">默认拒绝策略（Default Deny）</div>
      <div class="grp">${NETWORK_DEFAULT_RULES.map((r) => `<div class="prow"><div style="min-width:0;flex:1"><div class="t">${r.title}</div><div class="s">${r.sub}</div></div><span class="chip ok">${r.badge}</span></div>`).join("")}</div>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-data") {
    return `<div class="ext lp">${extHeader("数据与安全", state, { back: true })}<div class="ext-scroll">
      <div class="callout bad" style="margin-top:0">${icon("alert", 13)}<div><strong>LocalPass 没有可找回安全密码的服务端账号。</strong>清空前请务必先导出 JSON 备份或确认拥有 R2 桶恢复口令。</div></div>
      <button class="btn block" style="margin-top:8px" data-act="ext-go" data-ext="ext-export">${icon("download", 12)}先导出备份文件</button>
      <div style="margin-top:10px;padding:9px;border:1px solid color-mix(in srgb, var(--danger) 35%, transparent);border-radius:7px">
        <button class="check-btn" data-act="toggle-wipe-confirm">
          <span class="check ${state.wipeConfirmed ? "" : "off"}">${state.wipeConfirmed ? icon("check", 9) : ""}</span>
          <span>我已知晓将清除本机扩展库全部密文</span>
        </button>
        <button class="btn primary danger-fill block" style="margin-top:8px" ${state.wipeConfirmed ? "" : "disabled"} data-act="ext-go" data-ext="ext-setup">清空本机数据并重置扩展</button>
      </div>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  if (id === "ext-about") {
    return `<div class="ext lp">${extHeader("关于与离线诊断", state, { back: true })}<div class="ext-scroll">
      <div class="grp">
        <div class="ext-field"><span class="k">版本</span><span class="v mono">2026.11.2-compact-v4</span><span class="chip brand">GPL-3.0</span></div>
        <div class="ext-field"><span class="k">原生桥接</span><span class="v mono">com.localpass.desktop</span><span class="chip ok">正常</span></div>
      </div>
      <div class="seclbl">零敏感诊断包</div>
      <pre class="codeblock" style="margin:0">${escapeHtml(DIAGNOSTIC_SAMPLE)}</pre>
      <button class="btn primary block" style="margin-top:8px" data-act="copy" data-label="零敏感诊断包" data-copy-val="${escapeHtml(DIAGNOSTIC_SAMPLE)}">${icon("copy", 12)}复制零敏感诊断信息</button>
    </div>${toastMarkup(state, "ext")}</div>`;
  }
  return `<div class="ext lp">${extHeader("外观与密度", state, { back: true })}<div class="ext-scroll">
    <div class="seclbl">列表密度</div>
    <div class="segtabs">
      <button class="${state.density === "compact" ? "on" : ""}" data-act="set-density" data-d="compact">紧凑 36px</button>
      <button class="${state.density === "ultra" ? "on" : ""}" data-act="set-density" data-d="ultra">极紧 32px</button>
    </div>
    <div class="seclbl">主题模式</div>
    <div class="grp">
      <div class="setrow"><div><div class="k">深色模式</div><div class="d">跟随右上角全局暗色预览</div></div><div class="right"><span class="chip">${state.theme === "dark" ? "暗色" : "亮色"}</span></div></div>
    </div>
  </div></div>`;
}

function renderExtWorkspace(state, screenId, respectLock = false) {
  if (screenId === "ext-unlock" || (state.locked && respectLock))
    return extUnlockView(state, false);
  if (screenId === "ext-unlock-wait") return extUnlockView(state, true);
  if (screenId === "ext-setup") {
    return `<div class="ext lp">${extHeader("创建保险库", state, {})}<div class="unlock">
      <span class="av xl av-blue">LP</span>
      <div class="h">在这台设备建立本地保险库</div>
      <div class="s">无账号、无服务器。忘记安全密码只能从恢复包重建。</div>
      <input type="password" value="••••••••••••" aria-label="设置安全密码" />
      <input type="password" value="••••••••••••" aria-label="确认安全密码" style="margin-top:7px" />
      <button class="btn primary block lg" style="margin-top:9px" data-act="ext-go" data-ext="ext-empty">创建保险库</button>
      <button class="btn block" style="margin-top:6px" data-act="ext-go" data-ext="ext-restore">从 R2 云存储恢复</button>
    </div></div>`;
  }
  if (screenId === "ext-empty") return extEmptyView(state);
  if (screenId === "ext-detail") return extDetailView(state);
  if (screenId === "ext-item-more") return extDetailView(state, { forceSheet: true });
  if (screenId === "ext-totp-qr") return extTotpQrView(state);
  if (screenId === "ext-generator") return extGeneratorView(state);
  if (screenId === "ext-generator-history") return extGenHistoryView(state);
  if (screenId === "ext-sync") return extSyncView(state);
  if (screenId === "ext-settings") return extSettingsView(state);
  if (screenId === "ext-security") return extSecurityView(state);
  if (screenId === "ext-security-key") return extSecurityKeyView(state);
  if (
    [
      "ext-new",
      "ext-form",
      "ext-folders",
      "ext-archive",
      "ext-trash",
      "ext-health",
      "ext-import",
      "ext-import-preview",
      "ext-export",
      "ext-backup-config",
      "ext-restore",
      "ext-network",
      "ext-data",
      "ext-about",
      "ext-appearance",
    ].includes(screenId)
  ) {
    return extSubpageView(state, screenId);
  }
  return extListView(state);
}
