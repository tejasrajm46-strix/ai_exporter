/**
 * AI Exporter - export engine.
 *
 * Pure, local, dependency-free conversion of a parsed chat into:
 *   markdown, txt, json, doc (Word-compatible HTML), html document, png
 * plus the print-ready document used for PDF (via the browser print dialog).
 *
 * Two design notes worth knowing:
 *  - No vendored libraries. Markdown/TXT/JSON are built from the parser's
 *    block model, and code highlighting is a compact regex tokenizer. PDF is
 *    produced by the browser's print pipeline, which keeps text selectable and
 *    real page breaks instead of rasterising the page.
 *  - Every string that comes from a page is escaped before it reaches the
 *    document, so page-provided HTML is never executed in an export.
 */
(() => {
  "use strict";

  const VERSION = "0.2.0";

  /* ------------------------------------------------------------------ basics */

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function plainInline(text) {
    return String(text == null ? "" : text)
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1$2")
      .replace(/\$([^$\n]+)\$/g, "$1");
  }

  function formatInline(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,:;!?]|$)/g, "$1<em>$2</em>");
    out = out.replace(/`([^`]+)`/g, '<code class="inline">$1</code>');
    out = out.replace(/\$([^$\n]+)\$/g, '<span class="tex">$1</span>');
    return out;
  }

  function formatDate(iso, withTime) {
    const date = iso ? new Date(iso) : new Date();
    if (Number.isNaN(date.getTime())) return "";
    const options = { day: "numeric", month: "long", year: "numeric" };
    if (withTime) {
      options.hour = "numeric";
      options.minute = "2-digit";
    }
    return date.toLocaleString(undefined, options);
  }

  function formatTime(iso) {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function slugFor(chat) {
    const base = String((chat && chat.title) || "ai-chat")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const day = new Date((chat && chat.exportedAt) || Date.now()).toISOString().slice(0, 10);
    return `${base || "ai-chat"}-${day}`;
  }

  /* -------------------------------------------------------- code highlighting */

  // ponytail: compact regex tokenizer. Swap in a vendored Prism/Shiki bundle
  // if full per-language grammar fidelity ever matters.
  const KEYWORDS = {
    common: ("abstract and as assert async await break case catch class const continue " +
      "default def del delete do elif else enum except export extends final finally for " +
      "from function get global if implements import in instanceof interface lambda let " +
      "new nonlocal not of or package pass private protected public raise readonly return " +
      "set static super switch this throw throws try typeof var void while with yield " +
      "true false null undefined none nil").split(" "),
    identifiers: ("string number boolean object array list map set system out println " +
      "console print integer double float long char byte").split(" "),
    sql: "select from where insert update delete join left right inner outer group order by limit values create".split(" ")
  };

  function keywordSet(language) {
    const lang = String(language || "").toLowerCase();
    const words = new Set(KEYWORDS.common);
    if (lang.includes("sql")) for (const word of KEYWORDS.sql) words.add(word);
    if (!lang.includes("py")) for (const word of KEYWORDS.identifiers) words.add(word);
    return words;
  }

  const TOKEN_PATTERN =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\w.]*\b)|(\b[A-Za-z_$][\w$]*\b)/g;

  function highlight(code, language) {
    const words = keywordSet(language);
    let out = "";
    let last = 0;
    let match;
    TOKEN_PATTERN.lastIndex = 0;
    while ((match = TOKEN_PATTERN.exec(code)) !== null) {
      out += escapeHtml(code.slice(last, match.index));
      const raw = match[0];
      if (match[1]) out += `<span class="tok-com">${escapeHtml(raw)}</span>`;
      else if (match[2]) out += `<span class="tok-str">${escapeHtml(raw)}</span>`;
      else if (match[3]) out += `<span class="tok-num">${escapeHtml(raw)}</span>`;
      else if (words.has(raw)) out += `<span class="tok-kw">${escapeHtml(raw)}</span>`;
      else if (code[match.index + raw.length] === "(") out += `<span class="tok-fn">${escapeHtml(raw)}</span>`;
      else if (/^[A-Z]/.test(raw)) out += `<span class="tok-type">${escapeHtml(raw)}</span>`;
      else out += escapeHtml(raw);
      last = match.index + raw.length;
    }
    return out + escapeHtml(code.slice(last));
  }

  /* ------------------------------------------------------------ document model */

  function roleLabel(role) {
    if (role === "user") return "User";
    if (role === "assistant") return "Assistant";
    if (role === "system") return "System";
    return "Message";
  }

  function sectionVariant(title) {
    const text = String(title || "");
    if (/takeaway|key point|summary|conclusion|recap|cheat ?sheet/i.test(text)) return "summary";
    if (/next step|follow.?up|practice|further|homework/i.test(text)) return "next";
    return "";
  }

  /**
   * The document is always the full transcript: one section per turn, in order,
   * with both roles kept. Headings inside a turn are demoted so the flow reads
   * as a conversation rather than as a second document outline.
   */
  function sectionsFor(chat) {
    return (chat.messages || []).map((message, index) => ({
      number: index + 1,
      role: message.role || "unknown",
      title: roleLabel(message.role),
      stamp: message.timestamp || null,
      blocks: (message.blocks || []).map((block) =>
        block.type === "heading" ? { type: "subheading", text: block.text } : block
      )
    }));
  }

  // "Output:" paragraph + following code block become one output panel.
  function normalizeBlocks(blocks) {
    const out = [];
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (block.type === "paragraph" && /^output:?$/i.test(plainInline(block.text).trim())) {
        const next = blocks[index + 1];
        if (next && next.type === "code") {
          out.push({ ...next, output: true });
          index += 1;
          continue;
        }
      }
      if (block.type === "code" && /^(output|console|stdout|result)$/i.test(String(block.language))) {
        out.push({ ...block, output: true });
        continue;
      }
      out.push(block);
    }
    return out;
  }

  /* -------------------------------------------------------------- document css */

  const DOCUMENT_CSS = `
:root {
  --display: Georgia, "Times New Roman", serif;
  --body: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "Cascadia Mono", Consolas, "Liberation Mono", Menlo, monospace;
}
/* Three document modes, one stylesheet. Same structure in all three, only
   the palette changes:
     light  - light + polished & colourful: indigo accents, lavender heading
              bars and table headers, amber NOTE, green OUTPUT, coloured code
     dark   - the dark reading theme: navy surfaces, indigo accents, amber
              NOTE, green OUTPUT, coloured code
     print  - light + printable: the same layout with every ink colour
              collapsed to black/grey, so a mono printer or a photocopier
              reproduces it exactly
   The brand palette (crimson/gold) is reserved for the cover mark and the
   extension chrome; the document body never uses it. */
html[data-theme="light"] {
  --stage: #f4f5f9; --paper: #ffffff; --ink: #111827; --ink-soft: #1f2937;
  --muted: #6b7280; --line: #e5e7eb; --line-strong: #cbd5e1;
  --accent: #4f46e5; --accent-soft: #eef2ff; --accent-ink: #4338ca;
  --head-bg: #eef2ff; --head-ink: #1e1b4b; --head-icon: #4f46e5;
  --code-bg: #f8fafc; --code-ink: #111827; --code-head-bg: #dbeafe;
  --code-head-ink: #1d4ed8; --code-line: #dbeafe;
  --out-bg: #f0fdf4; --out-head-bg: #dcfce7; --out-head-ink: #067034;
  --tok-kw: #7c3aed; --tok-str: #15803d; --tok-num: #b45309;
  --tok-com: #64748b; --tok-fn: #2563eb; --tok-type: #0e7490;
  --note-bg: #fef6e4; --note-line: #f0b429; --note-chip: #b45309;
  --tip-bg: #f0fdf4; --tip-line: #067034; --tip-chip: #067034; --ok: #22c55e;
  --table-head: #eef2ff; --table-head-ink: #3730a3;
  --bullet-a: #7c3aed; --bullet-b: #2563eb;
  --waves: #e0e7ff; --wave-opacity: 0.75;
}
html[data-theme="dark"] {
  --stage: #020617; --paper: #0f172a; --ink: #e5e7eb; --ink-soft: #cbd5e1;
  --muted: #94a3b8; --line: #1e293b; --line-strong: #334155;
  --accent: #818cf8; --accent-soft: #1e1b4b; --accent-ink: #c7d2fe;
  --head-bg: #1e293b; --head-ink: #e0e7ff; --head-icon: #818cf8;
  --code-bg: #0b1220; --code-ink: #e8eef7; --code-head-bg: #1e3a8a;
  --code-head-ink: #bfdbfe; --code-line: #1e3a8a;
  --out-bg: #082117; --out-head-bg: #14532d; --out-head-ink: #86efac;
  --tok-kw: #c792ea; --tok-str: #86efac; --tok-num: #fbbf24;
  --tok-com: #94a3b8; --tok-fn: #60a5fa; --tok-type: #5eead4;
  --note-bg: #2e2007; --note-line: #f59e0b; --note-chip: #fbbf24;
  --tip-bg: #082117; --tip-line: #22c55e; --tip-chip: #86efac; --ok: #22c55e;
  --table-head: #312e81; --table-head-ink: #e0e7ff;
  --bullet-a: #f59e0b; --bullet-b: #3b82f6;
  --waves: #312e81; --wave-opacity: 0.9;
}
html[data-theme="print"] {
  --stage: #f1f5f9; --paper: #ffffff; --ink: #111827; --ink-soft: #1f2937;
  --muted: #4b5563; --line: #d1d5db; --line-strong: #9ca3af;
  --accent: #111827; --accent-soft: #f1f5f9; --accent-ink: #111827;
  --head-bg: #f1f5f9; --head-ink: #111827; --head-icon: #111827;
  --code-bg: #ffffff; --code-ink: #111827; --code-head-bg: #e5e7eb;
  --code-head-ink: #111827; --code-line: #cbd5e1;
  --out-bg: #ffffff; --out-head-bg: #e5e7eb; --out-head-ink: #111827;
  /* printable code: every token prints as near-black ink */
  --tok-kw: #111827; --tok-str: #111827; --tok-num: #111827;
  --tok-com: #334155; --tok-fn: #111827; --tok-type: #111827;
  --note-bg: #ffffff; --note-line: #111827; --note-chip: #111827;
  --tip-bg: #ffffff; --tip-line: #111827; --tip-chip: #111827; --ok: #111827;
  --table-head: #f1f5f9; --table-head-ink: #111827;
  --bullet-a: #111827; --bullet-b: #111827;
  --waves: #e2e8f0; --wave-opacity: 0.5;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--stage); color: var(--ink); font-family: var(--body);
  font-size: 11.5pt; line-height: 1.62;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
.icon { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.7;
  stroke-linecap: round; stroke-linejoin: round; flex: none; }
.sheet {
  position: relative; width: 210mm; min-height: 297mm;
  padding: 16mm 15mm 14mm; margin: 0 auto 10mm; background: var(--paper);
  box-shadow: 0 10px 30px rgba(2, 6, 23, 0.18);
  break-after: page; page-break-after: always;
}
.sheet:last-of-type { break-after: auto; page-break-after: auto; }

/* cover */
.cover { display: flex; flex-direction: column; background: var(--paper); }
html[data-theme="dark"] .cover { background: linear-gradient(165deg, #1e1b4b 0%, #111033 42%, #0f172a 100%); }
.cover-mark { margin: 40mm auto 0; text-align: center; }
/* The cover mark: brand gradient on the colour themes, plain ink tile when
   printing, so the printable file carries nothing but ink. */
.cover-logo { display: grid; place-items: center; width: 64px; height: 64px; margin: 0 auto;
  border-radius: 19px; }
html[data-theme="light"] .cover-logo, html[data-theme="dark"] .cover-logo {
  background: linear-gradient(160deg, #b30036, #6e0021); color: #e8be62; }
html[data-theme="print"] .cover-logo { background: var(--ink); color: var(--paper); }
.cover-logo .icon { width: 30px; height: 30px; }
.cover-kicker { margin: 12px 0 0; font-size: 10pt; }
.cover-rule { width: 58mm; height: 2px; margin: 16px auto 0; background: var(--accent); opacity: 0.55; }
.cover-title { margin: 20px auto 0; max-width: 150mm; font-family: var(--display); font-size: 38pt;
  line-height: 1.1; text-align: center; }
.cover-sub { margin: 10px 0 0; color: var(--muted); text-align: center; }
.meta { display: grid; gap: 9px; width: 120mm; margin: 26mm auto 0; }
.meta-row { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--line); }
.meta-row dt { display: flex; align-items: center; gap: 8px; width: 44mm; color: var(--ink-soft); font-size: 10pt; }
.meta-row dd { margin: 0; font-size: 10.5pt; font-weight: 600; }
.meta-row .icon { color: var(--accent); }
.cover-art { position: absolute; left: 0; right: 0; bottom: 0; height: 92mm; color: var(--waves);
  opacity: var(--wave-opacity); pointer-events: none; }
.cover-art svg { width: 100%; height: 100%; display: block; }

/* sections - the heading is a tinted rounded bar with a topic icon */
.sub { display: flex; align-items: center; gap: 9px; margin: 20px 0 11px;
  padding: 8px 13px; border-radius: 9px; background: var(--head-bg); color: var(--head-ink);
  font-family: var(--body); font-size: 13pt; font-weight: 700; line-height: 1.3;
  break-after: avoid; break-inside: avoid; }
.sub .icon { width: 17px; height: 17px; color: var(--head-icon); stroke-width: 1.9; }
.sheet p { margin: 0 0 11px; }
.divider { margin: 16px 0; border: 0; border-top: 1px solid var(--line); }

/* lists */
.list { display: grid; gap: 7px; margin: 0 0 13px; padding: 0; list-style: none; }
.list li { position: relative; padding-left: 20px; }
.list li::before { content: ""; position: absolute; left: 4px; top: 0.52em; width: 7px; height: 7px;
  border-radius: 50%; background: var(--bullet-a); }
/* alternating bullet dots, purple then blue, exactly like the polished mode */
.list li:nth-child(even)::before { background: var(--bullet-b); }
.list ol, .list ul { margin-top: 6px; }
.list--checks li::before { display: none; }
.tick { position: absolute; left: 1px; top: 0.28em; width: 14px; height: 14px; border-radius: 50%;
  background: var(--ok); }
.tick::after { content: ""; position: absolute; left: 4.5px; top: 3.4px; width: 4px; height: 7px;
  border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
/* code */
.code { margin: 0 0 14px; border: 1px solid var(--code-line); border-radius: 10px; overflow: hidden;
  background: var(--code-bg); break-inside: avoid; page-break-inside: avoid; }
.code-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-bottom: 1px solid var(--code-line); background: var(--code-head-bg); color: var(--code-head-ink);
  font-size: 9pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.code-head .icon { width: 15px; height: 15px; stroke-width: 2; }
.code pre { margin: 0; padding: 12px 14px; color: var(--code-ink); font-family: var(--mono); font-size: 9.5pt;
  line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
/* the OUTPUT panel is tinted apart from the code panel, in every mode */
.code--output .code-head { background: var(--out-head-bg); color: var(--out-head-ink); }
.code--output pre { background: var(--out-bg); }
.tok-kw { color: var(--tok-kw); } .tok-str { color: var(--tok-str); } .tok-num { color: var(--tok-num); }
.tok-com { color: var(--tok-com); font-style: italic; }
.tok-fn { color: var(--tok-fn); } .tok-type { color: var(--tok-type); }
code.inline { padding: 1px 5px; border-radius: 4px; background: var(--accent-soft); color: var(--accent-ink);
  font-family: var(--mono); font-size: 0.93em; }
.code pre code { padding: 0; background: transparent; color: inherit; border: 0; }
/* Selecting text must never paint a dark band over the page: a drag over a
   code panel is how people copy code out of the document, and the default
   browser highlight looked like a dark panel had crept back into the print
   theme. Keep the selection tint pale in both themes. */
::selection { background: var(--accent-soft); color: var(--accent-ink); }
.tex { font-family: var(--mono); font-style: italic; color: var(--accent-ink); }

/* callouts, tables, figures, math */
.callout { margin: 0 0 14px; padding: 12px 15px 13px; border: 1.5px solid var(--note-line);
  border-radius: 10px; background: var(--note-bg); break-inside: avoid; }
.callout--tip { border-color: var(--tip-line); background: var(--tip-bg); }
.callout-chip { display: inline-flex; align-items: center; gap: 7px; color: var(--note-chip);
  font-size: 10pt; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.callout-chip .icon { width: 16px; height: 16px; stroke-width: 2; }
.callout--tip .callout-chip { color: var(--tip-chip); }
.callout p { margin: 7px 0 0; }
.grid { width: 100%; margin: 0 0 14px; border-collapse: collapse; font-size: 9.5pt;
  break-inside: avoid; page-break-inside: avoid; }
.grid th, .grid td { padding: 7px 9px; border: 1px solid var(--line); text-align: left; vertical-align: top; }
.grid th { background: var(--table-head); color: var(--table-head-ink); font-weight: 700; }
.figure { margin: 0 0 14px; text-align: center; break-inside: avoid; }
.figure img { max-width: 100%; border: 1px solid var(--line); border-radius: 8px; }
.figure figcaption { margin-top: 8px; color: var(--muted); font-size: 9pt; }
.figure--placeholder { padding: 22px; border: 1px dashed var(--line-strong); border-radius: 8px;
  color: var(--muted); font-size: 9.5pt; }
.math { margin: 0 0 14px; padding: 12px; border-radius: 8px; background: var(--accent-soft);
  color: var(--accent-ink); font-family: var(--mono); font-size: 10.5pt; text-align: center;
  overflow-wrap: anywhere; }
.card { padding: 14px 16px; border: 1px solid var(--tip-line); border-radius: 10px; background: var(--tip-bg); }
.card--next { border-color: var(--accent); background: var(--accent-soft); }

/* transcript flow */
.flow { display: block; }
.turn { padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1px dashed var(--line); }
.turn:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: 0; }
.turn-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; break-after: avoid; }
.turn-role { padding: 3px 9px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-ink);
  font-size: 8.5pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.turn--user .turn-role { background: var(--table-head); color: var(--ink-soft); }
.turn-stamp { color: var(--muted); font-size: 9pt; }

/* print: the sheet chrome is screen dressing, the paper supplies the margins */
@page { size: A4 portrait; margin: 15mm 14mm; }
@media print {
  html, body { background: #ffffff; }
  body { font-size: 10.5pt; line-height: 1.58; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .cover { min-height: 0; }
  .cover-art { display: none; }
  .cover-mark { margin-top: 12mm; }
  .sub, .turn-head, h1, h2, h3 { break-after: avoid; page-break-after: avoid; break-inside: avoid; }
  .code, .grid, .figure, .callout, .math, .card { break-inside: avoid; page-break-inside: avoid; }
  .grid tr, .list li { break-inside: avoid; }
  p, li { orphans: 2; widows: 2; }
}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

  const SPRITE = `<svg class="sprite" aria-hidden="true" focusable="false">
<symbol id="i-platform" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></symbol>
<symbol id="i-model" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3"/></symbol>
<symbol id="i-messages" viewBox="0 0 24 24"><path d="M21 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></symbol>
<symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></symbol>
<symbol id="i-format" viewBox="0 0 24 24"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></symbol>
<symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 2.5l2 5.2 5.5 2-5.5 2-2 5.2-2-5.2-5.5-2 5.5-2z"/><path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></symbol>
<symbol id="i-topic" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8 9.5h8M8 14h5"/></symbol>
<symbol id="i-code" viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></symbol>
<symbol id="i-terminal" viewBox="0 0 24 24"><path d="M4 6.5l5.5 5.5L4 17.5M12.5 18H20"/></symbol>
<symbol id="i-note" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="M12 11.2v5M12 7.6h.01" stroke="#ffffff"/></symbol>
</svg>`;

  function icon(id, className = "icon") {
    return `<svg class="${className}" aria-hidden="true"><use href="#${id}"></use></svg>`;
  }

  /* --------------------------------------------------------- block rendering */

  function renderList(block, state) {
    // Lists inside a summary / next-steps card get the tick treatment.
    const checks = Boolean(state.variant);
    const items = block.items
      .map((item) => `<li>${checks ? '<span class="tick" aria-hidden="true"></span>' : ""}${formatInline(item)}</li>`)
      .join("");
    return `<ul class="list${checks ? " list--checks" : ""}">${items}</ul>`;
  }

  function renderCode(block, options) {
    const label = block.output ? "Output" : String(block.language || "code").replace(/^\w/, (c) => c.toUpperCase());
    const body = options.highlight !== false ? highlight(block.code, block.language) : escapeHtml(block.code);
    return `<figure class="code${block.output ? " code--output" : ""}">
<div class="code-head">${icon(block.output ? "i-terminal" : "i-code")}<span class="code-lang">${escapeHtml(label)}</span></div>
<pre><code>${body}</code></pre></figure>`;
  }

  function renderTable(block) {
    const head = block.head && block.head.length
      ? `<thead><tr>${block.head.map((cell) => `<th>${formatInline(cell)}</th>`).join("")}</tr></thead>`
      : "";
    const rows = (block.rows || [])
      .map((row) => `<tr>${row.map((cell) => `<td>${formatInline(cell)}</td>`).join("")}</tr>`)
      .join("");
    return `<table class="grid">${head}<tbody>${rows}</tbody></table>`;
  }

  function renderImage(block, state) {
    const src = String(block.src || "");
    const safe = /^data:image\//i.test(src) || /^https?:\/\//i.test(src) ? src : "";
    const caption = block.alt || "Image from the conversation";
    if (!safe) return `<div class="figure figure--placeholder">Image not embedded: ${escapeHtml(caption)}</div>`;
    state.figures += 1;
    return `<figure class="figure"><img src="${escapeHtml(safe)}" alt="${escapeHtml(block.alt || "")}">
<figcaption>Fig. ${state.figures}: ${escapeHtml(caption)}</figcaption></figure>`;
  }

  function renderBlock(block, options, state) {
    switch (block.type) {
      case "heading":
      case "subheading":
        return `<h3 class="sub">${icon("i-topic")}${formatInline(block.text)}</h3>`;
      case "paragraph":
        return `<p>${formatInline(block.text)}</p>`;
      case "list":
        return renderList(block, state);
      case "quote":
        return `<aside class="callout${/^(note|tip|key point|important)/i.test(plainInline(block.text)) ? " callout--tip" : ""}">
<span class="callout-chip">${icon("i-note")}Note</span><p>${formatInline(block.text)}</p></aside>`;
      case "code":
        return renderCode(block, options);
      case "table":
        return renderTable(block);
      case "image":
        return renderImage(block, state);
      case "formula":
        return `<div class="math">${escapeHtml(block.tex)}</div>`;
      case "divider":
        return '<hr class="divider">';
      default:
        return "";
    }
  }

  /**
   * A heading that reads like a summary or a follow-up list opens a card that
   * keeps collecting blocks until the next heading. Everything else streams.
   */
  function chunked(blocks) {
    const chunks = [];
    let current = null;
    for (const block of blocks) {
      const heading = block.type === "heading" || block.type === "subheading";
      if (heading || !current) {
        current = { variant: heading ? sectionVariant(block.text) : "", blocks: [] };
        chunks.push(current);
      }
      current.blocks.push(block);
    }
    return chunks;
  }

  function renderBlocks(blocks, options, state) {
    return chunked(normalizeBlocks(blocks || []))
      .map((chunk) => {
        state.variant = chunk.variant; // read by the list renderer
        const inner = chunk.blocks.map((block) => renderBlock(block, options, state)).join("\n");
        return chunk.variant ? `<div class="card card--${chunk.variant}">${inner}</div>` : inner;
      })
      .join("\n");
  }

  /* -------------------------------------------------------- document assembly */

  /** What the cover calls this file, so a Word export never claims to be a PDF. */
  function formatLabel(settings) {
    if (settings.format === "docx") {
      return settings.docMode === "bw" ? "Word (black & white)" : "Word (colour)";
    }
    return settings.theme === "dark" ? "PDF (Dark Theme)" : settings.theme === "print" ? "PDF (Printable)" : "PDF (A4, Portrait)";
  }

  function coverSheet(chat, options) {
    const rows = [
      ["i-platform", "Platform", chat.platformLabel || "Unknown"],
      ["i-model", "Model", chat.model || "Unknown"],
      ["i-messages", "Total Messages", `${(chat.messages || []).length} messages`],
      ["i-calendar", "Exported On", formatDate(chat.exportedAt, true)],
      ["i-format", "Format", formatLabel(options)]
    ];
    return `<article class="sheet cover">
<div class="cover-mark">
  <div class="cover-logo">${icon("i-spark")}</div>
  <p class="cover-kicker">Full transcript</p>
  <div class="cover-rule"></div>
  <h1 class="cover-title">${escapeHtml(chat.title || "AI conversation")}</h1>
  <p class="cover-sub">Every prompt and every answer, in order</p>
</div>
<dl class="meta">
${rows
  .map(
    ([id, label, value]) =>
      `<div class="meta-row"><dt>${icon(id)}${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
  )
  .join("\n")}
</dl>
<div class="cover-art" aria-hidden="true"><svg viewBox="0 0 210 92" preserveAspectRatio="none">
  <path d="M0 46 C 34 12, 68 76, 104 40 S 168 66, 210 26 L210 92 L0 92 Z" fill="currentColor" opacity="0.85"/>
  <path d="M0 62 C 40 34, 76 90, 118 58 S 176 78, 210 50 L210 92 L0 92 Z" fill="currentColor" opacity="0.55"/>
</svg></div>
</article>`;
  }

  function turnHtml(section, settings, state) {
    const stamp =
      settings.timestamps && section.stamp
        ? `<span class="turn-stamp">${escapeHtml(formatTime(section.stamp))}</span>`
        : "";
    return `<article class="turn turn--${escapeHtml(section.role)}">
<header class="turn-head"><span class="turn-role">${escapeHtml(section.title)}</span>${stamp}</header>
${renderBlocks(section.blocks, settings, state)}</article>`;
  }

  /** Build the styled document body + css shared by HTML, DOC and print. */
  function buildDocument(chat, options = {}) {
    const settings = {
      theme: options.theme === "dark" ? "dark" : options.theme === "print" ? "print" : "light",
      format: options.format === "docx" ? "docx" : "pdf",
      docMode: options.docMode === "bw" ? "bw" : "color",
      timestamps: Boolean(options.timestamps),
      highlight: options.highlight !== false
    };
    const sections = sectionsFor(chat);
    const state = { figures: 0, variant: "" };
    const turns = sections.map((section) => turnHtml(section, settings, state)).join("\n");
    const body = `${coverSheet(chat, settings)}
<article class="sheet doc">
<div class="flow">${turns}</div>
</article>`;

    return { css: DOCUMENT_CSS, body, sections, settings };
  }

  function documentHtml(chat, options = {}) {
    const { css, body, settings } = buildDocument(chat, options);
    return `<!doctype html>
<html lang="en" data-theme="${settings.theme}">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="${settings.theme}">
<title>${escapeHtml(chat.title || "AI conversation")}</title>
<style>${css}</style>
</head>
<body>${SPRITE}
${body}
</body>
</html>`;
  }

  /* --------------------------------------------------------- other formats */

  function markdownBlocks(blocks) {
    return normalizeBlocks(blocks || [])
      .map((block) => {
        switch (block.type) {
          case "heading":
            return `${"#".repeat(Math.min(6, block.level + 1))} ${block.text}`;
          case "subheading":
            return `${"#".repeat(Math.min(6, block.level || 3))} ${block.text}`;
          case "paragraph":
            return block.text;
          case "list":
            return block.items.map((item) => `- ${item}`).join("\n");
          case "quote":
            return block.text.split("\n").map((line) => `> ${line}`).join("\n");
          case "code":
            return `\`\`\`${block.language && block.language !== "text" ? block.language : ""}\n${block.code}\n\`\`\``;
          case "table": {
            const lines = [];
            if (block.head && block.head.length) {
              lines.push(`| ${block.head.join(" | ")} |`);
              lines.push(`| ${block.head.map(() => "---").join(" | ")} |`);
            }
            for (const row of block.rows || []) lines.push(`| ${row.join(" | ")} |`);
            return lines.join("\n");
          }
          case "image":
            return `![${block.alt || "image"}](${block.src})`;
          case "formula":
            return `$$\n${block.tex}\n$$`;
          case "divider":
            return "---";
          default:
            return "";
        }
      })
      .join("\n\n");
  }

  function markdownFor(chat, options = {}) {
    const parts = [
      `# ${chat.title || "AI conversation"}`,
      `> Exported from ${chat.platformLabel || "an AI chat"}${chat.model ? ` (${chat.model})` : ""} with AI Exporter`,
      `> ${formatDate(chat.exportedAt, true)} - ${(chat.messages || []).length} messages`,
      chat.url ? `> Source: ${chat.url}` : null
    ].filter(Boolean);

    for (const message of chat.messages || []) {
      const stamp = options.timestamps && message.timestamp ? ` (${formatTime(message.timestamp)})` : "";
      parts.push(`## ${roleLabel(message.role)}${stamp}`);
      const content = markdownBlocks(message.blocks);
      if (content) parts.push(content);
    }
    return `${parts.join("\n\n")}\n`;
  }

  function textFor(chat, options = {}) {
    const lines = [
      chat.title || "AI conversation",
      "=".repeat(Math.min(72, (chat.title || "AI conversation").length)),
      `Exported from ${chat.platformLabel || "an AI chat"}${chat.model ? ` (${chat.model})` : ""} with AI Exporter`,
      `${formatDate(chat.exportedAt, true)} - ${(chat.messages || []).length} messages`,
      ""
    ];

    for (const message of chat.messages || []) {
      const stamp = options.timestamps && message.timestamp ? ` (${formatTime(message.timestamp)})` : "";
      lines.push(`--- ${roleLabel(message.role)}${stamp} ---`, "");
      for (const block of normalizeBlocks(message.blocks || [])) {
        switch (block.type) {
          case "heading":
          case "subheading":
            lines.push(plainInline(block.text), "");
            break;
          case "paragraph":
            lines.push(plainInline(block.text), "");
            break;
          case "list":
            lines.push(...block.items.map((item) => `  - ${plainInline(item)}`), "");
            break;
          case "quote":
            lines.push(...plainInline(block.text).split("\n").map((line) => `  > ${line}`), "");
            break;
          case "code":
            lines.push(block.code, "");
            break;
          case "table":
            if (block.head && block.head.length) lines.push(block.head.join(" | "));
            lines.push(...(block.rows || []).map((row) => row.join(" | ")), "");
            break;
          case "image":
            lines.push(`[image: ${block.alt || block.src}]`, "");
            break;
          case "formula":
            lines.push(block.tex, "");
            break;
          default:
            break;
        }
      }
    }
    return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  }

  function jsonFor(chat, options = {}) {
    return `${JSON.stringify(
      {
        ...chat,
        export: {
          generator: `AI Exporter ${VERSION}`,
          theme: options.theme === "dark" ? "dark" : options.theme === "print" ? "print" : "light",
          docMode: options.docMode === "bw" ? "bw" : "color",
          timestamps: Boolean(options.timestamps),
          highlight: options.highlight !== false
        }
      },
      null,
      2
    )}\n`;
  }

  /** Read one CSS block into a name -> value map. */
  function cssBlock(css, selector) {
    const block = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
    const map = {};
    if (!block) return map;
    // comments first: one of them contains a colon and would poison the split
    for (const decl of block[1].replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
      const colon = decl.indexOf(":");
      if (colon > 0) map[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim();
    }
    return map;
  }

  /**
   * Word's HTML parser has no CSS custom properties, so every var(--x) in a
   * .doc would be an invalid declaration and the file would lose its panels,
   * borders and ink. Bake the chosen mode's values in as literals instead.
   */
  function inlineVars(css, theme) {
    const vars = { ...cssBlock(css, ":root"), ...cssBlock(css, `html\\[data-theme="${theme}"\\]`) };
    return css.replace(/var\((--[a-z-]+)\)/g, (whole, name) => vars[name] || whole);
  }

  function docFor(chat, options = {}) {
    /* The Word export has its own two-way switch - colour, or a plain
       black-and-white handout - and reuses the light and print palettes. It is
       deliberately independent of the PDF theme: a dark PDF should not turn
       the Word file dark too. */
    const docOptions = {
      ...options,
      format: "docx",
      theme: options.docMode === "bw" ? "print" : "light"
    };
    const { css, body, settings } = buildDocument(chat, docOptions);
    /* Word also has no flexbox, grid or ::before, so the same document is given
       a plain-HTML fallback that still reads as a structured handout: real list
       markers, block-level bars, no decorative tiles. */
    /* Every var() is inlined first, and that is what actually colours the Word
       file: Word ignores html[data-theme=...] outright, so every rule hanging
       off it is already dead. They are dropped rather than shipped - they are
       the only colour that would survive into the black-and-white mode, and the
       one that is hidden in Word (the cover mark) is restyled for screen use
       by the stylesheet the browser renders from the same source. */
    const flatCss = inlineVars(css, settings.theme).replace(/html\[data-theme="[a-z]+"\][^{]*\{[^{}]*\}\s*/g, "");
    const docCss = `${flatCss}
@page WordSection1 { size: A4; margin: 15mm 14mm; }
div.WordSection1 { page: WordSection1; }
.sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
.list { display: block; list-style: disc; padding-left: 22px; }
.list li { padding-left: 0; }
.list li::before { display: none; }
.list--checks { list-style: none; }
.sub, .code-head, .meta-row, .turn-head { display: block; }
.icon, .cover-logo, .cover-art { display: none; }`;
    return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(chat.title || "AI conversation")}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>${docCss}</style>
</head>
<body><div class="WordSection1" data-theme="${settings.theme}">${SPRITE}
${body}
</div></body>
</html>`;
  }

  /* ------------------------------------------------------------- png poster */

  const PNG_THEMES = {
    light: {
      page: "#ffffff", ink: "#111827", muted: "#6b7280", line: "#e5e7eb",
      accent: "#4f46e5", accentSoft: "#eef2ff", codeBg: "#f8fafc", codeHead: "#dbeafe",
      codeInk: "#111827", codeHeadInk: "#1d4ed8", noteBg: "#fef6e4", tipBg: "#f0fdf4"
    },
    dark: {
      page: "#0f172a", ink: "#e5e7eb", muted: "#94a3b8", line: "#1e293b",
      accent: "#818cf8", accentSoft: "#1e1b4b", codeBg: "#0b1220", codeHead: "#1e3a8a",
      codeInk: "#e8eef7", codeHeadInk: "#bfdbfe", noteBg: "#2e2007", tipBg: "#082117"
    },
    print: {
      page: "#ffffff", ink: "#111827", muted: "#4b5563", line: "#d1d5db",
      accent: "#111827", accentSoft: "#f1f5f9", codeBg: "#ffffff", codeHead: "#e5e7eb",
      codeInk: "#111827", codeHeadInk: "#111827", noteBg: "#ffffff", tipBg: "#ffffff"
    }
  };

  const PNG_FONTS = {
    title: '700 46px Georgia, "Times New Roman", serif',
    section: '700 32px Georgia, "Times New Roman", serif',
    sub: '700 23px -apple-system, "Segoe UI", Roboto, sans-serif',
    body: '400 20px -apple-system, "Segoe UI", Roboto, sans-serif',
    meta: '400 18px -apple-system, "Segoe UI", Roboto, sans-serif',
    code: '400 17px ui-monospace, Consolas, monospace'
  };

  /**
   * Canvas poster of the conversation. Layout is measured first and painted
   * second, so a 1x measuring context and the real 2x context share one pass.
   */
  function pngLayout(chat, options, ctx) {
    const theme = PNG_THEMES[options.theme === "dark" ? "dark" : options.theme === "print" ? "print" : "light"];
    const W = 1240;
    const PAD = 78;
    const width = W - PAD * 2;
    const nodes = [];
    let y = 0;

    const wrap = (text, font, maxWidth) => {
      ctx.font = font;
      const words = String(text).split(/\s+/).filter(Boolean);
      const lines = [];
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
        else {
          lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      return lines.length ? lines : [""];
    };

    const addText = (text, { font, color, x = PAD, maxWidth = width, lineHeight = 1.5, gap = 0, size }) => {
      const sizePx = size || Number((font.match(/(\d+)px/) || [0, 20])[1]);
      const lines = wrap(plainInline(text), font, maxWidth);
      nodes.push({ kind: "text", x, y, lines, font, color, lineHeight: sizePx * lineHeight });
      y += lines.length * sizePx * lineHeight + gap;
    };

    // Cover header
    nodes.push({ kind: "rect", x: 0, y: 0, w: W, h: 250, fill: theme.accentSoft });
    addText(chat.title || "AI conversation", {
      font: PNG_FONTS.title, color: theme.ink, maxWidth: width - 40, lineHeight: 1.2, gap: 10
    });
    y += 6;
    addText(
      `Exported from ${chat.platformLabel || "an AI chat"}${chat.model ? ` (${chat.model})` : ""} with AI Exporter`,
      { font: PNG_FONTS.meta, color: theme.muted, gap: 4 }
    );
    addText(`${formatDate(chat.exportedAt, true)} - ${(chat.messages || []).length} messages`, {
      font: PNG_FONTS.meta, color: theme.muted, gap: 26
    });

    const sections = sectionsFor(chat);
    for (const section of sections) {
      nodes.push({ kind: "chip", x: PAD, y: y + 6, text: String(section.number), font: PNG_FONTS.sub, color: theme.accent });
      addText(section.title, { font: PNG_FONTS.sub, color: theme.ink, x: PAD + 56, maxWidth: width - 56, gap: 14 });
      y += 6;

      for (const block of normalizeBlocks(section.blocks)) {
        if (block.type === "paragraph") {
          addText(block.text, { font: PNG_FONTS.body, color: theme.ink, gap: 12 });
        } else if (block.type === "subheading" || block.type === "heading") {
          y += 8;
          addText(block.text, { font: PNG_FONTS.sub, color: theme.ink, gap: 8 });
        } else if (block.type === "list") {
          for (const item of block.items) {
            const indent = PAD + 26;
            nodes.push({ kind: "bullet", x: PAD + 8, y, color: theme.accent });
            const lines = wrap(plainInline(item), PNG_FONTS.body, width - 26);
            nodes.push({ kind: "text", x: indent, y, lines, font: PNG_FONTS.body, color: theme.ink, lineHeight: 30 });
            y += lines.length * 30 + 8;
          }
          y += 6;
        } else if (block.type === "code") {
          const lines = [];
          for (const raw of String(block.code).split("\n")) {
            lines.push(...wrap(raw || " ", PNG_FONTS.code, width - 32));
          }
          const headH = 34;
          const bodyH = lines.length * 26 + 26;
          nodes.push({
            kind: "code",
            x: PAD, y, w: width, h: headH + bodyH,
            lines, headH, codeBg: theme.codeBg, headBg: theme.codeHead,
            label: block.output ? "Output" : String(block.language || "code"),
            codeInk: theme.codeInk, headInk: theme.codeHeadInk, lineColor: theme.line,
            font: PNG_FONTS.code, lineHeight: 26
          });
          y += headH + bodyH + 14;
        } else if (block.type === "table") {
          const columns = Math.max(block.head.length, ...block.rows.map((row) => row.length), 1);
          const colWidth = width / columns;
          const rowLines = (row) => row.map((cell) => wrap(plainInline(cell), PNG_FONTS.meta, colWidth - 20));
          const headLines = block.head.length ? rowLines(block.head) : [];
          const rows = block.rows.map(rowLines);
          const heightOf = (lines) => Math.max(...lines.map((l) => l.length), 1) * 24 + 16;
          const total = (headLines.length ? heightOf(headLines) : 0) + rows.reduce((sum, lines) => sum + heightOf(lines), 0);
          nodes.push({
            kind: "table", x: PAD, y, w: width, h: total, colWidth, headLines, rows,
            font: PNG_FONTS.meta, lineColor: theme.line, headFill: theme.accentSoft,
            ink: theme.ink, heightOf, lineHeight: 24
          });
          y += total + 16;
        } else if (block.type === "quote") {
          const lines = wrap(plainInline(block.text), PNG_FONTS.body, width - 34);
          const h = lines.length * 30 + 24;
          nodes.push({ kind: "callout", x: PAD, y, w: width, h, lines, fill: theme.noteBg, bar: theme.accent, ink: theme.ink, font: PNG_FONTS.body, lineHeight: 30 });
          y += h + 14;
        } else if (block.type === "formula") {
          const lines = wrap(block.tex, PNG_FONTS.code, width - 30);
          const h = lines.length * 28 + 24;
          nodes.push({ kind: "callout", x: PAD, y, w: width, h, lines, fill: theme.accentSoft, bar: theme.accent, ink: theme.accent, font: PNG_FONTS.code, lineHeight: 28 });
          y += h + 14;
        } else if (block.type === "image") {
          addText(`[image: ${block.alt || "embedded image"}]`, { font: PNG_FONTS.meta, color: theme.muted, gap: 16 });
        }
      }
      y += 22;
      nodes.push({ kind: "rule", x: PAD, y, w: width, color: theme.line });
      y += 26;
    }

    addText(`Full transcript - ${formatDate(chat.exportedAt, false)}`, {
      font: PNG_FONTS.meta, color: theme.muted, gap: 10
    });
    return { nodes, width: W, height: Math.ceil(y + PAD), theme };
  }

  function paintPng(ctx, layout) {
    const { nodes, width, theme } = layout;
    ctx.fillStyle = theme.page;
    ctx.fillRect(0, 0, width, layout.height);

    const shape = (x, y, w, h, r) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    };

    for (const node of nodes) {
      if (node.kind === "rect") {
        ctx.fillStyle = node.fill;
        ctx.fillRect(node.x, node.y, node.w, node.h);
      } else if (node.kind === "rule") {
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(node.x + node.w, node.y);
        ctx.stroke();
      } else if (node.kind === "chip") {
        ctx.fillStyle = node.color;
        ctx.font = node.font;
        ctx.fillText(node.text, node.x, node.y + 20);
      } else if (node.kind === "bullet") {
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x + 4, node.y + 14, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (node.kind === "text") {
        ctx.fillStyle = node.color;
        ctx.font = node.font;
        node.lines.forEach((line, index) => {
          ctx.fillText(line, node.x, node.y + index * node.lineHeight + node.lineHeight * 0.72);
        });
      } else if (node.kind === "code") {
        ctx.fillStyle = node.codeBg;
        shape(node.x, node.y, node.w, node.h, 14);
        ctx.fill();
        if (node.lineColor) {
          ctx.strokeStyle = node.lineColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.fillStyle = node.headBg;
        shape(node.x, node.y, node.w, node.headH, 14);
        ctx.fill();
        ctx.fillRect(node.x, node.y + node.headH - 14, node.w, 14);
        ctx.fillStyle = node.headInk;
        ctx.font = node.font;
        ctx.fillText(String(node.label).toUpperCase(), node.x + 16, node.y + 23);
        ctx.fillStyle = node.codeInk;
        node.lines.forEach((line, index) => {
          ctx.fillText(line, node.x + 16, node.y + node.headH + 20 + index * node.lineHeight);
        });
      } else if (node.kind === "callout") {
        ctx.fillStyle = node.fill;
        shape(node.x, node.y, node.w, node.h, 12);
        ctx.fill();
        ctx.fillStyle = node.bar;
        ctx.fillRect(node.x, node.y, 5, node.h);
        ctx.fillStyle = node.ink;
        ctx.font = node.font;
        node.lines.forEach((line, index) => {
          ctx.fillText(line, node.x + 20, node.y + 24 + index * node.lineHeight);
        });
      } else if (node.kind === "table") {
        let rowY = node.y;
        const drawRow = (lines, header) => {
          const h = node.heightOf(lines);
          if (header) {
            ctx.fillStyle = node.headFill;
            ctx.fillRect(node.x, rowY, node.w, h);
          }
          ctx.strokeStyle = node.lineColor;
          ctx.lineWidth = 1;
          lines.forEach((cellLines, column) => {
            const x = node.x + column * node.colWidth;
            ctx.strokeRect(x, rowY, node.colWidth, h);
            ctx.fillStyle = node.ink;
            ctx.font = node.font;
            cellLines.forEach((line, index) => {
              ctx.fillText(line, x + 10, rowY + 20 + index * node.lineHeight);
            });
          });
          rowY += h;
        };
        if (node.headLines.length) drawRow(node.headLines, true);
        for (const row of node.rows) drawRow(row, false);
      }
    }
  }

  function pngFor(chat, options = {}) {
    if (typeof document === "undefined") return Promise.reject(new Error("PNG export needs a browser document."));
    const measure = document.createElement("canvas").getContext("2d");
    const layout = pngLayout(chat, options, measure);
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(layout.width * scale);
    canvas.height = Math.round(layout.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    paintPng(ctx, layout);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not render the image."))), "image/png");
    });
  }

  /* ------------------------------------------------------------------- build */

  async function build(chat, format, options = {}) {
    const name = slugFor(chat);
    switch (format) {
      case "markdown":
        return { filename: `${name}.md`, mime: "text/markdown", text: markdownFor(chat, options) };
      case "txt":
        return { filename: `${name}.txt`, mime: "text/plain", text: textFor(chat, options) };
      case "json":
        return { filename: `${name}.json`, mime: "application/json", text: jsonFor(chat, options) };
      case "docx":
        return { filename: `${name}.doc`, mime: "application/msword", text: docFor(chat, options) };
      case "image":
        return { filename: `${name}.png`, mime: "image/png", blob: await pngFor(chat, options) };
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  const FORMAT_LABELS = {
    pdf: "PDF",
    markdown: "Markdown",
    txt: "Text",
    docx: "DOCX",
    image: "Image",
    json: "JSON"
  };

  globalThis.AIExporter = {
    version: VERSION,
    build,
    buildDocument,
    documentHtml,
    markdownFor,
    textFor,
    jsonFor,
    docFor,
    pngFor,
    sectionsFor,
    formatDate,
    formatTime,
    slugFor,
    escapeHtml,
    FORMAT_LABELS
  };
})();
