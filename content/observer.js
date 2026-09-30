/**
 * Adobe Connect Dark Mode - DOM Mutation Observer
 * Lightweight, debounced observer that handles dynamically added SPA pods,
 * chat messages, dialogs, and Open Shadow DOM roots without degrading performance.
 * Traverses subtrees of newly mounted SPA containers to eliminate light surface gaps.
 */

(function () {
  'use strict';

  // Prevent multiple definitions
  if (window.__ACD_OBSERVER__) return;

  const IGNORE_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'LINK',
    'META',
    'NOSCRIPT',
    'VIDEO',
    'CANVAS',
    'IMG',
    'PICTURE',
    'AUDIO'
  ]);

  class ACDObserver {
    constructor(themeEngine) {
      this.themeEngine = themeEngine || window.__ACD_THEME_ENGINE__;
      this.observer = null;
      this.isObserving = false;
      this.batch = [];
      this.debounceTimer = null;
      this.DEBOUNCE_DELAY = 40; // 40ms debounce for rapid SPA pod responsiveness
    }

    /**
     * Start observing DOM changes on document.documentElement
     * Starts early enough to capture all head, body, and subtree additions.
     */
    start() {
      if (this.isObserving) return;

      const target = document.documentElement;
      if (!target) {
        document.addEventListener('DOMContentLoaded', () => this.start(), { once: true });
        return;
      }

      this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));

      this.observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });

      this.isObserving = true;
    }

    /**
     * Stop observing to consume zero CPU when dark mode is off
     */
    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.isObserving = false;
      this.batch = [];
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }

    /**
     * Filter and queue mutation elements and their subtrees
     */
    handleMutations(mutations) {
      if (!this.themeEngine || !this.themeEngine.isEnabled()) {
        return;
      }

      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = mutation.addedNodes[j];
            if (node.nodeType === Node.ELEMENT_NODE && !IGNORE_TAGS.has(node.tagName.toUpperCase())) {
              // Collect node AND candidate descendants within this mounted subtree
              const candidates = this.themeEngine.getCandidateElements(node);
              for (let k = 0; k < candidates.length; k++) {
                this.batch.push(candidates[k]);
              }
            }
          }
        }
      }

      if (this.batch.length > 0) {
        this.scheduleFlush();
      }
    }

    /**
     * Debounced batch flush
     */
    scheduleFlush() {
      if (this.debounceTimer) return;

      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        if (!this.isObserving || !this.themeEngine.isEnabled() || this.batch.length === 0) {
          this.batch = [];
          return;
        }

        const nodesToProcess = this.batch;
        this.batch = [];

        // Check for Open Shadow Roots in added nodes and their subtrees
        for (const node of nodesToProcess) {
          if (node.shadowRoot) {
            this.themeEngine.attachToShadowRoot(node.shadowRoot);
          }
          this.themeEngine.scanForShadowRoots(node);
        }

        // Send to Theme Engine queue for Layer 1 detection
        this.themeEngine.queueNodesForEvaluation(nodesToProcess);
      }, this.DEBOUNCE_DELAY);
    }
  }

  window.ACDObserver = ACDObserver;
  window.__ACD_OBSERVER__ = new ACDObserver(window.__ACD_THEME_ENGINE__);
  if (window.__ACD_THEME_ENGINE__) {
    window.__ACD_THEME_ENGINE__.setObserver(window.__ACD_OBSERVER__);
  }
})();
