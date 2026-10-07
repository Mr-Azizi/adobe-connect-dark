/**
 * Adobe Connect 11.2 — Offline Visual Regression Test Lab Controller
 * Deterministic initialization for:
 *   ?engine=darkreader | legacy | none
 *   &dark=1|0
 *   &rtl=1|0
 *   &twoRow=1|0
 *   &sendRtl=1|0
 * Also exposes window.__ACD_TEST_LAB__ for dynamic mutation and 100+ message stress tests.
 */

(function () {
  'use strict';

  window.__ACD_CSP_VIOLATIONS__ = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__ACD_CSP_VIOLATIONS__.push({
      blockedURI: e.blockedURI,
      violatedDirective: e.violatedDirective,
      sourceFile: e.sourceFile,
      lineNumber: e.lineNumber
    });
  });

  const params = new URLSearchParams(window.location.search);
  const engineParam = (params.get('engine') || 'darkreader').toLowerCase();
  const presetParam = params.get('preset') || 'dark';
  const darkParam = params.get('dark') !== null
    ? params.get('dark') !== '0' && params.get('dark') !== 'false'
    : engineParam !== 'none';
  const rtlParam = params.get('rtl') !== null
    ? params.get('rtl') !== '0' && params.get('rtl') !== 'false'
    : true;
  const twoRowParam = params.get('twoRow') !== null
    ? params.get('twoRow') !== '0' && params.get('twoRow') !== 'false'
    : true;
  const sendRtlParam = params.get('sendRtl') !== null
    ? params.get('sendRtl') !== '0' && params.get('sendRtl') !== 'false'
    : true;

  // Set global engine switch BEFORE theme-engine.js initializes
  window.__ACD_DARK_ENGINE__ = engineParam === 'legacy' ? 'legacy' : 'darkreader';

  // Draw deterministic RGB reference patterns on canvases so any accidental inversion/recoloring is immediately visible
  function paintReferenceCanvases() {
    const drawBars = (canvasId, title) => {
      const canvas = document.getElementById(canvasId);
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      // White, Red, Green, Blue, Yellow, Black reference bars
      const colors = ['#ffffff', '#ff0000', '#00cc44', '#0066ff', '#ffcc00', '#111111'];
      const barW = w / colors.length;
      colors.forEach((c, idx) => {
        ctx.fillStyle = c;
        ctx.fillRect(idx * barW, 0, barW, h);
      });
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(title, 8, h - 10);
    };

    drawBars('test-canvas', 'CANVAS RGB');
    drawBars('test-pdf-canvas', 'PDF SLIDE');
    drawBars('test-screenshare-canvas', 'SCREENSHARE');
  }

  // Attach Open Shadow Root with realistic chat message markup for Shadow DOM verification
  function initShadowRootFixture() {
    const host = document.getElementById('test-shadow-host');
    if (!host || host.shadowRoot) return;
    const sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = `
      <div class="chatIndividualMessage--IntdQwOo-jr9XRxDxKbH3">
        <div id="shadow-bubble" class="chatIndividualMessageContentWrapperDiv--3_-ljsHfbddoYb57h1tELa" style="background-color: rgb(245, 245, 245);">
          <span class="chatMessageSender--DWciMGe1kN4RIucfuWC0f">کاربر شدو: </span>
          <span class="chatMessageTime--mfT0iWBdHWhH_u8MKaTqn">10:15</span>
          <span id="shadow-msg-rtl" class="chatIndividualMessageContent--ZoTO-kllP1-hUR76ZCyod">پیام فارسی داخل Shadow DOM</span>
        </div>
      </div>
    `;
  }

  paintReferenceCanvases();
  initShadowRootFixture();

  // Expose helper API for automated runner & interactive inspection
  window.__ACD_TEST_LAB__ = {
    config: {
      engine: engineParam,
      preset: presetParam,
      dark: darkParam,
      rtl: rtlParam,
      twoRow: twoRowParam,
      sendRtl: sendRtlParam
    },

    applyConfiguredState() {
      const te = window.__ACD_THEME_ENGINE__;
      if (!te) return false;

      if (engineParam === 'legacy') {
        window.__ACD_DARK_ENGINE__ = 'legacy';
        te.darkEngine = 'legacy';
      } else {
        window.__ACD_DARK_ENGINE__ = 'darkreader';
        te.darkEngine = 'darkreader';
      }

      if (typeof te.setThemePreset === 'function') {
        te.setThemePreset(presetParam);
      }

      if (darkParam && engineParam !== 'none') {
        te.applyDarkTheme(presetParam);
      } else {
        te.removeDarkTheme();
      }

      if (rtlParam) {
        te.applyChatRtl(sendRtlParam);
      } else {
        te.removeChatRtl();
      }

      if (twoRowParam) {
        te.applyChatTwoRow();
      } else {
        te.removeChatTwoRow();
      }

      return true;
    },

    /**
     * Section 16: Simulate dynamic SPA mutations after initial page load
     */
    runDynamicMutations() {
      const chatArea = document.getElementById('chatContentArea');
      const menusRegion = document.getElementById('region-menus');
      const toastsRegion = document.getElementById('region-toasts');
      const modalRegion = document.getElementById('region-modal');

      // 1. Append a new chat message dynamically
      const newMsg = document.createElement('div');
      newMsg.className = 'chatIndividualMessage--IntdQwOo-jr9XRxDxKbH3';
      newMsg.id = 'dynamic-chat-msg-wrapper';
      newMsg.innerHTML = `
        <div id="dynamic-chat-bubble" class="chatIndividualMessageContentWrapperDiv--3_-ljsHfbddoYb57h1tELa" style="background-color: rgb(245, 245, 245);">
          <span class="chatMessageSender--DWciMGe1kN4RIucfuWC0f">کاربر پویا: </span>
          <span class="chatMessageTime--mfT0iWBdHWhH_u8MKaTqn">10:30</span>
          <span id="dynamic-chat-text" class="chatIndividualMessageContent--ZoTO-kllP1-hUR76ZCyod">پیام جدید اضافه شده با MutationObserver</span>
        </div>
      `;
      chatArea.appendChild(newMsg);

      // 2. Change an existing chat bubble inline background dynamically
      const defaultBubble = document.getElementById('bubble-color-default');
      if (defaultBubble) {
        defaultBubble.style.backgroundColor = 'rgb(228, 215, 242)'; // change to purple pastel
      }

      // 3. Open/insert a new menu dynamically
      const dynMenu = document.createElement('div');
      dynMenu.id = 'dynamic-popover';
      dynMenu.className = 'spectrum-Popover react-spectrum-Popover spectrum-Popover--bottom is-open';
      dynMenu.style.backgroundColor = 'rgb(255, 255, 255)';
      dynMenu.innerHTML = `
        <ul class="spectrum-Menu" role="menu">
          <li class="spectrum-Menu-item" role="menuitem">Dynamic Menu Option 1</li>
        </ul>
      `;
      menusRegion.appendChild(dynMenu);

      // 4. Insert a toast dynamically
      const dynToast = document.createElement('div');
      dynToast.id = 'dynamic-toast';
      dynToast.className = 'spectrum-Toast';
      dynToast.style.backgroundColor = 'rgb(245, 245, 245)';
      dynToast.innerHTML = `
        <span class="spectrum-Toast-typeIcon">🔔</span>
        <div class="spectrum-Toast-body"><div class="spectrum-Toast-content">Dynamic Toast Inserted</div></div>
      `;
      toastsRegion.appendChild(dynToast);

      // 5. Insert a modal dialog dynamically
      const dynModal = document.createElement('div');
      dynModal.id = 'dynamic-modal';
      dynModal.className = 'spectrum-Dialog react-spectrum-Dialog is-open';
      dynModal.style.cssText = 'position:relative !important;left:auto !important;top:auto !important;transform:none !important;background:rgb(245,245,245);padding:8px;margin-top:6px;';
      dynModal.innerHTML = `
        <div class="spectrum-Dialog-header"><h3 class="spectrum-Dialog-title">Dynamic Dialog</h3></div>
        <div class="spectrum-Dialog-content">Dynamically mounted SPA dialog content.</div>
      `;
      modalRegion.appendChild(dynModal);

      return true;
    },

    /**
     * Section 17: Stress test — rapidly append count (default 120) chat messages
     */
    async runStressTest(count = 120) {
      const chatArea = document.getElementById('chatContentArea');
      let mutationCount = 0;
      const mutCounter = new MutationObserver((list) => {
        mutationCount += list.length;
      });
      mutCounter.observe(chatArea, { childList: true, subtree: true, attributes: true });

      const t0 = performance.now();
      for (let i = 0; i < count; i++) {
        const msg = document.createElement('div');
        msg.className = 'chatIndividualMessage--IntdQwOo-jr9XRxDxKbH3 stress-msg-item';
        const isRtl = i % 2 === 0;
        const text = isRtl
          ? `پیام تست فشار شماره ${i + 1} برای بررسی کارایی`
          : `Stress test message #${i + 1} checking SPA responsiveness`;
        msg.innerHTML = `
          <div class="chatIndividualMessageContentWrapperDiv--3_-ljsHfbddoYb57h1tELa" style="background-color: rgb(245, 245, 245);">
            <span class="chatMessageSender--DWciMGe1kN4RIucfuWC0f">User ${i + 1}: </span>
            <span class="chatMessageTime--mfT0iWBdHWhH_u8MKaTqn">10:45</span>
            <span class="chatIndividualMessageContent--ZoTO-kllP1-hUR76ZCyod">${text}</span>
          </div>
        `;
        chatArea.appendChild(msg);
      }
      const domAppendMs = performance.now() - t0;

      // Wait 250ms for debounced observers and check if mutations settle (no infinite mutation loop)
      await new Promise((r) => setTimeout(r, 250));
      const countAfterSettle1 = mutationCount;
      await new Promise((r) => setTimeout(r, 200));
      const countAfterSettle2 = mutationCount;
      mutCounter.disconnect();

      const totalElapsedMs = performance.now() - t0;
      return {
        messagesAppended: count,
        domAppendMs: Math.round(domAppendMs * 100) / 100,
        totalElapsedMs: Math.round(totalElapsedMs * 100) / 100,
        mutationsObserved: countAfterSettle2,
        mutationLoopDetected: countAfterSettle2 > countAfterSettle1
      };
    }
  };

  // Provide chrome.runtime shim for standalone/headless HTTP fixture execution
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      getURL: (p) => '/' + String(p).replace(/^\/+/, ''),
      onMessage: { addListener: () => {} },
      sendMessage: () => Promise.resolve({})
    };
  }
  if (!window.chrome.storage) {
    window.chrome.storage = {
      local: { get: (k, cb) => cb && cb({}), set: (v, cb) => cb && cb() },
      onChanged: { addListener: () => {} }
    };
  }

  function loadScriptSequential(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.addEventListener('load', () => resolve(true), { once: true });
      s.addEventListener('error', () => reject(new Error('Failed to load ' + src)), { once: true });
      document.head.appendChild(s);
    });
  }

  async function bootstrapFixture() {
    // Pure native light mode when engine=none and all features are off
    if (engineParam === 'none' && !darkParam && !rtlParam && !twoRowParam) {
      window.__ACD_FIXTURE_READY__ = true;
      return;
    }

    const scripts = [
      '/vendor/darkreader.js',
      '/content/darkreader-presets.js',
      '/content/darkreader-engine.js',
      '/content/theme-engine.js',
      '/content/observer.js',
      '/content/chat-rtl-main.js'
    ];
    for (const src of scripts) {
      if (src === '/content/theme-engine.js' && window.__ACD_THEME_ENGINE__) continue;
      await loadScriptSequential(src);
    }

    window.__ACD_TEST_LAB__.applyConfiguredState();
    // Wait briefly for stylesheet links and Dark Reader CSS generation
    await new Promise((r) => setTimeout(r, 450));
    window.__ACD_FIXTURE_READY__ = true;
  }

  bootstrapFixture().catch((err) => {
    console.error('[ACD Fixture Bootstrap Error]', err);
    window.__ACD_FIXTURE_ERROR__ = String(err);
    window.__ACD_FIXTURE_READY__ = true;
  });
})();
