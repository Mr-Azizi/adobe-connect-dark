/**
 * Adobe Connect Dark Mode - Theme Engine
 * Controls stylesheet injection, Open Shadow DOM per-root MutationObservers,
 * guaranteed initial DOM scanning, and Layer 1 smart generic luminance detection.
 */

(function () {
  'use strict';

  // Prevent multiple definitions
  if (window.__ACD_THEME_ENGINE__) return;

  const STYLESHEET_PATHS = [
    'styles/variables.css',
    'styles/base.css',
    'styles/adobe-connect.css',
    'styles/components.css'
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
    '[data-acd-preserve="true"]',
    '.acd-preserve'
  ].join(', ');

  class ACDThemeEngine {
    constructor() {
      this.enabled = false;
      this.injectedElements = new Set();
      this.attachedShadowRoots = new Set();
      this.shadowObservers = new Map(); // Map<ShadowRoot, MutationObserver>
      this.hasScannedInitialDOM = false;
      this.processQueue = [];
      this.isProcessingQueue = false;
    }

    /**
     * Check if theme is currently active
     */
    isEnabled() {
      return this.enabled;
    }

    /**
     * Activate Dark Mode
     */
    enable() {
      if (this.enabled) return;
      this.enabled = true;

      // 1. Set root attribute immediately on documentElement
      this.applyRootAttribute();

      // 2. Inject core stylesheets
      this.injectStylesheets(document);

      // 3. Schedule guaranteed initial DOM scan
      this.scheduleInitialScan();
    }

    /**
     * Deactivate Dark Mode and restore native look
     */
    disable() {
      if (!this.enabled) return;
      this.enabled = false;
      this.hasScannedInitialDOM = false;

      // 1. Remove root attribute
      const root = document.documentElement;
      if (root) {
        root.removeAttribute('data-acd-theme');
      }

      // 2. Remove all injected document stylesheet elements
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

      // 3. Clean up Open Shadow Roots and disconnect shadow observers
      this.cleanupShadowRoots();

      // 4. Clean up Layer 1 attributes in main document
      try {
        const brightSurfaces = document.querySelectorAll('[data-acd-surface]');
        brightSurfaces.forEach((el) => el.removeAttribute('data-acd-surface'));

        const darkTexts = document.querySelectorAll('[data-acd-text]');
        darkTexts.forEach((el) => el.removeAttribute('data-acd-text'));
      } catch (e) {
        // Suppress any DOM cleanup errors
      }

      this.processQueue = [];
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
     * Inject extension stylesheets into the document
     */
    injectStylesheets(target) {
      if (!this.enabled) return;

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
     * Guaranteed Initial DOM Scan
     * Fixes document_start race where document.body is not yet constructed.
     */
    scheduleInitialScan() {
      if (this.hasScannedInitialDOM) return;

      if (document.body) {
        this.performInitialScan();
      } else {
        // Wait for body to be created
        const onReady = () => {
          if (this.enabled && !this.hasScannedInitialDOM && document.body) {
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
    }

    /**
     * Perform the actual scan once body is ready
     */
    performInitialScan() {
      if (!this.enabled || this.hasScannedInitialDOM || !document.body) return;
      this.hasScannedInitialDOM = true;

      // Scan body and its key container children
      this.queueNodesForEvaluation([document.body]);

      try {
        const candidates = document.querySelectorAll(
          'div, section, aside, header, nav, main, article, [role="region"], [role="dialog"], [role="menu"]'
        );
        this.queueNodesForEvaluation(candidates);
      } catch (e) {
        // Fallback
      }

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
                  addedElements.push(node);
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
      this.queueNodesForEvaluation(shadowRoot.children);

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
      runner(() => {
        const batchSize = 60;
        const currentBatch = this.processQueue.splice(0, batchSize);

        for (const element of currentBatch) {
          if (!this.enabled) break;
          this.evaluateElement(element);

          // Also check direct children for quick coverage
          if (element.children && element.children.length > 0 && element.children.length < 25) {
            for (let j = 0; j < element.children.length; j++) {
              this.evaluateElement(element.children[j]);
            }
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
