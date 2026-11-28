/* ==========================================================================
   LocalPass · AGY Compact v4 — Browser Web Linkage & Live 3-Surface Sandbox
   Anchored Inline Menu (Login / Passkey / TOTP / Card / Identity / Register /
   Inline Unlock w/ Mac Touch ID Bridge) + Save/Update Bar + Collapsed Pill.
   ========================================================================== */

function inlineMenuPopup(state) {
  if (state.inlineMode === "none" || state.saveBarOpen || state.atRiskBarOpen) return "";
  const mode = state.locked && state.inlineMode !== "collapsed" ? "unlock" : state.inlineMode;

  if (mode === "collapsed") {
    return `<div class="inline lp" style="left:304px;top:184px;border-radius:7px">
      <div class="in-row" style="min-height:32px;background:var(--success-soft)">
        <span style="width:18px;height:18px;border-radius:50%;background:var(--success);color:#fff;display:grid;place-items:center">${icon("check", 11)}</span>
        <span style="flex:1;min-width:0"><span class="t">已填充 alex@northwind.io</span><span class="s">可随时撤销或切换账户</span></span>
        <button class="btn sm" data-act="set-inline" data-imode="login">切换</button>
      </div>
    </div>`;
  }

  if (mode === "unlock") {
    return `<div class="inline lp" style="left:304px;top:184px" role="dialog" aria-modal="true" aria-label="网页内联解锁">
      <div class="in-h"><span class="av sm av-blue" style="width:15px;height:15px;font-size:7px">LP</span><span class="name">LocalPass</span><span>· 已锁定</span>
        <span class="right"><button class="iconbtn sm" data-act="set-inline" data-imode="collapsed" aria-label="关闭">${icon("x", 12)}</button></span>
      </div>
      <div style="padding:9px 9px 8px">
        <div style="font-size:10.5px;color:var(--text-2);display:flex;align-items:center;gap:5px">${icon("lock", 13)}解锁后可填充 <b>northwind.io</b></div>
        <input type="password" value="••••••••••••" aria-label="安全密码" style="width:100%;height:28px;margin-top:7px;border:1px solid var(--border);border-radius:5px;padding:0 8px;background:var(--bg-alt);font-size:11px" />
        <div style="display:flex;gap:5px;margin-top:6px">
          <button class="btn primary sm" style="flex:1;height:26px" data-act="unlock-all">解锁 ↵</button>
          ${state.nativeBridgeOn ? `<button class="btn sm" style="height:26px" data-act="unlock-all">${icon("touchid", 12)}Mac 触控 ID</button>` : ""}
        </div>
        <div style="margin-top:6px;font-size:9px;color:var(--text-3)">通过原生消息解锁后，桌面端与扩展弹窗同步进入可用态。</div>
      </div>
    </div>`;
  }

  if (mode === "totp") {
    return `<div class="inline lp" style="left:304px;top:184px" role="dialog" aria-modal="true" aria-label="验证码内联选择">
      <div class="in-h"><span class="av sm av-blue" style="width:15px;height:15px;font-size:7px">LP</span><span class="name">LocalPass</span><span>· 验证码</span>
        <span class="right"><span class="chip ok">剩余 <span class="secs">20</span>s</span></span>
      </div>
      <button class="in-row on" style="min-height:42px" data-act="fill-totp">
        <span class="ring" style="--p:.68"></span>
        <span><span class="t mono" style="font-size:14px;letter-spacing:.08em">492 106</span><span class="s">alex@northwind.io · 填充后自动复制</span></span>
        <span class="m"><span class="btn sm primary">填充 ↵</span></span>
      </button>
      <button class="in-row" style="min-height:30px" data-act="copy" data-label="验证码" data-copy-key="northwind:otp">
        ${icon("copy", 13)}<span style="font-size:10.5px;color:var(--text-2)">只复制到剪贴板，不填充输入框</span><span class="m"><kbd>⌘C</kbd></span>
      </button>
      <div class="in-foot">
        <button data-act="set-inline" data-imode="login">${icon("refresh", 11)}切换账户</button>
        <span class="right">Northwind</span>
      </div>
    </div>`;
  }

  if (mode === "totp-filled") {
    return `<div class="inline lp" style="left:304px;top:184px">
      <div class="in-h"><span class="av sm av-blue" style="width:15px;height:15px;font-size:7px">LP</span><span class="name">LocalPass</span><span>· 已填入验证码</span></div>
      <div class="in-row" style="min-height:38px;background:var(--success-soft)">
        <span style="width:18px;height:18px;border-radius:50%;background:var(--success);color:#fff;display:grid;place-items:center">${icon("check", 11)}</span>
        <span><span class="t">验证码已填入（自动复制）</span><span class="s tnum">剩余 <span class="secs">18</span>s · 过期自动失效</span></span>
        <span class="m"><button class="btn sm" data-act="set-inline" data-imode="totp">撤销</button></span>
      </div>
    </div>`;
  }

  if (mode === "passkey" || mode === "passkey-verifying") {
    return `<div class="inline lp" style="left:304px;top:184px">
      <div class="in-h"><span class="av sm av-blue" style="width:15px;height:15px;font-size:7px">LP</span><span class="name">LocalPass</span><span>· 通行密钥</span></div>
      ${
        mode === "passkey-verifying"
          ? `<div class="in-row" style="min-height:46px">
            <span style="width:20px;height:20px;border-radius:50%;border:2px solid var(--brand);border-top-color:transparent"></span>
            <span><span class="t">等待系统触控 ID 确认…</span><span class="s">网站仅收到一次签名，私钥不出本机</span></span>
          </div>
          <div class="in-foot"><button data-act="set-inline" data-imode="passkey">取消</button><span class="right">30s 超时</span></div>`
          : `<button class="in-row on" style="min-height:42px" data-act="set-inline" data-imode="passkey-verifying">
            ${icon("touchid", 16)}<span><span class="t">使用通行密钥登录</span><span class="s">alex@northwind.io · 触控 ID 验证</span></span>
            <span class="m"><span class="btn sm primary">继续</span></span>
          </button>
          <div class="in-foot"><button data-act="set-inline" data-imode="login">${icon("key", 11)}改用密码</button><span class="right">esc 取消</span></div>`
      }
    </div>`;
  }

  if (mode === "card") {
    const cards = state.items.filter((i) => i.kind === "card");
    return `<div class="inline lp" style="left:304px;top:184px">
      <div class="in-h"><span class="av sm av-green" style="width:15px;height:15px;font-size:7px">C</span><span class="name">LocalPass</span><span>· 银行卡</span></div>
      ${cards
        .map(
          (
            c,
            idx,
          ) => `<button class="in-row ${idx === 0 ? "on" : ""}" data-act="fill-card" data-id="${c.id}">
        ${AV(c, "sm")}
        <span style="min-width:0"><span class="t">${escapeHtml(c.name)} ${c.isDefault ? `<span class="chip brand">默认</span>` : ""}</span><span class="s mono">•••• ${c.cardLast4} · ${c.expiry || `${c.expMonth}/${String(c.expYear || "").slice(-2)}`}</span></span>
        <span class="m"><span class="btn sm primary fillbtn">填充</span></span>
      </button>`,
        )
        .join("")}
      <div class="in-kbd"><span>默认隐藏完整卡号</span><span class="right">↑↓ ↵ esc</span></div>
    </div>`;
  }

  if (mode === "identity") {
    const idItem = state.items.find((i) => i.kind === "identity");
    return `<div class="inline lp" style="left:304px;top:243px">
      <div class="in-h"><span class="av sm av-teal" style="width:15px;height:15px;font-size:7px">ID</span><span class="name">LocalPass</span><span>· 身份与地址</span></div>
      <button class="in-row on" data-act="toast-msg" data-msg="已填充收件人与常用地址">
        ${AV(idItem, "sm")}
        <span style="min-width:0"><span class="t">${escapeHtml(idItem.name)} <span class="chip brand">默认</span></span><span class="s">${escapeHtml(idItem.address)}</span></span>
        <span class="m"><span class="btn sm primary">填充 ↵</span></span>
      </button>
    </div>`;
  }

  if (mode === "register") {
    return `<div class="inline lp" style="left:304px;top:243px">
      <div class="in-h"><span class="av sm av-blue" style="width:15px;height:15px;font-size:7px">LP</span><span class="name">LocalPass</span><span>· 强密码建议</span></div>
      <button class="in-row on" style="min-height:40px" data-act="trigger-save-bar">
        ${icon("wand", 15)}
        <span style="min-width:0"><span class="t mono" style="font-size:11.5px">${syntaxPw(state.genValue)}</span><span class="s">20 位强密码 · 填入并弹出保存确认条</span></span>
        <span class="m"><span class="btn sm primary">填入</span></span>
      </button>
      <div class="in-foot"><button data-act="gen-pw">${icon("refresh", 11)}换一个</button><span class="right">只在本机生成</span></div>
    </div>`;
  }

  if (mode === "empty") {
    return `<div class="inline lp" style="left:304px;top:184px" role="dialog" aria-modal="true" aria-label="过滤无匹配空态">
      <div class="in-h">
        <span class="av sm av-blue" style="width:15px;height:15px;font-size:7px">LP</span>
        <span class="name">LocalPass</span><span>· northwind.io</span>
        <span class="right"><span class="chip warn">筛选无命中</span></span>
      </div>
      <div style="padding:14px 12px;text-align:center">
        <div style="font-size:11.5px;font-weight:600">没有匹配「${escapeHtml(state.webFilterQuery)}」的账户</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px">此站点共保存 3 个登录条目，可清除关键字或新增一条</div>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:9px">
          <button class="btn sm primary" data-act="set-inline" data-imode="login">显示全部 3 个账户</button>
          <button class="btn sm" data-act="go-screen" data-surface="ext" data-screen="ext-new">在扩展新建</button>
        </div>
      </div>
      <div class="in-foot">
        <button data-act="go-screen" data-surface="ext" data-screen="ext-list">${icon("search", 11)}在扩展中搜全部</button>
        <span class="right">esc 关闭</span>
      </div>
    </div>`;
  }

  if (mode === "no-match") {
    return `<div class="inline lp" style="left:304px;top:184px" role="dialog" aria-modal="true" aria-label="全新域名无凭据引导">
      <div class="in-h">
        <span class="av sm av-blue" style="width:15px;height:15px;font-size:7px">LP</span>
        <span class="name">LocalPass</span><span>· newvendor.io</span>
        <span class="right"><span class="chip">0 个条目</span></span>
      </div>
      <div style="padding:14px 12px;text-align:center">
        <div style="font-size:11.5px;font-weight:600">当前网站尚未保存任何登录</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px">点击快速生成高强度密码或直接新建本站点条目</div>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:9px">
          <button class="btn sm primary" data-act="go-screen" data-surface="ext" data-screen="ext-new">${icon("plus", 11)}在此站点新建</button>
          <button class="btn sm" data-act="set-inline" data-imode="register">${icon("wand", 11)}生成强密码</button>
        </div>
      </div>
      <div class="in-foot">
        <button data-act="go-screen" data-surface="ext" data-screen="ext-list">${icon("search", 11)}从其他网站借用 / 搜全部</button>
        <span class="right">只读域名</span>
      </div>
    </div>`;
  }

  // Default: Login Inline Menu (Account-first, Passkey + Password grouped)
  const logins = state.items.filter((i) => i.siteMatch);
  return `<div class="inline lp" style="left:304px;top:184px" role="dialog" aria-modal="true" aria-label="网页登录建议菜单">
    <div class="in-h">
      <span class="av sm av-blue" style="width:15px;height:15px;font-size:7px">LP</span>
      <span class="name">LocalPass</span><span>· northwind.io</span>
      <span class="right">
        <span class="chip">${logins.length} 个账户</span>
        <button class="iconbtn sm" data-act="set-inline" data-imode="collapsed" aria-label="关闭">${icon("x", 12)}</button>
      </span>
    </div>
    <div class="in-ctx"><span>按最近使用排序 · 输入用户名可过滤</span><span style="color:var(--success)">● 已与桌面端同步</span></div>
    <div class="in-grp">${icon("key", 10)}通行密钥 · 1</div>
    <button class="in-row" data-act="set-inline" data-imode="passkey-verifying">
      ${icon("touchid", 15)}
      <span><span class="t">alex@northwind.io</span><span class="s">通行密钥 · 触控 ID 一键确认</span></span>
      <span class="m"><span class="btn sm primary fillbtn">验证</span></span>
    </button>
    <div class="in-grp">${icon("lock", 10)}密码 · ${logins.length}</div>
    ${logins
      .map(
        (
          it,
          i,
        ) => `<button class="in-row ${i === state.inlineIndex ? "on" : ""}" data-act="fill-login" data-id="${it.id}">
      ${AV(it, "sm")}
      <span style="min-width:0;flex:1">
        <span class="t">${escapeHtml(it.user)} ${i === 0 ? `<span class="chip brand">上次使用</span>` : ""}</span>
        <span class="s">${escapeHtml(it.name)}${it.otp ? " · 含 2FA 验证码" : ""}</span>
      </span>
      <span class="m">
        <span class="btn sm primary fillbtn">填充</span>
      </span>
    </button>`,
      )
      .join("")}
    <div class="in-foot">
      <button data-act="set-inline" data-imode="register">${icon("wand", 11)}生成密码</button>
      <button data-act="go-screen" data-surface="ext" data-screen="ext-list">${icon("search", 11)}在扩展中搜全部</button>
      <span class="right">只读域名</span>
    </div>
    <div class="in-kbd"><span><kbd>↑↓</kbd> 选择</span><span><kbd>↵</kbd> 填充</span><span><kbd>esc</kbd> 关闭</span></div>
  </div>`;
}

function saveNotificationCard(state) {
  if (state.atRiskBarOpen) {
    return `<div class="savecard lp" style="width:326px" role="dialog" aria-modal="true" aria-label="弱密码与重复密码改密提醒">
      <div class="hd">
        <span class="av sm av-amber" style="width:16px;height:16px;font-size:7.5px">!</span>
        <span>此账号使用了重复或偏弱密码</span>
        <button class="iconbtn sm" style="margin-left:auto" data-act="close-save-bar" aria-label="关闭">${icon("x", 12)}</button>
      </div>
      <div class="bd">
        <span class="chip bad">重复 2 处</span>
        <div style="min-width:0;flex:1">
          <div class="t">Atlas Bank · alex.chen</div>
          <div class="s">与个人邮箱共用同一密码 · 建议趁已登录立即更新</div>
        </div>
      </div>
      <div class="ft">
        <button class="btn primary sm" style="flex:1" data-act="link-scenario" data-sc="register">${icon("wand", 11)}前往改密并生成 20 位强密码</button>
        <button class="btn ghost sm" data-act="close-save-bar">稍后</button>
      </div>
    </div>`;
  }
  if (!state.saveBarOpen) return "";
  if (state.saveConfirmedMode) {
    return `<div class="savecard lp" style="width:316px" role="dialog" aria-modal="true" aria-label="保存成功确认提示">
      <div class="hd" style="background:var(--success-soft)">
        <span style="width:16px;height:16px;border-radius:50%;background:var(--success);color:#fff;display:grid;place-items:center">${icon("check", 10)}</span>
        <span style="color:var(--success)">已安全保存到 LocalPass</span>
        <button class="iconbtn sm" style="margin-left:auto" data-act="close-save-bar" aria-label="关闭">${icon("x", 12)}</button>
      </div>
      <div class="bd">
        ${AV({ ini: "NV", tone: "indigo" })}
        <div style="min-width:0;flex:1">
          <div class="t">NewVendor Console · alex@northwind.io</div>
          <div class="s">已加密存入「${state.webSaveFolder || "工作"}」 · 2 分钟内自动收起</div>
        </div>
      </div>
      <div class="ft">
        <button class="btn sm" style="flex:1" data-act="go-screen" data-surface="ext" data-screen="ext-form">补充 2FA / 编辑条目</button>
        <button class="btn primary sm" data-act="close-save-bar">完成</button>
      </div>
    </div>`;
  }
  if (state.saveNewMode) {
    return `<div class="savecard lp" style="width:320px" role="dialog" aria-modal="true" aria-label="首次保存新登录到保险库">
      <div class="hd">
        <span class="av sm av-blue" style="width:16px;height:16px;font-size:7.5px">LP</span>
        <span>要保存 NewVendor 的登录吗？</span>
        <button class="iconbtn sm" style="margin-left:auto" data-act="close-save-bar" aria-label="关闭">${icon("x", 12)}</button>
      </div>
      <div class="bd">
        ${AV({ ini: "NV", tone: "indigo" })}
        <div style="min-width:0;flex:1">
          <div class="t">alex@northwind.io</div>
          <div class="s">首次登录 newvendor.io · 选择归属文件夹后写入本机</div>
        </div>
        <select class="lp-select sm" data-web-folder aria-label="选择保存文件夹">
          ${FOLDERS.map((fl) => `<option value="${escapeHtml(fl.name)}" ${(state.webSaveFolder || "工作") === fl.name ? "selected" : ""}>${escapeHtml(fl.name)}</option>`).join("")}
        </select>
      </div>
      <div class="ft">
        <button class="btn primary sm" style="flex:1" data-act="commit-web-save-new">保存到「${state.webSaveFolder || "工作"}」↵</button>
        <button class="btn sm" data-act="toast-msg" data-msg="已将 newvendor.io 加入忽略名单，不再弹出保存提示">从不提示此站</button>
      </div>
    </div>`;
  }
  if (state.multiSaveMode) {
    const candidates = [
      { id: "northwind", title: "alex@northwind.io", sub: "Northwind · 上次使用于 2 分钟前 (v3)" },
      { id: "northwind-ops", title: "ops@northwind.io", sub: "Northwind 运维 · v2" },
    ];
    return `<div class="savecard lp" style="width:320px" role="dialog" aria-modal="true" aria-label="多账户保存匹配选择">
      <div class="hd">
        <span class="av sm av-blue" style="width:16px;height:16px;font-size:7.5px">LP</span>
        <span>northwind.io 已有多个条目</span>
        <button class="iconbtn sm" style="margin-left:auto" data-act="close-save-bar" aria-label="关闭">${icon("x", 12)}</button>
      </div>
      <div style="padding:8px 10px 6px;font-size:10px;color:var(--text-3)">检测到密码变更，请选择更新哪一条（绝不静默覆盖）：</div>
      <div style="padding:0 8px 6px;display:grid;gap:4px">
        ${candidates
          .map(
            (
              c,
            ) => `<button class="prow" style="border:1px solid ${state.multiSaveTarget === c.id ? "var(--brand)" : "var(--border-light)"};border-radius:6px;background:${state.multiSaveTarget === c.id ? "var(--brand-softer)" : "var(--bg)"};text-align:left" data-act="pick-multi-save" data-id="${c.id}">
          <span class="check ${state.multiSaveTarget === c.id ? "" : "off"}">${state.multiSaveTarget === c.id ? icon("check", 9) : ""}</span>
          <div style="min-width:0;flex:1"><div class="t">${c.title}</div><div class="s">${c.sub}</div></div>
        </button>`,
          )
          .join("")}
        <button class="prow" style="border:1px solid ${state.multiSaveTarget === "new" ? "var(--brand)" : "var(--border-light)"};border-radius:6px;background:${state.multiSaveTarget === "new" ? "var(--brand-softer)" : "var(--bg)"};text-align:left" data-act="pick-multi-save" data-id="new">
          <span class="check ${state.multiSaveTarget === "new" ? "" : "off"}">${state.multiSaveTarget === "new" ? icon("check", 9) : ""}</span>
          <div style="min-width:0;flex:1"><div class="t">存为第 4 条新条目</div><div class="s">保留现有账户不动，单独记录这组凭据</div></div>
        </button>
      </div>
      <div class="ft">
        <button class="btn primary sm" style="flex:1" data-act="commit-web-update">${state.multiSaveTarget === "new" ? "新建第 4 条记录" : `更新 ${state.multiSaveTarget === "northwind-ops" ? "ops@" : "alex@"} 密码`} ↵</button>
        <button class="btn ghost sm" data-act="close-save-bar">忽略</button>
      </div>
    </div>`;
  }
  return `<div class="savecard lp" role="dialog" aria-modal="true" aria-label="保存或更新密码确认条">
    <div class="hd">
      <span class="av sm av-blue" style="width:16px;height:16px;font-size:7.5px">LP</span>
      <span>更新 Northwind 的密码？</span>
      <button class="iconbtn sm" style="margin-left:auto" data-act="close-save-bar" aria-label="关闭">${icon("x", 12)}</button>
    </div>
    <div class="bd">
      ${AV(state.items[0])}
      <div style="min-width:0;flex:1">
        <div class="t">alex@northwind.io</div>
        <div class="s">已存在同名账户 · 更新后保留 v3 到历史版本</div>
      </div>
      <span class="chip">工作</span>
    </div>
    <div class="ft">
      <button class="btn primary sm" style="flex:1" data-act="commit-web-update">更新条目 (v4) ↵</button>
      <button class="btn sm" data-act="toggle-multi-save">切换/存为新建</button>
      <button class="btn ghost sm" data-act="close-save-bar">忽略</button>
    </div>
  </div>`;
}

function autofillToastCard(state) {
  if (!state.autofillToastOpen) return "";
  return `<div class="toast-float-card lp" role="status" aria-label="网页填充回执与撤销">
    <span style="width:22px;height:22px;border-radius:50%;background:${state.autofillUndoDone ? "var(--warning)" : "var(--success)"};color:#fff;display:grid;place-items:center;flex:none">${icon(state.autofillUndoDone ? "undo" : "check", 12)}</span>
    <div style="min-width:0;flex:1">
      <div style="font-size:11px;font-weight:600">${state.autofillUndoDone ? "已撤销本次页面填充" : "已填充 Northwind 完整凭据"}</div>
      <div style="font-size:9.5px;color:var(--text-3);margin-top:1px">${state.autofillUndoDone ? "输入框已清空 · 点击可重新填入" : "已填 用户名 + 密码 + 2FA · 仅写当前页"}</div>
    </div>
    <button class="btn sm" data-act="toggle-autofill-undo">${state.autofillUndoDone ? "重新填充" : "撤销"}</button>
  </div>`;
}

function renderWebWorkspace(state) {
  const step = state.siteStep;
  const hostDomain = state.atRiskBarOpen
    ? "atlasbank.com"
    : state.inlineMode === "no-match" || state.saveNewMode || state.saveConfirmedMode
      ? "newvendor.io"
      : "northwind.io";
  const pageTitle = state.atRiskBarOpen
    ? "个人网银登录"
    : state.inlineMode === "no-match" || state.saveNewMode || state.saveConfirmedMode
      ? "登录 NewVendor"
      : step === "totp"
        ? "两步验证"
        : step === "checkout"
          ? "结账与配送"
          : step === "register"
            ? "修改登录密码"
            : "登录到 Northwind";

  let formHtml = "";
  if (step === "totp") {
    formHtml = `<p class="site-label">6 位验证码</p>
      <button class="site-input focus" aria-label="验证码输入框" data-act="set-inline" data-imode="totp">
        <span class="grow mono">${state.inlineMode === "totp-filled" ? "492 106" : "输入验证码…"}</span>
        <span class="lpbadge">${icon("clock", 11)}</span>
      </button>
      <button class="site-submit" data-act="set-site-step" data-step="login">完成验证</button>`;
  } else if (step === "checkout") {
    formHtml = `<p class="site-label">银行卡号（点击触发卡片内联）</p>
      <button class="site-input focus" aria-label="银行卡号输入框" data-act="set-inline" data-imode="card"><span class="grow mono">4532 •••• •••• 4421</span><span class="lpbadge">${icon("card", 11)}</span></button>
      <p class="site-label">收件人与地址（点击触发身份内联）</p>
      <button class="site-input" aria-label="收件人与地址输入框" data-act="set-inline" data-imode="identity"><span class="grow">陈亚历 · 上海市徐汇区…</span><span class="lpbadge">${icon("id", 11)}</span></button>
      <button class="site-submit" data-act="toast-msg" data-msg="已提交订单示例">确认支付</button>`;
  } else if (step === "register") {
    formHtml = `<p class="site-label">当前用户名</p>
      <div class="site-input"><span class="grow">alex@northwind.io</span></div>
      <p class="site-label">新密码（触发强密码建议 + 保存条）</p>
      <button class="site-input focus" aria-label="新密码输入框" data-act="set-inline" data-imode="register"><span class="grow mono">${syntaxPw(state.genValue)}</span><span class="lpbadge">${icon("wand", 11)}</span></button>
      <button class="site-submit" data-act="trigger-save-bar">提交改密（触发保存确认条）</button>`;
  } else {
    const emailDisplay =
      state.inlineMode === "empty"
        ? escapeHtml(state.webFilterQuery)
        : state.atRiskBarOpen
          ? "alex.chen"
          : "alex@northwind.io";
    formHtml = `<p class="site-label">工作邮箱 / 账号</p>
      <button class="site-input focus" aria-label="工作邮箱输入框" data-act="set-inline" data-imode="login"><span class="grow">${emailDisplay}</span><span class="lpbadge">${icon("key", 11)}</span></button>
      <p class="site-label">密码</p>
      <button class="site-input" aria-label="密码输入框" data-act="set-inline" data-imode="login"><span class="grow">••••••••••••</span><span class="lpbadge">${icon("key", 11)}</span></button>
      <button class="site-submit" data-act="set-site-step" data-step="totp">登录并进入两步验证 →</button>`;
  }

  return `<div class="web lp">
    <div class="chrome">
      <div class="sr-only" aria-live="polite">${state.toast ? escapeHtml(state.toast.msg) : ""}</div>
      <div class="traffic"><i></i><i></i><i></i></div>
      <div class="tab"><span class="fav">${hostDomain[0].toUpperCase()}</span>${hostDomain} · ${pageTitle}</div>
      <div class="addr">${icon("lock", 11)} https://${hostDomain}/${step}</div>
      <div style="display:flex;gap:3px">
        <button class="ext-btn ${step === "login" ? "active" : ""}" aria-pressed="${step === "login"}" data-act="set-site-step" data-step="login">登录</button>
        <button class="ext-btn ${step === "totp" ? "active" : ""}" aria-pressed="${step === "totp"}" data-act="set-site-step" data-step="totp">2FA</button>
        <button class="ext-btn ${step === "checkout" ? "active" : ""}" aria-pressed="${step === "checkout"}" data-act="set-site-step" data-step="checkout">卡/身份</button>
        <button class="ext-btn ${step === "register" ? "active" : ""}" aria-pressed="${step === "register"}" data-act="set-site-step" data-step="register">改密保存</button>
      </div>
    </div>
    <div class="web-body">
      <div class="site-nav" aria-label="模拟网站导航">
        <div class="site-brand"><span class="sq">${hostDomain[0].toUpperCase()}</span>${hostDomain === "atlasbank.com" ? "Atlas Bank" : hostDomain === "newvendor.io" ? "NewVendor" : "Northwind"}</div>
        <a>工作台</a><a>计费</a><a>安全设置</a>
      </div>
      <div class="site-main">
        <h1>${pageTitle}</h1>
        <p class="sub">点击输入框 LP 徽标或切换上方场景体验联动。</p>
        ${formHtml}
      </div>
      ${inlineMenuPopup(state)}
      ${saveNotificationCard(state)}
      ${autofillToastCard(state)}
      ${toastMarkup(state, "web")}
    </div>
  </div>`;
}

function renderLinkageWorkspace(state) {
  const macHtml = renderMacWorkspace(state, {
    respectLock: true,
    sub: state.macLinkSub || "vault",
  });
  const extHtml = renderExtWorkspace(state, state.extLinkScreen || "ext-detail", true);
  const webHtml = renderWebWorkspace(state);
  const logs = (state.ipcLogs || []).slice(0, 4);

  return `<div class="linkage-wrap lp ${state.linkFocus ? `focus-${state.linkFocus}` : ""}">
    <div class="linkage-bus">
      <span class="chip brand">${icon("link", 11)}原生消息桥接 com.localpass.desktop</span>
      <span class="chip ${state.locked ? "warn" : "ok"}"><span class="dot ${state.locked ? "warn" : ""}"></span>会话：${state.locked ? "三端已同步锁定" : "已解锁 · 三端共享"}</span>
      <span class="chip ${state.dirtyCount ? "warn" : "ok"}">R2 队列：${state.dirtyCount ? `待同步 ${state.dirtyCount} 项` : "已对齐"}</span>
      ${state.clipboard ? `<span class="chip brand tnum">剪贴板：${state.clipboard.label} (${state.clipboard.secs}s 后清除)</span>` : `<span class="chip">剪贴板：空闲</span>`}
      <div style="margin-left:auto;display:flex;gap:5px">
        <button class="btn sm" data-act="toggle-lock">${icon(state.locked ? "unlock" : "lock", 12)}${state.locked ? "触控 ID 解锁三端" : "锁定三端"}</button>
        <button class="btn sm" data-act="trigger-save-bar">${icon("download", 12)}模拟网页改密保存</button>
        <button class="btn sm primary" data-act="go-screen" data-surface="mac" data-screen="mac-quick-access">${icon("search", 12)}⌘K 快速检索</button>
      </div>
    </div>
    <div class="linkage-grid">
      <div class="link-card" data-link-target="mac">
        <div class="link-card-head">
          <span>1 · Mac 桌面端（1200×760 主控端）</span>
          <button class="link-focus-btn" data-act="link-focus" data-target="${state.linkFocus === "mac" ? "" : "mac"}" aria-label="${state.linkFocus === "mac" ? "恢复三端视图" : "放大 Mac 桌面端"}">${icon(state.linkFocus === "mac" ? "x" : "maximize", 11)}</button>
          <span class="link-switch-mini" style="margin-left:auto">
            ${[
              ["vault", "保险库"],
              ["health", "体检"],
              ["sync", "同步"],
              ["conflict", "冲突"],
            ]
              .map(
                ([id, lb]) =>
                  `<button class="${(state.macLinkSub || "vault") === id ? "on" : ""}" data-act="link-mac" data-sub="${id}">${lb}</button>`,
              )
              .join("")}
          </span>
        </div>
        <div class="link-card-body" style="flex:none;height:456px">
          <div class="mini-scale" style="transform:scale(0.6)">${macHtml}</div>
        </div>
        <div class="link-card-foot" style="flex:1;overflow:auto">
          <div style="font-size:9.5px;font-weight:650;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-4);margin-bottom:4px">跨端实时事件流（Native Messaging + 内存状态）</div>
          <div class="ipc-log">
            ${logs.map((l) => `<div><span class="ts">[${l.ts}]</span> <span class="ch">${escapeHtml(l.bus)}</span> ${escapeHtml(l.msg)}</div>`).join("")}
          </div>
        </div>
      </div>
      <div class="link-card" data-link-target="ext">
        <div class="link-card-head">
          <span>2 · Chrome 扩展（380×600）</span>
          <button class="link-focus-btn" data-act="link-focus" data-target="${state.linkFocus === "ext" ? "" : "ext"}" aria-label="${state.linkFocus === "ext" ? "恢复三端视图" : "放大 Chrome 扩展"}">${icon(state.linkFocus === "ext" ? "x" : "maximize", 11)}</button>
          <span class="link-switch-mini" style="margin-left:auto">
            ${[
              ["ext-list", "列表"],
              ["ext-detail", "详情"],
              ["ext-form", "编辑"],
              ["ext-security-key", "PRF"],
            ]
              .map(
                ([id, lb]) =>
                  `<button class="${(state.extLinkScreen || "ext-detail") === id ? "on" : ""}" data-act="link-ext" data-ext="${id}">${lb}</button>`,
              )
              .join("")}
          </span>
        </div>
        <div class="link-card-body">
          <div class="mini-scale" style="transform:scale(0.936)">${extHtml}</div>
        </div>
      </div>
      <div class="link-card" data-link-target="web">
        <div class="link-card-head">
          <span>3 · 浏览器页面内联联动（northwind.io）</span>
          <button class="link-focus-btn" data-act="link-focus" data-target="${state.linkFocus === "web" ? "" : "web"}" aria-label="${state.linkFocus === "web" ? "恢复三端视图" : "放大网页内联联动"}">${icon(state.linkFocus === "web" ? "x" : "maximize", 11)}</button>
          <span style="margin-left:auto;color:var(--text-3)">网页操作直接写入上方 1 & 2</span>
        </div>
        <div class="link-card-body" style="flex:none;height:440px">
          <div class="mini-scale" style="transform:scale(0.732)">${webHtml}</div>
        </div>
        <div class="link-card-foot" style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:5px">
          <div style="font-size:10px;color:var(--text-3)">快速切换网页联动场景：</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            <button class="btn sm ${state.siteStep === "login" && state.inlineMode === "login" && !state.saveBarOpen && !state.autofillToastOpen && !state.atRiskBarOpen ? "primary" : ""}" data-act="link-scenario" data-sc="login">登录</button>
            <button class="btn sm ${state.inlineMode === "no-match" ? "primary" : ""}" data-act="link-scenario" data-sc="no-match">无凭据</button>
            <button class="btn sm ${state.siteStep === "totp" ? "primary" : ""}" data-act="link-scenario" data-sc="totp">2FA</button>
            <button class="btn sm ${state.siteStep === "checkout" ? "primary" : ""}" data-act="link-scenario" data-sc="card">卡/身份</button>
            <button class="btn sm ${state.inlineMode === "passkey" ? "primary" : ""}" data-act="link-scenario" data-sc="passkey">Passkey</button>
            <button class="btn sm ${state.saveBarOpen && state.saveNewMode ? "primary" : ""}" data-act="link-scenario" data-sc="save-new">首次保存</button>
            <button class="btn sm ${state.saveBarOpen && state.multiSaveMode ? "primary" : ""}" data-act="link-scenario" data-sc="multi-save">多账号</button>
            <button class="btn sm ${state.saveBarOpen && state.saveConfirmedMode ? "primary" : ""}" data-act="link-scenario" data-sc="save-confirm">已存确认</button>
            <button class="btn sm ${state.atRiskBarOpen ? "primary" : ""}" data-act="link-scenario" data-sc="at-risk">风险提醒</button>
            <button class="btn sm ${state.autofillToastOpen ? "primary" : ""}" data-act="link-scenario" data-sc="toast">回执撤销</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
