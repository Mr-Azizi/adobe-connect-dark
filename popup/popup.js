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
  const themePresetSelectEl = document.getElementById('theme-preset-select');
  const themePresetContainerEl = document.getElementById('theme-preset-container');
  const themePresetDescEl = document.getElementById('theme-preset-desc');
  const rtlToggleEl = document.getElementById('rtl-toggle');
  const sendRtlToggleEl = document.getElementById('send-rtl-toggle');
  const sendRtlContainerEl = document.getElementById('send-rtl-container');
  const chatTwoRowToggleEl = document.getElementById('chat-two-row-toggle');
  const resetBtnEl = document.getElementById('reset-btn');
  const toastEl = document.getElementById('toast');
  const versionEl = document.getElementById('extension-version');

  const presetRegistry = window.ACDThemePresets || null;
  const DEFAULT_THEME_PRESET = (presetRegistry && presetRegistry.DEFAULT_PRESET_ID) || 'dark';

  function resolvePresetId(presetId) {
    if (presetRegistry && typeof presetRegistry.normalizePresetId === 'function') {
      return presetRegistry.normalizePresetId(presetId);
    }
    const valid = ['dark', 'amoled', 'dim', 'warm'];
    const normalized = typeof presetId === 'string' ? presetId.trim().toLowerCase() : '';
    return valid.includes(normalized) ? normalized : 'dark';
  }

  function isValidPresetId(presetId) {
    if (presetRegistry && typeof presetRegistry.isValidPresetId === 'function') {
      return presetRegistry.isValidPresetId(presetId);
    }
    const valid = ['dark', 'amoled', 'dim', 'warm'];
    const normalized = typeof presetId === 'string' ? presetId.trim().toLowerCase() : '';
    return valid.includes(normalized);
  }

  function getPresetMeta(presetId) {
    const resolved = resolvePresetId(presetId);
    if (presetRegistry && typeof presetRegistry.getPreset === 'function') {
      return presetRegistry.getPreset(resolved);
    }
    const fallbackMap = {
      dark: { id: 'dark', label: 'Dark', description: 'Balanced dark theme' },
      amoled: { id: 'amoled', label: 'AMOLED', description: 'Deep black / OLED' },
      dim: { id: 'dim', label: 'Dim', description: 'Softer dark theme' },
      warm: { id: 'warm', label: 'Warm', description: 'Warmer night theme' }
    };
    return fallbackMap[resolved] || fallbackMap.dark;
  }

  // Dynamically populate select options from central preset registry for extensibility
  if (themePresetSelectEl && presetRegistry && typeof presetRegistry.getAvailablePresets === 'function') {
    const availablePresets = presetRegistry.getAvailablePresets();
    if (Array.isArray(availablePresets) && availablePresets.length > 0) {
      themePresetSelectEl.textContent = '';
      for (const preset of availablePresets) {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.label;
        themePresetSelectEl.appendChild(option);
      }
    }
  }

  // Synchronize version display with manifest.json
  if (versionEl) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest && (manifest.version_name || manifest.version)) {
        versionEl.textContent = `v${manifest.version_name || manifest.version}`;
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

  function updateStatusBadge(isDark, isRtl, isTwoRow) {
    if (isDark || isRtl || isTwoRow) {
      statusBadgeEl.textContent = 'Active';
      statusBadgeEl.className = 'badge badge-active';
    } else {
      statusBadgeEl.textContent = 'Inactive';
      statusBadgeEl.className = 'badge badge-inactive';
    }
  }

  function updateThemePresetUi(isDarkActive, presetId, isUnsupportedPage = false) {
    const resolvedId = resolvePresetId(presetId);
    const meta = getPresetMeta(resolvedId);

    if (themePresetSelectEl) {
      themePresetSelectEl.value = resolvedId;
      themePresetSelectEl.disabled = Boolean(isUnsupportedPage);
    }

    if (themePresetDescEl && meta) {
      themePresetDescEl.textContent = meta.description;
    }

    if (themePresetContainerEl) {
      if (isUnsupportedPage) {
        themePresetContainerEl.classList.add('disabled');
        themePresetContainerEl.classList.remove('dimmed');
      } else if (!isDarkActive) {
        themePresetContainerEl.classList.add('dimmed');
        themePresetContainerEl.classList.remove('disabled');
      } else {
        themePresetContainerEl.classList.remove('dimmed');
        themePresetContainerEl.classList.remove('disabled');
      }
    }
  }

  function updateSendRtlUi(isRtlActive, sendRtlStored) {
    if (!sendRtlToggleEl || !sendRtlContainerEl) return;
    sendRtlToggleEl.checked = Boolean(sendRtlStored);
    if (isRtlActive) {
      sendRtlToggleEl.disabled = false;
      sendRtlContainerEl.classList.remove('disabled');
    } else {
      sendRtlToggleEl.disabled = true;
      sendRtlContainerEl.classList.add('disabled');
    }
  }

  function getIsolatedScriptId(urlObj) {
    const protocolSlug = urlObj.protocol.replace(':', '');
    const hostSlug = urlObj.hostname.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `acd_cs_${protocolSlug}_${hostSlug}`;
  }

  function getMainScriptId(urlObj) {
    const protocolSlug = urlObj.protocol.replace(':', '');
    const hostSlug = urlObj.hostname.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `acd_main_${protocolSlug}_${hostSlug}`;
  }

  const ISOLATED_CONTENT_SCRIPTS = [
    'vendor/darkreader.js',
    'content/darkreader-presets.js',
    'content/darkreader-engine.js',
    'content/theme-engine.js',
    'content/observer.js',
    'content/content.js'
  ];

  function hasUpToDateScriptFiles(registeredScript, expectedFiles) {
    if (!registeredScript || !Array.isArray(registeredScript.js)) return false;
    if (registeredScript.js.length !== expectedFiles.length) return false;
    for (let i = 0; i < expectedFiles.length; i++) {
      if (registeredScript.js[i] !== expectedFiles[i]) return false;
    }
    return true;
  }

  async function ensureRegistration(urlObj, originPattern) {
    if (!chrome.scripting || !chrome.scripting.registerContentScripts) return true;

    const isolatedScriptId = getIsolatedScriptId(urlObj);
    const mainScriptId = getMainScriptId(urlObj);

    try {
      const registered = await chrome.scripting.getRegisteredContentScripts();
      const registeredMap = new Map(registered.map((r) => [r.id, r]));
      const scriptsToRegister = [];
      const outdatedIdsToUnregister = [];

      const existingIsolated = registeredMap.get(isolatedScriptId);
      if (existingIsolated && !hasUpToDateScriptFiles(existingIsolated, ISOLATED_CONTENT_SCRIPTS)) {
        outdatedIdsToUnregister.push(isolatedScriptId);
        registeredMap.delete(isolatedScriptId);
      }

      if (outdatedIdsToUnregister.length > 0 && chrome.scripting.unregisterContentScripts) {
        await chrome.scripting.unregisterContentScripts({ ids: outdatedIdsToUnregister });
      }

      // 1. ISOLATED-world registration for Dark Reader, Theme Presets, Theme Engine, observer, and messaging
      if (!registeredMap.has(isolatedScriptId)) {
        scriptsToRegister.push({
          id: isolatedScriptId,
          matches: [originPattern],
          js: ISOLATED_CONTENT_SCRIPTS,
          runAt: 'document_start',
          allFrames: true,
          world: 'ISOLATED'
        });
      }

      // 2. MAIN-world registration for outgoing Chat RTL bridge
      if (!registeredMap.has(mainScriptId)) {
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
        await chrome.scripting.registerContentScripts(scriptsToRegister);
      }
      return true;
    } catch (err) {
      console.error('[ACD] Dynamic content script registration failed:', err);
      return false;
    }
  }

  async function cleanupRegistrationIfUnneeded(urlObj, keepDark, keepRtl, keepTwoRow) {
    if (keepDark || keepRtl || keepTwoRow) return;
    if (chrome.scripting && chrome.scripting.unregisterContentScripts) {
      const isolatedScriptId = getIsolatedScriptId(urlObj);
      const mainScriptId = getMainScriptId(urlObj);
      try {
        await chrome.scripting.unregisterContentScripts({ ids: [isolatedScriptId, mainScriptId] });
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
          // Inject isolated content scripts
          chrome.scripting.executeScript({
            target: { tabId: currentTab.id, allFrames: true },
            files: ISOLATED_CONTENT_SCRIPTS,
            world: 'ISOLATED'
          }).then(() => {
            chrome.tabs.sendMessage(currentTab.id, messagePayload, () => {
              if (chrome.runtime.lastError) {}
            });
          }).catch((e) => console.warn('[ACD] Injection fallback:', e));

          // Inject MAIN-world bridge explicitly
          chrome.scripting.executeScript({
            target: { tabId: currentTab.id, allFrames: true },
            files: [
              'content/chat-rtl-main.js'
            ],
            world: 'MAIN'
          }).catch((e) => console.warn('[ACD] Main bridge fallback:', e));
        }
      }
    });
  }

  // Query active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      currentDomainEl.textContent = 'No active tab found';
      themeToggleEl.disabled = true;
      updateThemePresetUi(false, DEFAULT_THEME_PRESET, true);
      if (rtlToggleEl) rtlToggleEl.disabled = true;
      if (chatTwoRowToggleEl) chatTwoRowToggleEl.disabled = true;
      updateSendRtlUi(false, true);
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
      updateThemePresetUi(false, DEFAULT_THEME_PRESET, true);
      if (rtlToggleEl) rtlToggleEl.disabled = true;
      if (chatTwoRowToggleEl) chatTwoRowToggleEl.disabled = true;
      updateSendRtlUi(false, true);
      resetBtnEl.disabled = true;
      return;
    }

    // Check for web schemes (http or https)
    if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') {
      currentDomainEl.textContent = 'Browser Internal Page';
      themeToggleEl.disabled = true;
      updateThemePresetUi(false, DEFAULT_THEME_PRESET, true);
      if (rtlToggleEl) rtlToggleEl.disabled = true;
      if (chatTwoRowToggleEl) chatTwoRowToggleEl.disabled = true;
      updateSendRtlUi(false, true);
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
    chrome.storage.local.get([
      'acd_enabled_sites',
      'acd_enabled_domains',
      'acd_theme_preset_sites',
      'themePreset',
      'acd_rtl_chat_sites',
      'acd_send_rtl_formatting_sites',
      'acd_chat_two_row_sites'
    ], (result) => {
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
      const presetSites = result.acd_theme_preset_sites || {};
      const rtlSites = result.acd_rtl_chat_sites || {};
      const sendRtlSites = result.acd_send_rtl_formatting_sites || {};

      // Validate and optionally repair per-site themePreset
      const rawSitePreset = presetSites[currentSiteKey];
      const rawGlobalPreset = result.themePreset;
      const candidatePreset = rawSitePreset !== undefined ? rawSitePreset : rawGlobalPreset;
      const activePreset = resolvePresetId(candidatePreset);

      if (rawSitePreset !== undefined && !isValidPresetId(rawSitePreset)) {
        presetSites[currentSiteKey] = DEFAULT_THEME_PRESET;
        chrome.storage.local.set({ acd_theme_preset_sites: presetSites });
      }

      // Migration: If acd_chat_two_row_sites has never been set, default true for
      // existing sites where Dark Mode OR RTL Chat was active to preserve layout behavior.
      let twoRowSites = result.acd_chat_two_row_sites;
      if (twoRowSites === undefined || twoRowSites === null) {
        twoRowSites = {};
        for (const [site, val] of Object.entries(enabledSites)) {
          if (val) twoRowSites[site] = true;
        }
        for (const [site, val] of Object.entries(rtlSites)) {
          if (val) twoRowSites[site] = true;
        }
        chrome.storage.local.set({ acd_chat_two_row_sites: twoRowSites });
      }

      const isDark = Boolean(enabledSites[currentSiteKey]);
      const isRtl = Boolean(rtlSites[currentSiteKey]);
      const isTwoRow = Boolean(twoRowSites[currentSiteKey]);
      const sendRtlStored = sendRtlSites[currentSiteKey] ?? true;

      themeToggleEl.checked = isDark;
      updateThemePresetUi(isDark, activePreset, false);
      if (rtlToggleEl) rtlToggleEl.checked = isRtl;
      if (chatTwoRowToggleEl) chatTwoRowToggleEl.checked = isTwoRow;
      updateSendRtlUi(isRtl, sendRtlStored);

      updateStatusBadge(isDark, isRtl, isTwoRow);
    });
  });

  // Dark Mode Toggle handler
  themeToggleEl.addEventListener('change', () => {
    if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

    const wantsToEnable = themeToggleEl.checked;
    const selectedPreset = resolvePresetId(themePresetSelectEl ? themePresetSelectEl.value : DEFAULT_THEME_PRESET);
    const isRtlActive = rtlToggleEl ? rtlToggleEl.checked : false;
    const isTwoRowActive = chatTwoRowToggleEl ? chatTwoRowToggleEl.checked : false;

    if (wantsToEnable) {
      chrome.permissions.request({ origins: [currentOriginPattern] }, async (granted) => {
        if (!granted) {
          themeToggleEl.checked = false;
          updateThemePresetUi(false, selectedPreset, false);
          updateStatusBadge(false, isRtlActive, isTwoRowActive);
          showToast('Permission not granted / مجوز داده نشد');
          return;
        }

        const regOk = await ensureRegistration(currentUrl, currentOriginPattern);
        if (!regOk) {
          themeToggleEl.checked = false;
          updateThemePresetUi(false, selectedPreset, false);
          updateStatusBadge(false, isRtlActive, isTwoRowActive);
          showToast('Registration failed / خطا در ثبت اسکریپت');
          return;
        }

        chrome.storage.local.get(['acd_enabled_sites', 'acd_theme_preset_sites'], (result) => {
          const enabledSites = result.acd_enabled_sites || {};
          const presetSites = result.acd_theme_preset_sites || {};
          enabledSites[currentSiteKey] = true;
          presetSites[currentSiteKey] = selectedPreset;

          chrome.storage.local.set({
            acd_enabled_sites: enabledSites,
            acd_theme_preset_sites: presetSites
          }, () => {
            updateThemePresetUi(true, selectedPreset, false);
            updateStatusBadge(true, isRtlActive, isTwoRowActive);
            showToast('✓ Dark Mode (' + getPresetMeta(selectedPreset).label + ') enabled for ' + currentUrl.hostname);
            sendTabMessageWithFallback({
              action: 'toggleDark',
              enabled: true,
              themePreset: selectedPreset,
              siteKey: currentSiteKey
            });
          });
        });
      });
    } else {
      chrome.storage.local.get(['acd_enabled_sites'], async (result) => {
        const enabledSites = result.acd_enabled_sites || {};
        delete enabledSites[currentSiteKey];

        await cleanupRegistrationIfUnneeded(currentUrl, false, isRtlActive, isTwoRowActive);

        chrome.storage.local.set({ acd_enabled_sites: enabledSites }, () => {
          updateThemePresetUi(false, selectedPreset, false);
          updateStatusBadge(false, isRtlActive, isTwoRowActive);
          showToast('✓ Dark Mode disabled');
          sendTabMessageWithFallback({
            action: 'toggleDark',
            enabled: false,
            themePreset: selectedPreset,
            siteKey: currentSiteKey
          });
        });
      });
    }
  });

  // Theme Preset Selector handler
  if (themePresetSelectEl) {
    themePresetSelectEl.addEventListener('change', () => {
      if (!currentSiteKey || !currentTab) return;

      const selectedPreset = resolvePresetId(themePresetSelectEl.value);
      const isDarkActive = themeToggleEl.checked;
      const presetMeta = getPresetMeta(selectedPreset);

      updateThemePresetUi(isDarkActive, selectedPreset, false);

      chrome.storage.local.get(['acd_theme_preset_sites'], (result) => {
        const presetSites = result.acd_theme_preset_sites || {};
        presetSites[currentSiteKey] = selectedPreset;

        chrome.storage.local.set({ acd_theme_preset_sites: presetSites }, () => {
          showToast(
            isDarkActive
              ? `✓ Theme switched to ${presetMeta.label}`
              : `✓ Theme saved (${presetMeta.label})`
          );

          if (isDarkActive) {
            sendTabMessageWithFallback({
              action: 'setThemePreset',
              themePreset: selectedPreset,
              siteKey: currentSiteKey
            });
          } else {
            // When Dark Mode is OFF, only notify existing content script (if any) without injecting or darkening
            chrome.tabs.sendMessage(
              currentTab.id,
              {
                action: 'setThemePreset',
                themePreset: selectedPreset,
                siteKey: currentSiteKey
              },
              () => {
                if (chrome.runtime.lastError) {}
              }
            );
          }
        });
      });
    });
  }

  // RTL Chat Text Toggle handler
  if (rtlToggleEl) {
    rtlToggleEl.addEventListener('change', () => {
      if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

      const wantsToEnable = rtlToggleEl.checked;
      const isDarkActive = themeToggleEl.checked;
      const isTwoRowActive = chatTwoRowToggleEl ? chatTwoRowToggleEl.checked : false;

      if (wantsToEnable) {
        chrome.permissions.request({ origins: [currentOriginPattern] }, async (granted) => {
          if (!granted) {
            rtlToggleEl.checked = false;
            updateStatusBadge(isDarkActive, false, isTwoRowActive);
            updateSendRtlUi(false, sendRtlToggleEl ? sendRtlToggleEl.checked : true);
            showToast('Permission not granted / مجوز داده نشد');
            return;
          }

          const regOk = await ensureRegistration(currentUrl, currentOriginPattern);
          if (!regOk) {
            rtlToggleEl.checked = false;
            updateStatusBadge(isDarkActive, false, isTwoRowActive);
            updateSendRtlUi(false, sendRtlToggleEl ? sendRtlToggleEl.checked : true);
            showToast('Registration failed / خطا در ثبت اسکریپت');
            return;
          }

          chrome.storage.local.get(['acd_rtl_chat_sites', 'acd_send_rtl_formatting_sites'], (result) => {
            const rtlSites = result.acd_rtl_chat_sites || {};
            const sendRtlSites = result.acd_send_rtl_formatting_sites || {};
            const sendRtlStored = sendRtlSites[currentSiteKey] ?? true;

            rtlSites[currentSiteKey] = true;

            chrome.storage.local.set({ acd_rtl_chat_sites: rtlSites }, () => {
              updateStatusBadge(isDarkActive, true, isTwoRowActive);
              updateSendRtlUi(true, sendRtlStored);
              showToast('✓ RTL Chat enabled for ' + currentUrl.hostname);
              sendTabMessageWithFallback({
                action: 'toggleRtl',
                enabled: true,
                sendRtlEnabled: sendRtlStored,
                siteKey: currentSiteKey
              });
            });
          });
        });
      } else {
        chrome.storage.local.get(['acd_rtl_chat_sites', 'acd_send_rtl_formatting_sites'], async (result) => {
          const rtlSites = result.acd_rtl_chat_sites || {};
          const sendRtlSites = result.acd_send_rtl_formatting_sites || {};
          const sendRtlStored = sendRtlSites[currentSiteKey] ?? true;

          delete rtlSites[currentSiteKey];

          await cleanupRegistrationIfUnneeded(currentUrl, isDarkActive, false, isTwoRowActive);

          chrome.storage.local.set({ acd_rtl_chat_sites: rtlSites }, () => {
            updateStatusBadge(isDarkActive, false, isTwoRowActive);
            updateSendRtlUi(false, sendRtlStored);
            showToast('✓ RTL Chat disabled');
            sendTabMessageWithFallback({
              action: 'toggleRtl',
              enabled: false,
              sendRtlEnabled: false,
              siteKey: currentSiteKey
            });
          });
        });
      }
    });
  }

  // Outgoing Send RTL Formatting Toggle handler
  if (sendRtlToggleEl) {
    sendRtlToggleEl.addEventListener('change', () => {
      if (!currentSiteKey || !currentTab || (rtlToggleEl && !rtlToggleEl.checked)) return;

      const wantsToSendRtl = sendRtlToggleEl.checked;
      chrome.storage.local.get(['acd_send_rtl_formatting_sites'], (result) => {
        const sendRtlSites = result.acd_send_rtl_formatting_sites || {};
        sendRtlSites[currentSiteKey] = wantsToSendRtl;

        chrome.storage.local.set({ acd_send_rtl_formatting_sites: sendRtlSites }, () => {
          showToast(wantsToSendRtl ? '✓ Send RTL formatting enabled' : '✓ Send RTL formatting disabled');
          sendTabMessageWithFallback({
            action: 'toggleSendRtlFormatting',
            enabled: wantsToSendRtl,
            siteKey: currentSiteKey
          });
        });
      });
    });
  }

  // Two-Row Chat Layout Toggle handler
  if (chatTwoRowToggleEl) {
    chatTwoRowToggleEl.addEventListener('change', () => {
      if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

      const wantsToEnable = chatTwoRowToggleEl.checked;
      const isDarkActive = themeToggleEl.checked;
      const isRtlActive = rtlToggleEl ? rtlToggleEl.checked : false;

      if (wantsToEnable) {
        chrome.permissions.request({ origins: [currentOriginPattern] }, async (granted) => {
          if (!granted) {
            chatTwoRowToggleEl.checked = false;
            updateStatusBadge(isDarkActive, isRtlActive, false);
            showToast('Permission not granted / مجوز داده نشد');
            return;
          }

          const regOk = await ensureRegistration(currentUrl, currentOriginPattern);
          if (!regOk) {
            chatTwoRowToggleEl.checked = false;
            updateStatusBadge(isDarkActive, isRtlActive, false);
            showToast('Registration failed / خطا در ثبت اسکریپت');
            return;
          }

          chrome.storage.local.get(['acd_chat_two_row_sites'], (result) => {
            const twoRowSites = result.acd_chat_two_row_sites || {};
            twoRowSites[currentSiteKey] = true;

            chrome.storage.local.set({ acd_chat_two_row_sites: twoRowSites }, () => {
              updateStatusBadge(isDarkActive, isRtlActive, true);
              showToast('✓ Two-Row Chat Layout enabled for ' + currentUrl.hostname);
              sendTabMessageWithFallback({
                action: 'toggleChatTwoRow',
                enabled: true,
                siteKey: currentSiteKey
              });
            });
          });
        });
      } else {
        chrome.storage.local.get(['acd_chat_two_row_sites'], async (result) => {
          const twoRowSites = result.acd_chat_two_row_sites || {};
          delete twoRowSites[currentSiteKey];

          await cleanupRegistrationIfUnneeded(currentUrl, isDarkActive, isRtlActive, false);

          chrome.storage.local.set({ acd_chat_two_row_sites: twoRowSites }, () => {
            updateStatusBadge(isDarkActive, isRtlActive, false);
            showToast('✓ Two-Row Chat Layout disabled');
            sendTabMessageWithFallback({
              action: 'toggleChatTwoRow',
              enabled: false,
              siteKey: currentSiteKey
            });
          });
        });
      }
    });
  }

  // Reset button handler
  resetBtnEl.addEventListener('click', () => {
    if (!currentSiteKey || !currentTab || !currentOriginPattern || !currentUrl) return;

    const isolatedScriptId = getIsolatedScriptId(currentUrl);
    const mainScriptId = getMainScriptId(currentUrl);

    // 1. Unregister dynamic content scripts (both ISOLATED and MAIN)
    if (chrome.scripting && chrome.scripting.unregisterContentScripts) {
      chrome.scripting.unregisterContentScripts({ ids: [isolatedScriptId, mainScriptId] }).catch(() => {});
    }

    // 2. Remove siteKey from storage (resets themePreset -> dark along with other site settings)
    chrome.storage.local.get([
      'acd_enabled_sites',
      'acd_theme_preset_sites',
      'acd_rtl_chat_sites',
      'acd_send_rtl_formatting_sites',
      'acd_chat_two_row_sites'
    ], (result) => {
      const enabledSites = result.acd_enabled_sites || {};
      const presetSites = result.acd_theme_preset_sites || {};
      const rtlSites = result.acd_rtl_chat_sites || {};
      const sendRtlSites = result.acd_send_rtl_formatting_sites || {};
      const twoRowSites = result.acd_chat_two_row_sites || {};
      delete enabledSites[currentSiteKey];
      delete presetSites[currentSiteKey];
      delete rtlSites[currentSiteKey];
      delete sendRtlSites[currentSiteKey];
      delete twoRowSites[currentSiteKey];

      chrome.storage.local.set({
        acd_enabled_sites: enabledSites,
        acd_theme_preset_sites: presetSites,
        acd_rtl_chat_sites: rtlSites,
        acd_send_rtl_formatting_sites: sendRtlSites,
        acd_chat_two_row_sites: twoRowSites
      }, () => {
        themeToggleEl.checked = false;
        updateThemePresetUi(false, DEFAULT_THEME_PRESET, false);
        if (rtlToggleEl) rtlToggleEl.checked = false;
        if (chatTwoRowToggleEl) chatTwoRowToggleEl.checked = false;
        updateSendRtlUi(false, true);
        updateStatusBadge(false, false, false);
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
