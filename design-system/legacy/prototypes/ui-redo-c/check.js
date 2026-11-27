/**
 * 原型自检：所有界面能渲染、HTML 结构平衡、导航目标存在。
 * 用法：node design-system/legacy/prototypes/ui-redo-c/check.js
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

global.document = {
  getElementById: () => ({ innerHTML: "", setAttribute() {} }),
  addEventListener() {},
  querySelectorAll: () => [],
};
global.location = { href: "http://localhost/index.html" };
global.history = { replaceState() {} };

const api = new Function(
  "document",
  "location",
  "history",
  "URL",
  "URLSearchParams",
  "console",
  src + ";return {POPUP, DESK, GROUPS};",
)(global.document, global.location, global.history, URL, URLSearchParams, console);

let problems = 0;
const fail = (msg) => {
  console.log("✗", msg);
  problems++;
};

for (const [dev, set] of [
  ["popup", api.POPUP],
  ["desktop", api.DESK],
]) {
  for (const [name, fn] of Object.entries(set)) {
    let html = "";
    try {
      html = fn();
    } catch (e) {
      fail(dev + ":" + name + " 抛错 " + e.message);
      continue;
    }
    if (!html || html.length < 60) fail(dev + ":" + name + " 输出过短");
    const open = (html.match(/<div\b/g) || []).length;
    const close = (html.match(/<\/div>/g) || []).length;
    if (open !== close) fail(dev + ":" + name + " div 不配对 " + (open - close));
    if (html.includes("undefined")) fail(dev + ":" + name + " 含 undefined");
  }
}

for (const g of api.GROUPS) {
  for (const [id] of g.items) {
    const set = g.device === "popup" ? api.POPUP : api.DESK;
    if (typeof set[id] !== "function") fail("导航目标缺失 " + g.device + ":" + id);
  }
}

const total = Object.keys(api.POPUP).length + Object.keys(api.DESK).length;
console.log(
  problems === 0
    ? "✓ " + total + " 个界面全部通过（结构平衡、导航可达）"
    : "共 " + problems + " 个问题",
);
process.exit(problems === 0 ? 0 : 1);
