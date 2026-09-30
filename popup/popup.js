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
  const resetBtnEl = document.getElementById('reset-btn');
  const toastEl = document.getElementById('toast');

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

  function updateUIState(isActive) {
    themeToggleEl.checked = isActive;
    if (isActive) {
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

  // Query active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      currentDomainEl.textContent = 'No active tab found';
      themeToggleEl.disabled = true;
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
      resetBtnEl.disabled = true;
      return;
    }

    // Check for web schemes (http or https)
    if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') {
      currentDomainEl.textContent = 'Browser Internal Page';
      themeToggleEl.disabled = true;
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
    chrome.storage.local.get(['acd_enabled_sites', 'acd_enabled_domains'], (result) => {
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
      const isEnabled = Boolean(enabledSites[currentSiteKey]);
      updateUIState(isEnabled);
    });
  });

  // Toggle handler with ATOMIC execution
  themeToggleEl.addEventListener('change', () => {
    if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

    const wantsToEnable = themeToggleEl.checked;
    const scriptId = getScriptId(currentUrl);

    if (wantsToEnable) {
      // Step 1: Request permission specifically for this siteKey origin
      chrome.permissions.request({ origins: [currentOriginPattern] }, async (granted) => {
        if (!granted) {
          // Permission denied by user: rollback toggle immediately
          updateUIState(false);
          showToast('Permission not granted / مجوز داده نشد');
          return;
        }

        // Step 2: Register dynamic content script
        let regSuccess = false;
        try {
          if (chrome.scripting && chrome.scripting.registerContentScripts) {
            await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});
            await chrome.scripting.registerContentScripts([{
              id: scriptId,
              matches: [currentOriginPattern],
              js: [
                'content/theme-engine.js',
                'content/observer.js',
                'content/content.js'
              ],
              runAt: 'document_start',
              allFrames: true
            }]);
            regSuccess = true;
          }
        } catch (err) {
          console.error('[ACD] Dynamic content script registration failed:', err);
        }

        // Step 3: Handle registration failure atomically
        if (!regSuccess) {
          updateUIState(false);
          showToast('Registration failed / خطا در ثبت اسکریپت');
          return;
        }

        // Step 4: Persist enabled state to storage ONLY after successful registration
        chrome.storage.local.get(['acd_enabled_sites'], (result) => {
          const enabledSites = result.acd_enabled_sites || {};
          enabledSites[currentSiteKey] = true;

          chrome.storage.local.set({ acd_enabled_sites: enabledSites }, () => {
            updateUIState(true);
            showToast('✓ Dark Mode enabled for ' + currentUrl.hostname);

            // Step 5: Activate immediately in current tab without requiring reload
            chrome.tabs.sendMessage(
              currentTab.id,
              { action: 'toggle', enabled: true, siteKey: currentSiteKey },
              () => {
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
              }
            );
          });
        });
      });
    } else {
      // Disabling flow:
      // 1. Unregister dynamic content script
      if (chrome.scripting && chrome.scripting.unregisterContentScripts) {
        chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});
      }

      // 2. Remove from storage
      chrome.storage.local.get(['acd_enabled_sites'], (result) => {
        const enabledSites = result.acd_enabled_sites || {};
        delete enabledSites[currentSiteKey];

        chrome.storage.local.set({ acd_enabled_sites: enabledSites }, () => {
          updateUIState(false);
          showToast('✓ Dark Mode disabled');

          // 3. Message active tab to disable theme and restore native look immediately
          chrome.tabs.sendMessage(
            currentTab.id,
            { action: 'toggle', enabled: false, siteKey: currentSiteKey },
            () => {
              if (chrome.runtime.lastError) {}
            }
          );
        });
      });
    }
  });

  // Reset button handler
  resetBtnEl.addEventListener('click', () => {
    if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

    const scriptId = getScriptId(currentUrl);

    // 1. Unregister dynamic content script
    if (chrome.scripting && chrome.scripting.unregisterContentScripts) {
      chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});
    }

    // 2. Remove siteKey from storage
    chrome.storage.local.get(['acd_enabled_sites'], (result) => {
      const enabledSites = result.acd_enabled_sites || {};
      delete enabledSites[currentSiteKey];

      chrome.storage.local.set({ acd_enabled_sites: enabledSites }, () => {
        updateUIState(false);
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
