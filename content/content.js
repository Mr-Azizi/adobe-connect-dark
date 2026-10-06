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

  function isValidThemePreset(presetId) {
    if (window.ACDThemePresets && typeof window.ACDThemePresets.isValidPresetId === 'function') {
      return window.ACDThemePresets.isValidPresetId(presetId);
    }
    return presetId === 'dark' || presetId === 'amoled' || presetId === 'dim' || presetId === 'warm';
  }

  function resolveThemePreset(rawPreset) {
    if (typeof themeEngine.normalizeThemePreset === 'function') {
      return themeEngine.normalizeThemePreset(rawPreset);
    }
    return isValidThemePreset(rawPreset) ? rawPreset : 'dark';
  }

  function buildStatusResponse(extra = {}) {
    const activeDarkEngine = typeof themeEngine.getDarkEngine === 'function'
      ? themeEngine.getDarkEngine()
      : 'legacy';
    const currentPreset = typeof themeEngine.getThemePreset === 'function'
      ? themeEngine.getThemePreset()
      : 'dark';

    return {
      success: true,
      enabled: themeEngine.isEnabled(),
      darkEnabled: themeEngine.isEnabled(),
      darkEngine: activeDarkEngine,
      themePreset: currentPreset,
      rtlEnabled: themeEngine.isChatRtlEnabled(),
      sendRtlFormattingEnabled: themeEngine.isSendRtlFormattingEnabled(),
      chatTwoRowEnabled: themeEngine.isChatTwoRowEnabled(),
      siteKey: currentSiteKey,
      ...extra
    };
  }

  /**
   * Check if current siteKey is enabled in chrome.storage.local
   */
  function checkSiteState() {
    try {
      chrome.storage.local.get([
        'acd_enabled_sites',
        'acd_enabled_domains',
        'acd_theme_preset_sites',
        'themePreset',
        'acd_rtl_chat_sites',
        'acd_send_rtl_formatting_sites',
        'acd_chat_two_row_sites'
      ], (result) => {
        if (chrome.runtime.lastError) return;

        const enabledSites = result.acd_enabled_sites || {};
        const isDarkEnabled = Boolean(
          enabledSites[currentSiteKey] ||
          (result.acd_enabled_domains && result.acd_enabled_domains[window.location.hostname])
        );

        const presetSites = result.acd_theme_preset_sites || {};
        const rawSitePreset = presetSites[currentSiteKey];
        const rawPreset = rawSitePreset !== undefined ? rawSitePreset : result.themePreset;
        const resolvedPreset = resolveThemePreset(rawPreset);

        // Repair invalid stored preset safely to 'dark'
        if (rawSitePreset !== undefined && !isValidThemePreset(rawSitePreset)) {
          const repairedSites = { ...presetSites, [currentSiteKey]: 'dark' };
          chrome.storage.local.set({ acd_theme_preset_sites: repairedSites });
        } else if (rawSitePreset === undefined && result.themePreset !== undefined && !isValidThemePreset(result.themePreset)) {
          chrome.storage.local.set({ themePreset: 'dark' });
        }

        const rtlSites = result.acd_rtl_chat_sites || {};
        const isRtlEnabled = Boolean(rtlSites[currentSiteKey]);

        const sendRtlSites = result.acd_send_rtl_formatting_sites || {};
        const isSendRtlEnabled = sendRtlSites[currentSiteKey] ?? true;

        let twoRowSites = result.acd_chat_two_row_sites;
        let isTwoRowEnabled = false;
        if (twoRowSites === undefined || twoRowSites === null) {
          // Migration: default true for sites that already had dark or RTL enabled
          isTwoRowEnabled = isDarkEnabled || isRtlEnabled;
        } else {
          isTwoRowEnabled = Boolean(twoRowSites[currentSiteKey]);
        }

        // Theme Preset synchronization (stores preset even when Dark Mode is OFF)
        if (typeof themeEngine.setThemePreset === 'function') {
          themeEngine.setThemePreset(resolvedPreset);
        }

        // Dark Mode state synchronization
        if (isDarkEnabled) {
          themeEngine.applyDarkTheme(resolvedPreset);
        } else {
          themeEngine.removeDarkTheme();
        }

        // RTL Chat state synchronization
        if (isRtlEnabled) {
          themeEngine.applyChatRtl(isSendRtlEnabled);
        } else {
          themeEngine.removeChatRtl();
        }

        // Two-Row Chat Layout state synchronization
        if (isTwoRowEnabled) {
          themeEngine.applyChatTwoRow();
        } else {
          themeEngine.removeChatTwoRow();
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

    if (changes.acd_theme_preset_sites || changes.themePreset) {
      let rawPreset;
      if (changes.acd_theme_preset_sites) {
        const newPresetSites = changes.acd_theme_preset_sites.newValue || {};
        rawPreset = newPresetSites[currentSiteKey];
        if (rawPreset !== undefined && !isValidThemePreset(rawPreset)) {
          chrome.storage.local.set({
            acd_theme_preset_sites: { ...newPresetSites, [currentSiteKey]: 'dark' }
          });
        }
      } else if (changes.themePreset) {
        rawPreset = changes.themePreset.newValue;
        if (rawPreset !== undefined && !isValidThemePreset(rawPreset)) {
          chrome.storage.local.set({ themePreset: 'dark' });
        }
      }

      const resolvedPreset = resolveThemePreset(rawPreset);
      if (typeof themeEngine.setThemePreset === 'function') {
        themeEngine.setThemePreset(resolvedPreset);
      }
    }

    if (changes.acd_enabled_sites) {
      const newSites = changes.acd_enabled_sites.newValue || {};
      const shouldBeDark = Boolean(newSites[currentSiteKey]);

      if (shouldBeDark && !themeEngine.isEnabled()) {
        const currentPreset = typeof themeEngine.getThemePreset === 'function'
          ? themeEngine.getThemePreset()
          : 'dark';
        themeEngine.applyDarkTheme(currentPreset);
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

    if (changes.acd_chat_two_row_sites) {
      const newSites = changes.acd_chat_two_row_sites.newValue || {};
      const shouldBeTwoRow = Boolean(newSites[currentSiteKey]);

      if (shouldBeTwoRow && !themeEngine.isChatTwoRowEnabled()) {
        themeEngine.applyChatTwoRow();
      } else if (!shouldBeTwoRow && themeEngine.isChatTwoRowEnabled()) {
        themeEngine.removeChatTwoRow();
      }
    }
  });

  // Listen for direct messages from the extension popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    switch (request.action) {
      case 'toggle': // Backward-compatible alias for toggleDark
      case 'toggleDark': {
        if (request.themePreset !== undefined && typeof themeEngine.setThemePreset === 'function') {
          themeEngine.setThemePreset(request.themePreset);
        }
        if (request.enabled) {
          const presetToApply = request.themePreset !== undefined
            ? resolveThemePreset(request.themePreset)
            : (typeof themeEngine.getThemePreset === 'function' ? themeEngine.getThemePreset() : 'dark');
          themeEngine.applyDarkTheme(presetToApply);
        } else {
          themeEngine.removeDarkTheme();
        }
        sendResponse(buildStatusResponse());
        break;
      }

      case 'setThemePreset':
      case 'changeThemePreset': {
        const rawPreset = request.themePreset !== undefined ? request.themePreset : request.preset;
        const resolvedPreset = typeof themeEngine.setThemePreset === 'function'
          ? themeEngine.setThemePreset(rawPreset)
          : resolveThemePreset(rawPreset);
        sendResponse(buildStatusResponse({ themePreset: resolvedPreset }));
        break;
      }

      case 'toggleRtl': {
        const sendRtlVal = typeof request.sendRtlEnabled === 'boolean'
          ? request.sendRtlEnabled
          : themeEngine.isSendRtlFormattingEnabled();

        if (request.enabled) {
          themeEngine.applyChatRtl(sendRtlVal);
        } else {
          themeEngine.removeChatRtl();
        }
        sendResponse(buildStatusResponse());
        break;
      }

      case 'toggleSendRtlFormatting':
        themeEngine.setSendRtlFormatting(Boolean(request.enabled));
        sendResponse(buildStatusResponse());
        break;

      case 'toggleChatTwoRow':
        if (request.enabled) {
          themeEngine.applyChatTwoRow();
        } else {
          themeEngine.removeChatTwoRow();
        }
        sendResponse(buildStatusResponse());
        break;

      case 'reset':
        if (typeof themeEngine.setThemePreset === 'function') {
          themeEngine.setThemePreset('dark');
        }
        themeEngine.removeDarkTheme();
        themeEngine.removeChatRtl();
        themeEngine.removeChatTwoRow();
        sendResponse(buildStatusResponse({
          enabled: false,
          darkEnabled: false,
          themePreset: 'dark',
          rtlEnabled: false,
          sendRtlFormattingEnabled: true,
          chatTwoRowEnabled: false
        }));
        break;

      case 'getStatus':
        sendResponse(buildStatusResponse());
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
