/**
 * Adobe Connect Dark Mode - Theme Engine
 * Controls stylesheet injection, Open Shadow DOM traversal,
 * and Layer 1 smart generic luminance detection.
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

  // Tags that MUST NEVER be altered or darkened
  const SENSITIVE_TAGS = new Set([
    'VIDEO',
    'CANVAS',
    'IMG',
    'PICTURE',
    'AUDIO',
    'EMBED',
    'OBJECT',
    'IFRAME',
    'SVG',
    'PATH',
    'CIRCLE',
    'RECT',
    'POLYGON',
    'LINE'
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
      this.shadowRootsProcessed = new WeakSet();
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

      // 1. Set root attribute immediately
      this.applyRootAttribute();

      // 2. Inject core stylesheets
      this.injectStylesheets(document);

      // 3. Scan existing DOM for Shadow DOM and Layer 1 generic detection
      this.scanDocument();
    }

    /**
     * Deactivate Dark Mode and restore native look
     */
    disable() {
      if (!this.enabled) return;
      this.enabled = false;

      // 1. Remove root attribute
      const root = document.documentElement;
      if (root) {
        root.removeAttribute('data-acd-theme');
      }

      // 2. Remove all injected stylesheet elements
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

      // 3. Clean up Layer 1 attributes
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
     * Set attribute on html element
     */
    applyRootAttribute() {
      const root = document.documentElement;
      if (root && !root.hasAttribute('data-acd-theme')) {
        root.setAttribute('data-acd-theme', 'dark');
      }
    }

    /**
     * Inject extension stylesheets into a document or shadow root target
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
     * Handle Open Shadow Root styling safely
     */
    attachToShadowRoot(shadowRoot) {
      if (!this.enabled || !shadowRoot || this.shadowRootsProcessed.has(shadowRoot)) {
        return;
      }

      this.shadowRootsProcessed.add(shadowRoot);
      this.injectStylesheets(shadowRoot);

      // Evaluate elements inside shadow root
      this.queueNodesForEvaluation(shadowRoot.children);
    }

    /**
     * Check if an element or its ancestor is sensitive (media, whiteboard, presentation)
     */
    isSensitive(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;

      // Direct tag check
      if (SENSITIVE_TAGS.has(element.tagName)) return true;

      // Attribute or class check
      if (element.hasAttribute && (
        element.hasAttribute('data-acd-preserve') ||
        element.classList.contains('acd-preserve')
      )) {
        return true;
      }

      // Ancestor check
      try {
        if (element.closest && element.closest(SENSITIVE_CONTAINER_SELECTORS)) {
          return true;
        }
      } catch (e) {
        // Invalid selector or detached node fallback
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

    /**
     * Scan document on initial activation
     */
    scanDocument() {
      if (!this.enabled) return;

      // Scan body and its children
      if (document.body) {
        this.queueNodesForEvaluation([document.body]);

        // Traverse key candidate containers (pods, toolbars, panels)
        try {
          const candidates = document.querySelectorAll(
            'div, section, aside, header, nav, main, article, [role="region"], [role="dialog"], [role="menu"]'
          );
          this.queueNodesForEvaluation(candidates);
        } catch (e) {
          // Fallback if querySelector fails
        }
      }
    }
  }

  window.ACDThemeEngine = ACDThemeEngine;
  window.__ACD_THEME_ENGINE__ = new ACDThemeEngine();
})();
