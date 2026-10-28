// Quick Node smoke test for providers/claude.js (run: node test-claude.js).
const fs = require("fs");

function txt(v) {
  return { nodeType: 3, nodeValue: v, childNodes: [] };
}
function el(tag, opts, children) {
  const o = opts || {};
  const classes = (o.class || "").split(/\s+/).filter(Boolean);
  const attrs = o.attrs || {};
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    childNodes: (children || []).map((c) => (typeof c === "string" ? txt(c) : c)),
    classList: { contains: (c) => classes.includes(c) },
    getAttribute: (n) => (n in attrs ? attrs[n] : null),
    matches: (sel) =>
      sel.split(",").map((s) => s.trim()).some((part) => {
        if (part.startsWith(".")) return classes.includes(part.slice(1));
        if (part === '[data-testid="assistant-message"]') return attrs["data-testid"] === "assistant-message";
        if (part === '[data-testid="user-message"]') return attrs["data-testid"] === "user-message";
        if (part === "[data-is-streaming]") return "data-is-streaming" in attrs;
        if (part.includes("thinking") && classes.some((c) => c.includes("thinking"))) return true;
        return false;
      }),
  };
  for (const child of node.childNodes) {
    if (child && child.nodeType === 1) child.parentElement = node;
  }
  node.closest = (sel) => {
    let cur = node;
    while (cur) {
      if (cur.matches && cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return null;
  };
  node.querySelector = (sel) => {
    const hit = (n) => {
      if (n.nodeType !== 1) return null;
      if (n.matches(sel)) return n;
      for (const c of n.childNodes) { const r = hit(c); if (r) return r; }
      return null;
    };
    for (const c of node.childNodes) { const r = hit(c); if (r) return r; }
    return null;
  };
  return node;
}

let editorNodes = [];
let turnNodes = [];
let sendBtn = null;
let streamingNode = null;
class StubTextArea {}
global.document = {
  querySelector: (sel) => {
    if (sel === '[data-is-streaming="true"]') return streamingNode;
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes("user-message") && sel.includes("assistant-message")) return turnNodes;
    if (sel.includes("chat-input")) return editorNodes;
    if (sel.includes("button")) return sendBtn ? [sendBtn] : [];
    return [];
  },
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    textContent: "",
    childNodes: [],
    appendChild(c) { this.childNodes.push(c); },
  }),
  createRange: () => ({ selectNodeContents() {} }),
  execCommand: () => false,
  addEventListener: () => {},
  body: {},
};
global.window = {
  location: { pathname: "/new" },
  getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
  HTMLTextAreaElement: StubTextArea,
};
global.location = global.window.location;
global.HTMLTextAreaElement = StubTextArea;
global.Event = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };
global.InputEvent = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };
global.KeyboardEvent = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };
global.getComputedStyle = () => ({});

const P = new Function(
  fs.readFileSync(__dirname + "/providers/claude.js", "utf8") + "; return ZSProvider;"
)();

const ok = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + "  " + name); if (!cond) process.exitCode = 1; };

// 1. Block line separation and thinking exclusion in without()
const replyTree = el("div", { class: "font-claude-message" }, [
  el("div", { class: "thinking-block" }, ["drafting command..."]),
  el("p", {}, ["Running command:"]),
  el("pre", {}, ['{"command":"list_commands","params":{}}']),
]);
const extracted = P.without(replyTree);
ok("Claude without() separates blocks with newlines and skips thinking",
  extracted.includes('Running command:\n{"command":"list_commands","params":{}}') &&
  !extracted.includes("drafting command"));

// 2. Deduplication of nested [data-is-streaming] + .font-claude-message turn nodes
const innerMsg = el("div", { class: "font-claude-message" }, [el("p", {}, ["Hello from Claude"])]);
const outerStream = el("div", { attrs: { "data-is-streaming": "false" } }, [innerMsg]);
turnNodes = [outerStream, innerMsg];
ok("Nested Claude assistant containers are deduplicated to 1 turn", P.assistantCount() === 1);
ok("Claude readAssistant extracts inner message text", P.readAssistant().reply === "Hello from Claude");

// 3. ProseMirror composer injection, send, and relock
const fieldset = {};
const proseMirror = {
  tagName: "DIV",
  isConnected: true,
  attrs: { contenteditable: "true", "data-testid": "chat-input" },
  childNodes: [],
  get firstChild() { return this.childNodes[0] || null; },
  removeChild(c) {
    const idx = this.childNodes.indexOf(c);
    if (idx >= 0) this.childNodes.splice(idx, 1);
  },
  appendChild(c) { this.childNodes.push(c); },
  get textContent() {
    return this.childNodes.map((c) => c.textContent || "").join("\n");
  },
  set textContent(v) {
    this.childNodes = [{ textContent: String(v) }];
  },
  focus() {},
  getClientRects: () => [{ width: 500, height: 48 }],
  closest: (sel) => sel === "fieldset" ? fieldset : null,
  setAttribute(k, v) { this.attrs[k] = v; },
  removeAttribute(k) { delete this.attrs[k]; },
  getAttribute(k) { return this.attrs[k] ?? null; },
  dispatchEvent() {},
};
sendBtn = {
  isConnected: true,
  disabled: false,
  getClientRects: () => [{ width: 32, height: 32 }],
  matches: () => true,
  closest: () => null,
  getAttribute: (k) => k === "aria-label" ? "Send message" : null,
  click() {
    // Claude only accepts send if editor is still contenteditable="true" at click time!
    if (proseMirror.getAttribute("contenteditable") === "true") {
      proseMirror.childNodes = [];
    }
  },
};
editorNodes = [proseMirror];
ok("Claude ProseMirror editor is detected", P.getEditor() === proseMirror);
ok("Claude barAnchor locates surrounding fieldset", P.barAnchor() === fieldset);
(async () => {
  P.setInputLock(true);
  ok("Claude editor locks with contenteditable=false", proseMirror.getAttribute("contenteditable") === "false");
  await P.typeAndSend("system prompt line 1\nsystem prompt line 2");
  ok("Claude editor remained editable during click and cleared after send", P.editorText() === "");
  ok("Claude editor relocks after send completes", proseMirror.getAttribute("contenteditable") === "false");
  P.setInputLock(false);
  ok("Claude editor unlocks cleanly", proseMirror.getAttribute("contenteditable") === "true");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
