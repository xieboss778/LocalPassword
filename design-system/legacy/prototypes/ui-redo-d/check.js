#!/usr/bin/env node
/*
 * 结构自检：在 Node 里加载 app.js，渲染每一个界面，检查
 * 1. 标签（div / button / span / section / aside）配平
 * 2. 没有 undefined / NaN / [object Object]
 * 3. 所有 data-go 目标真实存在
 * 4. 所有条目、类型、流程引用有效
 * 不做视觉判断，也不写入任何文件。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appPath = path.join(__dirname, "app.js");
const source = fs.readFileSync(appPath, "utf8");

const sandbox = {
  console,
  Date,
  Math,
  URLSearchParams,
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
};
vm.createContext(sandbox);
vm.runInContext(
  source + "\n;globalThis.__LOCALPASS_API__ = { P, D, W, GROUPS, FLOWS, state, DATA, TYPES };",
  sandbox,
  { filename: "app.js" },
);

const api = sandbox.__LOCALPASS_API__;
if (!api) {
  console.error("✗ app.js 没有导出自检所需的界面注册表");
  process.exit(1);
}
const { P, D, W, GROUPS, FLOWS, state, DATA, TYPES } = api;

const errors = [];
const rendered = [];

function renderedScreen(device, id, options = {}) {
  const registry = device === "popup" ? P : device === "desktop" ? D : W;
  const fn = registry[id];
  if (typeof fn !== "function") {
    errors.push(`${id}: 界面没有实现`);
    return;
  }

  state.device = device;
  state.screen = id;
  state.menu = null;
  state.query = "";
  state.filter = { type: "all", folder: "all", fav: false };
  state.revealed = {};
  state.formMode = options.formMode || "new";
  state.formType = options.formType || "login";
  state.selectedId = options.item || "github";
  state.inline = {
    query: "",
    closed: false,
    filledAccount: null,
    passkeyAuth: null,
    totpAccount: "github",
  };

  let html;
  try {
    html = fn();
  } catch (error) {
    errors.push(`${id}: 渲染抛错 ${error.message}`);
    return;
  }
  if (typeof html !== "string" || !html.trim()) {
    errors.push(`${id}: 渲染结果为空`);
    return;
  }

  for (const tag of ["div", "button", "span", "section", "aside", "label"]) {
    const opens = (html.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
    const closes = (html.match(new RegExp(`</${tag}>`, "gi")) || []).length;
    if (opens !== closes) {
      errors.push(`${id}: <${tag}> 未配平（${opens} 开 / ${closes} 闭）`);
    }
  }

  for (const token of ["undefined", "NaN", "[object Object]"]) {
    if (html.includes(token)) {
      errors.push(`${id}: 输出里出现了 "${token}"`);
    }
  }

  for (const match of html.matchAll(/data-go="([^"]+)"/g)) {
    const target = match[1];
    if (!P[target] && !D[target] && !W[target]) {
      errors.push(`${id}: data-go="${target}" 没有对应的界面`);
    }
  }

  for (const match of html.matchAll(/data-item="([^"]+)"/g)) {
    const item = match[1];
    if (!DATA.items.some((entry) => entry.id === item)) {
      errors.push(`${id}: data-item="${item}" 不存在`);
    }
  }

  for (const match of html.matchAll(/data-form-type="([^"]+)"/g)) {
    const type = match[1];
    if (!TYPES[type]) {
      errors.push(`${id}: data-form-type="${type}" 未定义`);
    }
  }

  if (device === "popup" && html.includes('class="d-app')) {
    errors.push(`${id}: 弹窗界面里出现了桌面端外壳`);
  }
  if (device === "desktop" && html.includes('class="p-app')) {
    errors.push(`${id}: 桌面界面里出现了弹窗外壳`);
  }
  if (device === "inline" && (html.includes('class="p-app') || html.includes('class="d-app'))) {
    errors.push(`${id}: 网页内联界面里出现了应用外壳`);
  }

  rendered.push({ device, id, bytes: html.length });
}

/* 1. 索引里的每一项 */
for (const group of GROUPS) {
  for (const entry of group.items) {
    renderedScreen(group.device, entry.id, {
      item: entry.item,
      formType: entry.formType,
    });
  }
}

/* 2. 所有已实现但未列进索引的界面 */
for (const id of Object.keys(P)) {
  if (!rendered.some((entry) => entry.device === "popup" && entry.id === id)) {
    renderedScreen("popup", id);
  }
}
for (const id of Object.keys(D)) {
  if (!rendered.some((entry) => entry.device === "desktop" && entry.id === id)) {
    renderedScreen("desktop", id);
  }
}
for (const id of Object.keys(W)) {
  if (!rendered.some((entry) => entry.device === "inline" && entry.id === id)) {
    renderedScreen("inline", id);
  }
}

/* 3. 每种条目详情 + 每种表单（新建 / 编辑） */
for (const item of DATA.items) {
  renderedScreen("popup", "p-item", { item: item.id });
  renderedScreen("desktop", "d-item", { item: item.id });
  renderedScreen("desktop", "d-form", { item: item.id });
}
for (const type of Object.keys(TYPES)) {
  renderedScreen("popup", "p-form", { formType: type, formMode: "new" });
  renderedScreen("popup", "p-form", { formType: type, formMode: "edit", item: "github" });
  renderedScreen("desktop", "d-new-form", { formType: type });
}

/* 4. 流程步骤有效 */
for (const flow of FLOWS) {
  for (const step of flow.steps) {
    const registry = flow.device === "popup" ? P : flow.device === "desktop" ? D : W;
    if (!registry[step.id]) {
      errors.push(`流程「${flow.name}」: 步骤 ${step.id} 没有实现`);
    }
    if (step.item && !DATA.items.some((entry) => entry.id === step.item)) {
      errors.push(`流程「${flow.name}」: 条目 ${step.item} 不存在`);
    }
  }
}

/* 5. 索引设备归属 */
for (const group of GROUPS) {
  const registry = group.device === "popup" ? P : group.device === "desktop" ? D : W;
  for (const entry of group.items) {
    if (!registry[entry.id]) {
      errors.push(`索引「${group.g}」: ${entry.id} 不属于 ${group.device}`);
    }
  }
}

if (errors.length) {
  console.error(`✗ 发现 ${errors.length} 个问题：`);
  for (const message of errors) {
    console.error("  - " + message);
  }
  process.exit(1);
}

const popupCount = rendered.filter((entry) => entry.device === "popup").length;
const desktopCount = rendered.filter((entry) => entry.device === "desktop").length;
const inlineCount = rendered.filter((entry) => entry.device === "inline").length;
const bytes = rendered.reduce((sum, entry) => sum + entry.bytes, 0);
console.log(
  `✓ ${rendered.length} 次渲染通过（弹窗 ${popupCount} / 桌面 ${desktopCount} / 网页内联 ${inlineCount}），` +
    `共 ${Math.round(bytes / 1024)} KB HTML；标签配平、无 undefined、导航目标全部有效。`,
);
console.log(
  `  索引 ${GROUPS.reduce((sum, group) => sum + group.items.length, 0)} 项 · ` +
    `界面函数 ${Object.keys(P).length}+${Object.keys(D).length}+${Object.keys(W).length} · 流程 ${FLOWS.length} 条。`,
);
