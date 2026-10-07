/**
 * Adobe Connect Dark Mode — Offline Visual Regression Test Runner
 * Runs headless Chrome via CDP against tests/visual/adobe-fixture.html
 * across:
 *   1. native-light (?engine=none&dark=0&rtl=0&twoRow=0&sendRtl=0)
 *   2. legacy-dark  (?engine=legacy&dark=1&rtl=1&twoRow=1&sendRtl=1)
 *   3. darkreader-dark (?engine=darkreader&dark=1&rtl=1&twoRow=1&sendRtl=1)
 *   4. Feature-switch variations (twoRow=0 single-row, rtl=0, dark=0)
 *
 * Produces:
 *   - Full viewport screenshots (1440x900) and narrow viewport screenshots (900x700)
 *   - Focused component screenshots (chat, menus, modal, toolbar, media)
 *   - tests/visual/computed-styles-report.json
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const REPORT_JSON_PATH = path.join(__dirname, 'computed-styles-report.json');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, 'http://127.0.0.1');
      const relPath = decodeURIComponent(reqUrl.pathname).replace(/^\/+/, '');
      const filePath = path.join(ROOT_DIR, relPath);
      if (!filePath.startsWith(ROOT_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Content-Security-Policy': "script-src 'self'"
      });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function findBrowserExecutable() {
  const candidates = [
    'C:/Users/Azizi/AppData/Local/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Could not find Chrome or Edge executable for headless visual tests.');
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.seq = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        this.consoleErrors.push(
          (msg.params.args || []).map((a) => a.value || a.description || '').join(' ')
        );
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(
          msg.params?.exceptionDetails?.text || 'Uncaught exception'
        );
      }
    };
  }

  async connect() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
  }

  async screenshotFull(outFile) {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false
    });
    fs.writeFileSync(outFile, Buffer.from(data, 'base64'));
  }

  async screenshotSelector(selector, outFile) {
    const rect = await this.evalJs(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)), width: Math.ceil(r.width), height: Math.ceil(r.height) };
    })()`);
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scale: 1
      }
    });
    fs.writeFileSync(outFile, Buffer.from(data, 'base64'));
    return true;
  }

  close() {
    this.ws.close();
  }
}

async function launchHeadlessBrowser(chromePath, debugPort) {
  const userDataDir = path.join(__dirname, '.tmp-chrome-profile-' + debugPort);
  fs.rmSync(userDataDir, { recursive: true, force: true });
  const proc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 150));
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const list = await res.json();
      const pageTarget = list.find((t) => t.type === 'page');
      if (pageTarget?.webSocketDebuggerUrl) {
        wsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch (_) {
      // wait for chrome debug server
    }
  }
  if (!wsUrl) {
    proc.kill();
    throw new Error('Failed to connect to headless Chrome CDP port ' + debugPort);
  }
  return {
    proc,
    wsUrl,
    cleanup: () => {
      try { proc.kill(); } catch (_) {}
      setTimeout(() => {
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
      }, 300);
    }
  };
}

/**
 * In-page inspection script to collect computed styles, media safety checks, and functional assertions
 */
const COLLECT_PAGE_REPORT_EXPR = `(() => {
  const PROPS = [
    'background-color',
    'color',
    'border-color',
    'box-shadow',
    'filter',
    'direction',
    'unicode-bidi',
    'display',
    'opacity',
    'mix-blend-mode'
  ];

  function readStyles(selectorOrEl) {
    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    const out = {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      inlineBackground: el.style?.backgroundColor || null,
      acdSurface: el.getAttribute('data-acd-surface'),
      acdText: el.getAttribute('data-acd-text'),
      acdChatColor: el.getAttribute('data-acd-chat-color'),
      acdBidiDir: el.getAttribute('data-acd-bidi-dir'),
      colorOrigin: el.getAttribute('data-color-origin')
    };
    for (const p of PROPS) {
      out[p] = cs.getPropertyValue(p);
    }
    return out;
  }

  const TARGETS = {
    htmlRoot: 'html',
    body: 'body',
    mainFrame: '.main-app-frame',
    chatBubble: '#bubble-color-default',
    chatBubbleSelf: '#bubble-color-green',
    chatMessageRtl: '#msg-rtl',
    chatMessageMixed1: '#msg-mixed-1',
    chatMessageMixed2: '#msg-mixed-2',
    chatMessageLtr: '#msg-ltr',
    sender: '#test-chat-sender',
    composer: '#chatTypingArea',
    sendButton: '#sendButton',
    selectedTab: '#test-selected-tab',
    popover: '#test-popover',
    colorPopover: '#test-color-popover',
    connectionStatus: '#test-connection-status',
    modal: '#test-modal',
    modalHeader: '.spectrum-Dialog-header',
    modalPromotionStep: '.stepDiv--3vFpC9lhdTf1xYFiSRqLxk',
    underlay: '#test-underlay',
    toastNeutral: '#test-toast-neutral',
    toastStatus: '#test-toast-status',
    toolbar: '#test-toolbar',
    podHeaderChat: '#connectPod2 .podPrimaryBar--2Vw6SaEid6wE12N5XtMSBR',
    attendeeRow: '.attendeeItem--1L-N1xIcV65SuDXMPf-JYo',
    video: '#test-video',
    canvas: '#test-canvas',
    image: '#test-image',
    pdfCanvas: '#test-pdf-canvas',
    shareContent: '#test-share-content',
    screenshareCanvas: '#test-screenshare-canvas',
    whiteboard: '#test-whiteboard'
  };

  const computedStyles = {};
  for (const [key, sel] of Object.entries(TARGETS)) {
    computedStyles[key] = readStyles(sel);
  }

  // Also capture all 9 chat bubble color swatches (bubble, sender, time, text)
  const chatColorBubbles = {};
  const colorIds = [
    'bubble-color-default',
    'bubble-color-red',
    'bubble-color-orange',
    'bubble-color-green',
    'bubble-color-brown',
    'bubble-color-purple',
    'bubble-color-pink',
    'bubble-color-blue',
    'bubble-color-grey'
  ];
  for (const id of colorIds) {
    const el = document.getElementById(id);
    if (el) {
      const senderSpan = el.querySelector('.chatMessageSender--DWciMGe1kN4RIucfuWC0f');
      const timeSpan = el.querySelector('.chatMessageTime--mfT0iWBdHWhH_u8MKaTqn');
      const textSpan = el.querySelector('.chatIndividualMessageContent--ZoTO-kllP1-hUR76ZCyod');
      chatColorBubbles[id] = {
        bubble: readStyles(el),
        sender: readStyles(senderSpan),
        time: readStyles(timeSpan),
        text: readStyles(textSpan)
      };
    }
  }

  // Media Safety Assertions (Section 14)
  const mediaTargets = [
    { name: 'video', sel: '#test-video' },
    { name: 'canvas', sel: '#test-canvas' },
    { name: 'pdfCanvas', sel: '#test-pdf-canvas' },
    { name: 'shareContent', sel: '#test-share-content' },
    { name: 'screenshareCanvas', sel: '#test-screenshare-canvas' },
    { name: 'whiteboard', sel: '#test-whiteboard' }
  ];
  const mediaSafety = {};
  let allMediaSafe = true;
  for (const m of mediaTargets) {
    const st = readStyles(m.sel);
    if (!st) {
      mediaSafety[m.name] = { present: false, safe: false };
      allMediaSafe = false;
      continue;
    }
    const hasInvert = st.filter.includes('invert');
    const hasBrightness = st.filter.includes('brightness');
    const unexpectedOpacity = parseFloat(st.opacity) !== 1;
    const unexpectedBlend = st['mix-blend-mode'] !== 'normal';
    const safe = !hasInvert && !hasBrightness && !unexpectedOpacity && !unexpectedBlend;
    if (!safe) allMediaSafe = false;
    mediaSafety[m.name] = {
      present: true,
      filter: st.filter,
      opacity: st.opacity,
      mixBlendMode: st['mix-blend-mode'],
      hasInvert,
      hasBrightness,
      unexpectedOpacity,
      unexpectedBlend,
      safe
    };
  }

  // Functional & Architectural Assertions (Section 15)
  const srHost = document.getElementById('test-shadow-host');
  const srMsg = srHost?.shadowRoot?.getElementById('shadow-msg-rtl');
  const srBubble = srHost?.shadowRoot?.getElementById('shadow-bubble');
  const srBubbleCs = srBubble ? window.getComputedStyle(srBubble) : null;
  const chatColorsLink = document.getElementById('acd-style-styles-chat-colors-css');
  const nextSiblingAfterChatColors = chatColorsLink?.nextElementSibling;
  const chatColorsManagedByDarkReader = Boolean(
    nextSiblingAfterChatColors &&
    nextSiblingAfterChatColors.classList &&
    nextSiblingAfterChatColors.classList.contains('darkreader--sync')
  );

  const functionalAssertions = {
    engineGlobal: window.__ACD_DARK_ENGINE__,
    debugState: window.__ACD_DEBUG__ ? { ...window.__ACD_DEBUG__ } : null,
    themeEngineEnabled: window.__ACD_THEME_ENGINE__ ? window.__ACD_THEME_ENGINE__.enabled : null,
    themeEnginePreset: window.__ACD_THEME_ENGINE__ && typeof window.__ACD_THEME_ENGINE__.getThemePreset === 'function'
      ? window.__ACD_THEME_ENGINE__.getThemePreset()
      : null,
    darkReaderActive: window.__ACD_DARKREADER_ENGINE__ ? window.__ACD_DARKREADER_ENGINE__.isEnabled() : false,
    darkReaderPreset: window.__ACD_DARKREADER_ENGINE__ && typeof window.__ACD_DARKREADER_ENGINE__.getPreset === 'function'
      ? window.__ACD_DARKREADER_ENGINE__.getPreset()
      : null,
    availablePresets: window.__ACD_DARKREADER_ENGINE__ && typeof window.__ACD_DARKREADER_ENGINE__.getAvailablePresets === 'function'
      ? window.__ACD_DARKREADER_ENGINE__.getAvailablePresets().map((p) => p.id)
      : null,
    darkReaderStyleTagCount: document.querySelectorAll('style.darkreader').length,
    functionalCssLoaded: !!document.getElementById('acd-style-styles-chat-functional-css'),
    chatColorsCssLoaded: !!chatColorsLink,
    chatColorsCssIgnoredByDarkReader: chatColorsLink ? !chatColorsManagedByDarkReader : null,
    legacyVariablesCssLoaded: !!document.getElementById('acd-style-styles-variables-css'),
    legacyBaseCssLoaded: !!document.getElementById('acd-style-styles-base-css'),
    legacyAdobeConnectCssLoaded: !!document.getElementById('acd-style-styles-adobe-connect-css'),
    legacyComponentsCssLoaded: !!document.getElementById('acd-style-styles-components-css'),
    acdSurfaceCount: document.querySelectorAll('[data-acd-surface]').length,
    acdTextCount: document.querySelectorAll('[data-acd-text]').length,
    acdChatColorCount: document.querySelectorAll('[data-acd-chat-color]').length,
    htmlAttributes: {
      theme: document.documentElement.getAttribute('data-acd-theme'),
      themePreset: document.documentElement.getAttribute('data-acd-theme-preset'),
      engine: document.documentElement.getAttribute('data-acd-engine'),
      chatRtl: document.documentElement.getAttribute('data-acd-chat-rtl'),
      chatTwoRow: document.documentElement.getAttribute('data-acd-chat-two-row'),
      sendRtl: document.documentElement.getAttribute('data-acd-send-rtl-formatting')
    },
    rtlMsgBidiDir: document.getElementById('msg-rtl')?.getAttribute('data-acd-bidi-dir'),
    mixed1MsgBidiDir: document.getElementById('msg-mixed-1')?.getAttribute('data-acd-bidi-dir'),
    mixed2MsgBidiDir: document.getElementById('msg-mixed-2')?.getAttribute('data-acd-bidi-dir'),
    ltrMsgBidiDir: document.getElementById('msg-ltr')?.getAttribute('data-acd-bidi-dir'),
    twoRowWrapperDisplay: computedStyles.chatBubble?.display,
    shadowDomDiscovered: srHost?.shadowRoot ? !!srHost.shadowRoot.getElementById('acd-shadow-functional-style') : false,
    shadowDomChatColorStyleLoaded: srHost?.shadowRoot ? !!srHost.shadowRoot.getElementById('acd-shadow-chat-color-style') : false,
    shadowDomChatColorAttr: srBubble?.getAttribute('data-acd-chat-color') || null,
    shadowDomRtlBidiDir: srMsg?.getAttribute('data-acd-bidi-dir') || null,
    shadowDomTwoRowDisplay: srBubbleCs ? srBubbleCs.display : null,
    proxyScriptCount: document.querySelectorAll('script.darkreader--proxy').length,
    cspViolations: Array.isArray(window.__ACD_CSP_VIOLATIONS__) ? window.__ACD_CSP_VIOLATIONS__ : []
  };

  return {
    computedStyles,
    chatColorBubbles,
    mediaSafety: { allMediaSafe, items: mediaSafety },
    functionalAssertions
  };
})()`;

async function runMode(cdp, baseUrl, modeConfig) {
  const {
    name,
    query,
    fullScreenshotName,
    narrowScreenshotName,
    componentPrefix,
    runDynamicAndStress,
    toggleOffAfterLoad
  } = modeConfig;

  console.log(`\n=== Running Visual Mode: ${name} (${query}) ===`);
  cdp.consoleErrors = [];
  await cdp.setViewport(1440, 900);

  const targetUrl = `${baseUrl}/tests/visual/adobe-fixture.html${query}`;
  await cdp.send('Page.navigate', { url: targetUrl });

  // Wait for window.__ACD_FIXTURE_READY__
  for (let i = 0; i < 50; i++) {
    const ready = await cdp.evalJs('window.__ACD_FIXTURE_READY__ === true');
    if (ready) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  // Extra settle time for fonts and Dark Reader async stylesheet analysis
  await new Promise((r) => setTimeout(r, 600));

  if (toggleOffAfterLoad) {
    await cdp.evalJs('window.__ACD_THEME_ENGINE__.removeDarkTheme()');
    await new Promise((r) => setTimeout(r, 300));
  }

  // 1. Capture 1440x900 full screenshot
  if (fullScreenshotName) {
    const fullPath = path.join(SCREENSHOTS_DIR, fullScreenshotName);
    await cdp.screenshotFull(fullPath);
    console.log(`  Saved 1440x900 screenshot: ${fullScreenshotName}`);
  }

  // 2. Capture focused component screenshots at 1440x900
  if (componentPrefix) {
    const components = [
      { key: 'toolbar', sel: '#region-toolbar' },
      { key: 'chat', sel: '#region-chat' },
      { key: 'media', sel: '#region-media' },
      { key: 'menus', sel: '#region-menus' },
      { key: 'modal', sel: '#region-modal' }
    ];
    for (const comp of components) {
      const file = `${componentPrefix}-${comp.key}.png`;
      await cdp.screenshotSelector(comp.sel, path.join(SCREENSHOTS_DIR, file));
      console.log(`  Saved component screenshot: ${file}`);
    }
  }

  // 3. Collect computed styles, media safety, and functional assertions
  const report = await cdp.evalJs(COLLECT_PAGE_REPORT_EXPR);

  // 4. Capture 900x700 narrow viewport screenshot
  if (narrowScreenshotName) {
    await cdp.setViewport(900, 700);
    await new Promise((r) => setTimeout(r, 250));
    const narrowPath = path.join(SCREENSHOTS_DIR, narrowScreenshotName);
    await cdp.screenshotFull(narrowPath);
    console.log(`  Saved 900x700 narrow screenshot: ${narrowScreenshotName}`);
    await cdp.setViewport(1440, 900);
    await new Promise((r) => setTimeout(r, 150));
  }

  // 5. Run Dynamic Mutation Test & 120-Message Stress Test if requested
  let mutationTestResult = null;
  let stressTestResult = null;
  if (runDynamicAndStress) {
    await cdp.evalJs('window.__ACD_TEST_LAB__.runDynamicMutations()');
    await new Promise((r) => setTimeout(r, 400));
    mutationTestResult = await cdp.evalJs(`(() => {
      const readBg = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          inlineBackground: el.style?.backgroundColor || null,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          acdSurface: el.getAttribute('data-acd-surface'),
          acdChatColor: el.getAttribute('data-acd-chat-color'),
          bidiDir: el.getAttribute('data-acd-bidi-dir')
        };
      };
      return {
        dynamicChatBubble: readBg('dynamic-chat-bubble'),
        dynamicChatText: readBg('dynamic-chat-text'),
        updatedColorBubble: readBg('bubble-color-default'),
        dynamicPopover: readBg('dynamic-popover'),
        dynamicToast: readBg('dynamic-toast'),
        dynamicModal: readBg('dynamic-modal')
      };
    })()`);
    console.log(`  Completed Dynamic SPA Mutation Test for ${name}`);

    stressTestResult = await cdp.evalJs('window.__ACD_TEST_LAB__.runStressTest(120)');
    stressTestResult.consoleErrorsAfterStress = [...cdp.consoleErrors];
    console.log(`  Completed 120-Message Stress Test for ${name}:`, JSON.stringify(stressTestResult));
  }

  report.consoleErrors = [...cdp.consoleErrors];
  report.mutationTest = mutationTestResult;
  report.stressTest = stressTestResult;
  return report;
}

async function runLivePresetSwitchingTest(cdp, baseUrl) {
  console.log('\n=== Running Live Preset Switching Test (Dark -> AMOLED -> Dim -> Warm -> Dark without reload) ===');
  cdp.consoleErrors = [];
  await cdp.setViewport(1440, 900);

  const targetUrl = `${baseUrl}/tests/visual/adobe-fixture.html?engine=darkreader&preset=dark&dark=1&rtl=1&twoRow=1&sendRtl=1`;
  await cdp.send('Page.navigate', { url: targetUrl });

  for (let i = 0; i < 50; i++) {
    const ready = await cdp.evalJs('window.__ACD_FIXTURE_READY__ === true');
    if (ready) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  await new Promise((r) => setTimeout(r, 600));

  // Tag window with a unique token to prove no page reload occurred during the entire sequence
  await cdp.evalJs('window.__ACD_NO_RELOAD_TOKEN__ = "live-session-verified"');

  const sequence = ['dark', 'amoled', 'dim', 'warm', 'dark'];
  const steps = [];

  for (let idx = 0; idx < sequence.length; idx++) {
    const presetId = sequence[idx];
    if (idx > 0) {
      await cdp.evalJs(`window.__ACD_THEME_ENGINE__.setThemePreset(${JSON.stringify(presetId)})`);
      await new Promise((r) => setTimeout(r, 150));
    }

    const snapshot = await cdp.evalJs(`(() => {
      const cs = (sel) => {
        const el = document.querySelector(sel);
        return el ? window.getComputedStyle(el) : null;
      };
      const htmlCs = cs('html');
      const bodyCs = cs('body');
      const toolbarCs = cs('#test-toolbar');
      const modalCs = cs('#test-modal');
      const popoverCs = cs('#test-popover');
      const defaultBubble = document.getElementById('bubble-color-default');
      const redBubble = document.getElementById('bubble-color-red');
      const greenBubble = document.getElementById('bubble-color-green');
      const videoCs = cs('#test-video');
      const pdfCs = cs('#test-pdf-canvas');

      return {
        stepIndex: ${idx},
        requestedPreset: ${JSON.stringify(presetId)},
        noReloadToken: window.__ACD_NO_RELOAD_TOKEN__,
        debugState: window.__ACD_DEBUG__ ? { ...window.__ACD_DEBUG__ } : null,
        htmlThemeAttr: document.documentElement.getAttribute('data-acd-theme'),
        htmlPresetAttr: document.documentElement.getAttribute('data-acd-theme-preset'),
        htmlChatRtlAttr: document.documentElement.getAttribute('data-acd-chat-rtl'),
        htmlSendRtlAttr: document.documentElement.getAttribute('data-acd-send-rtl-formatting'),
        htmlTwoRowAttr: document.documentElement.getAttribute('data-acd-chat-two-row'),
        msgRtlBidiDir: document.getElementById('msg-rtl')?.getAttribute('data-acd-bidi-dir'),
        htmlBg: htmlCs ? htmlCs.backgroundColor : null,
        bodyBg: bodyCs ? bodyCs.backgroundColor : null,
        toolbarBg: toolbarCs ? toolbarCs.backgroundColor : null,
        modalBg: modalCs ? modalCs.backgroundColor : null,
        modalColor: modalCs ? modalCs.color : null,
        popoverBg: popoverCs ? popoverCs.backgroundColor : null,
        defaultBubbleChatColor: defaultBubble?.getAttribute('data-acd-chat-color'),
        defaultBubbleBg: defaultBubble ? window.getComputedStyle(defaultBubble).backgroundColor : null,
        redBubbleChatColor: redBubble?.getAttribute('data-acd-chat-color'),
        redBubbleBg: redBubble ? window.getComputedStyle(redBubble).backgroundColor : null,
        greenBubbleChatColor: greenBubble?.getAttribute('data-acd-chat-color'),
        greenBubbleBg: greenBubble ? window.getComputedStyle(greenBubble).backgroundColor : null,
        videoFilter: videoCs ? videoCs.filter : null,
        pdfFilter: pdfCs ? pdfCs.filter : null,
        darkReaderStyleCount: document.querySelectorAll('style.darkreader').length,
        proxyScriptCount: document.querySelectorAll('script.darkreader--proxy').length,
        cspViolations: Array.isArray(window.__ACD_CSP_VIOLATIONS__) ? window.__ACD_CSP_VIOLATIONS__ : []
      };
    })()`);

    steps.push(snapshot);
  }

  // Test invalid preset fallback and Light Mode preset change without darkening
  const fallbackAndLightModeChecks = await cdp.evalJs(`(() => {
    // 1. Invalid preset fallback while Dark Mode is ON
    const resolvedInvalid = window.__ACD_THEME_ENGINE__.setThemePreset('unknown-theme');
    const debugAfterInvalid = { ...window.__ACD_DEBUG__ };
    const htmlPresetAttrAfterInvalid = document.documentElement.getAttribute('data-acd-theme-preset');
    const htmlBgAfterInvalid = window.getComputedStyle(document.documentElement).backgroundColor;

    // 2. Disable Dark Mode (Light mode)
    window.__ACD_THEME_ENGINE__.removeDarkTheme();
    const debugInLightMode = { ...window.__ACD_DEBUG__ };

    // 3. Change preset while Dark Mode is OFF (should save preference without darkening page)
    window.__ACD_THEME_ENGINE__.setThemePreset('amoled');
    const debugAfterPresetChangeWhileOff = { ...window.__ACD_DEBUG__ };
    const darkReaderStylesWhileOff = document.querySelectorAll('style.darkreader').length;
    const toolbarBgWhileOff = window.getComputedStyle(document.querySelector('#test-toolbar')).backgroundColor;

    // 4. Re-enable Dark Mode -> selected 'amoled' preset becomes active immediately
    window.__ACD_THEME_ENGINE__.applyDarkTheme();
    const debugAfterReEnable = { ...window.__ACD_DEBUG__ };
    const htmlBgAfterReEnable = window.getComputedStyle(document.documentElement).backgroundColor;

    return {
      invalidPresetFallback: {
        returnedPreset: resolvedInvalid,
        debugState: debugAfterInvalid,
        htmlPresetAttr: htmlPresetAttrAfterInvalid,
        htmlBg: htmlBgAfterInvalid
      },
      lightModePresetChange: {
        debugInLightMode,
        debugAfterPresetChangeWhileOff,
        darkReaderStylesWhileOff,
        toolbarBgWhileOff,
        debugAfterReEnable,
        htmlBgAfterReEnable
      }
    };
  })()`);

  return {
    sequence,
    steps,
    fallbackAndLightModeChecks,
    consoleErrors: [...cdp.consoleErrors]
  };
}

async function main() {
  const { server, port } = await startStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const chromePath = findBrowserExecutable();
  console.log(`Started local fixture server at ${baseUrl}`);
  console.log(`Using headless browser: ${chromePath}`);

  const { wsUrl, cleanup } = await launchHeadlessBrowser(chromePath, 9339);
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();

  try {
    const results = {
      timestamp: new Date().toISOString(),
      viewportsTested: ['1440x900', '900x700'],
      modes: {},
      livePresetSwitching: null
    };

    // Mode 1: Native Light Mode
    results.modes.nativeLight = await runMode(cdp, baseUrl, {
      name: 'native-light',
      query: '?engine=none&dark=0&rtl=0&twoRow=0&sendRtl=0',
      fullScreenshotName: 'native-light.png',
      narrowScreenshotName: 'native-light-narrow.png',
      componentPrefix: 'light',
      runDynamicAndStress: false
    });

    // Mode 2: Legacy v1.8.5 Dark Mode
    results.modes.legacyDark = await runMode(cdp, baseUrl, {
      name: 'legacy-dark',
      query: '?engine=legacy&dark=1&rtl=1&twoRow=1&sendRtl=1',
      fullScreenshotName: 'legacy-dark.png',
      narrowScreenshotName: 'legacy-dark-narrow.png',
      componentPrefix: 'legacy',
      runDynamicAndStress: true
    });

    // Mode 3: Dark Reader Preset 1 — Dark (default)
    results.modes.darkreaderDark = await runMode(cdp, baseUrl, {
      name: 'darkreader-dark',
      query: '?engine=darkreader&preset=dark&dark=1&rtl=1&twoRow=1&sendRtl=1',
      fullScreenshotName: 'darkreader-dark.png',
      narrowScreenshotName: 'darkreader-dark-narrow.png',
      componentPrefix: 'darkreader',
      runDynamicAndStress: true
    });

    // Mode 4: Dark Reader Preset 2 — AMOLED
    results.modes.darkreaderAmoled = await runMode(cdp, baseUrl, {
      name: 'darkreader-amoled',
      query: '?engine=darkreader&preset=amoled&dark=1&rtl=1&twoRow=1&sendRtl=1',
      fullScreenshotName: 'darkreader-amoled.png',
      narrowScreenshotName: 'darkreader-amoled-narrow.png',
      componentPrefix: 'amoled',
      runDynamicAndStress: false
    });

    // Mode 5: Dark Reader Preset 3 — Dim
    results.modes.darkreaderDim = await runMode(cdp, baseUrl, {
      name: 'darkreader-dim',
      query: '?engine=darkreader&preset=dim&dark=1&rtl=1&twoRow=1&sendRtl=1',
      fullScreenshotName: 'darkreader-dim.png',
      narrowScreenshotName: 'darkreader-dim-narrow.png',
      componentPrefix: 'dim',
      runDynamicAndStress: false
    });

    // Mode 6: Dark Reader Preset 4 — Warm
    results.modes.darkreaderWarm = await runMode(cdp, baseUrl, {
      name: 'darkreader-warm',
      query: '?engine=darkreader&preset=warm&dark=1&rtl=1&twoRow=1&sendRtl=1',
      fullScreenshotName: 'darkreader-warm.png',
      narrowScreenshotName: 'darkreader-warm-narrow.png',
      componentPrefix: 'warm',
      runDynamicAndStress: false
    });

    // Mode 7: Feature Switch Verification (Single-Row twoRow=0 & RTL ON in Dark Reader mode)
    results.modes.darkreaderSingleRow = await runMode(cdp, baseUrl, {
      name: 'darkreader-single-row',
      query: '?engine=darkreader&preset=dark&dark=1&rtl=1&twoRow=0&sendRtl=0',
      fullScreenshotName: null,
      narrowScreenshotName: null,
      componentPrefix: null,
      runDynamicAndStress: false
    });

    // Mode 8: Light Mode Cleanup Verification (Dark Reader enabled then toggled OFF via removeDarkTheme())
    results.modes.darkreaderLightToggleOff = await runMode(cdp, baseUrl, {
      name: 'darkreader-light-toggle-off',
      query: '?engine=darkreader&preset=dark&dark=1&rtl=1&twoRow=1&sendRtl=1',
      fullScreenshotName: null,
      narrowScreenshotName: null,
      componentPrefix: null,
      runDynamicAndStress: false,
      toggleOffAfterLoad: true
    });

    // Live Preset Switching + Fallback + Light Mode Preset Preference Test
    results.livePresetSwitching = await runLivePresetSwitchingTest(cdp, baseUrl);

    fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\nWrote computed styles and assertions report to: ${REPORT_JSON_PATH}`);
  } finally {
    cdp.close();
    cleanup();
    server.close();
  }
}

main().catch((err) => {
  console.error('Fatal error in run-visual-tests.mjs:', err);
  process.exit(1);
});
