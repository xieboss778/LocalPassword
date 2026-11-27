/* ==========================================================================
   LocalPass · AGY Compact v4 — Crisp 1.5px Geometric SVG Icon Library
   Zero emoji icons anywhere in structural UI.
   ========================================================================== */

const ICONS = {
  search: '<circle cx="9" cy="9" r="5.5"/><path d="m13.2 13.2 3.6 3.6"/>',
  plus: '<path d="M10 4.5v11M4.5 10h11"/>',
  lock: '<rect x="4.5" y="8.5" width="11" height="7.5" rx="1.6"/><path d="M7 8.5V6.6a3 3 0 0 1 6 0v1.9"/>',
  unlock:
    '<rect x="4.5" y="8.5" width="11" height="7.5" rx="1.6"/><path d="M7 8.5V6.6a3 3 0 0 1 5.7-1.3"/>',
  copy: '<rect x="7" y="7" width="8" height="9" rx="1.4"/><path d="M12.5 7V5.4A1.4 1.4 0 0 0 11.1 4H5.4A1.4 1.4 0 0 0 4 5.4v6.1c0 .8.6 1.4 1.4 1.4H7"/>',
  eye: '<path d="M2.8 10s2.6-4.2 7.2-4.2S17.2 10 17.2 10s-2.6 4.2-7.2 4.2S2.8 10 2.8 10Z"/><circle cx="10" cy="10" r="1.9"/>',
  eyeoff:
    '<path d="M4 4l12 12"/><path d="M7.3 7.5C4.6 8.7 2.8 10 2.8 10s2.6 4.2 7.2 4.2c1.3 0 2.5-.3 3.5-.8"/><path d="M12.4 12.6c-.7.2-1.5.3-2.4.3"/><path d="M8.4 6.2c.5-.1 1-.2 1.6-.2 4.6 0 7.2 4 7.2 4s-.7 1.1-1.9 2.1"/>',
  globe:
    '<circle cx="10" cy="10" r="6.5"/><path d="M3.6 10h12.8M10 3.5c1.7 1.7 2.5 4 2.5 6.5S11.7 15.3 10 16.5C8.3 15.3 7.5 12.7 7.5 10S8.3 5.2 10 3.5Z"/>',
  chevron: '<path d="m7.5 4.5 5 5.5-5 5.5"/>',
  chevrond: '<path d="m4.5 7.5 5.5 5 5-5"/>',
  back: '<path d="m11.5 4.5-5 5.5 5 5.5"/>',
  more: '<circle cx="4.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none"/>',
  settings:
    '<circle cx="10" cy="10" r="2.5"/><path d="M10 2.8v1.6M10 15.6v1.6M17.2 10h-1.6M4.4 10H2.8M15.1 4.9l-1.1 1.1M6 14l-1.1 1.1M15.1 15.1 14 14M6 6 4.9 4.9"/>',
  folder:
    '<path d="M3 6.2c0-.8.6-1.4 1.4-1.4h3l1.6 1.8h6.6c.8 0 1.4.6 1.4 1.4v6.4c0 .8-.6 1.4-1.4 1.4H4.4c-.8 0-1.4-.6-1.4-1.4V6.2Z"/>',
  trash:
    '<path d="M4.5 6.5h11M8 6.5V5.2c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v1.3M6 6.5l.7 8.2c0 .7.6 1.3 1.3 1.3h4c.7 0 1.3-.6 1.3-1.3l.7-8.2"/>',
  archive:
    '<rect x="3.2" y="4.2" width="13.6" height="3.2" rx="1"/><path d="M4.5 7.4v7.2c0 .8.6 1.4 1.4 1.4h8.2c.8 0 1.4-.6 1.4-1.4V7.4M8.4 10.6h3.2"/>',
  wand: '<path d="m4 16 8.2-8.2"/><path d="m12.4 3.2.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7Z"/><path d="m15.4 10.4.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4.4-1.2Z"/>',
  download: '<path d="M10 3.5v8.2M6.8 8.8 10 12l3.2-3.2M4.5 15.5h11"/>',
  upload: '<path d="M10 12.5V4.3M6.8 7.5 10 4.3l3.2 3.2M4.5 15.5h11"/>',
  cloud: '<path d="M6.2 14.8h7.6a3 3 0 0 0 .3-6 4.3 4.3 0 0 0-8.2-1.1 3.4 3.4 0 0 0 .3 7.1Z"/>',
  shield:
    '<path d="M10 3.2 15.5 5v4.3c0 3.1-2.1 5.9-5.5 7.2-3.4-1.3-5.5-4.1-5.5-7.2V5L10 3.2Z"/><path d="m7.6 9.8 1.7 1.7 3.2-3.4"/>',
  key: '<circle cx="7" cy="12.4" r="2.7"/><path d="m9 10.4 5.6-5.6M12.2 5.4l1.7 1.7M14 3.6l2.1 2.1"/>',
  card: '<rect x="3" y="5.2" width="14" height="9.6" rx="1.7"/><path d="M3 8.4h14M5.8 12.4h3"/>',
  note: '<path d="M5 3.6h7.2L15.5 7v9.4H5V3.6Z"/><path d="M12 3.8V7.2h3.3M7.4 10h5.2M7.4 12.6h5.2"/>',
  id: '<rect x="2.8" y="4.8" width="14.4" height="10.4" rx="1.7"/><circle cx="7.4" cy="9.2" r="1.6"/><path d="M5.2 13c.3-1.2 1.2-1.9 2.2-1.9s1.9.7 2.2 1.9M12.4 8.8h2.4M12.4 11.4h2.4"/>',
  server:
    '<rect x="3.2" y="3.8" width="13.6" height="5" rx="1.2"/><rect x="3.2" y="11.2" width="13.6" height="5" rx="1.2"/><path d="M5.6 6.3h.1M5.6 13.7h.1M8 6.3h5.4M8 13.7h5.4"/>',
  terminal:
    '<rect x="3" y="4.2" width="14" height="11.6" rx="1.6"/><path d="m6.2 8.2 2.4 1.8-2.4 1.8M10.4 11.8h3.4"/>',
  license:
    '<rect x="3.6" y="4" width="12.8" height="12" rx="1.5"/><path d="M7 8h6M7 10.8h4.5M12.5 13.5l1.2 1.2 2-2"/>',
  check: '<path d="m4.5 10.2 3.4 3.4 7.6-7.6"/>',
  x: '<path d="m5 5 10 10M15 5 5 15"/>',
  clock: '<circle cx="10" cy="10" r="6.6"/><path d="M10 6.4v4l2.6 1.6"/>',
  refresh: '<path d="M15.4 8.2A5.6 5.6 0 1 0 15 13"/><path d="M15.6 4.4v3.8h-3.8"/>',
  devices:
    '<rect x="3" y="4.4" width="9.4" height="7" rx="1.2"/><path d="M6 14.4h4.4M13 8.4h4v7h-4z"/>',
  command:
    '<path d="M7.2 7.2H5.6a2 2 0 1 1 2-2v9.2a2 2 0 1 1-2-2h8.8a2 2 0 1 1-2 2V5.4a2 2 0 1 1 2 2H7.2Z"/>',
  filter: '<path d="M3.4 5.2h13.2M5.8 10h8.4M8 14.8h4"/>',
  external:
    '<path d="M11.5 4.5h4v4M15 5l-5.4 5.4"/><path d="M14 11.5v3c0 .8-.6 1.4-1.4 1.4H5.4A1.4 1.4 0 0 1 4 14.5V7.4C4 6.6 4.6 6 5.4 6h3"/>',
  user: '<circle cx="10" cy="7.4" r="2.7"/><path d="M4.8 16c.5-2.6 2.5-4 5.2-4s4.7 1.4 5.2 4"/>',
  grid: '<rect x="3.4" y="3.4" width="5.4" height="5.4" rx="1"/><rect x="11.2" y="3.4" width="5.4" height="5.4" rx="1"/><rect x="3.4" y="11.2" width="5.4" height="5.4" rx="1"/><rect x="11.2" y="11.2" width="5.4" height="5.4" rx="1"/>',
  info: '<circle cx="10" cy="10" r="6.6"/><path d="M10 9v4.2M10 6.6h.01"/>',
  pencil:
    '<path d="M4 16h3.2L15.4 7.8a1.7 1.7 0 0 0 0-2.4l-.8-.8a1.7 1.7 0 0 0-2.4 0L4 12.8V16Z"/><path d="m11.4 5.8 2.8 2.8"/>',
  sliders:
    '<path d="M3.5 6.5h13M3.5 13.5h13"/><circle cx="7.5" cy="6.5" r="1.8" fill="var(--bg)"/><circle cx="12.5" cy="13.5" r="1.8" fill="var(--bg)"/>',
  wifi: '<path d="M3.4 8.2a9.6 9.6 0 0 1 13.2 0M6 11a6 6 0 0 1 8 0M8.4 13.7a2.6 2.6 0 0 1 3.2 0"/><circle cx="10" cy="16" r=".7" fill="currentColor" stroke="none"/>',
  qr: '<rect x="3.5" y="3.5" width="5" height="5" rx="0.8"/><rect x="11.5" y="3.5" width="5" height="5" rx="0.8"/><rect x="3.5" y="11.5" width="5" height="5" rx="0.8"/><path d="M11.5 11.5h2v2h-2zM14.5 11.5h2v5h-5v-2"/>',
  touchid:
    '<path d="M5.5 10a4.5 4.5 0 0 1 9 0v1.5M7.5 10.2a2.5 2.5 0 0 1 5 0v2.5M10 10.2v4.3M4 8.2A6.5 6.5 0 0 1 16 8.2"/>',
  link: '<path d="M8.5 11.5 11.5 8.5M7 13l-1.5 1.5a2.1 2.1 0 0 1-3-3L4 10m9-3 1.5-1.5a2.1 2.1 0 0 1 3 3L16 10"/>',
  star: '<path d="m10 3.4 2 4.2 4.6.6-3.3 3.2.8 4.6-4.1-2.2-4.1 2.2.8-4.6L3.4 8.2 8 7.6 10 3.4Z"/>',
  layers:
    '<path d="m10 3.5 6.5 3.3L10 10 3.5 6.8 10 3.5ZM3.5 10l6.5 3.2 6.5-3.2M3.5 13.2l6.5 3.3 6.5-3.3"/>',
  alert: '<path d="M10 3.6 17 15.6H3L10 3.6Z"/><path d="M10 8.5v3.3M10 13.8h.01"/>',
  undo: '<path d="M4.5 8.5h7.3a3.7 3.7 0 0 1 0 7.4H9"/><path d="M7.2 5.8 4.5 8.5l2.7 2.7"/>',
};

function icon(name, size = 14) {
  const path = ICONS[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function AV(item, cls = "") {
  const glyph = item.ini || "?";
  return `<span class="av ${cls} av-${item.tone || "blue"}">${glyph}</span>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function syntaxPw(str) {
  return [...String(str)]
    .map((ch) => {
      if (/\d/.test(ch)) return `<span class="pw-d">${escapeHtml(ch)}</span>`;
      if (/[^a-zA-Z0-9]/.test(ch)) return `<span class="pw-s">${escapeHtml(ch)}</span>`;
      return escapeHtml(ch);
    })
    .join("");
}

function svgQrMatrix(size = 112) {
  // Deterministic crisp synthetic QR matrix for visual prototype only
  const cells = 21;
  const cell = size / cells;
  let rects = "";
  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      let on = false;
      if (isFinder(r, c)) {
        const lr = r >= cells - 7 ? r - (cells - 7) : r;
        const lc = c >= cells - 7 ? c - (cells - 7) : c;
        on =
          lr === 0 ||
          lr === 6 ||
          lc === 0 ||
          lc === 6 ||
          (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else if (r === 6 || c === 6) {
        on = (r + c) % 2 === 0;
      } else {
        on = (r * 17 + c * 31 + r * c) % 5 < 2;
      }
      if (on) {
        rects += `<rect x="${(c * cell).toFixed(1)}" y="${(r * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" rx="0.6"/>`;
      }
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="currentColor" aria-label="合成二维码示例">${rects}</svg>`;
}
