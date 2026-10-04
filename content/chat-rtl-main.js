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

  // Adobe Connect outgoing BiDi Unicode configuration.
  // Embeddings are used instead of isolates because RLI/PDI caused
  // sender/message ordering issues in real Adobe Connect client tests.
  // Never replace these with LRO/RLO: overrides destroy the natural
  // direction of embedded Persian/English runs.
  const LRE = '\u202A'; // LEFT-TO-RIGHT EMBEDDING
  const RLE = '\u202B'; // RIGHT-TO-LEFT EMBEDDING
  const PDF = '\u202C'; // POP DIRECTIONAL FORMATTING

  // IMPORTANT: direction detection must be based on strong letters, not the
  // whole Arabic Unicode block. Persian/Arabic digits and punctuation such as
  // ۲۲ - ۲ = ۲۰ and ؟ must not make a line RTL by themselves.
  const RTL_LETTER_REGEX = /[\u0620-\u063F\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5\u06E5-\u06E6\u06EE-\u06EF\u06FA-\u06FC\u06FF\u0750-\u077F\u08A0-\u08C9\uFB50-\uFDFF\uFE70-\uFEFC]/;
  const LATIN_LETTER_REGEX = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;
  const DIGIT_REGEX = /[0-9\u0660-\u0669\u06F0-\u06F9]/;

  // Math expressions are explicitly embedded LTR inside an RTL sentence.
  // This prevents expressions such as "22 - 2" / "۲۲ - ۲" from being
  // visually reordered by the surrounding RTL paragraph.
  const INLINE_MATH_REGEX = /[0-9\u0660-\u0669\u06F0-\u06F9]+(?:[.,٫٬][0-9\u0660-\u0669\u06F0-\u06F9]+)?(?:\s*[-+−×÷*/=<>≤≥%٪^]\s*[0-9\u0660-\u0669\u06F0-\u06F9]+(?:[.,٫٬][0-9\u0660-\u0669\u06F0-\u06F9]+)?)+/g;

  // Strong English grammar markers used only when a mixed line starts with
  // Latin text. They let us distinguish cases such as:
  //   "who is لینوس توروالدز؟"  -> LTR
  //   "linux چیست؟"            -> RTL (conservative fallback)
  const ENGLISH_LEAD_MARKERS = new Set([
    'what', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'which',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had',
    'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would',
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'this', 'that', 'these', 'those',
    'define', 'explain', 'describe', 'tell', 'show', 'give', 'list',
    'translate', 'compare'
  ]);

  // Replay guard to prevent recursive interception during programmatic send replay
  let replayingSend = false;

  /**
   * Check if RTL chat is enabled on the current document
   */
  function isRtlChatEnabled() {
    return document.documentElement?.getAttribute('data-acd-chat-rtl') === 'true';
  }

  function containsRtlLetter(text) {
    return typeof text === 'string' && RTL_LETTER_REGEX.test(text);
  }

  function containsLatinLetter(text) {
    return typeof text === 'string' && LATIN_LETTER_REGEX.test(text);
  }

  /**
   * Return the first strong *letter* direction. Digits and punctuation are
   * deliberately ignored because they should not decide paragraph direction.
   */
  function getFirstStrongDirection(text) {
    if (typeof text !== 'string') return null;
    for (const ch of text) {
      if (RTL_LETTER_REGEX.test(ch)) return 'rtl';
      if (LATIN_LETTER_REGEX.test(ch)) return 'ltr';
    }
    return null;
  }

  /**
   * Count rough Latin / RTL words. This is intentionally lexical rather than
   * character-count based, so a long Persian word does not outweigh a complete
   * English phrase merely because it contains more characters.
   */
  function countScriptWords(text) {
    let rtl = 0;
    let ltr = 0;
    const tokens = text
      .split(/[\s"'“”‘’()[\]{}<>.,!?؟:;،؛\\/|+=*~`]+/)
      .filter(Boolean);

    for (const token of tokens) {
      if (containsRtlLetter(token)) rtl += 1;
      if (containsLatinLetter(token)) ltr += 1;
    }
    return { rtl, ltr };
  }

  /**
   * Inspect only the Latin prefix before the first RTL letter. If that prefix
   * contains a strong English grammar marker, treat it as an English sentence
   * frame rather than a technical/name token preceding a Persian sentence.
   */
  function hasEnglishLeadGrammar(text) {
    let prefix = '';
    for (const ch of text) {
      if (RTL_LETTER_REGEX.test(ch)) break;
      prefix += ch;
    }

    const words = prefix.toLowerCase().match(/[a-z\u00C0-\u024F\u1E00-\u1EFF]+/g) || [];
    return words.some((word) => ENGLISH_LEAD_MARKERS.has(word));
  }

  /**
   * Decide the base direction for ONE physical line.
   *
   * Rules, in priority order:
   *  1) Pure Latin -> LTR; pure RTL letters -> RTL.
   *  2) Numeric/math-only -> LTR.
   *  3) Mixed text beginning with an RTL letter -> RTL.
   *  4) Mixed text beginning with Latin -> LTR only when there is convincing
   *     English-sentence evidence (grammar marker or strong Latin-word
   *     dominance). Otherwise default to RTL, exactly as requested for
   *     ambiguous "English first, Persian later" cases.
   */
  function classifyLineDirection(line) {
    const hasRtl = containsRtlLetter(line);
    const hasLatin = containsLatinLetter(line);
    const firstStrong = getFirstStrongDirection(line);

    if (!hasRtl && hasLatin) return 'ltr';
    if (hasRtl && !hasLatin) return 'rtl';
    if (!hasRtl && !hasLatin) {
      return DIGIT_REGEX.test(line) ? 'ltr' : null;
    }

    if (firstStrong === 'rtl') return 'rtl';

    if (firstStrong === 'ltr') {
      if (hasEnglishLeadGrammar(line)) return 'ltr';

      const { rtl, ltr } = countScriptWords(line);
      if (ltr >= Math.max(2, rtl * 2)) return 'ltr';

      // Conservative fallback requested by the user for genuinely ambiguous
      // Latin-first + Persian mixed sentences.
      return 'rtl';
    }

    return 'rtl';
  }

  /**
   * Normalize only a terminal question mark. Internal "?" characters in a
   * URL, code sample, etc. are left untouched.
   */
  function normalizeTerminalQuestionMark(line, direction) {
    const mark = direction === 'ltr' ? '?' : '؟';
    return line.replace(/[?؟](?=(?:["'”’»)\]}]\s*)?$)/u, mark);
  }

  /**
   * Protect arithmetic as an LTR island inside an RTL sentence.
   */
  function protectInlineMath(line) {
    return line.replace(INLINE_MATH_REGEX, (expression) => `${LRE}${expression}${PDF}`);
  }

  /**
   * Check if a line was already wrapped by this feature.
   */
  function isExtensionWrappedLine(line) {
    if (typeof line !== 'string') return false;
    return (line.startsWith(RLE) || line.startsWith(LRE)) && line.endsWith(PDF);
  }

  /**
   * Transform one line according to its own BiDi context.
   */
  function transformOutgoingBidiLine(line) {
    if (!line || line.trim().length === 0 || isExtensionWrappedLine(line)) {
      return line;
    }

    const direction = classifyLineDirection(line);
    if (!direction) return line;

    const normalized = normalizeTerminalQuestionMark(line, direction);

    if (direction === 'rtl') {
      return `${RLE}${protectInlineMath(normalized)}${PDF}`;
    }

    // Pure Latin text already has a strong LTR character and Adobe renders it
    // correctly. Mixed LTR/RTL and digit-only math are explicitly wrapped LTR
    // so the surrounding RTL Chat CSS cannot choose the wrong base direction.
    const needsExplicitLtrEmbedding =
      containsRtlLetter(normalized) ||
      (!containsLatinLetter(normalized) && DIGIT_REGEX.test(normalized));

    if (needsExplicitLtrEmbedding) {
      return `${LRE}${normalized}${PDF}`;
    }

    return normalized;
  }

  /**
   * Transform outgoing message text while preserving the exact newline bytes.
   * Every line created with Shift+Enter is classified and formatted from zero,
   * independently of the line before it.
   */
  function transformOutgoingRtlMessage(text) {
    if (!text || typeof text !== 'string') return text;

    const parts = text.split(/(\r\n|\r|\n)/);
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = transformOutgoingBidiLine(parts[i]);
    }
    return parts.join('');
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
      return true;
    }

    const className = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
    if (/typingArea/i.test(className) && el.closest && el.closest('[class*="childContainerDiv"]')) {
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

  // Install document-level capturing listeners to catch composed events from light DOM and open Shadow DOM
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('click', handleClick, true);
})();
