/**
 * Adobe Connect Dark Mode - Popup Script
 * Manages domain status detection, toggle switches, storage persistence,
 * and real-time tab communication.
 */

document.addEventListener('DOMContentLoaded', () => {
  const currentDomainEl = document.getElementById('current-domain');
  const statusBadgeEl = document.getElementById('status-badge');
  const themeToggleEl = document.getElementById('theme-toggle');
  const resetBtnEl = document.getElementById('reset-btn');
  const toastEl = document.getElementById('toast');

  let currentTab = null;
  let currentDomain = null;
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

  // Toggle handler
  themeToggleEl.addEventListener('change', () => {
    if (!currentDomain || !currentTab) return;

    const isEnabled = themeToggleEl.checked;

    chrome.storage.local.get(['acd_enabled_domains'], (result) => {
      const enabledDomains = result.acd_enabled_domains || {};

      if (isEnabled) {
        enabledDomains[currentDomain] = true;
      } else {
        delete enabledDomains[currentDomain];
      }

      chrome.storage.local.set({ acd_enabled_domains: enabledDomains }, () => {
        updateUIState(isEnabled);
        showToast(isEnabled ? '✓ Dark Mode enabled' : '✓ Dark Mode disabled');

        // Message the active tab content script
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: 'toggle', enabled: isEnabled, domain: currentDomain },
          (response) => {
            if (chrome.runtime.lastError) {
              // Content script might not be injected yet (e.g. opened before extension installed)
              // Execute dynamically as fallback
              if (isEnabled && chrome.scripting) {
                chrome.scripting.executeScript({
                  target: { tabId: currentTab.id },
                  files: [
                    'content/theme-engine.js',
                    'content/observer.js',
                    'content/content.js'
                  ]
                }).catch(() => {});
              }
            }
          }
        );
      });
    });
  });

  // Reset button handler
  resetBtnEl.addEventListener('click', () => {
    if (!currentDomain || !currentTab) return;

    chrome.storage.local.get(['acd_enabled_domains'], (result) => {
      const enabledDomains = result.acd_enabled_domains || {};
      delete enabledDomains[currentDomain];

      chrome.storage.local.set({ acd_enabled_domains: enabledDomains }, () => {
        updateUIState(false);
        showToast('✓ Site settings reset');

        // Message tab to deactivate
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: 'reset', domain: currentDomain },
          () => {
            if (chrome.runtime.lastError) {
              // Tab communication fallback
            }
          }
        );
      });
    });
  });
});
