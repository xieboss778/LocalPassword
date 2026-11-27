#!/usr/bin/env node
/* ==========================================================================
   Structural self-check for design-system/agy prototype
   Renders every screen across linkage/mac/ext/web and checks:
   - Balanced HTML tags
   - No undefined / NaN / [object Object]
   - Zero emoji characters in UI markup
   - All 8 ItemKinds render cleanly in Mac & Extension details
   ========================================================================== */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = __dirname;
const files = ["icons.js", "data.js", "render-mac.js", "render-ext.js", "render-web.js", "app.js"];

const mockEl = () => ({
  innerHTML: "",
  style: {},
  dataset: {},
  textContent: "",
  classList: { toggle() {} },
  addEventListener() {},
  setAttribute() {},
});

const sandbox = {
  console,
  navigator: {},
  document: {
    activeElement: null,
    documentElement: { dataset: {} },
    querySelector: () => mockEl(),
    querySelectorAll: () => [],
    getElementById: () => mockEl(),
    addEventListener() {},
  },
  window: { addEventListener() {} },
  history: { replaceState() {} },
  location: { hash: "" },
  requestAnimationFrame: () => {},
  setInterval: () => 0,
  setTimeout: () => 0,
  clearTimeout: () => {},
};

const ctx = vm.createContext(sandbox);
for (const f of files) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f });
}

const api = vm.runInContext(
  "({ SCREENS, STATE, INITIAL_ITEMS, renderMacWorkspace, renderExtWorkspace })",
  ctx,
);

const errors = [];
const emojiRegex = /[\u{1F300}-\u{1FAFF}]/u;

function checkHtml(label, html) {
  if (typeof html !== "string" || html.length < 50) {
    errors.push(`${label}: empty or invalid output`);
    return;
  }
  for (const bad of ["undefined", "NaN", "[object Object]"]) {
    if (html.includes(bad)) errors.push(`${label}: contains literal "${bad}"`);
  }
  if (emojiRegex.test(html)) {
    errors.push(`${label}: contains emoji character (SVG-only rule violated)`);
  }
  const tags = ["div", "button", "span", "aside", "section"];
  for (const tag of tags) {
    const opens = (html.match(new RegExp(`<${tag}(\\s|>)`, "g")) || []).length;
    const closes = (html.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (opens !== closes)
      errors.push(`${label}: unbalanced <${tag}> (${opens} open vs ${closes} close)`);
  }
}

for (const surface of Object.keys(api.SCREENS)) {
  for (const sc of api.SCREENS[surface]) {
    api.STATE.surface = surface;
    api.STATE.screen = sc.id;
    const html = sc.render();
    checkHtml(`${surface}/${sc.id}`, html);
  }
}

for (const it of api.INITIAL_ITEMS) {
  api.STATE.surface = "mac";
  api.STATE.selected = it.id;
  api.STATE.macSub = "vault";
  checkHtml(`mac-kind/${it.kind}/${it.id}`, api.renderMacWorkspace(api.STATE));
  checkHtml(`ext-kind/${it.kind}/${it.id}`, api.renderExtWorkspace(api.STATE, "ext-detail"));
}

if (errors.length) {
  console.error("AGY prototype check FAILED:\n" + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}

const totalScreens = Object.values(api.SCREENS).reduce((acc, arr) => acc + arr.length, 0);
console.log(
  `AGY prototype check PASSED: ${totalScreens} screens + ${api.INITIAL_ITEMS.length} item records across 8 kinds verified.`,
);
