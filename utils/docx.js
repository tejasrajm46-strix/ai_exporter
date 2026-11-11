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
 * offline), or convert TeX to editable Word equations - the formula source is
 * kept in a math font instead of being dropped.
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
      // Characters Word cannot store in XML: drop them rather than fail the export.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
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

  function inline(text, base = {}, codeShading) {
    const source = String(text == null ? "" : text)
      .replace(/\\\[([\s\S]+?)\\\]/g, (match, tex) => " " + "$" + tex + "$" + " ")
      .replace(/\\\(([\s\S]+?)\\\)/g, (match, tex) => " " + "$" + tex + "$" + " ");
    const pattern = /(\*\*[^*]+\*\*|\$[^$\n]+\$|`[^`]+`|\*[^*\n]+\*)/g;
    let out = "";
    let last = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (match.index > last) out += run(source.slice(last, match.index), base);
      const token = match[0];
      if (token.startsWith("**")) out += run(token.slice(2, -2), { ...base, bold: true });
      else if (token.startsWith("`")) out += run(token.slice(1, -1), { ...base, mono: true, shading: codeShading });
      else if (token.startsWith("$")) out += run(wordMath(token.slice(1, -1)), { ...base, math: true });
      else out += run(token.slice(1, -1), { ...base, italic: true });
      last = match.index + token.length;
    }
    if (last < source.length) out += run(source.slice(last), base);
    return out;
  }

  /* -------------------------------------------------------------- paragraphs */

  /**
   * OOXML requires the children of w:pPr in schema order. Each option below is
   * emitted in that order rather than in the order it is passed.
   */
  function paragraphProperties({
    style, keepNext, pageBreakBefore, numId, border, shading, before, after, line, indent, align, outline
  } = {}) {
    const parts = [];
    if (style) parts.push(`<w:pStyle w:val="${style}"/>`);
    if (keepNext) parts.push("<w:keepNext/>");
    if (pageBreakBefore) parts.push("<w:pageBreakBefore/>");
    if (numId) parts.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`);
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
    const bullet = `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="420" w:hanging="300"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="4338CA"/></w:rPr></w:lvl></w:abstractNum>`;
    const decimal = `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="420" w:hanging="300"/></w:pPr></w:lvl></w:abstractNum>`;
    const nums = ['<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'];
    orderedLists.forEach((_list, index) => {
      // A fresh numId per ordered list restarts the count instead of carrying
      // one conversation's numbering into the next list.
      nums.push(`<w:num w:numId="${index + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`);
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
    if (!bytes.length) return null;
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
          if (block.ordered) {
            context.orderedLists.push(block);
            const numId = context.orderedLists.length + 1;
            for (const item of block.items || []) {
              out.push(paragraph(inline(item, {}, palette.inlineBg), { style: "Normal", numId, after: 60 }));
            }
          } else {
            for (const item of block.items || []) {
              out.push(paragraph(inline(item, {}, palette.inlineBg), { style: "Normal", numId: 1, after: 60 }));
            }
          }
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
          out.push(paragraph(run(wordMath(block.tex), { math: true, color: palette.ink }), { style: "Formula" }));
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

  /** One paragraph per source line, so Word keeps indentation and blank lines. */
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
    const parts = [paragraph(run(label, { bold: true, caps: true, size: 16 }), {
      style: labelStyle, keepNext: true, border: panelBorder(borderColor, ["top", "left", "right"])
    })];
    lines.forEach((line, index) => {
      const sides = index === lines.length - 1 ? ["left", "right", "bottom"] : ["left", "right"];
      parts.push(paragraph(line ? run(line) : "", {
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
    if (!settings.images) return "";
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

  function contentTypes(media) {
    const extensions = [...new Set(media.map((item) => item.extension))];
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${extensions.map((extension) => `<Default Extension="${extension}" ContentType="${IMAGE_TYPES[extension]}"/>`).join("\n")}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
  }

  function rootRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
  }

  function documentRels(media) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
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

  function documentXml(body, page) {
    const orient = page.orientation === "landscape" ? ' w:orient="landscape"' : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${body}<w:sectPr><w:pgSz w:w="${twips(page.width)}" w:h="${twips(page.height)}"${orient}/><w:pgMar w:top="${twips(page.margin.top)}" w:right="${twips(page.margin.right)}" w:bottom="${twips(page.margin.bottom)}" w:left="${twips(page.margin.left)}" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body>
</w:document>`;
  }

  /* --------------------------------------------------------------------- build */

  function parts(chat, options = {}) {
    const docMode = options.docMode === "bw" ? "bw" : "color";
    const page = pageSettings(options);
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
      figures: 0
    };

    const body = bodyXml(chat, context);
    const files = [
      { name: "[Content_Types].xml", text: contentTypes(context.media) },
      { name: "_rels/.rels", text: rootRels() },
      { name: "docProps/core.xml", text: coreXml(chat) },
      { name: "word/document.xml", text: documentXml(body, context.page) },
      { name: "word/styles.xml", text: stylesXml(context.palette, context.type) },
      { name: "word/numbering.xml", text: numberingXml(context.orderedLists) },
      { name: "word/_rels/document.xml.rels", text: documentRels(context.media) }
    ];
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
