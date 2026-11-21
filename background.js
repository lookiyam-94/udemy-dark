// Clicking the toolbar icon toggles the theme and reloads the current Udemy tab.
function showState(enabled) {
  chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#6e6e6e" });
  chrome.action.setTitle({ title: enabled ? "Udemy Dark: on (click to turn off)" : "Udemy Dark: off (click to turn on)" });
}

chrome.storage.local.get({ enabled: true }, (r) => showState(r.enabled));
chrome.runtime.onStartup.addListener(() => chrome.storage.local.get({ enabled: true }, (r) => showState(r.enabled)));

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get({ enabled: true }, (r) => {
    const enabled = !r.enabled;
    chrome.storage.local.set({ enabled }, () => {
      showState(enabled);
      if (tab && tab.id != null && /^https?:\/\/([^/]*\.)?udemy\.com\//.test(tab.url || "")) {
        chrome.tabs.reload(tab.id);
      }
    });
  });
});
