const box = document.getElementById("enabled");

chrome.storage.local.get({ enabled: true }, (r) => { box.checked = r.enabled; });

box.addEventListener("change", () => {
  const enabled = box.checked;
  chrome.storage.local.set({ enabled });
  // Also tell the open Udemy tab(s) directly, in case storage events don't arrive.
  chrome.tabs.query({ url: "*://*.udemy.com/*" }, (tabs) => {
    for (const t of tabs) {
      chrome.tabs.sendMessage(t.id, { type: "udemy-dark:set", enabled }, () => void chrome.runtime.lastError);
    }
  });
});
