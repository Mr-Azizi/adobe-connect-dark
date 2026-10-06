/**
 * Adobe Connect Dark Mode - Dark Reader Integration & Engine Switch Module
 * Wraps the locally bundled official Dark Reader runtime (vendor/darkreader.js)
 * with Adobe Connect media/presentation preservation rules and engine switching.
 *
 * Engine modes:
 *   - 'darkreader': Uses official Dark Reader dynamic theme engine (PoC default)
 *   - 'legacy':     Uses v1.8.5 custom CSS + Layer 1 luminance theme engine
 */

(function () {
  'use strict';

  if (window.__ACD_DARKREADER_ENGINE__) return;

  /**
   * Authoritative Dark Engine Switch
   * Set to 'darkreader' for the Dark Reader PoC, or 'legacy' for v1.8.5 behavior.
   */
  const DARK_ENGINE = window.__ACD_DARK_ENGINE__ || 'darkreader';
  window.__ACD_DARK_ENGINE__ = DARK_ENGINE;
  window.ACD_DARK_ENGINE = DARK_ENGINE;

  const presetRegistry = window.ACDThemePresets || null;
  const DEFAULT_PRESET_ID = (presetRegistry && presetRegistry.DEFAULT_PRESET_ID) || 'dark';

  /**
   * Fallback baseline Dark Reader Theme Configuration (identical to 'dark' preset)
   * used only if content/darkreader-presets.js was not loaded beforehand.
   */
  const FALLBACK_DARK_THEME_CONFIG = {
    mode: 1,
    brightness: 100,
    contrast: 96,
    grayscale: 0,
    sepia: 0,
    darkSchemeBackgroundColor: '#0F141A',
    darkSchemeTextColor: '#F0F3F6',
    scrollbarColor: 'auto',
    selectionColor: 'auto',
    styleSystemControls: true
  };

  /**
   * Shared Dark Reader DynamicThemeFix rules for Adobe Connect across ALL presets:
   * - Preserves shared slides, PDFs, whiteboards, video streams, screen shares,
   *   and chat color swatches from inline-style or image inversion.
   * - Ignores extension-injected functional stylesheets (chrome-extension://).
   */
  const DARKREADER_DYNAMIC_FIXES = {
    invert: [],
    ignoreCSSUrl: [
      'chrome-extension://',
      'styles/chat-functional.css',
      'styles/chat-colors.css'
    ],
    ignoreInlineStyle: [
      '[class^="chatIndividualMessageContentWrapperDiv--"]',
      '[class*=" chatIndividualMessageContentWrapperDiv--"]',
      '[data-acd-chat-color]',
      '[class*="chatMenuItemColorCode"]',
      '[class*="colorSwatch"]',
      '[class^="shareContent--"]',
      '[class*=" shareContent--"]',
      '[class*="whiteboardWrapper--"]',
      '[class*="wbShapesWrapper--"]',
      '#pdf-viewer',
      '.canvasHTMLPDF',
      '.canvasSingleHTMLPDF',
      '[data-acd-preserve="true"]',
      '.acd-preserve'
    ],
    ignoreImageAnalysis: [
      '[class^="shareContent--"]',
      '[class*=" shareContent--"]',
      '[class*="shareContent--"] *',
      '[class^="pdfLoaderScreen--"] *',
      '[class*=" pdfLoaderScreen--"] *',
      '[class^="pptLoaderScreen--"] *',
      '[class*=" pptLoaderScreen--"] *',
      '[class^="imageLoaderScreen--"] *',
      '[class*=" imageLoaderScreen--"] *',
      '[class^="cptLoaderScreen--"] *',
      '[class*=" cptLoaderScreen--"] *',
      '[class^="screenShareLoader--"] *',
      '[class*=" screenShareLoader--"] *',
      '[class*="whiteboardWrapper--"] *',
      '[class*="wbShapesWrapper--"] *',
      '#pdf-viewer',
      '#pdf-viewer *',
      '.presentation-content',
      '.presentation-content *',
      '.slide-container',
      '.slide-container *',
      '.whiteboard-canvas',
      '.whiteboard-canvas *'
    ],
    css: [
      'video, canvas, img, picture, [data-acd-preserve="true"], .acd-preserve,',
      '.presentation-canvas, .whiteboard-canvas, .shared-content-viewport, .video-stream-element,',
      '[data-ac-role="presentation"], [data-ac-role="whiteboard"], [data-ac-role="screenshare"],',
      '[class^="shareContent--"], [class*=" shareContent--"],',
      '[class^="pdfLoaderScreen--"], [class*=" pdfLoaderScreen--"],',
      '[class^="pptLoaderScreen--"], [class*=" pptLoaderScreen--"],',
      '[class^="imageLoaderScreen--"], [class*=" imageLoaderScreen--"],',
      '[class^="cptLoaderScreen--"], [class*=" cptLoaderScreen--"],',
      '[class^="screenShareLoader--"], [class*=" screenShareLoader--"],',
      '[class^="streamPlayerLoaderScreen--"], [class*=" streamPlayerLoaderScreen--"],',
      '#pdf-viewer, .canvasHTMLPDF, .canvasSingleHTMLPDF,',
      '[class*="shareContent--"] canvas, [class*="whiteboardWrapper--"] canvas, [class*="wbShapesWrapper--"] svg {',
      '  filter: none !important;',
      '  mix-blend-mode: normal !important;',
      '}',
      '[class*="centrePaneAudioDropDownActiveIcon"], [class*="AudioDropDownActiveIcon"] {',
      '  color: #33ab84 !important;',
      '  fill: #33ab84 !important;',
      '}',
      '[class*="centrePaneAudioDropDownInactiveIcon"], [class*="AudioDropDownInactiveIcon"] {',
      '  color: #ec5b62 !important;',
      '  fill: #ec5b62 !important;',
      '}'
    ].join('\n')
  };

  class ACDDarkReaderEngine {
    constructor() {
      this.engineMode = DARK_ENGINE;
      this.active = false;
      this.fetchConfigured = false;
      this.currentPresetId = this.normalizePresetId(window.__ACD_INITIAL_THEME_PRESET__ || DEFAULT_PRESET_ID);
      this.updateDebugState(false);
    }

    /**
     * Normalize any preset identifier safely to a registered preset ID ('dark' fallback)
     */
    normalizePresetId(presetId) {
      const reg = window.ACDThemePresets || presetRegistry;
      if (reg && typeof reg.normalizePresetId === 'function') {
        return reg.normalizePresetId(presetId);
      }
      return DEFAULT_PRESET_ID;
    }

    /**
     * Return active or configured preset ID ('dark' | 'amoled' | 'dim' | 'warm')
     */
    getPreset() {
      return this.currentPresetId || DEFAULT_PRESET_ID;
    }

    /**
     * Return list of available theme presets from the central registry
     */
    getAvailablePresets() {
      const reg = window.ACDThemePresets || presetRegistry;
      if (reg && typeof reg.getAvailablePresets === 'function') {
        return reg.getAvailablePresets();
      }
      return [
        {
          id: DEFAULT_PRESET_ID,
          label: 'Dark',
          description: 'Balanced dark theme',
          theme: { ...FALLBACK_DARK_THEME_CONFIG }
        }
      ];
    }

    /**
     * Return current engine mode ('darkreader' | 'legacy')
     */
    getEngineMode() {
      return window.__ACD_DARK_ENGINE__ || this.engineMode || DARK_ENGINE;
    }

    /**
     * Switch engine mode dynamically (useful for testing/comparison)
     */
    setEngineMode(mode) {
      if (mode !== 'darkreader' && mode !== 'legacy') return;
      this.engineMode = mode;
      window.__ACD_DARK_ENGINE__ = mode;
      window.ACD_DARK_ENGINE = mode;
      this.updateDebugState();
    }

    isDarkReaderEngine() {
      return this.getEngineMode() === 'darkreader';
    }

    isLegacyEngine() {
      return this.getEngineMode() === 'legacy';
    }

    /**
     * Check if official DarkReader global is loaded and available
     */
    isAvailable() {
      return (
        typeof window.DarkReader !== 'undefined' &&
        window.DarkReader !== null &&
        typeof window.DarkReader.enable === 'function' &&
        typeof window.DarkReader.disable === 'function'
      );
    }

    /**
     * Configure DarkReader.setFetchMethod once using window.fetch
     */
    configureFetch() {
      if (this.fetchConfigured || !this.isAvailable()) return;
      if (typeof window.DarkReader.setFetchMethod === 'function' && typeof window.fetch === 'function') {
        try {
          const boundFetch = window.fetch.bind(window);
          window.DarkReader.setFetchMethod((url) => boundFetch(url));
          this.fetchConfigured = true;
        } catch (err) {
          console.warn('[ACD] Failed to configure DarkReader fetch method:', err);
        }
      }
    }

    /**
     * Enable Dark Reader dynamic theme engine with the specified or current preset.
     * Calling enable(presetId) while already active updates Dark Reader in-place without reload.
     */
    enable(presetId) {
      if (presetId !== undefined) {
        this.currentPresetId = this.normalizePresetId(presetId);
      }

      if (!this.isAvailable()) {
        console.warn('[ACD] DarkReader bundle is not available on window.');
        this.updateDebugState(false);
        return false;
      }

      try {
        this.configureFetch();
        const themeConfig = this.getThemeConfig(this.currentPresetId);
        const dynamicFixes = this.getDynamicFixes(this.currentPresetId);
        window.DarkReader.enable(themeConfig, dynamicFixes);
        this.active = true;
        this.updateDebugState(true);
        return true;
      } catch (err) {
        console.error('[ACD] Failed to enable DarkReader:', err);
        this.updateDebugState(false);
        return false;
      }
    }

    /**
     * Update the selected preset.
     * - If Dark Reader is currently active, immediately updates the live theme without reload.
     * - If Dark Reader is currently OFF, stores the preset preference without enabling Dark Mode.
     */
    setPreset(presetId) {
      this.currentPresetId = this.normalizePresetId(presetId);
      if (this.active && this.isDarkReaderEngine()) {
        this.enable(this.currentPresetId);
      } else {
        this.updateDebugState();
      }
      return this.currentPresetId;
    }

    /**
     * Disable Dark Reader dynamic theme engine and clean up its injected styles
     */
    disable() {
      this.active = false;
      if (this.isAvailable()) {
        try {
          window.DarkReader.disable();
        } catch (err) {
          console.warn('[ACD] Error while disabling DarkReader:', err);
        }
      }
      this.updateDebugState(false);
    }

    /**
     * Check if Dark Reader is currently active
     */
    isEnabled() {
      if (!this.active) return false;
      if (this.isAvailable() && typeof window.DarkReader.isEnabled === 'function') {
        return window.DarkReader.isEnabled();
      }
      return this.active;
    }

    /**
     * Return Dark Reader Theme configuration for the given (or active) preset ID
     */
    getThemeConfig(presetId) {
      const targetId = presetId !== undefined
        ? this.normalizePresetId(presetId)
        : this.getPreset();
      const reg = window.ACDThemePresets || presetRegistry;
      if (reg && typeof reg.getPresetThemeConfig === 'function') {
        return reg.getPresetThemeConfig(targetId);
      }
      return { ...FALLBACK_DARK_THEME_CONFIG };
    }

    /**
     * Return shared Adobe Connect DynamicThemeFix configuration.
     * Supports optional future preset-level customCss metadata without duplicating shared fixes.
     */
    getDynamicFixes(presetId) {
      const targetId = presetId !== undefined
        ? this.normalizePresetId(presetId)
        : this.getPreset();
      const reg = window.ACDThemePresets || presetRegistry;
      const preset = reg && typeof reg.getPreset === 'function'
        ? reg.getPreset(targetId)
        : null;

      if (preset && typeof preset.customCss === 'string' && preset.customCss.trim()) {
        return {
          ...DARKREADER_DYNAMIC_FIXES,
          css: `${DARKREADER_DYNAMIC_FIXES.css}\n${preset.customCss.trim()}`
        };
      }
      return { ...DARKREADER_DYNAMIC_FIXES };
    }

    /**
     * Synchronize window.__ACD_DEBUG__ state
     */
    updateDebugState(themeEnabledOverride) {
      const themeEngine = window.__ACD_THEME_ENGINE__;
      const themeEnabled = typeof themeEnabledOverride === 'boolean'
        ? themeEnabledOverride
        : Boolean(themeEngine ? themeEngine.enabled : this.active);

      window.__ACD_DEBUG__ = {
        darkEngine: this.getEngineMode(),
        themeEnabled,
        themePreset: this.getPreset(),
        darkReaderEnabled: Boolean(this.isEnabled())
      };
    }
  }

  window.ACDDarkReaderEngine = ACDDarkReaderEngine;
  window.__ACD_DARKREADER_ENGINE__ = new ACDDarkReaderEngine();
})();
