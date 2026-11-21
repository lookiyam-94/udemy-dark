const root = document.documentElement;
let enabled = true;

// ---- settings -------------------------------------------------------------
function apply(on) {
  enabled = !!on;
  root.classList.toggle("udemy-dark", enabled);
  if (enabled) scan(document.body || root);
  else restoreAll();
}

// ---- tagging ---------------------------------------------------------------
// The script only tags elements with data-ud-* attributes. The colors live in
// dark.css and apply only under html.udemy-dark, so switching off is one class removal.
const SKIP = new Set(["IMG", "VIDEO", "CANVAS", "PICTURE", "IFRAME", "SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "HEAD", "SVG", "PATH", "INPUT", "TEXTAREA", "SELECT"]);
const ATTRS = ["data-ud-bg", "data-ud-fg", "data-ud-bd"];

// Normalise any CSS color (rgb, color(srgb ...), oklch, color-mix results...) through a canvas.
const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const cache = new Map();
function parse(c) {
  if (!c || c === "transparent") return null;
  if (cache.has(c)) return cache.get(c);
  let out = null;
  const m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    out = { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  } else {
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    } catch (e) { out = null; }
  }
  cache.set(c, out);
  return out;
}
const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
const sat = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);

function recolor(el, fresh) {
  if (SKIP.has(el.tagName.toUpperCase())) return;
  // A class change may have given the element new colors: drop our tags and re-measure.
  if (fresh) for (const a of ATTRS) el.removeAttribute(a);
  const cs = getComputedStyle(el);

  const bg = parse(cs.backgroundColor);
  if (bg && bg.a > 0.4 && sat(bg) < 40) {
    const l = lum(bg);
    if (l > 0.93) el.setAttribute("data-ud-bg", "light");
    else if (l > 0.8) el.setAttribute("data-ud-bg", "mid");
    else if (l > 0.6) el.setAttribute("data-ud-bg", "soft");
  }

  const fg = parse(cs.color);
  if (fg && sat(fg) < 70) {
    const l = lum(fg);
    if (l < 0.4) el.setAttribute("data-ud-fg", "main");
    else if (l < 0.55) el.setAttribute("data-ud-fg", "muted");
  }

  for (const side of ["Top", "Right", "Bottom", "Left"]) {
    const bc = parse(cs["border" + side + "Color"]);
    if (bc && bc.a > 0.3 && sat(bc) < 40 && lum(bc) > 0.6 && parseFloat(cs["border" + side + "Width"]) > 0) {
      el.setAttribute("data-ud-bd", "1");
      break;
    }
  }
}

let queue = [];
let scheduled = false;
const fresh = new WeakSet();
function flush() {
  scheduled = false;
  const start = performance.now();
  while (queue.length && performance.now() - start < 12) {
    const el = queue.pop();
    if (el.isConnected) {
      try { recolor(el, fresh.has(el)); } catch (e) { /* one bad element must not stall the queue */ }
      fresh.delete(el);
    }
  }
  if (queue.length) schedule();
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(flush);
}
function scan(node) {
  if (!enabled || !node || node.nodeType !== 1) return;
  queue.push(node, ...node.querySelectorAll("*"));
  schedule();
}

function restoreAll() {
  queue = []; // class removal already switches every color off
}

let rescanTimer;
function fullRescanSoon() {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => scan(document.body || root), 150);
}

const observer = new MutationObserver((muts) => {
  if (!enabled) return;
  for (const m of muts) {
    if (m.type === "childList") {
      m.addedNodes.forEach((n) => {
        // Late-loaded stylesheets can change colors anywhere: rescan everything.
        if (n.nodeName === "STYLE" || n.nodeName === "LINK") fullRescanSoon();
        else scan(n);
      });
    }
    else if (m.type === "attributes" && m.target !== root) { fresh.add(m.target); queue.push(m.target); schedule(); }
  }
});
function start() {
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  scan(document.body || root);
  // Catch styles that arrive after load.
  window.addEventListener("load", () => { fullRescanSoon(); setTimeout(fullRescanSoon, 1500); setTimeout(fullRescanSoon, 4000); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();

// ---- start (after all declarations above; apply() uses them) ----------------
apply(true);
// storage.local (Vivaldi has no browser sync) plus a direct message from the popup.
chrome.storage.local.get({ enabled: true }, (r) => apply(r.enabled));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) apply(changes.enabled.newValue);
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "udemy-dark:set") apply(msg.enabled);
});
