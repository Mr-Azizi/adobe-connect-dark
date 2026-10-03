/**
 * Adobe Connect Dark Mode - Outgoing RTL Chat Main-World Bridge
 * Runs in page context (world: 'MAIN') to cooperate directly with
 * Adobe Connect's React-controlled Chat composer and send cycle.
 *
 * Activation state is derived strictly at send time from the DOM attribute:
 * document.documentElement.getAttribute('data-acd-chat-rtl') === 'true'
 */

(function () {
  'use strict';

  // Prevent multiple initializations in the same frame/window
  if (window.__ACD_CHAT_RTL_MAIN_INITIALIZED__) return;
  window.__ACD_CHAT_RTL_MAIN_INITIALIZED__ = true;

  // Adobe Connect Outgoing RTL Unicode Configuration
  const RLE = '\u202B'; // RIGHT-TO-LEFT EMBEDDING
  const LRE = '\u202A'; // LEFT-TO-RIGHT EMBEDDING (internal compatibility option)
  const PDF = '\u202C'; // POP DIRECTIONAL FORMATTING

  // Adobe Connect compatibility:
  // RLE/PDF is intentionally used for transmitted RTL-first Chat text.
  // Real client testing showed RLE/PDF gives desired rendering without
  // displacing sender names.
  // LRE is retained as an internal compatibility helper for LTR-first mixed
  // text if needed, but default LTR policy transmits original text unchanged.
  // Never use RLO (\u202E) or LRO (\u202D).
  // Never rewrite or normalize punctuation (? <-> ؟).

  // Replay guard to prevent recursive interception during programmatic send replay
  let replayingSend = false;

  /**
   * Check if RTL chat is enabled on the current document
   */
  function isRtlChatEnabled() {
    return document.documentElement?.getAttribute('data-acd-chat-rtl') === 'true';
  }

  /**
   * Canonical direction helper:
   * Determines base direction ONLY by the first strong textual letter (\p{L}).
   * Ignores leading spaces, tabs, newlines, punctuation, symbols, digits, emoji,
   * and bidi formatting controls.
   * Returns: 'rtl' | 'ltr' | 'neutral'
   */
  function getFirstStrongDirection(text) {
    if (typeof text !== 'string') {
      return 'neutral';
    }

    for (const ch of text) {
      if (!/\p{L}/u.test(ch)) {
        continue;
      }

      if (
        /\p{Script=Arabic}/u.test(ch) ||
        /\p{Script=Hebrew}/u.test(ch)
      ) {
        return 'rtl';
      }

      return 'ltr';
    }

    return 'neutral';
  }

  /**
   * Independent script composition detector:
   * Determines whether text contains RTL, LTR, or mixed script letters.
   * Word counts or majority heuristics MUST NOT override the base direction.
   */
  function getScriptComposition(text) {
    if (typeof text !== 'string') {
      return { hasRtl: false, hasLtr: false, mixed: false };
    }

    let hasRtl = false;
    let hasLtr = false;

    for (const ch of text) {
      if (!/\p{L}/u.test(ch)) {
        continue;
      }

      if (
        /\p{Script=Arabic}/u.test(ch) ||
        /\p{Script=Hebrew}/u.test(ch)
      ) {
        hasRtl = true;
      } else {
        hasLtr = true;
      }

      if (hasRtl && hasLtr) break;
    }

    return {
      hasRtl,
      hasLtr,
      mixed: hasRtl && hasLtr
    };
  }

  /**
   * Check if a paragraph was already wrapped by this feature
   */
  function isExtensionWrappedParagraph(paragraph) {
    if (typeof paragraph !== 'string') return false;
    return paragraph.startsWith(RLE) && paragraph.endsWith(PDF);
  }

  /**
   * Wrap an individual RTL paragraph with RLE and PDF
   */
  function wrapRtlParagraph(paragraph) {
    return `${RLE}${paragraph}${PDF}`;
  }

  /**
   * Internal compatibility helper for LTR embedding.
   * Inactive by default; native Adobe Connect renders LTR-first mixed messages cleanly.
   */
  function wrapLtrParagraph(paragraph) {
    return `${LRE}${paragraph}${PDF}`;
  }

  /**
   * Transform outgoing message text on a per-paragraph basis:
   * - RTL-first paragraphs -> wrapped with RLE + paragraph + PDF
   * - LTR-first and neutral paragraphs -> sent unchanged as typed
   * - Exact line breaks (\r\n, \n, \r) and blank lines preserved
   */
  function transformOutgoingMessage(text) {
    if (!text || typeof text !== 'string') return text;

    const parts = text.split(/(\r\n|\r|\n)/);
    for (let i = 0; i < parts.length; i += 2) {
      const paragraph = parts[i];
      if (!paragraph || paragraph.trim().length === 0) {
        continue;
      }
      const dir = getFirstStrongDirection(paragraph);
      if (dir === 'rtl') {
        if (!isExtensionWrappedParagraph(paragraph)) {
          parts[i] = wrapRtlParagraph(paragraph);
        }
      }
      // LTR-first and neutral paragraphs remain unchanged by default
    }

    return parts.join('');
  }

  // Alias for backward compatibility
  const transformOutgoingRtlMessage = transformOutgoingMessage;

  /**
   * Ensure composer editor has dir="auto" when RTL Chat is enabled
   */
  function ensureComposerAutoDir(el) {
    if (!el || typeof el.hasAttribute !== 'function' || !isRtlChatEnabled()) return;
    if (!el.hasAttribute('dir')) {
      el.setAttribute('dir', 'auto');
      el.setAttribute('data-acd-dir-auto', 'true');
    }
  }

  /**
   * Verify if element is a Live Chat editor input/textarea/contenteditable
   */
  function isChatEditor(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const isInputOrTextarea = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable;
    if (!isInputOrTextarea) return false;
    if (el.readOnly || el.disabled) return false;

    // Exclude non-chat pods (Notes, Polls, Q&A)
    if (el.closest && el.closest(
      '[class*="notesPod"], [class*="pollPod"], [class*="qnaPod"], [class*="qnaInput"], [class*="shortAnswerCreate"], [class*="choiceQues"]'
    )) {
      return false;
    }

    // Must be in chat compose area, chat pod, or child container
    if (el.closest && el.closest('[class*="chatComposeArea"], [class*="chatPod"], .chat-input-container')) {
      ensureComposerAutoDir(el);
      return true;
    }

    const className = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
    if (/typingArea/i.test(className) && el.closest && el.closest('[class*="childContainerDiv"]')) {
      ensureComposerAutoDir(el);
      return true;
    }

    return false;
  }

  /**
   * Locate the Chat Send button from a click event target
   */
  function findSendButton(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return null;

    // Exclude non-chat pods
    if (target.closest && target.closest(
      '[class*="notesPod"], [class*="pollPod"], [class*="qnaPod"], [class*="shortAnswerCreate"], [class*="choiceQues"]'
    )) {
      return null;
    }

    const btn = target.closest(
      'button[class*="sendButton"], button[class*="secondSendButton"], button[class*="chatSendButton"], [class*="sendButton"], [class*="secondSendButton"], button[aria-label*="Send" i]'
    );
    if (btn) {
      if (btn.closest && btn.closest('[class*="chatComposeArea"], [class*="chatPod"], [class*="childContainerDiv"], .chat-input-container')) {
        return btn.tagName === 'BUTTON' ? btn : (btn.closest('button') || btn);
      }
    }

    return null;
  }

  /**
   * Find the associated Chat editor from a Send button
   */
  function findAssociatedEditor(sendButton) {
    if (!sendButton) return null;

    const container = sendButton.closest && sendButton.closest(
      '[class*="childContainerDiv"], [class*="chatComposeArea"], [class*="chatPod"], .chat-input-container'
    );
    if (container) {
      const editor = container.querySelector(
        '[class*="typingArea"], textarea, input, [contenteditable="true"]'
      );
      if (editor && isChatEditor(editor)) return editor;
    }

    const parent = sendButton.parentElement;
    if (parent) {
      const editor = parent.querySelector('[class*="typingArea"], textarea, input, [contenteditable="true"]');
      if (editor && isChatEditor(editor)) return editor;
    }

    return null;
  }

  /**
   * Find the associated Send button from a Chat editor
   */
  function findAssociatedSendButton(editor) {
    if (!editor) return null;

    const container = editor.closest && editor.closest(
      '[class*="childContainerDiv"], [class*="chatComposeArea"], [class*="chatPod"], .chat-input-container'
    );
    if (container) {
      const btn = container.querySelector(
        'button[class*="sendButton"], button[class*="secondSendButton"], button[class*="chatSendButton"], [class*="sendButton"], [class*="secondSendButton"], button[aria-label*="Send" i]'
      );
      if (btn) {
        return btn.tagName === 'BUTTON' ? btn : (btn.closest('button') || btn);
      }
    }

    const parent = editor.parentElement;
    if (parent) {
      const btn = parent.querySelector(
        'button[class*="sendButton"], button[class*="secondSendButton"], button[class*="chatSendButton"], [class*="sendButton"], [class*="secondSendButton"], button[aria-label*="Send" i]'
      );
      if (btn) {
        return btn.tagName === 'BUTTON' ? btn : (btn.closest('button') || btn);
      }
    }

    return null;
  }

  /**
   * Read current visible text from editor
   */
  function getEditorText(element) {
    if (!element) return '';
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement ||
        element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value || '';
    }
    if (element.isContentEditable) {
      return element.innerText !== undefined ? element.innerText : (element.textContent || '');
    }
    return element.value || element.textContent || '';
  }

  /**
   * Mutate editor value and synchronize React/DOM internal state
   */
  function setEditorText(element, value) {
    if (!element) return;

    if (element instanceof HTMLTextAreaElement || element.tagName === 'TEXTAREA') {
      const proto = window.HTMLTextAreaElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) {
        desc.set.call(element, value);
      } else {
        element.value = value;
      }
    } else if (element instanceof HTMLInputElement || element.tagName === 'INPUT') {
      const proto = window.HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) {
        desc.set.call(element, value);
      } else {
        element.value = value;
      }
    } else if (element.isContentEditable) {
      element.textContent = value;
    } else {
      element.value = value;
    }

    // Reset React internal value tracker if present
    try {
      if (element._valueTracker && typeof element._valueTracker.setValue === 'function') {
        element._valueTracker.setValue('');
      }
    } catch (e) {}

    // Dispatch native InputEvent to trigger React onChange/onInput
    try {
      const inputEvt = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: value,
        inputType: 'insertReplacementText'
      });
      element.dispatchEvent(inputEvt);
    } catch (e) {
      const fallbackEvt = new Event('input', { bubbles: true, cancelable: true });
      element.dispatchEvent(fallbackEvt);
    }

    // Dispatch change event
    try {
      const changeEvt = new Event('change', { bubbles: true, cancelable: true });
      element.dispatchEvent(changeEvt);
    } catch (e) {}
  }

  /**
   * Handle Enter keydown send intent
   */
  function handleKeyDown(event) {
    if (replayingSend) return;
    if (event.key !== 'Enter') return;
    // Preserve Shift+Enter for multiline newline insertion, ignore modifiers and IME
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
      return;
    }
    if (!isRtlChatEnabled()) return;

    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    if (!isChatEditor(target)) return;

    const originalText = getEditorText(target);
    if (!originalText || !originalText.trim()) return;

    const transformedText = transformOutgoingRtlMessage(originalText);
    if (transformedText === originalText) {
      // Pure English or already wrapped — let native Adobe send proceed immediately
      return;
    }

    // 1. Prevent original Enter send action to avoid race with un-synchronized React state
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // 2. Inject transformed text and synchronize React state
    setEditorText(target, transformedText);

    // 3. Locate associated Send button and replay native send on next animation frame
    const sendBtn = findAssociatedSendButton(target);
    requestAnimationFrame(() => {
      if (sendBtn && typeof sendBtn.click === 'function') {
        replayingSend = true;
        try {
          sendBtn.click();
        } finally {
          replayingSend = false;
        }
      } else {
        // Fallback if send button element was not resolved: dispatch replayed Enter
        replayingSend = true;
        try {
          target.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }));
        } finally {
          replayingSend = false;
        }
      }
    });
  }

  /**
   * Handle Click send intent on Send button
   */
  function handleClick(event) {
    if (replayingSend) return;
    if (!isRtlChatEnabled()) return;

    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    const sendBtn = findSendButton(target);
    if (!sendBtn) return;

    const editor = findAssociatedEditor(sendBtn);
    if (!editor) return;

    const originalText = getEditorText(editor);
    if (!originalText || !originalText.trim()) return;

    const transformedText = transformOutgoingRtlMessage(originalText);
    if (transformedText === originalText) {
      // Pure English or already wrapped — let native Adobe send proceed immediately
      return;
    }

    // 1. Prevent original click send to avoid race
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // 2. Inject transformed text and synchronize React state
    setEditorText(editor, transformedText);

    // 3. Replay native send on next animation frame with replay guard active
    requestAnimationFrame(() => {
      replayingSend = true;
      try {
        sendBtn.click();
      } finally {
        replayingSend = false;
      }
    });
  }

  /**
   * Handle FocusIn event to ensure composer editor has dir="auto"
   */
  function handleFocusIn(event) {
    if (!isRtlChatEnabled()) return;
    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    if (isChatEditor(target)) {
      ensureComposerAutoDir(target);
    }
  }

  // Install document-level capturing listeners to catch composed events from light DOM and open Shadow DOM
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('focusin', handleFocusIn, true);
})();
