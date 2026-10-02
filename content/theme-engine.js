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

  const STYLESHEET_PATHS = [
    'styles/variables.css',
    'styles/base.css',
    'styles/adobe-connect.css',
    'styles/components.css',
    'styles/connect-central.css'
  ];

  const SHADOW_STYLESHEET_PATH = 'styles/shadow-dom.css';

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
    '.canvasHTMLPDF',
    '.canvasSingleHTMLPDF',
    '[class*="shareContent--"] canvas',
    '[class*="whiteboardWrapper--"]',
    '[class*="wbShapesWrapper--"]',
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
      this.enabled = false;
      this.chatRtlEnabled = false;
      this.observer = null; // Associated ACDObserver
      this.injectedElements = new Set();
      this.attachedShadowRoots = new Set();
      this.shadowObservers = new Map(); // Map<ShadowRoot, MutationObserver>
      this.hasScannedInitialDOM = false;
      this.processQueue = [];
      this.isProcessingQueue = false;
    }

    /**
     * Attach ACDObserver instance
     */
    setObserver(observer) {
      this.observer = observer;
      if (this.enabled && !observer.isObserving) {
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
     * CONSOLIDATED IDEMPOTENT ACTIVATION PATH
     * Executed identically by automatic page load and manual popup toggle.
     */
    applyDarkTheme() {
      const wasAlreadyEnabled = this.enabled;
      this.enabled = true;

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
    }

    /**
     * Backward-compatible alias for applyDarkTheme
     */
    enable() {
      this.applyDarkTheme();
    }

    /**
     * CONSOLIDATED DEACTIVATION PATH
     * Cleanly restores native appearance and disconnects all observers.
     */
    removeDarkTheme() {
      if (!this.enabled) return;
      this.enabled = false;
      this.hasScannedInitialDOM = false;

      // 1. Stop main MutationObserver
      if (this.observer) {
        this.observer.stop();
      }

      // 2. Disconnect and clean up Open Shadow Roots
      this.cleanupShadowRoots();

      // 3. Remove root attribute
      const root = document.documentElement;
      if (root) {
        root.removeAttribute('data-acd-theme');
      }

      // 4. Remove all injected document stylesheet elements ONLY if chat RTL is not active
      if (!this.chatRtlEnabled) {
        this.cleanupStylesheets();
      }

      // 5. Clean up Layer 1 attributes in main document
      try {
        const brightSurfaces = document.querySelectorAll('[data-acd-surface]');
        brightSurfaces.forEach((el) => el.removeAttribute('data-acd-surface'));

        const darkTexts = document.querySelectorAll('[data-acd-text]');
        darkTexts.forEach((el) => el.removeAttribute('data-acd-text'));
      } catch (e) {
        // Suppress any DOM cleanup errors
      }

      this.processQueue = [];
      this.isProcessingQueue = false;
    }

    /**
     * Backward-compatible alias for removeDarkTheme
     */
    disable() {
      this.removeDarkTheme();
    }

    /**
     * Set attribute on html element as early as possible
     */
    applyRootAttribute() {
      const root = document.documentElement;
      if (root && !root.hasAttribute('data-acd-theme')) {
        root.setAttribute('data-acd-theme', 'dark');
      }
    }

    /**
     * CONSOLIDATED ACTIVATION PATH FOR RTL CHAT
     */
    applyChatRtl() {
      this.chatRtlEnabled = true;
      this.applyChatRtlAttribute();
      this.injectStylesheets(document);
    }

    /**
     * CONSOLIDATED DEACTIVATION PATH FOR RTL CHAT
     */
    removeChatRtl() {
      this.chatRtlEnabled = false;
      const root = document.documentElement;
      if (root) {
        root.removeAttribute('data-acd-chat-rtl');
      }

      // If neither dark mode nor RTL is active, clean up injected stylesheets
      if (!this.enabled && !this.chatRtlEnabled) {
        this.cleanupStylesheets();
      }
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
    }

    /**
     * Inject extension stylesheets into the document
     */
    injectStylesheets(target) {
      if (!this.enabled && !this.chatRtlEnabled) return;

      const container = target === document
        ? (document.head || document.documentElement)
        : target;

      if (!container) return;

      STYLESHEET_PATHS.forEach((path) => {
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

        container.appendChild(link);
        this.injectedElements.add(link);
      });
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
     * Guaranteed Initial DOM Scan
     * Fixes document_start race where document.body is not yet constructed.
     */
    scheduleInitialScan() {
      if (document.body) {
        this.performInitialScan();
      } else {
        // Wait for body to be created
        const onReady = () => {
          if (this.enabled && document.body) {
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
          if (this.enabled && document.body) {
            this.performInitialScan(true);
          }
        }, { once: true });
      }
    }

    /**
     * Perform the scan over document.body and all current candidate descendants
     */
    performInitialScan(force = false) {
      if (!this.enabled || !document.body) return;
      if (this.hasScannedInitialDOM && !force) return;
      this.hasScannedInitialDOM = true;

      // Scan body and its key container children across entire subtree
      const candidates = this.getCandidateElements(document.body);
      this.queueNodesForEvaluation(candidates);

      // Check for any open shadow roots present in initial DOM
      this.scanForShadowRoots(document.body);
    }

    /**
     * Handle Open Shadow Root styling and observe dynamic shadow mutations
     */
    attachToShadowRoot(shadowRoot) {
      if (!this.enabled || !shadowRoot) return;

      this.attachedShadowRoots.add(shadowRoot);

      // 1. Inject dedicated Shadow DOM stylesheet (encapsulation-friendly)
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

      // 2. Attach dedicated lightweight MutationObserver to this ShadowRoot
      if (!this.shadowObservers.has(shadowRoot)) {
        const shadowObserver = new MutationObserver((mutations) => {
          if (!this.enabled) return;

          const addedElements = [];
          for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              for (let j = 0; j < mutation.addedNodes.length; j++) {
                const node = mutation.addedNodes[j];
                if (node.nodeType === Node.ELEMENT_NODE && !SENSITIVE_TAGS.has(node.tagName.toUpperCase())) {
                  const subCandidates = this.getCandidateElements(node);
                  for (let k = 0; k < subCandidates.length; k++) {
                    addedElements.push(subCandidates[k]);
                  }
                }
              }
            }
          }

          if (addedElements.length > 0) {
            this.queueNodesForEvaluation(addedElements);

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
          subtree: true
        });

        this.shadowObservers.set(shadowRoot, shadowObserver);
      }

      // 3. Evaluate existing elements inside shadow root
      const shadowCandidates = [];
      for (let i = 0; i < shadowRoot.children.length; i++) {
        const sub = this.getCandidateElements(shadowRoot.children[i]);
        for (let j = 0; j < sub.length; j++) {
          shadowCandidates.push(sub[j]);
        }
      }
      this.queueNodesForEvaluation(shadowCandidates);

      // 4. Recursively check for nested shadow roots
      this.scanForShadowRoots(shadowRoot);
    }

    /**
     * Clean up all attached shadow roots and disconnect all shadow observers on disable()
     */
    cleanupShadowRoots() {
      // 1. Disconnect all shadow MutationObservers
      this.shadowObservers.forEach((observer) => {
        try {
          observer.disconnect();
        } catch (e) {}
      });
      this.shadowObservers.clear();

      // 2. Remove injected styles and clean up Layer 1 attributes
      this.attachedShadowRoots.forEach((shadowRoot) => {
        try {
          if (shadowRoot.querySelectorAll) {
            const injected = shadowRoot.querySelectorAll('[data-acd-shadow-injected]');
            injected.forEach((el) => {
              if (el && el.parentNode) el.parentNode.removeChild(el);
            });

            const brightSurfaces = shadowRoot.querySelectorAll('[data-acd-surface]');
            brightSurfaces.forEach((el) => el.removeAttribute('data-acd-surface'));

            const darkTexts = shadowRoot.querySelectorAll('[data-acd-text]');
            darkTexts.forEach((el) => el.removeAttribute('data-acd-text'));
          }
        } catch (e) {
          // Suppress cleanup error for detached shadow roots
        }
      });

      this.attachedShadowRoots.clear();
    }

    /**
     * Scan container for custom elements with open shadow roots
     */
    scanForShadowRoots(container) {
      if (!this.enabled || !container) return;

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
     * Calculate perceived luminance using ITU-R BT.601 standard
     */
    getLuminance(r, g, b) {
      return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    /**
     * Layer 1: Evaluate element computed colors conservatively
     */
    evaluateElement(element) {
      if (!this.enabled) return;
      if (this.isSensitive(element)) return;

      // Check for Open Shadow Root
      if (element.shadowRoot) {
        this.attachToShadowRoot(element.shadowRoot);
      }

      // Skip elements that already have explicit layer 2 classes or styling
      if (element.hasAttribute('data-acd-surface')) return;

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
     * Add nodes to queue for batched evaluation
     */
    queueNodesForEvaluation(nodes) {
      if (!this.enabled || !nodes) return;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.nodeType === Node.ELEMENT_NODE) {
          this.processQueue.push(node);
        }
      }

      this.scheduleQueueProcessing();
    }

    /**
     * Schedule queue processing using requestAnimationFrame or requestIdleCallback
     */
    scheduleQueueProcessing() {
      if (this.isProcessingQueue || this.processQueue.length === 0) return;
      this.isProcessingQueue = true;

      const runner = window.requestIdleCallback || window.requestAnimationFrame;
      runner((deadline) => {
        const batchSize = 100;
        let processed = 0;

        while (this.processQueue.length > 0 && processed < batchSize) {
          if (!this.enabled) break;
          const element = this.processQueue.shift();
          this.evaluateElement(element);
          processed++;

          if (deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() <= 1) {
            break;
          }
        }

        this.isProcessingQueue = false;

        if (this.enabled && this.processQueue.length > 0) {
          this.scheduleQueueProcessing();
        }
      });
    }
  }

  window.ACDThemeEngine = ACDThemeEngine;
  window.__ACD_THEME_ENGINE__ = new ACDThemeEngine();
})();
