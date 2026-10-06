/**
 * Adobe Connect Dark Mode - Central Dark Reader Theme Preset Registry
 * Single source of truth for all Dark Reader theme presets.
 *
 * Uses ONLY configuration properties officially supported by darkreader@4.9.133
 * (see node_modules/darkreader/index.d.ts -> DarkReader.Theme).
 *
 * Extensible architecture:
 * Future color themes (e.g. Nord, Dracula, Tokyo Night, Gruvbox) can be added
 * directly to THEME_PRESETS with optional metadata (category, accent, customCss)
 * without modifying popup, storage, or theme-engine logic.
 */

(function () {
  'use strict';

  const rootGlobal = typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof self !== 'undefined' ? self : window);

  if (rootGlobal.ACDThemePresets && rootGlobal.ACD_THEME_PRESETS) {
    return;
  }

  const DEFAULT_PRESET_ID = 'dark';

  /**
   * Official DarkReader.Theme keys supported by darkreader@4.9.133.
   * Filtering through this allowlist guarantees that optional preset metadata
   * (such as future accent, customCss, or category fields) is never passed into
   * DarkReader.enable(), preserving Dark Reader's fast in-place color variable updates.
   */
  const SUPPORTED_DARKREADER_THEME_KEYS = Object.freeze([
    'mode',
    'brightness',
    'contrast',
    'grayscale',
    'sepia',
    'useFont',
    'fontFamily',
    'textStroke',
    'darkSchemeBackgroundColor',
    'darkSchemeTextColor',
    'lightSchemeBackgroundColor',
    'lightSchemeTextColor',
    'scrollbarColor',
    'selectionColor',
    'styleSystemControls'
  ]);

  /**
   * Central Theme Preset Registry
   */
  const THEME_PRESETS = Object.freeze({
    dark: Object.freeze({
      id: 'dark',
      label: 'Dark',
      description: 'Balanced dark theme',
      category: 'core',
      theme: Object.freeze({
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
      })
    }),

    amoled: Object.freeze({
      id: 'amoled',
      label: 'AMOLED',
      description: 'Deep black / OLED',
      category: 'core',
      theme: Object.freeze({
        mode: 1,
        brightness: 96,
        contrast: 100,
        grayscale: 0,
        sepia: 0,
        darkSchemeBackgroundColor: '#000000',
        darkSchemeTextColor: '#F2F5F8',
        scrollbarColor: 'auto',
        selectionColor: 'auto',
        styleSystemControls: true
      })
    }),

    dim: Object.freeze({
      id: 'dim',
      label: 'Dim',
      description: 'Softer dark theme',
      category: 'core',
      theme: Object.freeze({
        mode: 1,
        brightness: 93,
        contrast: 88,
        grayscale: 0,
        sepia: 0,
        darkSchemeBackgroundColor: '#18202A',
        darkSchemeTextColor: '#DCE3EA',
        scrollbarColor: 'auto',
        selectionColor: 'auto',
        styleSystemControls: true
      })
    }),

    warm: Object.freeze({
      id: 'warm',
      label: 'Warm',
      description: 'Warmer night theme',
      category: 'core',
      theme: Object.freeze({
        mode: 1,
        brightness: 97,
        contrast: 94,
        grayscale: 0,
        sepia: 16,
        darkSchemeBackgroundColor: '#161311',
        darkSchemeTextColor: '#EFEAE2',
        scrollbarColor: 'auto',
        selectionColor: 'auto',
        styleSystemControls: true
      })
    })
  });

  const PRESET_ORDER = Object.freeze(Object.keys(THEME_PRESETS));

  /**
   * Check whether a preset ID exists in THEME_PRESETS
   */
  function isValidPresetId(presetId) {
    return (
      typeof presetId === 'string' &&
      Object.prototype.hasOwnProperty.call(THEME_PRESETS, presetId)
    );
  }

  /**
   * Normalize any raw preset value to a valid preset ID, falling back safely to 'dark'
   */
  function normalizePresetId(presetId) {
    if (typeof presetId === 'string') {
      const normalized = presetId.trim().toLowerCase();
      if (isValidPresetId(normalized)) {
        return normalized;
      }
    }
    return DEFAULT_PRESET_ID;
  }

  /**
   * Retrieve a preset definition by ID (falls back safely to 'dark')
   */
  function getPreset(presetId) {
    const resolvedId = normalizePresetId(presetId);
    return THEME_PRESETS[resolvedId] || THEME_PRESETS[DEFAULT_PRESET_ID];
  }

  /**
   * Extract a pure DarkReader.Theme configuration object for the given preset ID
   */
  function getPresetThemeConfig(presetId) {
    const preset = getPreset(presetId);
    const rawTheme = (preset && preset.theme) || THEME_PRESETS[DEFAULT_PRESET_ID].theme;
    const cleanConfig = {};
    for (let i = 0; i < SUPPORTED_DARKREADER_THEME_KEYS.length; i++) {
      const key = SUPPORTED_DARKREADER_THEME_KEYS[i];
      if (rawTheme[key] !== undefined) {
        cleanConfig[key] = rawTheme[key];
      }
    }
    return cleanConfig;
  }

  /**
   * Return all available presets in registry order as plain objects
   */
  function getAvailablePresets() {
    return PRESET_ORDER.map((id) => {
      const p = THEME_PRESETS[id];
      const entry = {
        id: p.id,
        label: p.label,
        description: p.description,
        theme: { ...p.theme }
      };
      if (p.category !== undefined) entry.category = p.category;
      if (p.accent !== undefined) entry.accent = p.accent;
      if (p.customCss !== undefined) entry.customCss = p.customCss;
      return entry;
    });
  }

  const registryApi = Object.freeze({
    DEFAULT_PRESET_ID,
    THEME_PRESETS,
    PRESET_ORDER,
    SUPPORTED_DARKREADER_THEME_KEYS,
    isValidPresetId,
    normalizePresetId,
    getPreset,
    getPresetThemeConfig,
    getAvailablePresets
  });

  rootGlobal.ACD_THEME_PRESETS = THEME_PRESETS;
  rootGlobal.ACDThemePresets = registryApi;
})();
