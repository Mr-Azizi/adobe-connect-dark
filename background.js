/**
 * Adobe Connect Dark Mode - Background Service Worker (Manifest V3)
 * Handles lifecycle events, default preferences, dynamic script registration sync,
 * and toolbar action badge indicators.
 */

// Initialize default storage and sync registered scripts on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    chrome.storage.local.get(['acd_enabled_domains'], (result) => {
      if (!result.acd_enabled_domains) {
        chrome.storage.local.set({ acd_enabled_domains: {} });
      }
    });
  }
  await syncRegisteredScripts();
});

// Sync registered scripts on browser startup
chrome.runtime.onStartup.addListener(async () => {
  await syncRegisteredScripts();
});

/**
 * Synchronize chrome.scripting.registerContentScripts with storage.local
 */
async function syncRegisteredScripts() {
  if (!chrome.scripting || !chrome.scripting.getRegisteredContentScripts) return;

  try {
    const result = await chrome.storage.local.get(['acd_enabled_domains']);
    const enabledDomains = result.acd_enabled_domains || {};
    const registered = await chrome.scripting.getRegisteredContentScripts();
    const registeredMap = new Map(registered.map((r) => [r.id, r]));

    // Unregister any scripts that are no longer in enabledDomains
    const toUnregister = [];
    for (const [id] of registeredMap) {
      if (id.startsWith('acd_cs_')) {
        const domainSlug = id.replace('acd_cs_', '');
        const stillEnabled = Object.keys(enabledDomains).some(
          (d) => d.replace(/[^a-zA-Z0-9_-]/g, '_') === domainSlug && enabledDomains[d]
        );
        if (!stillEnabled) {
          toUnregister.push(id);
        }
      }
    }

    if (toUnregister.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: toUnregister });
    }
  } catch (e) {
    console.warn('[ACD] Error syncing registered scripts:', e);
  }
}

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
