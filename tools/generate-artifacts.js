/**
 * Generate real files in every supported format and verify them.
 *
 * Usage:
 *   npm run artifacts
 *
 * The conversation and the export calls run inside headless Chrome, because
 * the exporter needs Canvas, MathML and DOM APIs. PDFs are produced with
 * Chrome's Page.printToPDF on the exported HTML, which is the same print
 * engine the extension's print dialog uses (`preferCSSPageSize` is on, so the
 * @page geometry in the file decides paper size and margins).
 *
 * Outputs:
 *   tests/output/       the generated documents, PDFs and verification.json
 *   tests/visual/       print-media screenshots and a copy of the PNG export
 */
import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { launch, serve, sleep } from "./cdp.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT = path.join(ROOT, "tests", "output");
const PDF_SOURCE = path.join(OUTPUT, "pdf-source");
const VISUAL = path.join(ROOT, "tests", "visual");

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

function zipEntries(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let end = -1;
  for (let at = buffer.length - 22; at >= 0; at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) { end = at; break; }
  }
  if (end < 0) throw new Error("ZIP end-of-directory record not found.");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error("Malformed central directory entry.");
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    const localNameLength = view.getUint16(offset + 26, true);
    const localExtraLength = view.getUint16(offset + 28, true);
    const start = offset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    if (data.length !== size) throw new Error(`Truncated ZIP entry ${name}.`);
    entries.push({ name, method, data });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function pngInfo(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  let at = 8;
  let width = 0;
  let height = 0;
  let dpi = null;
  while (at + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.subarray(at + 4, at + 8).toString("ascii");
    if (type === "IHDR") {
      width = buffer.readUInt32BE(at + 8);
      height = buffer.readUInt32BE(at + 12);
    }
    if (type === "pHYs") {
      const x = buffer.readUInt32BE(at + 8);
      dpi = { x: Math.round(x * 0.0254), unit: buffer[at + 16] };
    }
    at += 12 + length;
  }
  return { signature, width, height, dpi };
}

const checks = [];
const record = (name, pass, detail = "") => {
  checks.push({ name, pass: Boolean(pass), detail: String(detail || "") });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(PDF_SOURCE, { recursive: true });
await mkdir(VISUAL, { recursive: true });

const server = await serve(ROOT);
const browser = await launch({ width: 1280, height: 1000 });
let verification = null;

try {
  const page = await browser.newPage();
  page.consoleErrors = [];
  await page.goto(`${server.origin}/tools/artifact.html`);
  await page.waitFor("typeof globalThis.__generateArtifacts === 'function'", { label: "the artefact generator" });
  const generated = await page.evaluate("globalThis.__generateArtifacts()");

  /* ------------------------------------------------------------ write files */
  const written = [];
  for (const file of generated.files) {
    const bytes = file.text != null ? Buffer.from(file.text, "utf8") : Buffer.from(file.base64, "base64");
    await writeFile(path.join(OUTPUT, file.name), bytes);
    written.push({
      name: file.name,
      format: file.format,
      mime: file.mime,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
      warnings: file.warnings,
      pixelWidth: file.pixelWidth,
      pixelHeight: file.pixelHeight,
      exportScale: file.exportScale,
      requestedScale: file.requestedScale
    });
  }
  for (const source of generated.pdfSources) {
    await writeFile(path.join(PDF_SOURCE, `${source.name}.html`), source.html);
  }
  for (const variant of generated.htmlVariants) {
    await writeFile(path.join(OUTPUT, `${variant.name}.html`), variant.html);
  }

  /* -------------------------------------------------------------------- PDFs */
  const pdfPage = await browser.newPage();
  for (const source of generated.pdfSources) {
    await pdfPage.goto(`${server.origin}/tests/output/pdf-source/${source.name}.html`);
    await pdfPage.waitFor("document.fonts ? document.fonts.status === 'loaded' : true", { label: `${source.name} fonts` });
    await sleep(150);
    await pdfPage.printToPDF(path.join(OUTPUT, `${source.name}.pdf`));
  }

  /* ------------------------------------------------------- visual evidence */
  const shoot = async (file, clip, scale = 1) => {
    const { data } = await pdfPage.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { ...clip, scale }
    });
    await writeFile(path.join(VISUAL, file), Buffer.from(data, "base64"));
  };

  await pdfPage.send("Emulation.setDeviceMetricsOverride", {
    width: 1100, height: 1500, deviceScaleFactor: 1, mobile: false
  });
  await pdfPage.send("Emulation.setEmulatedMedia", { media: "print", features: [] });

  await pdfPage.goto(`${server.origin}/tests/output/pdf-source/conversation-a4-portrait-normal.html`);
  await pdfPage.waitFor("document.fonts ? document.fonts.status === 'loaded' : true");
  await sleep(200);
  const pageHeight = await pdfPage.evaluate(`(() => Math.max(
    document.documentElement.scrollHeight, document.body.scrollHeight
  ))()`);
  await shoot("html-print-a4.png", { x: 0, y: 0, width: 1100, height: Math.min(pageHeight, 4400) });

  const mathRect = await pdfPage.evaluate(`(() => {
    const node = document.querySelector(".math math");
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: Math.max(0, rect.x - 16), y: Math.max(0, rect.y - 12), width: rect.width + 32, height: rect.height + 24 };
  })()`);
  if (mathRect) await shoot("math-detail.png", mathRect, 2);

  await pdfPage.goto(`${server.origin}/tests/output/pdf-source/table-headers.html`);
  await pdfPage.waitFor("document.fonts ? document.fonts.status === 'loaded' : true");
  await sleep(200);
  const tableRect = await pdfPage.evaluate(`(() => {
    const node = document.querySelector(".grid");
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: Math.max(0, rect.x - 8), y: Math.max(0, rect.y - 8), width: rect.width + 16, height: Math.min(1400, rect.height + 16) };
  })()`);
  if (tableRect) await shoot("table-header.png", tableRect, 1.5);

  const pngBytes = await readFile(path.join(OUTPUT, "conversation.png"));
  await writeFile(path.join(VISUAL, "png-poster.png"), pngBytes);

  /* ------------------------------------------------------------ inspections */
  const textOf = async (name) => (await readFile(path.join(OUTPUT, name))).toString("utf8");

  const htmlText = await textOf("conversation.html");
  const mdText = await textOf("conversation.md");
  const txtText = await textOf("conversation.txt");
  const jsonText = await textOf("conversation.json");
  const tableHtml = generated.pdfSources.find((source) => source.name === "table-headers").html;

  const docxBytes = await readFile(path.join(OUTPUT, "conversation.docx"));
  const tableDocxBytes = await readFile(path.join(OUTPUT, "table-headers.docx"));
  const docxEntries = zipEntries(docxBytes);
  const tableEntries = zipEntries(tableDocxBytes);
  const docEntry = (entries, name) => entries.find((entry) => entry.name === name);
  const docXml = docEntry(docxEntries, "word/document.xml").data.toString("utf8");
  const stylesXml = docEntry(docxEntries, "word/styles.xml").data.toString("utf8");
  const numberingXml = docEntry(docxEntries, "word/numbering.xml").data.toString("utf8");
  const relsXml = docEntry(docxEntries, "word/_rels/document.xml.rels").data.toString("utf8");
  const contentTypes = docEntry(docxEntries, "[Content_Types].xml").data.toString("utf8");
  const tableXml = docEntry(tableEntries, "word/document.xml").data.toString("utf8");

  const xmlTargets = [
    ["conversation.docx", docxEntries],
    ["table-headers.docx", tableEntries]
  ];
  const xmlPayload = xmlTargets.flatMap(([label, entries]) => entries
    .filter((entry) => entry.name.endsWith(".xml") || entry.name.endsWith(".rels"))
    .map((entry) => ({ label, name: entry.name, b64: entry.data.toString("base64") })));
  const xmlResults = await page.evaluate(`(() => {
    const files = ${JSON.stringify(xmlPayload)};
    return files.map((file) => {
      const bytes = Uint8Array.from(atob(file.b64), (character) => character.charCodeAt(0));
      const text = new TextDecoder("utf-8").decode(bytes);
      const doc = new DOMParser().parseFromString(text, "application/xml");
      const error = doc.querySelector("parsererror");
      return { label: file.label, name: file.name, ok: !error, error: error ? error.textContent.slice(0, 160) : "" };
    });
  })()`);

  const pdfPaths = generated.pdfSources.map((source) => path.join(OUTPUT, `${source.name}.pdf`));
  const python = spawnSync("python", [path.join(ROOT, "tools", "inspect-pdf.py"), ...pdfPaths], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024
  });
  let pdfReport = null;
  let pdfError = "";
  if (python.status === 0) {
    pdfReport = JSON.parse(python.stdout);
  } else {
    pdfError = (python.stderr || python.stdout || "pypdf inspection failed").slice(0, 400);
  }

  const json = JSON.parse(jsonText);
  const png = pngInfo(pngBytes);
  const imageMedia = docxEntries.filter((entry) => entry.name.startsWith("word/media/"));
  const formulaCount = generated.summary.formulas;
  const pdfConversationPages = pdfReport
    ? pdfReport.filter((item) => item.path.includes("conversation-") && !item.path.includes("cover"))
    : [];

  /* ------------------------------------------------------------------ checks */
  record("All seven formats produced a non-empty file", generated.files.length >= 7 && written.every((file) => file.size > 0), `${written.length} files`);
  record("The test conversation validates against the document schema", generated.validation.ok, generated.validation.summary || `messages=${generated.summary.messages}`);
  record("HTML is standalone, script-free and carries a CSP", /^<!doctype html>/i.test(htmlText) && htmlText.includes('http-equiv="Content-Security-Policy"') && !/<script[\s>]/i.test(htmlText), `${formatBytes(Buffer.byteLength(htmlText))}`);
  record("HTML carries MathML for every formula", (htmlText.match(/<math[ >]/g) || []).length >= formulaCount, `${(htmlText.match(/<math[ >]/g) || []).length} math elements for ${formulaCount} formulas`);
  record("HTML escapes page text instead of activating it", htmlText.includes("&lt;img src=x onerror=alert(1)&gt;") && !/onerror=alert\(1\)/.test(htmlText.replace(/&lt;img[^]*?&gt;/g, "")), "literal HTML remains text");
  record("HTML print styles define paper, margins and repeated table headers", /@page\s*\{[^}]*size:/i.test(htmlText) && /thead\s*\{[^}]*table-header-group/i.test(htmlText), "A4 rule and thead repeat present");
  record("The long table keeps a real header row", /<thead><tr><th/i.test(tableHtml) && /<w:tblHeader\/>/.test(tableXml), "HTML thead, Word tblHeader");
  record("Markdown preserves TeX, including matrix alignment", mdText.includes("\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}") && mdText.includes("$$") && !mdText.includes("```latex"), "raw & and $$ blocks kept");
  record("Markdown keeps nested list indentation", mdText.includes("- Read the expression from the outside in.\n  1. Resolve the innermost fraction first.\n  2. Apply the root or exponent.\n- Check the result against a numeric estimate."), "children indented two spaces and numbered");
  record("TXT reduces mathematics to readable words", !/\\(?:frac|sqrt|sum|int|lim|begin|end|neq|in|quad|cdot|times|left|right|text|boxed)\b/.test(txtText) && txtText.includes("starting from a/b and \u221a(x+1)") && txtText.includes("appears inline as a/b") && txtText.includes("sin x"), "inline and display TeX both reduced");
  const priceCases = [htmlText, txtText, mdText, docXml];
  record("A price beside inline maths keeps both in every format",
    priceCases.every((text) => text.includes("it costs $5 for ")) && txtText.includes("x^2 units") && mdText.includes("$x^2$"),
    "price stays prose, formula stays maths");
  record("An escaped price and an empty formula damage nothing",
    htmlText.includes("$10 for the rest") && txtText.includes("$10 for the rest") && !htmlText.includes("data-tex-error") && txtText.includes("An empty formula"),
    "no stray backslash, no error badge for an empty formula");
  record("JSON is versioned and complete", json.export && json.export.schemaVersion === 1 && json.export.generator === "AI Exporter 1.0.0" && json.messages.length === generated.summary.messages, `${json.messages.length} messages`);
  record("DOCX is a valid package with every required part", ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/numbering.xml", "word/_rels/document.xml.rels"].every((name) => docEntry(docxEntries, name)), `${docxEntries.length} entries`);
  record("Every DOCX XML part is well-formed", xmlResults.every((result) => result.ok), `${xmlResults.length} parts`);
  record("DOCX carries real OMML equations, not TeX text", /<m:oMath[ >]/.test(docXml) && !/\\frac|\\begin\{/.test(docXml), `${(docXml.match(/<m:oMath[ >]/g) || []).length} equations`);
  record("DOCX embeds every valid image and reports broken bytes", imageMedia.length === 4 && /Extension="jpeg" ContentType="image\/jpeg"/.test(contentTypes) && /media\/image2\.jpeg/.test(relsXml) && /Image not embedded/.test(docXml), `${imageMedia.length} media parts, broken source is a placeholder`);
  record("DOCX code keeps indentation and syntax colours", /<w:t xml:space="preserve"> {4}<\/w:t>/.test(docXml) && /<w:color w:val="8250DF"\/>/.test(docXml) && /<w:color w:val="953800"\/>/.test(docXml), "spaces, keyword and number runs");
  record("DOCX numbering declares all nine levels", (numberingXml.match(/<w:lvl w:ilvl=/g) || []).length === 18 && (numberingXml.match(/<w:lvlOverride/g) || []).length >= 9, "bullet + decimal × 9");
  record("DOCX table header repeats across pages", (tableXml.match(/<w:tblHeader\/>/g) || []).length === 1 && (tableXml.match(/<w:tr>/g) || []).length === 71, "71 rows, one repeating header");
  record("PNG has the reported dimensions and real DPI", png.width === written.find((file) => file.name === "conversation.png").pixelWidth && png.height === written.find((file) => file.name === "conversation.png").pixelHeight && png.dpi && png.dpi.unit === 1, `${png.width}×${png.height} at ${png.dpi ? png.dpi.x : "?"} DPI`);
  record("PDF inspection ran", Boolean(pdfReport), pdfError || `${pdfReport ? pdfReport.length : 0} files`);

  if (pdfReport) {
    const a4 = pdfReport.find((item) => item.path.includes("conversation-a4-portrait-normal"));
    const landscape = pdfReport.find((item) => item.path.includes("letter-landscape"));
    const wide = pdfReport.find((item) => item.path.includes("a4-portrait-wide"));
    const cover = pdfReport.find((item) => item.path.includes("a4-cover"));
    const table = pdfReport.find((item) => item.path.includes("table-headers"));
    const sizeOk = (item, width, height) => item && Math.abs(item.page_details[0].width_mm - width) <= 2 && Math.abs(item.page_details[0].height_mm - height) <= 2;
    record("PDF keeps A4 portrait geometry", sizeOk(a4, 210, 297), a4 ? `${a4.page_details[0].width_mm}×${a4.page_details[0].height_mm} mm, ${a4.pages} pages` : "missing");
    record("PDF honours Letter landscape and narrow margins", sizeOk(landscape, 279.4, 215.9), landscape ? `${landscape.page_details[0].width_mm}×${landscape.page_details[0].height_mm} mm` : "missing");
    record("PDF honours A4 wide margins", sizeOk(wide, 210, 297), wide ? `${wide.pages} pages` : "missing");
    record("PDF cover option adds a title page", cover && cover.pages >= a4.pages, cover ? `${cover.pages} vs ${a4 ? a4.pages : "?"} pages` : "missing");
    record("No PDF page is blank", [a4, landscape, wide, table].every((item) => item && item.blank_pages.length === 0), pdfReport.flatMap((item) => item.blank_pages).join(", ") || "all pages carry text");
    record("PDF embeds real fonts", a4 && a4.fonts.length > 0, a4 ? a4.fonts.slice(0, 5).join(", ") : "missing");
    record("PDF text is searchable", a4 && /Fractions and roots/.test(a4.page_details.map((item) => item.text).join("\n")), a4 ? `${a4.text_chars} extracted characters` : "missing");
    record("PDF repeats the table header on later pages", table && table.page_details.filter((item) => /Step/.test(item.text)).length >= 2, table ? `${table.page_details.filter((item) => /Step/.test(item.text)).length} pages contain the header` : "missing");
    record("PDF spans more than one page without clipping", pdfConversationPages.every((item) => item.pages >= 2 && item.blank_pages.length === 0), pdfConversationPages.map((item) => item.pages).join(", "));
  }

  const failures = checks.filter((check) => !check.pass);

  verification = {
    generatedAt: new Date().toISOString(),
    generator: "AI Exporter 1.0.0 artifact generator",
    summary: generated.summary,
    validation: generated.validation,
    files: written,
    pdf: pdfReport || { error: pdfError },
    docx: {
      entries: docxEntries.map((entry) => entry.name),
      media: imageMedia.map((entry) => ({ name: entry.name, bytes: entry.data.length })),
      omml: (docXml.match(/<m:oMath[ >]/g) || []).length,
      tableRows: (tableXml.match(/<w:tr>/g) || []).length,
      stylesBytes: stylesXml.length,
      xml: xmlResults
    },
    png,
    checks,
    failures: failures.length
  };
  await writeFile(path.join(OUTPUT, "verification.json"), `${JSON.stringify(verification, null, 2)}\n`);

  const lines = [
    "# Artifact verification",
    "",
    `Generated ${new Date().toISOString()} from the real exporter in headless Chrome.`,
    "",
    "| File | Format | Size | Warnings |",
    "| --- | --- | ---: | ---: |",
    ...written.map((file) => `| \`${file.name}\` | ${file.format} | ${formatBytes(file.size)} | ${file.warnings.length} |`),
    "",
    "## Checks",
    "",
    "| Check | Result | Detail |",
    "| --- | --- | --- |",
    ...checks.map((check) => `| ${check.name} | ${check.pass ? "PASS" : "FAIL"} | ${check.detail.replace(/\|/g, "\\|")} |`),
    "",
    failures.length ? `**${failures.length} check(s) failed.**` : "**All artefact checks passed.**"
  ];
  await writeFile(path.join(OUTPUT, "verification.md"), `${lines.join("\n")}\n`);

  console.log(`\n${checks.length - failures.length}/${checks.length} artifact checks passed.`);
  if (page.consoleErrors.length) {
    console.log("\nPage errors during generation:");
    for (const error of page.consoleErrors) console.log(`  ${error.split("\n")[0]}`);
  }
  process.exitCode = failures.length ? 1 : 0;
} catch (error) {
  console.error(`Artifact generation failed: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
