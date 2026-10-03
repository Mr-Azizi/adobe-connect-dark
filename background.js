/**
 * Adobe Connect Dark Mode - Background Service Worker (Manifest V3)
 * Handles lifecycle events, self-healing script synchronization,
 * and toolbar action badge indicators based on siteKey.
 */

function getIsolatedScriptIdForSite(siteKey) {
  try {
    const u = new URL(siteKey);
    const protocolSlug = u.protocol.replace(':', '');
    const hostSlug = u.hostname.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `acd_cs_${protocolSlug}_${hostSlug}`;
  } catch (e) {
    return null;
  }
}

function getMainScriptIdForSite(siteKey) {
  try {
    const u = new URL(siteKey);
    const protocolSlug = u.protocol.replace(':', '');
    const hostSlug = u.hostname.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `acd_main_${protocolSlug}_${hostSlug}`;
  } catch (e) {
    return null;
  }
}

function getScriptIdForSite(siteKey) {
  return getIsolatedScriptIdForSite(siteKey);
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
 * Migrate legacy acd_enabled_domains to acd_enabled_sites and ensure default storage
 */
async function migrateLegacyStorage() {
  try {
    const result = await chrome.storage.local.get(['acd_enabled_sites', 'acd_enabled_domains', 'acd_rtl_chat_sites']);
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
    if (!result.acd_rtl_chat_sites) {
      await chrome.storage.local.set({ acd_rtl_chat_sites: {} });
    }
  } catch (e) {
    console.warn('[ACD] Storage migration warning:', e);
  }
}

/**
 * Self-healing synchronization between:
 * 1. Storage state (acd_enabled_sites & acd_rtl_chat_sites)
 * 2. Permission state (chrome.permissions.contains)
 * 3. Registered content scripts (chrome.scripting.getRegisteredContentScripts)
 * Runtime is active whenever either Dark Mode OR RTL Chat is enabled.
 */
async function syncRegisteredScripts() {
  if (!chrome.scripting || !chrome.scripting.getRegisteredContentScripts) return;

  try {
    const result = await chrome.storage.local.get(['acd_enabled_sites', 'acd_rtl_chat_sites']);
    const enabledDarkSites = { ...(result.acd_enabled_sites || {}) };
    const enabledRtlSites = { ...(result.acd_rtl_chat_sites || {}) };
    let storageChanged = false;

    const registered = await chrome.scripting.getRegisteredContentScripts();
    const registeredIds = new Set(registered.map((r) => r.id));
    const validScriptIds = new Set();

    // Collect all unique siteKeys that have either Dark Mode or RTL enabled
    const allSiteKeys = new Set([
      ...Object.keys(enabledDarkSites).filter((k) => enabledDarkSites[k]),
      ...Object.keys(enabledRtlSites).filter((k) => enabledRtlSites[k])
    ]);

    // 1. Verify all active sites against actual permission state
    for (const siteKey of allSiteKeys) {
      const originPattern = `${siteKey}/*`;
      let hasPermission = false;

      try {
        hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
      } catch (e) {
        hasPermission = false;
      }

      if (!hasPermission) {
        // Permission was revoked or does not exist: purge from enabled storage
        if (enabledDarkSites[siteKey]) {
          delete enabledDarkSites[siteKey];
          storageChanged = true;
        }
        if (enabledRtlSites[siteKey]) {
          delete enabledRtlSites[siteKey];
          storageChanged = true;
        }
        continue;
      }

      const isolatedScriptId = getIsolatedScriptIdForSite(siteKey);
      const mainScriptId = getMainScriptIdForSite(siteKey);
      if (!isolatedScriptId || !mainScriptId) continue;

      validScriptIds.add(isolatedScriptId);
      validScriptIds.add(mainScriptId);

      const scriptsToRegister = [];

      // Self-healing: If permission is valid but isolated script is missing, repair it!
      if (!registeredIds.has(isolatedScriptId)) {
        scriptsToRegister.push({
          id: isolatedScriptId,
          matches: [originPattern],
          js: [
            'content/theme-engine.js',
            'content/observer.js',
            'content/content.js'
          ],
          runAt: 'document_start',
          allFrames: true,
          world: 'ISOLATED'
        });
      }

      // Self-healing: If permission is valid but MAIN-world script is missing, repair it!
      if (!registeredIds.has(mainScriptId)) {
        scriptsToRegister.push({
          id: mainScriptId,
          matches: [originPattern],
          js: [
            'content/chat-rtl-main.js'
          ],
          runAt: 'document_start',
          allFrames: true,
          world: 'MAIN'
        });
      }

      if (scriptsToRegister.length > 0) {
        try {
          await chrome.scripting.registerContentScripts(scriptsToRegister);
          scriptsToRegister.forEach((s) => registeredIds.add(s.id));
        } catch (regErr) {
          console.warn('[ACD] Self-healing registration error for ' + siteKey, regErr);
        }
      }
    }

    // 2. Clean up any stale registrations not in validScriptIds (recognizing both acd_cs_ and acd_main_)
    const toUnregister = [];
    for (const r of registered) {
      if ((r.id.startsWith('acd_cs_') || r.id.startsWith('acd_main_')) && !validScriptIds.has(r.id)) {
        toUnregister.push(r.id);
      }
    }

    if (toUnregister.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: toUnregister });
    }

    // 3. Persist cleaned storage if any invalid entries were purged
    if (storageChanged) {
      await chrome.storage.local.set({
        acd_enabled_sites: enabledDarkSites,
        acd_rtl_chat_sites: enabledRtlSites
      });
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
    chrome.storage.local.get(['acd_enabled_sites', 'acd_rtl_chat_sites'], (result) => {
      const darkEnabled = Boolean((result.acd_enabled_sites || {})[siteKey]);
      const rtlEnabled = Boolean((result.acd_rtl_chat_sites || {})[siteKey]);

      if (darkEnabled || rtlEnabled) {
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
  if (areaName !== 'local' || (!changes.acd_enabled_sites && !changes.acd_rtl_chat_sites)) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      updateBadgeForTab(tabs[0].id, tabs[0].url);
    }
  });
});
