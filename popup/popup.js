/**
 * Adobe Connect Dark Mode - Popup Script
 * Permission-on-demand architecture:
 * Requests per-origin host permissions, registers dynamic content scripts,
 * and synchronizes state with storage and tabs.
 */

document.addEventListener('DOMContentLoaded', () => {
  const currentDomainEl = document.getElementById('current-domain');
  const statusBadgeEl = document.getElementById('status-badge');
  const themeToggleEl = document.getElementById('theme-toggle');
  const resetBtnEl = document.getElementById('reset-btn');
  const toastEl = document.getElementById('toast');

  let currentTab = null;
  let currentDomain = null;
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

  function getScriptId(domain) {
    return 'acd_cs_' + domain.replace(/[^a-zA-Z0-9_-]/g, '_');
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

    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      currentDomainEl.textContent = 'Invalid URL';
      themeToggleEl.disabled = true;
      resetBtnEl.disabled = true;
      return;
    }

    // Check for web schemes (http or https)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      currentDomainEl.textContent = 'Browser Internal Page';
      themeToggleEl.disabled = true;
      resetBtnEl.disabled = true;
      statusBadgeEl.textContent = 'Unsupported';
      statusBadgeEl.className = 'badge badge-inactive';
      return;
    }

    currentDomain = url.hostname;
    currentOriginPattern = `${url.protocol}//${currentDomain}/*`;
    currentDomainEl.textContent = currentDomain;
    currentDomainEl.title = currentDomain;

    // Load persisted state for this domain
    chrome.storage.local.get(['acd_enabled_domains'], (result) => {
      if (chrome.runtime.lastError) {
        showToast('Error loading settings');
        return;
      }

      const enabledDomains = result.acd_enabled_domains || {};
      const isEnabled = Boolean(enabledDomains[currentDomain]);
      updateUIState(isEnabled);
    });
  });

  // Toggle handler (Permission-on-demand)
  themeToggleEl.addEventListener('change', () => {
    if (!currentDomain || !currentTab || !currentOriginPattern) return;

    const isEnabled = themeToggleEl.checked;
    const scriptId = getScriptId(currentDomain);

    if (isEnabled) {
      // 1. Request permission only for the current origin
      chrome.permissions.request({ origins: [currentOriginPattern] }, async (granted) => {
        if (!granted) {
          // User denied permission prompt
          updateUIState(false);
          showToast('Permission not granted');
          return;
        }

        // 2. Register dynamic content script for this specific origin
        if (chrome.scripting && chrome.scripting.registerContentScripts) {
          try {
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
          } catch (err) {
            console.warn('[ACD] Failed to register content script:', err);
          }
        }

        // 3. Save domain state in chrome.storage.local
        chrome.storage.local.get(['acd_enabled_domains'], (result) => {
          const enabledDomains = result.acd_enabled_domains || {};
          enabledDomains[currentDomain] = true;

          chrome.storage.local.set({ acd_enabled_domains: enabledDomains }, () => {
            updateUIState(true);
            showToast('✓ Dark Mode enabled for ' + currentDomain);

            // 4. Activate in current active tab immediately without requiring refresh
            chrome.tabs.sendMessage(
              currentTab.id,
              { action: 'toggle', enabled: true, domain: currentDomain },
              () => {
                if (chrome.runtime.lastError) {
                  // If content script was not already present in the tab, inject directly
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
      // Disabling:
      // 1. Unregister dynamic content script
      if (chrome.scripting && chrome.scripting.unregisterContentScripts) {
        chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});
      }

      // 2. Remove domain from storage
      chrome.storage.local.get(['acd_enabled_domains'], (result) => {
        const enabledDomains = result.acd_enabled_domains || {};
        delete enabledDomains[currentDomain];

        chrome.storage.local.set({ acd_enabled_domains: enabledDomains }, () => {
          updateUIState(false);
          showToast('✓ Dark Mode disabled');

          // 3. Message active tab to disable theme and restore native look immediately
          chrome.tabs.sendMessage(
            currentTab.id,
            { action: 'toggle', enabled: false, domain: currentDomain },
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
    if (!currentDomain || !currentTab || !currentOriginPattern) return;

    const scriptId = getScriptId(currentDomain);

    // 1. Unregister dynamic content script
    if (chrome.scripting && chrome.scripting.unregisterContentScripts) {
      chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});
    }

    // 2. Remove domain from storage
    chrome.storage.local.get(['acd_enabled_domains'], (result) => {
      const enabledDomains = result.acd_enabled_domains || {};
      delete enabledDomains[currentDomain];

      chrome.storage.local.set({ acd_enabled_domains: enabledDomains }, () => {
        updateUIState(false);
        showToast('✓ Site settings reset');

        // 3. Message tab to reset
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: 'reset', domain: currentDomain },
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
