/**
 * AI Exporter - site-aware conversation parser.
 *
 * Runs in the content-script world (loaded before content.js) and is also
 * loadable by the self-check page. It never touches the network.
 *
 * Message shape (see AGENTS.md):
 *   { id, index, role, text, blocks, codeBlocks, formulas, timestamp }
 *
 * blocks keep the structure exporters need, so nothing has to re-parse site
 * HTML later:
 *   { type: "heading", level, text }
 *   { type: "paragraph", text }
 *   { type: "list", ordered, items: [string] }
 *   { type: "quote", text }
 *   { type: "code", language, code }
 *   { type: "table", head: [string], rows: [[string]] }
 *   { type: "image", src, alt }
 *   { type: "formula", tex }
 *   { type: "divider" }
 *
 * Inline text keeps lightweight markers so exporters can rebuild emphasis:
 * **bold**, *italic*, `code`, $tex$.
 *
 * Strategy: one small adapter per platform, each a list of { selector, role }
 * candidates. Candidates are de-duplicated, containment-filtered, ordered by
 * document position, and validated. When nothing plausible is found we return
 * an empty list - we never export page chrome.
 */
(() => {
  "use strict";

  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "INPUT", "SELECT",
    "BUTTON", "LABEL", "SVG", "CANVAS", "IFRAME", "VIDEO", "AUDIO", "FORM",
    "LINK", "META", "HEAD"
  ]);

  const BLOCK_TAGS = new Set([
    "P", "DIV", "SECTION", "ARTICLE", "UL", "OL", "LI", "PRE", "TABLE",
    "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "FIGURE", "IMG", "HR",
    "DL", "DT", "DD", "DETAILS", "SUMMARY"
  ]);

  const CHROME_TAGS = new Set(["NAV", "ASIDE", "HEADER", "FOOTER"]);

  const PLATFORMS = [
    { id: "chatgpt", label: "ChatGPT", host: /(^|\.)(chatgpt\.com|chat\.openai\.com)$/i },
    { id: "claude", label: "Claude", host: /(^|\.)claude\.ai$/i },
    { id: "gemini", label: "Gemini", host: /(^|\.)gemini\.google\.com$/i },
    { id: "deepseek", label: "DeepSeek", host: /(^|\.)(deepseek\.com|chat\.deepseek\.com)$/i }
  ];

  // Verified against a live ChatGPT conversation: each turn is a
  // <section data-testid="conversation-turn-N">, the role attribute sits on a
  // descendant, and the message body is .markdown (assistant) or a
  // .whitespace-pre-wrap div (user).
  const CHATGPT = [
    { selector: 'section[data-testid^="conversation-turn"]', role: roleFromAttribute },
    { selector: '[data-testid^="conversation-turn"]', role: roleFromAttribute },
    { selector: "[data-message-author-role]", role: roleFromAttribute }
  ];

  const CLAUDE = [
    { selector: '[data-testid="user-message"]', role: () => "user" },
    // Current build uses .font-claude-response; older builds used
    // .font-claude-message. Keep both, newest first.
    { selector: ".font-claude-response", role: () => "assistant" },
    { selector: ".font-claude-message", role: () => "assistant" },
    { selector: '[data-testid="assistant-message"]', role: () => "assistant" },
    { selector: '[data-testid="claude-response"]', role: () => "assistant" }
  ];

  const GEMINI = [
    { selector: "user-query-content", role: () => "user" },
    { selector: "user-query", role: () => "user" },
    { selector: "model-response", role: () => "assistant" },
    { selector: ".query-content", role: () => "user" }
  ];

  // DeepSeek ships hashed class names, so this adapter is intentionally thin:
  // the assistant body is stable, and the structural fallback below covers the
  // rest when the hash rotates.
  const DEEPSEEK = [
    { selector: ".ds-markdown", role: () => "assistant" },
    { selector: '.ds-message [class*="markdown"]', role: () => "assistant" },
    { selector: '[class*="fbb737a4"]', role: () => "user" }
  ];

  const ADAPTERS = {
    chatgpt: CHATGPT,
    claude: CLAUDE,
    gemini: GEMINI,
    deepseek: DEEPSEEK,
    // Unknown host: only highly specific AI-chat hooks are trusted.
    generic: [...CHATGPT, ...CLAUDE, ...GEMINI]
  };

  // Only these tokens are accepted as a code-block language hint, so ordinary
  // short paragraphs above a code block ("Example", "Note") stay in the text.
  const KNOWN_LANGUAGES = new Set(
    ("java javascript js typescript ts tsx jsx python py c cpp c++ csharp cs go golang rust ruby php " +
      "swift kotlin scala sql html css scss sass less json xml yaml yml bash sh shell shellscript " +
      "powershell ps1 zsh r matlab dart lua perl assembly asm text plaintext txt output console " +
      "terminal markdown md vue graphql dockerfile makefile ini toml latex tex diff patch")
      .split(" ")
  );

  function languageToken(value) {
    const token = String(value || "").trim().toLowerCase().replace(/^language-/, "");
    return KNOWN_LANGUAGES.has(token) ? token : "";
  }

  const MODEL_SELECTORS = [
    '[data-testid="model-switcher-label"]',
    '[data-testid*="model-switcher"]',
    '[data-test-id="model-name"]',
    'button[aria-label*="model" i]'
  ];

  /* ------------------------------------------------------------------ roles */

  function normalizeRole(value) {
    const role = String(value || "").trim().toLowerCase();
    if (role === "user" || role === "human" || role === "you") return "user";
    if (role === "assistant" || role === "ai" || role === "model" || role === "bot") return "assistant";
    if (role === "system") return "system";
    return "unknown";
  }

  function roleFromAttribute(element) {
    const own = element.getAttribute("data-message-author-role");
    if (own) return own;
    const inner = element.querySelector("[data-message-author-role]");
    if (inner) return inner.getAttribute("data-message-author-role");
    return element.getAttribute("data-author") || "";
  }

  function platformFor(hostname) {
    const host = String(hostname || "");
    return PLATFORMS.find((platform) => platform.host.test(host)) || null;
  }

  /* ------------------------------------------------------- inline text model */

  function plainOf(element) {
    return inlineOf(element).replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "").trim();
  }

  function inlineOf(element) {
    let out = "";
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          out += child.textContent;
          continue;
        }
        if (child.nodeType !== 1) continue;
        const tag = child.tagName;
        if (SKIP_TAGS.has(tag)) continue;
        if (child.classList && child.classList.contains("aix-select")) continue;
        if (child.classList && child.classList.contains("katex")) {
          const tex = texOf(child);
          out += tex ? ` $${tex}$ ` : "";
          continue;
        }
        if (tag === "CODE") {
          const code = child.textContent.replace(/\s+/g, " ").trim();
          out += code ? ` \`${code}\` ` : "";
          continue;
        }
        if (tag === "BR") {
          out += " ";
          continue;
        }
        if (tag === "IMG") {
          out += child.alt ? ` [image: ${child.alt}] ` : "";
          continue;
        }
        if (tag === "STRONG" || tag === "B") {
          const text = plainOf(child);
          out += text ? ` **${text}** ` : "";
          continue;
        }
        if (tag === "EM" || tag === "I") {
          const text = plainOf(child);
          out += text ? ` *${text}* ` : "";
          continue;
        }
        visit(child);
      }
    };
    visit(element);
    return out.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  }

  /* ----------------------------------------------------------- math and code */

  function texOf(element) {
    const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation && annotation.textContent.trim()) return annotation.textContent.trim();
    const data = element.getAttribute ? element.getAttribute("data-tex") : null;
    if (data && data.trim()) return data.trim();
    return element.textContent.replace(/\s+/g, " ").trim();
  }

  function isDisplayMath(element) {
    if (element.classList &&
      (element.classList.contains("katex-display") || element.classList.contains("math-block"))) {
      return true;
    }
    return element.hasAttribute("data-math-display");
  }

  function detectLanguage(pre, code) {
    const fromCode = /(?:language|lang|highlight-source)-([\w+#.-]+)/i.exec(code.className || "");
    if (fromCode) return fromCode[1].toLowerCase();
    const fromPre = /(?:language|lang)-([\w+#.-]+)/i.exec(pre.className || "");
    if (fromPre) return fromPre[1].toLowerCase();
    if (pre.dataset && pre.dataset.language) return pre.dataset.language.toLowerCase();
    return "";
  }

  // Current ChatGPT puts the language label inside the <pre>, in the code-block
  // header next to the copy button (e.g. <div><svg/>Java</div>). Only elements
  // that come before the code body are considered, so code tokens like "C" or
  // "go" can never be mistaken for a language.
  function labelInside(pre) {
    const code = pre.querySelector("code");
    for (const element of pre.querySelectorAll("div, span")) {
      if (code && code.contains(element)) break;
      if (element.children.length > 1) continue;
      if (code && element.contains(code)) continue;
      const token = languageToken(element.textContent);
      if (token) return token;
    }
    return "";
  }

  // Older builds printed the language in a small header above the block. Reading
  // it also lets the walker consume that header instead of exporting it twice.
  function headerLanguage(pre, consumed) {
    const candidates = [
      pre.previousElementSibling,
      pre.parentElement && pre.parentElement.previousElementSibling,
      pre.parentElement &&
        pre.parentElement.querySelector('[class*="header" i], [class*="lang" i], [class*="title" i]')
    ];
    for (const node of candidates) {
      if (!node || node.nodeType !== 1 || consumed.has(node)) continue;
      const text = (node.textContent || "").trim();
      if (!text || text.length > 24 || /\s/.test(text)) continue;
      if (/^(copy|copied|code)$/i.test(text)) continue;
      const token = languageToken(text);
      if (!token) continue;
      consumed.add(node);
      return token;
    }
    return "";
  }

  // A short text-only element immediately above a code block is its language
  // label, not conversation text: remember it and drop it from the narrative.
  function languageHeaderFor(element) {
    const next = element.nextElementSibling;
    if (!next || next.tagName !== "PRE") return "";
    return languageToken(element.textContent);
  }

  function codeBlock(pre, consumed, hint) {
    const code = pre.querySelector("code") || pre;
    const raw = (code.textContent || "").replace(/\s+$/, "");
    if (!raw.trim()) return null;
    const language =
      detectLanguage(pre, code) || labelInside(pre) || hint || headerLanguage(pre, consumed) || "text";
    return { type: "code", language, code: raw };
  }

  function tableBlock(table) {
    const rows = [];
    for (const tr of table.querySelectorAll("tr")) {
      const cells = [];
      for (const cell of tr.children) {
        if (cell.tagName === "TH" || cell.tagName === "TD") cells.push(inlineOf(cell));
      }
      if (cells.length) rows.push({ cells, header: tr.querySelector("th") !== null });
    }
    if (!rows.length) return null;
    let head = [];
    let body = rows;
    if (rows[0].header || rows.length > 1) {
      head = rows[0].cells;
      body = rows.slice(1);
    }
    return { type: "table", head, rows: body.map((row) => row.cells) };
  }

  function listBlock(element) {
    const items = [];
    for (const li of element.children) {
      if (li.tagName !== "LI") continue;
      const text = inlineOf(li);
      if (text) items.push(text);
    }
    return items.length ? { type: "list", ordered: element.tagName === "OL", items } : null;
  }

  function imageBlock(element) {
    const src = element.currentSrc || element.src || "";
    if (!src) return null;
    return { type: "image", src, alt: (element.alt || "").trim() };
  }

  function hasBlockChildren(element) {
    for (const child of element.children) {
      if (BLOCK_TAGS.has(child.tagName)) return true;
    }
    return false;
  }

  function collectBlocks(root, consumed = new Set()) {
    const blocks = [];
    let pending = null;
    let pendingLanguage = "";

    const addText = (text) => {
      const trimmed = text.replace(/[ \t]+/g, " ").trim();
      if (!trimmed) return;
      pending = pending ? `${pending} ${trimmed}` : trimmed;
    };
    const flush = () => {
      if (pending) blocks.push({ type: "paragraph", text: pending });
      pending = null;
    };
    const push = (block) => {
      if (!block) return;
      flush();
      blocks.push(block);
    };

    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          addText(child.textContent);
          continue;
        }
        if (child.nodeType !== 1) continue;
        const tag = child.tagName;
        if (SKIP_TAGS.has(tag) || consumed.has(child)) continue;
        if (child.classList && child.classList.contains("aix-select")) continue;

        if (tag === "PRE") {
          push(codeBlock(child, consumed, pendingLanguage));
          pendingLanguage = "";
        } else if (tag === "TABLE") {
          push(tableBlock(child));
        } else if (tag === "IMG") {
          push(imageBlock(child));
        } else if (tag === "FIGURE" || tag === "PICTURE") {
          const image = child.querySelector("img");
          const caption = child.querySelector("figcaption");
          const block = image ? imageBlock(image) : null;
          if (block) {
            block.alt = block.alt || (caption ? caption.textContent.trim() : "");
            push(block);
          }
        } else if (tag === "HR") {
          push({ type: "divider" });
        } else if (tag === "BLOCKQUOTE") {
          const text = inlineOf(child);
          if (text) push({ type: "quote", text });
        } else if (/^H[1-6]$/.test(tag)) {
          const text = inlineOf(child);
          if (text) push({ type: "heading", level: Number(tag[1]), text });
        } else if (tag === "UL" || tag === "OL") {
          push(listBlock(child));
        } else if (isDisplayMath(child)) {
          const tex = texOf(child);
          if (tex) push({ type: "formula", tex });
        } else if (!hasBlockChildren(child)) {
          const text = inlineOf(child);
          if (!text) continue;
          const hint = languageHeaderFor(child);
          if (hint) {
            pendingLanguage = hint;
            continue;
          }
          if (tag === "P") push({ type: "paragraph", text });
          else addText(text);
        } else {
          flush();
          walk(child);
          flush();
        }
      }
    };

    walk(root);
    flush();
    return blocks;
  }

  /* ------------------------------------------------------------ message text */

  function tableToText(table) {
    const lines = [];
    if (table.head.length) {
      lines.push(`| ${table.head.join(" | ")} |`);
      lines.push(`| ${table.head.map(() => "---").join(" | ")} |`);
    }
    for (const row of table.rows) lines.push(`| ${row.join(" | ")} |`);
    return lines.join("\n");
  }

  function blocksToText(blocks) {
    const out = [];
    for (const block of blocks) {
      switch (block.type) {
        case "heading":
          out.push(`${"#".repeat(block.level)} ${block.text}`);
          break;
        case "paragraph":
          out.push(block.text);
          break;
        case "list":
          out.push(block.items.map((item) => `- ${item}`).join("\n"));
          break;
        case "quote":
          out.push(block.text.split("\n").map((line) => `> ${line}`).join("\n"));
          break;
        case "code":
          out.push(`\`\`\`${block.language && block.language !== "text" ? block.language : ""}\n${block.code}\n\`\`\``);
          break;
        case "table":
          out.push(tableToText(block));
          break;
        case "image":
          out.push(`[image: ${block.alt || block.src}]`);
          break;
        case "formula":
          out.push(`$$${block.tex}$$`);
          break;
        default:
          break;
      }
    }
    return out.join("\n\n").trim();
  }

  /* ----------------------------------------------------------------- parsing */

  function isPageChrome(element) {
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (CHROME_TAGS.has(node.tagName)) return true;
    }
    return false;
  }

  function findTimestamp(element) {
    const time = element.querySelector("time[datetime]");
    if (time) return time.getAttribute("datetime");
    for (const node of element.querySelectorAll("[datetime], [data-timestamp]")) {
      const value = node.getAttribute("datetime") || node.getAttribute("data-timestamp");
      if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    }
    return null;
  }

  function contentRootFor(element) {
    return (
      element.querySelector(
        ".markdown, .ds-markdown, .font-claude-message, .query-text, .prose, [data-message-content]"
      ) || element
    );
  }

  function findMessages(doc, location_) {
    if (!doc || typeof doc.querySelectorAll !== "function") return [];
    const hostname = (location_ && location_.hostname) || (doc.location && doc.location.hostname) || "";
    const platform = platformFor(hostname);
    const adapters = ADAPTERS[platform ? platform.id : "generic"];

    const candidates = [];
    const seen = new Set();
    for (const adapter of adapters) {
      for (const element of doc.querySelectorAll(adapter.selector)) {
        if (seen.has(element) || isPageChrome(element)) continue;
        seen.add(element);
        candidates.push({ element, role: normalizeRole(adapter.role(element)) });
      }
    }

    // Keep the outermost candidate when one message container nests another.
    const outer = candidates.filter(
      (entry) => !candidates.some((other) => other !== entry && other.element.contains(entry.element))
    );
    outer.sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & 4 /* DOCUMENT_POSITION_FOLLOWING */ ? -1 : 1
    );

    const consumed = new Set();
    const entries = [];
    for (const candidate of outer) {
      const blocks = collectBlocks(contentRootFor(candidate.element), consumed);
      const text = blocksToText(blocks);
      if (!text && !blocks.length) continue;
      entries.push({
        element: candidate.element,
        role: candidate.role,
        blocks,
        text,
        timestamp: findTimestamp(candidate.element)
      });
    }

    // Assign stable ids and infer roles that the DOM did not expose.
    let previousRole = "assistant";
    entries.forEach((entry, index) => {
      if (entry.role === "unknown") entry.role = previousRole === "user" ? "assistant" : "user";
      previousRole = entry.role;
      const element = entry.element;
      if (!element.dataset.aixId) {
        // The app's own message id is stable; a turn's data-testid is positional
        // and shifts when the conversation changes, so it is the last resort.
        const inner = element.querySelector("[data-message-id]");
        const native =
          element.getAttribute("data-message-id") ||
          (inner ? inner.getAttribute("data-message-id") : "") ||
          element.getAttribute("data-testid") ||
          "";
        element.dataset.aixId = native ? String(native).slice(0, 80) : `msg-${index + 1}`;
      }
      entry.id = element.dataset.aixId;
      entry.index = index;
      entry.message = {
        id: entry.id,
        index,
        role: entry.role,
        text: entry.text,
        blocks: entry.blocks,
        codeBlocks: entry.blocks
          .filter((block) => block.type === "code")
          .map((block) => ({ language: block.language, code: block.code })),
        formulas: entry.blocks
          .filter((block) => block.type === "formula")
          .map((block) => ({ tex: block.tex, display: true })),
        timestamp: entry.timestamp
      };
    });

    return entries;
  }

  function cleanTitle(doc, platform) {
    const raw = ((doc && doc.title) || "").trim();
    if (raw) {
      const cleaned = raw
        .replace(/\s*[-|·]\s*(ChatGPT|Claude|Gemini|DeepSeek|Google Gemini).*$/i, "")
        .replace(/^(ChatGPT|Claude|Gemini|DeepSeek)\s*[-|·]\s*/i, "")
        .trim();
      if (cleaned) return cleaned.slice(0, 120);
    }
    return platform ? `${platform.label} conversation` : "AI conversation";
  }

  function detectModel(doc) {
    for (const selector of MODEL_SELECTORS) {
      const node = doc.querySelector(selector);
      if (!node) continue;
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text && text.length <= 40) return text;
    }
    return null;
  }

  function parse(doc, location_) {
    return findMessages(doc, location_).map((entry) => entry.message);
  }

  /**
   * Build the export-ready chat object.
   * options.only: iterable of message ids to keep (custom selection).
   */
  function parsePage(doc, location_, options) {
    const only = options && options.only ? new Set(Array.from(options.only)) : null;
    let entries = findMessages(doc, location_);
    if (only) entries = entries.filter((entry) => only.has(entry.id));
    const hostname = (location_ && location_.hostname) || (doc.location && doc.location.hostname) || "";
    const platform = platformFor(hostname);
    return {
      version: 1,
      title: cleanTitle(doc, platform),
      platform: platform ? platform.id : "unknown",
      platformLabel: platform ? platform.label : "Unknown site",
      model: detectModel(doc),
      url: (location_ && location_.href) || (doc.location && doc.location.href) || "",
      exportedAt: new Date().toISOString(),
      messageCount: entries.length,
      messages: entries.map((entry) => entry.message)
    };
  }

  globalThis.AIExporterParser = {
    parse,
    parsePage,
    findMessages,
    platformFor,
    normalizeRole,
    collectBlocks
  };
})();
