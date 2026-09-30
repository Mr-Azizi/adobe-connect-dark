/**
 * Adobe Connect Dark Mode - Content Script Entry Point
 * Orchestrates siteKey permission checks, storage persistence, and message handling.
 */

(function () {
  'use strict';

  // Prevent multiple initializations in the same frame
  if (window.__ACD_CONTENT_SCRIPT_INITIALIZED__) return;
  window.__ACD_CONTENT_SCRIPT_INITIALIZED__ = true;

  const currentSiteKey = `${window.location.protocol}//${window.location.hostname}`;
  const themeEngine = window.__ACD_THEME_ENGINE__;
  const observer = window.__ACD_OBSERVER__;

  if (!themeEngine || !observer) {
    console.warn('[ACD] Theme engine or observer not found.');
    return;
  }

  /**
   * Check if the current siteKey is enabled in chrome.storage.local
   */
  function checkSiteState() {
    try {
      chrome.storage.local.get(['acd_enabled_sites', 'acd_enabled_domains'], (result) => {
        if (chrome.runtime.lastError) return;

        const enabledSites = result.acd_enabled_sites || {};
        const isEnabled = Boolean(
          enabledSites[currentSiteKey] ||
          (result.acd_enabled_domains && result.acd_enabled_domains[window.location.hostname])
        );

        if (isEnabled) {
          activate();
        } else {
          deactivate();
        }
      });
    } catch (e) {
      // Extension context invalidated
    }
  }

  /**
   * Activate dark mode
   */
  function activate() {
    themeEngine.enable();
    observer.start();
  }

  /**
   * Deactivate dark mode
   */
  function deactivate() {
    themeEngine.disable();
    observer.stop();
  }

  // Initial check at document_start
  checkSiteState();

  // Listen for storage changes across tabs or from popup
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.acd_enabled_sites) {
      const newSites = changes.acd_enabled_sites.newValue || {};
      const shouldBeEnabled = Boolean(newSites[currentSiteKey]);

      if (shouldBeEnabled && !themeEngine.isEnabled()) {
        activate();
      } else if (!shouldBeEnabled && themeEngine.isEnabled()) {
        deactivate();
      }
    }
  });

  // Listen for direct messages from the extension popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    switch (request.action) {
      case 'toggle':
        if (request.enabled) {
          activate();
        } else {
          deactivate();
        }
        sendResponse({ success: true, enabled: themeEngine.isEnabled(), siteKey: currentSiteKey });
        break;

      case 'reset':
        deactivate();
        sendResponse({ success: true, enabled: false, siteKey: currentSiteKey });
        break;

      case 'getStatus':
        sendResponse({
          success: true,
          enabled: themeEngine.isEnabled(),
          siteKey: currentSiteKey
        });
        break;

      case 'ping':
        sendResponse({ pong: true, siteKey: currentSiteKey });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }

    return true; // Keep message channel open for async response
  });
})();
