const DEFAULTS = { enabled: true, brightness: 100, contrast: 100 };
const root = document.documentElement;

function apply(s) {
  root.classList.toggle("udemy-dark", !!s.enabled);
  root.style.setProperty("--ud-brightness", s.brightness / 100);
  root.style.setProperty("--ud-contrast", s.contrast / 100);
}

// Apply defaults immediately to avoid a white flash, then load saved settings.
apply(DEFAULTS);
chrome.storage.sync.get(DEFAULTS, apply);
chrome.storage.onChanged.addListener(() =>
  chrome.storage.sync.get(DEFAULTS, apply)
);
