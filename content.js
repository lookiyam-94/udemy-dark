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
const ATTRS = ["data-ud-bg", "data-ud-fg", "data-ud-bd", "data-ud-grad",
  "data-ud-before", "data-ud-after", "data-ud-before-grad", "data-ud-after-grad"];
const GRAD_VARS = ["--ud-grad", "--ud-grad-before", "--ud-grad-after"];

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

// Which of the three dark backgrounds (dark.css) a light, neutral color maps to.
function level(l) { return l > 0.93 ? "light" : l > 0.8 ? "mid" : l > 0.6 ? "soft" : null; }
const LEVEL_RGB = { light: 25, mid: 31, soft: 46 };

// Light gradients (highlights, edge fades) are drawn with background-image, which the plain
// background-color rules never see. Rewrite the light, neutral color stops to the dark palette
// and keep everything else (direction, positions, alpha, saturated colors) as it was.
const COLOR_TOKEN = /rgba?\([^)]*\)|color\([^)]*\)|ok?lab\([^)]*\)|ok?lch\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g;
function darkenGradient(image) {
  if (!image || !image.includes("gradient(") || image.includes("url(")) return null;
  let changed = false;
  const out = image.replace(COLOR_TOKEN, (tok) => {
    const c = parse(tok);
    if (!c || c.a < 0.02 || sat(c) >= 40) return tok;
    const lv = level(lum(c));
    if (!lv) return tok;
    changed = true;
    const d = LEVEL_RGB[lv];
    return `rgba(${d}, ${d}, ${d}, ${c.a})`;
  });
  return changed ? out : null;
}

// Light but colored backgrounds (promo banners, badges) stay light, so their dark text must stay dark.
let bgCache = new WeakMap();
function keepsLightBg(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (bgCache.has(n)) return bgCache.get(n);
    const bg = parse(getComputedStyle(n).backgroundColor);
    if (bg && bg.a > 0.4) {
      const r = sat(bg) >= 40 && lum(bg) > 0.6;
      bgCache.set(n, r);
      return r;
    }
  }
  return false;
}

function recolor(el, fresh) {
  if (SKIP.has(el.tagName.toUpperCase())) return;
  // A class change may have given the element new colors: drop our tags and re-measure.
  if (fresh) {
    for (const a of ATTRS) el.removeAttribute(a);
    for (const v of GRAD_VARS) el.style.removeProperty(v);
  }
  const cs = getComputedStyle(el);

  const bg = parse(cs.backgroundColor);
  if (bg && bg.a > 0.4 && sat(bg) < 40) {
    const l = lum(bg);
    if (l > 0.93) el.setAttribute("data-ud-bg", "light");
    else if (l > 0.8) el.setAttribute("data-ud-bg", "mid");
    else if (l > 0.6) el.setAttribute("data-ud-bg", "soft");
  }

  const grad = darkenGradient(cs.backgroundImage);
  if (grad) {
    el.setAttribute("data-ud-grad", "1");
    el.style.setProperty("--ud-grad", grad);
  }

  // Backgrounds painted by ::before / ::after overlays (selected rows, fades).
  for (const which of ["before", "after"]) {
    const ps = getComputedStyle(el, "::" + which);
    if (ps.content === "none" || ps.content === "normal") continue;
    const pb = parse(ps.backgroundColor);
    if (pb && pb.a > 0.4 && sat(pb) < 40) {
      const lv = level(lum(pb));
      if (lv) el.setAttribute("data-ud-" + which, lv);
    }
    const pg = darkenGradient(ps.backgroundImage);
    if (pg) {
      el.setAttribute("data-ud-" + which + "-grad", "1");
      el.style.setProperty("--ud-grad-" + which, pg);
    }
  }

  const fg = parse(cs.color);
  if (fg && sat(fg) < 70 && !keepsLightBg(el)) {
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
  bgCache = new WeakMap();
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
// Highlights that come from :hover, :focus or a transition change no class, so the observer never
// sees them. Re-measure the row under the pointer (or focus) shortly after it changes.
const stateRoots = new Map();
let stateTimer;
function refreshAround(t) {
  if (!enabled || !(t instanceof Element) || t === document.body || t === root) return;
  const r = t.closest("li, [role='tab'], [role='option'], [role='listitem'], button, a, [data-purpose]") || t;
  stateRoots.set(r, t);
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    for (const [r, t] of stateRoots) {
      const all = r.querySelectorAll("*");
      // A huge container: just re-measure the pointer target and a few ancestors.
      const nodes = all.length > 150 ? [t, t.parentElement, t.parentElement && t.parentElement.parentElement] : [r, ...all];
      for (const n of nodes) if (n) { fresh.add(n); queue.push(n); }
    }
    stateRoots.clear();
    bgCache = new WeakMap();
    schedule();
  }, 80);
}
for (const ev of ["mouseover", "mouseout", "focusin", "focusout", "transitionend"]) {
  document.addEventListener(ev, (e) => refreshAround(e.target), true);
}

function start() {
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["class", "aria-current", "aria-selected", "aria-checked", "aria-expanded", "data-state"] });
  scan(document.body || root);
  // Catch styles that arrive after load.
  window.addEventListener("load", () => { fullRescanSoon(); setTimeout(fullRescanSoon, 1500); setTimeout(fullRescanSoon, 4000); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();

// ---- start (after all declarations above; apply() uses them) ----------------
apply(true);
// The toolbar icon (background.js) flips this setting and reloads the page.
chrome.storage.local.get({ enabled: true }, (r) => apply(r.enabled));
