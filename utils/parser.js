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

  /**
   * ChatGPT serves two layouts, chosen per account, so both have to be here.
   *
   * Original: each turn is a <section data-testid="conversation-turn-N">, the
   * role sits on a descendant, and the body is .markdown (assistant) or a
   * .whitespace-pre-wrap div (user).
   *
   * "Chat / Work" layout (rolled out per account, observed dropping every
   * marker above at once): the turn carries data-turn-key, and the message unit
   * carries data-content-search-unit-key whose value ends in ":user" or
   * ":assistant", e.g. "thread:3:assistant". The role-bearing candidates come
   * first on purpose - see the pool rule in findMessages.
   */
  const CHATGPT = [
    { selector: "[data-content-search-unit-key]", role: roleFromSearchUnit },
    { selector: "[data-turn-key]", role: roleFromTurnKey },
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

  /**
   * Role read from a marker whose value ends in the role, e.g. ChatGPT's
   * data-content-search-unit-key ("...:3:assistant") or a data-turn-key of the
   * same shape. Anything else returns "" and leaves the role to inference.
   */
  function roleFromKeySuffix(value) {
    const match = /(?:^|[:|_-])(user|human|assistant|ai|model)$/i.exec(String(value == null ? "" : value).trim());
    return match ? normalizeRole(match[1]) : "";
  }

  function roleFromSearchUnit(element) {
    return roleFromKeySuffix(element.getAttribute("data-content-search-unit-key"));
  }

  function roleFromTurnKey(element) {
    return roleFromKeySuffix(element.getAttribute("data-turn-key"));
  }

  function platformFor(hostname) {
    const host = String(hostname || "");
    return PLATFORMS.find((platform) => platform.host.test(host)) || null;
  }

  /* ------------------------------------------------------- inline text model */

  function plainOf(element) {
    return inlineOf(element).replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "").trim();
  }

  // Visually hidden or aria-hidden nodes (e.g. ChatGPT's "ChatGPT said:" label)
  // are screen-reader text, not conversation text.
  const HIDDEN_CLASS = /(^|\s)(sr-only|visually-hidden)(\s|$)/;
  function isHidden(element) {
    return (
      element.hidden === true ||
      element.getAttribute("aria-hidden") === "true" ||
      HIDDEN_CLASS.test(String(element.className || ""))
    );
  }

  const LINE_TAGS = new Set([
    "DIV", "P", "LI", "TR", "BLOCKQUOTE", "UL", "OL", "PRE", "SECTION",
    "H1", "H2", "H3", "H4", "H5", "H6"
  ]);

  // Text of a code element with its line structure kept. Lines come from
  // newline characters, <br>, and block-level wrappers, so markup that puts
  // each line in its own block still yields one line per source line.
  function codeTextOf(element) {
    let out = "";
    const newline = () => {
      if (out && !out.endsWith("\n")) out += "\n";
    };
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          out += child.textContent;
          continue;
        }
        if (child.nodeType !== 1) continue;
        if (SKIP_TAGS.has(child.tagName) || isHidden(child)) continue;
        if (child.tagName === "BR") {
          out += "\n";
          continue;
        }
        const block = LINE_TAGS.has(child.tagName);
        if (block) newline();
        visit(child);
        if (block) newline();
      }
    };
    visit(element);
    return out;
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
        if (SKIP_TAGS.has(tag) || isHidden(child)) continue;
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
          /* A hard line break is structure, not a space: four options written
             on four lines must arrive as four lines. */
          out += "\n";
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
    return out
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\r?\n ?/g, "\n")
      .replace(/\n{2,}/g, "\n")
      /* Inline maths is padded with spaces on purpose, so it never glues onto a
         neighbouring word; that padding must not leave a gap before a closing
         punctuation mark ("B ." -> "B."). */
      .replace(/ +([.,;:!?)\]])/g, "$1")
      .trim();
  }

  /* ----------------------------------------------------------- math and code */

  /* Sites hand mathematics over in several notations. KaTeX markup is read in
     inlineOf, but plain text copies still arrive as \(...\), \[...\], $...$
     or $$...$$. Exporters only understand $...$ inline and formula blocks, so
     canonicalise at the source rather than letting TeX commands leak into the
     document as prose. */
  function mathSource(tex) {
    return String(tex == null ? "" : tex)
      .replace(/\s*\r?\n\s*/g, " ")
      .replace(/^\s*\\\[|\\\]\s*$/g, "")
      .replace(/^\s*\\\(|\\\)\s*$/g, "")
      .replace(/^\s*\$\$?|\$\$?\s*$/g, "")
      .trim();
  }

  function normalizeInlineMath(text) {
    return String(text == null ? "" : text)
      .replace(/\\\(([\s\S]+?)\\\)/g, (match, tex) => {
        const source = mathSource(tex);
        return source ? ` $${source}$ ` : "";
      })
      .replace(/\\\[([\s\S]+?)\\\]/g, (match, tex) => {
        const source = mathSource(tex);
        return source ? ` $${source}$ ` : "";
      });
  }

  const DISPLAY_MATH = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g;

  /* Display maths belongs in its own block: split it out of the paragraph that
     carried the delimiters instead of rendering it inline. */
  function splitDisplayMath(text) {
    const source = String(text == null ? "" : text);
    const parts = [];
    let last = 0;
    let match;
    DISPLAY_MATH.lastIndex = 0;
    while ((match = DISPLAY_MATH.exec(source)) !== null) {
      const before = source.slice(last, match.index);
      if (before.trim()) parts.push({ type: "paragraph", text: before });
      const tex = mathSource(match[1] != null ? match[1] : match[2]);
      if (tex) parts.push({ type: "formula", tex });
      last = match.index + match[0].length;
    }
    if (!last) return null;
    const after = source.slice(last);
    if (after.trim()) parts.push({ type: "paragraph", text: after });
    return parts.length ? parts : null;
  }

  function normalizeMathBlocks(blocks) {
    const out = [];
    for (const block of blocks || []) {
      if (block.type === "paragraph") {
        const parts = splitDisplayMath(block.text);
        if (parts) {
          for (const part of parts) {
            out.push(part.type === "paragraph" ? { ...part, text: normalizeInlineMath(part.text) } : part);
          }
          continue;
        }
        out.push({ ...block, text: normalizeInlineMath(block.text) });
      } else if (block.type === "formula") {
        out.push({ ...block, tex: mathSource(block.tex) });
      } else if (block.type === "list") {
        out.push({ ...block, items: (block.items || []).map(normalizeInlineMath) });
      } else if (block.type === "table") {
        out.push({
          ...block,
          head: (block.head || []).map(normalizeInlineMath),
          rows: (block.rows || []).map((row) => row.map(normalizeInlineMath))
        });
      } else if (block.type === "heading" || block.type === "subheading" || block.type === "quote") {
        out.push({ ...block, text: normalizeInlineMath(block.text) });
      } else {
        out.push(block);
      }
    }
    return out;
  }

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

  // A non-<pre> wrapper whose text is essentially one multi-line <code> sample.
  // Without this, inlineOf collapses its line breaks into spaces.
  function isCodeContainer(element) {
    if (element.querySelector("pre") || element.querySelectorAll("code").length !== 1) return false;
    const code = element.querySelector("code");
    if (!code || !codeTextOf(code).includes("\n")) return false;
    const remainder = element.cloneNode(true);
    for (const node of remainder.querySelectorAll("code, button, svg, .sr-only, .visually-hidden, [aria-hidden='true']")) node.remove();
    const surrounding = remainder.textContent.trim();
    // Only a language label may surround the one code sample; never discard prose.
    return !surrounding || Boolean(languageToken(surrounding));
  }

  function codeBlock(pre, consumed, hint) {
    const code = pre.querySelector("code") || pre;
    const raw = codeTextOf(code).replace(/^\n+|\s+$/g, "");
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

  /* Visuals arrive as ordinary images: a generated illustration, a chart, a
     diagram or a screenshot. The alt text and the <figcaption> are the only
     labels the page gives us, so they are kept with the block and also decide
     the kind. Nothing is guessed from the pixels. */
  const IMAGE_KINDS = [
    { kind: "diagram", re: /diagram|flow ?chart|schematic|architecture|uml|circuit|anatomy|labelled|labeled|figure \d|process flow/i },
    { kind: "chart", re: /\bchart\b|\bgraph\b|\bplot\b|histogram|scatter|bar ?chart|line ?graph|pie chart|data visuali/i },
    { kind: "infographic", re: /infographic|visual summary|mind ?map|decision tree|timeline|cheat ?sheet/i }
  ];

  function imageKind(label) {
    const text = String(label || "");
    for (const entry of IMAGE_KINDS) if (entry.re.test(text)) return entry.kind;
    return "image";
  }

  function figureCaptionOf(element) {
    const figure = element.closest ? element.closest("figure") : null;
    const caption = figure ? figure.querySelector("figcaption") : null;
    return caption ? caption.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function imageBlock(element) {
    let src = element.currentSrc || element.src || "";
    if (!src) return null;
    let unavailableReason = "";
    if (/^blob:/i.test(src)) {
      try {
        const canvas = element.ownerDocument.createElement("canvas");
        canvas.width = element.naturalWidth;
        canvas.height = element.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) throw new Error("Image data is not ready.");
        context.drawImage(element, 0, 0);
        src = canvas.toDataURL("image/png");
        canvas.width = 0;
        canvas.height = 0;
      } catch {
        unavailableReason = "Temporary browser image bytes could not be read.";
      }
    }
    const alt = (element.alt || "").trim();
    const caption = figureCaptionOf(element);
    const block = { type: "image", src, alt, caption, kind: imageKind(`${alt} ${caption}`), unavailableReason };
    // Intrinsic size lets the renderers reserve the right aspect ratio and
    // scale a diagram to the page instead of stretching it.
    if (element.naturalWidth && element.naturalHeight) {
      block.width = element.naturalWidth;
      block.height = element.naturalHeight;
    }
    return block;
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

    /* Consecutive inline runs belong to one sentence, so they join with a
       space - but a real line break stays a line break, and the document
       layer turns each line into its own block. */
    const addText = (text) => {
      const value = String(text == null ? "" : text)
        .replace(/[ \t]+/g, " ")
        .replace(/ ?\r?\n ?/g, "\n")
        .trim();
      if (!value) return;
      if (!pending) pending = value;
      else pending = pending.endsWith("\n") || value.startsWith("\n") ? `${pending}${value}` : `${pending} ${value}`;
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
        if (SKIP_TAGS.has(tag) || consumed.has(child) || isHidden(child)) continue;
        if (child.classList && child.classList.contains("aix-select")) continue;

        if (tag === "BR") {
          // A hard break between text runs ends the current line.
          if (pending && !pending.endsWith("\n")) pending += "\n";
          continue;
        }

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
            const captionText = caption ? caption.textContent.replace(/\s+/g, " ").trim() : "";
            block.caption = block.caption || captionText;
            block.alt = block.alt || captionText;
            block.kind = imageKind(`${block.alt} ${block.caption}`);
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
        } else if (isCodeContainer(child)) {
          // A wrapper whose text is one multi-line code sample: keep its lines.
          push(codeBlock(child, consumed, pendingLanguage));
          pendingLanguage = "";
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

    if (root.tagName === "PRE" || (root.tagName === "CODE" && codeTextOf(root).includes("\n"))) {
      push(codeBlock(root, consumed, ""));
    } else {
      walk(root);
    }
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
          out.push(
            block.items.map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`)).join("\n")
          );
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
          out.push(`[image: ${block.caption || block.alt || block.src}]`);
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

  const messageIds = new WeakMap();
  let nextMessageId = 0;

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

    /* Prefer candidates that can state their own role. In the new layout the
       role lives on the message unit, and a turn wrapper around it does not
       carry one: without this rule the wrapper would win the outermost-only
       filter below and merge a prompt and its answer into a single message.
       The old layout is unaffected - its turn sections already resolve a role
       from a descendant, so they are in this pool too. */
    const withRole = candidates.filter((entry) => entry.role !== "unknown");
    const pool = withRole.length ? withRole : candidates;

    // Keep the outermost candidate when one message container nests another.
    const outer = pool.filter(
      (entry) => !pool.some((other) => other !== entry && other.element.contains(entry.element))
    );
    outer.sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & 4 /* DOCUMENT_POSITION_FOLLOWING */ ? -1 : 1
    );

    const consumed = new Set();
    const entries = [];
    let unreadable = 0;
    for (const candidate of outer) {
      const blocks = normalizeMathBlocks(collectBlocks(contentRootFor(candidate.element), consumed));
      const text = blocksToText(blocks);
      /* A container that matched a role but yielded nothing is the visible
         symptom of a partial extraction: a virtualised turn, a redesigned
         body, a collapsed answer. Count it instead of dropping it in silence,
         so the popup and the workspace can warn before an export is trusted. */
      if (!text && !blocks.length) {
        unreadable += 1;
        continue;
      }
      entries.push({
        element: candidate.element,
        role: candidate.role,
        blocks,
        text,
        timestamp: findTimestamp(candidate.element)
      });
    }

    /* Coverage travels with the result but never as message content: a count
       is enough for the calling UI to say that the page was not fully read. */
    Object.defineProperty(entries, "coverage", {
      value: {
        platform: platform ? platform.id : "unknown",
        total: outer.length,
        detected: entries.length,
        unreadable
      },
      enumerable: false
    });

    // Assign stable ids and infer roles that the DOM did not expose.
    let previousRole = "assistant";
    const usedIds = new Set();
    entries.forEach((entry, index) => {
      if (entry.role === "unknown") entry.role = previousRole === "user" ? "assistant" : "user";
      previousRole = entry.role;
      const element = entry.element;
      if (!messageIds.has(element)) {
        const inner = element.querySelector("[data-message-id]");
        const native = element.getAttribute("data-message-id") || (inner ? inner.getAttribute("data-message-id") : "");
        messageIds.set(element, native ? `native:${native.slice(0, 80)}` : `aix:${++nextMessageId}`);
      }
      let id = messageIds.get(element);
      if (usedIds.has(id)) {
        id = `aix:${++nextMessageId}`;
        messageIds.set(element, id);
      }
      usedIds.add(id);
      entry.id = id;
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

  /**
   * What the adapters actually saw, for when nothing matched.
   *
   * Every one of these sites reshapes its DOM without warning, and a parser
   * that can only say "no conversation detected" is undiagnosable from the
   * outside. This is what lets the failure name the selector that missed.
   */
  function diagnose(doc, location_) {
    const hostname = (location_ && location_.hostname) || (doc && doc.location && doc.location.hostname) || "";
    const platform = platformFor(hostname);
    const adapters = ADAPTERS[platform ? platform.id : "generic"];
    const canQuery = Boolean(doc && typeof doc.querySelectorAll === "function");
    const tried = adapters.map((adapter) => ({
      selector: adapter.selector,
      matches: canQuery ? doc.querySelectorAll(adapter.selector).length : 0
    }));
    return {
      platform: platform ? platform.id : "unknown",
      hostname,
      tried,
      matched: tried.reduce((total, entry) => total + entry.matches, 0)
    };
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
    const found = findMessages(doc, location_);
    // Read coverage before the selection filter: it describes the page, not
    // the subset the reader picked.
    const coverage = found.coverage || { platform: "unknown", total: found.length, detected: found.length, unreadable: 0 };
    const entries = only ? found.filter((entry) => only.has(entry.id)) : found;
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
      coverage,
      messageCount: entries.length,
      messages: entries.map((entry) => entry.message)
    };
  }

  globalThis.AIExporterParser = {
    parse,
    parsePage,
    findMessages,
    diagnose,
    platformFor,
    normalizeRole,
    roleFromKeySuffix,
    collectBlocks
  };
})();
