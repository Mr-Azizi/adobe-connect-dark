/**
 * Adobe Connect Dark Mode - Popup Script
 * Permission-on-demand architecture using siteKey (scheme + host):
 * Ensures HTTP and HTTPS are separate, guarantees atomic registration,
 * and maintains synchronized state.
 */

document.addEventListener('DOMContentLoaded', () => {
  const currentDomainEl = document.getElementById('current-domain');
  const statusBadgeEl = document.getElementById('status-badge');
  const themeToggleEl = document.getElementById('theme-toggle');
  const rtlToggleEl = document.getElementById('rtl-toggle');
  const resetBtnEl = document.getElementById('reset-btn');
  const toastEl = document.getElementById('toast');
  const versionEl = document.getElementById('extension-version');

  // Synchronize version display with manifest.json
  if (versionEl) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) {
        versionEl.textContent = `v${manifest.version}`;
      }
    } catch (err) {
      console.warn('[ACD] Failed to read manifest version:', err);
    }
  }

  let currentTab = null;
  let currentUrl = null;
  let currentSiteKey = null;
  let currentOriginPattern = null;
  let toastTimer = null;

  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2500);
  }

  function updateStatusBadge(isDark, isRtl) {
    if (isDark || isRtl) {
      statusBadgeEl.textContent = 'Active';
      statusBadgeEl.className = 'badge badge-active';
    } else {
      statusBadgeEl.textContent = 'Inactive';
      statusBadgeEl.className = 'badge badge-inactive';
    }
  }

  function getScriptId(urlObj) {
    const protocolSlug = urlObj.protocol.replace(':', '');
    const hostSlug = urlObj.hostname.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `acd_cs_${protocolSlug}_${hostSlug}`;
  }

  async function ensureRegistration(scriptId, originPattern) {
    if (!chrome.scripting || !chrome.scripting.registerContentScripts) return true;

    try {
      const registered = await chrome.scripting.getRegisteredContentScripts();
      const isAlreadyRegistered = registered.some((r) => r.id === scriptId);
      if (!isAlreadyRegistered) {
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
      }
      return true;
    } catch (err) {
      console.error('[ACD] Dynamic content script registration failed:', err);
      return false;
    }
  }

  async function cleanupRegistrationIfUnneeded(scriptId, keepDark, keepRtl) {
    if (keepDark || keepRtl) return;
    if (chrome.scripting && chrome.scripting.unregisterContentScripts) {
      try {
        await chrome.scripting.unregisterContentScripts({ ids: [scriptId] });
      } catch (err) {
        // Ignored if already unregistered
      }
    }
  }

  function sendTabMessageWithFallback(messagePayload) {
    if (!currentTab || !currentTab.id) return;

    chrome.tabs.sendMessage(currentTab.id, messagePayload, () => {
      if (chrome.runtime.lastError) {
        // Fallback injection if content script was not already running in tab
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript({
            target: { tabId: currentTab.id, allFrames: true },
            files: [
              'content/theme-engine.js',
              'content/observer.js',
              'content/content.js'
            ]
          }).catch((e) => console.warn('[ACD] Injection fallback:', e));
        }
      }
    });
  }

  // Query active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      currentDomainEl.textContent = 'No active tab found';
      themeToggleEl.disabled = true;
      if (rtlToggleEl) rtlToggleEl.disabled = true;
      resetBtnEl.disabled = true;
      return;
    }

    currentTab = tabs[0];
    const urlString = currentTab.url || '';

    try {
      currentUrl = new URL(urlString);
    } catch (e) {
      currentDomainEl.textContent = 'Invalid URL';
      themeToggleEl.disabled = true;
      if (rtlToggleEl) rtlToggleEl.disabled = true;
      resetBtnEl.disabled = true;
      return;
    }

    // Check for web schemes (http or https)
    if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') {
      currentDomainEl.textContent = 'Browser Internal Page';
      themeToggleEl.disabled = true;
      if (rtlToggleEl) rtlToggleEl.disabled = true;
      resetBtnEl.disabled = true;
      statusBadgeEl.textContent = 'Unsupported';
      statusBadgeEl.className = 'badge badge-inactive';
      return;
    }

    // Define scheme-specific siteKey (e.g. "https://connect.example.com")
    currentSiteKey = `${currentUrl.protocol}//${currentUrl.hostname}`;
    currentOriginPattern = `${currentSiteKey}/*`;

    // Display site info in UI
    currentDomainEl.textContent = `${currentUrl.hostname} (${currentUrl.protocol.replace(':', '').toUpperCase()})`;
    currentDomainEl.title = currentSiteKey;

    // Load persisted state for this siteKey (with backward-compatibility migration)
    chrome.storage.local.get(['acd_enabled_sites', 'acd_enabled_domains', 'acd_rtl_chat_sites'], (result) => {
      if (chrome.runtime.lastError) {
        showToast('Error loading settings');
        return;
      }

      let enabledSites = result.acd_enabled_sites;

      // Migrate legacy acd_enabled_domains if needed
      if (!enabledSites && result.acd_enabled_domains) {
        enabledSites = {};
        for (const [dom, val] of Object.entries(result.acd_enabled_domains)) {
          if (val) {
            enabledSites[`https://${dom}`] = true;
          }
        }
        chrome.storage.local.set({ acd_enabled_sites: enabledSites });
      }

      enabledSites = enabledSites || {};
      const rtlSites = result.acd_rtl_chat_sites || {};

      const isDark = Boolean(enabledSites[currentSiteKey]);
      const isRtl = Boolean(rtlSites[currentSiteKey]);

      themeToggleEl.checked = isDark;
      if (rtlToggleEl) rtlToggleEl.checked = isRtl;

      updateStatusBadge(isDark, isRtl);
    });
  });

  // Dark Mode Toggle handler
  themeToggleEl.addEventListener('change', () => {
    if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

    const wantsToEnable = themeToggleEl.checked;
    const isRtlActive = rtlToggleEl ? rtlToggleEl.checked : false;
    const scriptId = getScriptId(currentUrl);

    if (wantsToEnable) {
      chrome.permissions.request({ origins: [currentOriginPattern] }, async (granted) => {
        if (!granted) {
          themeToggleEl.checked = false;
          updateStatusBadge(false, isRtlActive);
          showToast('Permission not granted / مجوز داده نشد');
          return;
        }

        const regOk = await ensureRegistration(scriptId, currentOriginPattern);
        if (!regOk) {
          themeToggleEl.checked = false;
          updateStatusBadge(false, isRtlActive);
          showToast('Registration failed / خطا در ثبت اسکریپت');
          return;
        }

        chrome.storage.local.get(['acd_enabled_sites'], (result) => {
          const enabledSites = result.acd_enabled_sites || {};
          enabledSites[currentSiteKey] = true;

          chrome.storage.local.set({ acd_enabled_sites: enabledSites }, () => {
            updateStatusBadge(true, isRtlActive);
            showToast('✓ Dark Mode enabled for ' + currentUrl.hostname);
            sendTabMessageWithFallback({ action: 'toggleDark', enabled: true, siteKey: currentSiteKey });
          });
        });
      });
    } else {
      chrome.storage.local.get(['acd_enabled_sites'], async (result) => {
        const enabledSites = result.acd_enabled_sites || {};
        delete enabledSites[currentSiteKey];

        await cleanupRegistrationIfUnneeded(scriptId, false, isRtlActive);

        chrome.storage.local.set({ acd_enabled_sites: enabledSites }, () => {
          updateStatusBadge(false, isRtlActive);
          showToast('✓ Dark Mode disabled');
          sendTabMessageWithFallback({ action: 'toggleDark', enabled: false, siteKey: currentSiteKey });
        });
      });
    }
  });

  // RTL Chat Text Toggle handler
  if (rtlToggleEl) {
    rtlToggleEl.addEventListener('change', () => {
      if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

      const wantsToEnable = rtlToggleEl.checked;
      const isDarkActive = themeToggleEl.checked;
      const scriptId = getScriptId(currentUrl);

      if (wantsToEnable) {
        chrome.permissions.request({ origins: [currentOriginPattern] }, async (granted) => {
          if (!granted) {
            rtlToggleEl.checked = false;
            updateStatusBadge(isDarkActive, false);
            showToast('Permission not granted / مجوز داده نشد');
            return;
          }

          const regOk = await ensureRegistration(scriptId, currentOriginPattern);
          if (!regOk) {
            rtlToggleEl.checked = false;
            updateStatusBadge(isDarkActive, false);
            showToast('Registration failed / خطا در ثبت اسکریپت');
            return;
          }

          chrome.storage.local.get(['acd_rtl_chat_sites'], (result) => {
            const rtlSites = result.acd_rtl_chat_sites || {};
            rtlSites[currentSiteKey] = true;

            chrome.storage.local.set({ acd_rtl_chat_sites: rtlSites }, () => {
              updateStatusBadge(isDarkActive, true);
              showToast('✓ RTL Chat enabled for ' + currentUrl.hostname);
              sendTabMessageWithFallback({ action: 'toggleRtl', enabled: true, siteKey: currentSiteKey });
            });
          });
        });
      } else {
        chrome.storage.local.get(['acd_rtl_chat_sites'], async (result) => {
          const rtlSites = result.acd_rtl_chat_sites || {};
          delete rtlSites[currentSiteKey];

          await cleanupRegistrationIfUnneeded(scriptId, isDarkActive, false);

          chrome.storage.local.set({ acd_rtl_chat_sites: rtlSites }, () => {
            updateStatusBadge(isDarkActive, false);
            showToast('✓ RTL Chat disabled');
            sendTabMessageWithFallback({ action: 'toggleRtl', enabled: false, siteKey: currentSiteKey });
          });
        });
      }
    });
  }

  // Reset button handler
  resetBtnEl.addEventListener('click', () => {
    if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

    const scriptId = getScriptId(currentUrl);

    // 1. Unregister dynamic content script
    if (chrome.scripting && chrome.scripting.unregisterContentScripts) {
      chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});
    }

    // 2. Remove siteKey from storage
    chrome.storage.local.get(['acd_enabled_sites', 'acd_rtl_chat_sites'], (result) => {
      const enabledSites = result.acd_enabled_sites || {};
      const rtlSites = result.acd_rtl_chat_sites || {};
      delete enabledSites[currentSiteKey];
      delete rtlSites[currentSiteKey];

      chrome.storage.local.set({
        acd_enabled_sites: enabledSites,
        acd_rtl_chat_sites: rtlSites
      }, () => {
        themeToggleEl.checked = false;
        if (rtlToggleEl) rtlToggleEl.checked = false;
        updateStatusBadge(false, false);
        showToast('✓ Site settings reset');

        // 3. Message tab to reset
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: 'reset', siteKey: currentSiteKey },
          () => {
            if (chrome.runtime.lastError) {}
          }
        );

        // 4. Revoke origin host permission
        if (chrome.permissions && chrome.permissions.remove) {
          chrome.permissions.remove({ origins: [currentOriginPattern] }, () => {
            if (chrome.runtime.lastError) {}
          });
        }
      });
    });
  });
});
