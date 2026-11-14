/** AI Exporter - validate local export requests and open isolated preview tabs. */
const contextMenuId = "ai-exporter-export-chat";
const SUPPORTED_PATTERNS = [
  "https://*.chatgpt.com/*", "https://chat.openai.com/*", "https://*.claude.ai/*",
  "https://gemini.google.com/*", "https://*.deepseek.com/*"
];
const MAX_MESSAGES = 4000;
const MAX_BYTES = 8 * 1024 * 1024;
const HANDOFF_PREFIX = "export:";
const HANDOFF_TTL = 10 * 60 * 1000;
const BLOCK_TYPES = new Set([
  "heading", "subheading", "paragraph", "list", "quote", "code", "table", "image", "formula", "divider"
]);

// Conversation text must never be silently shortened. Reject limits explicitly.
function text(value, limit) {
  if (typeof value !== "string") return "";
  if (value.length > limit) throw new Error("A conversation field is too large. Select fewer messages or a smaller code sample.");
  return value;
}
function stringList(value, limit, itemLimit) {
  if (!Array.isArray(value)) return [];
  if (value.length > limit) throw new Error("A list or table is too large. Select a smaller portion of the conversation.");
  return value.map((item) => text(item, itemLimit));
}
function normalizeRole(role) {
  return ["user", "assistant", "system"].includes(role) ? role : "unknown";
}
function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  if (blocks.length > 3000) throw new Error("This message contains too many blocks. Select fewer messages.");
  return blocks.filter((block) => block && typeof block === "object" && BLOCK_TYPES.has(block.type)).map((block) => {
    switch (block.type) {
      case "heading":
      case "subheading":
        return { type: block.type, level: Math.max(1, Math.min(6, Number(block.level) || 2)), number: text(block.number, 20), text: text(block.text, 400000) };
      case "paragraph":
      case "quote":
        return { type: block.type, text: text(block.text, 400000) };
      case "list": {
        const list = { type: "list", ordered: Boolean(block.ordered), items: stringList(block.items, 300, 400000) };
        // Nesting is part of the document: carry it through the handoff or the
        // export tab receives a flat list.
        if (Array.isArray(block.depths) && block.depths.length === list.items.length) {
          list.depths = block.depths.map((depth) => Math.max(0, Math.min(8, Math.floor(Number(depth)) || 0)));
        }
        if (Array.isArray(block.orders) && block.orders.length === list.items.length) {
          list.orders = block.orders.map((ordered) => Boolean(ordered));
        }
        return list;
      }
      case "code":
        return { type: "code", language: text(block.language, 40), code: text(block.code, 400000), output: Boolean(block.output) };
      case "table":
        if (Array.isArray(block.rows) && block.rows.length > 500) throw new Error("This table has too many rows. Select a smaller portion.");
        return { type: "table", head: stringList(block.head, 20, 20000), rows: Array.isArray(block.rows) ? block.rows.map((row) => stringList(row, 20, 20000)) : [] };
      case "image": {
        const source = text(block.src, 2 * 1024 * 1024);
        const safeData = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(source);
        let safeRemote = false;
        try {
          const url = new URL(source);
          safeRemote = url.protocol === "https:" && !url.username && !url.password;
        } catch {}
        return {
          type: "image", src: safeData || safeRemote ? source : "",
          alt: text(block.alt, 20000), caption: text(block.caption, 20000),
          kind: ["image", "diagram", "chart", "infographic"].includes(block.kind) ? block.kind : "image",
          width: Number.isFinite(Number(block.width)) && Number(block.width) > 0 ? Math.min(20000, Number(block.width)) : undefined,
          height: Number.isFinite(Number(block.height)) && Number(block.height) > 0 ? Math.min(20000, Number(block.height)) : undefined,
          unavailableReason: text(block.unavailableReason, 1000) || (source && !safeData && !safeRemote ? "Unsupported or unsafe image source." : "")
        };
      }
      case "formula":
        return { type: "formula", tex: text(block.tex, 20000) };
      default:
        return { type: "divider" };
    }
  });
}
function sanitizeChat(chat) {
  if (!chat || typeof chat !== "object" || !Array.isArray(chat.messages)) return null;
  if (!chat.messages.length || chat.messages.length > MAX_MESSAGES) return null;
  const messages = chat.messages.filter((message) => message && typeof message === "object").map((message, index) => {
    const blocks = sanitizeBlocks(message.blocks);
    return {
      id: text(message.id, 200), index, role: normalizeRole(message.role), text: text(message.text, 400000), blocks,
      codeBlocks: blocks.filter((block) => block.type === "code").map((block) => ({ language: block.language, code: block.code })),
      formulas: blocks.filter((block) => block.type === "formula").map((block) => ({ tex: block.tex, display: true })),
      timestamp: typeof message.timestamp === "string" ? text(message.timestamp, 40) : null
    };
  });
  if (!messages.length) return null;
  /* Partial-extraction counts are diagnostics, not content: clamped numbers
     only, so the workspace can warn without carrying page text across. */
  const coverage = chat.coverage && typeof chat.coverage === "object"
    ? {
        unreadable: Math.max(0, Math.min(MAX_MESSAGES, Math.floor(Number(chat.coverage.unreadable) || 0))),
        detected: Math.max(0, Math.min(MAX_MESSAGES, Math.floor(Number(chat.coverage.detected) || messages.length)))
      }
    : null;
  const exportedAt = text(chat.exportedAt, 40);
  return {
    version: 1, title: text(chat.title, 200) || "AI conversation", platform: text(chat.platform, 40),
    platformLabel: text(chat.platformLabel, 60), model: chat.model ? text(chat.model, 60) : null,
    url: text(chat.url, 2000), exportedAt: exportedAt && Number.isFinite(Date.parse(exportedAt)) ? exportedAt : new Date().toISOString(),
    coverage,
    messageCount: messages.length, messages
  };
}
function sanitizeOptions(options) {
  const source = options && typeof options === "object" ? options : {};
  return {
    format: ["pdf", "markdown", "txt", "docx", "image", "json", "html"].includes(source.format) ? source.format : null,
    theme: source.theme === "dark" ? "dark" : source.theme === "print" ? "print" : "light",
    docMode: source.docMode === "bw" ? "bw" : "color", timestamps: Boolean(source.timestamps),
    highlight: source.highlight !== false,
    // Opening straight on the message list is a navigation hint, not content.
    view: source.view === "messages" ? "messages" : "",
    // Loading remote images always requires consent in this preview, not a saved preference.
    remoteImages: false
  };
}
function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: contextMenuId, title: "Export this AI chat", contexts: ["page", "selection", "link", "image"], documentUrlPatterns: SUPPORTED_PATTERNS
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("AI Exporter context menu could not be registered:", chrome.runtime.lastError.message);
      }
    });
  });
}

/* A tab that was already open when the extension was installed, reloaded or
   updated has no content script. The popup handles that case by injecting the
   parser and content script on demand; the context-menu path must do the same,
   otherwise its message is silently dropped and right-click export does
   nothing. */
async function ensureContentScript(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (pong && pong.injected) return true;
  } catch {
    // Nothing is listening yet; inject below.
  }
  try {
    // The stylesheet may already be present even when the listener is gone;
    // a CSS failure must not stop the script injection that restores it.
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content/content.css"] }).catch(() => {});
    await chrome.scripting.executeScript({
      target: { tabId }, files: ["utils/parser.js", "content/content.js"]
    });
    const pong = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return Boolean(pong && pong.injected);
  } catch (error) {
    console.warn("AI Exporter could not attach to this tab:", error);
    return false;
  }
}

chrome.runtime.onInstalled.addListener(registerContextMenu);
chrome.runtime.onStartup.addListener(registerContextMenu);
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== contextMenuId || !tab || tab.id === undefined) return;
  (async () => {
    if (!(await ensureContentScript(tab.id))) return;
    const response = await chrome.tabs.sendMessage(tab.id, { type: "CONTEXT_EXPORT", format: "pdf" });
    if (!response || !response.ok) {
      console.warn("AI Exporter context-menu export did not start:", response && response.error);
    }
  })().catch((error) => console.warn("AI Exporter context-menu export failed:", error));
});

// Serialize quota checks/writes without making different previews share data.
let handoffQueue = Promise.resolve();
async function openExport(chat, options) {
  const stored = await chrome.storage.session.get(null);
  const expired = Object.keys(stored).filter((key) => key.startsWith(HANDOFF_PREFIX) &&
    (!stored[key] || !Number.isFinite(stored[key].createdAt) || Date.now() - stored[key].createdAt >= HANDOFF_TTL));
  // Remove the obsolete shared slot left by older versions as well.
  for (const key of ["pendingExport", "pendingExportOptions"]) if (key in stored) expired.push(key);
  if (expired.length) await chrome.storage.session.remove(expired);
  for (const key of expired) delete stored[key];
  const id = crypto.randomUUID();
  const key = HANDOFF_PREFIX + id;
  const value = { chat, options, createdAt: Date.now() };
  if (byteLength({ ...stored, [key]: value }) > MAX_BYTES) {
    throw new Error("Too many conversations are waiting to export. Let the existing previews load, then try again.");
  }
  await chrome.storage.session.set({ [key]: value });
  try {
    const target = `export/export.html?export=${id}${options && options.view === "messages" ? "&tab=messages" : ""}`;
    const tab = await chrome.tabs.create({ url: chrome.runtime.getURL(target) });
    return { ok: true, tabId: tab && tab.id };
  } catch (error) {
    await chrome.storage.session.remove(key);
    throw error;
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "OPEN_EXPORT_VIEW") return false;
  if (!sender || sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "Rejected an export request from an unknown sender." });
    return false;
  }
  let chat;
  try {
    if (byteLength(message.chat) > MAX_BYTES) throw new Error("This conversation is too large to export at once. Select fewer messages.");
    chat = sanitizeChat(message.chat);
    if (!chat) throw new Error("This conversation could not be prepared for export.");
    if (byteLength(chat) > MAX_BYTES) throw new Error("This conversation is too large to export at once. Select fewer messages.");
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
    return false;
  }
  const request = handoffQueue.then(() => openExport(chat, sanitizeOptions(message.options)));
  handoffQueue = request.catch(() => {});
  request.then(sendResponse, (error) => sendResponse({ ok: false, error: error.message || "Could not open the export view." }));
  return true;
});
