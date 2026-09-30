/**
 * Adobe Connect Dark Mode - Background Service Worker (Manifest V3)
 * Handles lifecycle events, self-healing script synchronization,
 * and toolbar action badge indicators based on siteKey.
 */

function getScriptIdForSite(siteKey) {
  try {
    const u = new URL(siteKey);
    const protocolSlug = u.protocol.replace(':', '');
    const hostSlug = u.hostname.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `acd_cs_${protocolSlug}_${hostSlug}`;
  } catch (e) {
    return null;
  }
}

// Initialize default storage, migrate legacy domain data, and sync scripts
chrome.runtime.onInstalled.addListener(async (details) => {
  await migrateLegacyStorage();
  await syncRegisteredScripts();
});

// Sync registered scripts on browser startup
chrome.runtime.onStartup.addListener(async () => {
  await migrateLegacyStorage();
  await syncRegisteredScripts();
});

/**
 * Migrate legacy acd_enabled_domains to acd_enabled_sites
 */
async function migrateLegacyStorage() {
  try {
    const result = await chrome.storage.local.get(['acd_enabled_sites', 'acd_enabled_domains']);
    if (!result.acd_enabled_sites && result.acd_enabled_domains) {
      const migrated = {};
      for (const [dom, val] of Object.entries(result.acd_enabled_domains)) {
        if (val) {
          migrated[`https://${dom}`] = true;
        }
      }
      await chrome.storage.local.set({ acd_enabled_sites: migrated });
      await chrome.storage.local.remove(['acd_enabled_domains']);
    } else if (!result.acd_enabled_sites) {
      await chrome.storage.local.set({ acd_enabled_sites: {} });
    }
  } catch (e) {
    console.warn('[ACD] Storage migration warning:', e);
  }
}

/**
 * Self-healing synchronization between:
 * 1. Storage state (acd_enabled_sites)
 * 2. Permission state (chrome.permissions.contains)
 * 3. Registered content scripts (chrome.scripting.getRegisteredContentScripts)
 */
async function syncRegisteredScripts() {
  if (!chrome.scripting || !chrome.scripting.getRegisteredContentScripts) return;

  try {
    const result = await chrome.storage.local.get(['acd_enabled_sites']);
    const enabledSites = { ...(result.acd_enabled_sites || {}) };
    let storageChanged = false;

    const registered = await chrome.scripting.getRegisteredContentScripts();
    const registeredIds = new Set(registered.map((r) => r.id));
    const validScriptIds = new Set();

    // 1. Verify all sites in storage against actual permission state
    for (const siteKey of Object.keys(enabledSites)) {
      if (!enabledSites[siteKey]) continue;

      const originPattern = `${siteKey}/*`;
      let hasPermission = false;

      try {
        hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
      } catch (e) {
        hasPermission = false;
      }

      if (!hasPermission) {
        // Permission was revoked or does not exist: remove from enabled storage
        delete enabledSites[siteKey];
        storageChanged = true;
        continue;
      }

      const scriptId = getScriptIdForSite(siteKey);
      if (!scriptId) continue;

      validScriptIds.add(scriptId);

      // Self-healing: If permission is valid but registered script is missing, repair it!
      if (!registeredIds.has(scriptId)) {
        try {
          await chrome.scripting.registerContentScripts([{
            id: scriptId,
            matches: [originPattern],
            js: [
              'content/theme-engine.js',
              'content/observer.js',
              'content/content.js'
            ],
            runAt: 'document_start',
            allFrames: true
          }]);
          registeredIds.add(scriptId);
        } catch (regErr) {
          console.warn('[ACD] Self-healing registration error for ' + siteKey, regErr);
        }
      }
    }

    // 2. Clean up any stale registrations not in validScriptIds
    const toUnregister = [];
    for (const r of registered) {
      if (r.id.startsWith('acd_cs_') && !validScriptIds.has(r.id)) {
        toUnregister.push(r.id);
      }
    }

    if (toUnregister.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: toUnregister });
    }

    // 3. Persist cleaned storage if any invalid entries were purged
    if (storageChanged) {
      await chrome.storage.local.set({ acd_enabled_sites: enabledSites });
    }
  } catch (e) {
    console.warn('[ACD] Error during self-healing sync:', e);
  }
}

/**
 * Update the toolbar action badge (ON / empty) depending on the active tab siteKey
 */
function updateBadgeForTab(tabId, urlString) {
  if (!urlString) return;

  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    const siteKey = `${url.protocol}//${url.hostname}`;
    chrome.storage.local.get(['acd_enabled_sites'], (result) => {
      const enabledSites = result.acd_enabled_sites || {};
      const isEnabled = Boolean(enabledSites[siteKey]);

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
  if (areaName !== 'local' || !changes.acd_enabled_sites) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      updateBadgeForTab(tabs[0].id, tabs[0].url);
    }
  });
});
