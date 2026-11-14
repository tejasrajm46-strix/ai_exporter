/**
 * AI Exporter - Word (.docx) generator.
 *
 * A .docx is a ZIP package of XML parts, and this file writes one without any
 * dependency: a small store-only ZIP writer, the package scaffolding
 * ([Content_Types].xml, relationships, core properties) and word/document.xml
 * built from the same block model the preview uses.
 *
 * What it preserves, because these are the reasons a Word export exists:
 *  - editable headings, paragraphs, lists (real numbering), tables (real
 *    table rows, header repeated on page breaks) and images
 *  - code as one paragraph per source line in a monospaced style, with
 *    indentation and blank lines intact, and short blocks kept together
 *  - metadata, page size (A4) and margins
 *  - a black-and-white mode that drops every colour
 *
 * What it deliberately does not do: download remote images (the export runs
 * offline). Mathematics is converted into Word's own equation markup (OMML), so
 * a .docx holds editable fractions, scripts, limits and matrices rather than
 * TeX flattened into text.
 */
(() => {
  "use strict";

  const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const encoder = new TextEncoder();
  const EMU_PER_PX = 9525;
  const MM_TO_TWIPS = 56.6929;
  const MM_TO_EMU = 36000;

  /** Page geometry is read from the exporter when present, so preview and file agree. */
  function pageSettings(options = {}) {
    const shared = globalThis.AIExporter && globalThis.AIExporter.pageOptions;
    const page = shared ? shared(options) : null;
    if (page) return page;
    return {
      sizeLabel: "A4", orientation: "portrait", width: 210, height: 297,
      margin: { top: 16, right: 15, bottom: 14, left: 15 }
    };
  }

  /* ------------------------------------------------------- headers and footers */

  /* Word draws a page number as a field, never as text: PAGE is recalculated by
     the application, so a footer holding a literal "1" would print 1 on every
     page. Begin / instruction / end are the field; the cached result between
     "separate" and "end" is what a viewer that does not recalculate shows. */
  function pageField(palette) {
    return '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      run("1", { color: palette.muted, size: 18 }) +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
  }

  /* Page furniture is opt-out, not opt-in: a multi-page document without page
     numbers is the surprising result. A header and a footer line are opt-in. */
  function chromeSettings(options = {}) {
    const position = ["left", "center", "right"].includes(options.pageNumberPosition)
      ? options.pageNumberPosition
      : "center";
    const pageNumbers = options.pageNumbers !== false;
    const headerText = String(options.headerText || "").trim();
    const footerText = String(options.footerText || "").trim();
    return {
      pageNumbers,
      position,
      headerText,
      footerText,
      header: Boolean(headerText),
      footer: pageNumbers || Boolean(footerText),
      sections: options.sectionBreaks === true
    };
  }

  function headerXml(chrome, palette) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="${WORD_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p>${paragraphProperties({ align: chrome.position })}${run(chrome.headerText, { color: palette.muted, size: 18 })}</w:p></w:hdr>`;
  }

  function footerXml(chrome, palette) {
    const content = [
      chrome.footerText ? run(chrome.footerText, { color: palette.muted, size: 18 }) : "",
      chrome.footerText && chrome.pageNumbers ? run("   \u00b7   ", { color: palette.muted, size: 18 }) : "",
      chrome.pageNumbers ? pageField(palette) : ""
    ].join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${WORD_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p>${paragraphProperties({ align: chrome.position })}${content}</w:p></w:ftr>`;
  }

  /* One description of the page, used by the body's final section and by every
     section break, so a broken section cannot drift from the document it ends. */
  function sectPrXml(page, chrome = {}) {
    const orient = page.orientation === "landscape" ? ' w:orient="landscape"' : "";
    const header = chrome.header ? '<w:headerReference w:type="default" r:id="rIdHeader"/>' : "";
    const footer = chrome.footer ? '<w:footerReference w:type="default" r:id="rIdFooter"/>' : "";
    return `<w:sectPr>${header}${footer}<w:pgSz w:w="${twips(page.width)}" w:h="${twips(page.height)}"${orient}/><w:pgMar w:top="${twips(page.margin.top)}" w:right="${twips(page.margin.right)}" w:bottom="${twips(page.margin.bottom)}" w:left="${twips(page.margin.left)}" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  }

  function typeSettings(options = {}) {
    const shared = globalThis.AIExporter && globalThis.AIExporter.typeOptions;
    return shared ? shared(options) : { size: 11.5, lineHeight: 1.6, paragraphSpacing: 11, body: "sans" };
  }

  function twips(mm) { return Math.round(mm * MM_TO_TWIPS); }
  function emu(mm) { return Math.round(mm * MM_TO_EMU); }

  /* ------------------------------------------------------------------ palette */

  /* Word reads the document palette rather than keeping one of its own: a
     .docx and a PDF of the same conversation must agree, and neither may
     inherit the extension's interface colours. */
  const PALETTES = globalThis.AIDocumentTheme.WORD;

  /* -------------------------------------------------------------------- utils */

  function xml(value) {
    return String(value == null ? "" : value)
      // Characters Word cannot store in XML: drop them rather than fail the
      // export. Lone surrogates and the Unicode noncharacters are equally
      // invalid in an XML document, and a page can contain them.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1")
      .replace(/[\uFDD0-\uFDEF\uFFFE\uFFFF]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
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

  function concat(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }

  function be32(bytes, at) {
    return (((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0);
  }

  function base64Bytes(value) {
    const binary = atob(String(value || "").replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  /* ---------------------------------------------------------------- zip writer */

  let crcTable = null;

  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
          value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        crcTable[index] = value >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) {
    return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
  }

  function u32(value) {
    return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
  }

  /**
   * Store-only ZIP. Deflate would make real DOCX files slightly smaller, but
   * the document is text and already small; storing keeps the writer small and
   * every ZIP consumer - Word, LibreOffice, unzip, Word online - reads it.
   */
  function zipStore(entries) {
    const now = new Date();
    const time = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() >> 1) & 31);
    const date = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

    const local = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
      const name = encoder.encode(entry.name);
      const data = entry.data;
      const crc = crc32(data);
      const header = concat([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name
      ]);
      local.push(header, data);
      central.push(concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date),
        u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
      ]));
      offset += header.length + data.length;
    }

    const directory = concat(central);
    const end = concat([
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(directory.length), u32(offset), u16(0)
    ]);
    return concat([...local, directory, end]);
  }

  /* ------------------------------------------------------------------ runs */

  function runProperties({ bold, italic, caps, color, size, mono, math, shading } = {}) {
    const parts = [];
    if (mono) parts.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>');
    else if (math) parts.push('<w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" w:cs="Cambria Math"/>');
    if (bold) parts.push("<w:b/><w:bCs/>");
    if (italic) parts.push("<w:i/><w:iCs/>");
    if (caps) parts.push("<w:caps/>");
    if (color) parts.push(`<w:color w:val="${color}"/>`);
    if (size) parts.push(`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`);
    if (shading) parts.push(`<w:shd w:val="clear" w:color="auto" w:fill="${shading}"/>`);
    return parts.length ? `<w:rPr>${parts.join("")}</w:rPr>` : "";
  }

  function run(text, properties) {
    // A literal tab inside <w:t> is collapsed by Word; indentation is spaces.
    const value = String(text == null ? "" : text).replace(/\t/g, "    ");
    if (!value) return "";
    return `<w:r>${runProperties(properties)}<w:t xml:space="preserve">${xml(value)}</w:t></w:r>`;
  }

  /**
   * Inline markers from the parser - **bold**, *italic*, `code`, $tex$ -
   * become character runs, so emphasis survives in Word as editable
   * formatting instead of literal asterisks.
   */
  /* Word has no MathML import, so formulas travel as Cambria Math text. Strip
     the delimiters and the TeX commands first: a Word file full of backslashes
     is not a readable mathematical document either. */
  function mathSource(value) {
    return String(value == null ? "" : value).trim()
      .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
      .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
      .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
      .replace(/^\$([\s\S]*)\$$/, "$1")
      .trim();
  }

  function wordMath(tex) {
    const source = mathSource(tex);
    const exporter = globalThis.AIExporter;
    return exporter && typeof exporter.texToPlain === "function" ? exporter.texToPlain(source) : source;
  }

  /* --------------------------------------------------------------- equations */

  /* Word cannot import MathML, but it has its own equation model (OMML). The TeX
     token tree comes from exporter.js, which already owns TeX parsing; this file
     only serialises that tree into Word markup. Source text that cannot be
     parsed still falls back to readable Cambria Math text, never to backslashes. */
  const MATH_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";
  const NARY = new Set(["\u2211", "\u220f", "\u2210", "\u22c3", "\u22c2", "\u22c1", "\u22c0"]);
  const INTEGRALS = new Set(["\u222b", "\u222c", "\u222e"]);
  const MATH_FONT = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>';

  function textOf(node) {
    if (!node) return "";
    if (node.tag === "#text") return String(node.text);
    return (node.children || []).map(textOf).join("");
  }

  /* CT_RPR holds either <m:nor/> (upright text) or a script/style pair, never
     both. Word maps the pair onto the matching Unicode maths range, which is
     what keeps \mathbb{R}, \mathcal{F} and \mathbf{v} meaning what they meant:
     without it every letter reached Word as plain math italic. */
  const OMML_SCRIPTS = {
    "double-struck": "double-struck", script: "script", fraktur: "fraktur",
    "sans-serif": "sans-serif", monospace: "monospace"
  };
  const OMML_STYLES = {
    bold: "b", "bold-italic": "bi", italic: "i", "sans-serif-italic": "i",
    "bold-sans-serif": "b", "bold-script": "b", "bold-fraktur": "b"
  };

  function mathRunProps(variant) {
    if (!variant) return "";
    if (variant === true || variant === "normal") return "<m:rPr><m:nor/></m:rPr>";
    const script = OMML_SCRIPTS[variant];
    const style = OMML_STYLES[variant];
    if (script) return `<m:rPr><m:scr m:val="${script}"/><m:sty m:val="${style || "p"}"/></m:rPr>`;
    if (style) return `<m:rPr><m:sty m:val="${style}"/></m:rPr>`;
    return "";
  }

  function mathRun(value, variant) {
    if (!value) return "";
    return `<m:r>${mathRunProps(variant)}${MATH_FONT}<m:t xml:space="preserve">${xml(value)}</m:t></m:r>`;
  }

  /* Accepts one node or a list of them: the parser hands over both shapes. */
  function mathBody(nodes) {
    if (!nodes) return "";
    return Array.isArray(nodes) ? ommlRow(nodes) : ommlNode(nodes);
  }

  /* A big operator owns the rest of its row as its operand, which is what TeX
     means by \sum_{a}^{b} f: the sum is applied to everything that follows. */
  /* An n-ary operator is a Word equation object, not a character with scripts
     attached: only the object stretches to the height of its operand and keeps
     its limits in the right place. A sum carries \\limits, but an integral
     carries plain sub/sup, so both spellings have to count - otherwise
     "\\int_0^1" reached Word as a run of text that never grew with x^2. */
  function bigOperator(node) {
    if (!node || node.tag !== "mo") return "";
    const chr = textOf(node).trim();
    if (!NARY.has(chr) && !INTEGRALS.has(chr)) return "";
    return node.__under || node.__over || node.__sub || node.__sup ? chr : "";
  }

  function naryXml(chr, node, operand) {
    const under = mathBody(node.__under || node.__sub || null);
    const over = mathBody(node.__over || node.__sup || null);
    return `<m:nary><m:naryPr><m:chr m:val="${chr}"/><m:limLoc m:val="${INTEGRALS.has(chr) ? "subSup" : "undOvr"}"/></m:naryPr>` +
      `${under ? `<m:sub>${under}</m:sub>` : "<m:sub/>"}${over ? `<m:sup>${over}</m:sup>` : "<m:sup/>"}` +
      `<m:e>${operand}</m:e></m:nary>`;
  }

  function ommlRow(nodes, start = 0) {
    let out = "";
    for (let index = start; index < (nodes || []).length; index += 1) {
      const chr = bigOperator(nodes[index]);
      if (chr) {
        out += naryXml(chr, nodes[index], ommlRow(nodes, index + 1));
        return out;
      }
      out += ommlNode(nodes[index]);
    }
    return out;
  }

  function radical(body, degree) {
    const inner = mathBody(body);
    return degree ? `<m:rad><m:deg>${degree}</m:deg><m:e>${inner}</m:e></m:rad>`
      : `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${inner}</m:e></m:rad>`;
  }

  function matrixXml(node) {
    const rows = (node.children || []).filter((row) => row.tag === "mtr");
    /* A table of one column is a stack of lines, not a grid: "2 + 2 = 4" over
       "4 + 2 = 6" is a calculation, and Word's matrix pads every row for a
       grid. An equation array stacks the same rows at ordinary line spacing,
       which is what a multi-step derivation should look like. */
    if (rows.length > 1 && rows.every((row) => (row.children || []).length === 1)) {
      return `<m:eqArr><m:eqArrPr/>${rows.map((row) => `<m:e>${mathBody(row.children[0])}</m:e>`).join("")}</m:eqArr>`;
    }
    const columns = rows.reduce((max, row) => Math.max(max, (row.children || []).length), 1);
    const rowXml = (row) => {
      const cells = (row.children || []).map((cell) => `<m:e>${mathBody(cell)}</m:e>`);
      while (cells.length < columns) cells.push("<m:e/>");
      return `<m:mr>${cells.join("")}</m:mr>`;
    };
    return `<m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="${columns}"/><m:mcJc m:val="center"/></m:mcPr></m:mc></m:mcs></m:mPr>` +
      `${rows.map(rowXml).join("")}</m:m>`;
  }

  /* \hat, \bar and friends arrive as mover nodes carrying accent="true". */
  function accentXml(node) {
    const parts = node.children || [];
    const chr = textOf(parts[1]) || "\u0302";
    const inner = mathBody(parts[0]);
    if (chr === "\u00af") return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${inner}</m:e></m:bar>`;
    return `<m:acc><m:accPr><m:chr m:val="${xml(chr)}"/></m:accPr><m:e>${inner}</m:e></m:acc>`;
  }

  function ommlCore(node) {
    const children = node.children || [];
    switch (node.tag) {
      case "mrow":
        return ommlRow(children);
      case "mi":
      case "mn":
      case "mo":
        return mathRun(textOf(node), node.attrs && node.attrs.mathvariant);
      case "mtext":
        return mathRun(textOf(node), true);
      case "mspace":
        return "";
      case "mfrac": {
        const noBar = String(node.attrs && node.attrs.linethickness) === "0";
        return `<m:f>${noBar ? '<m:fPr><m:type m:val="noBar"/></m:fPr>' : ""}` +
          `<m:num>${mathBody(children[0])}</m:num><m:den>${mathBody(children[1])}</m:den></m:f>`;
      }
      case "msqrt":
        return radical(children[0], "");
      case "mroot":
        return radical(children[0], mathBody(children[1]));
      case "menclose":
        // The only enclosure the parser emits is \boxed{} - the source asked for it.
        return `<m:borderBox><m:borderBoxPr/><m:e>${mathBody(children[0])}</m:e></m:borderBox>`;
      case "mtable":
        return matrixXml(node);
      case "mover":
        return accentXml(node);
      default:
        return ommlRow(children);
    }
  }

  function ommlNode(node) {
    if (!node || node.tag === "#text") return node ? mathRun(textOf(node)) : "";
    const base = `<m:e>${ommlCore(node)}</m:e>`;
    const sub = node.__sub ? mathBody(node.__sub) : "";
    const sup = node.__sup ? mathBody(node.__sup) : "";
    if (sub || sup) {
      if (sub && sup) return `<m:sSubSup>${base}<m:sub>${sub}</m:sub><m:sup>${sup}</m:sup></m:sSubSup>`;
      return sub ? `<m:sSub>${base}<m:sub>${sub}</m:sub></m:sSub>`
        : `<m:sSup>${base}<m:sup>${sup}</m:sup></m:sSup>`;
    }
    const under = node.__under ? mathBody(node.__under) : "";
    const over = node.__over ? mathBody(node.__over) : "";
    if (under || over) {
      if (under && over) return `<m:sSubSup>${base}<m:sub>${under}</m:sub><m:sup>${over}</m:sup></m:sSubSup>`;
      return under ? `<m:limLow>${base}<m:lim>${under}</m:lim></m:limLow>`
        : `<m:limUpp>${base}<m:lim>${over}</m:lim></m:limUpp>`;
    }
    return ommlCore(node);
  }

  /** TeX to a Word equation. Empty output means "not usable as maths", and the
      caller keeps the readable-text fallback. */
  function mathXml(tex, display) {
    const source = mathSource(tex);
    if (!source) return "";
    const exporter = globalThis.AIExporter;
    if (!exporter || typeof exporter.mathTree !== "function") return "";
    const nodes = exporter.mathTree(source);
    if (!nodes) return "";
    const body = ommlRow(nodes);
    if (!body) return "";
    return display
      ? `<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath>${body}</m:oMath></m:oMathPara>`
      : `<m:oMath>${body}</m:oMath>`;
  }

  function inline(text, base = {}, codeShading) {
    /* An escaped price is parked on a sentinel while the inline tokens are
       found, then restored in the run text: scanning "\\$5 and \\$10"
       directly paired the two signs into an equation and ate the sentence. */
    const source = String(text == null ? "" : text)
      .replace(/\\\[([\s\S]+?)\\\]/g, (match, tex) => " " + "$" + tex + "$" + " ")
      .replace(/\\\(([\s\S]+?)\\\)/g, (match, tex) => " " + "$" + tex + "$" + " ")
      .replace(/\\\$/g, "\uE000");
    /* $$...$$ arrives as inline text when a paragraph carries display
       delimiters; matching it first keeps the outer dollars out of the Word
       run. The single-dollar branch is the exporter's own token, so Word cannot
       disagree with HTML about where a formula starts: the local "$[^$]+\$"
       version used to read "$5 for $x$" as one equation, leaving "5 for" in
       Word as maths and the real x^2 as prose. */
    const mathSource = globalThis.AIExporter && globalThis.AIExporter.INLINE_MATH_SOURCE;
    const pattern = new RegExp(
      `(\\*\\*[^*]+\\*\\*|${mathSource || "\\$\\$[\\s\\S]+?\\$\\$|\\$[^$\\n]+\\$"}` + "|`[^`]+`|\\*[^*\\n]+\\*)",
      "g"
    );
    let out = "";
    let last = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (match.index > last) out += run(source.slice(last, match.index), base);
      const token = match[0];
      if (token.startsWith("**")) out += run(token.slice(2, -2), { ...base, bold: true });
      else if (token.startsWith("`")) out += run(token.slice(1, -1), { ...base, mono: true, shading: codeShading });
      else if (token.startsWith("$$")) {
        const tex = token.slice(2, -2);
        out += mathXml(tex, false) || run(wordMath(tex), { ...base, math: true });
      }
      else if (token.startsWith("$")) {
        // Word equations where the TeX parses; readable text where it does not.
        out += mathXml(token.slice(1, -1), false) || run(wordMath(token.slice(1, -1)), { ...base, math: true });
      }
      else out += run(token.slice(1, -1), { ...base, italic: true });
      last = match.index + token.length;
    }
    if (last < source.length) out += run(source.slice(last), base);
    return out.replace(/\uE000/g, "$");
  }

  /* -------------------------------------------------------------- paragraphs */

  /**
   * OOXML requires the children of w:pPr in schema order. Each option below is
   * emitted in that order rather than in the order it is passed.
   */
  function paragraphProperties({
    style, keepNext, pageBreakBefore, numId, ilvl = 0, border, shading, before, after, line, indent, align, outline
  } = {}) {
    const parts = [];
    if (style) parts.push(`<w:pStyle w:val="${style}"/>`);
    if (keepNext) parts.push("<w:keepNext/>");
    if (pageBreakBefore) parts.push("<w:pageBreakBefore/>");
    if (numId) {
      // Word numbering has nine levels; the shared clamp is the same one the
      // renderer and the handoff use, so a list cannot change depth on the way
      // into the file.
      const level = globalThis.AILimits ? globalThis.AILimits.listDepth(ilvl) : Math.max(0, Math.min(8, Number(ilvl) || 0));
      parts.push(`<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`);
    }
    if (border) parts.push(border);
    if (shading) parts.push(`<w:shd w:val="clear" w:color="auto" w:fill="${shading}"/>`);
    if (before != null || after != null || line) {
      parts.push(`<w:spacing${before != null ? ` w:before="${before}"` : ""}${after != null ? ` w:after="${after}"` : ""}${line ? ` w:line="${line}" w:lineRule="auto"` : ""}/>`);
    }
    if (indent) {
      parts.push(`<w:ind${indent.left != null ? ` w:left="${indent.left}"` : ""}${indent.right != null ? ` w:right="${indent.right}"` : ""}${indent.hanging != null ? ` w:hanging="${indent.hanging}"` : ""}/>`);
    }
    if (align) parts.push(`<w:jc w:val="${align}"/>`);
    if (outline != null) parts.push(`<w:outlineLvl w:val="${outline}"/>`);
    return parts.length ? `<w:pPr>${parts.join("")}</w:pPr>` : "";
  }

  function paragraph(content, properties) {
    return `<w:p>${paragraphProperties(properties)}${content}</w:p>`;
  }

  /* ------------------------------------------------------------- styles part */

  function stylesXml(palette, type = { size: 11.5, lineHeight: 1.6, paragraphSpacing: 11, body: "sans" }) {
    const bodyFont = type.body === "serif" ? "Georgia" : "Calibri";
    const monoFont = type.monoName || "Consolas";
    const bodySize = Math.round(type.size * 2);
    const lineTwips = Math.round(type.lineHeight * 240);
    const afterTwips = Math.round(type.paragraphSpacing * 15);
    const codeSize = Math.max(16, bodySize - 4);
    const tableSize = Math.max(16, bodySize - 3);
    const style = ({ id, name, basedOn = "Normal", next, pPr = "", rPr = "" }) =>
      `<w:style w:type="paragraph"${id === "Normal" ? ' w:default="1"' : ""} w:styleId="${id}">` +
      `<w:name w:val="${name}"/>${basedOn && id !== "Normal" ? `<w:basedOn w:val="${basedOn}"/>` : ""}` +
      `${next ? `<w:next w:val="${next}"/>` : ""}<w:qFormat/>` +
      `${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}</w:style>`;

    /* Headings are type hierarchy plus a hairline rule, the same shape the
       HTML document uses: no tinted bar, no fill. */
    const heading = (id, name, level, size, color) => style({
      id, name, next: "Normal",
      pPr: `<w:keepNext/>${level <= 2 ? `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="6" w:color="${palette.line}"/></w:pBdr>` : ""}<w:spacing w:before="${level === 1 ? 320 : 240}" w:after="120" w:line="264" w:lineRule="auto"/><w:outlineLvl w:val="${level - 1}"/>`,
      rPr: `<w:b/><w:bCs/><w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${WORD_NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${bodyFont}" w:hAnsi="${bodyFont}" w:cs="${bodyFont}"/><w:color w:val="${palette.ink}"/><w:sz w:val="${bodySize}"/><w:szCs w:val="${bodySize}"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="${afterTwips}" w:line="${lineTwips}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
${style({ id: "Normal", name: "Normal" })}
${style({
      id: "Title", name: "Title", next: "Subtitle",
      pPr: '<w:spacing w:before="0" w:after="120" w:line="240" w:lineRule="auto"/>',
      rPr: `<w:b/><w:bCs/><w:color w:val="${palette.headInk}"/><w:sz w:val="52"/><w:szCs w:val="52"/>`
    })}
${style({
      id: "Subtitle", name: "Subtitle", next: "Normal",
      pPr: '<w:spacing w:after="200"/>',
      rPr: `<w:color w:val="${palette.muted}"/><w:sz w:val="22"/><w:szCs w:val="22"/>`
    })}
${style({
      id: "Meta", name: "Metadata", next: "Normal",
      pPr: '<w:spacing w:after="80" w:line="252" w:lineRule="auto"/>',
      rPr: `<w:sz w:val="20"/><w:szCs w:val="20"/>`
    })}
${style({
      id: "MetaLabel", name: "Metadata label", next: "Meta",
      pPr: '<w:keepNext/><w:spacing w:after="0"/>',
      rPr: `<w:b/><w:bCs/><w:caps/><w:color w:val="${palette.muted}"/><w:sz w:val="16"/><w:szCs w:val="16"/>`
    })}
${style({
      id: "Role", name: "Speaker", next: "Normal",
      pPr: `<w:keepNext/><w:spacing w:before="240" w:after="100" w:line="240" w:lineRule="auto"/>`,
      rPr: `<w:b/><w:bCs/><w:caps/><w:color w:val="${palette.accent}"/><w:sz w:val="18"/><w:szCs w:val="18"/>`
    })}
${heading("Heading1", "heading 1", 1, 30, palette.headInk)}
${heading("Heading2", "heading 2", 2, 26, palette.headInk)}
${heading("Heading3", "heading 3", 3, 23, palette.headInk)}
${style({
      id: "CodeLabel", name: "Code label", next: "Code",
      pPr: `<w:keepNext/><w:shd w:val="clear" w:color="auto" w:fill="${palette.codeHeadBg}"/><w:spacing w:before="160" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="113" w:right="113"/>`,
      rPr: `<w:rFonts w:ascii="${monoFont}" w:hAnsi="${monoFont}" w:cs="${monoFont}"/><w:b/><w:bCs/><w:caps/><w:color w:val="${palette.codeHeadInk}"/><w:sz w:val="16"/><w:szCs w:val="16"/>`
    })}
${style({
      id: "Code", name: "Code", next: "Normal",
      pPr: `<w:shd w:val="clear" w:color="auto" w:fill="${palette.codeBg}"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="113" w:right="113"/>`,
      rPr: `<w:rFonts w:ascii="${monoFont}" w:hAnsi="${monoFont}" w:cs="${monoFont}"/><w:color w:val="${palette.codeInk}"/><w:sz w:val="${codeSize}"/><w:szCs w:val="${codeSize}"/>`
    })}
${style({
      id: "CodeOutputLabel", name: "Output label", next: "CodeOutput",
      pPr: `<w:keepNext/><w:shd w:val="clear" w:color="auto" w:fill="${palette.outHeadBg}"/><w:spacing w:before="160" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="113" w:right="113"/>`,
      rPr: `<w:rFonts w:ascii="${monoFont}" w:hAnsi="${monoFont}" w:cs="${monoFont}"/><w:b/><w:bCs/><w:caps/><w:color w:val="${palette.outHeadInk}"/><w:sz w:val="16"/><w:szCs w:val="16"/>`
    })}
${style({
      id: "CodeOutput", name: "Output", next: "Normal",
      pPr: `<w:shd w:val="clear" w:color="auto" w:fill="${palette.outBg}"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="113" w:right="113"/>`,
      rPr: `<w:rFonts w:ascii="${monoFont}" w:hAnsi="${monoFont}" w:cs="${monoFont}"/><w:color w:val="${palette.outInk}"/><w:sz w:val="${codeSize}"/><w:szCs w:val="${codeSize}"/>`
    })}
${style({
      id: "Quote", name: "Quote", next: "Normal",
      pPr: `<w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="${palette.accent}"/></w:pBdr><w:ind w:left="340" w:right="170"/><w:spacing w:after="140"/>`,
      rPr: `<w:i/><w:iCs/><w:color w:val="${palette.ink}"/>`
    })}
${style({
      id: "NoteLabel", name: "Important note label", next: "NoteBody",
      pPr: `<w:keepNext/><w:pBdr><w:top w:val="single" w:sz="6" w:space="6" w:color="${palette.noteLine}"/><w:left w:val="single" w:sz="6" w:space="6" w:color="${palette.noteLine}"/><w:right w:val="single" w:sz="6" w:space="6" w:color="${palette.noteLine}"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="${palette.noteHeadBg}"/><w:spacing w:before="120" w:after="0"/><w:ind w:left="113" w:right="113"/>`,
      rPr: `<w:b/><w:bCs/><w:caps/><w:color w:val="${palette.noteHeadInk}"/><w:sz w:val="16"/><w:szCs w:val="16"/>`
    })}
${style({
      id: "NoteBody", name: "Important note", next: "Normal",
      pPr: `<w:pBdr><w:left w:val="single" w:sz="6" w:space="6" w:color="${palette.noteLine}"/><w:right w:val="single" w:sz="6" w:space="6" w:color="${palette.noteLine}"/><w:bottom w:val="single" w:sz="6" w:space="6" w:color="${palette.noteLine}"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="${palette.noteBg}"/><w:spacing w:before="0" w:after="120"/><w:ind w:left="113" w:right="113"/>`,
      rPr: `<w:color w:val="${palette.noteInk}"/>`
    })}
${style({
      id: "Formula", name: "Formula", next: "Normal",
      pPr: `<w:spacing w:before="60" w:after="140" w:line="264" w:lineRule="auto"/><w:ind w:left="113" w:right="113"/><w:jc w:val="center"/>`,
      rPr: `<w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:color w:val="${palette.ink}"/><w:sz w:val="22"/><w:szCs w:val="22"/>`
    })}
${style({
      id: "Caption", name: "Caption", next: "Normal",
      pPr: '<w:spacing w:after="160"/><w:jc w:val="center"/>',
      rPr: `<w:i/><w:iCs/><w:color w:val="${palette.muted}"/><w:sz w:val="18"/><w:szCs w:val="18"/>`
    })}
${style({
      id: "Placeholder", name: "Image placeholder", next: "Normal",
      pPr: `<w:spacing w:after="160"/><w:ind w:left="113" w:right="113"/>`,
      rPr: `<w:i/><w:iCs/><w:color w:val="${palette.muted}"/><w:sz w:val="19"/><w:szCs w:val="19"/>`
    })}
${style({
      id: "TableText", name: "Table text", basedOn: "Normal",
      pPr: '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>',
      rPr: `<w:color w:val="${palette.ink}"/><w:sz w:val="${tableSize}"/><w:szCs w:val="${tableSize}"/>`
    })}
${style({
      id: "TableHead", name: "Table heading", basedOn: "Normal",
      pPr: '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>',
      rPr: `<w:b/><w:bCs/><w:color w:val="${palette.tableHeadInk}"/><w:sz w:val="${tableSize}"/><w:szCs w:val="${tableSize}"/>`
    })}
${style({
      id: "Spacer", name: "Spacer", basedOn: "Normal",
      pPr: '<w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="auto"/>'
    })}
</w:styles>`;
  }

  /* ----------------------------------------------------------- numbering part */

  function numberingXml(orderedLists) {
    /* Nine levels for both kinds: a nested list needs an ilvl that exists in
       the abstract definition, or Word ignores the indent and keeps level 0. */
    const bulletChars = ["\u2022", "\u25e6", "\u25aa", "\u2022", "\u25e6", "\u25aa", "\u2022", "\u25e6", "\u25aa"];
    const bulletLevels = bulletChars.map((char, level) =>
      `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${char}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${420 * (level + 1)}" w:hanging="300"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="4338CA"/></w:rPr></w:lvl>`
    ).join("");
    const decimalLevels = Array.from({ length: 9 }, (_, level) =>
      `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%${level + 1}."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${420 * (level + 1)}" w:hanging="300"/></w:pPr></w:lvl>`
    ).join("");
    const bullet = `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bulletLevels}</w:abstractNum>`;
    const decimal = `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${decimalLevels}</w:abstractNum>`;
    const nums = ['<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'];
    orderedLists.forEach((list, index) => {
      // A fresh numId per ordered list restarts the count instead of carrying
      // one conversation's numbering into the next list. Every level restarts
      // too, so a nested list begins at 1 in its own scope.
      const levels = Array.from({ length: 9 }, (_, level) =>
        `<w:lvlOverride w:ilvl="${level}"><w:startOverride w:val="1"/></w:lvlOverride>`
      ).join("");
      nums.push(`<w:num w:numId="${index + 2}"><w:abstractNumId w:val="1"/>${levels}</w:num>`);
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${WORD_NS}">${bullet}${decimal}${nums.join("")}</w:numbering>`;
  }

  /* --------------------------------------------------------------- image parts */

  function imageSize(bytes, extension) {
    if (extension === "png" && bytes.length > 24) {
      return { width: be32(bytes, 16), height: be32(bytes, 20) };
    }
    if (extension === "gif" && bytes.length > 10) {
      return {
        width: bytes[6] | (bytes[7] << 8),
        height: bytes[8] | (bytes[9] << 8)
      };
    }
    if (extension === "jpeg") {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1];
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
          continue;
        }
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (length < 2) break;
        const isFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
        if (isFrame) {
          return { width: (bytes[offset + 7] << 8) | bytes[offset + 8], height: (bytes[offset + 5] << 8) | bytes[offset + 6] };
        }
        offset += 2 + length;
      }
    }
    return null;
  }

  const IMAGE_TYPES = { png: "image/png", jpeg: "image/jpeg", gif: "image/gif" };

  /* A data URI says image/png even when its bytes are 3 zeros. Word rejects
     such a package, so the header decides rather than the MIME label. */
  function hasImageSignature(bytes, extension) {
    if (bytes.length < 12) return false;
    if (extension === "png") {
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    }
    if (extension === "jpeg") {
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (extension === "gif") {
      return matchAscii(bytes, 0, "GIF87a") || matchAscii(bytes, 0, "GIF89a");
    }
    return false;
  }

  function matchAscii(bytes, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      if (bytes[offset + index] !== text.charCodeAt(index)) return false;
    }
    return true;
  }

  /** Only images the package can actually contain: inline raster data URIs. */
  function imagePart(source, media) {
    const match = /^data:image\/(png|jpe?g|gif);base64,([a-z0-9+/=\s]+)$/i.exec(String(source == null ? "" : source));
    if (!match) return null;
    const extension = match[1].toLowerCase() === "jpeg" ? "jpeg" : match[1].toLowerCase();
    let bytes;
    try {
      bytes = base64Bytes(match[2]);
    } catch {
      // Undecodable data is reported as a placeholder by the caller, never dropped silently.
      return null;
    }
    if (!bytes.length || !hasImageSignature(bytes, extension)) return null;
    const size = imageSize(bytes, extension) || { width: 800, height: 600 };
    const index = media.length + 1;
    const name = `image${index}.${extension}`;
    const relId = `rIdImg${index}`;
    media.push({ name, relId, bytes, extension, contentType: IMAGE_TYPES[extension] });
    return { relId, name, index, size };
  }

  /* The image controls are read from the exporter when it is present, so the
     Word file and the preview cannot disagree about what was ticked. */
  function imageSettings(options = {}) {
    const shared = globalThis.AIExporter && globalThis.AIExporter.imageOptions;
    if (shared) return shared(options);
    return {        images: options.includeImages !== false,
        diagrams: options.includeImages !== false,
        positions: options.keepImagePositions !== false,
      captions: options.includeCaptions !== false,
      sources: options.includeImageSources === true,
      layout: ["inline", "center", "fit"].includes(options.imageLayout) ? options.imageLayout : "center",
      excluded: new Set(Array.isArray(options.excludedAssets) ? options.excludedAssets : [])
    };
  }

  function imageKind(block) {
    return block && block.kind && block.kind !== "image" ? block.kind : "image";
  }

  function drawing(relId, index, name, size, maxRatio = 1, contentWidthEmu = emu(210 - 30), alt = "") {
    const ratio = Math.min(maxRatio, contentWidthEmu / Math.max(1, size.width * EMU_PER_PX));
    const cx = Math.round(size.width * EMU_PER_PX * ratio);
    const cy = Math.round(size.height * EMU_PER_PX * ratio);
    // descr is Word's alt text: kept even when visible captions are turned off.
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${index}" name="Figure ${index}" descr="${xml(alt)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${index}" name="${xml(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  /* ------------------------------------------------------------- block renderer */

  const ROLE_LABELS = { user: "User", assistant: "Assistant", system: "System" };

  function roleLabel(role) {
    return ROLE_LABELS[role] || "Message";
  }

  /**
   * @param {object} context { palette, media, orderedLists, figures, docMode }
   * @returns {string} document body XML
   */
  function bodyXml(chat, context) {
    const { palette } = context;
    const out = [];
    const push = (value) => {
      if (value) out.push(value);
    };

    const images = context.images || imageSettings();
    const plate = [];
    const messages = (Array.isArray(chat.messages) ? chat.messages : []).map((message) => {
      if (images.positions) return message;
      const kept = [];
      for (const block of message.blocks || []) {
        if (block.type === "image") plate.push(block);
        else kept.push(block);
      }
      return { ...message, blocks: kept };
    });

    /* title ---------------------------------------------------------------- */
    // Word follows the same rule as the PDF: the conversation opens the file.
    // A title page is opt-in and is the only place export metadata appears.
    push(paragraph(inline(chat.title || "AI conversation", {}, palette.inlineBg), { style: "Title" }));
    if (!context.includeCover) {
      const facts = [
        chat.platformLabel || "AI conversation",
        chat.model,
        formatDate(chat.exportedAt, true),
        `${messages.length} message${messages.length === 1 ? "" : "s"}`
      ].filter(Boolean).join(" \u00b7 ");
      push(paragraph(run(facts, { color: palette.muted }), { style: "Meta" }));
    } else {
      push(paragraph(run("Full transcript: every prompt and every answer, in order", { color: palette.muted }), { style: "Subtitle" }));

      const meta = [
        ["Platform", chat.platformLabel || "Unknown"],
        ["Model", chat.model || "Unknown"],
        ["Total messages", `${messages.length} message${messages.length === 1 ? "" : "s"}`],
        ["Exported on", formatDate(chat.exportedAt, true)],
        ["Format", context.docMode === "bw" ? "Word (.docx), black and white" : "Word (.docx), colour"]
      ];
      for (const [label, value] of meta) {
        push(paragraph(
          run(label, { bold: true, caps: true, color: palette.muted, size: 16 }) + run(`  ${value}`, { bold: true }),
          { style: "Meta" }
        ));
      }
      if (/^https:\/\//i.test(chat.url || "")) {
        push(paragraph(run("Source  ", { bold: true, caps: true, color: palette.muted, size: 16 }) + run(chat.url, { color: palette.muted }), { style: "Meta" }));
      }

      // The transcript opens on the page after the title page.
      push(paragraph('<w:r><w:br w:type="page"/></w:r>', { style: "Normal" }));
    }

    /* transcript ----------------------------------------------------------- */
    if (!messages.length) {
      push(paragraph(run("No messages were included in this export."), { style: "Normal" }));
    }

    messages.forEach((message, index) => {
      /* A section break is the paragraph that closes the section before it; the
         final section's properties live at the end of the body. Opt-in, because
         most conversations read better as one continuous section. */
      if (context.sections && index > 0) {
        push(`<w:p><w:pPr>${sectPrXml(context.page, {})}</w:pPr></w:p>`);
      }
      const stampDate = message.timestamp ? new Date(message.timestamp) : null;
      const stamp = context.timestamps && stampDate && Number.isFinite(stampDate.getTime())
        ? `  ${stampDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
        : "";
      push(paragraph(
        run(roleLabel(message.role), { bold: true, caps: true, color: palette.accent, size: 18 }) +
        (stamp ? run(stamp, { color: palette.muted, size: 16 }) : ""),
        { style: "Role", keepNext: true, before: index === 0 ? 0 : 240 }
      ));
      /* The same MCQ grouping the HTML uses, so Word gets one paragraph per
         option instead of a run-on line. */
      const blocks = globalThis.AIMcq ? globalThis.AIMcq.group(message.blocks || []) : (message.blocks || []);
      push(blocksXml(blocks, context));
      // Empty spacer keeps the next speaker bar visually separated without a rule.
      push(paragraph("", { style: "Spacer" }));
    });

    if (plate.length) {
      push(paragraph(run("Figures", { bold: true, caps: true, color: palette.accent, size: 18 }), {
        style: "Role", keepNext: true, shading: palette.accentSoft
      }));
      for (const block of plate) push(imageXml(block, context));
    }

    return out.join("");
  }

  function blocksXml(blocks, context) {
    const { palette } = context;
    const out = [];

    for (const block of blocks) {
      switch (block.type) {
        case "heading": {
          const level = Math.min(3, Math.max(1, Number(block.level) || 2));
          out.push(paragraph(inline(block.text, {}, palette.inlineBg), { style: `Heading${level}` }));
          break;
        }
        case "subheading": {
          const level = Math.min(3, Math.max(2, Number(block.level) || 3));
          out.push(paragraph(inline(block.text, {}, palette.inlineBg), { style: `Heading${level}` }));
          break;
        }
        case "paragraph": {
          const note = paragraphCallout(block.text);
          out.push(note ? noteXml(note.label, note.text, palette) : paragraph(inline(block.text, {}, palette.inlineBg), { style: "Normal" }));
          break;
        }
        case "mcq": {
          /* One paragraph per option, with a hanging indent so a wrapped
             option aligns with its text rather than its letter. Spacing is
             8pt / 5pt / 8pt / 6pt / 16pt, the same values the HTML uses. */
          const options = block.options || [];
          out.push(paragraph(inline(block.question, { bold: true }, palette.inlineBg), {
            style: "Normal", keepNext: true, after: 160
          }));
          options.forEach((option, optionIndex) => {
            const last = optionIndex === options.length - 1;
            out.push(paragraph(
              run(`${option.letter}.`, { bold: true }) + run("  ") + inline(option.text, {}, palette.inlineBg),
              {
                style: "Normal", after: last ? (block.answer || block.explanation ? 100 : 320) : 100,
                indent: { left: 340, hanging: 340 }, keepNext: !last || Boolean(block.answer || block.explanation)
              }
            ));
          });
          if (block.answer) {
            out.push(paragraph(inline(block.answer, { bold: true }, palette.inlineBg), {
              style: "Normal", before: 100, after: block.explanation ? 120 : 320, keepNext: Boolean(block.explanation)
            }));
          }
          if (block.explanation) {
            out.push(paragraph(inline(block.explanation, {}, palette.inlineBg), { style: "Normal", after: 320 }));
          }
          break;
        }
        case "list": {
          const items = Array.isArray(block.items) ? block.items : [];
          const depths = Array.isArray(block.depths) ? block.depths : [];
          const orders = Array.isArray(block.orders) ? block.orders : [];
          const orderedAt = (index) => orders.length ? orders[index] !== false : Boolean(block.ordered);
          let numId = 1;
          let nestedOrderedId = 0;
          if (block.ordered) {
            context.orderedLists.push(block);
            numId = context.orderedLists.length + 1;
          } else if (items.some((_item, index) => orderedAt(index))) {
            /* An unordered list can contain a numbered sub-list. Word needs a
               decimal numbering instance for it, or the sub-list degrades to
               bullets and loses the order the source showed. */
            context.orderedLists.push({ ...block, ordered: true });
            nestedOrderedId = context.orderedLists.length + 1;
          }
          items.forEach((item, index) => {
            const ordered = orderedAt(index);
            out.push(paragraph(inline(item, {}, palette.inlineBg), {
              style: "Normal",
              numId: ordered ? (block.ordered ? numId : nestedOrderedId) : 1,
              ilvl: Number(depths[index]) || 0,
              after: 60
            }));
          });
          break;
        }
        case "quote": {
          const note = quoteCallout(block.text);
          out.push(note ? noteXml(note.label, note.text, palette) : paragraph(inline(block.text, {}, palette.inlineBg), { style: "Quote" }));
          break;
        }
        case "code":
          out.push(codeXml(block, context));
          break;
        case "table":
          out.push(tableXml(block, context));
          break;
        case "image":
          out.push(imageXml(block, context));
          break;
        case "formula": {
          const equation = mathXml(block.tex, true)
            || run(wordMath(block.tex), { math: true, color: palette.ink });
          out.push(paragraph(equation, { style: "Formula" }));
          break;
        }
        case "divider":
          out.push(paragraph("", {
            style: "Normal",
            border: `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${palette.line}"/></w:pBdr>`,
            after: 140
          }));
          break;
        default:
          break;
      }
    }
    return out.join("");
  }

  /* Notes, warnings and key takeaways share one two-paragraph panel: a labelled
     header and a body, both filled and outlined, so Word shows the same callout
     the HTML and PNG do. */
  function noteXml(label, text, palette) {
    const warning = label === "Warning";
    const fill = warning ? palette.warningBg : palette.noteBg;
    const head = warning ? palette.warningHeadBg : palette.noteHeadBg;
    const line = warning ? palette.warningLine : palette.noteLine;
    const ink = warning ? palette.warningInk : palette.noteInk;
    const headInk = warning ? palette.warningHeadInk : palette.noteHeadInk;
    return paragraph(run(label, { bold: true, caps: true, color: headInk, size: 16 }), {
      keepNext: true, shading: head, border: panelBorder(line, ["top", "left", "right"]), before: 120, after: 0
    }) + paragraph(inline(text, {}, palette.inlineBg), {
      border: panelBorder(line, ["left", "right", "bottom"]), shading: fill, after: 120
    });
  }

  const QUOTE_CALLOUT = /^(important|note|warning|remember|key takeaway|tip)\s*:?\s*/i;

  function quoteCallout(text) {
    const match = QUOTE_CALLOUT.exec(String(text == null ? "" : text));
    if (!match) return null;
    const label = match[1].toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    return { label, text: String(text).slice(match[0].length) };
  }

  /* A labelled paragraph is a callout as well; the separator keeps ordinary
     prose ("Note that...") out of the panel. */
  const PARAGRAPH_CALLOUT = /^(important|note|warning|remember|key takeaway|tip)\s*[:\u2014\u2013-]\s*/i;

  function paragraphCallout(text) {
    const raw = String(text == null ? "" : text);
    const match = PARAGRAPH_CALLOUT.exec(raw);
    if (!match || !raw.slice(match[0].length).replace(/<[^>]*>/g, "").trim()) return null;
    const label = match[1].toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    return { label, text: raw.slice(match[0].length) };
  }

  /* A visible one-pixel panel outline around the header and body paragraphs.
     Word has no rounded corner for a text panel, so the fill + border carry the
     distinction; the radius stays a screen/PDF feature. */
  function panelBorder(color, sides) {
    return `<w:pBdr>${sides
      .map((side) => `<w:${side} w:val="single" w:sz="6" w:space="6" w:color="${color}"/>`)
      .join("")}</w:pBdr>`;
  }

  /** One paragraph per source line, so Word keeps indentation and blank lines.
      In colour mode each line carries the same token colours as the PDF; the
      black-and-white palette keeps the same runs but with its near-black inks. */
  function codeXml(block, context) {
    const { palette } = context;
    const output = Boolean(block.output);
    const label = output ? "Output" : String(block.language || "code");
    const labelStyle = output ? "CodeOutputLabel" : "CodeLabel";
    const lineStyle = output ? "CodeOutput" : "Code";
    const borderColor = output ? palette.outLine : palette.codeLine;
    const lines = String(block.code == null ? "" : block.code).replace(/\r\n?/g, "\n").split("\n");
    // A block that fits on a page is kept together; a long one must be allowed
    // to flow across pages instead of being pushed whole to a fresh page.
    const keepLines = context.keepBlocks !== false && lines.length <= 28;
    const tokenizer = globalThis.AIExporter && globalThis.AIExporter.highlightTokens;
    const tokenColors = {
      kw: palette.tokKw, str: palette.tokStr, num: palette.tokNum,
      com: palette.tokCom, fn: palette.tokFn, type: palette.tokType
    };
    const lineRuns = (line) => {
      if (!line) return "";
      if (output || typeof tokenizer !== "function") return run(line);
      const tokens = tokenizer(line, block.language);
      return tokens
        .map((token) => (token.kind && tokenColors[token.kind]
          ? run(token.text, { color: tokenColors[token.kind] })
          : run(token.text)))
        .join("");
    };
    const parts = [paragraph(run(label, { bold: true, caps: true, size: 16 }), {
      style: labelStyle, keepNext: true, border: panelBorder(borderColor, ["top", "left", "right"])
    })];
    lines.forEach((line, index) => {
      const sides = index === lines.length - 1 ? ["left", "right", "bottom"] : ["left", "right"];
      parts.push(paragraph(lineRuns(line), {
        style: lineStyle,
        border: panelBorder(borderColor, sides),
        keepNext: keepLines && index < lines.length - 1
      }));
    });
    return parts.join("");
  }

  function tableXml(block, context) {
    const { palette } = context;
    const head = Array.isArray(block.head) ? block.head : [];
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const columns = Math.max(head.length, ...rows.map((row) => (Array.isArray(row) ? row.length : 0)), 1);
    const contentWidth = context.page.contentTwips;
    const widths = Array.from({ length: columns }, () => Math.floor(contentWidth / columns));
    widths[columns - 1] = contentWidth - widths.slice(0, -1).reduce((sum, value) => sum + value, 0);

    const cell = (value, isHeader, width) => {
      const value2 = String(value == null ? "" : value).replace(/([\w@:/?&=#.%+-]{18})/g, "$1\u200b");
      return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:noWrap w:val="0"/>${isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="${palette.tableHead}"/>` : ""}<w:vAlign w:val="top"/></w:tcPr>` +
        paragraph(inline(value2, {}, palette.inlineBg), { style: isHeader ? "TableHead" : "TableText" }) + "</w:tc>";
    };
    const row = (cells, isHeader) =>
      `<w:tr><w:trPr><w:cantSplit/>${isHeader ? "<w:tblHeader/>" : ""}</w:trPr>${Array.from({ length: columns }, (_, index) => cell(cells[index], isHeader, widths[index])).join("")}</w:tr>`;

    // Minimal rules: a top and bottom edge plus row separators. Vertical
    // lines are most of a table's visual clutter on paper.
    const borders = `<w:top w:val="single" w:sz="6" w:space="0" w:color="${palette.line}"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="${palette.line}"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="${palette.line}"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>`;
    const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");
    const headerRow = head.length ? row(head, true) : "";
    const bodyRows = rows.map((cells) => row(Array.isArray(cells) ? cells : [], false)).join("");

    return `<w:tbl><w:tblPr><w:tblW w:w="${contentWidth}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${headerRow}${bodyRows}</w:tbl>` +
      paragraph("", { style: "Spacer" });
  }

  function imageXml(block, context) {
    const settings = context.images || imageSettings();
    if (!settings.images) return "";
    if (block.assetId && settings.excluded && settings.excluded.has(block.assetId)) return "";
    const caption = block.caption || block.alt || "Image from the conversation";
    const part = imagePart(block.src, context.media);
    if (!part) {
      const reason = /^https:\/\//i.test(block.src || "")
        ? "remote images are not downloaded by the Word export"
        : "this image could not be embedded";
      return paragraph(run(`Image not embedded (${reason}): ${caption}`), { style: "Placeholder" });
    }
    context.figures += 1;
    const align = settings.layout === "inline" ? "left" : "center";
    const maxRatio = settings.layout === "fit" ? 1 : settings.layout === "inline" ? 0.62 : 0.84;
    const contentWidthEmu = emu(context.page.contentMm);
    const source = settings.sources
      ? (() => {
          if (/^data:/i.test(block.src || "")) return "Embedded image";
          try { return new URL(block.src).hostname.replace(/^www\./, ""); } catch { return ""; }
        })()
      : "";
    return paragraph(drawing(part.relId, part.index, part.name, part.size, maxRatio, contentWidthEmu, block.alt || caption), {
      style: "Normal", align, keepNext: context.keepBlocks !== false
    }) +
      (settings.captions
        ? paragraph(run(/^fig(?:ure)?\.?\s*\d+/i.test(caption) ? caption : `Fig. ${context.figures}: ${caption}`), { style: "Caption" })
        : "") +
      (source ? paragraph(run(`Source: ${source}`), { style: "Caption" }) : "");
  }

  /* -------------------------------------------------------------- package parts */

  function contentTypes(media, chrome = {}) {
    const extensions = [...new Set(media.map((item) => item.extension))];
    const parts = [];
    if (chrome.header) parts.push('<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>');
    if (chrome.footer) parts.push('<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${extensions.map((extension) => `<Default Extension="${extension}" ContentType="${IMAGE_TYPES[extension]}"/>`).join("\n")}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
${parts.join("\n")}
</Types>`;
  }

  function rootRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
  }

  function documentRels(media, chrome = {}) {
    const furniture = [
      chrome.header ? '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : "",
      chrome.footer ? '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ""
    ].filter(Boolean).join("\n");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
${furniture}
${media.map((item) => `<Relationship Id="${item.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${item.name}"/>`).join("\n")}
</Relationships>`;
  }

  function coreXml(chat) {
    const stamp = (() => {
      const date = new Date(chat.exportedAt || Date.now());
      return (Number.isNaN(date.getTime()) ? new Date() : date).toISOString().replace(/\.\d{3}Z$/, "Z");
    })();
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xml(chat.title || "AI conversation")}</dc:title>
<dc:creator>AI Exporter</dc:creator>
<cp:lastModifiedBy>AI Exporter</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>
</cp:coreProperties>`;
  }

  function documentXml(body, page, chrome = {}) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}" xmlns:m="${MATH_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${body}${sectPrXml(page, chrome)}</w:body>
</w:document>`;
  }

  /* --------------------------------------------------------------------- build */

  function parts(chat, options = {}) {
    const docMode = options.docMode === "bw" ? "bw" : "color";
    const page = pageSettings(options);
    const chrome = chromeSettings(options);
    const contentMm = page.width - page.margin.left - page.margin.right;
    const context = {
      palette: PALETTES[docMode],
      docMode,
      page: { ...page, contentMm, contentTwips: twips(contentMm) },
      type: typeSettings(options),
      timestamps: options.timestamps === true,
      keepBlocks: options.keepBlocks !== false,
      includeCover: options.includeCover === true,
      images: imageSettings(options),
      media: [],
      orderedLists: [],
      figures: 0,
      sections: chrome.sections
    };

    const body = bodyXml(chat, context);
    const files = [
      { name: "[Content_Types].xml", text: contentTypes(context.media, chrome) },
      { name: "_rels/.rels", text: rootRels() },
      { name: "docProps/core.xml", text: coreXml(chat) },
      { name: "word/document.xml", text: documentXml(body, context.page, chrome) },
      { name: "word/styles.xml", text: stylesXml(context.palette, context.type) },
      { name: "word/numbering.xml", text: numberingXml(context.orderedLists) },
      { name: "word/_rels/document.xml.rels", text: documentRels(context.media, chrome) }
    ];
    if (chrome.header) files.push({ name: "word/header1.xml", text: headerXml(chrome, context.palette) });
    if (chrome.footer) files.push({ name: "word/footer1.xml", text: footerXml(chrome, context.palette) });
    for (const item of context.media) {
      files.push({ name: `word/media/${item.name}`, bytes: item.bytes });
    }

    return {
      binary: zipStore(files.map((file) => ({ name: file.name, data: file.bytes || encoder.encode(file.text) }))),
      files
    };
  }

  function build(chat, options) {
    return parts(chat, options).binary;
  }

  globalThis.AIExporterDocx = { MIME, build, parts };

  // A CommonJS import (the docx verification script) gets the same functions.
  if (typeof module !== "undefined" && module.exports) module.exports = { MIME, build, parts };
})();
