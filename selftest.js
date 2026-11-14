/* Dependency-free browser regressions and visual samples. No real chat data. */
(async () => {
  "use strict";
  const exporter = globalThis.AIExporter;
  const parser = globalThis.AIExporterParser;
  const docx = globalThis.AIExporterDocx;
  const results = [];
  const ensure = (ok, message) => { if (!ok) throw new Error(message || "Assertion failed"); };
  const check = async (name, fn) => {
    try { await fn(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
  };
  const code = '#include <iostream>\nusing namespace std;\n\nint main() {\n    int values[] = {10, 20, 30};\n    for (int value : values) {\n        cout << value << " ";\n    }\n    return 0;\n}';
  const chat = {
    version: 1, title: "Array operations — clear code, clean output", platform: "chatgpt", platformLabel: "ChatGPT",
    model: "Sample conversation", exportedAt: "2026-10-11T10:00:00Z", url: "https://chatgpt.com/c/sample",
    messages: [
      { id: "sample-user", role: "user", text: "Explain an array traversal and show complete C++ code.", blocks: [
        { type: "paragraph", text: "Explain an array traversal and show complete C++ code." }
      ] },
      { id: "sample-answer", role: "assistant", text: "Complete C++ example with a table, code, output, and notes.", blocks: [
        { type: "heading", level: 2, text: "Experiment 1: Array traversal" },
        { type: "paragraph", text: "The program visits every element once. Code indentation and blank lines should stay intact in PDF, Word, and Markdown.\nThis second line remains a distinct line in the reading copy." },
        { type: "table", head: ["Operation", "Example", "Cost"], rows: [["Read", "values[1]", "O(1)"], ["Traverse", "for each value", "O(n)"], ["Long reference", "https://example.invalid/" + "long-path-".repeat(14), "Must wrap inside its cell"]] },
        { type: "heading", level: 3, text: "Complete, runnable program" },
        { type: "code", language: "cpp", code },
        { type: "paragraph", text: "Output:" },
        { type: "code", language: "text", code: "10 20 30" },
        { type: "quote", text: "Note: array indices start at zero. Keep the array bounds in mind when modifying elements." },
        { type: "list", ordered: true, items: ["Compile the complete program.", "Run it and check the three values.", "Modify one element and run again."] },
        { type: "paragraph", text: "Literal HTML example: <img src=x onerror=alert(1)> must remain text, never active markup." },
        { type: "image", src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAADcCAIAAADSq6xVAAADx0lEQVR42u3dMW7bMBSA4ScjgM7g1Yumrh5zju45V/acI6PXTFq8+gya2MGAWjSLi5IUKX/fARzhmfxN24E1pJQC4F8cjAAQDkA4AOEAhAMQDgDhAIQDEA5AOADhABAOQDgA4QCEAxAOAOEAhAMQDkA4AOEAhANAOADhAIQD6N1Lhb9xuS4GDTWdT2PRxx+K3gJSMmCX+SgVjj+TMR1HTyHUNN+WovkoEo61GpIBLeQjezsOqgF7te7B7B8aHFQDtKOJr2NVAxpsR6PhuCdNNaDNdmQ8dPgHMGC7cDhuwPMcOpw4AOEAhAMQDkA4AOEAEA5AOADhAIQDEA4A4QCEAxAOQDgA4QAQDkA4AOEAhAMQDkA4AIQDEA5AOADhAIQDQDgA4QCEAxAOQDgAhAMQDkA4AOEAhANAOADhAIQDEA5AOADhABAOQDgA4QD69tLvpf/4OfdyqV8fk2mYxlbTKGFIKWV5oMt1iYjpOEpG5SViGqbxoPm2RMT5ND5jONaV8fneTapf3+ZC68M0TEM4Hl0ZHS2L70sk4/owDdPYKhyH7j7U6HRlrFee6yxtGqYRvlUBwtexjhtFX1hMwzSEA3DiAIQDQDgA4QCEAxAOQDgAhAMQDkA4AOEAhAMQDgDhAITjeXX6A7ymIRzYLaaBcNgtpoFw2C2mgXBgt5hGuAUkOVf8/naLaThxAMIB4K1KdHiT4b9O418f087O56bhxMEebmtuGgiHfWIaCId9gmkIB/aJaQgH9olpCAeAcADCAQgHIByAcAAIByAcgHAAwgEIByAcAMIBCAcgHIBwRKVfYXh96/tnae/X//+/KGEapiEcgBOHQ0eVlxTTMI0NDSmlLA90uS4RMR3HqHW7wM/3qa9lUWJlmIZpPG6+LRFxPo3PGI5+bxdaaGWYhmkIxz6XSIVlYRqmIRxA0+HwrQogHIBwAMIBCAcgHADCAQgHIByAcADCASAcgHAAwgEIByAcAMIBCAcgHIBwAMIBCAeAcADCAQgHIByAcAAIByAcgHAAwgEIB4BwAMIBCAcgHIBwAAgHIByAcADCAQgHIBwAwgEIByAcgHBERMT5NEbEfFvMFBp035v3ferEAXT+VsWhA57huFHqxKEd0Fo1mv5wdE2adkBT1ch43Chy4tAO2Hc1ImJIKZW44sv1dzWm4+gphK3enmSvRsFwfM8HUFmJZNQIh3zAzpJRLxxA+D8OQDgAhAMQDkA4AOEAhANAOADhAIQDEA5AOACEAxAOQDgA4QCEA0A4AOEAhAMQDkA4AOEAEA6gpF8b434MZVgzSQAAAABJRU5ErkJggg==", alt: "Array traversal diagram", caption: "Figure 1: traversal order across the array", kind: "diagram", width: 360, height: 220 },
        { type: "image", src: "https://tracking.invalid/pixel", alt: "Remote image blocked unless explicitly enabled" }
      ] },
      { id: "sample-private", role: "user", text: "PRIVATE_SAMPLE_MARKER — deselect this message before printing.", blocks: [
        { type: "paragraph", text: "PRIVATE_SAMPLE_MARKER — deselect this message before printing." }
      ] }
    ]
  };
  globalThis.AIExporterSample = chat;
  if (new URLSearchParams(location.search).has("controller")) {
    const response = await fetch("export/export.html");
    if (!response.ok) throw new Error("Could not load the export controller sample.");
    const html = (await response.text()).replace(/<script[\s\S]*?<\/script>/g, "").replace('href="export.css"', 'href="export/export.css"');
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, "").replace(/<\/?html[^>]*>/gi, "");
    // ?settings=1 makes the stub return saved preferences, so the controller's
    // settings flow can be asserted from the parent page.
    const saved = new URLSearchParams(location.search).has("settings")
      ? { includeTimestamps: true, preserveCodeHighlighting: false, docTheme: "dark", docMode: "bw" }
      : {};
    globalThis.chrome = {
      storage: {
        session: { async get(key) { return { [key]: { chat: structuredClone(chat), options: {}, createdAt: Date.now() } }; }, async remove() {} },
        local: { async get() { return saved; }, async set() {} }
      },
      downloads: {
        download(options, callback) {
          globalThis.__lastDownload = options.filename;
          const id = 1;
          setTimeout(() => {
            if (globalThis.__failNextDownload) {
              globalThis.__failNextDownload = false;
              chrome.runtime.lastError = { message: "Simulated download refusal." };
              callback(undefined);
              delete chrome.runtime.lastError;
              return;
            }
            const link = document.createElement("a");
            link.href = options.url;
            link.download = options.filename;
            link.click();
            (globalThis.__downloadNames ||= new Map()).set(id, options.filename);
            callback(id);
            // The controller reports success only from this event, so the stub
            // finishes a real download the way Chrome does.
            setTimeout(
              () => globalThis.__emitDownload({ id, state: { current: "complete" } }),
              globalThis.__completeDelay == null ? 60 : globalThis.__completeDelay
            );
          }, globalThis.__downloadDelay || 0);
        },
        cancel(id, callback) {
          globalThis.__cancelledDownload = id;
          setTimeout(() => globalThis.__emitDownload({ id, state: { current: "interrupted" } }), 10);
          if (callback) callback();
        },
        search(query, callback) {
          const name = (globalThis.__downloadNames || new Map()).get(query && query.id);
          callback(name ? [{ id: query.id, filename: `C:\\Users\\Sample\\Downloads\\${name}`, state: "complete" }] : []);
        },
        showDefaultFolder() { globalThis.__folderShown = true; },
        onChanged: { addListener(listener) { (globalThis.__downloadListeners ||= []).push(listener); } }
      },
      tabs: { async create(options) { window.open(options.url, "_blank", "noopener"); return { id: 1 }; } }, runtime: {}
    };
    globalThis.__emitDownload = (delta) => {
      // Terminal states are final; replaying one must not resurrect an export.
      const terminal = (globalThis.__terminalDownloads ||= new Set());
      if (delta && delta.state && (delta.state.current === "complete" || delta.state.current === "interrupted")) {
        if (terminal.has(delta.id)) return;
        terminal.add(delta.id);
      }
      (globalThis.__downloadListeners || []).forEach((listener) => listener(delta));
    };
    const script = document.createElement("script");
    script.src = "export/export.js";
    document.body.append(script);
    return;
  }
  function parse(html, hostname = "chatgpt.com") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return parser.parsePage(doc, { hostname, href: `https://${hostname}/c/test` });
  }
  async function controllerFrame(extra = "") {
    const frame = document.createElement("iframe");
    // A display:none frame throttles timers to once a second, which turns a
    // sub-second export into a multi-second one. Keep it laid out but invisible.
    frame.style.cssText = "position:fixed;inset:0 auto auto 0;width:1200px;height:900px;opacity:0;pointer-events:none;";
    frame.setAttribute("aria-hidden", "true");
    frame.src = `selftest.html?controller=1&export=33333333-3333-4333-8333-333333333333${extra}`;
    document.body.append(frame);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The controller did not load in time.")), 8000);
      frame.addEventListener("load", () => setTimeout(resolve, 500));
      frame.addEventListener("error", () => { clearTimeout(timer); reject(new Error("The controller failed to load.")); });
    });
    return frame;
  }
  // Read back the store-only ZIP that a .docx download actually contains.
  function zipEntries(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let at = bytes.length - 22; at >= 0; at -= 1) {
      if (view.getUint32(at, true) === 0x06054b50) { end = at; break; }
    }
    ensure(end >= 0, "The ZIP end-of-directory record was not found.");
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const entries = [];
    for (let index = 0; index < count; index += 1) {
      ensure(view.getUint32(at, true) === 0x02014b50, "A central directory record is malformed.");
      const method = view.getUint16(at + 10, true);
      const crc = view.getUint32(at + 16, true);
      const size = view.getUint32(at + 20, true);
      const nameLength = view.getUint16(at + 28, true);
      const extraLength = view.getUint16(at + 30, true);
      const commentLength = view.getUint16(at + 32, true);
      const offset = view.getUint32(at + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
      ensure(method === 0, `${name} should be stored without compression.`);
      ensure(view.getUint32(offset, true) === 0x04034b50, `The local header for ${name} is malformed.`);
      entries.push({ name, crc, size, offset });
      at += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }
  function entryBytes(bytes, entry) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const nameLength = view.getUint16(entry.offset + 26, true);
    const extraLength = view.getUint16(entry.offset + 28, true);
    const start = entry.offset + 30 + nameLength + extraLength;
    return bytes.subarray(start, start + entry.size);
  }
  let crcTable = null;
  function crc32Of(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        crcTable[index] = value >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  await check("C++ code root preserves exact indentation", () => {
    const parsed = parse('<div data-message-author-role="assistant"><pre class="markdown"><code class="language-cpp">int main() {\n    return 0;\n}</code></pre></div>');
    ensure(parsed.messages[0].blocks[0].type === "code");
    ensure(parsed.messages[0].blocks[0].code === "int main() {\n    return 0;\n}");
  });
  await check("Code-heavy answers preserve surrounding prose", () => {
    const parsed = parse(`<div data-message-author-role="assistant"><div><h3>Before</h3><pre><code>${"    int x = 1;\n".repeat(80)}</code></pre><p>After</p></div></div>`);
    ensure(parsed.messages[0].blocks.some((block) => block.type === "heading" && block.text === "Before"));
    ensure(parsed.messages[0].blocks.some((block) => block.text === "After"));
  });
  await check("Repeated Claude test IDs produce unique stable selection IDs", () => {
    const doc = new DOMParser().parseFromString('<div data-testid="user-message">One</div><div class="font-claude-response">Answer</div><div data-testid="user-message">Two</div>', "text/html");
    const entries = parser.findMessages(doc, { hostname: "claude.ai" });
    ensure(new Set(entries.map((entry) => entry.id)).size === 3);
    ensure(entries.map((entry) => entry.id).join() === parser.findMessages(doc, { hostname: "claude.ai" }).map((entry) => entry.id).join());
  });
  await check("Gemini adapters keep roles, order and content", () => {
    const parsed = parse(
      '<user-query-content><div class="query-text"><p>What is a group?</p></div></user-query-content>' +
      '<model-response><div class="markdown"><p>A set with an associative operation.</p><pre><code class="language-python">g = Group()</code></pre></div></model-response>',
      "gemini.google.com"
    );
    ensure(parsed.messages.length === 2, `Gemini adapters must find both turns (found ${parsed.messages.length}).`);
    ensure(parsed.messages[0].role === "user" && parsed.messages[1].role === "assistant", "Gemini roles must come from the adapter, not inference.");
    ensure(parsed.messages[0].blocks.some((block) => block.text === "What is a group?"), "The Gemini prompt must survive.");
    ensure(parsed.messages[1].blocks.some((block) => block.type === "code" && block.code === "g = Group()"), "Gemini code must survive.");
  });

  await check("DeepSeek adapters read both sides without the hashed class", () => {
    const parsed = parse(
      '<div class="ds-message"><div class="fbb737a4"><p>Explain closures.</p></div><div class="ds-markdown"><p>A function plus its scope.</p></div></div>',
      "chat.deepseek.com"
    );
    ensure(parsed.messages.length === 2, `DeepSeek must read both sides (found ${parsed.messages.length}).`);
    ensure(parsed.messages[0].role === "user" && parsed.messages[1].role === "assistant", "DeepSeek roles must come from the adapter.");
    ensure(parsed.messages[1].text.includes("A function plus its scope."), "The DeepSeek answer must survive.");
  });

  await check("Partial extraction is reported, not silently exported", () => {
    const doc = new DOMParser().parseFromString(
      '<section data-testid="conversation-turn-1" data-message-author-role="user"><div class="whitespace-pre-wrap">Kept turn</div></section>' +
      '<section data-testid="conversation-turn-2" data-message-author-role="assistant"></section>',
      "text/html"
    );
    const entries = parser.findMessages(doc, { hostname: "chatgpt.com" });
    ensure(entries.length === 1, "The readable turn must still be exported.");
    ensure(entries.coverage && entries.coverage.unreadable >= 1, "An unreadable turn must be counted, not dropped.");
    const page = parser.parsePage(doc, { hostname: "chatgpt.com", href: "https://chatgpt.com/c/1" });
    ensure(page.coverage && page.coverage.unreadable >= 1, "parsePage must carry coverage to the popup.");
    ensure(page.messageCount === 1, "Coverage must not add phantom messages.");
  });

  await check("Code textboxes use the specified palette", () => {
    const light = exporter.documentHtml(chat, { theme: "light" });
    const dark = exporter.documentHtml(chat, { theme: "dark" });
    const print = exporter.documentHtml(chat, { theme: "print" });
    // The reference textbox: soft cool grey, charcoal text, cool grey border.
    ensure(light.includes("--code-bg: #F3F4F6") && light.includes("--code-ink: #24292F"), "Light code background or ink drifted.");
    ensure(light.includes("--code-line: #D1D5DB") && light.includes("--code-line-no: #8C959F"), "Code border or line-number colour drifted.");
    ensure(light.includes("--inline-bg: #EFF1F3"), "Inline code needs its neutral grey fill.");
    // Token colours, exactly as specified.
    for (const [token, value] of Object.entries({
      "--tok-kw": "#8250DF", "--tok-str": "#116329", "--tok-num": "#953800",
      "--tok-com": "#6E7781", "--tok-fn": "#0550AE"
    })) {
      ensure(light.includes(`${token}: ${value}`), `${token} must be ${value}.`);
    }
    ensure(dark.includes("--code-bg: #161B22") && dark.includes("--tok-kw: #D2A8FF"), "Dark code palette drifted.");
    ensure(print.includes("--code-bg: #F3F4F6") && print.includes("--tok-kw: #111827"), "Printable code must stay high-contrast.");
    ensure(light.includes("print-color-adjust: exact"), "Print backgrounds must be requested explicitly.");
    ensure(exporter.THEMES.light.codeBg === "#F3F4F6" && exporter.THEMES.light.inlineBg === "#EFF1F3", "Theme tokens must be the single source.");

    const doc = new DOMParser().parseFromString(light, "text/html");
    const rules = [...doc.querySelectorAll("style")].map((style) => style.textContent).join("\n");
    ensure(/\.code pre \{[^}]*font-family: var\(--mono\)/.test(rules), "Code must use the monospace stack.");
    ensure(/\.code pre \{[^}]*white-space: pre\b/.test(rules), "Long code lines scroll rather than wrap on screen.");
    const printBlock = rules.slice(rules.lastIndexOf("@media print"));
    ensure(/\.code pre \{[^}]*white-space: pre-wrap/.test(printBlock), "Paper must wrap long code instead of clipping it.");
    ensure(/\.code-gutter \{[^}]*color: var\(--code-line-no\)/.test(rules), "The gutter must use the slate grey line numbers.");
    ensure(/\.code--output \.code-head \{[^}]*background: var\(--out-head-bg\)/.test(rules), "Output must keep its own header fill.");
  });

  await check("Code blocks keep their exact text, tokens and line numbers", () => {
    const sample = { ...chat, messages: [{ role: "assistant", blocks: [{ type: "code", language: "cpp", code }] }] };
    const doc = new DOMParser().parseFromString(exporter.documentHtml(sample, { theme: "light" }), "text/html");
    const figure = doc.querySelector(".code");
    ensure(figure, "The code block must render as a code panel.");
    ensure(figure.querySelector(".code-lang").textContent === "Cpp", "The panel must name its language.");
    const gutter = figure.querySelector(".code-gutter");
    ensure(gutter && gutter.getAttribute("aria-hidden") === "true", "Line numbers must be decorative to assistive tech.");
    ensure(gutter.textContent.split("\n").length === code.split("\n").length, "One number per source line.");
    const pre = figure.querySelector("pre code");
    ensure(pre.textContent === code, "Highlighting must not alter a single character of the code.");
    ensure(figure.querySelectorAll(".tok-kw").length > 0 && figure.querySelectorAll(".tok-fn").length > 0, "Keywords and functions need their token colours.");
    // A keyword inside a string or comment must stay part of that token.
    const tricky = { ...chat, messages: [{ role: "assistant", blocks: [{ type: "code", language: "python", code: "note = \"return int value\"\n# int return\nvalue = 1" }] }] };
    const trickyDoc = new DOMParser().parseFromString(exporter.documentHtml(tricky, { theme: "light" }), "text/html");
    const stringToken = trickyDoc.querySelector(".tok-str");
    ensure(stringToken && stringToken.textContent === '"return int value"', "Keywords inside a string must not be re-highlighted.");
    ensure(!stringToken.querySelector(".tok-kw"), "A string must never contain keyword spans.");
    const commentToken = trickyDoc.querySelector(".tok-com");
    ensure(commentToken && commentToken.textContent.includes("int") && !commentToken.querySelector(".tok-kw"), "A comment must stay one token.");
    // Output panels are terminal text: no gutter, their own fill.
    const outputDoc = new DOMParser().parseFromString(exporter.documentHtml(chat, { theme: "light" }), "text/html");
    const output = outputDoc.querySelector(".code--output");
    ensure(output && !output.querySelector(".code-gutter"), "Program output needs no line numbers.");
    ensure(output.querySelector("pre code").textContent === "10 20 30", "Output text must survive intact.");
  });
  await check("Long URLs in table cells stay inside fixed-width columns", () => {
    const longUrl = "https://example.invalid/" + "segment-".repeat(30);
    const sample = { ...chat, messages: [{ role: "assistant", blocks: [{ type: "table", head: ["Reference", "Note"], rows: [[longUrl, "Wraps"]] }] }] };
    const html = new DOMParser().parseFromString(exporter.documentHtml(sample), "text/html");
    ensure(html.querySelector(".grid"), "The table must render as a grid.");
    const rules = [...html.querySelectorAll("style")].map((style) => style.textContent).join("\n");
    ensure(/\.grid\s*\{[^}]*table-layout:\s*fixed/.test(rules), "Table columns must be fixed to the page width.");
    ensure(/\.grid th, \.grid td \{[^}]*overflow-wrap:\s*anywhere/.test(rules), "Long cell text must wrap inside its cell.");
    const xml = docx.parts(sample, {}).files.find((file) => file.name === "word/document.xml").text;
    ensure(xml.includes("<w:tblLayout w:type=\"fixed\"/>"), "Word tables must use a fixed layout.");
    // Word inserts zero-width break points into long unbroken text, so compare with them removed.
    ensure(xml.replace(/\u200b/g, "").includes(longUrl), "The long URL text must survive into the Word table.");
  });
  await check("Remote images are blocked by default", () => {
    const doc = new DOMParser().parseFromString(exporter.documentHtml(chat), "text/html");
    ensure(doc.querySelectorAll('img[src^="https:"]').length === 0);
  });
  await check("Remote images require explicit opt-in", () => {
    const doc = new DOMParser().parseFromString(exporter.documentHtml(chat, { remoteImages: true }), "text/html");
    ensure(doc.querySelectorAll('img[src^="https:"]').length === 1);
  });
  await check("Exported markup is escaped and scripts remain prohibited", () => {
    const doc = new DOMParser().parseFromString(exporter.documentHtml(chat), "text/html");
    ensure(!doc.querySelector("script, [onerror]"));
    ensure(doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("script-src 'none'"));
  });
  await check("Markdown escapes HTML and left-aligns table columns", () => {
    const md = exporter.markdownFor(chat);
    ensure(md.includes("&lt;img"));
    ensure(!md.includes("<img"));
    ensure(md.includes("| :--- | :--- | :--- |"));
  });
  await check("Markdown fences cannot close on embedded backticks", () => {
    const sample = { ...chat, messages: [{ role: "assistant", blocks: [{ type: "code", language: "md", code: "```\nexample\n```" }] }] };
    ensure(exporter.markdownFor(sample).includes("````md\n```\nexample\n```\n````"));
  });
  await check("Markdown keeps literal HTML inert and preserves formula source", () => {
    const sample = { ...chat, messages: [{ role: "assistant", blocks: [
      { type: "paragraph", text: "![tracking](https://tracking.invalid/pixel)" },
      { type: "paragraph", text: "inline $\\subseteq$ and $\\boxed{59049}$" },
      { type: "formula", tex: "N = 3^{10} = \\boxed{59049}" }
    ] }] };
    const md = exporter.markdownFor(sample);
    ensure(md.includes("!\\[tracking\\]"));
    ensure(md.includes("$\\subseteq$"), "Inline maths must keep single backslashes so a math viewer can render it.");
    ensure(md.includes("$$\n") && md.includes("N = 3^{10} = \\boxed{59049}"), "Display maths must be a $$ block, not a code fence.");
    ensure(!md.includes("```latex"), "Formula source must not fall back to a raw LaTeX code fence.");
  });
  await check("Document formats compile maths to MathML", () => {
    const html = exporter.documentHtml({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "paragraph", text: "Given $A \\subseteq B$ and $\\frac{a+b}{2}$." },
      { type: "formula", tex: "\\binom{5}{2} = \\boxed{10}" }
    ] }] });
    const doc = new DOMParser().parseFromString(html, "text/html");
    ensure(doc.querySelectorAll("math").length >= 3, "Each maths span should become a <math> element.");
    ensure(doc.querySelector(".math menclose"), "\\boxed should render as a boxed MathML enclosure.");
    ensure(doc.querySelector(".math mfrac"), "\\binom should render as a MathML fraction.");
    ensure(doc.querySelector(".math-inline"), "Inline maths should use the inline wrapper.");
    ensure(!html.includes("\\subseteq"), "Raw TeX must not leak into the rendered document.");
    const modDoc = new DOMParser().parseFromString(exporter.documentHtml({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "formula", tex: "a \\equiv b \\pmod m" }
    ] }] }), "text/html");
    const modMath = modDoc.querySelector(".math math");
    ensure(modMath && !/pmod/i.test(modMath.textContent), "\\pmod must compile to (mod m), not italic letters.");
    const modWord = [...modMath.querySelectorAll("mtext")].find((node) => node.textContent === "mod");
    ensure(modWord, "mod must be upright inside \\pmod.");
    const styledDoc = new DOMParser().parseFromString(exporter.documentHtml({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "formula", tex: "\\mathbb{R}^{+} \\subset \\mathbb{Z} \\to \\mathcal{F} \\mathbf{v} \\mathrm{d}x" }
    ] }] }), "text/html");
    const styledText = styledDoc.body.textContent;
    ensure(styledText.includes("\u211d") && styledText.includes("\u2124"), "\\mathbb must print as the double-struck letter, not an italic R.");
    ensure(styledText.includes("\u2131"), "\\mathcal must print as a script letter.");
    ensure(styledText.includes(String.fromCodePoint(0x1d42f)), "\\mathbf must print as a bold letter.");
    ensure(!/mathvariant="double-struck"/.test(html), "A style Chromium ignores must not be the only thing carrying it.");
    const matrixDoc = new DOMParser().parseFromString(exporter.documentHtml({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "formula", tex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" }
    ] }] }), "text/html");
    const matrix = matrixDoc.querySelector(".math mtable");
    ensure(matrix, "A matrix environment must compile to an mtable.");
    ensure(matrix.querySelectorAll("mtr").length === 2 && matrix.querySelectorAll("mtd").length === 4, "Matrix rows and cells must survive.");
    ensure(!/begin\{pmatrix\}|end\{pmatrix\}/.test(matrixDoc.querySelector(".math").textContent), "Environment markers must not leak into the page.");
  });
  await check("Fences, escaped LaTeX and wrapped maths render instead of printing their commands", () => {
    const html = exporter.documentHtml({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "formula", tex: "\\left| A \\right| = \\left\\lfloor \\frac{100}{5} \\right\\rfloor + \\left\\lceil \\frac{100}{9} \\right\\rceil" },
      { type: "paragraph", text: "For three sets:\n$\\begin{aligned} |A\\cup B| &= |A| + |B| \\end{aligned}$\nholds." },
      { type: "paragraph", text: "Escaped source: $\\\\frac{1}{2}$ stays a fraction." }
    ] }] });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const text = doc.body.textContent;
    ensure(!/lfloor|rfloor|lceil|rceil/.test(text), "Floor and ceiling must not print as words.");
    ensure(doc.querySelectorAll(".math-inline math").length >= 2, "A $...$ span that wraps onto the next line must still compile.");
    ensure(!text.includes("$") && !/begin\{|end\{/.test(text), "Delimiters and environment names must not reach the page.");
    ensure(doc.querySelectorAll("math mfrac").length >= 3, "Every fraction must be typeset, including the escaped \\\\frac.");
  });
  await check("Pasted \\( \\) and \\[ \\] mathematics is normalised at the source", () => {
    const doc = new DOMParser().parseFromString(
      '<main><section data-testid="conversation-turn-1"><div data-message-author-role="user">' +
        '<div class="whitespace-pre-wrap">Find \\(a\\times b\\equiv1\\pmod{15}\\).</div></div></section>' +
        '<section data-testid="conversation-turn-2"><div data-message-author-role="assistant">' +
        '<div class="markdown"><p>\\[ \\boxed{2^{-1}=8} \\]</p></div></div></section></main>',
      "text/html"
    );
    const parsed = AIExporterParser.parsePage(doc, { hostname: "chatgpt.com", href: "https://chatgpt.com/c/x" });
    ensure(parsed.messages.length === 2, "Both turns must parse, not only the KaTeX one.");
    ensure(parsed.messages[0].blocks[0].text.includes("$a\\times b\\equiv1\\pmod{15}$"), "Inline \\( \\) must become a $...$ span.");
    ensure(parsed.messages[1].blocks.some((block) => block.type === "formula" && block.tex.includes("\\boxed")), "Display \\[ \\] must become a formula block.");
  });
  await check("Pasted delimiters compile instead of leaking TeX", () => {
    const html = exporter.documentHtml({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "paragraph", text: "We need \\(a \\times b \\equiv 1 \\pmod{15}\\) and \\(2\\times8=16\\)." },
      { type: "paragraph", text: "\\[ \\boxed{2^{-1}=8} \\]" },
      { type: "formula", tex: "\\frac{1}{1+\\frac{1}{x}}" }
    ] }] });
    ensure(!html.includes("\\(") && !html.includes("\\["), "Delimiters must not survive into the document.");
    ensure(!html.includes("\\times") && !html.includes("\\pmod"), "TeX commands must not leak as text.");
    ensure(!html.includes('class="tex tex--error"'), "Supported expressions must not fall back to source.");
    const doc = new DOMParser().parseFromString(html, "text/html");
    ensure(doc.querySelectorAll("math").length >= 3, "Every expression must be MathML.");
    ensure(doc.querySelector(".math menclose"), "\\boxed must stay boxed.");
    ensure(doc.querySelectorAll("math mfrac").length >= 2, "Nested fractions must compile.");
  });
  const docxText = (sample = chat, options = {}) =>
    docx.parts(sample, options).files.find((file) => file.name === "word/document.xml").text;
  await check("Word receives readable maths, not TeX commands", () => {
    const xml = docxText({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "formula", tex: "\\boxed{2^{-1}=8}" },
      { type: "paragraph", text: "and \\(a\\times b\\)" }
    ] }] });
    ensure(!xml.includes("\\boxed") && !xml.includes("\\times"), "DOCX must not carry raw LaTeX.");
    ensure(xml.includes("Cambria Math"), "Math runs must use the math font.");
    const styled = docxText({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "formula", tex: "\\mathbb{R}^{3} \\cup \\mathbf{v} \\cup \\mathrm{d}x" },
      { type: "formula", tex: "\\lfloor 100/5 \\rfloor = \\left\\lceil \\frac{100}{7} \\right\\rceil" }
    ] }] });
    ensure(/<m:scr m:val="double-struck"\/>/.test(styled), "\\mathbb must keep its double-struck style in Word, not fall back to italic.");
    ensure(/<m:sty m:val="b"\/>/.test(styled), "\\mathbf must stay bold in Word.");
    ensure(/<m:nor\/>/.test(styled), "\\mathrm must stay upright in Word.");
    ensure(styled.includes("\u230a") && styled.includes("\u2308"), "Floor and ceiling must reach Word as glyphs.");
    ensure(!/lfloor|rfloor|lceil|rceil/.test(styled), "Word must not print floor or ceiling command names.");
  });
  /* Regression for BUG-2: Word carried its own inline scanner, so a price next
     to a formula became an equation and the real expression became prose.
     These are the six cases the remediation pass names. */
  await check("Word reads text and mathematics the same way the document does", () => {
    const blocks = [
      { type: "paragraph", text: "It costs $5 for $x^2$ units, and $10 for the rest." },
      { type: "paragraph", text: String.raw`Escaped \$7 and \$9 stay prices.` },
      { type: "paragraph", text: String.raw`Adjacent: $a$ and $b$ and $c+d$.` },
      { type: "paragraph", text: String.raw`Nested: $\frac{1}{1+\frac{1}{x}}$ in one run.` },
      { type: "formula", tex: String.raw`\frac{1}{1+\frac{1}{x}}` },
      { type: "paragraph", text: "Specials: 5 < 6 & 7 > 4, snake_case, **bold**, `code`, a|b." }
    ];
    const xml = docxText({ ...chat, messages: [{ role: "assistant", blocks }] });
    // Inline mathematics: each price is prose, each expression is an equation.
    ensure(xml.includes("It costs $5 for "), "A price must stay prose in Word.");
    ensure(xml.includes("and $10 for the rest."), "The second price must survive.");
    ensure(!xml.includes("\\$"), "An escaped price must lose its backslash.");
    const inline = (xml.match(/<m:oMath>/g) || []).length;
    ensure(inline >= 4, `Adjacent and nested expressions must each compile, got ${inline}.`);
    ensure(xml.includes("<m:rad") || xml.includes("<m:f"), "A nested fraction must reach Word as a fraction.");
    // Display mathematics: its own equation paragraph.
    ensure(xml.includes("<m:oMathPara"), "A display formula must use an equation paragraph.");
    ensure(!/\\frac|\\sqrt|\\begin\{/.test(xml), "No raw TeX may reach Word.");
    // Ordinary text with special characters is escaped, never dropped.
    ensure(xml.includes("5 &lt; 6 &amp; 7 &gt; 4"), "Special characters must be escaped, not dropped.");
    ensure(xml.includes("snake_case") && xml.includes("a|b"), "Ordinary special text must survive.");
  });
  /* Page furniture is a separate part with its own relationship; a footer that
     is only referenced from the body is not a footer Word will show. */
  await check("Word carries page numbers, an optional header and section breaks", () => {
    const defaults = AIExporterDocx.parts(chat, {});
    const names = defaults.files.map((file) => file.name);
    ensure(names.includes("word/footer1.xml"), "Page numbers are on by default and need a footer part.");
    const footer = defaults.files.find((file) => file.name === "word/footer1.xml").text;
    ensure(/<w:instrText xml:space="preserve"> PAGE <\/w:instrText>/.test(footer), "The page number must be a PAGE field.");
    const body = defaults.files.find((file) => file.name === "word/document.xml").text;
    ensure(/<w:footerReference w:type="default" r:id="rIdFooter"\/>/.test(body), "The body must reference the footer.");
    const rels = defaults.files.find((file) => file.name === "word/_rels/document.xml.rels").text;
    ensure(rels.includes("footer1.xml"), "The footer must be a real relationship.");
    const types = defaults.files.find((file) => file.name === "[Content_Types].xml").text;
    ensure(types.includes("/word/footer1.xml"), "The footer needs a content type.");
    const configured = AIExporterDocx.parts(chat, {
      headerText: "AI Exporter", footerText: "Transcript", pageNumberPosition: "right", sectionBreaks: true
    });
    const configuredNames = configured.files.map((file) => file.name);
    ensure(configuredNames.includes("word/header1.xml"), "A header text must produce a header part.");
    ensure(configured.files.find((file) => file.name === "word/header1.xml").text.includes("AI Exporter"), "The header text must reach the header.");
    const rightFooter = configured.files.find((file) => file.name === "word/footer1.xml").text;
    ensure(/w:jc w:val="right"/.test(rightFooter), "The page number position must be honoured.");
    ensure(rightFooter.includes("Transcript"), "The footer text must reach the footer.");
    const sectioned = configured.files.find((file) => file.name === "word/document.xml").text;
    ensure((sectioned.match(/<w:sectPr>/g) || []).length >= 2, "Section breaks must add a section property per section.");
    const off = AIExporterDocx.parts(chat, { pageNumbers: false }).files.map((file) => file.name);
    ensure(!off.includes("word/footer1.xml"), "Turning page numbers off must remove the footer part.");
  });
  /* A wide display equation must wrap between terms, not shrink into
     illegibility and not run into the margin. */
  await check("A wide equation wraps between terms instead of being clipped", () => {
    const terms = Array.from({ length: 14 }, (_, index) => `a_{${index + 1}}`).join(" + ");
    const holder = document.createElement("div");
    holder.style.cssText = "width:320px;position:absolute;left:-9999px;top:0";
    const block = document.createElement("div");
    block.className = "math";
    block.style.fontSize = "20px";
    block.innerHTML = exporter.texToMathML(`${terms} = S`, true);
    holder.appendChild(block);
    document.body.appendChild(holder);
    try {
      const before = block.getBoundingClientRect().width;
      const stats = exporter.fitDisplayMathBlocks(holder);
      const math = block.firstElementChild;
      ensure(stats.wrapped >= 1, `The equation should wrap at top-level operators (wrapped=${stats.wrapped}).`);
      ensure(math.firstElementChild.localName === "mtable", "A wrapped equation becomes a table of lines.");
      const rows = [...math.querySelectorAll("mtr")];
      ensure(rows.length >= 2, "Wrapping must produce more than one line.");
      const widest = Math.max(...rows.map((row) => row.getBoundingClientRect().width));
      ensure(widest <= 322, `No wrapped line may leave the column (widest ${Math.round(widest)}, column 320, was ${Math.round(before)}).`);
      ensure(!block.dataset.mathOverflow, "A wrappable equation must not be marked as overflowing.");
    } finally {
      holder.remove();
    }
  });
  /* A long conversation becomes several page files rather than one poster
     squeezed until the canvas refuses it. */
  await check("A long PNG export is split into pages, not squeezed", async () => {
    const paragraphs = Array.from({ length: 90 }, (_, index) => ({
      type: "paragraph",
      text: `Paragraph ${index + 1}. ` + "A sentence long enough to take a line or two of the poster width. ".repeat(3)
    }));
    const long = { ...chat, messages: [{ role: "assistant", blocks: paragraphs }] };
    const rendered = await exporter.pngPagesFor(long, { theme: "light", includeImages: false });
    ensure(rendered.pages.length > 1, `A long document must paginate, got ${rendered.pages.length} page(s).`);
    ensure(rendered.pages.every((page) => page.blob.size > 2000), "Every page must contain a real bitmap.");
    const width = rendered.pages[0].width;
    ensure(rendered.pages.every((page) => page.width === width), "Pages share one width.");
    const tallest = Math.max(...rendered.pages.map((page) => page.height));
    ensure(tallest <= 16384, `A page must stay inside the canvas limit, tallest was ${tallest}.`);
    const total = rendered.pages.reduce((sum, page) => sum + page.height, 0);
    ensure(total > tallest, "The pages must cover the document between them.");
  });
  /* Regression: the inline-maths pattern used to accept a closing `$` that
     followed a space, so "costs $5 for $x$ units" typeset "5for" as a formula,
     swallowed the price and left a dangling "x$" in HTML, Word, Markdown and
     TXT. */
  await check("A price beside inline maths keeps both", () => {
    const prose = "It costs $5 for $x^2$ units, and $10 for the rest.";
    const one = { ...chat, messages: [{ role: "assistant", blocks: [{ type: "paragraph", text: prose }] }] };
    const html = exporter.documentHtml(one);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const maths = doc.querySelectorAll("math");
    ensure(maths.length === 1, `Only $x^2$ is mathematics, but ${maths.length} expressions were typeset.`);
    ensure(maths[0].querySelector("msup"), "The expression beside a price must still compile.");
    const shown = doc.body.textContent.replace(/\s+/g, " ");
    ensure(shown.includes("$5 for") && shown.includes("$10 for the rest"), "Prices must stay prose in the document.");
    ensure(!shown.includes("5for"), "The price must not be pulled into the formula.");
    const plain = exporter.textFor(one).replace(/\s+/g, " ");
    ensure(plain.includes("$5 for") && plain.includes("x^2"), `Plain text lost the sentence: ${plain}`);
    ensure(exporter.markdownFor(one).includes("$x^2$"), "Markdown must keep the expression delimited.");
    ensure(exporter.markdownFor(one).includes("$5 for"), "Markdown must keep the price as prose.");
    // The prose-only case must still stay prose.
    const currency = exporter.documentHtml({ ...chat, messages: [{ role: "assistant", blocks: [
      { type: "paragraph", text: "From $5 to $10 per seat." }
    ] }] });
    ensure(!currency.includes("<math"), "Two prices are not a formula.");
  });
  /* Regression: an escaped dollar printed its backslash in HTML, TXT and PNG. */
  await check("An escaped price prints as a price", () => {
    const prose = String.raw`Price \$5 and \$10, plus \$x.`;
    const one = { ...chat, messages: [{ role: "assistant", blocks: [{ type: "paragraph", text: prose }] }] };
    const html = exporter.documentHtml(one);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const shown = doc.body.textContent.replace(/\s+/g, " ");
    ensure(!shown.includes("\\$"), `The escape leaked into the document: ${shown}`);
    ensure(shown.includes("$5 and $10"), "Both prices must survive the escape.");
    const plain = exporter.textFor(one);
    ensure(!plain.includes("\\$"), "Plain text must not show the escape.");
    ensure(exporter.markdownFor(one).includes("$5") && !exporter.markdownFor(one).includes("\\$"), "Markdown must drop the escape.");
  });
  /* Regression: "$$ $$" carries no expression; marking it as a maths failure
     put a visible error badge into the page for nothing. */
  await check("An empty formula is dropped instead of reported as a failure", () => {
    const one = { ...chat, messages: [{ role: "assistant", blocks: [
      { type: "paragraph", text: "Before $$ $$ after." }
    ] }] };
    const html = exporter.documentHtml(one);
    ensure(!html.includes("data-tex-error"), "An empty formula is not a rendering failure.");
    ensure(!html.includes("<math"), "An empty formula must not become an empty equation.");
    const shown = new DOMParser().parseFromString(html, "text/html").body.textContent.replace(/\s+/g, " ");
    ensure(shown.includes("Before") && shown.includes("after"), "The surrounding prose must stay whole.");
  });
  /* The twelve expressions the release brief names, across every engine: one
     MathML structure each, one OMML structure each in Word, TeX intact in
     Markdown, and no command names in the plain-text fallback. */
  await check("The twelve required expressions compile in every engine", () => {
    const cases = [
      [String.raw`\frac{a}{b}`, "mfrac", "m:f"],
      [String.raw`\frac{1}{\frac{a}{b}}`, "mfrac", "m:f"],
      [String.raw`\sqrt{x+1}`, "msqrt", "m:rad"],
      [String.raw`\sqrt[3]{x}`, "mroot", "m:deg"],
      [String.raw`x^{n+1}`, "msup", "m:sSup"],
      [String.raw`a_{ij}`, "msub", "m:sSub"],
      [String.raw`\frac{x^2+1}{x-1}`, "mfrac", "m:f"],
      [String.raw`\sum_{i=1}^{n} i`, "munderover", "m:nary"],
      [String.raw`\int_0^1 x^2\,dx`, "msubsup", "m:nary"],
      [String.raw`\begin{bmatrix}a&b\\c&d\end{bmatrix}`, "mtable", "m:m"],
      [String.raw`a+H=\{a+h:h\in H\}`, "mo", "m:oMath"],
      [String.raw`\lim_{x\to 0}\frac{\sin x}{x}`, "munder", "m:limLow"]
    ];
    for (const [tex, mathmlTag, ommlTag] of cases) {
      const mathml = exporter.texToMathML(tex, true);
      ensure(mathml.includes(`<${mathmlTag}`), `${tex} must compile to ${mathmlTag}.`);
      ensure(!mathml.includes("\\"), `${tex} leaked TeX into MathML.`);
      const parsed = new DOMParser().parseFromString(mathml, "application/xml");
      ensure(!parsed.querySelector("parsererror"), `${tex} produced malformed MathML.`);
      const xml = docxText({ ...chat, messages: [{ role: "assistant", blocks: [{ type: "formula", tex }] }] });
      ensure(xml.includes(`<${ommlTag}`), `${tex} must reach Word as ${ommlTag}.`);
      const plain = exporter.texToPlain(tex);
      ensure(plain && !plain.includes("\\"), `${tex} must have a readable plain-text fallback, not TeX.`);
      ensure(exporter.markdownFor({ ...chat, messages: [{ role: "assistant", blocks: [{ type: "formula", tex }] }] }).includes(tex), `${tex} must survive Markdown unchanged.`);
    }
  });
  await check("Format metadata drives every advertised download", () => {
    ensure(Object.keys(exporter.FORMATS).join() === "pdf,docx,markdown,txt,json,html,image");
    for (const meta of Object.values(exporter.FORMATS)) {
      ensure(meta.label && meta.description && meta.pane && meta.action && meta.icon, "Every format needs a complete card/action record.");
    }
    ensure(exporter.FORMATS.docx.action === "Export Word", "Word must not advertise a fake .doc extension.");
    ensure(exporter.FORMATS.docx.extension === "docx", "Word must genuinely be DOCX.");
    ensure(exporter.FORMATS.docx.settings.theme === false, "Word has no document theme, so the theme choice must be disabled.");
    ensure(exporter.FORMATS.docx.settings.highlight === false, "Word code is plain text, so syntax colouring must be disabled.");
  });
  await check("A requested title page names the format it represents", () => {
    const docxDoc = exporter.documentHtml(chat, { format: "docx", includeCover: true });
    ensure(docxDoc.includes("Word (.docx)") && !docxDoc.includes("PDF (A4"), "The Word preview must not call itself a PDF.");
    const htmlDoc = exporter.documentHtml(chat, { format: "html", includeCover: true });
    ensure(htmlDoc.includes("HTML document"), "The HTML preview must name the HTML file.");
    ensure(exporter.documentHtml(chat, { format: "pdf", includeCover: true }).includes("PDF (A4, Portrait)"));
    const plain = exporter.documentHtml(chat, { format: "pdf" });
    ensure(!plain.includes("PDF (A4") && !plain.includes('class="sheet cover"'), "Without a title page, export metadata must not appear at all.");
  });
  await check("Word export is a real .docx package", () => {
    const packageParts = docx.parts(chat, { docMode: "color" });
    const names = packageParts.files.map((file) => file.name);
    for (const required of [
      "[Content_Types].xml", "_rels/.rels", "docProps/core.xml", "word/document.xml",
      "word/styles.xml", "word/numbering.xml", "word/_rels/document.xml.rels"
    ]) {
      ensure(names.includes(required), `Missing ${required}`);
    }
    ensure(packageParts.binary[0] === 0x50 && packageParts.binary[1] === 0x4b, "The package must start with the ZIP signature.");
  });
  await check("DOCX keeps code indentation, blank lines and real table rows", () => {
    const document = docxText();
    // Colour runs split a line into several <w:t> elements; indentation must
    // still arrive as preserved spaces at the start of its own line.
    ensure(/<w:t xml:space="preserve"> {4}<\/w:t>/.test(document), "Code indentation was lost.");
    const codeParagraphs = [...document.matchAll(/<w:p>(?:(?!<\/w:p>).)*?<w:pStyle w:val="Code"\/>(?:(?!<\/w:p>).)*<\/w:p>/g)].map((match) => match[0]);
    ensure(codeParagraphs.some((paragraph) => !paragraph.includes("<w:t")), "A blank source line was lost.");
    ensure(codeParagraphs.length >= 9, "Every source line must keep its own code paragraph.");
    ensure((document.match(/<w:tr>/g) || []).length >= 4, "The table must keep one row per source row.");
    ensure(document.includes("Long reference"));
  });
  await check("DOCX escapes page-provided text", () => {
    const document = docxText({ ...chat, messages: [
      { role: "user", blocks: [{ type: "paragraph", text: "Literal <img src=x onerror=alert(1)> text" }] }
    ] });
    ensure(!document.includes("<img"), "Page text must never become markup.");
    ensure(document.includes("&lt;img"));
  });
  await check("DOCX black-and-white mode drops the accent palette", () => {
    ensure(docxText(chat, { docMode: "color" }).includes('w:color w:val="2F4A63"'), "Colour Word keeps the document accent.");
    ensure(!docxText(chat, { docMode: "bw" }).includes("2F4A63"), "Black and white Word must drop the accent.");
    ensure(!docxText(chat, { docMode: "bw" }).includes('w:fill="F2F4F6"'), "Speaker labels must not be tinted in either mode.");
    const styles = docx.parts(chat, { docMode: "color" }).files.find((file) => file.name === "word/styles.xml").text;
    ensure(styles.includes('w:fill="F3F4F6"') && styles.includes('w:fill="F6F6F5"'), "Word code/output fills must use the shared palette.");
  });
  await check("Labelled notes become callouts in HTML and Word", () => {
    const sample = { ...chat, messages: [{ role: "assistant", blocks: [
      { type: "paragraph", text: "Note: indices start at zero." },
      { type: "paragraph", text: "Warning: this loop can overflow." },
      { type: "quote", text: "Key Takeaway: keep the bounds check." },
      { type: "paragraph", text: "Note that ordinary prose stays prose." }
    ] }] };
    const html = exporter.documentHtml(sample, { theme: "light" });
    const callouts = (html.match(/<aside class="callout/g) || []).length;
    ensure(callouts === 3, `Three labelled passages must become callouts (found ${callouts}).`);
    ensure(html.includes("callout--warning"), "A warning needs its own panel colour.");
    ensure(html.includes("Note that ordinary prose stays prose"), "Unlabelled prose must stay a paragraph.");

    const bytes = docx.build(sample, {});
    const documentEntry = zipEntries(bytes).find((entry) => entry.name === "word/document.xml");
    const xml = new TextDecoder().decode(entryBytes(bytes, documentEntry));
    ensure(xml.includes("Warning") && xml.includes("Key Takeaway"), "Word must keep the note labels.");
    ensure(!/w:fill="undefined"/.test(xml), "Word must never receive an undefined colour.");
  });

  await check("Parser keeps image captions, kind and intrinsic size", () => {
    const parsed = parse('<div data-message-author-role="assistant"><figure><img src="data:image/png;base64,AAAA" alt="Binary search flowchart" width="320" height="180"><figcaption>Figure 2: search order</figcaption></figure></div>');
    const block = parsed.messages[0].blocks.find((entry) => entry.type === "image");
    ensure(block, "The figure was not captured.");
    ensure(block.caption === "Figure 2: search order", "The figcaption was lost.");
    ensure(block.kind === "diagram", "A flowchart label should classify the visual as a diagram.");
  });
  await check("Image controls gate the rendered document", () => {
    const view = (options) => new DOMParser().parseFromString(exporter.documentHtml(chat, options), "text/html");
    const all = view({});
    ensure(all.querySelectorAll("figure.figure img").length === 1, "The embedded image should render by default.");
    ensure(all.querySelector(".figure--placeholder"), "The blocked remote image should be reported, not silently dropped.");
    ensure(all.querySelector("img").getAttribute("alt") === "Array traversal diagram");
    ensure(all.querySelector("figcaption").textContent === "Figure 1: traversal order across the array", "The caption should stay with its image without a duplicated number.");

    const off = view({ includeImages: false });
    ensure(!off.querySelector("img") && !off.querySelector(".figure"), "Turning images off must remove them completely.");

    const noDiagram = view({ includeDiagrams: false });
    ensure(!noDiagram.querySelector('img[src^="data:"]'), "The diagram toggle must drop diagram-like visuals.");

    const plainCaptions = view({ includeCaptions: false });
    ensure(plainCaptions.querySelector("figure img") && !plainCaptions.querySelector("figcaption"), "Captions should be optional.");

    const withSource = view({ includeImageSources: true });
    ensure(withSource.querySelector(".figure-source").textContent.includes("Embedded image"), "Image source attribution must be opt-in.");

    const plate = view({ keepImagePositions: false });
    const flows = [...plate.querySelectorAll(".flow")];
    ensure(!flows[0].querySelector("img, .figure--placeholder"), "Images must leave the transcript when positions are not preserved.");
    const figureFlow = flows.find((flow) => flow.textContent.includes("Figures"));
    ensure(figureFlow && figureFlow.querySelector("figure.figure img"), "A figures plate should collect displaced images.");

    const inline = view({ imageLayout: "inline" });
    ensure(inline.querySelector("figure.figure--inline"), "The chosen image layout must reach the document.");
  });
  await check("Markdown carries image alt text, captions and sources", () => {
    const md = exporter.markdownFor(chat, { includeImageSources: true });
    ensure(md.includes("![Array traversal diagram](<data:image/png;base64,"), "An embedded image must be portable Markdown.");
    ensure(md.includes("*Figure 1: traversal order across the array*"), "The caption should follow its image.");
    ensure(md.includes("Source: Embedded image"), "Attribution is opt-in but must appear when requested.");
    ensure(md.includes("[image not embedded: Remote image blocked"), "A blocked remote image must be labelled.");
    ensure(!exporter.markdownFor(chat, { includeImages: false }).includes("![Array traversal diagram]"));
  });
  await check("DOCX rejects data URIs whose bytes are not an image", () => {
    const page = {
      version: 1, title: "Broken image",
      messages: [{ role: "assistant", blocks: [
        { type: "image", src: "data:image/png;base64,AAAA", alt: "Broken bytes" }
      ] }]
    };
    const built = docx.parts(page, {});
    ensure(!built.files.some((file) => file.name.startsWith("word/media/")), "Corrupt bytes must not become a media part.");
    const body = built.files.find((file) => file.name === "word/document.xml").text;
    ensure(body.includes("Image not embedded") && body.includes("Broken bytes"), "The broken image must be reported, not hidden.");
  });
  await check("DOCX embeds inline images and can omit them", () => {
    const withImage = docx.parts(chat, {});
    const names = withImage.files.map((file) => file.name);
    ensure(names.some((name) => /^word\/media\/image1\.png$/.test(name)), "The inline image must become a media part.");
    const document = withImage.files.find((file) => file.name === "word\/document.xml").text;
    ensure(document.includes("<w:drawing>"), "Word must place the image in the document, not only the package.");
    ensure(document.includes("Figure 1: traversal order across the array"), "The caption must survive into Word.");
    ensure(document.includes('descr="Array traversal diagram"'), "Word must carry the image alt text.");
    ensure(document.includes("remote images are not downloaded"), "A remote image must be an honest placeholder.");

    const without = docx.parts(chat, { includeImages: false });
    ensure(!without.files.some((file) => file.name.startsWith("word/media/")), "Turning images off must not ship media parts.");
    const body = without.files.find((file) => file.name === "word/document.xml").text;
    ensure(!body.includes("<w:drawing>") && !body.includes("Image not embedded"), "No image or placeholder should remain.");
  });
  await check("DOCX can collect images on a figures plate", () => {
    const document = docxText(chat, { keepImagePositions: false });
    const plateAt = document.lastIndexOf("Figures");
    ensure(plateAt > 0, "The figures plate heading is missing.");
    ensure(document.indexOf("<w:drawing>") > plateAt, "The image should follow the plate heading, not the transcript.");
    ensure(document.indexOf("traversal order across the array") > plateAt, "The caption must travel with the image.");
    ensure(!docxText(chat, { includeCaptions: false }).includes("traversal order across the array"), "Captions must be optional in Word too.");
  });
  await check("Image analysis reports what the export can carry", () => {
    const pdf = exporter.analyzeImages(chat, {}, "pdf");
    ensure(pdf.total === 2 && pdf.embedded === 1 && pdf.blocked === 1, "The two sample images were miscounted.");
    ensure(/Enable 'Load remote images'/.test(pdf.message), "The blocked image needs an actionable message.");
    const allowed = exporter.analyzeImages(chat, { remoteImages: true }, "pdf");
    ensure(allowed.blocked === 0 && allowed.remote === 1, "Opting in should make the remote image exportable.");
    const word = exporter.analyzeImages(chat, { remoteImages: true }, "docx");
    ensure(word.blocked === 0 && word.remote === 1, "An opted-in remote image must be exportable to Word too.");
    const wordBlocked = exporter.analyzeImages(chat, {}, "docx");
    ensure(wordBlocked.blocked === 1 && /placeholders in Word/.test(wordBlocked.message), "Without opt-in, Word must say the remote image stays a placeholder.");
    ensure(exporter.analyzeImages(chat, { includeImages: false }, "pdf").message === "", "A deliberate choice is not a warning.");
  });
  await check("DOCX download bytes are a valid ZIP with matching CRCs", async () => {
    const result = await exporter.build(chat, "docx");
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const entries = zipEntries(bytes);
    ensure(entries.length >= 7, "The package is missing parts.");
    for (const entry of entries) {
      ensure(crc32Of(entryBytes(bytes, entry)) === entry.crc, `CRC mismatch for ${entry.name}.`);
    }
    const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
    ensure(documentEntry, "word/document.xml is missing.");
    const document = new DOMParser().parseFromString(
      new TextDecoder().decode(entryBytes(bytes, documentEntry)), "application/xml"
    );
    ensure(!document.querySelector("parsererror"), "document.xml is not well formed.");
    ensure(document.getElementsByTagName("w:tbl").length > 0, "The table must survive as XML.");
    ensure(document.getElementsByTagName("w:p").length > 10, "The document has too few paragraphs.");
  });
  await check("Standalone HTML export is a complete document", async () => {
    const result = await exporter.build(chat, "html");
    ensure(result.filename.endsWith(".html") && result.mime === "text/html");
    ensure(result.text.startsWith("<!doctype html>"), "HTML must be a full document.");
    ensure(result.text.includes("script-src 'none'"), "The exported HTML must keep its no-script policy.");
    ensure(!result.text.includes("PDF (A4") && !/Exported with AI Exporter/i.test(result.text), "The downloaded HTML must not label itself PDF or carry exporter branding.");
    ensure(result.text.includes("Array operations"), "The document must contain the conversation.");
    ensure(exporter.FORMAT_LABELS.html === "HTML");
  });
  await check("Word download is named .docx with the Word mime type", async () => {
    const result = await exporter.build(chat, "docx");
    ensure(result.filename.endsWith(".docx") && result.mime === docx.MIME);
    ensure(result.blob instanceof Blob && result.blob.size > 1000);
    ensure(exporter.FORMAT_LABELS.docx === "Word (.docx)");
  });
  await check("Selected content reaches Markdown, text and DOCX", () => {
    const sample = { ...chat, messages: chat.messages.slice(0, 2) };
    ensure(exporter.markdownFor(sample).includes("Array traversal"));
    ensure(exporter.textFor(sample).includes("Array traversal"));
    ensure(docxText(sample).includes("Array traversal"));
  });
  await check("Validation reports empty and duplicate messages", () => {
    const report = exporter.validateChat({ messages: [
      { id: "same", role: "assistant", text: "", blocks: [] },
      { id: "same", role: "assistant", text: "ok", blocks: [{ type: "paragraph", text: "ok" }] }
    ] });
    ensure(!report.ok);
    ensure(report.counts.empty === 1);
    ensure(report.issues.some((issue) => /duplicate/i.test(issue)));
  });
  await check("JSON export is versioned and complete", () => {
    const parsed = JSON.parse(exporter.jsonFor(chat));
    ensure(parsed.export.schemaVersion === 1);
    ensure(parsed.messages.length === chat.messages.length);
  });
  await check("Workspace cards use the shared format table", async () => {
    const frame = await controllerFrame();
    const cards = [...frame.contentDocument.querySelectorAll(".format-card")];
    ensure(cards.length === Object.keys(exporter.FORMATS).length, "The workspace must render every advertised format.");
    ensure(cards.map((card) => card.dataset.format).join() === Object.keys(exporter.FORMATS).join(), "Card order must follow the shared table.");
    ensure(cards.find((card) => card.dataset.format === "html").textContent.includes(exporter.FORMATS.html.description), "Cards must show the shared description.");
    frame.remove();
  });

  await check("Every page defines each element id once", async () => {
    for (const path of ["popup/popup.html", "export/export.html"]) {
      const response = await fetch(path);
      ensure(response.ok, `${path} could not be loaded.`);
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      const seen = new Set();
      const duplicates = [];
      for (const element of doc.querySelectorAll("[id]")) {
        if (seen.has(element.id)) duplicates.push(element.id);
        seen.add(element.id);
      }
      // A duplicate id silently binds a listener or a lookup to the other node.
      ensure(!duplicates.length, `${path} repeats the id(s): ${duplicates.join(", ")}.`);
    }
  });

  await check("Choose messages opens the message picker", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    ensure(controller.getElementById("view-messages").hidden, "The workspace starts on the export tab.");
    controller.getElementById("choose-messages").click();
    ensure(!controller.getElementById("view-messages").hidden, "Choose messages must open the picker.");
    ensure(controller.getElementById("view-export").hidden, "The export tab must step aside.");
    ensure(controller.getElementById("tab-messages").getAttribute("aria-selected") === "true", "The tab state must follow the panel.");
    frame.remove();
  });

  await check("Filename customization and format-aware controls work", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    const filename = controller.getElementById("filename");
    ensure(filename.disabled, "PDF print output cannot be renamed from here.");

    pick("markdown").checked = true;
    pick("markdown").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    ensure(!filename.disabled, "Markdown downloads should accept a custom filename.");
    ensure(controller.getElementById("highlight").disabled, "Markdown has no syntax colouring to toggle.");
    ensure(controller.getElementById("zoom-in").disabled, "Source previews have no page zoom.");

    pick("docx").checked = true;
    pick("docx").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    ensure(controller.getElementById("doc-mode").disabled === false, "Word keeps its own palette choice.");
    ensure(controller.getElementById("timestamps").disabled === false, "Word keeps timestamps.");
    ensure(controller.querySelector('input[name="theme"]').disabled, "Word cannot use a document theme.");
    ensure(controller.getElementById("highlight").disabled, "Word cannot colour code tokens.");
    ensure(controller.getElementById("zoom-in").disabled === false, "Word previews keep page zoom.");
    const mode = controller.getElementById("doc-mode");
    mode.value = "bw";
    mode.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 500));
    ensure(controller.getElementById("preview").contentDocument.documentElement.dataset.theme === "print", "The Word black-and-white palette must show in the preview.");
    mode.value = "color";
    mode.dispatchEvent(new Event("change"));

    pick("pdf").checked = true;
    pick("pdf").dispatchEvent(new Event("change"));
    ensure(controller.getElementById("zoom-in").disabled === false, "Document previews must keep zoom.");
    ensure(controller.getElementById("filename").disabled, "PDF print output stays automatic.");
    frame.remove();
  });

  await check("Export is locked while building and restores after failure", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    const primary = controller.getElementById("primary");
    const action = controller.getElementById("status-action");
    pick("markdown").checked = true;
    pick("markdown").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 200));

    frame.contentWindow.__downloadDelay = 350;
    primary.click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    ensure(pick("docx").disabled && primary.disabled, "Controls must be locked during an export.");
    ensure(!controller.getElementById("modal-progress").hidden, "A real export must show its progress state.");
    ensure(controller.querySelectorAll("#progress-stages li").length === 4, "Progress should name the real stages.");
    await new Promise((resolve) => setTimeout(resolve, 2200));
    ensure(!pick("docx").disabled && !primary.disabled, "Controls must be restored after a successful download.");
    ensure(!controller.getElementById("modal-success").hidden, "A generated file must show its success state.");
    ensure(controller.getElementById("modal-file").textContent.endsWith(".md"), "Success must name the real file.");
    ensure(controller.getElementById("modal-stats").textContent.includes("File size"), "Success should report the generated size.");
    controller.getElementById("modal-close").click();

    frame.contentWindow.__failNextDownload = true;
    primary.click();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    ensure(controller.getElementById("status").textContent.includes("Simulated download refusal"), "A failed export must surface the real error.");
    ensure(!action.hidden && action.textContent === "Try again", "A failed export must offer a recovery action.");
    ensure(!controller.getElementById("modal-error").hidden, "A failed export must explain itself in the error state.");
    ensure(controller.getElementById("modal-error-message").textContent.includes("Simulated download refusal"), "The error state must carry the real reason.");
    ensure(!primary.disabled && !pick("docx").disabled, "A failed export must restore every control.");
    controller.getElementById("modal-close").click();
    frame.remove();
  });

  await check("Download completion names the produced file", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    pick("markdown").checked = true;
    pick("markdown").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    controller.getElementById("filename").value = "Lecture notes";
    controller.getElementById("filename").dispatchEvent(new Event("input"));
    controller.getElementById("primary").click();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    ensure(frame.contentWindow.__lastDownload === "Lecture notes.md", "The custom filename must reach the browser download.");
    frame.contentWindow.__emitDownload({ id: 1, state: { current: "complete" } });
    ensure(controller.getElementById("status").textContent.includes("Export complete: Lecture notes.md"), "Completion must name the saved file.");
    ensure(!controller.getElementById("status-action").hidden, "Completion should expose the file location.");
    frame.remove();
  });

  await check("Saved settings reach the export controller", async () => {
    const frame = await controllerFrame("&settings=1");
    const controller = frame.contentDocument;
    ensure(controller.querySelector('input[name="theme"][value="dark"]').checked, "The saved theme was not applied.");
    ensure(controller.getElementById("timestamps").checked === true, "The saved timestamp setting was not applied.");
    ensure(controller.getElementById("highlight").checked === false, "The saved highlight setting was not applied.");
    ensure(controller.getElementById("doc-mode").value === "bw", "The saved Word mode was not applied.");
    ensure(
      controller.getElementById("preview").contentDocument.documentElement.dataset.theme === "dark",
      "The preview ignored the saved theme."
    );
    frame.remove();
  });
  await check("Format cards switch the preview and the primary action", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    const primary = controller.getElementById("primary");
    const source = controller.getElementById("source");

    pick("markdown").checked = true;
    pick("markdown").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 250));
    ensure(!source.hidden, "Markdown should show its real source.");
    ensure(source.textContent.includes("# Array operations"), "The Markdown preview must be the exported source.");
    ensure(primary.querySelector("span").textContent === "Export MD", "The primary action must name the format.");
    ensure(controller.getElementById("stage-inner").hidden, "The paged preview should be hidden for Markdown.");

    pick("docx").checked = true;
    pick("docx").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 500));
    ensure(!controller.getElementById("stage-inner").hidden, "Word should show the paged layout.");
    ensure(controller.getElementById("stage-note").textContent.includes(".docx"), "The Word preview must say what is downloaded.");
    primary.click();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    ensure(controller.getElementById("status").textContent.includes(".docx"), "The primary action must download Word.");
    frame.remove();
  });
  await check("Message search filters the picker without changing selection", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const search = controller.getElementById("pick-search");
    const rows = [...controller.querySelectorAll("#pick-list li")];
    search.value = "PRIVATE_SAMPLE_MARKER";
    search.dispatchEvent(new Event("input"));
    ensure(rows.filter((row) => !row.hidden).length === 1, "Only the matching message should stay visible.");
    ensure(controller.getElementById("pick-count").textContent === "all 3", "Searching must not change the selection.");
    ensure(controller.getElementById("pick-filter").textContent.includes("1 of 3"), "The filter must report its match count.");
    search.value = "zzz-no-such-message";
    search.dispatchEvent(new Event("input"));
    ensure(rows.every((row) => row.hidden), "A no-match search should hide every row.");
    ensure(!controller.getElementById("pick-empty").hidden, "A no-match search needs an empty-state message.");
    search.value = "";
    search.dispatchEvent(new Event("input"));
    ensure(rows.every((row) => !row.hidden), "Clearing the search should restore every message.");
    ensure(controller.getElementById("pick-empty").hidden, "The empty-state message should disappear with the search.");
    frame.remove();
  });
  await check("Images & visuals controls are format-aware and reach the preview", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    const include = controller.getElementById("include-images");
    ensure(include && include.checked, "The workspace must expose an include-images control, on by default.");
    ensure(controller.querySelectorAll(".advanced-body .adv-section h4").length >= 5, "Advanced settings should be grouped.");

    pick("markdown").checked = true;
    pick("markdown").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 250));
    ensure(!controller.getElementById("include-images").disabled, "Markdown can carry images.");
    ensure(controller.getElementById("keep-image-positions").disabled, "Markdown has no figure plate, so the position toggle must be off.");
    ensure(controller.getElementById("image-layout").disabled, "Markdown has no layout choice.");

    pick("txt").checked = true;
    pick("txt").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    ensure(controller.getElementById("include-images").disabled, "Plain text cannot carry images.");

    pick("pdf").checked = true;
    pick("pdf").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    const preview = controller.getElementById("preview").contentDocument;
    ensure(preview.querySelector("figure.figure img"), "The document preview should show the embedded image.");
    ensure(!controller.getElementById("image-notice").hidden, "The blocked remote image needs a visible notice.");

    include.checked = false;
    include.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    const after = controller.getElementById("preview").contentDocument;
    ensure(!after.querySelector("figure.figure img") && !after.querySelector("img"), "Turning images off must update the live preview.");
    ensure(controller.getElementById("pick-count").textContent === "all 3", "Changing visuals must not change the message selection.");
    frame.remove();
  });

  await check("Visual asset drawer lists real assets and exclusion reaches every format", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    controller.getElementById("manage-assets").click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    ensure(!controller.getElementById("asset-drawer").hidden, "Manage must open the visual asset drawer.");
    const items = [...controller.querySelectorAll("#asset-list .asset")];
    ensure(items.length === 2, `The drawer must list the two real visuals, not ${items.length}.`);
    ensure(items[0].textContent.includes("Array traversal diagram"), "The asset needs its real label.");
    ensure(items[0].textContent.includes("Diagram") && items[0].textContent.includes("360×220 px"), "The asset needs its real type and dimensions.");
    ensure(items[0].textContent.includes("Message 2") && items[0].textContent.includes("visual 1 of 2"), "The asset needs its original position.");
    ensure(items[1].textContent.includes("remote"), "A remote asset must say so instead of showing a fabricated thumbnail.");
    ensure(controller.getElementById("count-images").textContent === "1" && controller.getElementById("count-diagrams").textContent === "1", "Asset tiles must count real assets.");

    const boxes = [...controller.querySelectorAll("#asset-list .asset input")];
    ensure(boxes.length === 2 && boxes.every((box) => box.checked), "Every real asset should start included.");
    boxes[0].checked = false;
    boxes[0].dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    const preview = controller.getElementById("preview").contentDocument;
    ensure(!preview.querySelector('figure[id="asset-a1-10"]'), "Excluding a visual must remove it from the paged preview.");
    ensure(preview.querySelector('figure[id="asset-a1-11"]'), "The remote asset must stay in the document when it is not excluded.");

    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    pick("markdown").checked = true;
    pick("markdown").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 250));
    ensure(!controller.getElementById("source").textContent.includes("![Array traversal diagram]"), "An excluded visual must be absent from Markdown too.");

    controller.getElementById("assets-all").click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    ensure(controller.getElementById("source").textContent.includes("![Array traversal diagram]"), "Include all must restore the excluded visual.");
    controller.getElementById("close-assets").click();
    ensure(controller.getElementById("asset-drawer").hidden, "The drawer must close again.");
    frame.remove();
  });

  await check("Page geometry, typography and zoom controls reach the document", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    pick("pdf").checked = true;
    pick("pdf").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 500));

    const orientation = controller.getElementById("orientation");
    orientation.value = "landscape";
    orientation.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 500));
    ensure(controller.getElementById("advanced-summary").textContent.includes("Landscape"), "The advanced summary must reflect orientation.");
    const style = [...controller.getElementById("preview").contentDocument.querySelectorAll("style")].map((node) => node.textContent).join("\n");
    ensure(style.includes("--page-width: 297mm") && style.includes("--page-height: 210mm"), "Landscape must reach the generated page CSS.");

    const size = controller.getElementById("font-size");
    size.value = "large";
    size.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 500));
    const largeStyle = [...controller.getElementById("preview").contentDocument.querySelectorAll("style")].map((node) => node.textContent).join("\n");
    ensure(largeStyle.includes("--base-size: 12.5pt"), "Typography size must reach the generated page CSS.");
    ensure(controller.getElementById("page-est").textContent.includes("~" ) || controller.getElementById("page-est").textContent.includes("1 page"), "Page count must be labelled as an estimate, never exact.");

    const keep = controller.getElementById("keep-blocks");
    keep.value = "auto";
    keep.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 500));
    ensure(controller.getElementById("preview").contentDocument.documentElement.dataset.keep === "off", "Page-break behaviour must reach the document.");

    ensure(controller.getElementById("zoom-level").textContent === "65%", "The workspace should start at its fit-friendly zoom.");
    controller.getElementById("zoom-in").click();
    ensure(controller.getElementById("zoom-level").textContent === "75%", "Zoom in must change the real preview scale.");
    frame.remove();
  });

  await check("Empty selection disables export and offers a way back", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    controller.querySelector('[data-select="none"]').click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    ensure(controller.getElementById("pick-count").textContent === "0 of 3", "The count must reach zero.");
    ensure(controller.getElementById("primary").disabled, "Nothing selected must disable the export action.");
    ensure(controller.getElementById("status").textContent.includes("No messages selected"), "The empty selection needs a clear reason.");
    ensure(!controller.getElementById("status-action").hidden, "The empty selection must offer a recovery action.");
    controller.querySelector('[data-select="all"]').click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    ensure(!controller.getElementById("primary").disabled, "Selecting all must restore export.");
    frame.remove();
  });

  await check("Popup leads with scope and keeps every format reachable", async () => {
    const response = await fetch("popup/popup.html");
    ensure(response.ok, "The popup could not be loaded.");
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const primary = [...doc.querySelectorAll(".format-grid [data-format]")].map((button) => button.dataset.format);
    const more = [...doc.querySelectorAll(".more-formats [data-format]")].map((button) => button.dataset.format);
    ensure(primary.join() === "pdf,docx,markdown", "The three common formats belong on the main screen.");
    ensure(new Set([...primary, ...more]).size === 7, "Simplification must not remove a format.");
    ensure(more.join() === "html,txt,image,json", "The less common formats stay under More formats.");
    ensure(doc.querySelectorAll('input[name="scope"]').length === 2, "The export scope needs exactly two choices.");
    ensure(doc.querySelectorAll('input[name="theme"]').length === 3, "Light, Dark and Printable belong together.");
  });

  await check("Popup scope drives what the export request carries", async () => {
    const html = (await (await fetch("popup/popup.html")).text()).replace('<script src="popup.js"></script>', "");
    const script = await (await fetch("popup/popup.js")).text();
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;left:-4000px;top:0;width:360px;height:700px;";
    frame.srcdoc = html;
    document.body.append(frame);
    await new Promise((resolve) => frame.addEventListener("load", () => setTimeout(resolve, 60), { once: true }));

    const win = frame.contentWindow;
    const calls = [];
    win.chrome = {
      tabs: {
        async query() { return [{ id: 7, url: "https://chatgpt.com/c/sample" }]; },
        async sendMessage(tabId, message) {
          calls.push(message);
          if (message.type === "PING") return { ok: true, injected: true };
          if (message.type === "GET_PAGE_STATE") {
            return {
              ok: true,
              chat: {
                title: "Sample chat", platformLabel: "ChatGPT", messages: [
                  { id: "a", role: "user", blocks: [] },
                  { id: "b", role: "assistant", blocks: [] }
                ]
              },
              selection: { active: false, count: 0, selected: [] }
            };
          }
          if (message.type === "START_CUSTOM_SELECTION") return { ok: true, count: 2 };
          return { ok: true };
        }
      },
      storage: { local: { async get(defaults) { return defaults; }, async set() {} } },
      scripting: { async insertCSS() {}, async executeScript() {} },
      runtime: { id: "selftest-extension" }
    };
    win.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const doc = frame.contentDocument;
    ensure(doc.getElementById("conversation-name").textContent === "Sample chat", "The popup must name the detected conversation.");
    ensure(!doc.querySelector('[data-format="pdf"]').disabled, "A detected conversation must enable the formats.");
    ensure(doc.documentElement.scrollWidth <= 362, "The popup must not scroll sideways at its fixed 360px width.");

    ensure(doc.querySelector('[data-format="pdf"]').getAttribute("aria-pressed") === "true", "PDF is the default format.");

    doc.querySelector('[data-format="docx"]').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    ensure(doc.querySelector('[data-format="docx"]').getAttribute("aria-pressed") === "true", "Picking a format must mark it as chosen.");
    ensure(!calls.some((call) => call.type === "EXPORT"), "Choosing a format must not export before the user confirms.");

    doc.getElementById("primary-action").click();
    await new Promise((resolve) => setTimeout(resolve, 90));
    const first = calls.filter((call) => call.type === "EXPORT").pop();
    ensure(first && first.format === "docx" && first.onlySelected === false && first.review === false, "The primary action exports the whole conversation in the chosen format.");

    const selected = doc.getElementById("scope-selected");
    selected.checked = true;
    selected.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 80));
    ensure(!doc.getElementById("scope-actions").hidden, "The selected scope must offer the message review.");
    ensure(doc.getElementById("primary-label").textContent.includes("Review"), "The primary action must lead to the review list.");

    doc.getElementById("review-messages").click();
    await new Promise((resolve) => setTimeout(resolve, 90));
    const review = calls.filter((call) => call.type === "EXPORT").pop();
    ensure(review && review.review === true, "Review messages must open the studio on its message list.");
    frame.remove();
  });

  await check("Code copy is preview chrome, never part of the file", async () => {
    const frame = await controllerFrame();
    const preview = frame.contentDocument.getElementById("preview");
    const buttons = [...preview.contentDocument.querySelectorAll(".code-copy")];
    ensure(buttons.length >= 2, "Every code panel should offer a copy action in the preview.");
    ensure(/^Copy .+ to the clipboard$/.test(buttons[0].getAttribute("aria-label") || ""), "The copy button needs an accessible name.");
    ensure(buttons[0].type === "button", "The copy control must not submit anything.");
    ensure(!exporter.documentHtml(chat).includes("code-copy"), "The exported document must stay free of preview chrome and scripts.");
    frame.remove();
  });

  await check("Workspace chrome uses the jet-black editorial identity", async () => {
    const frame = await controllerFrame();
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    const root = win.getComputedStyle(doc.documentElement);
    const token = (name) => root.getPropertyValue(name).trim().toLowerCase();
    ensure(token("--black") === "#000000" && token("--charcoal") === "#171717", "The jet-black and charcoal anchors are missing.");
    ensure(token("--white") === "#ffffff" && token("--grey") === "#a6a6a6" && token("--pale") === "#ffe4d6", "The soft-white, grey and pale-orange anchors are missing.");
    ensure(token("--flame") === "#ff5100", `The signature accent must be flame orange (got ${token("--flame")}).`);
    ensure(token("--bg") === "#000000" && token("--surface-1") === "#0a0a0a", "The workspace must sit on black with charcoal surfaces.");
    ensure(token("--accent") === "#ff5100", `Primary actions must use flame orange (got ${token("--accent")}).`);
    ensure(token("--muted") === "#a6a6a6", `Secondary text must use the specified grey (got ${token("--muted")}).`);
    const appbar = win.getComputedStyle(doc.querySelector(".appbar"));
    ensure(appbar.backgroundColor === "rgb(0, 0, 0)", `The app bar must be jet black (got ${appbar.backgroundColor}).`);
    const link = win.getComputedStyle(doc.getElementById("choose-messages"));
    ensure(link.color === "rgb(255, 81, 0)", `Links must use flame orange (got ${link.color}).`);
    ensure(/archivo black/.test(token("--font-display")), "Display headings must use Archivo Black.");
    ensure(/space grotesk/.test(token("--font-heading")), "Interface headings must use Space Grotesk.");
    ensure(/inter/.test(token("--font-ui")) && /jetbrains mono/.test(token("--font-mono")), "UI and technical type must be Inter and JetBrains Mono.");
    ensure(/stix two math/.test(token("--font-math")), "Mathematical expressions must keep the STIX fallback.");
    const primaryStyle = win.getComputedStyle(doc.getElementById("primary"));
    ensure(primaryStyle.backgroundColor === "rgba(0, 0, 0, 0)" && primaryStyle.borderTopColor === "rgb(255, 81, 0)" && primaryStyle.color === "rgb(255, 81, 0)", "The primary action must be a flame outline on the black ground, not an orange block with black text.");
    frame.remove();
  });

  await check("A review request opens the studio on the message list", async () => {
    const frame = await controllerFrame("&tab=messages");
    const controller = frame.contentDocument;
    ensure(!controller.getElementById("view-messages").hidden, "The message list must be the first thing a review shows.");
    ensure(controller.getElementById("view-export").hidden, "The format panel must step aside until it is chosen.");
    frame.remove();
  });

  await check("Brand colours stay legible on their surfaces", async () => {
    const frame = await controllerFrame();
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    const rgb = (value) => (value.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const luminance = ([r, g, b]) => {
      const channel = (value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const contrast = (a, b) => {
      const [high, low] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
      return (high + 0.05) / (low + 0.05);
    };
    const onPanel = (element) => contrast(win.getComputedStyle(element).color, panelBackground);
    const body = win.getComputedStyle(doc.body).backgroundColor;
    const panelBackground = win.getComputedStyle(doc.querySelector(".panel")).backgroundColor;
    ensure(contrast(win.getComputedStyle(doc.querySelector(".brand-text h1")).color, win.getComputedStyle(doc.querySelector(".appbar")).backgroundColor) >= 4.5, "The app bar title must stay legible on black.");
    ensure(onPanel(doc.getElementById("doc-title")) >= 4.5, "The document title must stay legible on the dark panel.");
    ensure(onPanel(doc.getElementById("doc-meta")) >= 4.5, "Secondary metadata must stay legible.");
    ensure(onPanel(doc.getElementById("choose-messages")) >= 4.5, "Links must stay legible.");
    const primary = doc.getElementById("primary");
    const primaryStyle = win.getComputedStyle(primary);
    ensure(contrast(primaryStyle.color, primaryStyle.backgroundColor) >= 4.5, "The primary action label must stay legible on flame orange.");
    ensure(body === "rgb(0, 0, 0)", `The workspace must stay on jet black (got ${body}).`);
    frame.remove();
  });

  await check("Message list shows real content with User/AI labels in order", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const rows = [...controller.querySelectorAll("#pick-list .pick")];
    ensure(rows.length === 3, "Every turn in the conversation must be listed.");
    const roles = [...controller.querySelectorAll("#pick-list .role")].map((node) => node.textContent);
    ensure(roles.join() === "User,AI,User", `Every turn must be labelled User or AI (found ${roles.join()}).`);
    ensure(rows[0].textContent.includes("Explain an array traversal"), "The row must show the real message text.");
    const numbers = [...controller.querySelectorAll("#pick-list .pick-num")].map((node) => node.textContent);
    ensure(numbers.join() === "1,2,3", "Turns must keep their original order.");
    ensure(controller.querySelectorAll("#pick-list .pick-box").length === 3, "Every turn needs its own checkbox.");

    // Deselecting a turn must survive a format change: the selection belongs to
    // the conversation, not to the output format.
    const boxes = [...controller.querySelectorAll("#pick-list .pick-box")];
    boxes[1].checked = false;
    boxes[1].dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 250));
    ensure(controller.getElementById("pick-count").textContent === "2 of 3", "Unchecking must update the count.");
    const markdown = controller.querySelector('input[name="format"][value="markdown"]');
    markdown.checked = true;
    markdown.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 250));
    ensure(controller.getElementById("pick-count").textContent === "2 of 3", "Changing the format must not clear the selection.");
    frame.remove();
  });

  await check("Selection bar selects all, clears, and refuses an empty selection", async () => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;left:-4000px;top:0;width:900px;height:700px;";
    frame.srcdoc = `<!doctype html><html><head><title>Bulk selection sample</title></head><body><main>
      <div data-message-author-role="user">First prompt</div>
      <div data-message-author-role="assistant">First answer</div>
      <div data-message-author-role="user">Second prompt</div>
      <div data-message-author-role="assistant">Second answer</div>
    </main></body></html>`;
    document.body.append(frame);
    await new Promise((resolve) => {
      frame.addEventListener("load", () => setTimeout(resolve, 120), { once: true });
    });
    const win = frame.contentWindow;
    const listener = {};
    win.chrome = {
      runtime: { id: "selftest-extension", onMessage: { addListener(fn) { listener.fn = fn; } } },
      storage: { local: { async get(defaults) { return defaults; } } }
    };
    win.eval(await (await fetch("utils/parser.js")).text());
    win.eval(await (await fetch("content/content.js")).text());
    ensure(typeof listener.fn === "function", "The content script never registered its listener.");

    const call = (message) => {
      let reply = null;
      listener.fn(message, { id: "selftest-extension" }, (value) => { reply = value; });
      return reply;
    };
    const started = call({ type: "START_CUSTOM_SELECTION" });
    ensure(started && started.ok && started.count === 4, "Selection mode must see every message.");

    const doc = frame.contentDocument;
    ensure(doc.querySelectorAll(".aix-select").length === 4, "Every message needs a checkbox.");
    const [selectAll, clear] = [...doc.querySelectorAll(".aix-bar__bulk-button")];
    ensure(selectAll && clear, "The bar needs select-all and clear actions.");

    selectAll.click();
    ensure(doc.querySelectorAll(".aix-select__input:checked").length === 4, "Select all must tick every checkbox.");
    ensure(doc.querySelector(".aix-bar__count").textContent.includes("4"), "The count must follow the bulk action.");
    ensure(doc.querySelector(".aix-bar__go").textContent.includes("4"), "The export action must name the count.");

    clear.click();
    ensure(doc.querySelectorAll(".aix-select__input:checked").length === 0, "Clear must untick every checkbox.");
    ensure(doc.querySelector(".aix-bar__go").disabled, "Nothing selected must disable Export selected.");

    let refused = null;
    listener.fn({ type: "EXPORT", format: "markdown", onlySelected: true }, { id: "selftest-extension" }, (value) => { refused = value; });
    ensure(refused && refused.ok === false && /No messages are selected/.test(refused.error), "An empty selection must be reported, never replaced by the whole conversation.");

    const stopped = call({ type: "STOP_CUSTOM_SELECTION" });
    ensure(stopped && stopped.ok, "Selection mode must close.");
    ensure(!doc.querySelector(".aix-bar"), "Closing selection must remove the bar.");
    frame.remove();
  });

  await check("Tall PNG falls back to a smaller scale and says so", async () => {
    const tall = { ...chat, messages: [{ role: "assistant", blocks: [{ type: "code", language: "cpp", code: "    int value = 1;\n".repeat(1000) }] }] };
    const blob = await exporter.pngFor(tall);
    ensure(blob.type === "image/png" && blob.size > 100, "A tall selection should still produce a real PNG.");
    ensure(blob.exportScale < blob.requestedScale, "The reduced detail must be recorded on the blob.");
    ensure(blob.pixelHeight <= 16384 && blob.pixelWidth * blob.pixelHeight <= 16 * 1024 * 1024, "The fallback must stay inside the canvas limit.");
    const result = await exporter.build(tall, "image", {});
    ensure((result.warnings || []).some((item) => /Rendered at .*x .* instead of/.test(item.reason)), "The reduced scale must be reported, never silent.");
  });
  await check("PNG paginates a tall block instead of refusing it", async () => {
    const tall = { ...chat, messages: [{ role: "assistant", blocks: [
      { type: "code", language: "cpp", code: "    int value = 1;\n".repeat(400) },
      { type: "paragraph", text: "After the block." }
    ] }] };
    const rendered = await exporter.pngPagesFor(tall, { includeImages: false });
    ensure(rendered.pages.length >= 1, "A tall code block must still export.");
    ensure(rendered.pages.every((page) => page.blob.size > 2000), "Every page must carry a real bitmap.");
    ensure(rendered.pages.every((page) => page.height <= 16384), "No page may exceed the canvas limit.");
  });
  await check("PNG refuses an indivisible block taller than the canvas, with a reason", async () => {
    const huge = { ...chat, messages: [{ role: "assistant", blocks: [{ type: "code", language: "cpp", code: "    int value = 1;\n".repeat(6000) }] }] };
    let message = "";
    try { await exporter.pngFor(huge); } catch (error) { message = error.message; }
    ensure(/too large to rasterise/.test(message), `An impossible selection must fail with a real reason, got "${message}".`);
  });
  await check("Small PNG exports a real PNG blob with its real DPI", async () => {
    const blob = await exporter.pngFor({ ...chat, messages: [chat.messages[0]] });
    ensure(blob.type === "image/png" && blob.size > 100);
    ensure(blob.exportScale === 1.5, "Standard detail must rasterise at 1.5x.");
    // Walk the chunks to the pHYs record rather than trusting the encoder.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let at = 8;
    let phys = null;
    while (at + 12 <= bytes.length) {
      const length = view.getUint32(at);
      const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
      if (type === "pHYs") {
        phys = { x: view.getUint32(at + 8), y: view.getUint32(at + 12), unit: bytes[at + 16] };
        break;
      }
      at += 12 + length;
    }
    ensure(phys && phys.unit === 1, "A PNG must carry its physical resolution.");
    const expected = Math.round(144 / 0.0254);
    ensure(Math.abs(phys.x - expected) <= 2 && phys.x === phys.y, "1.5x detail must report 144 DPI.");
    ensure(bytes[12] === 0x49 && bytes[13] === 0x48, "The IHDR must remain the first chunk.");
  });
  await check("PNG poster draws embedded images", async () => {
    const imageBlock = chat.messages[1].blocks.find((block) => block.type === "image" && block.kind === "diagram");
    const sample = { ...chat, messages: [{ role: "assistant", blocks: [imageBlock] }] };
    const sizeOf = async (blob) => {
      const view = new DataView(await blob.arrayBuffer());
      return { width: view.getUint32(16), height: view.getUint32(20) };
    };
    const withImage = await sizeOf(await exporter.pngFor(sample));
    const without = await sizeOf(await exporter.pngFor(sample, { includeImages: false }));
    ensure(withImage.width === without.width, "The poster width must not depend on its images.");
    ensure(withImage.height > without.height + 200, "The embedded image should occupy its own area in the poster.");
  });

  /* --------------------------------------------------- document vs interface */

  await check("Documents use their own palette, never the interface brand", () => {
    const brand = ["#44174e", "#662249", "#a34054", "#ed9659", "#e9bcc9", "#1b1931", "#f7e6ec", "#fdf1f4"];
    for (const theme of ["light", "dark", "print"]) {
      const html = exporter.documentHtml(chat, { theme }).toLowerCase();
      for (const colour of brand) {
        ensure(!html.includes(colour), `The ${theme} document leaked the interface colour ${colour}.`);
      }
      ensure(!/--(plum|burgundy|rose|amber|blush|navy)\b/.test(html), `The ${theme} document referenced an interface token.`);
    }
    const light = exporter.documentHtml(chat, { theme: "light" });
    ensure(light.includes("--paper: #ffffff") && light.includes("--accent: #2f4a63"), "The document must own its paper and accent.");
    ensure(!light.includes("cover-art"), "The decorative cover artwork must not be part of a document.");
    ensure(!/class="sub"[^>]*>\s*<svg/.test(light), "Section headings must not carry a decorative icon.");
    const rules = [...new DOMParser().parseFromString(light, "text/html").querySelectorAll("style")]
      .map((style) => style.textContent).join("\n");
    ensure(!/\.sub \{[^}]*background: var\(--head-bg\)/.test(rules), "Section headings must not render as tinted bars.");
    ensure(/\.sub \{[^}]*border-bottom: 1px solid var\(--line\)/.test(rules), "Headings must be type hierarchy plus a hairline rule.");
    ensure(/\.figure \{[^}]*background: var\(--paper\)/.test(rules), "Images must not sit on a coloured plate.");
    ensure(!/nth-child\(even\)::before/.test(rules), "List bullets must not alternate interface colours.");
  });

  await check("Documents open on the conversation, without a cover or branding", () => {
    const doc = new DOMParser().parseFromString(exporter.documentHtml(chat), "text/html");
    ensure(!doc.querySelector(".cover"), "A title page must be opt-in.");
    ensure(doc.querySelector(".sheet.doc .doc-head .doc-title"), "The first page must open with the conversation title.");
    ensure(!doc.querySelector(".doc-runhead, .doc-runfoot"), "No running header or footer may repeat the metadata.");
    ensure(!/\bExported (with|via) AI Exporter\b/i.test(doc.body.textContent), "The document must carry no exporter branding.");
    ensure(doc.querySelector(".sheet.doc .turn"), "The first page must carry conversation content.");
    const meta = doc.querySelector(".doc-meta").textContent;
    ensure(meta.includes("message"), "One metadata line must summarise the source.");
    ensure(!/PDF \(|A4|Portrait|Landscape/i.test(meta), "Export format and page geometry are not document metadata.");
  });

  await check("An opt-in title page still renders before the content", () => {
    const doc = new DOMParser().parseFromString(exporter.documentHtml(chat, { includeCover: true }), "text/html");
    ensure(doc.querySelector(".sheet.cover"), "An explicit title page must render.");
    ensure(doc.querySelector(".sheet.cover + .sheet.doc"), "The title page must precede the conversation.");
  });

  await check("Display maths is document text, not a tinted panel", () => {
    const doc = new DOMParser().parseFromString(exporter.documentHtml(chat), "text/html");
    const rules = [...doc.querySelectorAll("style")].map((style) => style.textContent).join("\n");
    ensure(/\.math \{[^}]*background: transparent/.test(rules), "Ordinary equations must not sit in a grey container.");
    ensure(/\.math \{[^}]*padding: 0/.test(rules), "Equations must not carry panel padding.");
    ensure(/\.math \{[^}]*color: var\(--ink\)/.test(rules), "Equations must be set in body ink.");
    ensure(!/\.turn \{[^}]*border-bottom: 1px dashed/.test(rules), "Turns must be separated by space, not repeated rules.");
    ensure(/\.doc-title \{[^}]*color: var\(--head-ink\)/.test(rules), "The document title must use the heading colour.");
    ensure(exporter.THEMES.light.headInk === "#17324d", "Headings must be navy, body text charcoal.");
  });

  await check("Word opens on the conversation title and keeps equations plain", () => {
    const document = docxText();
    ensure(document.includes('<w:pStyle w:val="Title"/>'), "Word must start with the conversation title.");
    ensure(!document.includes('<w:br w:type="page"/>'), "No title page may be added by default.");
    const withCover = docx.parts(chat, { includeCover: true }).files.find((file) => file.name === "word/document.xml").text;
    ensure(withCover.includes('<w:br w:type="page"/>'), "An opt-in title page must still break before the transcript.");
    const styles = docx.parts(chat, {}).files.find((file) => file.name === "word/styles.xml").text;
    const at = styles.indexOf('w:styleId="Formula"');
    const formula = styles.slice(at, styles.indexOf("</w:style>", at));
    ensure(at > -1 && formula.length > 0, "The Word formula style must exist.");
    ensure(!/<w:shd/.test(formula), "Word equations must not be shaded.");
    ensure(/<w:color w:val="1F2328"/.test(formula), "Word equations must be set in body ink.");
    const roleAt = styles.indexOf('w:styleId="Role"');
    const role = styles.slice(roleAt, styles.indexOf("</w:style>", roleAt));
    ensure(!/<w:shd/.test(role), "Speaker labels must not be tinted bars.");
  });

  await check("The export palette and the interface palette are different systems", () => {
    ensure(exporter.THEMES.light.accent !== "#44174e", "The document accent must not be the interface plum.");
    ensure(exporter.THEMES.dark.paper !== "#1b1931", "The dark document must not use the interface navy as paper.");
    ensure(globalThis.AIDocumentTheme.themeFor("nope") === exporter.THEMES.light, "An unknown theme must fall back to light.");
    const word = globalThis.AIDocumentTheme.wordFor("bw");
    ensure(word.codeBg === "F3F4F6" && word.ink === "111827", "Word's black-and-white palette must come from the printable document.");
    const styles = docx.parts(chat, {}).files.find((file) => file.name === "word/styles.xml").text;
    ensure(!/44174E|662249|A34054|ED9659|E9BCC9|1B1931/i.test(styles), "Word styles must not carry the interface brand.");
    ensure(!/w:shd[^>]*F7E6EC/i.test(styles), "Word headings must not be shaded with the interface blush.");
  });

  await check("The chosen document theme controls the file, not the dashboard", () => {
    const dark = exporter.documentHtml(chat, { theme: "dark" });
    ensure(dark.includes('data-theme="dark"') && dark.includes("--paper: #17191d"), "The dark theme must apply to the document itself.");
    const print = exporter.documentHtml(chat, { theme: "print" });
    ensure(print.includes('data-theme="print"') && print.includes("--accent: #111827"), "Printable must collapse to ink.");
    const light = exporter.documentHtml(chat, { theme: "light" });
    ensure(light.includes('data-theme="light"'), "The light theme must be selected on the document element.");
    ensure(/html\[data-theme="dark"\] \{[^}]*--paper: #17191d/.test(light), "Every theme must stay scoped to its own attribute.");
  });

  /* -------------------------------------------------------------------- mcq */

  const mcqChat = (blocks) => ({ ...chat, title: "MCQ sample", messages: [{ id: "q", role: "assistant", blocks }] });

  await check("Line breaks in a question become one option per block", () => {
    const parsed = parse('<div data-message-author-role="assistant"><p>Q1. Which keyword declares a constant in Java?<br>A. static<br>B. final<br>C. const<br>D. let</p><p>Correct answer: B</p><p>Explanation: final refuses reassignment.</p></div>');
    const html = exporter.documentHtml({ ...chat, messages: parsed.messages });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const mcq = doc.querySelector(".mcq");
    ensure(mcq, "A stem with four lettered lines must render as one MCQ block.");
    ensure([...mcq.querySelectorAll(".mcq-letter")].map((node) => node.textContent).join() === "A.,B.,C.,D.", "Options must keep A-D order.");
    ensure([...mcq.querySelectorAll(".mcq-text")].map((node) => node.textContent).join() === "static,final,const,let", "Option text must survive verbatim.");
    ensure(mcq.querySelector(".mcq-answer").textContent === "Correct answer: B", "The answer must stay with its question.");
    ensure(mcq.querySelector(".mcq-explain").textContent === "Explanation: final refuses reassignment.", "The explanation must stay with its question.");
    ensure(!mcq.querySelector(".mcq-q").textContent.includes("A. static"), "The stem must not swallow the options.");
  });

  await check("A question written as a heading becomes one MCQ block", () => {
    const sample = mcqChat([
      { type: "heading", level: 3, text: "Q14. What is the purpose of the link register?" },
      { type: "paragraph", text: "A. Store the last cache tag." },
      { type: "paragraph", text: "B. Hold the current ALU result permanently." },
      { type: "paragraph", text: "C. Preserve the return address so execution can resume after the procedure." },
      { type: "paragraph", text: "D. Count the number of pipeline stalls." },
      { type: "paragraph", text: "Correct answer: C" },
      { type: "paragraph", text: "Explanation: the callee returns to the saved address." }
    ]);
    const doc = new DOMParser().parseFromString(exporter.documentHtml(sample), "text/html");
    const mcq = doc.querySelector(".mcq");
    ensure(mcq, "A heading stem with four option paragraphs must render as one MCQ block.");
    ensure([...mcq.querySelectorAll(".mcq-letter")].map((node) => node.textContent).join() === "A.,B.,C.,D.", "Options must keep A-D order.");
    ensure(mcq.querySelector(".mcq-answer").textContent === "Correct answer: C", "The answer must stay with its question.");
    ensure(!doc.querySelector("h3.sub"), "The question must not stay a separate heading that can break away from its options.");
  });

  await check("A formula wrapped over two lines is compiled, not printed as source", () => {
    const sample = mcqChat([
      { type: "paragraph", text: "Formula: $T=\\frac{IC \\times CPI}{f}$" },
      { type: "paragraph", text: "Substitution: $T=\\frac{800\\times10^6\\times2.5}{2\\times10^9}\n=\\boxed{1\\text{ s}}$" }
    ]);
    const html = exporter.documentHtml(sample);
    ensure(html.includes("<math"), "Wrapped TeX must reach the MathML compiler.");
    ensure(!html.includes("\\frac") && !html.includes("\\boxed"), "Raw TeX commands must never appear in the document.");
    ensure(!html.includes("$"), "Dollar delimiters must not survive into the document.");
  });

  await check("A turn read twice while the thread loads is one message", () => {
    /* A virtualised thread re-creates its elements as it scrolls, so the same
       turn is parsed again in a later batch. Identity must come from the site's
       turn key, not from the element, or the export repeats turns. */
    const markup = (n) => `<section data-testid="conversation-turn-${n}"><div class="markdown" data-message-author-role="${n % 2 ? "user" : "assistant"}"><p>turn ${n}</p></div></section>`;
    // The newest batch first: this is the thread read from the bottom upwards.
    const newest = parser.findMessages(
      new DOMParser().parseFromString(`<html><body>${markup(2)}${markup(3)}${markup(4)}</body></html>`, "text/html"),
      { hostname: "chatgpt.com", href: "https://chatgpt.com/c/x" }
    );
    const older = parser.findMessages(
      new DOMParser().parseFromString(`<html><body>${markup(1)}${markup(2)}${markup(3)}</body></html>`, "text/html"),
      { hostname: "chatgpt.com", href: "https://chatgpt.com/c/x" }
    );
    ensure(newest.length === 3 && older.length === 3, "Each batch must be read on its own.");
    const collected = parser.mergeEntries(newest.slice(), older, "start");
    ensure(collected.length === 4, `Four distinct turns expected, got ${collected.length}.`);
    const chat = parser.chatFrom(collected, new DOMParser().parseFromString("<html><body></body></html>", "text/html"), { hostname: "chatgpt.com", href: "https://chatgpt.com/c/x" });
    ensure(chat.messages.map((message) => message.text).join("|") === "turn 1|turn 2|turn 3|turn 4", `Turns must keep their order, got ${chat.messages.map((message) => message.text).join("|")}.`);
  });

  await check("Turns without a role marker still count as messages", () => {
    // Older turns on the same page carry no role attribute while the newest
    // ones do: every turn must still be detected, not just the marked ones.
    const legacy = [1, 2, 3, 4].map((n) =>
      `<section data-testid="conversation-turn-${n}"><div class="markdown"><p>legacy ${n}</p></div></section>`
    ).join("");
    const marked = [5, 6].map((n) =>
      `<div data-content-search-unit-key="thread:${n}:${n % 2 ? "user" : "assistant"}"><div class="markdown" data-message-author-role="${n % 2 ? "user" : "assistant"}"><p>new ${n}</p></div></div>`
    ).join("");
    const page = parse(`<html><body><main>${legacy}${marked}</main></body></html>`);
    ensure(page.messages.length === 6, `All six turns must be detected, got ${page.messages.length}.`);
    ensure(page.messages[0].text.includes("legacy 1"), "The oldest turn must be the first message.");
  });

  await check("A wrapper around several turns is not one message", () => {
    const turns = [1, 2, 3, 4].map((n) =>
      `<div><div class="markdown" data-message-author-role="${n % 2 ? "user" : "assistant"}"><p>wrapped ${n}</p></div></div>`
    ).join("");
    const page = parse(`<html><body><div data-turn-key="thread:1">${turns}</div></body></html>`);
    ensure(page.messages.length === 4, `The wrapper must not merge its turns, got ${page.messages.length}.`);
  });

  await check("Steps written on separate lines stay separate lines", () => {
    const steps = "2 \\times 1 = 2 \\\\ 2 + 2 = 4 \\\\ 4 + 2 = 6 \\\\ 6 + 2 = 8 \\equiv 0 \\pmod{8}";
    const sample = mcqChat([
      { type: "paragraph", text: "Step 1: Repeated addition" },
      { type: "formula", tex: steps },
      { type: "formula", tex: "2 \\times 1 = 2\n2 + 2 = 4" }
    ]);
    const html = exporter.documentHtml(sample);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const [first, second] = doc.querySelectorAll(".math");
    // A row break must become a row: four steps, four rows, never one long line.
    ensure(first && first.querySelectorAll("mtr").length === 4, "Each step must be its own row.");
    ensure(!first.querySelector("mspace[width='0.3em']"), "A row break must not degrade into a space.");
    ensure(second && second.querySelectorAll("mtr").length === 2, "A literal line break is a row break too.");
    const xml = docx.parts(sample, {}).files.find((file) => file.name === "word/document.xml").text;
    ensure(/<m:eqArr>/.test(xml), "Word must stack the steps as an equation array.");
    ensure(!/<m:m>/.test(xml), "A single-column stack must not become a Word matrix, whose rows are padded apart.");
  });

  await check("Inline options split only when the run is unambiguous", () => {
    const inline = mcqChat([{ type: "paragraph", text: "Q3. Which Greek letter comes third? A. alpha. B. beta. C. gamma. D. delta." }]);
    const doc = new DOMParser().parseFromString(exporter.documentHtml(inline), "text/html");
    ensure(doc.querySelector(".mcq"), "A stem plus three or more ascending options must group.");
    ensure([...doc.querySelectorAll(".mcq-text")].map((node) => node.textContent).join() === "alpha.,beta.,gamma.,delta.", "Inline options must split in order.");
    ensure(doc.querySelector(".mcq-q").textContent.trim() === "Q3. Which Greek letter comes third?", "The stem must keep its own text.");

    const prose = mcqChat([
      { type: "paragraph", text: "Option A is the answer, and C is wrong." },
      { type: "paragraph", text: "Use A. B. and C. as labels only." },
      { type: "paragraph", text: "Which one? A. only one. B. just two." }
    ]);
    ensure(!exporter.documentHtml(prose).includes('class="mcq"'), "Prose and two-option runs must stay prose.");
  });

  await check("A lettered list of options becomes an MCQ block", () => {
    const sample = mcqChat([
      { type: "paragraph", text: "Q4. Which of these is a primitive type?" },
      { type: "list", ordered: false, items: ["A. String", "B. int", "C. Integer", "D. Object"] }
    ]);
    const doc = new DOMParser().parseFromString(exporter.documentHtml(sample), "text/html");
    const mcq = doc.querySelector(".mcq");
    ensure(mcq && mcq.querySelectorAll(".mcq-opts li").length === 4, "A four-item lettered list must render as four option rows.");
    ensure(!doc.querySelector(".list"), "The original list markup must be replaced, not duplicated.");
  });

  await check("MCQ spacing, alignment and page-break rules are in the document", () => {
    const html = exporter.documentHtml(mcqChat([{ type: "paragraph", text: "Q1. Pick one? A. alpha. B. beta. C. gamma. D. delta." }]));
    const rules = [...new DOMParser().parseFromString(html, "text/html").querySelectorAll("style")]
      .map((style) => style.textContent).join("\n");
    for (const [token, value] of Object.entries({
      "--mcq-q": "8pt", "--mcq-opt": "5pt", "--mcq-a": "8pt", "--mcq-e": "6pt", "--mcq-after": "16pt"
    })) {
      ensure(rules.includes(`${token}: ${value}`), `${token} must be ${value}.`);
    }
    ensure(/\.mcq-opts li \{[^}]*grid-template-columns: 1\.9em 1fr/.test(rules), "Wrapped options must align with the option text.");
    ensure(/\.mcq-opts li \{[^}]*line-height: 1\.45/.test(rules), "Options must use 1.45 leading.");
    ensure(/\.mcq-q \{[^}]*break-after: avoid/.test(rules), "A question must stay with its first option.");
    ensure(/\.mcq \{[^}]*break-inside: avoid/.test(rules), "A short question must not split across pages.");
  });

  await check("MCQ layout reaches Markdown, text and Word", () => {
    const sample = mcqChat([{ type: "paragraph", text: "Q1. Pick one? A. alpha. B. beta. C. gamma. D. delta." }]);
    const md = exporter.markdownFor(sample);
    ensure(md.includes("A. alpha.\n\nB. beta."), "Markdown must put each option in its own paragraph.");
    const txt = exporter.textFor(sample);
    ensure(txt.includes("  A. alpha.") && txt.includes("  D. delta."), "Text must keep one option per line.");
    const xml = docx.parts(sample, {}).files.find((file) => file.name === "word/document.xml").text;
    ensure(/<w:ind[^>]*w:hanging="340"/.test(xml), "Word options need a hanging indent.");
    ensure((xml.match(/<w:p>/g) || []).length >= 5, "Word needs one paragraph per option.");
    for (const letter of ["A.", "B.", "C.", "D."]) ensure(xml.includes(letter), `Word lost option ${letter}.`);
  });

  /* ------------------------------------------------- math regression corpus */

  const mathCorpus = [
    "\\frac{a}{b}", "\\frac{1}{\\frac{a}{b}}", "\\sqrt{x+1}", "\\sqrt[3]{x}", "x^{n+1}", "a_{ij}",
    "\\frac{x^2+1}{x-1}", "\\sum_{i=1}^{n} i", "\\int_0^1 x^2\\,dx",
    "\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}", "a+H=\\{a+h:h\\in H\\}",
    "\\lim_{x\\to 0}\\frac{\\sin x}{x}", "\\sin x", "x % this is a comment"
  ];
  const mathChat = (items) => ({
    version: 1, title: "Math", messages: [{ role: "assistant", blocks: items.map((tex) => ({ type: "formula", tex })) }]
  });
  const mathSample = mathChat(mathCorpus);

  await check("The full TeX regression corpus compiles to structured MathML", () => {
    const html = exporter.documentHtml(mathSample);
    const doc = new DOMParser().parseFromString(html, "text/html");
    ensure(!/data-tex-error/.test(html), "No expression in the corpus may fall back to source.");
    ensure(!/\\[a-zA-Z]/.test(doc.body.textContent), "No TeX command may leak into the page.");
    ensure(!html.includes("this is a comment"), "A % comment must be stripped, not typeset.");
    const maths = [...doc.querySelectorAll(".math math")];
    ensure(maths.length === mathCorpus.length, `Every formula needs one <math> (found ${maths.length}).`);

    ensure(maths[0].querySelector("mfrac"), "\\frac must be an mfrac.");
    ensure(maths[1].querySelector("mfrac mfrac"), "A nested \\frac must stay nested.");
    ensure(maths[2].querySelector("msqrt"), "\\sqrt must be an msqrt.");
    const indexedRoot = maths[3].querySelector("mroot");
    ensure(indexedRoot && indexedRoot.children[1].textContent.trim() === "3", "\\sqrt[3] must keep its index.");
    ensure(maths[4].querySelector("msup mo") && maths[4].querySelector("msup").textContent.includes("+"), "x^{n+1} must keep the whole exponent.");
    ensure(maths[5].querySelector("msub") && maths[5].querySelector("msub").textContent.includes("ij"), "a_{ij} must keep both subscript letters.");
    ensure(maths[6].querySelectorAll("mfrac msup").length >= 1, "A fraction over a difference must keep the superscript.");
    ensure(maths[7].querySelector("munderover"), "A sum with both limits must be an munderover.");
    ensure(maths[8].querySelector("msubsup"), "An integral with both limits must be an msubsup.");
    const matrix = maths[9].querySelector("mtable");
    ensure(matrix && matrix.querySelectorAll("mtr").length === 2 && matrix.querySelectorAll("mtd").length === 4, "A bmatrix must keep 2x2 cells.");
    const fences = [...maths[9].querySelectorAll("mo")].filter((node) => node.hasAttribute("fence"));
    ensure(fences.length === 2 && fences[0].textContent === "[" && fences[1].textContent === "]", "A bmatrix must carry real bracket fences.");
    ensure(maths[10].textContent.includes("{") && maths[10].textContent.includes("}"), "Literal \\{ \\} must render as braces.");
    const limit = maths[11].querySelector("munder");
    ensure(limit && limit.querySelector("mtext").textContent === "lim", "\\lim must keep its under-script, not lose it.");
    ensure(limit.querySelector("mo").textContent.includes("\u2192"), "\\to must become an arrow.");
    const sinus = maths[12].querySelector("mtext");
    ensure(sinus && sinus.textContent === "sin", "\\sin must be upright text, not italic letters.");
    ensure(sinus.nextElementSibling && sinus.nextElementSibling.tagName.toLowerCase() === "mspace", "\\sin x needs a space before its argument.");
    ensure(maths[13].textContent.trim() === "x", "A comment must not become formula content.");
  });

  await check("TXT renders the same corpus as readable mathematics", () => {
    const txt = exporter.textFor(mathSample);
    for (const command of ["\\frac", "\\sqrt", "\\sum", "\\int", "\\begin", "\\end", "\\lim", "\\sin", "\\in", "\\to", "\\{"]) {
      ensure(!txt.includes(command), `Text export must not contain the command ${command}.`);
    }
    ensure(txt.includes("a/b"), "A simple fraction must read a/b.");
    ensure(txt.includes("1/(a/b)"), "A nested fraction must keep its grouping.");
    ensure(txt.includes("\u221a(x+1)") && txt.includes("\u221a[3](x)"), "Roots must read as roots.");
    ensure(txt.includes("x^(n+1)") && txt.includes("a_(ij)"), "Scripts must stay readable.");
    ensure(txt.includes("(x^2+1)/(x-1)"), "A compound fraction must keep its brackets.");
    ensure(txt.includes("\u2211_(i = 1)^(n) i"), "A sum must keep its limits.");
    ensure(txt.includes("\u222b_0^1 x^2 dx"), "An integral must keep its limits.");
    ensure(txt.includes("[a, b; c, d]"), "A matrix must read row by row.");
    ensure(txt.includes("a+H = {a+h:h \u2208 H}"), "Escaped set braces must survive as braces.");
    ensure(txt.includes("lim_(x \u2192 0)(sin x)/x"), "A limit must keep its subscript and the function spacing.");
    ensure(txt.includes("sin x"), "A function must not run into its argument.");
    ensure(!txt.includes("comment"), "A comment must not reach the text export.");
  });

  await check("TXT reduces inline TeX in prose, lists and tables too", () => {
    const page = {
      version: 1, title: "Inline mathematics",
      messages: [{ role: "assistant", blocks: [
        { type: "paragraph", text: "Starting from $\\frac{a}{b}$, $\\sqrt{x+1}$ and $a+H=\\{a+h:h\\in H\\}$." },
        { type: "list", ordered: false, items: ["First $\\frac{1}{\\frac{a}{b}}$", "Then $x^{n+1}$"] },
        { type: "table", head: ["Term"], rows: [["$a_{ij}$"]] }
      ] }]
    };
    const txt = exporter.textFor(page);
    for (const command of ["\\frac", "\\sqrt", "\\in", "\\{"]) {
      ensure(!txt.includes(command), `Inline prose must not leak ${command}.`);
    }
    ensure(txt.includes("Starting from a/b, \u221a(x+1) and a+H = {a+h:h \u2208 H}."), "Math inside a sentence must read as words.");
    ensure(txt.includes("First 1/(a/b)") && txt.includes("Then x^(n+1)"), "List items must reduce math too.");
    ensure(txt.includes("a_(ij)"), "Table cells must reduce math too.");
  });

  /* --------------------------------------------------- structure regressions */

  const nestedListPage = parse(`<html><body><main><section data-testid="conversation-turn-1"><div data-message-author-role="assistant"><div class="markdown">
    <ul><li>Outer one<ul><li>Inner one</li><li>Inner two<ol><li>Deep</li></ol></li></ul></li><li>Outer two</li></ul>
    <table><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></table>
  </div></div></section></main></body></html>`);

  await check("Nested lists keep their depth and kind in every format", () => {
    const block = nestedListPage.messages[0].blocks.find((item) => item.type === "list");
    ensure(block && block.items.join("|") === "Outer one|Inner one|Inner two|Deep|Outer two", "Nested items must stay in reading order.");
    ensure(block.depths.join() === "0,1,1,2,0", "The parser must record each item's depth.");
    ensure(block.orders.join() === "false,false,false,true,false", "A nested <ol> must be recorded as ordered.");

    const doc = new DOMParser().parseFromString(exporter.documentHtml(nestedListPage), "text/html");
    ensure(doc.querySelectorAll("ul.list ul.list").length === 1, "The nested <ul> must be real markup.");
    ensure(doc.querySelectorAll("ul.list ol.list").length === 1, "The numbered sub-list must stay an <ol>.");
    ensure(doc.querySelectorAll(".list li").length === 5, "Every item must render exactly once.");

    const md = exporter.markdownFor(nestedListPage);
    ensure(md.includes("- Outer one\n  - Inner one\n  - Inner two\n    1. Deep\n- Outer two"), "Markdown must indent each level.");

    const txt = exporter.textFor(nestedListPage);
    ensure(txt.includes("  - Outer one") && txt.includes("    - Inner one") && txt.includes("      1. Deep"), "Text must indent each level.");

    const xml = docxText(nestedListPage);
    ensure(/<w:ilvl w:val="0"\/>/.test(xml) && /<w:ilvl w:val="1"\/>/.test(xml) && /<w:ilvl w:val="2"\/>/.test(xml), "Word must give each level its own ilvl.");
    ensure(/<w:numId w:val="2"\/>/.test(xml), "The nested ordered list needs its own numbering instance.");
  });

  await check("A table without header cells keeps every row as data", () => {
    const block = nestedListPage.messages[0].blocks.find((item) => item.type === "table");
    ensure(block && block.head.length === 0, "A <td>-only table must not invent a header.");
    ensure(block.rows.length === 2 && block.rows[0].join() === "A1,B1", "Both data rows must survive parsing.");
    const doc = new DOMParser().parseFromString(exporter.documentHtml(nestedListPage), "text/html");
    ensure(!doc.querySelector(".grid thead"), "HTML must not promote the first row to a header.");
    ensure(doc.querySelectorAll(".grid tbody tr").length === 2, "HTML must keep two body rows.");
    ensure(!/<w:tr>[\s\S]*?<w:tblHeader\/>/.test(docxText(nestedListPage)), "Word must not mark a data row as a repeating header.");
  });

  await check("Unknown block types keep their text instead of being dropped", () => {
    const unknown = { version: 1, title: "Unknown", messages: [{ role: "assistant", blocks: [
      { type: "footnote", text: "Keep this footnote text." },
      { type: "paragraph", text: "And this paragraph." }
    ] }] };
    ensure(exporter.documentHtml(unknown).includes("Keep this footnote text."), "HTML must keep an unknown block's text.");
    ensure(exporter.markdownFor(unknown).includes("Keep this footnote text."), "Markdown must keep an unknown block's text.");
    ensure(exporter.textFor(unknown).includes("Keep this footnote text."), "TXT must keep an unknown block's text.");
  });

  await check("DOCX converts inline $$ maths, colours tokens and strips invalid XML", () => {
    const sample = { version: 1, title: "Word details", messages: [{ role: "assistant", blocks: [
      { type: "paragraph", text: "Inline $$a^2+b^2=c^2$$ stays an equation." },
      { type: "code", language: "cpp", code: "int count = 42; // tally" },
      { type: "paragraph", text: "Invalid \uD800 and \uFFFF characters must not reach the package." }
    ] }] };
    const xml = docxText(sample);
    ensure(!xml.includes("$$"), "Inline dollar delimiters must not survive into Word.");
    ensure(/<m:oMath>/.test(xml) && xml.includes("Cambria Math"), "Inline $$ maths must arrive as OMML.");
    ensure(/<w:color w:val="8250DF"\/>/.test(xml), "A keyword run must carry the Word keyword colour.");
    ensure(/<w:color w:val="953800"\/>/.test(xml), "A number run must carry the Word number colour.");
    ensure(!/[\uD800\uFFFF]/.test(xml), "Lone surrogates and noncharacters must be stripped.");
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    ensure(!parsed.querySelector("parsererror"), "document.xml must remain well-formed XML.");
  });

  /* --------------------------------------------------------- controller UX */

  await check("Cancelling stops the build, cleans up and never downloads", async () => {
    const frame = await controllerFrame();
    const win = frame.contentWindow;
    const controller = frame.contentDocument;
    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    pick("markdown").checked = true;
    pick("markdown").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Make the build long enough to cancel deterministically.
    const original = win.AIExporter.build;
    win.AIExporter.build = async (...args) => {
      await new Promise((resolve) => win.setTimeout(resolve, 800));
      return original(...args);
    };
    const primary = controller.getElementById("primary");
    primary.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const cancel = controller.getElementById("modal-cancel");
    ensure(!controller.getElementById("modal-progress").hidden, "A build must show its progress card.");
    ensure(cancel && cancel.textContent === "Cancel export", "The progress card must offer a real cancel action.");
    cancel.click();
    await new Promise((resolve) => setTimeout(resolve, 1200));

    ensure(controller.getElementById("status").textContent.includes("Export cancelled"), "Cancellation must be reported as such.");
    ensure(controller.getElementById("modal-error").hidden, "Cancelling is not an export failure.");
    ensure(!controller.getElementById("modal-progress").hidden, "The progress card must show where the work stopped.");
    ensure(controller.querySelectorAll("#progress-stages li.is-cancelled").length === 1, "The stopped stage must be marked.");
    ensure(win.__lastDownload === undefined, "A cancelled export must never reach the download API.");
    ensure(!primary.disabled, "Controls must be restored after cancellation.");
    ensure(cancel.textContent === "Close", "The cancelled card must offer Close.");
    cancel.click();
    ensure(controller.getElementById("modal-scrim").hidden, "Close must dismiss the cancelled card.");
    frame.remove();
  });

  await check("Success appears only when Chrome confirms the download", async () => {
    const frame = await controllerFrame();
    const controller = frame.contentDocument;
    const pick = (format) => controller.querySelector(`input[name="format"][value="${format}"]`);
    pick("markdown").checked = true;
    pick("markdown").dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    frame.contentWindow.__completeDelay = 600;
    controller.getElementById("filename").value = "Confirmed notes";
    controller.getElementById("filename").dispatchEvent(new Event("input"));
    controller.getElementById("primary").click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    ensure(controller.getElementById("modal-success").hidden, "Success must not be claimed before the download completes.");
    ensure(controller.getElementById("status").textContent.includes("Download started"), "Acceptance must be reported as started, not complete.");
    await new Promise((resolve) => setTimeout(resolve, 700));
    ensure(!controller.getElementById("modal-success").hidden, "Chrome's completion event must produce the success card.");
    ensure(controller.getElementById("modal-file").textContent === "Confirmed notes.md", "Success must name the file Chrome saved.");
    ensure(controller.getElementById("status").textContent.includes("Export complete: Confirmed notes.md"), "Completion must replace the started status.");
    frame.remove();
  });

  const list = document.getElementById("results");
  for (const result of results) {
    const li = document.createElement("li");
    li.className = result.pass ? "pass" : "fail";
    li.textContent = `${result.pass ? "PASS" : "FAIL"}: ${result.name}${result.error ? ` — ${result.error}` : ""}`;
    list.append(li);
  }
  const failed = results.filter((result) => !result.pass).length;
  document.getElementById("summary").textContent = `${results.length - failed}/${results.length} checks passed.`;
  globalThis.AIExporterSelftest = { results, failed, complete: true };

  const sampleFrame = document.getElementById("document");
  const markdownView = document.getElementById("markdown-source");
  function show(mode) {
    const md = mode === "markdown";
    sampleFrame.hidden = md;
    markdownView.hidden = !md;
    if (md) markdownView.textContent = exporter.markdownFor(chat);
    else sampleFrame.srcdoc = exporter.documentHtml(chat, { theme: mode });
  }
  for (const mode of ["light", "dark", "print", "markdown"]) document.getElementById(mode).addEventListener("click", () => show(mode));
  async function download(format) {
    const result = await exporter.build(chat, format);
    const blob = result.blob || new Blob([result.text], { type: result.mime + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = result.filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  document.getElementById("download-docx").addEventListener("click", () => download("docx"));
  document.getElementById("download-md").addEventListener("click", () => download("markdown"));
  show("light");

  // Only this self-check page supplies a stub. Production files never fall back
  // to sample data or bypass extension APIs when chrome.storage is unavailable.
  document.getElementById("interactive").src = "selftest.html?controller=1&export=11111111-1111-4111-8111-111111111111";
})();
