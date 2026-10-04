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

  // Live-composer formatting guard. The editor value is decorated with the
  // exact same Unicode embeddings used for outgoing messages, so users see
  // the final BiDi order while they are still typing.
  let formattingLiveEditor = false;
  const composingEditors = new WeakSet();
  const trackedEditors = new Set();
  const scheduledEditorFrames = new WeakMap();
  const reconcileEditors = new WeakSet();
  const EXTENSION_BIDI_CONTROL_REGEX = /[\u202A\u202B\u202C]/g;

  /**
   * Check if RTL chat is enabled on the current document
   */
  function isRtlChatEnabled() {
    return document.documentElement?.getAttribute('data-acd-chat-rtl') === 'true';
  }

  /**
   * Check if Outgoing Send RTL Formatting is actively enabled.
   * Effective ONLY when RTL Chat is ON and Send RTL Formatting is not explicitly disabled ('false').
   * Defaults to true for backward compatibility when attribute is not set.
   */
  function isSendRtlFormattingActive() {
    if (!isRtlChatEnabled()) return false;
    return document.documentElement?.getAttribute('data-acd-send-rtl-formatting') !== 'false';
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
   * Remove only the BiDi controls inserted by this extension. Live formatting
   * canonicalizes from plain user text on every pass, preventing nested RLE/LRE
   * wrappers after edits, paste, undo/redo, or Shift+Enter.
   */
  function stripExtensionBidiControls(text) {
    if (typeof text !== 'string' || !text) return text || '';
    return text.replace(EXTENSION_BIDI_CONTROL_REGEX, '');
  }

  function isBidiControlChar(ch) {
    return ch === LRE || ch === RLE || ch === PDF;
  }

  /**
   * Convert a caret/selection offset from a decorated editor value to its
   * equivalent position in the plain user text.
   */
  function decoratedOffsetToRaw(value, offset) {
    const limit = Math.max(0, Math.min(Number.isFinite(offset) ? offset : 0, value.length));
    let raw = 0;
    for (let i = 0; i < limit; i += 1) {
      if (!isBidiControlChar(value[i])) raw += 1;
    }
    return raw;
  }

  /**
   * Convert a plain-text caret/selection offset back into the decorated value.
   * At the beginning of a wrapped line the caret is placed after RLE/LRE, and
   * at the end it is kept before the matching PDF so subsequent typing stays
   * inside the directional embedding.
   */
  function rawOffsetToDecorated(value, rawOffset) {
    const wanted = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);
    let raw = 0;
    let boundary = 0;

    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (isBidiControlChar(ch)) {
        if ((ch === LRE || ch === RLE) && raw === wanted) {
          boundary = i + 1;
          continue;
        }
        if (ch === PDF && raw === wanted) {
          return i;
        }
        continue;
      }

      if (raw === wanted) return Math.max(boundary, i);
      raw += 1;
      boundary = i + 1;
    }

    return value.length;
  }

  function getTextControlSelection(element, value) {
    if (!(element instanceof HTMLTextAreaElement) &&
        !(element instanceof HTMLInputElement) &&
        element.tagName !== 'TEXTAREA' && element.tagName !== 'INPUT') {
      return null;
    }

    try {
      return {
        start: decoratedOffsetToRaw(value, element.selectionStart ?? value.length),
        end: decoratedOffsetToRaw(value, element.selectionEnd ?? value.length),
        direction: element.selectionDirection || 'none'
      };
    } catch (e) {
      return null;
    }
  }

  function getContentEditableSelection(element, value) {
    if (!element?.isContentEditable || !window.getSelection) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
      return null;
    }

    try {
      const startRange = range.cloneRange();
      startRange.selectNodeContents(element);
      startRange.setEnd(range.startContainer, range.startOffset);

      const endRange = range.cloneRange();
      endRange.selectNodeContents(element);
      endRange.setEnd(range.endContainer, range.endOffset);

      return {
        start: decoratedOffsetToRaw(value, startRange.toString().length),
        end: decoratedOffsetToRaw(value, endRange.toString().length),
        direction: 'none'
      };
    } catch (e) {
      return null;
    }
  }

  function getRawEditorSelection(element, value) {
    return getTextControlSelection(element, value) ||
      getContentEditableSelection(element, value) ||
      {
        start: stripExtensionBidiControls(value).length,
        end: stripExtensionBidiControls(value).length,
        direction: 'none'
      };
  }

  function restoreEditorSelection(element, decoratedValue, rawSelection) {
    if (!element || !rawSelection) return;

    const start = rawOffsetToDecorated(decoratedValue, rawSelection.start);
    const end = rawOffsetToDecorated(decoratedValue, rawSelection.end);

    if ((element instanceof HTMLTextAreaElement) ||
        (element instanceof HTMLInputElement) ||
        element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      try {
        element.setSelectionRange(start, end, rawSelection.direction);
      } catch (e) {}
      return;
    }

    if (element.isContentEditable && window.getSelection) {
      try {
        const textNode = element.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
        const range = document.createRange();
        range.setStart(textNode, Math.min(start, textNode.length));
        range.setEnd(textNode, Math.min(end, textNode.length));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {}
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

    // Adobe Connect's current Chat composer uses this stable ID. Prefer the
    // exact target discovered in the saved meeting DOM, while retaining the
    // class/container fallbacks below for older/newer Connect builds.
    if (el.id === 'chatTypingArea') {
      const composeArea = el.closest?.('#chatComposeArea, [class*="chatComposeArea"]');
      if (composeArea) return true;
    }

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
      '#sendButton, button[class*="sendButton"], button[class*="secondSendButton"], button[class*="chatSendButton"], [class*="sendButton"], [class*="secondSendButton"], button[aria-label*="Send" i]'
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
        '#chatTypingArea, [class*="typingArea"], textarea, input, [contenteditable="true"]'
      );
      if (editor && isChatEditor(editor)) return editor;
    }

    const parent = sendButton.parentElement;
    if (parent) {
      const editor = parent.querySelector('#chatTypingArea, [class*="typingArea"], textarea, input, [contenteditable="true"]');
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
        '#sendButton, button[class*="sendButton"], button[class*="secondSendButton"], button[class*="chatSendButton"], [class*="sendButton"], [class*="secondSendButton"], button[aria-label*="Send" i]'
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
   * Set only the DOM-visible editor value, without dispatching a synthetic
   * input/change event. This is used for one post-React reconciliation pass:
   * some Adobe Connect/Spectrum builds commit their controlled state after our
   * input handler and can overwrite the decorated value with the raw value.
   */
  function setEditorDomValueOnly(element, value) {
    if (!element) return;

    if (element instanceof HTMLTextAreaElement || element.tagName === 'TEXTAREA') {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (desc?.set) desc.set.call(element, value);
      else element.value = value;
      return;
    }

    if (element instanceof HTMLInputElement || element.tagName === 'INPUT') {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (desc?.set) desc.set.call(element, value);
      else element.value = value;
      return;
    }

    if (element.isContentEditable) {
      element.textContent = value;
      return;
    }

    element.value = value;
  }

  /**
   * One frame after React/Spectrum has had a chance to commit, verify that the
   * visible composer still matches our canonical per-line BiDi transform.
   * Re-asserting the DOM value here fixes Latin-first ambiguous lines such as
   * "linux چیست؟" being reverted to the browser's natural LTR paragraph.
   */
  function reconcileLiveEditorAfterReact(element) {
    if (!element || reconcileEditors.has(element)) return;
    reconcileEditors.add(element);

    requestAnimationFrame(() => {
      reconcileEditors.delete(element);
      if (!element.isConnected || composingEditors.has(element)) return;

      const currentValue = getEditorText(element);
      const rawSelection = getRawEditorSelection(element, currentValue);
      const rawValue = stripExtensionBidiControls(currentValue);
      const wantedValue = isRtlChatEnabled()
        ? transformOutgoingRtlMessage(rawValue)
        : rawValue;

      if (currentValue !== wantedValue) {
        formattingLiveEditor = true;
        try {
          setEditorDomValueOnly(element, wantedValue);
          restoreEditorSelection(element, wantedValue, rawSelection);
        } finally {
          formattingLiveEditor = false;
        }
      } else if (document.activeElement === element || element.matches?.(':focus')) {
        restoreEditorSelection(element, currentValue, rawSelection);
      }
    });
  }

  /**
   * Replace editor text for live formatting and synchronize Adobe Connect's
   * React-controlled state without firing a synthetic `change` on every
   * keystroke. The regular send-time setter remains unchanged.
   */
  function setEditorTextLive(element, value, rawSelection) {
    if (!element) return;

    formattingLiveEditor = true;
    try {
      if (element instanceof HTMLTextAreaElement || element.tagName === 'TEXTAREA') {
        const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        if (desc?.set) desc.set.call(element, value);
        else element.value = value;
      } else if (element instanceof HTMLInputElement || element.tagName === 'INPUT') {
        const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (desc?.set) desc.set.call(element, value);
        else element.value = value;
      } else if (element.isContentEditable) {
        element.textContent = value;
      } else {
        element.value = value;
      }

      try {
        if (element._valueTracker && typeof element._valueTracker.setValue === 'function') {
          element._valueTracker.setValue('');
        }
      } catch (e) {}

      try {
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: false,
          data: null,
          inputType: 'insertReplacementText'
        }));
      } catch (e) {
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: false }));
      }

      restoreEditorSelection(element, value, rawSelection);

      // Adobe's Spectrum textarea is controlled by React. Depending on the
      // build/batching mode, its state commit can happen after this synthetic
      // input and restore the raw text. Verify once on the next frame and
      // re-assert the canonical visible value if that happened.
      reconcileLiveEditorAfterReact(element);
    } finally {
      formattingLiveEditor = false;
    }
  }

  /**
   * Apply the exact outgoing BiDi transformation to the visible composer.
   * Existing extension controls are stripped first, so this operation is
   * idempotent and safe across repeated input events.
   */
  function formatLiveEditor(element) {
    if (!element || !isChatEditor(element) || composingEditors.has(element)) return;
    trackedEditors.add(element);

    const currentValue = getEditorText(element);
    const rawSelection = getRawEditorSelection(element, currentValue);
    const rawValue = stripExtensionBidiControls(currentValue);

    if (!isRtlChatEnabled()) {
      if (currentValue !== rawValue) {
        setEditorTextLive(element, rawValue, rawSelection);
      }
      return;
    }

    const decoratedValue = transformOutgoingRtlMessage(rawValue);
    if (decoratedValue === currentValue) return;
    setEditorTextLive(element, decoratedValue, rawSelection);
  }

  function scheduleLiveEditorFormat(element) {
    if (!element) return;

    // Debounce to the *latest* input in the frame. We intentionally reschedule
    // instead of ignoring subsequent keystrokes: Adobe/React may queue a
    // controlled-value commit for every input event, and an older formatting
    // pass can otherwise be overwritten by a later raw commit.
    queueMicrotask(() => {
      const previousFrame = scheduledEditorFrames.get(element);
      if (previousFrame) {
        cancelAnimationFrame(previousFrame);
      }

      const frameId = requestAnimationFrame(() => {
        scheduledEditorFrames.delete(element);
        if (!element.isConnected || composingEditors.has(element)) return;
        formatLiveEditor(element);
      });

      scheduledEditorFrames.set(element, frameId);
    });
  }

  function handleLiveInput(event) {
    if (formattingLiveEditor || replayingSend || event.isComposing) return;
    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    if (!isChatEditor(target)) return;
    trackedEditors.add(target);
    scheduleLiveEditorFormat(target);
  }

  /**
   * Final post-key reconciliation. `input` is still the primary signal, but a
   * keyup pass guarantees that a late controlled React commit cannot leave the
   * visible textarea in its raw/natural direction after the key is released.
   */
  function handleLiveKeyUp(event) {
    if (formattingLiveEditor || replayingSend || event.isComposing) return;
    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    if (!isChatEditor(target)) return;
    trackedEditors.add(target);
    scheduleLiveEditorFormat(target);
  }

  function handleComposerFocus(event) {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    if (!isChatEditor(target)) return;
    trackedEditors.add(target);
    scheduleLiveEditorFormat(target);
  }

  function handleCompositionStart(event) {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    if (!isChatEditor(target)) return;
    trackedEditors.add(target);
    composingEditors.add(target);
  }

  function handleCompositionEnd(event) {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    if (!isChatEditor(target)) return;
    composingEditors.delete(target);
    scheduleLiveEditorFormat(target);
  }

  function cleanupTrackedEditorsWhenDisabled() {
    if (isRtlChatEnabled()) {
      for (const editor of trackedEditors) {
        if (!editor?.isConnected) trackedEditors.delete(editor);
        else scheduleLiveEditorFormat(editor);
      }
      return;
    }

    for (const editor of trackedEditors) {
      if (!editor?.isConnected) {
        trackedEditors.delete(editor);
        continue;
      }
      scheduleLiveEditorFormat(editor);
    }
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

    // Always canonicalize from plain user text. A live-decorated DOM value can
    // be newer than Adobe's controlled React state, so an already-wrapped
    // editor must still be synchronized before replaying the native send.
    const rawText = stripExtensionBidiControls(originalText);
    const editorWasDecorated = rawText !== originalText;

    const textToSend = isSendRtlFormattingActive()
      ? transformOutgoingRtlMessage(rawText)
      : rawText;

    if (textToSend === originalText && !editorWasDecorated) {
      // Pure English / unchanged text: native Adobe state is already correct.
      return;
    }

    // 1. Prevent original Enter send action to avoid race with un-synchronized React state
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // 2. Inject target text (transformed or clean) and synchronize React state
    setEditorText(target, textToSend);

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

    const rawText = stripExtensionBidiControls(originalText);
    const editorWasDecorated = rawText !== originalText;

    const textToSend = isSendRtlFormattingActive()
      ? transformOutgoingRtlMessage(rawText)
      : rawText;

    if (textToSend === originalText && !editorWasDecorated) {
      // Pure English / unchanged text: native Adobe state is already correct.
      return;
    }

    // 1. Prevent original click send to avoid race
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // 2. Inject target text (transformed or clean) and synchronize React state
    setEditorText(editor, textToSend);

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

  // Install document-level capturing listeners to catch composed events from light DOM and open Shadow DOM.
  // `input` keeps the visible composer synchronized with the outgoing BiDi
  // algorithm; composition events protect IME input from mid-composition edits.
  document.addEventListener('input', handleLiveInput, true);
  document.addEventListener('keyup', handleLiveKeyUp, true);
  document.addEventListener('focusin', handleComposerFocus, true);
  document.addEventListener('compositionstart', handleCompositionStart, true);
  document.addEventListener('compositionend', handleCompositionEnd, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('click', handleClick, true);

  /* ==========================================================================
     Incoming Chat Messages BiDi Classification & Dynamic Styling
     Reuses the exact same classifier (classifyLineDirection) without modifying
     received message textContent or adding Unicode control characters.
     ========================================================================== */

  const INCOMING_MESSAGE_SELECTOR = [
    '[class^="chatIndividualMessageContent--"]',
    '[class*=" chatIndividualMessageContent--"]',
    '.chat-message-text',
    '[class*="chat-message-content"]'
  ].join(', ');

  const incomingMessageTextCache = new WeakMap();
  const trackedShadowRoots = new Set();
  const shadowObservers = new WeakMap();

  const SHADOW_INCOMING_RTL_STYLE_ID = 'acd-incoming-rtl-style';
  const SHADOW_INCOMING_RTL_CSS = `
[data-acd-bidi-dir="rtl"] {
  direction: rtl !important;
  text-align: right !important;
  unicode-bidi: isolate !important;
}
[data-acd-bidi-dir="ltr"] {
  direction: ltr !important;
  text-align: left !important;
  unicode-bidi: isolate !important;
}
`;

  /**
   * Verify if element is an actual Chat Message text body (and not sender/time/wrapper/pod/composer)
   */
  function isChatMessageBody(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.isContentEditable) {
      return false;
    }
    const className = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
    if (/Sender|Time|Wrapper|typing|compose|send|button|reaction|avatar/i.test(className)) {
      return false;
    }
    if (el.matches && el.matches(INCOMING_MESSAGE_SELECTOR)) {
      return true;
    }
    return false;
  }

  /**
   * Determine the base BiDi direction for an incoming message.
   * Reuses the exact same classification logic (classifyLineDirection)
   * while handling multiline messages at message-level granularity.
   */
  function classifyIncomingMessageText(text) {
    if (typeof text !== 'string') return null;
    const clean = stripExtensionBidiControls(text).trim();
    if (!clean) return null;

    if (!clean.includes('\n')) {
      return classifyLineDirection(clean);
    }

    const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    if (lines.length === 1) return classifyLineDirection(lines[0]);

    let rtlCount = 0;
    let ltrCount = 0;
    for (const line of lines) {
      const dir = classifyLineDirection(line);
      if (dir === 'rtl') rtlCount += 1;
      else if (dir === 'ltr') ltrCount += 1;
    }

    if (rtlCount > 0 && rtlCount >= ltrCount) return 'rtl';
    if (ltrCount > 0 && ltrCount > rtlCount) return 'ltr';
    return classifyLineDirection(lines[0]) || (rtlCount > 0 ? 'rtl' : 'ltr');
  }

  function classifyIncomingMessageElement(el) {
    if (!isChatMessageBody(el)) return;

    if (!isRtlChatEnabled()) {
      if (el.hasAttribute('data-acd-bidi-dir')) {
        el.removeAttribute('data-acd-bidi-dir');
      }
      return;
    }

    const rawText = el.textContent || '';
    if (!rawText.trim()) return;

    const cached = incomingMessageTextCache.get(el);
    if (cached === rawText && el.hasAttribute('data-acd-bidi-dir')) {
      return;
    }

    const direction = classifyIncomingMessageText(rawText);
    incomingMessageTextCache.set(el, rawText);

    if (direction === 'rtl' || direction === 'ltr') {
      if (el.getAttribute('data-acd-bidi-dir') !== direction) {
        el.setAttribute('data-acd-bidi-dir', direction);
      }
    } else {
      el.removeAttribute('data-acd-bidi-dir');
    }
  }

  function ensureShadowRootRtlStyle(shadowRoot) {
    if (!shadowRoot || !shadowRoot.querySelector) return;
    if (!shadowRoot.querySelector(`#${SHADOW_INCOMING_RTL_STYLE_ID}`)) {
      const style = document.createElement('style');
      style.id = SHADOW_INCOMING_RTL_STYLE_ID;
      style.textContent = SHADOW_INCOMING_RTL_CSS;
      shadowRoot.appendChild(style);
    }
  }

  function removeShadowRootRtlStyle(shadowRoot) {
    if (!shadowRoot || !shadowRoot.querySelector) return;
    const style = shadowRoot.querySelector(`#${SHADOW_INCOMING_RTL_STYLE_ID}`);
    if (style) {
      if (typeof style.remove === 'function') {
        style.remove();
      } else if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }
  }

  function observeShadowRoot(shadowRoot) {
    if (!shadowRoot || shadowObservers.has(shadowRoot)) return;
    try {
      const obs = new MutationObserver(handleIncomingMutations);
      obs.observe(shadowRoot, {
        childList: true,
        subtree: true,
        characterData: true
      });
      shadowObservers.set(shadowRoot, obs);
    } catch (e) {}
  }

  function registerShadowRoot(shadowRoot) {
    if (!shadowRoot || trackedShadowRoots.has(shadowRoot)) return;
    trackedShadowRoots.add(shadowRoot);

    if (isRtlChatEnabled()) {
      ensureShadowRootRtlStyle(shadowRoot);
      observeShadowRoot(shadowRoot);
      scanContainerForIncomingMessages(shadowRoot);
      scanContainerForShadowRoots(shadowRoot);
    }
  }

  // Intercept open shadow root attachments in page context
  try {
    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      const shadowRoot = origAttachShadow.apply(this, arguments);
      if (shadowRoot && init && init.mode === 'open') {
        registerShadowRoot(shadowRoot);
      }
      return shadowRoot;
    };
  } catch (e) {}

  function scanContainerForShadowRoots(container) {
    if (!container || !container.querySelectorAll) return;
    try {
      const all = container.querySelectorAll('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el.shadowRoot) {
          registerShadowRoot(el.shadowRoot);
        }
      }
    } catch (e) {}
  }

  let incomingMessageObserver = null;

  function scanContainerForIncomingMessages(container) {
    if (!container || !isRtlChatEnabled()) return;

    if (isChatMessageBody(container)) {
      classifyIncomingMessageElement(container);
    }

    try {
      if (container.querySelectorAll) {
        const messages = container.querySelectorAll(INCOMING_MESSAGE_SELECTOR);
        for (let i = 0; i < messages.length; i++) {
          classifyIncomingMessageElement(messages[i]);
        }
      }
    } catch (e) {}
  }

  function handleIncomingMutations(mutations) {
    if (!isRtlChatEnabled()) return;

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      if (mutation.type === 'childList') {
        const added = mutation.addedNodes;
        for (let j = 0; j < added.length; j++) {
          const node = added[j];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          if (isChatMessageBody(node)) {
            classifyIncomingMessageElement(node);
          }
          if (node.querySelectorAll) {
            const children = node.querySelectorAll(INCOMING_MESSAGE_SELECTOR);
            for (let k = 0; k < children.length; k++) {
              classifyIncomingMessageElement(children[k]);
            }

            if (node.shadowRoot) {
              registerShadowRoot(node.shadowRoot);
            }
          }
        }
      } else if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent) {
          const target = parent.closest ? parent.closest(INCOMING_MESSAGE_SELECTOR) : null;
          if (target && isChatMessageBody(target)) {
            classifyIncomingMessageElement(target);
          }
        }
      }
    }
  }

  function startIncomingMessageObserver() {
    if (incomingMessageObserver || !isRtlChatEnabled()) return;

    incomingMessageObserver = new MutationObserver(handleIncomingMutations);

    const root = document.body || document.documentElement;
    if (root) {
      incomingMessageObserver.observe(root, {
        childList: true,
        subtree: true,
        characterData: true
      });
      scanContainerForIncomingMessages(root);
      scanContainerForShadowRoots(root);
    }

    for (const shadowRoot of trackedShadowRoots) {
      observeShadowRoot(shadowRoot);
      ensureShadowRootRtlStyle(shadowRoot);
      scanContainerForIncomingMessages(shadowRoot);
    }
  }

  function stopIncomingMessageObserver() {
    if (incomingMessageObserver) {
      try { incomingMessageObserver.disconnect(); } catch (e) {}
      incomingMessageObserver = null;
    }

    for (const shadowRoot of trackedShadowRoots) {
      const obs = shadowObservers.get(shadowRoot);
      if (obs) {
        try { obs.disconnect(); } catch (e) {}
        shadowObservers.delete(shadowRoot);
      }
      removeShadowRootRtlStyle(shadowRoot);
    }

    // Clean up all data-acd-bidi-dir attributes across document and shadow roots
    try {
      const allClassified = document.querySelectorAll('[data-acd-bidi-dir]');
      for (let i = 0; i < allClassified.length; i++) {
        allClassified[i].removeAttribute('data-acd-bidi-dir');
      }
    } catch (e) {}

    for (const shadowRoot of trackedShadowRoots) {
      try {
        const allClassified = shadowRoot.querySelectorAll('[data-acd-bidi-dir]');
        for (let i = 0; i < allClassified.length; i++) {
          allClassified[i].removeAttribute('data-acd-bidi-dir');
        }
      } catch (e) {}
    }
  }

  function syncIncomingRtlState() {
    if (isRtlChatEnabled()) {
      startIncomingMessageObserver();
    } else {
      stopIncomingMessageObserver();
    }
  }

  // If the user toggles RTL Chat or Send formatting while text is already present,
  // immediately reconcile editors and incoming messages.
  const rtlStateObserver = new MutationObserver((records) => {
    if (records.some((record) =>
      record.attributeName === 'data-acd-chat-rtl' ||
      record.attributeName === 'data-acd-send-rtl-formatting'
    )) {
      cleanupTrackedEditorsWhenDisabled();
      syncIncomingRtlState();
    }
  });
  rtlStateObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-acd-chat-rtl', 'data-acd-send-rtl-formatting']
  });

  // Initial startup for incoming messages if RTL Chat is active
  syncIncomingRtlState();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncIncomingRtlState();
    }, { once: true });
  }
})();
