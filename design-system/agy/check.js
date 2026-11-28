#!/usr/bin/env node
/* ==========================================================================
   Structural self-check for design-system/agy prototype

   This checks rendering only, not interaction behavior:
   - Registry shape: 73 unique screens (1 linkage + 29 mac + 29 ext + 14 web)
   - Every screen has a non-empty id, name and render function
   - Renders every screen and checks balanced HTML tags
   - No undefined / NaN / [object Object]
   - Zero emoji characters in UI markup
   - All ItemKinds present in INITIAL_ITEMS render cleanly in Mac & Extension
   ========================================================================== */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = __dirname;
const files = ["icons.js", "data.js", "render-mac.js", "render-ext.js", "render-web.js", "app.js"];

const EXPECTED_SURFACES = { linkage: 1, mac: 29, ext: 29, web: 14 };
const EXPECTED_TOTAL = Object.values(EXPECTED_SURFACES).reduce((sum, n) => sum + n, 0);

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
  crypto: globalThis.crypto ?? require("node:crypto").webcrypto,
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
  "({ SCREENS, STATE, INITIAL_ITEMS, ITEM_KINDS, renderMacWorkspace, renderExtWorkspace })",
  ctx,
);

const errors = [];

// --- Registry shape -------------------------------------------------------
const registry = api.SCREENS || {};
const surfaces = Object.keys(registry);
for (const surface of Object.keys(EXPECTED_SURFACES)) {
  if (!Array.isArray(registry[surface])) {
    errors.push(`SCREENS.${surface}: expected an array of screens`);
  } else if (registry[surface].length !== EXPECTED_SURFACES[surface]) {
    errors.push(
      `SCREENS.${surface}: expected ${EXPECTED_SURFACES[surface]} screens, got ${registry[surface].length}`,
    );
  }
}
for (const surface of surfaces) {
  if (!(surface in EXPECTED_SURFACES)) {
    errors.push(
      `SCREENS.${surface}: unexpected surface (expected ${Object.keys(EXPECTED_SURFACES).join(", ")})`,
    );
  }
}

const seenIds = new Set();
for (const surface of surfaces) {
  const list = Array.isArray(registry[surface]) ? registry[surface] : [];
  list.forEach((sc, index) => {
    const where = `${surface}[${index}]`;
    if (!sc || typeof sc !== "object") {
      errors.push(`${where}: screen entry is not an object`);
      return;
    }
    if (typeof sc.id !== "string" || !sc.id.trim()) {
      errors.push(`${where}: missing non-empty id`);
    } else if (seenIds.has(sc.id)) {
      errors.push(`${where}: duplicate screen id "${sc.id}"`);
    } else {
      seenIds.add(sc.id);
    }
    if (typeof sc.name !== "string" || !sc.name.trim()) {
      errors.push(`${where}${sc.id ? ` (${sc.id})` : ""}: missing non-empty name`);
    }
    if (typeof sc.render !== "function") {
      errors.push(`${where}${sc.id ? ` (${sc.id})` : ""}: missing render function`);
    }
  });
}

if (seenIds.size !== EXPECTED_TOTAL) {
  errors.push(`SCREENS: expected ${EXPECTED_TOTAL} unique screen ids, got ${seenIds.size}`);
}

// --- Item kinds actually present in synthetic data -----------------------
const declaredKinds = new Set(api.ITEM_KINDS.map((kind) => kind.id));
const presentKinds = new Set(api.INITIAL_ITEMS.map((item) => item.kind));
for (const kind of declaredKinds) {
  if (!presentKinds.has(kind)) {
    errors.push(`INITIAL_ITEMS: no record for ItemKind "${kind}"`);
  }
}
for (const kind of presentKinds) {
  if (!declaredKinds.has(kind)) {
    errors.push(`INITIAL_ITEMS: unknown ItemKind "${kind}"`);
  }
}
if (presentKinds.size !== declaredKinds.size) {
  errors.push(
    `INITIAL_ITEMS: expected all ${declaredKinds.size} ItemKinds, found ${presentKinds.size}`,
  );
}

function checkHtml(label, html) {
  if (typeof html !== "string" || html.length < 50) {
    errors.push(`${label}: empty or invalid output`);
    return;
  }
  for (const bad of ["undefined", "NaN", "[object Object]"]) {
    if (html.includes(bad)) errors.push(`${label}: contains literal "${bad}"`);
  }
  const emojiRegex = /[\u{1F300}-\u{1FAFF}]/u;
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

// --- Render every screen --------------------------------------------------
for (const surface of surfaces) {
  const list = Array.isArray(registry[surface]) ? registry[surface] : [];
  for (const sc of list) {
    if (!sc || typeof sc.render !== "function") continue;
    api.STATE.surface = surface;
    api.STATE.screen = sc.id;
    checkHtml(`${surface}/${sc.id || "?"}`, sc.render());
  }
}

// Render every synthetic record through both workspaces.
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

const counts = Object.keys(EXPECTED_SURFACES)
  .map((surface) => `${registry[surface].length} ${surface}`)
  .join(" + ");
console.log(
  `AGY prototype check PASSED: ${seenIds.size} screens (${counts}) + ${api.INITIAL_ITEMS.length} records across ${presentKinds.size} kinds verified.`,
);
