/**
 * Adobe Connect Dark Mode - Theme Engine
 * Consolidated, idempotent activation path (applyDarkTheme/removeDarkTheme)
 * with zero-timing-gap observer startup, full subtree candidate traversal,
 * guaranteed initial DOM scanning, and Open Shadow DOM per-root MutationObservers.
 */

(function () {
  'use strict';

  // Prevent multiple definitions
  if (window.__ACD_THEME_ENGINE__) return;

  const DARK_ENGINE = window.__ACD_DARK_ENGINE__ || 'darkreader'; // 'darkreader' | 'legacy'

  const FUNCTIONAL_STYLESHEET_PATHS = [
    'styles/chat-functional.css'
  ];

  const CHAT_COLOR_STYLESHEET_PATHS = [
    'styles/chat-colors.css'
  ];

  // Isolated fallback stylesheets injected ONLY when darkEngine === 'legacy'
  const LEGACY_DARK_STYLESHEET_PATHS = [
    'styles/variables.css',
    'styles/base.css',
    'styles/adobe-connect.css',
    'styles/components.css',
    'styles/connect-central.css'
  ];

  const SHADOW_STYLESHEET_PATH = 'styles/shadow-dom.css';
  const SHADOW_FUNCTIONAL_STYLESHEET_PATH = 'styles/chat-functional.css';
  const SHADOW_CHAT_COLOR_STYLESHEET_PATH = 'styles/chat-colors.css';

  const CHAT_LAYOUT_STYLE_ID = 'acd-chat-layout-style';
  const CHAT_LAYOUT_CSS = `
html[data-acd-chat-two-row="true"] [class^="chatIndividualMessageContentWrapperDiv--"],
html[data-acd-chat-two-row="true"] [class*=" chatIndividualMessageContentWrapperDiv--"],
html[data-acd-chat-two-row="true"] [data-acd-chat-two-line="true"],
html[data-acd-chat-two-row="true"] [class*="chatContentArea"] .chat-message,
html[data-acd-chat-two-row="true"] [class*="chatContentArea"] .message-item,
:host-context([data-acd-chat-two-row="true"]) [class^="chatIndividualMessageContentWrapperDiv--"],
:host-context([data-acd-chat-two-row="true"]) [class*=" chatIndividualMessageContentWrapperDiv--"],
:host-context([data-acd-chat-two-row="true"]) [data-acd-chat-two-line="true"],
:host-context([data-acd-chat-two-row="true"]) [class*="chatContentArea"] .chat-message,
:host-context([data-acd-chat-two-row="true"]) [class*="chatContentArea"] .message-item,
[data-acd-chat-two-row="true"] [class^="chatIndividualMessageContentWrapperDiv--"],
[data-acd-chat-two-row="true"] [class*=" chatIndividualMessageContentWrapperDiv--"] {
  display: inline-grid !important;
  grid-template-columns: minmax(0, 1fr) auto !important;
  grid-template-rows: auto auto !important;
  column-gap: 6px !important;
  row-gap: 2px !important;
  align-items: baseline !important;
  box-sizing: border-box !important;
}

html[data-acd-chat-two-row="true"] [class^="chatMessageSender--"],
html[data-acd-chat-two-row="true"] [class*=" chatMessageSender--"],
html[data-acd-chat-two-row="true"] .chat-user-name,
html[data-acd-chat-two-row="true"] .sender-name,
html[data-acd-chat-two-row="true"] [class*="chat-sender"],
:host-context([data-acd-chat-two-row="true"]) [class^="chatMessageSender--"],
:host-context([data-acd-chat-two-row="true"]) [class*=" chatMessageSender--"],
:host-context([data-acd-chat-two-row="true"]) .chat-user-name,
:host-context([data-acd-chat-two-row="true"]) .sender-name,
:host-context([data-acd-chat-two-row="true"]) [class*="chat-sender"],
[data-acd-chat-two-row="true"] [class^="chatMessageSender--"],
[data-acd-chat-two-row="true"] [class*=" chatMessageSender--"] {
  grid-column: 1 !important;
  grid-row: 1 !important;
  display: block !important;
  font-weight: 600 !important;
  line-height: 1.25 !important;
  margin: 0 !important;
  padding: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

html[data-acd-chat-two-row="true"] [class^="chatMessageTime--"],
html[data-acd-chat-two-row="true"] [class*=" chatMessageTime--"],
html[data-acd-chat-two-row="true"] .chat-time,
html[data-acd-chat-two-row="true"] .message-time,
html[data-acd-chat-two-row="true"] [class*="chat-time"],
:host-context([data-acd-chat-two-row="true"]) [class^="chatMessageTime--"],
:host-context([data-acd-chat-two-row="true"]) [class*=" chatMessageTime--"],
:host-context([data-acd-chat-two-row="true"]) .chat-time,
:host-context([data-acd-chat-two-row="true"]) .message-time,
:host-context([data-acd-chat-two-row="true"]) [class*="chat-time"],
[data-acd-chat-two-row="true"] [class^="chatMessageTime--"],
[data-acd-chat-two-row="true"] [class*=" chatMessageTime--"] {
  grid-column: 2 !important;
  grid-row: 1 !important;
  display: inline-block !important;
  float: none !important;
  justify-self: end !important;
  align-self: baseline !important;
  line-height: 1.25 !important;
  white-space: nowrap !important;
  margin: 0 !important;
  padding: 0 !important;
}

html[data-acd-chat-two-row="true"] [class^="chatIndividualMessageContent--"],
html[data-acd-chat-two-row="true"] [class*=" chatIndividualMessageContent--"],
html[data-acd-chat-two-row="true"] .chat-message-text,
html[data-acd-chat-two-row="true"] [class*="chat-message-content"],
:host-context([data-acd-chat-two-row="true"]) [class^="chatIndividualMessageContent--"],
:host-context([data-acd-chat-two-row="true"]) [class*=" chatIndividualMessageContent--"],
:host-context([data-acd-chat-two-row="true"]) .chat-message-text,
:host-context([data-acd-chat-two-row="true"]) [class*="chat-message-content"],
[data-acd-chat-two-row="true"] [class^="chatIndividualMessageContent--"],
[data-acd-chat-two-row="true"] [class*=" chatIndividualMessageContent--"] {
  grid-column: 1 / -1 !important;
  grid-row: 2 !important;
  display: block !important;
  width: 100% !important;
  box-sizing: border-box !important;
  line-height: 1.35 !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  white-space: pre-wrap !important;
  margin: 0 !important;
}
`;

  // Tags that MUST NEVER be altered or darkened (Media & embeds)
  const SENSITIVE_TAGS = new Set([
    'VIDEO',
    'CANVAS',
    'IMG',
    'PICTURE',
    'AUDIO',
    'EMBED',
    'OBJECT',
    'IFRAME'
  ]);

  // Selectors for containers whose contents must remain untouched
  const SENSITIVE_CONTAINER_SELECTORS = [
    'video',
    'canvas',
    'img',
    'picture',
    '.presentation-canvas',
    '.whiteboard-canvas',
    '.shared-content-viewport',
    '.video-stream-element',
    '.presentation-content',
    '.slide-container',
    '[data-ac-role="presentation"]',
    '[data-ac-role="whiteboard"]',
    '[data-ac-role="screenshare"]',

    // Adobe Connect Share Pod content stages. These containers host PDF,
    // PowerPoint/image/captivate content and screen-share video/canvases.
    // Dark mode must theme the surrounding pod chrome, never the shared
    // content subtree itself.
    '[class^="shareContent--"]',
    '[class*=" shareContent--"]',
    '[class^="pdfLoaderScreen--"]',
    '[class*=" pdfLoaderScreen--"]',
    '[class^="pptLoaderScreen--"]',
    '[class*=" pptLoaderScreen--"]',
    '[class^="imageLoaderScreen--"]',
    '[class*=" imageLoaderScreen--"]',
    '[class^="cptLoaderScreen--"]',
    '[class*=" cptLoaderScreen--"]',
    '[class^="screenShareLoader--"]',
    '[class*=" screenShareLoader--"]',
    '[class^="streamPlayerLoaderScreen--"]',
    '[class*=" streamPlayerLoaderScreen--"]',
    '#pdf-viewer',
    '.canvasHTMLPDF',
    '.canvasSingleHTMLPDF',
    '[class*="shareContent--"] canvas',
    '[class*="whiteboardWrapper--"]',
    '[class*="wbShapesWrapper--"]',
    '[class*="chatIndividualMessageContentWrapperDiv"]',
    '[class*="chatMenuItemColorCode"]',
    '[class*="colorSwatch"]',
    '[data-acd-preserve="true"]',
    '.acd-preserve'
  ].join(', ');

  const CANDIDATE_DESCENDANT_SELECTORS = [
    'div', 'section', 'aside', 'header', 'nav', 'main', 'article', 'footer',
    '[role="region"]', '[role="dialog"]', '[role="menu"]', '[role="listbox"]', '[role="tabpanel"]',
    '[class*="pod"]', '[class*="container"]', '[class*="panel"]', '[class*="content"]',
    '[class*="header"]', '[class*="item"]', '[class*="message"]', '[class*="attendee"]',
    '[class*="spectrum-"]'
  ].join(', ');

  class ACDThemeEngine {
    constructor() {
      this.darkEngine = window.__ACD_DARK_ENGINE__ || DARK_ENGINE;
      this.darkReaderEngine = window.__ACD_DARKREADER_ENGINE__ || null;
      this.enabled = false;
      this.themePreset = this.normalizeThemePreset(
        (this.darkReaderEngine && typeof this.darkReaderEngine.getPreset === 'function')
          ? this.darkReaderEngine.getPreset()
          : (window.__ACD_INITIAL_THEME_PRESET__ || 'dark')
      );
      this.chatRtlEnabled = false;
      this.sendRtlFormattingEnabled = true;
      this.chatTwoRowEnabled = false;
      this.observer = null; // Associated ACDObserver
      this.injectedElements = new Set();
      this.injectedLegacyDarkElements = new Set();
      this.injectedChatColorElements = new Set();
      this.attachedShadowRoots = new Set();
      this.shadowObservers = new Map(); // Map<ShadowRoot, MutationObserver>
      this.hasScannedInitialDOM = false;
      this.processQueue = [];
      this.isProcessingQueue = false;
      this.updateDebugState();
    }

    /**
     * Normalize any preset identifier safely to a registered preset ID ('dark' fallback)
     */
    normalizeThemePreset(presetId) {
      if (window.ACDThemePresets && typeof window.ACDThemePresets.normalizePresetId === 'function') {
        return window.ACDThemePresets.normalizePresetId(presetId);
      }
      const drEngine = this.darkReaderEngine || window.__ACD_DARKREADER_ENGINE__;
      if (drEngine && typeof drEngine.normalizePresetId === 'function') {
        return drEngine.normalizePresetId(presetId);
      }
      return 'dark';
    }

    /**
     * Return current theme preset ID ('dark' | 'amoled' | 'dim' | 'warm')
     */
    getThemePreset() {
      const drEngine = this.darkReaderEngine || window.__ACD_DARKREADER_ENGINE__;
      if (drEngine && typeof drEngine.getPreset === 'function') {
        this.themePreset = drEngine.getPreset();
      }
      return this.themePreset || 'dark';
    }

    /**
     * Return available theme presets from the central preset registry
     */
    getAvailablePresets() {
      if (window.ACDThemePresets && typeof window.ACDThemePresets.getAvailablePresets === 'function') {
        return window.ACDThemePresets.getAvailablePresets();
      }
      const drEngine = this.darkReaderEngine || window.__ACD_DARKREADER_ENGINE__;
      if (drEngine && typeof drEngine.getAvailablePresets === 'function') {
        return drEngine.getAvailablePresets();
      }
      return [];
    }

    /**
     * Update the selected theme preset.
     * - When Dark Mode is ON, immediately updates Dark Reader live without reload.
     * - When Dark Mode is OFF, stores the preset preference without darkening the page.
     */
    setThemePreset(presetId) {
      const resolvedPreset = this.normalizeThemePreset(presetId);
      this.themePreset = resolvedPreset;

      const drEngine = this.darkReaderEngine || window.__ACD_DARKREADER_ENGINE__;
      if (drEngine && typeof drEngine.setPreset === 'function') {
        drEngine.setPreset(resolvedPreset);
      }

      const root = document.documentElement;
      if (this.enabled && this.isDarkReaderEngine() && root) {
        root.setAttribute('data-acd-theme-preset', resolvedPreset);
      }

      this.updateDebugState();
      return resolvedPreset;
    }

    /**
     * Synchronize window.__ACD_DEBUG__ state
     */
    updateDebugState() {
      const drEngine = this.darkReaderEngine || window.__ACD_DARKREADER_ENGINE__;
      const darkReaderEnabled = Boolean(
        this.enabled &&
        this.isDarkReaderEngine() &&
        drEngine &&
        typeof drEngine.isEnabled === 'function' &&
        drEngine.isEnabled()
      );

      window.__ACD_DEBUG__ = {
        darkEngine: this.getDarkEngine(),
        themeEnabled: Boolean(this.enabled),
        themePreset: this.getThemePreset(),
        darkReaderEnabled
      };
    }

    /**
     * Return active dark engine identifier ('darkreader' | 'legacy')
     */
    getDarkEngine() {
      return window.__ACD_DARK_ENGINE__ || this.darkEngine || DARK_ENGINE;
    }

    /**
     * Check whether Dark Reader engine mode is selected
     */
    isDarkReaderEngine() {
      return this.getDarkEngine() === 'darkreader';
    }

    /**
     * Check whether legacy custom dark engine mode is selected
     */
    isLegacyDarkEngine() {
      return this.getDarkEngine() === 'legacy';
    }

    /**
     * Check whether legacy generic visual engine work should execute
     */
    shouldRunLegacyVisualEngine() {
      return Boolean(this.enabled && this.isLegacyDarkEngine());
    }

    /**
     * Separate capability gate for semantic Adobe Chat Color classification.
     * Returns true when Dark Mode is enabled (for BOTH 'darkreader' and 'legacy')
     * and, if a specific root element is passed, when Adobe Connect chat is present.
     */
    shouldRunChatColorMapping(root) {
      if (!this.enabled) return false;
      if (!this.isDarkReaderEngine() && !this.isLegacyDarkEngine()) return false;
      if (root && root.nodeType === Node.ELEMENT_NODE) {
        if (
          typeof root.className === 'string' &&
          root.className.indexOf('chatIndividualMessageContentWrapperDiv--') !== -1
        ) {
          return true;
        }
        if (root.querySelector) {
          return Boolean(
            root.querySelector(
              '[class^="chatIndividualMessageContentWrapperDiv--"], [class*=" chatIndividualMessageContentWrapperDiv--"], #chatPod, [class^="chatPod--"], [class*=" chatPod--"], [class^="chatContentArea--"], [class*=" chatContentArea--"]'
            )
          );
        }
      }
      return true;
    }

    /**
     * Check whether any extension feature (Dark Mode, RTL Chat, or Two-Row Layout) is active
     */
    hasAnyActiveFeature() {
      return Boolean(this.enabled || this.chatRtlEnabled || this.chatTwoRowEnabled);
    }

    /**
     * Ensure Chat Two-Row presentation layout stylesheet is injected
     */
    ensureChatLayoutStyle(target) {
      if (!this.chatTwoRowEnabled || !target) return;
      const container = target === document
        ? (document.head || document.documentElement)
        : target;
      if (!container || !container.querySelector) return;
      if (!container.querySelector(`#${CHAT_LAYOUT_STYLE_ID}`)) {
        const style = document.createElement('style');
        style.id = CHAT_LAYOUT_STYLE_ID;
        style.textContent = CHAT_LAYOUT_CSS;
        style.setAttribute('data-acd-layout-injected', 'true');
        container.appendChild(style);
      }
    }

    /**
     * Remove Chat Two-Row presentation layout stylesheet
     */
    removeChatLayoutStyle(target) {
      if (!target) return;
      const container = target === document
        ? (document.head || document.documentElement)
        : target;
      if (!container || !container.querySelector) return;
      const existing = container.querySelector(`#${CHAT_LAYOUT_STYLE_ID}`);
      if (existing) {
        if (typeof existing.remove === 'function') {
          existing.remove();
        } else if (existing.parentNode) {
          existing.parentNode.removeChild(existing);
        }
      }
    }

    /**
     * Check if Two-Row chat layout is currently enabled
     */
    isChatTwoRowEnabled() {
      return this.chatTwoRowEnabled;
    }

    /**
     * Attach ACDObserver instance
     */
    setObserver(observer) {
      this.observer = observer;
      if (this.hasAnyActiveFeature() && !observer.isObserving) {
        observer.start();
      }
    }

    /**
     * Check if theme is currently active
     */
    isEnabled() {
      return this.enabled;
    }

    /**
     * Check if RTL chat is currently active
     */
    isChatRtlEnabled() {
      return this.chatRtlEnabled;
    }

    /**
     * Check if Send RTL formatting is currently enabled
     */
    isSendRtlFormattingEnabled() {
      return this.sendRtlFormattingEnabled;
    }

    /**
     * CONSOLIDATED IDEMPOTENT ACTIVATION PATH
     * Executed identically by automatic page load and manual popup toggle.
     */
    applyDarkTheme(presetId) {
      const wasAlreadyEnabled = this.enabled;
      this.enabled = true;
      if (presetId !== undefined) {
        this.themePreset = this.normalizeThemePreset(presetId);
      }

      if (this.isDarkReaderEngine()) {
        // Dark Reader mode:
        // 1. Ensure legacy root attribute and legacy dark stylesheets are not active
        const root = document.documentElement;
        if (root) {
          if (root.hasAttribute('data-acd-theme')) {
            root.removeAttribute('data-acd-theme');
          }
          root.setAttribute('data-acd-theme-preset', this.themePreset);
        }
        this.cleanupLegacyDarkStylesheets();

        // 2. Inject functional stylesheets (Vazirmatn font, RTL Chat, BiDi, Two-Row) + chat-colors.css
        this.injectStylesheets(document);

        // 3. Keep ACDObserver active for chat color classification and functional Shadow DOM discovery
        if (this.observer && !this.observer.isObserving) {
          this.observer.start();
        }

        // 4. Enable Dark Reader engine with the selected preset (no legacy luminance scanning)
        const drEngine = this.darkReaderEngine || window.__ACD_DARKREADER_ENGINE__;
        if (drEngine && typeof drEngine.enable === 'function') {
          drEngine.enable(this.themePreset);
        } else if (typeof window.DarkReader !== 'undefined' && typeof window.DarkReader.enable === 'function') {
          window.DarkReader.enable({ brightness: 100, contrast: 96, sepia: 0 });
        }

        // 5. Classify existing chat bubbles for semantic Chat Color preservation (without legacy luminance scanning)
        this.scheduleChatColorScan();

        // 6. Ensure functional Shadow DOM discovery for RTL / Two-Row / Chat Colors
        this.scheduleFunctionalShadowDiscovery();

        this.updateDebugState();
        return;
      }

      // Legacy Dark Engine mode (identical to v1.8.5):
      const drEngine = this.darkReaderEngine || window.__ACD_DARKREADER_ENGINE__;
      if (drEngine && typeof drEngine.isEnabled === 'function' && drEngine.isEnabled()) {
        drEngine.disable();
      }

      // 1. Set root attribute immediately on documentElement to prevent white flash
      this.applyRootAttribute();

      // 2. Inject core stylesheets
      this.injectStylesheets(document);

      // 3. Start MutationObserver BEFORE initial scan to eliminate timing gap
      if (this.observer && !this.observer.isObserving) {
        this.observer.start();
      }

      // 4. Schedule or perform guaranteed initial DOM scan
      if (wasAlreadyEnabled) {
        this.performInitialScan(true); // refresh scan
      } else {
        this.scheduleInitialScan();
      }

      this.updateDebugState();
    }

    /**
     * Backward-compatible alias for applyDarkTheme
     */
    enable(presetId) {
      this.applyDarkTheme(presetId);
    }

    /**
     * CONSOLIDATED DEACTIVATION PATH
     * Cleanly restores native appearance and disconnects observers if no functional feature remains active.
     */
    removeDarkTheme() {
      if (!this.enabled) {
        this.updateDebugState();
        return;
      }
      this.enabled = false;
      this.hasScannedInitialDOM = false;

      // 1. Disable Dark Reader engine if active
      const drEngine = this.darkReaderEngine || window.__ACD_DARKREADER_ENGINE__;
      if (drEngine && typeof drEngine.disable === 'function') {
        drEngine.disable();
      } else if (typeof window.DarkReader !== 'undefined' && typeof window.DarkReader.disable === 'function') {
        try {
          window.DarkReader.disable();
        } catch (e) {}
      }

      // 2. Stop main MutationObserver ONLY if neither RTL nor Two-Row remains active
      if (this.observer && !this.hasAnyActiveFeature()) {
        this.observer.stop();
      }

      // 3. Disconnect or clean up Open Shadow Roots
      this.cleanupShadowRoots();

      // 4. Remove root attributes
      const root = document.documentElement;
      if (root) {
        root.removeAttribute('data-acd-theme');
        root.removeAttribute('data-acd-theme-preset');
      }

      // 5. Always remove legacy dark and chat-color stylesheets; remove functional stylesheets only if neither RTL nor Two-Row is active
      this.cleanupLegacyDarkStylesheets();
      this.cleanupChatColorStylesheets();
      if (!this.chatRtlEnabled && !this.chatTwoRowEnabled) {
        this.cleanupStylesheets();
      }

      // 6. Clean up Layer 1 and chat color attributes in main document
      try {
        const brightSurfaces = document.querySelectorAll('[data-acd-surface]');
        brightSurfaces.forEach((el) => el.removeAttribute('data-acd-surface'));

        const darkTexts = document.querySelectorAll('[data-acd-text]');
        darkTexts.forEach((el) => el.removeAttribute('data-acd-text'));

        const chatColored = document.querySelectorAll('[data-acd-chat-color]');
        chatColored.forEach((el) => el.removeAttribute('data-acd-chat-color'));
      } catch (e) {
        // Suppress any DOM cleanup errors
      }

      this.processQueue = [];
      this.isProcessingQueue = false;
      this.updateDebugState();
    }

    /**
     * Backward-compatible alias for removeDarkTheme
     */
    disable() {
      this.removeDarkTheme();
    }

    /**
     * Set attribute on html element as early as possible (Legacy Dark Engine only)
     */
    applyRootAttribute() {
      if (!this.isLegacyDarkEngine()) return;
      const root = document.documentElement;
      if (root && !root.hasAttribute('data-acd-theme')) {
        root.setAttribute('data-acd-theme', 'dark');
      }
    }

    /**
     * CONSOLIDATED ACTIVATION PATH FOR RTL CHAT
     */
    applyChatRtl(sendRtlFormattingEnabled = this.sendRtlFormattingEnabled) {
      this.chatRtlEnabled = true;
      if (typeof sendRtlFormattingEnabled === 'boolean') {
        this.sendRtlFormattingEnabled = sendRtlFormattingEnabled;
      }
      this.applyChatRtlAttribute();
      this.applySendRtlFormattingAttribute();
      this.injectStylesheets(document);
      if (this.observer && !this.observer.isObserving) {
        this.observer.start();
      }
      this.scheduleFunctionalShadowDiscovery();
    }

    /**
     * CONSOLIDATED DEACTIVATION PATH FOR RTL CHAT
     */
    removeChatRtl() {
      this.chatRtlEnabled = false;
      const root = document.documentElement;
      if (root) {
        root.removeAttribute('data-acd-chat-rtl');
        root.removeAttribute('data-acd-send-rtl-formatting');
      }

      // If neither dark mode, RTL, nor Two-Row is active, clean up observers, shadow roots, and stylesheets
      if (!this.hasAnyActiveFeature()) {
        if (this.observer) {
          this.observer.stop();
        }
        this.cleanupShadowRoots();
        this.cleanupStylesheets();
      }
    }

    /**
     * CONSOLIDATED ACTIVATION PATH FOR TWO-ROW CHAT LAYOUT
     */
    applyChatTwoRow() {
      this.chatTwoRowEnabled = true;
      const root = document.documentElement;
      if (root && !root.hasAttribute('data-acd-chat-two-row')) {
        root.setAttribute('data-acd-chat-two-row', 'true');
      }
      this.injectStylesheets(document);
      this.ensureChatLayoutStyle(document);
      if (this.observer && !this.observer.isObserving) {
        this.observer.start();
      }
      this.attachedShadowRoots.forEach((sr) => {
        this.ensureChatLayoutStyle(sr);
      });
      this.scheduleFunctionalShadowDiscovery();
    }

    /**
     * CONSOLIDATED DEACTIVATION PATH FOR TWO-ROW CHAT LAYOUT
     */
    removeChatTwoRow() {
      this.chatTwoRowEnabled = false;
      const root = document.documentElement;
      if (root) {
        root.removeAttribute('data-acd-chat-two-row');
      }
      this.removeChatLayoutStyle(document);
      this.attachedShadowRoots.forEach((sr) => {
        this.removeChatLayoutStyle(sr);
      });

      // If neither dark mode, RTL, nor Two-Row is active, clean up observers, shadow roots, and stylesheets
      if (!this.hasAnyActiveFeature()) {
        if (this.observer) {
          this.observer.stop();
        }
        this.cleanupShadowRoots();
        this.cleanupStylesheets();
      }
    }

    /**
     * Update Send RTL Formatting state independently
     */
    setSendRtlFormatting(enabled) {
      this.sendRtlFormattingEnabled = Boolean(enabled);
      this.applySendRtlFormattingAttribute();
    }

    /**
     * Set RTL attribute on html element
     */
    applyChatRtlAttribute() {
      const root = document.documentElement;
      if (root && !root.hasAttribute('data-acd-chat-rtl')) {
        root.setAttribute('data-acd-chat-rtl', 'true');
      }
    }

    /**
     * Set or update Send RTL Formatting attribute on html element.
     * Only applied when chatRtlEnabled is true.
     */
    applySendRtlFormattingAttribute() {
      const root = document.documentElement;
      if (!root) return;
      if (this.chatRtlEnabled) {
        root.setAttribute('data-acd-send-rtl-formatting', this.sendRtlFormattingEnabled ? 'true' : 'false');
      } else {
        root.removeAttribute('data-acd-send-rtl-formatting');
      }
    }

    /**
     * Remove only legacy dark-theme stylesheet link elements while preserving functional chat CSS
     */
    cleanupLegacyDarkStylesheets() {
      this.injectedLegacyDarkElements.forEach((el) => {
        try {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } catch (e) {}
        this.injectedElements.delete(el);
      });
      this.injectedLegacyDarkElements.clear();
    }

    /**
     * Remove dedicated semantic chat-color stylesheet link elements when Dark Mode is disabled
     */
    cleanupChatColorStylesheets() {
      this.injectedChatColorElements.forEach((el) => {
        try {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } catch (e) {}
        this.injectedElements.delete(el);
      });
      this.injectedChatColorElements.clear();
    }

    /**
     * Remove all injected document stylesheet link elements
     */
    cleanupStylesheets() {
      this.injectedElements.forEach((el) => {
        try {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } catch (e) {
          // Element might already have been removed
        }
      });
      this.injectedElements.clear();
      this.injectedLegacyDarkElements.clear();
      this.injectedChatColorElements.clear();
    }

    /**
     * Inject extension stylesheets into the document.
     * Separates:
     *   1. Functional stylesheets (Vazirmatn font, RTL Chat, BiDi, Two-Row)
     *   2. Semantic Chat Color stylesheet (styles/chat-colors.css) when Dark Mode is enabled
     *   3. Legacy dark-theme stylesheets ONLY when Legacy Dark Engine is active
     */
    injectStylesheets(target) {
      if (!this.hasAnyActiveFeature()) return;

      const container = target === document
        ? (document.head || document.documentElement)
        : target;

      if (!container) return;

      const injectPath = (path, category) => {
        const id = 'acd-style-' + path.replace(/[\/\.]/g, '-');

        // Check if already injected in this target
        if (container.querySelector && container.querySelector(`#${id}`)) {
          return;
        }

        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = chrome.runtime.getURL(path);
        link.setAttribute('data-acd-injected', 'true');
        if (category === 'legacy') {
          link.setAttribute('data-acd-legacy-dark-injected', 'true');
        } else if (category === 'chat-color') {
          link.setAttribute('data-acd-chat-color-injected', 'true');
        } else {
          link.setAttribute('data-acd-functional-injected', 'true');
        }

        container.appendChild(link);
        this.injectedElements.add(link);
        if (category === 'legacy') {
          this.injectedLegacyDarkElements.add(link);
        } else if (category === 'chat-color') {
          this.injectedChatColorElements.add(link);
        }
      };

      // 1. Always inject functional CSS (Vazirmatn @font-face, RTL Chat, BiDi, Two-Row)
      FUNCTIONAL_STYLESHEET_PATHS.forEach((path) => injectPath(path, 'functional'));

      // 2. Inject dedicated semantic Chat Color CSS whenever Dark Mode is enabled (Dark Reader + Legacy)
      if (this.shouldRunChatColorMapping()) {
        CHAT_COLOR_STYLESHEET_PATHS.forEach((path) => injectPath(path, 'chat-color'));
      }

      // 3. Inject legacy dark-theme CSS ONLY when Legacy Dark Engine is active
      if (this.shouldRunLegacyVisualEngine()) {
        LEGACY_DARK_STYLESHEET_PATHS.forEach((path) => injectPath(path, 'legacy'));
      }
    }

    /**
     * Schedule semantic Chat Color classification over existing DOM chat bubbles
     * without running legacy generic luminance scanning.
     */
    scheduleChatColorScan() {
      if (!this.shouldRunChatColorMapping()) return;

      const runScan = () => {
        if (this.shouldRunChatColorMapping() && document.body) {
          this.classifyChatBubblesInTree(document.body);
        }
      };

      if (document.body) {
        runScan();
      } else {
        document.addEventListener('DOMContentLoaded', runScan, { once: true });
      }

      if (document.readyState !== 'complete') {
        window.addEventListener('load', runScan, { once: true });
      }
    }

    /**
     * Schedule Shadow DOM discovery for functional features (RTL, BiDi, Two-Row)
     * without triggering legacy luminance scanning.
     */
    scheduleFunctionalShadowDiscovery() {
      if (!this.hasAnyActiveFeature()) return;

      if (document.body) {
        this.scanForShadowRoots(document.body);
      } else {
        const onBodyReady = () => {
          if (this.hasAnyActiveFeature() && document.body) {
            this.scanForShadowRoots(document.body);
          }
        };
        document.addEventListener('DOMContentLoaded', onBodyReady, { once: true });
      }
    }

    /**
     * Helper to collect a node and all candidate descendants in its subtree.
     * Essential for asynchronous SPA mounting (Adobe Connect Meeting/Recording pods).
     */
    getCandidateElements(container) {
      if (!container || container.nodeType !== Node.ELEMENT_NODE) return [];
      const results = [container];

      // If container is sensitive (video, canvas, presentation), do not collect its descendants
      if (this.isSensitive(container)) return results;

      try {
        if (container.querySelectorAll) {
          const descendants = container.querySelectorAll(CANDIDATE_DESCENDANT_SELECTORS);
          for (let i = 0; i < descendants.length; i++) {
            const d = descendants[i];
            if (d.nodeType === Node.ELEMENT_NODE && !SENSITIVE_TAGS.has(d.tagName.toUpperCase())) {
              results.push(d);
            }
          }
        }
      } catch (e) {}

      return results;
    }

    /**
     * Guaranteed Initial DOM Scan (Legacy Dark Engine only)
     * Fixes document_start race where document.body is not yet constructed.
     */
    scheduleInitialScan() {
      if (!this.shouldRunLegacyVisualEngine()) return;

      if (document.body) {
        this.performInitialScan();
      } else {
        // Wait for body to be created
        const onReady = () => {
          if (this.shouldRunLegacyVisualEngine() && document.body) {
            this.performInitialScan();
          }
        };

        document.addEventListener('DOMContentLoaded', onReady, { once: true });

        const onStateChange = () => {
          if (document.readyState === 'interactive' || document.readyState === 'complete') {
            document.removeEventListener('readystatechange', onStateChange);
            onReady();
          }
        };
        document.addEventListener('readystatechange', onStateChange);
      }

      // Safety sweep when window completes loading
      if (document.readyState !== 'complete') {
        window.addEventListener('load', () => {
          if (this.shouldRunLegacyVisualEngine() && document.body) {
            this.performInitialScan(true);
          }
        }, { once: true });
      }
    }

    /**
     * Perform the scan over document.body and all current candidate descendants (Legacy Dark Engine only)
     */
    performInitialScan(force = false) {
      if (!this.shouldRunLegacyVisualEngine() || !document.body) return;
      if (this.hasScannedInitialDOM && !force) return;
      this.hasScannedInitialDOM = true;

      // Classify any existing chat message bubbles synchronously for zero-FOUC
      this.classifyChatBubblesInTree(document.body);

      // Scan body and its key container children across entire subtree
      const candidates = this.getCandidateElements(document.body);
      this.queueNodesForEvaluation(candidates);

      // Check for any open shadow roots present in initial DOM
      this.scanForShadowRoots(document.body);
    }

    /**
     * Handle Open Shadow Root styling and observe dynamic shadow mutations.
     * Functional Shadow DOM support (RTL, BiDi, Two-Row) is decoupled from legacy dark-theme state.
     */
    attachToShadowRoot(shadowRoot) {
      if (!shadowRoot || !this.hasAnyActiveFeature()) return;

      this.attachedShadowRoots.add(shadowRoot);

      // 1. Inject functional Shadow DOM stylesheet (Vazirmatn, RTL Chat, BiDi, Two-Row)
      const shadowFunctionalStyleId = 'acd-shadow-functional-style';
      if (!shadowRoot.querySelector || !shadowRoot.querySelector(`#${shadowFunctionalStyleId}`)) {
        const fnLink = document.createElement('link');
        fnLink.id = shadowFunctionalStyleId;
        fnLink.rel = 'stylesheet';
        fnLink.type = 'text/css';
        fnLink.href = chrome.runtime.getURL(SHADOW_FUNCTIONAL_STYLESHEET_PATH);
        fnLink.setAttribute('data-acd-shadow-functional-injected', 'true');
        shadowRoot.appendChild(fnLink);
      }

      // 2. Inject semantic Chat Color stylesheet and classify existing shadow chat bubbles when Dark Mode is enabled
      if (this.shouldRunChatColorMapping()) {
        const shadowChatColorStyleId = 'acd-shadow-chat-color-style';
        if (!shadowRoot.querySelector || !shadowRoot.querySelector(`#${shadowChatColorStyleId}`)) {
          const ccLink = document.createElement('link');
          ccLink.id = shadowChatColorStyleId;
          ccLink.rel = 'stylesheet';
          ccLink.type = 'text/css';
          ccLink.href = chrome.runtime.getURL(SHADOW_CHAT_COLOR_STYLESHEET_PATH);
          ccLink.setAttribute('data-acd-shadow-chat-color-injected', 'true');
          shadowRoot.appendChild(ccLink);
        }
        this.classifyChatBubblesInTree(shadowRoot);
      }

      // 3. Inject Two-Row Chat presentation layout style inside shadow root ONLY if enabled
      if (this.chatTwoRowEnabled) {
        this.ensureChatLayoutStyle(shadowRoot);
      }

      // 4. Attach dedicated lightweight MutationObserver to this ShadowRoot
      if (!this.shadowObservers.has(shadowRoot)) {
        const shadowObserver = new MutationObserver((mutations) => {
          if (!this.hasAnyActiveFeature()) return;

          const runLegacyVisual = this.shouldRunLegacyVisualEngine();
          const runChatColor = this.shouldRunChatColorMapping();
          const addedElements = [];

          for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            if (mutation.type === 'attributes') {
              if (!runChatColor) continue;
              const target = mutation.target;
              if (
                target &&
                target.nodeType === Node.ELEMENT_NODE &&
                typeof target.className === 'string' &&
                target.className.indexOf('chatIndividualMessageContentWrapperDiv--') !== -1
              ) {
                this.classifyChatBubble(target);
              }
              continue;
            }
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              for (let j = 0; j < mutation.addedNodes.length; j++) {
                const node = mutation.addedNodes[j];
                if (node.nodeType === Node.ELEMENT_NODE && !SENSITIVE_TAGS.has(node.tagName.toUpperCase())) {
                  if (runChatColor) {
                    this.classifyChatBubblesInTree(node);
                  }
                  if (runLegacyVisual) {
                    const subCandidates = this.getCandidateElements(node);
                    for (let k = 0; k < subCandidates.length; k++) {
                      addedElements.push(subCandidates[k]);
                    }
                  } else {
                    addedElements.push(node);
                  }
                }
              }
            }
          }

          if (addedElements.length > 0) {
            if (runLegacyVisual) {
              this.queueNodesForEvaluation(addedElements);
            }

            for (const el of addedElements) {
              if (el.shadowRoot) {
                this.attachToShadowRoot(el.shadowRoot);
              }
              this.scanForShadowRoots(el);
            }
          }
        });

        shadowObserver.observe(shadowRoot, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style']
        });

        this.shadowObservers.set(shadowRoot, shadowObserver);
      }

      // 5. Legacy Dark Engine visual work inside Shadow DOM
      if (this.shouldRunLegacyVisualEngine()) {
        const shadowStyleId = 'acd-shadow-theme-style';
        if (!shadowRoot.querySelector || !shadowRoot.querySelector(`#${shadowStyleId}`)) {
          const link = document.createElement('link');
          link.id = shadowStyleId;
          link.rel = 'stylesheet';
          link.type = 'text/css';
          link.href = chrome.runtime.getURL(SHADOW_STYLESHEET_PATH);
          link.setAttribute('data-acd-shadow-injected', 'true');

          shadowRoot.appendChild(link);
        }

        // Evaluate existing elements inside shadow root
        const shadowCandidates = [];
        for (let i = 0; i < shadowRoot.children.length; i++) {
          const sub = this.getCandidateElements(shadowRoot.children[i]);
          for (let j = 0; j < sub.length; j++) {
            shadowCandidates.push(sub[j]);
          }
        }
        this.queueNodesForEvaluation(shadowCandidates);
      }

      // 6. Recursively check for nested shadow roots
      this.scanForShadowRoots(shadowRoot);
    }

    /**
     * Clean up attached shadow roots and disconnect shadow observers when no longer needed
     */
    cleanupShadowRoots() {
      const keepFunctional = Boolean(this.chatRtlEnabled || this.chatTwoRowEnabled);

      // 1. Disconnect all shadow MutationObservers if no functional feature remains active
      if (!keepFunctional && !this.enabled) {
        this.shadowObservers.forEach((observer) => {
          try {
            observer.disconnect();
          } catch (e) {}
        });
        this.shadowObservers.clear();
      }

      // 2. Remove injected styles and clean up Layer 1 attributes
      this.attachedShadowRoots.forEach((shadowRoot) => {
        try {
          if (!this.chatTwoRowEnabled) {
            this.removeChatLayoutStyle(shadowRoot);
          }

          if (shadowRoot.querySelectorAll) {
            // Always remove legacy shadow dark theme stylesheet when dark mode is removed
            if (!this.shouldRunLegacyVisualEngine()) {
              const injectedLegacy = shadowRoot.querySelectorAll('[data-acd-shadow-injected]');
              injectedLegacy.forEach((el) => {
                if (el && el.parentNode) el.parentNode.removeChild(el);
              });
            }

            // Remove shadow chat-color stylesheet when dark mode is disabled
            if (!this.shouldRunChatColorMapping()) {
              const injectedChatColor = shadowRoot.querySelectorAll('[data-acd-shadow-chat-color-injected]');
              injectedChatColor.forEach((el) => {
                if (el && el.parentNode) el.parentNode.removeChild(el);
              });
            }

            // Remove functional shadow stylesheet only when no feature remains active
            if (!keepFunctional && !this.enabled) {
              const injectedFunctional = shadowRoot.querySelectorAll('[data-acd-shadow-functional-injected]');
              injectedFunctional.forEach((el) => {
                if (el && el.parentNode) el.parentNode.removeChild(el);
              });
            }

            const brightSurfaces = shadowRoot.querySelectorAll('[data-acd-surface]');
            brightSurfaces.forEach((el) => el.removeAttribute('data-acd-surface'));

            const darkTexts = shadowRoot.querySelectorAll('[data-acd-text]');
            darkTexts.forEach((el) => el.removeAttribute('data-acd-text'));

            const chatColored = shadowRoot.querySelectorAll('[data-acd-chat-color]');
            chatColored.forEach((el) => el.removeAttribute('data-acd-chat-color'));
          }
        } catch (e) {
          // Suppress cleanup error for detached shadow roots
        }
      });

      if (!keepFunctional && !this.enabled) {
        this.attachedShadowRoots.clear();
      }
    }

    /**
     * Scan container for custom elements with open shadow roots
     */
    scanForShadowRoots(container) {
      if (!container || !this.hasAnyActiveFeature()) return;

      try {
        const allElements = container.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i];
          if (el.shadowRoot) {
            this.attachToShadowRoot(el.shadowRoot);
          }
        }
      } catch (e) {
        // Fallback
      }
    }

    /**
     * Check if an element or its ancestor is sensitive (media, whiteboard, presentation)
     * Differentiates between Content SVGs (preserved) and UI SVGs (allowed to adapt).
     */
    isSensitive(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;

      const tagName = element.tagName.toUpperCase();

      // Direct media tags check
      if (SENSITIVE_TAGS.has(tagName)) return true;

      // Explicit preservation attribute or class
      if (element.hasAttribute && (
        element.hasAttribute('data-acd-preserve') ||
        element.classList.contains('acd-preserve')
      )) {
        return true;
      }

      // Semantic status indicators, swatches, and user-selected Chat Color bubble preservation
      if (element.matches) {
        if (
          element.matches('[class*="chatIndividualMessageContentWrapperDiv"]') ||
          element.matches('[class*="chatMenuItemColorCode"]') ||
          element.matches('[class*="colorSwatch"]') ||
          element.matches('[class*="chatIndividualMessageContent"][style*="color"]') ||
          element.matches('[class*="ConnectionStatus"]') ||
          element.matches('[class*="connectionStatus"]') ||
          element.matches('[class*="AudioDropDownActiveIcon"]') ||
          element.matches('[class*="AudioDropDownInactiveIcon"]') ||
          element.matches('[class*="centrePaneAudioDropDownActiveIcon"]') ||
          element.matches('[class*="centrePaneAudioDropDownInactiveIcon"]') ||
          element.matches('[class*="notificationCountDiv"]') ||
          element.matches('[class*="Toast-typeIcon"]')
        ) {
          return true;
        }
      }

      // Chat message bubble subtree and chat swatches must not be touched by Layer 1 dynamic coloring
      try {
        if (element.closest && (
          element.closest('[class*="chatIndividualMessageContentWrapperDiv"]') ||
          element.closest('[class*="chatIndividualMessage"]') ||
          element.closest('[class*="chatContentArea"]') ||
          element.closest('[class*="chatColorMenuItem"]') ||
          element.closest('[class*="chatMenuItemColor"]')
        )) {
          return true;
        }
      } catch (e) {}

      // Ancestor check for media / presentation containers
      try {
        if (element.closest && element.closest(SENSITIVE_CONTAINER_SELECTORS)) {
          return true;
        }
      } catch (e) {
        // Fallback
      }

      // SVG handling:
      // Content SVGs (slides, whiteboard, presentations) are preserved.
      // UI SVGs (toolbar icons, buttons, menus) are NOT sensitive.
      if (tagName === 'SVG' || element.ownerSVGElement) {
        try {
          if (element.closest && (
            element.closest('.presentation-content') ||
            element.closest('.slide-container') ||
            element.closest('.whiteboard-canvas') ||
            element.closest('[data-ac-role="presentation"]') ||
            element.closest('[data-ac-role="whiteboard"]')
          )) {
            return true; // Content SVG -> Sensitive
          }
        } catch (e) {}

        // UI SVG -> Not sensitive, allowing parent text/icon color styling
        return false;
      }

      return false;
    }

    /**
     * Parse rgb/rgba string into numeric components
     */
    parseRgb(colorStr) {
      if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit') {
        return null;
      }

      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return null;

      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1.0
      };
    }

    /**
     * Parse rgb/rgba or hex color string from inline style without mutating DOM
     */
    parseColorValue(rawStr) {
      if (!rawStr || typeof rawStr !== 'string') return null;
      const trimmed = rawStr.trim().toLowerCase();
      if (
        !trimmed ||
        trimmed === 'transparent' ||
        trimmed === 'none' ||
        trimmed === 'inherit' ||
        trimmed === 'initial' ||
        trimmed === 'unset'
      ) {
        return null;
      }
      if (trimmed === 'white') {
        return { r: 255, g: 255, b: 255, a: 1.0 };
      }

      const rgb = this.parseRgb(trimmed);
      if (rgb) return rgb;

      const hexMatch = trimmed.match(/#([0-9a-f]{3,8})\b/i);
      if (hexMatch) {
        const hex = hexMatch[1];
        if (hex.length === 3) {
          return {
            r: parseInt(hex[0] + hex[0], 16),
            g: parseInt(hex[1] + hex[1], 16),
            b: parseInt(hex[2] + hex[2], 16),
            a: 1.0
          };
        }
        if (hex.length >= 6) {
          return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
            a: 1.0
          };
        }
      }
      return null;
    }

    /**
     * Extract native inline background / background-color from a chat bubble element
     * without reading computed styles or mutating inline style attributes.
     */
    extractInlineBackground(element) {
      if (!element) return '';
      if (element.style) {
        if (element.style.backgroundColor) return element.style.backgroundColor;
        if (element.style.background) return element.style.background;
      }
      if (element.getAttribute) {
        const rawStyle = element.getAttribute('style');
        if (rawStyle) {
          const match = rawStyle.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i);
          if (match && match[1]) return match[1].trim();
        }
      }
      return '';
    }

    /**
     * Isolated Semantic Chat Bubble Color Classifier
     * Maps native Adobe Connect inline bubble background RGB to one of:
     * 'default' | 'red' | 'orange' | 'green' | 'brown' | 'purple' | 'pink' | 'blue' | 'grey'
     */
    classifyChatBubbleColor(rawColorStr) {
      const rgb = this.parseColorValue(rawColorStr);
      if (!rgb || rgb.a < 0.15) return 'default';

      const { r, g, b } = rgb;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const avg = (r + g + b) / 3;

      const l = (max + min) / 510;
      const s = delta === 0 ? 0 : delta / (255 - Math.abs(max + min - 255));

      // 1. Achromatic / Near-Achromatic (Default light neutral vs explicit Grey chat color)
      if (delta <= 10 || s < 0.065) {
        // Native Adobe default bubble surfaces (#FFFFFF, #FAFAFA, #F5F5F5, #F0F0F0, #EEEEEE)
        // or already-dark surfaces map to 'default'
        if (avg >= 236 || avg <= 55) {
          return 'default';
        }
        // Medium-light neutral pastel (e.g. rgb(228, 228, 228), rgb(218, 218, 218)) maps to 'grey'
        return 'grey';
      }

      // Compute Hue in degrees [0, 360)
      let h = 0;
      if (max === r) {
        h = ((g - b) / delta) * 60;
        if (h < 0) h += 360;
      } else if (max === g) {
        h = ((b - r) / delta + 2) * 60;
      } else {
        h = ((r - g) / delta + 4) * 60;
      }

      // 2. Green (e.g. confirmed Adobe Connect Green rgb(215, 235, 218) -> h = 129°)
      if (h >= 75 && h <= 168) {
        return 'green';
      }

      // 3. Blue (e.g. rgb(212, 229, 247) -> h = 211°)
      if (h > 168 && h <= 250) {
        return 'blue';
      }

      // 4. Purple (e.g. rgb(228, 215, 242) -> h = 269°)
      if (h > 250 && h <= 300) {
        return 'purple';
      }

      // 5. Pink (e.g. rgb(247, 215, 232) -> h = 328°, or rose tint with b > g + 5)
      if ((h > 300 && h <= 345) || (h > 345 && h <= 355 && b > g + 5)) {
        return 'pink';
      }

      // 6. Red (e.g. rgb(245, 215, 215) -> h = 0°)
      if (h > 345 || h <= 14) {
        return 'red';
      }

      // 7. Warm band (14° < h < 75°): Distinguish Orange vs Brown
      if (l >= 0.65) {
        // Pastel bubble: Orange has higher saturation and bright red channel; Brown/Tan is muted
        if (s >= 0.46 && r >= 240 && h <= 48) {
          return 'orange';
        }
        return 'brown';
      }

      // Darker/medium swatch fallback
      if (l < 0.48 || s < 0.55) {
        return 'brown';
      }
      return 'orange';
    }

    /**
     * Classify a single chatIndividualMessageContentWrapperDiv element
     * and set data-acd-chat-color without mutating native inline styles.
     */
    classifyChatBubble(element) {
      if (!this.shouldRunChatColorMapping()) return;
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
      const rawBg = this.extractInlineBackground(element);
      const family = this.classifyChatBubbleColor(rawBg);
      if (element.getAttribute('data-acd-chat-color') !== family) {
        element.setAttribute('data-acd-chat-color', family);
      }
    }

    /**
     * Classify all chat message bubbles inside a root container or subtree
     */
    classifyChatBubblesInTree(root) {
      if (!this.shouldRunChatColorMapping(root) || !root) return;
      try {
        if (
          root.nodeType === Node.ELEMENT_NODE &&
          typeof root.className === 'string' &&
          root.className.indexOf('chatIndividualMessageContentWrapperDiv--') !== -1
        ) {
          this.classifyChatBubble(root);
        }
        if (root.querySelectorAll) {
          const bubbles = root.querySelectorAll(
            '[class^="chatIndividualMessageContentWrapperDiv--"], [class*=" chatIndividualMessageContentWrapperDiv--"]'
          );
          for (let i = 0; i < bubbles.length; i++) {
            this.classifyChatBubble(bubbles[i]);
          }
        }
      } catch (e) {}
    }

    /**
     * Calculate perceived luminance using ITU-R BT.601 standard
     */
    getLuminance(r, g, b) {
      return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    /**
     * Layer 1: Evaluate element computed colors conservatively (Legacy Dark Engine only)
     */
    evaluateElement(element) {
      if (!this.shouldRunLegacyVisualEngine()) return;
      if (this.isSensitive(element)) return;

      // Check for Open Shadow Root
      if (element.shadowRoot) {
        this.attachToShadowRoot(element.shadowRoot);
      }

      // Skip elements that already have explicit layer 2 classes or styling
      if (element.hasAttribute('data-acd-surface')) return;

      // Skip modal dialogs and underlays handled by Layer 2 elevated modal rules
      if (
        typeof element.closest === 'function' &&
        element.closest(
          '.spectrum-Dialog, .react-spectrum-Dialog, #confirmationDialog, #notificationDialog, #openPOAFromPodsMenuDialog, .spectrum-Underlay, .react-spectrum-Underlay, [class*="spectrumModalDialog--"], [class*="promotionDialog--"]'
        )
      ) {
        return;
      }

      const style = window.getComputedStyle(element);
      if (!style) return;

      // 1. Evaluate background color
      const bgColor = this.parseRgb(style.backgroundColor);
      if (bgColor && bgColor.a > 0.3) {
        const bgLuminance = this.getLuminance(bgColor.r, bgColor.g, bgColor.b);

        // Only flag genuinely bright surfaces (Luminance > 185 out of 255)
        if (bgLuminance > 185) {
          element.setAttribute('data-acd-surface', 'bright');
        }
      }

      // 2. Evaluate text color
      const textColor = this.parseRgb(style.color);
      if (textColor && textColor.a > 0.3) {
        const textLuminance = this.getLuminance(textColor.r, textColor.g, textColor.b);

        // Flag dark text (Luminance < 110) to ensure high readability
        if (textLuminance < 110) {
          element.setAttribute('data-acd-text', 'dark');
        }
      }
    }

    /**
     * Add nodes to queue for batched evaluation (Legacy Dark Engine only)
     */
    queueNodesForEvaluation(nodes) {
      if (!this.shouldRunLegacyVisualEngine() || !nodes) return;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.nodeType === Node.ELEMENT_NODE) {
          this.processQueue.push(node);
        }
      }

      this.scheduleQueueProcessing();
    }

    /**
     * Schedule queue processing using requestAnimationFrame or requestIdleCallback (Legacy Dark Engine only)
     */
    scheduleQueueProcessing() {
      if (!this.shouldRunLegacyVisualEngine()) {
        this.processQueue = [];
        this.isProcessingQueue = false;
        return;
      }
      if (this.isProcessingQueue || this.processQueue.length === 0) return;
      this.isProcessingQueue = true;

      const runner = window.requestIdleCallback || window.requestAnimationFrame;
      runner((deadline) => {
        const batchSize = 100;
        let processed = 0;

        while (this.processQueue.length > 0 && processed < batchSize) {
          if (!this.shouldRunLegacyVisualEngine()) break;
          const element = this.processQueue.shift();
          this.evaluateElement(element);
          processed++;

          if (deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() <= 1) {
            break;
          }
        }

        this.isProcessingQueue = false;

        if (this.shouldRunLegacyVisualEngine() && this.processQueue.length > 0) {
          this.scheduleQueueProcessing();
        }
      });
    }
  }

  window.ACDThemeEngine = ACDThemeEngine;
  window.__ACD_THEME_ENGINE__ = new ACDThemeEngine();
})();
