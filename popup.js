const DEFAULTS = { enabled: true, brightness: 100, contrast: 100 };
const $ = (id) => document.getElementById(id);

function render(s) {
  $("enabled").checked = s.enabled;
  $("brightness").value = s.brightness;
  $("contrast").value = s.contrast;
  $("bv").textContent = s.brightness + "%";
  $("cv").textContent = s.contrast + "%";
}

function save() {
  const s = {
    enabled: $("enabled").checked,
    brightness: Number($("brightness").value),
    contrast: Number($("contrast").value),
  };
  chrome.storage.sync.set(s);
  render(s);
}

chrome.storage.sync.get(DEFAULTS, render);
["enabled", "brightness", "contrast"].forEach((id) => $(id).addEventListener("input", save));
$("reset").addEventListener("click", () => { chrome.storage.sync.set(DEFAULTS); render(DEFAULTS); });
