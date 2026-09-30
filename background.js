/**
 * Adobe Connect Dark Mode - Background Service Worker (Manifest V3)
 * Handles lifecycle events, default preferences, and dynamic toolbar badge indicators.
 */

// Initialize default storage on installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.get(['acd_enabled_domains'], (result) => {
      if (!result.acd_enabled_domains) {
        chrome.storage.local.set({ acd_enabled_domains: {} });
      }
    });
  }
});

/**
 * Update the toolbar action badge (ON / empty) depending on the active tab domain
 */
function updateBadgeForTab(tabId, urlString) {
  if (!urlString) return;

  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    const domain = url.hostname;
    chrome.storage.local.get(['acd_enabled_domains'], (result) => {
      const enabledDomains = result.acd_enabled_domains || {};
      const isEnabled = Boolean(enabledDomains[domain]);

      if (isEnabled) {
        chrome.action.setBadgeText({ tabId, text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#6E9BFF' });
        chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' });
      } else {
        chrome.action.setBadgeText({ tabId, text: '' });
      }
    });
  } catch (e) {
    // URL parsing error
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

// Update badge when active tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    updateBadgeForTab(tab.id, tab.url);
  });
});

// Update badge when tab navigates or reloads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    updateBadgeForTab(tabId, tab.url);
  }
});

// Update badge when storage settings change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.acd_enabled_domains) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      updateBadgeForTab(tabs[0].id, tabs[0].url);
    }
  });
});
