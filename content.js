const root = document.documentElement;
let enabled = true;

// ---- settings -------------------------------------------------------------
function apply(on) {
  enabled = !!on;
  root.classList.toggle("udemy-dark", enabled);
  if (enabled) scan(document.body || root);
  else restoreAll();
}
apply(true);
// storage.local (Vivaldi has no browser sync) plus a direct message from the popup.
chrome.storage.local.get({ enabled: true }, (r) => apply(r.enabled));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) apply(changes.enabled.newValue);
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "udemy-dark:set") apply(msg.enabled);
});

// ---- recoloring (graphite palette) ----------------------------------------
const SKIP = new Set(["IMG", "VIDEO", "CANVAS", "PICTURE", "IFRAME", "SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "HEAD", "SVG", "PATH", "INPUT", "TEXTAREA", "SELECT"]);
const BG = { light: "#191919", mid: "#1f1f1f", soft: "#2e2e2e" };
const TEXT = { main: "#e4e4e4", muted: "#8a8a8a" };
const touched = new Set();

function parse(c) {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
const sat = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);

function set(el, prop, val) {
  el.style.setProperty(prop, val, "important");
  el.dataset.udTouched = "1";
  touched.add(el);
}

function recolor(el) {
  if (SKIP.has(el.tagName.toUpperCase()) || el.dataset.udDone === "1") return;
  const cs = getComputedStyle(el);

  const bg = parse(cs.backgroundColor);
  if (bg && bg.a > 0.4 && sat(bg) < 40) {
    const l = lum(bg);
    if (l > 0.93) set(el, "background-color", BG.light);
    else if (l > 0.8) set(el, "background-color", BG.mid);
    else if (l > 0.6) set(el, "background-color", BG.soft);
  }

  const fg = parse(cs.color);
  if (fg && sat(fg) < 70) {
    const l = lum(fg);
    if (l < 0.4) set(el, "color", TEXT.main);
    else if (l < 0.55) set(el, "color", TEXT.muted);
  }

  for (const side of ["Top", "Right", "Bottom", "Left"]) {
    const bc = parse(cs["border" + side + "Color"]);
    if (bc && bc.a > 0.3 && sat(bc) < 40 && lum(bc) > 0.6 && parseFloat(cs["border" + side + "Width"]) > 0) {
      set(el, `border-${side.toLowerCase()}-color`, BG.soft);
    }
  }
}

let queue = [];
let scheduled = false;
function flush() {
  scheduled = false;
  const start = performance.now();
  while (queue.length && performance.now() - start < 12) {
    const el = queue.pop();
    if (el.isConnected) recolor(el);
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
  queue = [];
  for (const el of touched) {
    if (!el.isConnected) continue;
    for (const p of ["background-color", "color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"]) {
      el.style.removeProperty(p);
    }
    delete el.dataset.udTouched;
  }
  touched.clear();
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
    else if (m.type === "attributes") { queue.push(m.target); schedule(); }
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
