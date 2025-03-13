chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {  // Fires when page fully loads
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
            if (activeTabs.length > 0 && activeTabs[0].id === tabId) {
                // console.log("Page Reloaded or Navigated:", tab.url);
                chrome.tabs.sendMessage(tabId, { action: "urlChanged", url: tab.url });
            }
        });
    }
});

