/**
 * AI Exporter - background service worker.
 *
 * Two jobs, both small:
 *  1. own the "Export this AI chat" context menu
 *  2. accept a parsed chat from the content script or the popup, validate it,
 *     stash it for the export view and open that view
 *
 * Downloads happen in the export view (an extension page with DOM access and
 * blob URLs), so this worker never handles file data or long-lived state.
 */
const contextMenuId = "ai-exporter-export-chat";

const SUPPORTED_PATTERNS = [
  "https://*.chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://*.claude.ai/*",
  "https://gemini.google.com/*",
  "https://*.deepseek.com/*"
];

const MAX_MESSAGES = 4000;
const MAX_BYTES = 8 * 1024 * 1024;
const BLOCK_TYPES = new Set([
  "heading",
  "subheading",
  "paragraph",
  "list",
  "quote",
  "code",
  "table",
  "image",
  "formula",
  "divider"
]);

function text(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function stringList(value, limit, itemLimit) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map((item) => text(item, itemLimit));
}

function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "user" || value === "assistant" || value === "system") return value;
  return "unknown";
}

function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  const out = [];
  for (const block of blocks.slice(0, 3000)) {
    if (!block || typeof block !== "object" || !BLOCK_TYPES.has(block.type)) continue;
    switch (block.type) {
      case "heading":
      case "subheading":
        out.push({ type: block.type, level: Number(block.level) || 2, number: text(block.number, 20), text: text(block.text, 20000) });
        break;
      case "paragraph":
      case "quote":
        out.push({ type: block.type, text: text(block.text, 20000) });
        break;
      case "list":
        out.push({ type: "list", ordered: Boolean(block.ordered), items: stringList(block.items, 300, 20000) });
        break;
      case "code":
        out.push({
          type: "code",
          language: text(block.language, 40),
          code: text(block.code, 200000),
          output: Boolean(block.output)
        });
        break;
      case "table":
        out.push({
          type: "table",
          head: stringList(block.head, 20, 2000),
          rows: Array.isArray(block.rows) ? block.rows.slice(0, 500).map((row) => stringList(row, 20, 2000)) : []
        });
        break;
      case "image":
        out.push({ type: "image", src: text(block.src, 4000), alt: text(block.alt, 300) });
        break;
      case "formula":
        out.push({ type: "formula", tex: text(block.tex, 4000) });
        break;
      default:
        out.push({ type: "divider" });
        break;
    }
  }
  return out;
}

/** Rebuild a chat object the exporter can trust, or null if it is unusable. */
function sanitizeChat(chat) {
  if (!chat || typeof chat !== "object" || !Array.isArray(chat.messages)) return null;
  if (chat.messages.length === 0 || chat.messages.length > MAX_MESSAGES) return null;

  const messages = [];
  for (const message of chat.messages) {
    if (!message || typeof message !== "object") continue;
    const blocks = sanitizeBlocks(message.blocks);
    messages.push({
      id: text(message.id, 80),
      index: Number.isFinite(Number(message.index)) ? Number(message.index) : messages.length,
      role: normalizeRole(message.role),
      text: text(message.text, 400000),
      blocks,
      codeBlocks: blocks
        .filter((block) => block.type === "code")
        .map((block) => ({ language: block.language, code: block.code })),
      formulas: blocks.filter((block) => block.type === "formula").map((block) => ({ tex: block.tex, display: true })),
      timestamp: typeof message.timestamp === "string" ? message.timestamp.slice(0, 40) : null
    });
  }
  if (!messages.length) return null;

  return {
    version: 1,
    title: text(chat.title, 200) || "AI conversation",
    platform: text(chat.platform, 40),
    platformLabel: text(chat.platformLabel, 60),
    model: chat.model ? text(chat.model, 60) : null,
    url: text(chat.url, 2000),
    exportedAt: text(chat.exportedAt, 40) || new Date().toISOString(),
    messageCount: messages.length,
    messages
  };
}

function sanitizeOptions(options) {
  const source = options && typeof options === "object" ? options : {};
  const formats = ["pdf", "markdown", "txt", "docx", "image", "json"];
  return {
    format: formats.includes(source.format) ? source.format : null,
    theme: source.theme === "dark" ? "dark" : source.theme === "print" ? "print" : "light",
    docMode: source.docMode === "bw" ? "bw" : "color",
    timestamps: Boolean(source.timestamps),
    highlight: source.highlight !== false
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: contextMenuId,
      title: "Export this AI chat",
      contexts: ["page"],
      documentUrlPatterns: SUPPORTED_PATTERNS
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== contextMenuId || !tab || tab.id === undefined) return;
  // The content script is not injected on pages outside the supported sites;
  // a rejected message there is expected, so it is swallowed quietly.
  chrome.tabs.sendMessage(tab.id, { type: "CONTEXT_EXPORT", format: "pdf" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "OPEN_EXPORT_VIEW") return false;
  // Only this extension's own scripts (content scripts and extension pages) can
  // reach this listener, but the payload is still rebuilt from scratch.
  if (!sender || sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "Rejected an export request from an unknown sender." });
    return false;
  }

  const chat = sanitizeChat(message.chat);
  if (!chat) {
    sendResponse({ ok: false, error: "This conversation could not be prepared for export." });
    return false;
  }
  if (JSON.stringify(chat).length > MAX_BYTES) {
    sendResponse({ ok: false, error: "This conversation is too large to export at once." });
    return false;
  }

  chrome.storage.session.set(
    { pendingExport: chat, pendingExportOptions: sanitizeOptions(message.options) },
    () => {
      const error = chrome.runtime.lastError;
      if (error) {
        sendResponse({ ok: false, error: "Could not hand the conversation to the export view." });
        return;
      }
      chrome.tabs.create({ url: chrome.runtime.getURL("export/export.html") }, (tab) => {
        const createError = chrome.runtime.lastError;
        if (createError) sendResponse({ ok: false, error: createError.message });
        else sendResponse({ ok: true, tabId: tab && tab.id });
      });
    }
  );
  return true;
});
