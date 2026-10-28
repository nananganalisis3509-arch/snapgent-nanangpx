// SPDX-License-Identifier: GPL-3.0-or-later
// providers/claude.js - the Claude (claude.ai) provider.
// Claude's DOM changes periodically; selectors below prefer test IDs and
// semantic attributes, with contenteditable/button fallbacks for the composer.
// eslint-disable-next-line no-unused-vars
const ZSProvider = (() => {
  "use strict";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let diag = () => {};
  let locked = false;
  let lockedEditor = null;

  const S = {
    user: '[data-testid="user-message"]',
    assistant: '[data-testid="assistant-message"], .font-claude-message, .font-claude-response, [data-is-streaming]',
    editor: [
      '[data-testid="chat-input"][contenteditable]',
      '[data-testid="chat-input"] [contenteditable]',
      'fieldset [contenteditable]',
      '[contenteditable][data-placeholder]',
      '.ProseMirror[contenteditable]',
      'div[contenteditable="true"]',
      'div[contenteditable]',
      'textarea[data-testid="chat-input-ssr"]',
    ].join(","),
    send: [
      'button[data-testid*="send"]',
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[aria-label*="Kirim"]',
      '[role="button"][data-testid*="send"]',
      '[role="button"][aria-label*="Send"]',
      '[role="button"][aria-label*="send"]',
    ].join(","),
    stop: [
      'button[data-testid="stop-button"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="stop"]',
      'button[aria-label*="Hentikan"]',
    ].join(","),
    thinking: '[data-testid*="thinking"],[class*="thinking"],[class*="reasoning"]',
    errors: '[role="alert"],[data-testid*="error"],[class*="error-message"]',
  };

  const timings = {
    GEN_IDLE_MS: 2000,
    REASON_IDLE_MS: 15000,
    WARMUP_MS: 60000,
    REASON_NOREPLY_MS: 120000,
    STABLE_MS: 10000,
    RESPONSE_TIMEOUT_MS: 300000,
  };
  const visible = (el) => !!el && el.isConnected !== false && (typeof el.getClientRects === "function" ? el.getClientRects().length > 0 : true);
  const BLOCK_TAGS = /^(?:P|DIV|PRE|LI|UL|OL|BLOCKQUOTE|H[1-6]|TABLE|TR|SECTION|ARTICLE|HR)$/;
  const without = (root, excludeSel) => {
    if (!root) return "";
    const skip = [".zs-chip", S.thinking, excludeSel].filter(Boolean).join(",");
    let text = "";
    const breakLine = () => { if (text && !text.endsWith("\n")) text += "\n"; };
    const visit = (node) => {
      if (node.nodeType === 3) {
        text += node.nodeValue || "";
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.matches && node.matches(skip)) return;
      if (node.tagName === "BR") {
        text += "\n";
        return;
      }
      if (node.classList && node.classList.contains("cm-line")) {
        for (const child of node.childNodes || []) visit(child);
        text += "\n";
        return;
      }
      const isBlock = BLOCK_TAGS.test(node.tagName || "");
      if (isBlock) breakLine();
      for (const child of node.childNodes || []) visit(child);
      if (isBlock) breakLine();
    };
    visit(root);
    return text;
  };

  const TURN_SEL = `${S.user},${S.assistant}`;
  const isAssistantItem = (item) => !!item &&
    ((item.matches && item.matches(S.assistant)) || !!(item.querySelector && item.querySelector(S.assistant)));
  const isUserItem = (item) => !!item &&
    ((item.matches && item.matches(S.user)) || (!isAssistantItem(item) && !!(item.querySelector && item.querySelector(S.user))));
  const allItems = () => {
    const items = [...document.querySelectorAll(TURN_SEL)]
      .filter((item) => !(item.closest && item.closest("#zs-root")));
    // Deduplicate nested matches (e.g. [data-is-streaming] wrapping .font-claude-message)
    return items.filter((item) => {
      const parent = item.parentElement;
      return !(parent && parent.closest && parent.closest(TURN_SEL));
    });
  };
  const assistantItems = () => allItems().filter(isAssistantItem);
  const assistantCount = () => assistantItems().length;
  const userCount = () => allItems().filter(isUserItem).length;
  const lastAssistant = () => {
    const items = assistantItems();
    return items.length ? items[items.length - 1] : null;
  };
  const bodyOf = (item) => {
    if (!item) return null;
    if (item.querySelector) {
      const inner = item.querySelector('[data-testid="assistant-message"], .font-claude-message, .font-claude-response');
      if (inner) return inner;
    }
    return (item.matches && item.matches(S.assistant)) ? item : (item.querySelector ? item.querySelector(S.assistant) : item);
  };
  const itemText = (item) => isAssistantItem(item)
    ? without(bodyOf(item))
    : without(item);
  const classifyText = (item, excludeSel) => without(
    isAssistantItem(item) ? bodyOf(item) : item,
    excludeSel
  );
  const chatIsEmpty = () => allItems().length === 0;

  function getEditor() {
    if (locked && visible(lockedEditor) &&
        !(lockedEditor.closest && lockedEditor.closest("#zs-root")) &&
        !(lockedEditor.closest && lockedEditor.closest(S.user)) &&
        !(lockedEditor.closest && lockedEditor.closest(S.assistant))) return lockedEditor;
    const candidates = [...document.querySelectorAll(S.editor)].filter(
      (editor) => !(editor.closest && editor.closest("#zs-root")) &&
                  !(editor.closest && editor.closest(S.user)) &&
                  !(editor.closest && editor.closest(S.assistant)) &&
                  visible(editor)
    );
    const rich = candidates.filter((ed) => !(ed instanceof HTMLTextAreaElement) && ed.tagName !== "TEXTAREA");
    return rich[0] || candidates[0] || null;
  }
  const editorText = () => {
    const editor = getEditor();
    if (!editor) return "";
    if (editor instanceof HTMLTextAreaElement || editor.tagName === "TEXTAREA") return editor.value || "";
    return editor.innerText !== undefined ? editor.innerText : (editor.textContent || "");
  };
  const isFreshChat = () => chatIsEmpty() && !!getEditor();
  const composerFrame = () => {
    const editor = getEditor();
    if (!editor) return null;
    if (typeof editor.closest === "function") {
      return editor.closest("fieldset") || editor.closest("form") || editor.parentElement;
    }
    return editor.parentElement || null;
  };
  const barMount = () => {
    const frame = composerFrame();
    // Mount ABOVE the whole composer card (outside it) so the bar never overlaps
    // the editor's absolutely-positioned placeholder ("Reply"). The card is the
    // nearest ancestor of the editor with a visible border and a large radius.
    let card = frame;
    const editor = getEditor();
    for (let el = editor, i = 0; el && el !== document.body && i < 12; el = el.parentElement, i++) {
      try {
        const cs = getComputedStyle(el);
        if (parseFloat(cs.borderTopLeftRadius) >= 16 && parseFloat(cs.borderTopWidth) > 0) {
          card = el;
          break;
        }
      } catch {}
    }
    return card && card.parentElement ? { parent: card.parentElement, before: card } : null;
  };
  const barAnchor = () => {
    const editor = getEditor();
    if (!editor) return null;
    if (typeof editor.closest === "function") {
      return (
        editor.closest("fieldset") ||
        editor.closest("form") ||
        editor.closest('[data-testid="chat-input-grid-container"]') ||
        editor.parentElement ||
        editor
      );
    }
    return editor;
  };

  const ids = new WeakMap();
  let nextId = 0;
  function lastAssistantId() {
    const item = lastAssistant();
    if (!item) return null;
    if (!ids.has(item)) ids.set(item, ++nextId);
    return ids.get(item);
  }
  const streamText = (item) => without(bodyOf(item));
  const streamLen = (item) => streamText(item === undefined ? lastAssistant() : item).length;
  let sampledItem = null;
  let sampledLen = 0;
  let grewAt = 0;
  function sampleStream() {
    const item = lastAssistant();
    const length = streamText(item).length;
    const now = Date.now();
    if (item !== sampledItem || length < sampledLen - 400) {
      sampledItem = item;
      sampledLen = length;
      grewAt = now;
    } else if (length > sampledLen) {
      sampledLen = length;
      grewAt = now;
    }
  }
  const hasSendLabel = (el) => {
    if (!el) return false;
    const label = [
      el.getAttribute("aria-label"),
      el.getAttribute("data-testid"),
      el.textContent,
      el.innerText,
    ].filter(Boolean).join(" ");
    return /(\bSend\b|\bKirim\b|send message|send\s+message)/i.test(label);
  };
  const sendButton = () => {
    const candidates = [...document.querySelectorAll("button, [role='button']")]
      .filter((el) => !el.closest("#zs-root"))
      .filter((el) => visible(el));
    for (const candidate of candidates) {
      if (candidate.matches(S.send) || hasSendLabel(candidate)) {
        const ariaDisabled = candidate.getAttribute("aria-disabled");
        const disabled = candidate.disabled || ariaDisabled === "true";
        if (!disabled) return candidate;
      }
    }
    return null;
  };
  const stopButton = () => [...document.querySelectorAll(S.stop)].find(visible) || null;
  const isHardGenerating = () =>
    !!stopButton() || !!(document.querySelector && document.querySelector('[data-is-streaming="true"]'));
  const isGenerating = () => {
    sampleStream();
    return isHardGenerating() || (sampledLen > 0 && Date.now() - grewAt < timings.GEN_IDLE_MS);
  };
  const isBusyNow = isGenerating;

  function snapshot() {
    return { th: 0, rp: streamLen() };
  }
  function readAssistant() {
    const item = lastAssistant();
    return {
      present: !!item,
      reply: item ? without(bodyOf(item)).trim() : "",
      thinking: "",
      item,
    };
  }
  async function waitFor(predicate, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (predicate()) return true;
      await sleep(120);
    }
    return false;
  }

  function setInputLock(on) {
    const editor = on ? getEditor() : (visible(lockedEditor) ? lockedEditor : getEditor());
    locked = on;
    lockedEditor = on ? editor : null;
    if (!editor) return;
    if (editor instanceof HTMLTextAreaElement || editor.tagName === "TEXTAREA") {
      if (on) editor.setAttribute("readonly", "");
      else editor.removeAttribute("readonly");
    } else {
      editor.setAttribute("contenteditable", on ? "false" : "true");
    }
  }
  const INSERT_CHUNK_LINES = 25;
  async function writeText(editor, text) {
    if (editor instanceof HTMLTextAreaElement || editor.tagName === "TEXTAREA") {
      editor.removeAttribute("readonly");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      if (setter && setter.set) setter.set.call(editor, text);
      else editor.value = text;
      editor.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text,
      }));
      try { editor.dispatchEvent(new Event("change", { bubbles: true })); } catch {}
      return;
    }
    editor.setAttribute("contenteditable", "true");
    await sleep(20);
    if (editor.focus) editor.focus();
    const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
    if (selection && typeof document.createRange === "function") {
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const lines = String(text).split("\n");
    if (typeof document.execCommand === "function") {
      for (let i = 0; i < lines.length; i++) {
        if (typeof document.activeElement !== "undefined" && document.activeElement !== editor && editor.focus) {
          editor.focus();
        }
        if (lines[i]) document.execCommand("insertText", false, lines[i]);
        if (i < lines.length - 1) document.execCommand("insertLineBreak");
        if (i && i % INSERT_CHUNK_LINES === 0) await sleep(0);
      }
    }
    const current = (editor.innerText !== undefined ? editor.innerText : (editor.textContent || "")).trim();
    if (!current && String(text).trim()) {
      diag("send.domFallback", { len: String(text).length });
      try {
        while (editor.firstChild) editor.removeChild(editor.firstChild);
        for (const line of lines) {
          const p = document.createElement("p");
          if (line) p.textContent = line;
          else p.appendChild(document.createElement("br"));
          editor.appendChild(p);
        }
      } catch {
        editor.textContent = text;
      }
      try {
        editor.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: text,
        }));
      } catch {}
    }
  }
  async function typeAndSend(text) {
    const editor = getEditor();
    if (!editor) throw new Error("Claude input box not found");
    const beforeUsers = userCount();
    const relock = locked;
    try {
      await writeText(editor, text);
      await waitFor(() => {
        const button = sendButton();
        return !!button && !button.disabled && button.getAttribute("aria-disabled") !== "true";
      }, 4000);
      const button = sendButton();
      if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") {
        button.click();
      } else {
        const o = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
        editor.dispatchEvent(new KeyboardEvent("keydown", o));
        editor.dispatchEvent(new KeyboardEvent("keyup", o));
        const form = typeof editor.closest === "function" ? editor.closest("form") : null;
        if (form && typeof form.requestSubmit === "function" && editorText().trim() !== "") {
          try { form.requestSubmit(); } catch {}
        }
      }
      await waitFor(() =>
        editorText().trim() === "" || userCount() > beforeUsers || isHardGenerating(),
      5000);
    } finally {
      if (relock) {
        if (editor instanceof HTMLTextAreaElement || editor.tagName === "TEXTAREA") {
          editor.setAttribute("readonly", "");
        } else {
          editor.setAttribute("contenteditable", "false");
        }
      }
    }
  }
  function stopGeneration() {
    const button = stopButton();
    if (button) button.click();
  }
  const enforceComposer = () => ({ ready: !!getEditor() });
  async function ensureComposerReady(reason) {
    const ready = !!getEditor();
    diag("mode_ready", { reason, provider: "claude", ready });
    return { ready };
  }

  function scanError() {
    try {
      const conversation = document.querySelector('[data-testid*="conversation"]');
      for (const el of document.querySelectorAll(S.errors)) {
        if (!visible(el) || el.closest("#zs-root")) continue;
        if (conversation && conversation.contains(el)) continue;
        const text = (el.innerText || el.textContent || "").trim();
        if (text.length > 8 && text.length < 600) return text.slice(0, 240);
      }
    } catch (error) {
      diag("error.scanFailed", { message: String(error && error.message || error) });
    }
    return getEditor() ? null : "The Claude input box is not available.";
  }
  const isTooLongMsg = (text) => /conversation.{0,30}(too long|limit)|context.{0,20}limit/i.test(text);
  const isBusyMsg = (text) => /try again later|temporarily unavailable|rate limit|too many requests/i.test(text);
  const turnHalted = () => false;
  const findContinueBtn = () => null;
  const clickContinueBtn = () => false;
  const conversationKey = () =>
    location.pathname === "/" || location.pathname === "/new" ? "" : location.pathname;

  function installSendHooks(handlers) {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      const editor = getEditor();
      if (!editor || !editor.contains(event.target) || !editorText().trim()) return;
      if (handlers.isBlocked()) return;
      if (!handlers.isStarted()) {
        if (chatIsEmpty()) handlers.onBlockedAttempt();
        return;
      }
      handlers.onUserMessage(assistantCount());
    }, true);
    document.addEventListener("click", (event) => {
      const target = event.target;
      const button = target && target.closest ? target.closest("button") : null;
      if (!button || !getEditor()) return;
      if (button.matches(S.stop) || button.closest(S.stop)) {
        handlers.onNativeStop();
        return;
      }
      if (!(button.matches(S.send) || button.closest(S.send)) ||
          button.disabled || button.getAttribute("aria-disabled") === "true") return;
      if (handlers.isBlocked()) return;
      if (!handlers.isStarted()) {
        if (chatIsEmpty()) handlers.onBlockedAttempt();
        return;
      }
      handlers.onUserMessage(assistantCount());
    }, true);
  }

  const commandShape = /"(?:command|tool)"\s*:\s*"|###\s*(?:lua|mcp_tool)/i;
  function findToolBlockSpot(item) {
    const body = bodyOf(item);
    if (!body) return null;
    let found = null;
    body.querySelectorAll("pre,code,p,li").forEach((el) => {
      if (el.closest(".zs-chip, .zs-tool-hide")) return;
      const text = (el.textContent || "").trim();
      if (text && commandShape.test(text)) {
        el.classList.add("zs-tool-hide");
        found = found || { parent: el.parentElement, ref: el };
      }
    });
    return found;
  }

  return {
    id: "claude",
    displayName: "Claude",
    sendRetryLimit: 3,
    supportsVision: false,
    timings,
    without,
    chipAtItemLevel: true,
    reliableCounts: true,
    init({ diag: d } = {}) { if (d) diag = d; },
    allItems, isUserItem, isAssistantItem, itemText, classifyText,
    assistantCount, userCount, lastAssistant, lastAssistantId, readAssistant,
    streamLen, snapshot,
    getEditor, editorText, chatIsEmpty, isFreshChat, composerFrame, barMount, barAnchor,
    setInputLock, typeAndSend, stopGeneration,
    isGenerating, isBusyNow, isHardGenerating,
    enforceComposer, ensureComposerReady,
    turnHalted, findContinueBtn, clickContinueBtn,
    scanError, isTooLongMsg, isBusyMsg,
    attachImages: () => false,
    clearAttachments: () => {},
    conversationKey, installSendHooks, findToolBlockSpot,
  };
})();
