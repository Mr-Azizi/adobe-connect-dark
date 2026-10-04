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
   * Check if current siteKey is enabled in chrome.storage.local
   */
  function checkSiteState() {
    try {
      chrome.storage.local.get([
        'acd_enabled_sites',
        'acd_enabled_domains',
        'acd_rtl_chat_sites',
        'acd_send_rtl_formatting_sites'
      ], (result) => {
        if (chrome.runtime.lastError) return;

        const enabledSites = result.acd_enabled_sites || {};
        const isDarkEnabled = Boolean(
          enabledSites[currentSiteKey] ||
          (result.acd_enabled_domains && result.acd_enabled_domains[window.location.hostname])
        );

        const rtlSites = result.acd_rtl_chat_sites || {};
        const isRtlEnabled = Boolean(rtlSites[currentSiteKey]);

        const sendRtlSites = result.acd_send_rtl_formatting_sites || {};
        const isSendRtlEnabled = sendRtlSites[currentSiteKey] ?? true;

        // Dark Mode state synchronization
        if (isDarkEnabled) {
          themeEngine.applyDarkTheme();
        } else {
          themeEngine.removeDarkTheme();
        }

        // RTL Chat state synchronization
        if (isRtlEnabled) {
          themeEngine.applyChatRtl(isSendRtlEnabled);
        } else {
          themeEngine.removeChatRtl();
        }
      });
    } catch (e) {
      // Extension context invalidated
    }
  }

  // Initial check at document_start
  checkSiteState();

  // Listen for storage changes across tabs or from popup
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.acd_enabled_sites) {
      const newSites = changes.acd_enabled_sites.newValue || {};
      const shouldBeDark = Boolean(newSites[currentSiteKey]);

      if (shouldBeDark && !themeEngine.isEnabled()) {
        themeEngine.applyDarkTheme();
      } else if (!shouldBeDark && themeEngine.isEnabled()) {
        themeEngine.removeDarkTheme();
      }
    }

    if (changes.acd_rtl_chat_sites || changes.acd_send_rtl_formatting_sites) {
      chrome.storage.local.get(['acd_rtl_chat_sites', 'acd_send_rtl_formatting_sites'], (res) => {
        if (chrome.runtime.lastError) return;
        const rtlSites = res.acd_rtl_chat_sites || {};
        const isRtlEnabled = Boolean(rtlSites[currentSiteKey]);
        const sendRtlSites = res.acd_send_rtl_formatting_sites || {};
        const isSendRtlEnabled = sendRtlSites[currentSiteKey] ?? true;

        if (isRtlEnabled) {
          themeEngine.applyChatRtl(isSendRtlEnabled);
        } else {
          themeEngine.removeChatRtl();
        }
      });
    }
  });

  // Listen for direct messages from the extension popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    switch (request.action) {
      case 'toggle': // Backward-compatible alias for toggleDark
      case 'toggleDark':
        if (request.enabled) {
          themeEngine.applyDarkTheme();
        } else {
          themeEngine.removeDarkTheme();
        }
        sendResponse({
          success: true,
          enabled: themeEngine.isEnabled(),
          darkEnabled: themeEngine.isEnabled(),
          rtlEnabled: themeEngine.isChatRtlEnabled(),
          sendRtlFormattingEnabled: themeEngine.isSendRtlFormattingEnabled(),
          siteKey: currentSiteKey
        });
        break;

      case 'toggleRtl':
        const sendRtlVal = typeof request.sendRtlEnabled === 'boolean'
          ? request.sendRtlEnabled
          : themeEngine.isSendRtlFormattingEnabled();

        if (request.enabled) {
          themeEngine.applyChatRtl(sendRtlVal);
        } else {
          themeEngine.removeChatRtl();
        }
        sendResponse({
          success: true,
          darkEnabled: themeEngine.isEnabled(),
          rtlEnabled: themeEngine.isChatRtlEnabled(),
          sendRtlFormattingEnabled: themeEngine.isSendRtlFormattingEnabled(),
          siteKey: currentSiteKey
        });
        break;

      case 'toggleSendRtlFormatting':
        themeEngine.setSendRtlFormatting(Boolean(request.enabled));
        sendResponse({
          success: true,
          darkEnabled: themeEngine.isEnabled(),
          rtlEnabled: themeEngine.isChatRtlEnabled(),
          sendRtlFormattingEnabled: themeEngine.isSendRtlFormattingEnabled(),
          siteKey: currentSiteKey
        });
        break;

      case 'reset':
        themeEngine.removeDarkTheme();
        themeEngine.removeChatRtl();
        sendResponse({
          success: true,
          enabled: false,
          darkEnabled: false,
          rtlEnabled: false,
          sendRtlFormattingEnabled: true,
          siteKey: currentSiteKey
        });
        break;

      case 'getStatus':
        sendResponse({
          success: true,
          enabled: themeEngine.isEnabled(),
          darkEnabled: themeEngine.isEnabled(),
          rtlEnabled: themeEngine.isChatRtlEnabled(),
          sendRtlFormattingEnabled: themeEngine.isSendRtlFormattingEnabled(),
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
