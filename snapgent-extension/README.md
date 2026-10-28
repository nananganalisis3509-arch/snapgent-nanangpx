# snapgentV3 Free - AI agent for ChatGPT, Claude, DeepSeek, Gemini, Grok, Kimi, GLM, Qwen, Arena, Meta AI, Ptero, Perplexity, Mistral Vibe, Copilot, and Poe

snapgentV3 turns a supported web AI chat into an agent for VS Code or Roblox Studio. It connects ChatGPT, Claude, DeepSeek, Google Gemini, Grok, Kimi, GLM, Qwen, Arena, Meta AI, Ptero, Perplexity, Mistral Vibe, Microsoft Copilot, and Poe to local MCP tools. No API key is needed for the browser-based providers.

It's a Chrome/Edge browser extension plus a local bridge that connects chat to Roblox Studio or VS Code through MCP. Provider behavior varies by model and session; Grok requires signing in to xAI, and Arena must use **Direct** mode. The new integrations share a common adapter and do not support image input yet.

VS Code is the default **MCP target**. The bridge can start before VS Code, but open the intended project folder in VS Code before clicking **Start** in the chat bar. You can switch to Roblox Studio in the chat bar when its MCP server is enabled. The AI selector beside it opens the supported chat providers.

## Setup

**Load the extension manually (Edge or Chrome):**
1. Go to `edge://extensions` (Edge) or `chrome://extensions` (Chrome)
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `snapgent-extension` folder
5. The extension is now active

**Then set up the Bridge:**
1. **Download the Bridge** from the [SnapgentV3 release](https://github.com/herdodp/snapgent-connector/releases/tag/V3)
2. **Run the Bridge** - on Windows, double-click `start.bat`; it configures MCP automatically and can run before VS Code is open. Open the project folder in VS Code before clicking **Start** in the chat bar. Roblox Studio is optional: open a place and enable **Assistant AI** > **...** > **Manage MCP Servers** > **Enable Studio as MCP Server** to use that target too.
3. Open a new chat on a supported site: DeepSeek, ChatGPT, Claude, Gemini, Grok, Kimi, Z.ai, Qwen, Arena, Meta AI, Ptero, Perplexity, Mistral Vibe, Microsoft Copilot, or Poe. Sign in where required; on Arena use Direct mode and on Poe choose the bot you want first.
4. Click **Start session** in the snapgentV3 panel
5. Type what you want to build

The included bridge is Windows-only. macOS/Linux support requires a native `bridge` binary or `bridge.py`.

## Architecture (for contributors)

The extension is split between a provider-agnostic core and per-AI-site providers:

```
core/config.js        system prompt, feedback strings, tool categories (global ZS)
core/parser.js        snapgentV3 command parsing - pure string logic   (global ZSParse)
core/main.js          agentic loop, UI, camouflage, session state      (uses ZSProvider)
providers/deepseek.js everything DeepSeek-specific: DOM selectors, generation
                      detection, send mechanics, composer modes…       (global ZSProvider)
providers/gemini.js   same interface for Google Gemini (Angular DOM, Quill
                      composer, code-block masking)                    (global ZSProvider)
providers/claude.js   same interface for Claude (contenteditable composer,
                      message and generation detection)                 (global ZSProvider)
providers/kimi.js     same interface for Kimi / Moonshot AI (Vue DOM, Lexical
                      composer, segment-code masking)                  (global ZSProvider)
providers/glm.js      same interface for GLM / Z.ai (Svelte DOM, code-block
                      wrapper masking)                                 (global ZSProvider)
providers/qwen.js     same interface for Qwen / chat.qwen.ai (Vue DOM, network-tap
                      SSE stream, Monaco disposal guard)               (global ZSProvider)
providers/qwen-net.js MAIN-world fetch tap for Qwen SSE stream        (injected by manifest)
providers/chatgpt.js  same interface for ChatGPT / chatgpt.com (React DOM,
                      ProseMirror composer, CodeMirror reply reading) (global ZSProvider)
providers/chatgpt-cm.js MAIN-world CodeMirror tap: republishes each code block's
                      TRUE document (the rendered DOM truncates long
                      lines)                                          (injected by manifest)
providers/arena.js    same interface for Arena / arena.ai (React DOM, multi-model
                      playground, A/B-comparison auto-commit, Direct-mode gate) (global ZSProvider)
providers/meta.js     same interface for Meta AI / meta.ai (React DOM, textarea
                      composer, JSON-viewer + code-collapse masking)   (global ZSProvider)
providers/ptero.js    same interface for Ptero / ptero.pro (textarea composer,
                      message and generation detection)                 (global ZSProvider)
providers/grok.js     same interface for Grok / grok.com (ProseMirror
                      composer, message and generation detection)        (global ZSProvider)
providers/extra-chat.js shared adapter for Perplexity, Mistral Vibe,
                      Microsoft Copilot, and Poe                        (global ZSProvider)
background.js         WebSocket to the local bridge (provider-agnostic)
```

`core/main.js` never touches the host site's DOM directly - it only calls the
`ZSProvider` interface. To integrate another AI site: write a provider adapter
exporting the same interface, then add its URL to `manifest.json`,
`PROVIDER_URLS` in `background.js`, `SUPPORTED_HOSTS` in `popup.js`, and
`AI_SITES` in `core/main.js`. The four new sites use the shared
`providers/extra-chat.js` adapter.

Smoke tests (plain Node, no dependencies - run them from this directory):

- `node test-parser.js` - the command parser (`core/parser.js`).
- `node test-chatgpt.js` - ChatGPT reply reading (`providers/chatgpt.js`),
  driven against a stub DOM: CodeMirror line joining, the `data-zs-cm`
  MAIN-world tap that long code blocks depend on, and subtree exclusion.

Both print `PASS`/`FAIL` per case and exit non-zero on failure.
