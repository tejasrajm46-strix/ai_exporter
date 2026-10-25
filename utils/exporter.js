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

  const VERSION = "0.9.0";

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
    /* Math is compiled to MathML before the surrounding text is escaped: the
       TeX source must reach the compiler with its < and & characters intact, so
       the inline $...$ spans are split out first and everything else is escaped. */
    return String(text == null ? "" : text)
      .split(/(\$[^$\n]+\$)/g)
      .map((part) => {
        const math = /^\$([^$\n]+)\$$/.exec(part);
        if (math) {
          const mathml = texToMathML(math[1], false);
          return mathml
            ? `<span class="math-inline">${mathml}</span>`
            : `<span class="tex">${escapeHtml(math[1])}</span>`;
        }
        let out = escapeHtml(part);
        out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,:;!?]|$)/g, "$1<em>$2</em>");
        out = out.replace(/`([^`]+)`/g, '<code class="inline">$1</code>');
        return out;
      })
      .join("");
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
    const date = new Date((chat && chat.exportedAt) || Date.now());
    const day = (Number.isNaN(date.getTime()) ? new Date() : date).toISOString().slice(0, 10);
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
    sql: "select from where insert update delete join left right inner outer group order by limit values create".split(" "),
    cfamily: ("int void struct union typedef using namespace include define template typename bool char short " +
      "double float unsigned signed sizeof nullptr std cin cout cerr endl NULL delete new public private " +
      "protected virtual override const static inline").split(" ")
  };

  // Languages that share C-style syntax: // and /* */ comments, C/C++ keywords.
  const C_LIKE = /^(c|cc|cpp|c\+\+|cxx|h|hpp|c#|cs|csharp|java|js|javascript|jsx|ts|typescript|tsx|go|golang|rust|rs|swift|kotlin|scala|dart|php|json)$/;
  const SQL_LIKE = /^(sql|lua|haskell|hs)$/;

  function keywordSet(language) {
    const lang = String(language || "").toLowerCase();
    const words = new Set(KEYWORDS.common);
    if (lang.includes("sql")) for (const word of KEYWORDS.sql) words.add(word);
    if (C_LIKE.test(lang)) for (const word of KEYWORDS.cfamily) words.add(word);
    if (!lang.includes("py")) for (const word of KEYWORDS.identifiers) words.add(word);
    return words;
  }

  // Only the comment syntax differs by language: `#` is a comment in Python and
  // shell, but `#include` is not one in C, and `--` is a comment only in SQL.
  // Group 1 is the comment; the string, number and identifier groups follow.
  const TOKEN_TAIL =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\w.]*\b)|(\b[A-Za-z_$][\w$]*\b)/.source;

  function tokenPatternFor(language) {
    const lang = String(language || "").toLowerCase();
    const comment = C_LIKE.test(lang)
      ? /\/\/[^\n]*|\/\*[\s\S]*?\*\//.source
      : SQL_LIKE.test(lang)
        ? /--[^\n]*|\/\*[\s\S]*?\*\//.source
        : /#[^\n]*/.source;
    return new RegExp(`(${comment})|${TOKEN_TAIL}`, "g");
  }

  function highlight(code, language) {
    const words = keywordSet(language);
    const tokens = tokenPatternFor(language);
    let out = "";
    let last = 0;
    let match;
    while ((match = tokens.exec(code)) !== null) {
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

  /* -------------------------------------------------------------- math (TeX) */

  /* The exported document carries no script engine (its CSP is script-src
     'none'), so mathematics cannot be typeset by KaTeX or MathJax at view time.
     Browsers do render MathML natively - no script, no bundled font - so a
     practical subset of TeX is compiled to MathML here. A construct outside the
     subset degrades to upright text, never to raw backslashes leaking into the
     reader, which is what the old documents did. */

  const TEX_SYMBOLS = {
    le: "\u2264", leq: "\u2264", ge: "\u2265", geq: "\u2265", ne: "\u2260", neq: "\u2260",
    equiv: "\u2261", approx: "\u2248", cong: "\u2245", simeq: "\u2243", propto: "\u221d",
    ll: "\u226a", gg: "\u226b", prec: "\u227a", succ: "\u227b", subset: "\u2282",
    subseteq: "\u2286", supset: "\u2283", supseteq: "\u2287", in: "\u2208", notin: "\u2209",
    ni: "\u220b", perp: "\u22a5", parallel: "\u2225", mid: "\u2223", nmid: "\u2224",
    times: "\u00d7", div: "\u00f7", pm: "\u00b1", mp: "\u2213", cdot: "\u22c5",
    ast: "\u2217", star: "\u22c6", circ: "\u2218", bullet: "\u2022", oplus: "\u2295",
    ominus: "\u2296", otimes: "\u2297", oslash: "\u2298", cap: "\u2229", cup: "\u222a",
    uplus: "\u2294", sqcap: "\u2293", sqcup: "\u2294", vee: "\u2228", wedge: "\u2227",
    setminus: "\u2216", smallsetminus: "\u2216", rightarrow: "\u2192", to: "\u2192",
    gets: "\u2190", leftarrow: "\u2190", leftrightarrow: "\u2194", Rightarrow: "\u21d2",
    Leftarrow: "\u21d0", Leftrightarrow: "\u21d4", implies: "\u21d2", iff: "\u21d4",
    uparrow: "\u2191", downarrow: "\u2193", mapsto: "\u21a6", longrightarrow: "\u27f6",
    hookrightarrow: "\u21aa", infty: "\u221e", partial: "\u2202", nabla: "\u2207",
    forall: "\u2200", exists: "\u2203", neg: "\u00ac", lnot: "\u00ac", emptyset: "\u2205",
    varnothing: "\u2205", angle: "\u2220", triangle: "\u25b3", therefore: "\u2234",
    because: "\u2235", ldots: "\u2026", dots: "\u2026", cdots: "\u22ef", vdots: "\u22ee",
    ddots: "\u22f1", aleph: "\u2135", hbar: "\u210f", ell: "\u2113", prime: "\u2032",
    degree: "\u00b0", checkmark: "\u2713", backslash: "\u2216",
    alpha: "\u03b1", beta: "\u03b2", gamma: "\u03b3", delta: "\u03b4", epsilon: "\u03b5",
    varepsilon: "\u03f5", zeta: "\u03b6", eta: "\u03b7", theta: "\u03b8", vartheta: "\u03d1",
    iota: "\u03b9", kappa: "\u03ba", lambda: "\u03bb", mu: "\u03bc", nu: "\u03bd", xi: "\u03be",
    pi: "\u03c0", varpi: "\u03d6", rho: "\u03c1", varrho: "\u03f1", sigma: "\u03c3",
    varsigma: "\u03c2", tau: "\u03c4", upsilon: "\u03c5", phi: "\u03c6", varphi: "\u03d5",
    chi: "\u03c7", psi: "\u03c8", omega: "\u03c9", Gamma: "\u0393", Delta: "\u0394",
    Theta: "\u0398", Lambda: "\u039b", Xi: "\u039e", Pi: "\u03a0", Sigma: "\u03a3",
    Upsilon: "\u03a5", Phi: "\u03a6", Psi: "\u03a8", Omega: "\u03a9",
    lbrace: "{", rbrace: "}", langle: "\u27e8", rangle: "\u27e9", vert: "|",
    Vert: "\u2016", lvert: "|", rvert: "|", lVert: "\u2016", rVert: "\u2016"
  };

  const TEX_BIGOPS = {
    sum: "\u2211", prod: "\u220f", coprod: "\u2210", int: "\u222b", iint: "\u222c",
    oint: "\u222e", bigcup: "\u22c3", bigcap: "\u22c2", bigvee: "\u22c1", bigwedge: "\u22c0"
  };
  const TEX_LIMITS = new Set(["sum", "prod", "coprod", "bigcup", "bigcap", "bigvee", "bigwedge",
    "lim", "min", "max", "sup", "inf", "limsup", "liminf"]);
  const TEX_FUNCS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos",
    "arctan", "sinh", "cosh", "tanh", "log", "ln", "lg", "exp", "det", "dim", "ker", "deg",
    "gcd", "hom", "arg", "mod", "bmod", "lim", "min", "max", "sup", "inf"]);
  const TEX_ACCENTS = { hat: "\u02c6", widehat: "\u02c6", bar: "\u00af", overline: "\u00af",
    vec: "\u2192", tilde: "\u02dc", widetilde: "\u02dc", dot: "\u02d9", ddot: "\u00a8",
    check: "\u02c7", breve: "\u02d8", acute: "\u00b4", grave: "`" };
  const TEX_FONTS = { mathbb: "double-struck", mathcal: "script", mathfrak: "fraktur",
    mathbf: "bold", mathit: "italic", mathrm: "normal", mathsf: "sans-serif",
    mathtt: "monospace", boldsymbol: "bold" };
  const TEX_SPACES = { ",": "0.17em", ":": "0.22em", ";": "0.28em", "!": "0.1em", " ": "0.33em" };
  const TEX_OPS = { "-": "\u2212", "*": "\u2217", "'": "\u2032" };

  function mathNode(tag, children, attrs) {
    return { tag, children: children || [], attrs: attrs || {} };
  }
  function mathText(value) { return { tag: "#text", text: String(value) }; }
  function mathSymbol(value) { return mathNode("mo", [mathText(value)]); }
  function mathSpace(width) { return mathNode("mspace", [], { width }); }

  function mathAttributes(attrs) {
    const keys = Object.keys(attrs || {});
    return keys.length ? ` ${keys.map((key) => `${key}="${attrs[key]}"`).join(" ")}` : "";
  }

  function serializeMath(node) {
    if (node.tag === "#text") return escapeHtml(node.text);
    let core = `<${node.tag}${mathAttributes(node.attrs)}>${node.children.map(serializeMath).join("")}</${node.tag}>`;
    const under = node.__under ? serializeMath(node.__under) : "";
    const over = node.__over ? serializeMath(node.__over) : "";
    const sub = node.__sub ? serializeMath(node.__sub) : "";
    const sup = node.__sup ? serializeMath(node.__sup) : "";
    if (under || over) {
      core = under && over ? `<munderover>${core}${under}${over}</munderover>`
        : under ? `<munder>${core}${under}</munder>` : `<mover>${core}${over}</mover>`;
    } else if (sub || sup) {
      core = sub && sup ? `<msubsup>${core}${sub}${sup}</msubsup>`
        : sub ? `<msub>${core}${sub}</msub>` : `<msup>${core}${sup}</msup>`;
    }
    return core;
  }

  const isTexLetter = (char) => (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");

  /* Tokenise one TeX source string into MathML nodes. */
  function mathNodes(tex) {
    const src = String(tex == null ? "" : tex);
    let pos = 0;
    let depth = 0;

    const skipSpaces = () => { while (pos < src.length && /\s/.test(src[pos])) pos += 1; };

    function readNumber() {
      let text = "";
      while (pos < src.length && /[0-9]/.test(src[pos])) { text += src[pos]; pos += 1; }
      if (src[pos] === "." && /[0-9]/.test(src[pos + 1] || "")) {
        text += "."; pos += 1;
        while (pos < src.length && /[0-9]/.test(src[pos])) { text += src[pos]; pos += 1; }
      }
      return mathNode("mn", [mathText(text)]);
    }

    function readArgument() {
      skipSpaces();
      if (pos >= src.length) return mathNode("mrow", []);
      const atom = readAtom();
      return atom || mathNode("mrow", []);
    }

    /* Raw text of a { ... } group - used by \text and \operatorname, where the
       contents are words, not mathematics. */
    function readRawGroup() {
      skipSpaces();
      if (src[pos] !== "{") { if (pos >= src.length) return ""; const one = src[pos]; pos += 1; return one; }
      pos += 1;
      let text = "";
      let level = 1;
      while (pos < src.length && level > 0) {
        const char = src[pos];
        if (char === "{") level += 1;
        else if (char === "}") { level -= 1; if (!level) { pos += 1; break; } }
        text += char;
        pos += 1;
      }
      return text;
    }

    function applyVariant(node, variant) {
      if (node.tag === "mi" || node.tag === "mn") node.attrs.mathvariant = variant;
      for (const child of node.children || []) applyVariant(child, variant);
    }

    function applyScript(nodes, mark, argument) {
      const base = nodes.length ? nodes.pop() : mathNode("mi", [mathText("")]);
      if (base.__limits) {
        if (mark === "^") base.__over = argument; else base.__under = argument;
      } else if (mark === "^") base.__sup = argument;
      else base.__sub = argument;
      nodes.push(base);
    }

    function readAtom() {
      const char = src[pos];
      if (char === "{") {
        pos += 1;
        const inner = readSequence(true);
        if (src[pos] === "}") pos += 1;
        return mathNode("mrow", inner);
      }
      if (char === "\\") return readControl();
      if (/[0-9]/.test(char)) return readNumber();
      if (isTexLetter(char)) { pos += 1; return mathNode("mi", [mathText(char)]); }
      pos += 1;
      return mathSymbol(TEX_OPS[char] || char);
    }

    function readControl() {
      pos += 1; // the backslash
      if (pos >= src.length) return null;
      const char = src[pos];
      if (!isTexLetter(char)) {
        pos += 1;
        if (char === "\\") return mathSpace("0.3em"); // a row break, treated as space
        if (TEX_SPACES[char]) return mathSpace(TEX_SPACES[char]);
        return mathSymbol(char);
      }
      let name = "";
      while (pos < src.length && isTexLetter(src[pos])) { name += src[pos]; pos += 1; }
      return readControlWord(name);
    }

    function readDelimiter() {
      skipSpaces();
      if (pos >= src.length) return null;
      if (src[pos] === "\\") return readControl();
      const delimiter = src[pos];
      pos += 1;
      return delimiter === "." ? null : mathSymbol(delimiter);
    }

    function readControlWord(name) {
      if (Object.prototype.hasOwnProperty.call(TEX_SYMBOLS, name)) return mathSymbol(TEX_SYMBOLS[name]);
      switch (name) {
        case "frac": case "dfrac": case "tfrac":
          return mathNode("mfrac", [readArgument(), readArgument()]);
        case "sqrt": {
          skipSpaces();
          let index = null;
          if (src[pos] === "[") {
            pos += 1;
            let raw = "";
            while (pos < src.length && src[pos] !== "]") { raw += src[pos]; pos += 1; }
            if (src[pos] === "]") pos += 1;
            index = mathNode("mrow", mathNodes(raw));
          }
          const body = readArgument();
          return index ? mathNode("mroot", [body, index]) : mathNode("msqrt", [body]);
        }
        case "binom": case "dbinom": case "tbinom":
          return mathNode("mrow", [
            mathSymbol("("),
            mathNode("mfrac", [readArgument(), readArgument()], { linethickness: "0" }),
            mathSymbol(")")
          ]);
        case "boxed":
          return mathNode("menclose", [readArgument()], { notation: "box" });
        case "text": case "textrm": case "mbox": case "operatorname":
          return mathNode("mtext", [mathText(readRawGroup())]);
        case "left": case "right": case "big": case "Big": case "bigg": case "Bigg":
        case "bigl": case "bigr": case "Bigl": case "Bigr":
        case "biggl": case "biggr": case "Biggl": case "Biggr":
          return readDelimiter();
        case "quad": return mathSpace("1em");
        case "qquad": return mathSpace("2em");
        case "limits": case "nolimits": case "displaystyle": case "textstyle": case "left.":
          return null;
        default:
          break;
      }
      if (TEX_BIGOPS[name]) {
        const op = mathNode("mo", [mathText(TEX_BIGOPS[name])], { largeop: "true", stretchy: "true" });
        if (TEX_LIMITS.has(name)) op.__limits = true;
        return op;
      }
      if (TEX_FUNCS.has(name)) return mathNode("mi", [mathText(name)], { mathvariant: "normal" });
      if (TEX_ACCENTS[name]) {
        return mathNode("mover", [readArgument(), mathSymbol(TEX_ACCENTS[name])], { accent: "true" });
      }
      if (TEX_FONTS[name]) {
        const body = readArgument();
        applyVariant(body, TEX_FONTS[name]);
        return body;
      }
      // Unknown control sequence: keep the name, upright, rather than dropping it.
      return mathNode("mi", [mathText(name)], { mathvariant: "normal" });
    }

    function readSequence(inGroup) {
      const nodes = [];
      depth += 1;
      if (depth > 64) {
        // Pathological nesting: keep the remainder as plain text and stop recursing.
        let rest = "";
        while (pos < src.length && (!inGroup || src[pos] !== "}")) { rest += src[pos]; pos += 1; }
        depth -= 1;
        return rest ? [mathNode("mtext", [mathText(rest)])] : [];
      }
      while (pos < src.length) {
        const char = src[pos];
        if (char === "}") { if (inGroup) break; pos += 1; continue; }
        if (char === "^" || char === "_") { pos += 1; applyScript(nodes, char, readArgument()); continue; }
        if (char === "&") { pos += 1; continue; }
        if (char === "~") { pos += 1; nodes.push(mathSpace("0.33em")); continue; }
        if (/\s/.test(char)) { pos += 1; continue; }
        const atom = readAtom();
        if (atom) nodes.push(atom);
      }
      depth -= 1;
      return nodes;
    }

    return readSequence(false);
  }

  /* Compile TeX to a MathML string. Empty output means "not usable as maths",
     and the caller falls back to showing the source. */
  function texToMathML(tex, display) {
    let nodes;
    try {
      nodes = mathNodes(tex);
    } catch {
      return "";
    }
    if (!nodes.length) return "";
    const body = serializeMath(mathNode("mrow", nodes));
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${display ? "block" : "inline"}">${body}</math>`;
  }

  /* ------------------------------------------------------------ document model */

  function roleLabel(role) {
    if (role === "user") return "User";
    if (role === "assistant") return "Assistant";
    if (role === "system") return "System";
    return "Message";
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
        block.type === "heading" ? { type: "subheading", level: Math.min(6, Math.max(2, (Number(block.level) || 2) + 1)), text: block.text } : block
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
    /* One grouping policy for every renderer: the multi-choice layout is part
       of the document model, not a CSS trick applied later. */
    return globalThis.AIMcq ? globalThis.AIMcq.group(out) : out;
  }

  /* -------------------------------------------------------------- document css */

  /* Colour for documents lives in utils/document-theme.js and nowhere else.
     The interface palette (export.css, popup.css, content.css) is a different
     system: a document is paper, so it gets a white or charcoal page, ink,
     hairline rules and colour only where it carries meaning. */
  const THEMES = globalThis.AIDocumentTheme.DOC;

  /* Page geometry and typography travel with the document: the preview, the
     print stylesheet and the DOCX section settings all read these values, so a
     layout change cannot apply to only one of them. */
  const PAGE_SIZES = {
    a4: { label: "A4", width: 210, height: 297 },
    letter: { label: "Letter", width: 215.9, height: 279.4 }
  };
  const PAGE_MARGINS = {
    normal: { label: "Normal", top: 16, right: 15, bottom: 14, left: 15 },
    narrow: { label: "Narrow", top: 11, right: 11, bottom: 10, left: 11 },
    wide: { label: "Wide", top: 22, right: 22, bottom: 20, left: 22 }
  };
  const BODY_FONTS = {
    sans: { label: "Inter / system sans", stack: '"Inter", "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif' },
    serif: { label: "Newsreader / Georgia serif", stack: '"Newsreader", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif' }
  };
  const MONO_FONTS = {
    jetbrains: { label: "JetBrains Mono", stack: '"JetBrains Mono", "Cascadia Code", ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace' },
    cascadia: { label: "Cascadia Code", stack: '"Cascadia Code", "JetBrains Mono", ui-monospace, Consolas, "Liberation Mono", Menlo, monospace' },
    consolas: { label: "Consolas", stack: 'Consolas, "Liberation Mono", Menlo, ui-monospace, monospace' }
  };
  const TYPE_SIZES = { compact: 10.5, comfortable: 11.5, large: 12.5 };
  const LINE_HEIGHTS = { compact: 1.45, normal: 1.6, relaxed: 1.75 };
  const PARA_SPACING = { compact: 8, normal: 11, relaxed: 15 };

  function pageOptions(options = {}) {
    const size = PAGE_SIZES[options.pageSize] ? options.pageSize : "a4";
    const preset = PAGE_SIZES[size];
    const landscape = options.orientation === "landscape";
    const marginKey = PAGE_MARGINS[options.margin] ? options.margin : "normal";
    const margin = PAGE_MARGINS[marginKey];
    return {
      size,
      sizeLabel: preset.label,
      orientation: landscape ? "landscape" : "portrait",
      width: landscape ? preset.height : preset.width,
      height: landscape ? preset.width : preset.height,
      marginKey,
      margin
    };
  }

  function typeOptions(options = {}) {
    return {
      body: BODY_FONTS[options.bodyFont] ? options.bodyFont : "sans",
      mono: MONO_FONTS[options.monoFont] ? options.monoFont : "jetbrains",
      monoName: (MONO_FONTS[options.monoFont] || MONO_FONTS.jetbrains).label,
      sizeKey: TYPE_SIZES[options.fontSize] ? options.fontSize : "comfortable",
      size: TYPE_SIZES[options.fontSize] || TYPE_SIZES.comfortable,
      lineKey: LINE_HEIGHTS[options.lineHeight] ? options.lineHeight : "normal",
      lineHeight: LINE_HEIGHTS[options.lineHeight] || LINE_HEIGHTS.normal,
      spacingKey: PARA_SPACING[options.paragraphSpacing] ? options.paragraphSpacing : "normal",
      paragraphSpacing: PARA_SPACING[options.paragraphSpacing] || PARA_SPACING.normal
    };
  }

  function pageCss(page, type) {
    const pad = `${page.margin.top}mm ${page.margin.right}mm ${page.margin.bottom}mm ${page.margin.left}mm`;
    const pageMargin = `${page.margin.top}mm ${page.margin.right}mm ${page.margin.bottom}mm ${page.margin.left}mm`;
    return `:root {
  --page-width: ${page.width}mm;
  --page-height: ${page.height}mm;
  --page-pad: ${pad};
  --base-size: ${type.size}pt;
  --line-height: ${type.lineHeight};
  --para-space: ${type.paragraphSpacing}px;
  --body: ${BODY_FONTS[type.body].stack};
  --mono: ${MONO_FONTS[type.mono].stack};
}
@page { size: ${page.width}mm ${page.height}mm; margin: ${pageMargin}; }`;
  }

  function themeCss(name) {
    const vars = Object.entries(THEMES[name])
      .map(([key, value]) => `  --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value};`)
      .join("\n");
    return `html[data-theme="${name}"] {\n${vars}\n}`;
  }

  const DOCUMENT_CSS = `
:root {
  --display: "Newsreader", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
  /* Multiple-choice rhythm, in points so the preview and the paper agree. */
  --mcq-q: 8pt;
  --mcq-opt: 5pt;
  --mcq-a: 8pt;
  --mcq-e: 6pt;
  --mcq-after: 16pt;
}
/* Three document modes, one stylesheet. Same structure in all three, only
   the palette changes:
     light  - white paper, ink text, hairline rules, colour only where it
              carries meaning: a link, the output panel, a warning
     dark   - a charcoal reading theme with the same restraint
     print  - white paper and near-black ink, so a photocopier reproduces it
   The values come from utils/document-theme.js. The extension's interface
   palette is a separate system and is never applied to a document. */
${themeCss("light")}
${themeCss("dark")}
${themeCss("print")}*,
 *::before, *::after { box-sizing: border-box; }
/* Reader-controlled page breaks. Long blocks are kept whole by default; this
   override is the explicit opt-out for a code block or figure taller than a page. */
html[data-keep="off"] .code, html[data-keep="off"] .figure, html[data-keep="off"] .grid,
html[data-keep="off"] .callout, html[data-keep="off"] .math {
  break-inside: auto; page-break-inside: auto;
}
html, body { margin: 0; padding: 0; }
body {
  background: var(--stage); color: var(--ink); font-family: var(--body);
  font-size: var(--base-size, 11.5pt); line-height: var(--line-height, 1.6);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
.icon { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.7;
  stroke-linecap: round; stroke-linejoin: round; flex: none; }
.sheet {
  position: relative; width: var(--page-width, 210mm); min-height: var(--page-height, 297mm);
  padding: var(--page-pad, 16mm 15mm 14mm); margin: 0 auto 10mm; background: var(--paper);
  box-shadow: 0 10px 30px rgba(2, 6, 23, 0.18);
  break-after: page; page-break-after: always;
}
.sheet:last-of-type { break-after: auto; page-break-after: auto; }

/* cover */
.cover { display: flex; flex-direction: column; background: var(--paper); }
.cover-mark { margin: 44mm auto 0; text-align: center; }
/* A title page, not a poster: a hairline tile, a rule, the title, the facts.
   No gradients and no artwork, in any theme. */
.cover-logo { display: grid; place-items: center; width: 56px; height: 56px; margin: 0 auto;
  border: 1px solid var(--line-strong); border-radius: 8px; background: transparent; color: var(--ink); }
.cover-logo .icon { width: 26px; height: 26px; }
.cover-kicker { margin: 14px 0 0; font-size: 9.5pt; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.cover-rule { width: 46mm; height: 1px; margin: 18px auto 0; background: var(--line-strong); }
.cover-title { margin: 20px auto 0; max-width: 150mm; font-family: var(--display); font-size: 38pt;
  line-height: 1.1; text-align: center; }
.cover-sub { margin: 10px 0 0; color: var(--muted); text-align: center; }
.meta { display: grid; gap: 9px; width: 120mm; margin: 26mm auto 0; }
.meta-row { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--line); }
.meta-row dt { display: flex; align-items: center; gap: 8px; width: 44mm; color: var(--ink-soft); font-size: 10pt; }
.meta-row dd { margin: 0; font-size: 10.5pt; font-weight: 600; }
.meta-row .icon { color: var(--muted); }

/* sections - a document heading, not an interface card: typographic weight
   and a hairline rule instead of a tinted bar and a decorative icon */
.sub { display: block; margin: 22px 0 9px; padding: 0 0 5px;
  border-bottom: 1px solid var(--line); background: transparent; color: var(--head-ink);
  font-family: var(--body); font-size: 14pt; font-weight: 700; line-height: 1.3;
  break-after: avoid; break-inside: avoid; page-break-after: avoid; }
h4.sub, h5.sub, h6.sub { margin: 18px 0 6px; padding-bottom: 0; border-bottom: 0; font-size: 12pt; }
.sheet p { margin: 0 0 var(--para-space, 11px); }
/* A document running header and closing line: present on the content sheet
   only, so the cover stays a cover. */
.doc-runhead, .doc-runfoot {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  color: var(--muted); font-size: 8.5pt; letter-spacing: 0.03em;
}
.doc-runhead { padding-bottom: 7px; margin-bottom: 16px; border-bottom: 1px solid var(--line); }
.doc-runfoot { padding-top: 10px; margin-top: 18px; border-top: 1px solid var(--line); }
.doc-runhead span, .doc-runfoot span { min-width: 0; overflow-wrap: anywhere; }
.doc-runhead span:first-child { color: var(--ink-soft); font-weight: 600; }
.doc-runfoot span:last-child { font-family: var(--mono); font-size: 8pt; }
.divider { margin: 16px 0; border: 0; border-top: 1px solid var(--line); }

/* lists */
.list { display: grid; gap: 7px; margin: 0 0 13px; padding: 0; list-style: none; }
.list li { position: relative; padding-left: 20px; }
.list li::before { content: ""; position: absolute; left: 4px; top: 0.52em; width: 7px; height: 7px;
  border-radius: 50%; background: var(--bullet-a); }
.list ol, .list ul { margin-top: 6px; }
/* code - solid medium-tinted panel, 6px radius, separate header, 13/14px body padding */
.code { margin: 0 0 14px; border: 1px solid var(--code-line); border-radius: 6px; overflow: hidden;
  background: var(--code-bg); break-inside: avoid; page-break-inside: avoid;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.code-head { display: flex; align-items: center; gap: 8px; padding: 8px 14px;
  border-bottom: 1px solid var(--code-line); background: var(--code-head-bg); color: var(--code-head-ink);
  font-family: var(--mono); font-size: 9pt; font-weight: 700; letter-spacing: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.code-head .icon { width: 15px; height: 15px; stroke-width: 2; }
/* Screen readers and copying never see the gutter: the numbers are decorative,
   and the code text is unchanged beside them. */
.code-body { display: flex; align-items: stretch; min-width: 0; }
.code-gutter { flex: none; margin: 0; padding: 13px 9px 13px 13px; text-align: right;
  border-right: 1px solid var(--code-line); background: var(--code-bg); color: var(--code-line-no);
  font-family: var(--mono); font-size: 9.5pt; line-height: 1.55; white-space: pre;
  user-select: none; -webkit-user-select: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.code pre { margin: 0; padding: 13px 14px; color: var(--code-ink); font-family: var(--mono); font-size: 9.5pt;
  line-height: 1.55; min-width: 0; flex: 1 1 auto; white-space: pre; overflow-x: auto; tab-size: 4; }
/* ordered lists keep their numbers: the decorative dots are only for bullets */
.list--ordered { list-style: decimal; padding-left: 22px; }
.list--ordered li { padding-left: 0; }
.list--ordered li::before { display: none; }
/* the OUTPUT panel is tinted apart from the code panel, in every mode */
.code--output { background: var(--out-bg); border-color: var(--out-line); }
.code--output .code-head { background: var(--out-head-bg); color: var(--out-head-ink); border-bottom-color: var(--out-line); }
.code--output pre { background: var(--out-bg); color: var(--out-ink); }
.tok-kw { color: var(--tok-kw); } .tok-str { color: var(--tok-str); } .tok-num { color: var(--tok-num); }
.tok-com { color: var(--tok-com); font-style: italic; }
.tok-fn { color: var(--tok-fn); } .tok-type { color: var(--tok-type); }
code.inline { padding: 1px 5px; border-radius: 4px; background: var(--inline-bg); color: var(--inline-ink);
  font-family: var(--mono); font-size: 0.93em; }
.code pre code { padding: 0; background: transparent; color: inherit; border: 0; }
/* Selecting text must never paint a dark band over the page: a drag over a
   code panel is how people copy code out of the document, and the default
   browser highlight looked like a dark panel had crept back into the print
   theme. Keep the selection tint pale in both themes. */
::selection { background: color-mix(in srgb, var(--accent) 18%, transparent); color: inherit; }
.tex { font-family: var(--mono); font-style: italic; color: var(--accent-ink); }
/* Math is real MathML, so the browser styles it; the wrapper only sizes it. */
.math-inline math, .math math { font-size: 1.06em; }

/* callouts, tables, figures, math */
.callout { margin: 0 0 14px; padding: 0; border: 1px solid var(--note-line);
  border-radius: 6px; background: var(--note-bg); break-inside: avoid; overflow-wrap: anywhere;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.callout--tip { border-color: var(--tip-line); background: var(--tip-bg); }
.callout--warning { border-color: var(--warning-line); background: var(--warning-bg); }
.callout-chip { display: flex; align-items: center; gap: 7px; padding: 7px 13px; color: var(--note-chip);
  background: var(--note-head-bg); border-bottom: 1px solid var(--note-line);
  font-size: 9pt; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
  break-after: avoid; page-break-after: avoid; }
.callout-chip .icon { width: 15px; height: 15px; stroke-width: 2; }
.callout--tip .callout-chip { color: var(--tip-chip); background: var(--tip-head-bg); border-bottom-color: var(--tip-line); }
.callout--tip { border-color: var(--tip-line); }
.callout--warning .callout-chip { color: var(--warning-chip); background: var(--warning-head-bg); border-bottom-color: var(--warning-line); }
.callout p { margin: 0; padding: 12px 13px; color: var(--note-ink); white-space: pre-line; overflow-wrap: anywhere; }
.callout--tip p { color: var(--tip-ink); }
.callout--warning p { color: var(--warning-ink); }
.grid { width: 100%; max-width: 100%; min-width: 0; margin: 0 0 14px; border-collapse: collapse; table-layout: fixed; font-size: 9.5pt;
  break-inside: auto; page-break-inside: auto; }
.grid th, .grid td { min-width: 0; max-width: 0; padding: 7px 9px; border: 1px solid var(--line); text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: normal; }
.grid .table-cell-text { display: block; min-width: 0; max-width: 100%; overflow-wrap: anywhere; word-break: normal; }
.grid th { background: var(--table-head); color: var(--table-head-ink); font-weight: 700; }
/* Images keep their own aspect ratio and never crop. The panel and its kind
   label make a diagram readable as a figure rather than as loose pixels;
   "inline" reads with the text, "center" is the default plate, "fit" fills the
   printable column. */
.figure { margin: 0 0 16px; padding: 12px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--paper); break-inside: avoid; page-break-inside: avoid; }
.figure-head { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding-bottom: 8px;
  border-bottom: 1px solid var(--line); break-after: avoid; page-break-after: avoid; }
.figure-kind { flex: none; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--code-line);
  background: var(--code-bg); color: var(--code-head-ink); font-family: var(--mono); font-size: 7.5pt;
  font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.figure-title { min-width: 0; color: var(--ink-soft); font-size: 8.5pt; font-weight: 600; overflow-wrap: anywhere; }
.figure img { display: block; height: auto; max-width: 100%; border: 1px solid var(--line);
  border-radius: 5px; background: var(--paper); }
.figure--center { text-align: center; }
.figure--center img { margin: 0 auto; }
.figure--inline { text-align: left; }
.figure--inline img { max-width: min(100%, 118mm); }
.figure--fit { text-align: center; }
.figure--fit img { width: 100%; margin: 0 auto; }
.figure-caption { margin: 8px 0 0; color: var(--muted); font-size: 9pt; break-before: avoid; page-break-before: avoid; }
.figure-source { margin: 3px 0 0; color: var(--muted); font-size: 8.5pt; }
.figure--placeholder { padding: 22px; border: 1px dashed var(--line-strong); border-radius: 8px;
  background: transparent; color: var(--muted); font-size: 9.5pt; text-align: center; }
.math { margin: 0 0 14px; padding: 12px; border-radius: 8px; background: var(--accent-soft);
  color: var(--accent-ink); font-size: 12pt; text-align: center; overflow-x: auto; }

/* multiple-choice questions: one row per option, the letter in its own
   column so a wrapped option aligns with its text. Spacing is in points, so
   the preview and the printed page share one rhythm. */
.mcq { margin: 0 0 var(--mcq-after); break-inside: avoid; page-break-inside: avoid; }
/* .sheet p sets a paragraph margin, so these carry the document selector too:
   the question rhythm is not a paragraph rhythm. */
.sheet .mcq-q { margin: 0 0 var(--mcq-q); font-weight: 700; break-after: avoid; page-break-after: avoid; }
.mcq-opts { display: grid; gap: var(--mcq-opt); margin: 0 0 var(--mcq-a); padding: 0; list-style: none; }
.mcq-opts li { display: grid; grid-template-columns: 1.9em 1fr; column-gap: 4px; align-items: start;
  line-height: 1.45; break-inside: avoid; page-break-inside: avoid; }
.mcq-letter { font-weight: 700; }
.mcq-text { min-width: 0; overflow-wrap: anywhere; }
.sheet .mcq-answer { margin: 0 0 var(--mcq-e); font-weight: 700; break-before: avoid; page-break-before: avoid; }
.sheet .mcq-explain { margin: 0; color: var(--ink-soft); break-before: avoid; page-break-before: avoid; }
html[data-keep="off"] .mcq { break-inside: auto; page-break-inside: auto; }

/* transcript flow */
.flow { display: block; }
.turn { padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1px dashed var(--line); }
.turn:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: 0; }
.turn-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; break-after: avoid; }
.turn-role { padding: 3px 9px; border: 1px solid var(--line); border-radius: 4px;
  background: var(--accent-soft); color: var(--ink-soft);
  font-size: 8.5pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
/* The user's turn is outlined rather than filled: the two roles stay
   distinguishable without relying on colour alone. */
.turn--user .turn-role { background: transparent; color: var(--ink-soft); }
.turn-stamp { color: var(--muted); font-size: 9pt; }

/* print: the sheet chrome is screen dressing, the paper supplies the margins */
@media print {
  html, body { background: #ffffff; }
  body { font-size: 10.5pt; line-height: 1.58; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .cover { min-height: 0; }
  .cover-mark { margin-top: 12mm; }
  .sub, .turn-head, h1, h2, h3 { break-after: avoid; page-break-after: avoid; break-inside: avoid; }
  .code, .grid, .figure, .callout, .math { break-inside: avoid; page-break-inside: avoid; }
  .grid tr, .list li { break-inside: avoid; }
  p, li { orphans: 2; widows: 2; }
}
/* Shared export rhythm: left-aligned text, a consistent inset, and no clipped
   content when a code sample or table is taller than a printed page. */
.doc { text-align: left; }
.flow, .turn, .turn > *, .code, .callout, .grid { min-width: 0; max-width: 100%; }
.turn { padding-bottom: 18px; margin-bottom: 20px; }
.turn-head { min-height: 24px; }
.sheet p, .list li, .grid td, .grid th, .sub, .meta-row dd, .mcq-q, .mcq-answer, .mcq-explain {
  overflow-wrap: anywhere; word-wrap: break-word;
}
.sheet p { white-space: pre-line; }
.sub { margin-top: 22px; }
.code { border-radius: 6px; text-align: left; }
.code-head { padding: 7px 12px; letter-spacing: 0; text-transform: none; }
.code pre { tab-size: 4; white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; }
.grid { table-layout: fixed; }
.grid th, .grid td { overflow-wrap: anywhere; word-break: normal; }
.grid thead { display: table-header-group; }
.grid tfoot { display: table-footer-group; }
.grid tr { break-inside: avoid; }
.figure img { height: auto; max-height: 240mm; object-fit: contain; }
.meta-row { align-items: flex-start; }
.meta-row dt { flex: 0 0 44mm; }
.meta-row dd { flex: 1; min-width: 0; }
@media print {
  .code, .grid, .callout, .math { break-inside: auto; page-break-inside: auto; }
  .code { overflow: visible; border-radius: 0; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  /* Paper cannot scroll, so a long line wraps instead of being cut off. */
  .code pre { overflow: visible; white-space: pre-wrap; overflow-wrap: anywhere; }
  .code-head { break-after: avoid; page-break-after: avoid; }
  .grid thead { display: table-header-group; }
  .grid tr { break-inside: avoid; page-break-inside: avoid; }
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
<symbol id="i-code" viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></symbol>
<symbol id="i-terminal" viewBox="0 0 24 24"><path d="M4 6.5l5.5 5.5L4 17.5M12.5 18H20"/></symbol>
<symbol id="i-note" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="M12 11.2v5M12 7.6h.01" stroke="#ffffff"/></symbol>
</svg>`;

  function icon(id, className = "icon") {
    return `<svg class="${className}" aria-hidden="true"><use href="#${id}"></use></svg>`;
  }

  /* --------------------------------------------------------- block rendering */

  function renderList(block) {
    const items = block.items.map((item) => `<li>${formatInline(item)}</li>`).join("");
    /* The parser records whether the source element was <ol> or <ul>. Keep the
       shape: a numbered list flattened to dots loses the step order that was
       the point of the list. */
    return block.ordered
      ? `<ol class="list list--ordered">${items}</ol>`
      : `<ul class="list">${items}</ul>`;
  }

  function renderCode(block, options) {
    const source = String(block.code == null ? "" : block.code);
    const label = block.output ? "Output" : String(block.language || "code").replace(/^\w/, (c) => c.toUpperCase());
    const body = options.highlight !== false ? highlight(source, block.language) : escapeHtml(source);
    /* Numbers only where they help: a three-line snippet does not need a gutter,
       and output is terminal text rather than source. */
    const lines = source.split("\n").length;
    const numbered = !block.output && lines >= 3 && options.lineNumbers !== false;
    const gutter = numbered
      ? `<span class="code-gutter" aria-hidden="true">${Array.from({ length: lines }, (_, index) => index + 1).join("\n")}</span>`
      : "";
    return `<figure class="code${block.output ? " code--output" : ""}">
<div class="code-head">${icon(block.output ? "i-terminal" : "i-code")}<span class="code-lang">${escapeHtml(label)}</span></div>
<div class="code-body">${gutter}<pre><code>${body}</code></pre></div></figure>`;
  }

  function renderTable(block) {
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const columns = Math.max((block.head || []).length, ...rows.map((row) => row.length), 1);
    const cells = (row, tag) => Array.from({ length: columns }, (_, index) =>
      `<${tag}><span class="table-cell-text">${formatInline(row[index] == null ? "" : row[index])}</span></${tag}>`
    ).join("");
    const head = block.head && block.head.length ? `<thead><tr>${cells(block.head, "th")}</tr></thead>` : "";
    return `<table class="grid" style="--table-columns:${columns}">${head}<tbody>${rows.map((row) => `<tr>${cells(row, "td")}</tr>`).join("")}</tbody></table>`;
  }

  /**
   * Image sources that may be embedded: a raster data URI, or an https URL.
   * Three deliberate exclusions, all of them things a page can put in an
   * <img src> and the old single /^data:image\// test waved through:
   *   - data:image/svg+xml is a whole document with scripting and external
   *     references. It is inert inside an <img>, but this file is also opened
   *     in viewers and re-imported into Word/Docs, which do not sandbox it.
   *   - plain http is blocked as mixed content from a chrome-extension:/blob:
   *     document anyway, so it would only ever render as a broken image.
   *   - javascript:/blob:/file: never render at all.
   */
  const SAFE_IMAGE_SRC = /^(?:data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+|https:\/\/[^\s"'<>]+)$/i;

  function safeImageSrc(value) {
    const src = String(value == null ? "" : value);
    return SAFE_IMAGE_SRC.test(src) ? src : "";
  }

  function imageSrcFor(value, options = {}) {
    const safe = safeImageSrc(value);
    return /^https:/i.test(safe) && options.remoteImages !== true ? "" : safe;
  }

  /* One reading of the image controls for every renderer. Word and the PNG
     canvas read the same object, so "include images: off" means the same file
     in every format instead of a different promise per download. */
  const IMAGE_LAYOUTS = new Set(["inline", "center", "fit"]);

  function imageOptions(options = {}) {
    return {
      images: options.includeImages !== false,
      diagrams: options.includeDiagrams !== false,
      positions: options.keepImagePositions !== false,
      captions: options.includeCaptions !== false,
      sources: options.includeImageSources === true,
      layout: IMAGE_LAYOUTS.has(options.imageLayout) ? options.imageLayout : "center",
      quality: options.imageQuality === "high" ? "high" : "standard",
      remoteImages: options.remoteImages === true,
      // Per-asset opt-outs from the visual asset drawer, addressed by the stable
      // ids the export view assigns to image blocks.
      excluded: new Set(Array.isArray(options.excludedAssets) ? options.excludedAssets : [])
    };
  }

  function imageLabel(block) {
    return block.caption || block.alt || "Image from the conversation";
  }

  /* Pages often caption a figure "Figure 3: ..." already, so the generated
     number is only added when the label does not carry one. */
  function figureCaption(block, number) {
    const label = imageLabel(block);
    return /^fig(?:ure)?\.?\s*\d+/i.test(label) ? label : `Fig. ${number}: ${label}`;
  }

  function imageSourceLabel(block) {
    const src = String(block.src || "");
    if (/^data:/i.test(src)) return "Embedded image";
    try {
      return new URL(src).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  /* A diagram, chart or infographic is its own toggle; everything else counts
     as a source image. Screenshots and generated illustrations stay "image". */
  const IMAGE_KIND_LABELS = { image: "Image", diagram: "Diagram", chart: "Chart", infographic: "Infographic" };

  function imageKind(block) {
    return block && block.kind && block.kind !== "image" ? block.kind : "image";
  }

  function imageKindLabel(block) {
    return IMAGE_KIND_LABELS[imageKind(block)] || "Image";
  }

  function imageWanted(block, settings) {
    if (!settings.images) return false;
    if (!settings.diagrams && imageKind(block) !== "image") return false;
    return !(block && block.assetId && settings.excluded && settings.excluded.has(block.assetId));
  }

  /** What the selected messages will actually carry, for the export view. */
  function analyzeImages(chat, options = {}, format = "") {
    const settings = imageOptions(options);
    const counts = { total: 0, included: 0, embedded: 0, remote: 0, blocked: 0, omitted: 0 };
    for (const message of (chat && chat.messages) || []) {
      for (const block of message.blocks || []) {
        if (!block || block.type !== "image") continue;
        counts.total += 1;
        if (!imageWanted(block, settings)) { counts.omitted += 1; continue; }
        const safe = imageSrcFor(block.src, settings);
        // Word only embeds inline raster data; a remote URL cannot be fetched
        // by the offline package writer, so it stays a labelled placeholder.
        // Word cannot embed a remote URL, so it is always a labelled placeholder there.
        /* Word embeds inline raster data only; a remote URL either becomes a
           labelled placeholder or, when retrieval is opted in, is converted to
           an inline PNG before the package is written. */
        const remoteForWord = format === "docx" && /^https:/i.test(safe) && !settings.remoteImages;
        if (!safe || block.unavailableReason || remoteForWord) { counts.blocked += 1; continue; }
        counts.included += 1;
        if (/^data:/i.test(safe)) counts.embedded += 1;
        else counts.remote += 1;
      }
    }
    let message = "";
    if (counts.blocked && format === "docx") {
      message = `${counts.blocked} visual${counts.blocked === 1 ? " becomes" : "s become"} placeholders in Word: Word cannot embed remote images.`;
    } else if (counts.blocked) {
      const remoteOff = !settings.remoteImages;
      if (format === "docx") {
        message = `${counts.blocked} visual${counts.blocked === 1 ? " becomes" : "s become"} placeholders in Word: Word cannot embed remote images, so they stay as labelled placeholders.`;
      } else {
        message = remoteOff
          ? `${counts.blocked} remote visual${counts.blocked === 1 ? " is" : "s are"} not embedded. Enable 'Load remote images' in Advanced to attempt retrieval; inaccessible assets will be listed after export.`
          : `${counts.blocked} visual${counts.blocked === 1 ? " needs" : "s need"} attention. Unsupported or inaccessible assets will be listed in the export result.`;
      }
    } else if (counts.remote) {
      message = `${counts.remote} remote visual${counts.remote === 1 ? " will" : "s will"} be fetched from the selected conversation's image hosts after permission is confirmed.`;
    }

    return { ...counts, message };
  }

  function renderImage(block, state, settings) {
    if (!imageWanted(block, settings)) return "";
    const safe = imageSrcFor(block.src, settings);
    const label = imageLabel(block);
    if (!safe) {
      const reason = block.unavailableReason ? ` — ${block.unavailableReason}` : "";
      return `<div class="figure figure--placeholder" role="note">Image not embedded: ${escapeHtml(label + reason)}</div>`;
    }
    state.figures += 1;
    const layout = IMAGE_LAYOUTS.has(settings.layout) ? settings.layout : "center";
    const width = Number(block.width);
    const height = Number(block.height);
    const dimensions = width > 0 && height > 0 ? ` width="${Math.round(width)}" height="${Math.round(height)}"` : "";
    // One figcaption per figure (valid HTML); the type/title strip is a div.
    const head = settings.captions
      ? `<div class="figure-head"><span class="figure-kind">${imageKindLabel(block)}</span><span class="figure-title">${escapeHtml(block.alt || label)}</span></div>`
      : "";
    const caption = settings.captions
      ? `<figcaption class="figure-caption">${escapeHtml(figureCaption(block, state.figures))}</figcaption>`
      : "";
    const source = settings.sources && imageSourceLabel(block)
      ? `<figcaption class="figure-source">Source: ${escapeHtml(imageSourceLabel(block))}</figcaption>`
      : "";
    const anchor = block.assetId ? ` id="asset-${escapeHtml(block.assetId)}"` : "";
    // referrerpolicy: a remote image must not tell its host where the exported
    // document was opened from.
    return `<figure${anchor} class="figure figure--${layout} figure--${imageKind(block)}">${head}<img src="${escapeHtml(safe)}" alt="${escapeHtml(block.alt || label)}"${dimensions} referrerpolicy="no-referrer">
${caption}${source}</figure>`;
  }

  const CALLOUT_LABEL = /^(important|note|warning|remember|key takeaway|tip)\s*:?\s*/i;

  function calloutDetails(text) {
    const match = CALLOUT_LABEL.exec(plainInline(text));
    const label = match ? match[1].toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "";
    return match ? { label, text: String(text).slice(match[0].length), kind: "note", warning: label === "Warning" } : null;
  }

  /* A paragraph that opens with "Important:" or "Note —" is a callout too, not
     only a quotation. The separator is required so ordinary prose such as
     "Note that indices start at zero" keeps reading as prose. */
  const PARAGRAPH_CALLOUT = /^(important|note|warning|remember|key takeaway|tip)\s*[:\u2014\u2013-]\s*/i;

  function paragraphCallout(text) {
    const raw = String(text == null ? "" : text);
    const match = PARAGRAPH_CALLOUT.exec(raw);
    if (!match || !plainInline(raw.slice(match[0].length)).trim()) return null;
    const label = match[1].toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    return { label, text: raw.slice(match[0].length), kind: "note", warning: label === "Warning" };
  }

  /** The one callout markup, so HTML, the print view and the PNG agree. */
  function calloutHtml(note) {
    return `<aside class="callout${note.warning ? " callout--warning" : ""}" role="note"><span class="callout-chip">${icon("i-note")}${escapeHtml(note.label)}</span><p>${formatInline(note.text)}</p></aside>`;
  }

  /* A multiple-choice question is a document block, not a paragraph with
     line breaks: every option gets its own row, the letter in its own column
     so a wrapped option lines up with its text instead of the letter. */
  function mcqHtml(block) {
    const options = block.options
      .map((option) =>
        `<li><span class="mcq-letter">${escapeHtml(option.letter)}.</span><span class="mcq-text">${formatInline(option.text)}</span></li>`
      )
      .join("");
    return `<section class="mcq" aria-label="Multiple-choice question">
<p class="mcq-q">${formatInline(block.question)}</p>
<ol class="mcq-opts" role="list">${options}</ol>${block.answer ? `\n<p class="mcq-answer">${formatInline(block.answer)}</p>` : ""}${block.explanation ? `\n<p class="mcq-explain">${formatInline(block.explanation)}</p>` : ""}
</section>`;
  }

  function renderBlock(block, options, state) {
    switch (block.type) {
      case "heading":
      case "subheading": {
        const level = Math.min(6, Math.max(2, Number(block.level) || 3));
        return `<h${level} class="sub">${formatInline(block.text)}</h${level}>`;
      }
      case "mcq":
        return mcqHtml(block);
      case "paragraph": {
        const note = paragraphCallout(block.text);
        return note ? calloutHtml(note) : `<p>${formatInline(block.text)}</p>`;
      }
      case "list":
        return renderList(block);
      case "quote": {
        const note = calloutDetails(block.text);
        if (!note) return `<blockquote class="quote">${formatInline(block.text)}</blockquote>`;
        return calloutHtml(note);
      }
      case "code":
        return renderCode(block, options);
      case "table":
        return renderTable(block);
      case "image":
        return renderImage(block, state, options);
      case "formula": {
        const mathml = texToMathML(block.tex, true);
        return `<div class="math">${mathml || `<span class="tex">${escapeHtml(block.tex)}</span>`}</div>`;
      }
      case "divider":
        return '<hr class="divider">';
      default:
        return "";
    }
  }

  /* Documents stream: blocks in order, no panels grouping them. A card around
     a whole answer is interface furniture, and it cannot paginate cleanly. */
  function renderBlocks(blocks, options, state) {
    return normalizeBlocks(blocks || []).map((block) => renderBlock(block, options, state)).join("\n");
  }

  /* -------------------------------------------------------- document assembly */

  /** What the cover calls this file. Word builds its own cover in docx.js. */
  function formatLabel(settings) {
    if (settings.format === "docx") {
      return settings.docMode === "bw" ? "Word (.docx), black and white" : "Word (.docx)";
    }
    if (settings.format === "html") return "HTML document";
    const page = settings.page;
    const geometry = page ? `${page.sizeLabel}, ${page.orientation === "landscape" ? "Landscape" : "Portrait"}` : "A4, Portrait";
    if (settings.theme === "dark") return `PDF (Dark Theme, ${geometry})`;
    if (settings.theme === "print") return `PDF (Printable, ${geometry})`;
    return `PDF (${geometry})`;
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

  /** Build the styled document body + css shared by the HTML view and print. */
  function buildDocument(chat, options = {}) {
    const page = pageOptions(options);
    const type = typeOptions(options);
    const settings = {
      theme: options.theme === "dark" ? "dark" : options.theme === "print" ? "print" : "light",
      docMode: options.docMode === "bw" ? "bw" : "color",
      timestamps: Boolean(options.timestamps),
      highlight: options.highlight !== false,
      // The paged preview doubles as Word and standalone HTML; its cover must
      // name the file the primary action will actually produce.
      format: ["pdf", "docx", "html"].includes(options.format) ? options.format : "pdf",
      keepBlocks: options.keepBlocks !== false,
      page,
      type,
      ...imageOptions(options)
    };
    const sections = sectionsFor(chat);
    const figures = [];
    /* "Preserve original positions" switches between reading order and a
       figures plate after the transcript. The images themselves, their
       captions and their order never change. */
    if (!settings.positions) {
      for (const section of sections) {
        section.blocks = section.blocks.filter((block) => {
          if (block.type !== "image") return true;
          figures.push(block);
          return false;
        });
      }
    }
    const state = { figures: 0, variant: "" };
    const turns = sections.map((section) => turnHtml(section, settings, state)).join("\n");
    const plate = figures.length
      ? `<article class="sheet doc">
<div class="flow"><header class="turn-head"><span class="turn-role">Figures</span></header>
${figures.map((block) => renderImage(block, state, settings)).join("\n")}
</div></article>`
      : "";
    const runHead = `<div class="doc-runhead"><span>${escapeHtml(chat.title || "AI conversation")}</span><span>${escapeHtml(
      [chat.platformLabel || "AI conversation", formatDate(chat.exportedAt, false)].filter(Boolean).join(" · ")
    )}</span></div>`;
    const runFoot = `<div class="doc-runfoot"><span>Exported with AI Exporter Studio</span><span>${(chat.messages || []).length} messages · ${escapeHtml(
      settings.page.sizeLabel
    )} ${settings.page.orientation}</span></div>`;
    const body = `${coverSheet(chat, settings)}
<article class="sheet doc">
${runHead}
<div class="flow">${turns}</div>
${runFoot}
</article>
${plate}`;

    return { css: `${DOCUMENT_CSS}\n${pageCss(page, type)}`, body, sections, settings };
  }

  function documentHtml(chat, options = {}) {
    const { css, body, settings } = buildDocument(chat, options);
    return `<!doctype html>
<html lang="en" data-theme="${settings.theme}" data-keep="${settings.keepBlocks ? "on" : "off"}">
<head>
<meta charset="utf-8">
<!-- The exported document has no scripts by construction, and this says so
     where the browser can enforce it. It is the second layer, not the first:
     the preview frame is deliberately same-origin with the extension page so
     the view can measure and print it, which means a failure of the escaping
     above would otherwise run page content with extension privileges. It also
     covers the two consumers with no sandbox at all - 'Open in tab' and the
     saved .html file opened from disk. -->
<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="color-scheme" content="${settings.theme === "dark" ? "dark" : "light"}">
<title>${escapeHtml(chat.title || "AI conversation")}</title>
<style>${css}</style>
</head>
<body>${SPRITE}
${body}
</body>
</html>`;
  }

  /* --------------------------------------------------------- other formats */

  function markdownText(value) {
    // Text nodes from the page are not HTML, even in readers that allow raw HTML.
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\").replace(/[\[\]]/g, "\\$&")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Mathematics keeps its TeX verbatim: a viewer with math support renders the
     $...$ / $$...$$ itself, so backslashes and braces must not be Markdown-escaped
     (doubling \ was what used to break every formula). Only the characters that
     could become markup are neutralised, which keeps the source inert in viewers
     that ignore maths. */
  function markdownMath(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function markdownInline(value) {
    return String(value == null ? "" : value)
      .split(/(\$[^$\n]+\$)/g)
      .map((part) => {
        const math = /^\$([^$\n]+)\$$/.exec(part);
        return math ? `$${markdownMath(math[1])}$` : markdownText(part);
      })
      .join("");
  }

  function markdownCell(value) {
    return markdownInline(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  }

  function codeFence(code) {
    const runs = String(code).match(/`+/g) || [];
    return "`".repeat(runs.reduce((longest, run) => Math.max(longest, run.length + 1), 3));
  }

  function markdownBlocks(blocks, options = {}) {
    return normalizeBlocks(blocks || [])
      .map((block) => {
        switch (block.type) {
          case "heading":
            return `${"#".repeat(Math.max(1, Math.min(6, (Number(block.level) || 2) + 1)))} ${markdownInline(block.text)}`;
          case "subheading":
            return `${"#".repeat(Math.min(6, block.level || 3))} ${markdownInline(block.text)}`;
          case "paragraph":
            return markdownInline(block.text);
          case "mcq":
            /* One paragraph per option, so a reader sees the same separation
               the PDF shows. */
            return [
              markdownInline(block.question),
              ...block.options.map((option) => `${option.letter}. ${markdownInline(option.text)}`),
              block.answer ? markdownInline(block.answer) : "",
              block.explanation ? markdownInline(block.explanation) : ""
            ].filter(Boolean).join("\n\n");
          case "list":
            return block.items
              .map((item, index) => (block.ordered ? `${index + 1}. ${markdownInline(item)}` : `- ${markdownInline(item)}`))
              .join("\n");
          case "quote": {
            const note = calloutDetails(block.text);
            return note
              ? `> **${markdownText(note.label)}:** ${markdownInline(note.text)}`
              : markdownInline(block.text).split("\n").map((line) => `> ${line}`).join("\n");
          }
          case "code": {
            const fence = codeFence(block.code);
            const language = String(block.language || "").replace(/[^a-z0-9_+#.-]/gi, "");
            return `${fence}${language !== "text" ? language : ""}\n${block.code}\n${fence}`;
          }
          case "table": {
            const rows = block.rows || [];
            const columns = Math.max((block.head || []).length, ...rows.map((row) => row.length), 1);
            const pad = (row) => Array.from({ length: columns }, (_, index) => markdownCell(row[index] || ""));
            const head = pad(block.head || []);
            const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => ":---").join(" | ")} |`];
            for (const row of rows) lines.push(`| ${pad(row).join(" | ")} |`);
            return lines.join("\n");
          }
          case "image": {
            if (!imageWanted(block, imageOptions(options))) return "";
            /* A markdown image is a link, so the alt text is a place page content
               could otherwise inject its own link syntax into the file, and the
               src a place a javascript: target could hide. Inline data URIs are
               embedded bytes, not a session URL, so the file stays portable. */
            const alt = markdownText(block.alt || block.caption || "image").replace(/[\\[\]`\r\n]/g, " ");
            const src = imageSrcFor(block.src, options);
            if (!src) return `[image not embedded: ${alt}]`;
            const lines = [`![${alt}](<${src}>)`];
            if (options.includeCaptions !== false && (block.caption || block.alt)) {
              lines.push(`*${markdownText(block.caption || block.alt).replace(/\r?\n/g, " ")}*`);
            }
            if (options.includeImageSources === true && imageSourceLabel(block)) {
              lines.push(`Source: ${markdownText(imageSourceLabel(block))}`);
            }
            return lines.join("\n\n");
          }
          case "formula":
            // A $$...$$ block renders as display maths in any math-aware reader;
            // in one without maths it still shows the source between the dollars.
            return `$$\n${markdownMath(block.tex)}\n$$`;
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
      `# ${markdownText(chat.title || "AI conversation").replace(/[\r\n]+/g, " ")}`,
      `> Exported from ${markdownText(chat.platformLabel || "an AI chat")}${chat.model ? ` (${markdownText(chat.model)})` : ""} with AI Exporter`,
      `> ${formatDate(chat.exportedAt, true)} - ${(chat.messages || []).length} messages`,
      /^https:\/\//i.test(chat.url || "") ? `> Source: ${markdownText(chat.url).replace(/[\r\n]+/g, " ")}` : null
    ].filter(Boolean);

    for (const message of chat.messages || []) {
      const stamp = options.timestamps && message.timestamp ? ` (${formatTime(message.timestamp)})` : "";
      parts.push(`## ${roleLabel(message.role)}${stamp}`);
      const content = markdownBlocks(message.blocks, options);
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
          case "mcq":
            lines.push(plainInline(block.question), "");
            for (const option of block.options) lines.push(`  ${option.letter}. ${plainInline(option.text)}`, "");
            if (block.answer) lines.push(plainInline(block.answer), "");
            if (block.explanation) lines.push(plainInline(block.explanation), "");
            break;
          case "list":
            lines.push(
              ...block.items.map(
                (item, index) => `  ${block.ordered ? `${index + 1}.` : "-"} ${plainInline(item)}`
              ),
              ""
            );
            break;
          case "quote": {
            const note = calloutDetails(block.text);
            const text = note ? `${note.label}: ${plainInline(note.text)}` : plainInline(block.text);
            lines.push(...text.split("\n").map((line) => `  > ${line}`), "");
            break;
          }
          case "code":
            lines.push(block.code, "");
            break;
          case "table":
            if (block.head && block.head.length) lines.push(block.head.join(" | "));
            lines.push(...(block.rows || []).map((row) => row.join(" | ")), "");
            break;
          case "image":
            if (imageWanted(block, imageOptions(options))) {
              lines.push(`[image: ${block.caption || block.alt || block.src}]`, "");
            }
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
          // Versioned so a consumer can rely on the shape of this file.
          schemaVersion: 1,
          theme: options.theme === "dark" ? "dark" : options.theme === "print" ? "print" : "light",
          docMode: options.docMode === "bw" ? "bw" : "color",
          timestamps: Boolean(options.timestamps),
          highlight: options.highlight !== false,
          remoteImages: options.remoteImages === true
        }
      },
      null,
      2
    )}\n`;
  }

  /* ------------------------------------------------------------- png poster */

  const PNG_THEMES = Object.fromEntries(Object.entries(THEMES).map(([name, theme]) => [name, {
    page: theme.paper, ink: theme.ink, muted: theme.muted, line: theme.line,
    accent: theme.accent, accentSoft: theme.accentSoft,
    codeBg: theme.codeBg, codeHead: theme.codeHeadBg,
    codeInk: theme.codeInk, codeHeadInk: theme.codeHeadInk, codeLine: theme.codeLine,
    outBg: theme.outBg, outHead: theme.outHeadBg, outHeadInk: theme.outHeadInk,
    outInk: theme.outInk, outLine: theme.outLine,
    noteBg: theme.noteBg, noteHeadBg: theme.noteHeadBg, noteLine: theme.noteLine,
    noteInk: theme.noteInk, tipBg: theme.tipBg,
    warningBg: theme.warningBg, warningHeadBg: theme.warningHeadBg,
    warningLine: theme.warningLine, warningInk: theme.warningInk
  }]));

  const PNG_FONTS = {
    title: '700 46px "Newsreader", Georgia, "Times New Roman", serif',
    section: '700 32px "Inter", "Segoe UI", Roboto, sans-serif',
    sub: '700 23px "Inter", "Segoe UI", Roboto, sans-serif',
    body: '400 20px "Inter", "Segoe UI", Roboto, sans-serif',
    meta: '400 18px "Inter", "Segoe UI", Roboto, sans-serif',
    code: '400 17px "JetBrains Mono", "Cascadia Code", Consolas, monospace'
  };

  /**
   * Canvas poster of the conversation. Layout is measured first and painted
   * second, so a 1x measuring context and the real 2x context share one pass.
   */
  function pngLayout(chat, options, ctx, images = new Map()) {
    const theme = PNG_THEMES[options.theme === "dark" ? "dark" : options.theme === "print" ? "print" : "light"];
    const imageSettings = imageOptions(options);
    let figures = 0;
    const W = 1240;
    const PAD = 78;
    const width = W - PAD * 2;
    const nodes = [];
    let y = 0;

    const wrap = (text, font, maxWidth) => {
      ctx.font = font;
      const lines = [];
      let line = "";
      for (const word of String(text).split(/\s+/).filter(Boolean)) {
        let rest = word;
        while (rest && ctx.measureText(line ? `${line} ${rest}` : rest).width > maxWidth) {
          if (line) { lines.push(line); line = ""; continue; }
          let fit = "";
          for (const char of rest) {
            if (fit && ctx.measureText(fit + char).width > maxWidth) break;
            fit += char;
          }
          if (!fit) fit = rest[0];
          lines.push(fit);
          rest = rest.slice(fit.length);
        }
        if (rest) line = line ? `${line} ${rest}` : rest;
      }
      if (line) lines.push(line);
      return lines.length ? lines : [""];
    };

    const wrapCode = (raw, maxWidth) => {
      ctx.font = PNG_FONTS.code;
      const text = raw.replace(/\t/g, "    ");
      const lines = [];
      let line = "";
      for (const char of text) {
        if (line && ctx.measureText(line + char).width > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
      lines.push(line);
      return lines;
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
          const note = paragraphCallout(block.text);
          if (note) {
            const lines = wrap(plainInline(note.text), PNG_FONTS.body, width - 34);
            const h = (1 + lines.length) * 30 + 24;
            nodes.push({
              kind: "callout", x: PAD, y, w: width, h, lines, label: note.label,
              fill: note.warning ? theme.warningBg : theme.noteBg,
              head: note.warning ? theme.warningHeadBg : theme.noteHeadBg,
              border: note.warning ? theme.warningLine : theme.noteLine,
              ink: note.warning ? theme.warningInk : theme.noteInk,
              font: PNG_FONTS.body, labelFont: PNG_FONTS.meta, lineHeight: 30
            });
            y += h + 14;
          } else {
            addText(block.text, { font: PNG_FONTS.body, color: theme.ink, gap: 12 });
          }
        } else if (block.type === "mcq") {
          addText(block.question, { font: PNG_FONTS.body, color: theme.ink, gap: 8 });
          for (const option of block.options) {
            const textLines = wrap(plainInline(option.text), PNG_FONTS.body, width - 46);
            nodes.push({
              kind: "text", x: PAD, y, lines: [`${option.letter}.`],
              font: PNG_FONTS.body, color: theme.ink, lineHeight: 30
            });
            nodes.push({
              kind: "text", x: PAD + 46, y, lines: textLines,
              font: PNG_FONTS.body, color: theme.ink, lineHeight: 30
            });
            y += textLines.length * 30 + 5;
          }
          if (block.answer) addText(block.answer, { font: PNG_FONTS.body, color: theme.ink, gap: 6 });
          if (block.explanation) addText(block.explanation, { font: PNG_FONTS.body, color: theme.ink, gap: 12 });
          y += 4;
        } else if (block.type === "subheading" || block.type === "heading") {
          y += 8;
          addText(block.text, { font: PNG_FONTS.sub, color: theme.ink, gap: 8 });
        } else if (block.type === "list") {
          /* An ordered list prints its number in the marker column; the wider
             gutter leaves room for double-digit steps. */
          const indent = PAD + (block.ordered ? 36 : 26);
          block.items.forEach((item, index) => {
            if (block.ordered) {
              nodes.push({
                kind: "text", x: PAD + 6, y, lines: [`${index + 1}.`],
                font: PNG_FONTS.meta, color: theme.accent, lineHeight: 30
              });
            } else {
              nodes.push({ kind: "bullet", x: PAD + 8, y, color: theme.accent });
            }
            const lines = wrap(plainInline(item), PNG_FONTS.body, width - (indent - PAD));
            nodes.push({ kind: "text", x: indent, y, lines, font: PNG_FONTS.body, color: theme.ink, lineHeight: 30 });
            y += lines.length * 30 + 8;
          });
          y += 6;
        } else if (block.type === "code") {
          const lines = [];
          for (const raw of String(block.code).split("\n")) {
            lines.push(...wrapCode(raw, width - 32));
          }
          const headH = 34;
          const bodyH = lines.length * 26 + 26;
          const output = Boolean(block.output);
          nodes.push({
            kind: "code",
            x: PAD, y, w: width, h: headH + bodyH,
            lines, headH,
            codeBg: output ? theme.outBg : theme.codeBg,
            headBg: output ? theme.outHead : theme.codeHead,
            codeInk: output ? theme.outInk : theme.codeInk,
            headInk: output ? theme.outHeadInk : theme.codeHeadInk,
            lineColor: output ? theme.outLine : theme.codeLine,
            label: output ? "Output" : String(block.language || "code"),
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
          const note = calloutDetails(block.text);
          if (note) {
            const lines = wrap(plainInline(note.text), PNG_FONTS.body, width - 34);
            const labelLines = wrap(note.label, PNG_FONTS.meta, width - 34);
            const h = (labelLines.length + lines.length) * 30 + 24;
            nodes.push({
              kind: "callout", x: PAD, y, w: width, h, lines, label: note.label,
              fill: note.warning ? theme.warningBg : theme.noteBg,
              head: note.warning ? theme.warningHeadBg : theme.noteHeadBg,
              border: note.warning ? theme.warningLine : theme.noteLine,
              ink: note.warning ? theme.warningInk : theme.noteInk,
              font: PNG_FONTS.body, labelFont: PNG_FONTS.meta, lineHeight: 30
            });
            y += h + 14;
          } else {
            const lines = wrap(plainInline(block.text), PNG_FONTS.body, width - 34);
            const h = lines.length * 30 + 24;
            nodes.push({ kind: "quote", x: PAD, y, w: width, h, lines, bar: theme.accent, ink: theme.ink, font: PNG_FONTS.body, lineHeight: 30 });
            y += h + 14;
          }
        } else if (block.type === "formula") {
          const lines = wrap(block.tex, PNG_FONTS.code, width - 30);
          const h = lines.length * 28 + 24;
          nodes.push({ kind: "callout", x: PAD, y, w: width, h, lines, fill: theme.accentSoft, bar: theme.accent, ink: theme.accent, font: PNG_FONTS.code, lineHeight: 28 });
          y += h + 14;
        } else if (block.type === "image") {
          if (!imageWanted(block, imageSettings)) continue;
          const src = imageSrcFor(block.src, options);
          const picture = src ? images.get(src) : null;
          if (!picture) {
            addText(`[image not embedded: ${imageLabel(block)}]`, {
              font: PNG_FONTS.meta, color: theme.muted, gap: 16
            });
            continue;
          }
          const naturalWidth = picture.naturalWidth || picture.width || 800;
          const naturalHeight = picture.naturalHeight || picture.height || 600;
          const maxWidth = imageSettings.layout === "fit"
            ? width
            : imageSettings.layout === "inline" ? Math.min(width, 560) : Math.min(width, 760);
          let drawWidth = Math.min(maxWidth, naturalWidth);
          let drawHeight = drawWidth * (naturalHeight / Math.max(1, naturalWidth));
          const maxHeight = 1400;
          if (drawHeight > maxHeight) {
            drawHeight = maxHeight;
            drawWidth = drawHeight * (naturalWidth / Math.max(1, naturalHeight));
          }
          const x = imageSettings.layout === "inline" ? PAD : PAD + (width - drawWidth) / 2;
          nodes.push({ kind: "image", x, y, w: drawWidth, h: drawHeight, img: picture, border: theme.line });
          y += drawHeight + 10;
          figures += 1;
          if (imageSettings.captions) {
            addText(figureCaption(block, figures), {
              font: PNG_FONTS.meta, color: theme.muted, gap: imageSettings.sources ? 2 : 14, x
            });
          }
          if (imageSettings.sources && imageSourceLabel(block)) {
            addText(`Source: ${imageSourceLabel(block)}`, {
              font: PNG_FONTS.meta, color: theme.muted, gap: 14, x
            });
          }
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
      } else if (node.kind === "image") {
        ctx.save();
        shape(node.x, node.y, node.w, node.h, 8);
        ctx.clip();
        ctx.drawImage(node.img, node.x, node.y, node.w, node.h);
        ctx.restore();
        if (node.border) {
          ctx.strokeStyle = node.border;
          ctx.lineWidth = 1;
          shape(node.x, node.y, node.w, node.h, 8);
          ctx.stroke();
        }
      } else if (node.kind === "callout") {
        ctx.fillStyle = node.fill;
        shape(node.x, node.y, node.w, node.h, 6);
        ctx.fill();
        if (node.border) {
          ctx.strokeStyle = node.border;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = node.head;
          ctx.fillRect(node.x + 1, node.y + 1, node.w - 2, 30);
          ctx.fillStyle = node.ink;
          ctx.font = `700 ${node.labelFont}`;
          ctx.fillText(node.label.toUpperCase(), node.x + 14, node.y + 21);
          ctx.font = node.font;
          node.lines.forEach((line, index) => {
            ctx.fillText(line, node.x + 14, node.y + 52 + index * node.lineHeight);
          });
        } else {
          ctx.fillStyle = node.bar;
          ctx.fillRect(node.x, node.y, 5, node.h);
          ctx.fillStyle = node.ink;
          ctx.font = node.font;
          node.lines.forEach((line, index) => {
            ctx.fillText(line, node.x + 20, node.y + 24 + index * node.lineHeight);
          });
        }
      } else if (node.kind === "quote") {
        ctx.fillStyle = theme.paper;
        shape(node.x, node.y, node.w, node.h, 6);
        ctx.fill();
        ctx.strokeStyle = theme.line;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = node.bar;
        ctx.fillRect(node.x, node.y, 5, node.h);
        ctx.fillStyle = node.ink;
        ctx.font = node.font;
        node.lines.forEach((line, index) => ctx.fillText(line, node.x + 20, node.y + 24 + index * node.lineHeight));
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

  /* Images have to be decoded before the poster can be measured, and a remote
     one can only be drawn when it allows CORS - otherwise the canvas would be
     tainted and toBlob would fail. A refusal is reported by the placeholder. */
  function loadImageForCanvas(src) {
    return new Promise((resolve) => {
      if (typeof Image === "undefined") { resolve(null); return; }
      const image = new Image();
      if (/^https:/i.test(src)) image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  async function preloadImages(chat, options) {
    const settings = imageOptions(options);
    const loaded = new Map();
    const jobs = [];
    for (const message of (chat && chat.messages) || []) {
      for (const block of message.blocks || []) {
        if (!block || block.type !== "image" || !imageWanted(block, settings)) continue;
        const src = imageSrcFor(block.src, settings);
        if (!src || loaded.has(src)) continue;
        loaded.set(src, null);
        jobs.push(loadImageForCanvas(src).then((image) => { if (image) loaded.set(src, image); }));
      }
    }
    await Promise.all(jobs);
    return loaded;
  }

  async function pngFor(chat, options = {}) {
    if (typeof document === "undefined") throw new Error("PNG export needs a browser document.");
    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) throw new Error("Canvas rendering is unavailable. Use PDF, Word (.docx) or Markdown instead.");
    const layout = pngLayout(chat, options, measure, await preloadImages(chat, options));
    // PNG detail is the one place an image-quality choice changes the bytes:
    // standard rasterises at 1.5x, high at 2x. Document formats always embed
    // the source asset at full resolution.
    const scale = options.imageQuality === "high" ? 2 : 1.5;
    const width = Math.round(layout.width * scale);
    const height = Math.round(layout.height * scale);
    // ponytail: one PNG, capped at 16M pixels (~64MB RGBA); use PDF for longer chats.
    if (width > 16384 || height > 16384 || width * height > 16 * 1024 * 1024) {
      throw new Error("This selection is too large for one PNG. Select fewer messages, or export PDF, Word (.docx) or Markdown instead.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas rendering is unavailable. Use PDF or Markdown instead.");
    try {
      ctx.scale(scale, scale);
      paintPng(ctx, layout);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render the image. Try PDF or a smaller selection.")), "image/png");
      });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  /* --------------------------------------------------------------- validation */

  /**
   * Post-extraction sanity report. The parser already de-duplicates and orders
   * messages, but a silent drop is the one failure an exporter must never hide:
   * when the counts look wrong the export view says so before the user saves.
   */
  function validateChat(chat) {
    const messages = Array.isArray(chat && chat.messages) ? chat.messages : [];
    const counts = { user: 0, assistant: 0, system: 0, unknown: 0, empty: 0, code: 0, tables: 0, images: 0, formulas: 0 };
    const ids = new Set();
    let duplicates = 0;

    for (const message of messages) {
      const role = ["user", "assistant", "system"].includes(message && message.role) ? message.role : "unknown";
      counts[role] += 1;
      if (message && message.id) {
        if (ids.has(message.id)) duplicates += 1;
        ids.add(message.id);
      }
      const blocks = Array.isArray(message && message.blocks) ? message.blocks : [];
      // A message is empty only when neither its text nor any block carries
      // content; a block-only message is still exportable.
      const hasContent = Boolean(String((message && message.text) || "").trim()) || blocks.some((block) =>
        block && (
          String(block.text || "").trim() || String(block.code || "").trim() || String(block.tex || "").trim() ||
          (Array.isArray(block.items) && block.items.length > 0) ||
          (Array.isArray(block.rows) && block.rows.length > 0) || block.type === "image"
        )
      );
      if (!hasContent) counts.empty += 1;
      for (const block of blocks) {
        if (!block) continue;
        if (block.type === "code") counts.code += 1;
        else if (block.type === "table") counts.tables += 1;
        else if (block.type === "image") counts.images += 1;
        else if (block.type === "formula") counts.formulas += 1;
      }
    }

    const issues = [];
    if (!messages.length) issues.push("No messages were detected.");
    if (counts.unknown) issues.push(`${counts.unknown} message${counts.unknown === 1 ? "" : "s"} could not be confidently classified.`);
    if (counts.empty) issues.push(`${counts.empty} message${counts.empty === 1 ? "" : "s"} carried no readable content.`);
    if (duplicates) issues.push(`${duplicates} duplicate message id${duplicates === 1 ? " was" : "s were"} found.`);

    return {
      ok: issues.length === 0,
      total: messages.length,
      counts,
      issues,
      summary: issues.length
        ? `${messages.length} messages detected. ${issues.join(" ")} Review the preview before exporting.`
        : `${messages.length} messages detected.`
    };
  }

  /* --------------------------------------------------------------- formats */

  /* The one format table: cards, labels, preview pane, action and which
     settings can change the produced file all come from here. */
  const FORMATS = {
    pdf: {
      label: "PDF", description: "Print-ready document", pane: "document", action: "Export as PDF",
      icon: "i-pdf", extension: null,
      settings: {
        theme: true, docMode: false, timestamps: true, highlight: true, remoteImages: true, filename: false,
        images: true, diagrams: true, positions: true, captions: true, sources: true, layout: true,
        page: true, typography: true, imageQuality: false
      }
    },
    docx: {
      label: "Word (.docx)", description: "Editable document", pane: "document", action: "Export Word",
      icon: "i-doc", extension: "docx",
      settings: {
        // Word has its own colour/black-and-white palette and plain code, so
        // the document themes and syntax colouring do not apply to it.
        theme: false, docMode: true, timestamps: true, highlight: false, remoteImages: true, filename: true,
        images: true, diagrams: true, positions: true, captions: true, sources: true, layout: true,
        page: true, typography: true, imageQuality: false
      }
    },
    markdown: {
      label: "Markdown", description: "Text with code and images", pane: "source", action: "Download Markdown",
      icon: "i-markdown", extension: "md",
      settings: {
        theme: false, docMode: false, timestamps: true, highlight: false, remoteImages: true, filename: true,
        images: true, diagrams: true, positions: false, captions: true, sources: true, layout: false,
        page: false, typography: false, imageQuality: false
      }
    },
    txt: {
      label: "Text", description: "Plain text, no images", pane: "source", action: "Download TXT",
      icon: "i-txt", extension: "txt",
      settings: {
        theme: false, docMode: false, timestamps: true, highlight: false, remoteImages: false, filename: true,
        images: false, diagrams: false, positions: false, captions: false, sources: false, layout: false,
        page: false, typography: false, imageQuality: false
      }
    },
    json: {
      label: "JSON", description: "Structured conversation data", pane: "source", action: "Download JSON",
      icon: "i-json", extension: "json",
      settings: {
        theme: false, docMode: false, timestamps: false, highlight: false, remoteImages: false, filename: true,
        images: false, diagrams: false, positions: false, captions: false, sources: false, layout: false,
        page: false, typography: false, imageQuality: false
      }
    },
    html: {
      label: "HTML", description: "Standalone web document", pane: "document", action: "Download HTML",
      icon: "i-html", extension: "html",
      settings: {
        theme: true, docMode: false, timestamps: true, highlight: true, remoteImages: true, filename: true,
        images: true, diagrams: true, positions: true, captions: true, sources: true, layout: true,
        page: true, typography: true, imageQuality: false
      }
    },
    image: {
      label: "PNG", description: "Image of the document", pane: "image", action: "Download PNG",
      icon: "i-image", extension: "png",
      settings: {
        theme: true, docMode: false, timestamps: false, highlight: false, remoteImages: true, filename: true,
        images: true, diagrams: true, positions: false, captions: true, sources: true, layout: true,
        page: false, typography: false, imageQuality: true
      }
    }
  };

  /* Users may type a name with or without the extension; never double it. */
  function baseName(chat, options = {}) {
    const custom = String(options.filename == null ? "" : options.filename)
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\.(?:docx|md|txt|json|html|png|pdf)$/i, "")
      .slice(0, 80);
    return custom || slugFor(chat);
  }

  /* ------------------------------------------------------------------- build */

  async function prepareImages(chat, options = {}) {
    if (!options.remoteImages) return { chat, warnings: [] };
    const warnings = [];
    const converted = new Map();
    const messages = [];
    for (const message of chat.messages || []) {
      const blocks = [];
      for (const block of message.blocks || []) {
        if (!block || block.type !== "image" || !/^https:\/\//i.test(String(block.src || "")) || !imageWanted(block, imageOptions(options))) {
          blocks.push(block);
          continue;
        }
        if (!converted.has(block.src)) {
          try {
            const response = await fetch(block.src, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", cache: "no-store" });
            if (!response.ok) throw new Error(`Image host returned HTTP ${response.status}.`);
            const blob = await response.blob();
            if (!/^image\/(?:png|jpe?g|gif|webp|avif)$/i.test(blob.type) || blob.size > 8 * 1024 * 1024) {
              throw new Error("Unsupported image type or image exceeds the 8 MiB limit.");
            }
            const bitmap = await createImageBitmap(blob);
            const pixels = bitmap.width * bitmap.height;
            if (!bitmap.width || !bitmap.height || pixels > 40000000) {
              bitmap.close();
              throw new Error("Image dimensions exceed the 40 megapixel safety limit.");
            }
            const scale = Math.min(1, 3200 / bitmap.width, 3200 / bitmap.height, Math.sqrt(12000000 / pixels));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Image conversion is unavailable.");
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            const png = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Image conversion failed.")), "image/png"));
            const bytes = new Uint8Array(await png.arrayBuffer());
            let binary = "";
            for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
            converted.set(block.src, `data:image/png;base64,${btoa(binary)}`);
            canvas.width = 0; canvas.height = 0;
          } catch (error) {
            converted.set(block.src, null);
            warnings.push({ asset: imageLabel(block), reason: error && error.message ? error.message : "Image could not be retrieved." });
          }
        }
        blocks.push(converted.get(block.src) ? { ...block, src: converted.get(block.src), width: block.width || undefined, height: block.height || undefined } : block);
      }
      messages.push({ ...message, blocks });
    }
    return { chat: { ...chat, messages }, warnings };
  }

  async function build(chat, format, options = {}) {
    const name = baseName(chat, options);
    const prepared = ["docx", "html", "markdown", "image"].includes(format)
      ? await prepareImages(chat, options)
      : { chat, warnings: [] };
    chat = prepared.chat;
    const warnings = prepared.warnings;
    switch (format) {
      case "markdown":
        return { filename: `${name}.md`, mime: "text/markdown", text: markdownFor(chat, options), warnings };
      case "txt":
        return { filename: `${name}.txt`, mime: "text/plain", text: textFor(chat, options) };
      case "json":
        return { filename: `${name}.json`, mime: "application/json", text: jsonFor(chat, options) };
      case "html":
        // The standalone document, self-contained apart from opt-in remote images.
        return { filename: `${name}.html`, mime: "text/html", text: documentHtml(chat, { ...options, format: "html" }), warnings };
      case "docx": {
        const generator = globalThis.AIExporterDocx;
        if (!generator) throw new Error("The Word export is unavailable. Reload the export tab and try again.");
        const bytes = generator.build(chat, options);
        return { filename: `${name}.docx`, mime: generator.MIME, blob: new Blob([bytes], { type: generator.MIME }), bytes, warnings };
      }
      case "image":
        return { filename: `${name}.png`, mime: "image/png", blob: await pngFor(chat, options), warnings };
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  const FORMAT_LABELS = Object.fromEntries(Object.entries(FORMATS).map(([id, meta]) => [id, meta.label]));

  globalThis.AIExporter = {
    version: VERSION,
    build,
    FORMATS,
    THEMES,
    buildDocument,
    documentHtml,
    imageOptions,
    analyzeImages,
    prepareImages,
    pageOptions,
    typeOptions,
    PAGE_SIZES,
    PAGE_MARGINS,
    BODY_FONTS,
    MONO_FONTS,
    markdownFor,
    textFor,
    jsonFor,
    validateChat,
    pngFor,
    sectionsFor,
    formatDate,
    formatTime,
    slugFor,
    escapeHtml,
    texToMathML,
    baseName,
    FORMAT_LABELS
  };
})();
