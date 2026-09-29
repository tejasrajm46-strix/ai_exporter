/**
 * AI Exporter - export view controller.
 *
 * The popup, the in-page selection bar and the context menu all funnel here:
 * the background worker stashes the parsed chat in chrome.storage.session and
 * opens this tab. Everything below runs in one long-lived extension page, so
 * scrolling, theme switching and repeated downloads never race a closing popup.
 *
 * The document is always the full transcript. This page adds a second, finer
 * selection pass: the picker on the right ticks individual turns, and whatever
 * is ticked is what the preview, the print dialog and every download use.
 *
 * This page reads the chat once and then forgets the stashed copy, so no
 * conversation content is left in storage.
 */
(() => {
  "use strict";

  const exporter = globalThis.AIExporter;
  if (!exporter) return;

  const byId = (id) => document.getElementById(id);
  const preview = byId("preview");
  const stage = byId("stage");
  const stageInner = byId("stage-inner");
  const pickerList = byId("pick-list");
  const pickCount = byId("pick-count");
  const pageEst = byId("page-est");
  const sheetWidth = 794; // 210mm at 96dpi
  const sheetHeight = 1123; // 297mm at 96dpi

  const options = { theme: "light", docMode: "color", timestamps: false, highlight: true, format: null };

  let chat = null;
  const included = new Set(); // indexes of chat.messages that stay in the export
  let renderTimer = null;

  function setStatus(message, state = "") {
    const status = byId("status");
    status.classList.remove("is-error", "is-busy", "is-ok");
    if (state) status.classList.add(`is-${state}`);
    status.textContent = message;
  }

  function persistSettings() {
    const theme = options.theme === "dark" || options.theme === "print" ? options.theme : "light";
    chrome.storage.local
      .set({
        includeTimestamps: options.timestamps,
        preserveCodeHighlighting: options.highlight,
        docTheme: theme,
        docMode: options.docMode === "bw" ? "bw" : "color",
        darkPdf: theme === "dark"
      })
      .catch(() => {});
  }

  /* ------------------------------------------------------------------ preview */

  function chosenMessages() {
    return (chat.messages || []).filter((_message, index) => included.has(index));
  }

  function exportChat() {
    const messages = chosenMessages();
    return { ...chat, messages, messageCount: messages.length };
  }

  function resetStage() {
    if (stage.scrollTop) stage.scrollTop = 0;
  }

  function applyScale() {
    const scale = Number(byId("zoom").value) || 0.65;
    let height = sheetHeight;
    let pages = "";
    try {
      const doc = preview.contentDocument;
      if (doc && doc.documentElement) height = Math.max(sheetHeight, doc.documentElement.scrollHeight);
      const sheets = doc ? doc.querySelectorAll(".sheet") : [];
      if (sheets.length > 1) {
        const content = sheets[sheets.length - 1];
        pages = `about ${1 + Math.max(1, Math.ceil((content.offsetHeight - 8) / sheetHeight))} A4 pages`;
      } else if (sheets.length === 1) {
        pages = "1 A4 page";
      }
    } catch {
      height = sheetHeight; // the iframe documents are still not readable yet
    }
    preview.style.height = `${height}px`;
    preview.style.transform = `scale(${scale})`;
    stageInner.style.width = `${Math.round(sheetWidth * scale)}px`;
    stageInner.style.height = `${Math.round(height * scale)}px`;
    pageEst.textContent = pages;
  }

  function render(immediate = false) {
    if (!chat) return;
    clearTimeout(renderTimer);
    const paint = () => {
      preview.srcdoc = exporter.documentHtml(exportChat(), options);
    };
    if (immediate) paint();
    else renderTimer = setTimeout(paint, 140); // typing through checkboxes should not thrash the frame
  }

  // A freshly painted document should be shown from the top. The frame resize
  // makes the browser scroll the stage once more just after the load event, so
  // the reset runs twice: on the next frame, and again after that settles.
  preview.addEventListener("load", () => {
    applyScale();
    requestAnimationFrame(() => {
      resetStage();
      setTimeout(resetStage, 120);
    });
  });
  window.addEventListener("resize", applyScale);

  /* ------------------------------------------------------------------ picker */

  function snippetFor(message) {
    const text = String(message.text || "")
      .replace(/\s+/g, " ")
      .replace(/^#{1,6}\s+/, "")
      .replace(/[*`]/g, "")
      .trim();
    if (!text) return "(no text in this turn)";
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  }

  function tagsFor(message) {
    const blocks = message.blocks || [];
    const code = blocks.filter((block) => block.type === "code").length;
    const tables = blocks.filter((block) => block.type === "table").length;
    const images = blocks.filter((block) => block.type === "image").length;
    return [
      code ? `${code} code` : "",
      tables ? `${tables} table${tables === 1 ? "" : "s"}` : "",
      images ? `${images} image${images === 1 ? "" : "s"}` : ""
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function buildPicker() {
    pickerList.textContent = "";
    chat.messages.forEach((message, index) => {
      const row = document.createElement("li");
      const label = document.createElement("label");
      label.className = "pick";

      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "pick-box";
      box.dataset.index = String(index);
      box.checked = included.has(index);
      box.addEventListener("change", () => {
        if (box.checked) included.add(index);
        else included.delete(index);
        updateSelectionUi();
        render();
      });

      const head = document.createElement("span");
      head.className = "pick-head";
      const role = document.createElement("span");
      role.className = `pick-role pick-role--${message.role}`;
      role.textContent = message.role === "assistant" ? "AI" : message.role === "user" ? "You" : message.role;
      head.append(role);
      const tags = tagsFor(message);
      if (tags) {
        const tag = document.createElement("span");
        tag.className = "pick-tag";
        tag.textContent = tags;
        head.append(tag);
      }

      const text = document.createElement("span");
      text.className = "pick-text";
      text.textContent = snippetFor(message);

      label.append(box, head, text);
      row.append(label);
      pickerList.append(row);
    });
  }

  function updateSelectionUi() {
    const total = chat ? chat.messages.length : 0;
    const count = included.size;
    pickCount.textContent = count === total ? `all ${total}` : `${count} of ${total}`;
    pickCount.classList.toggle("chip--off", count === 0);
    for (const button of document.querySelectorAll("[data-format], #print, #open-doc")) {
      button.disabled = count === 0;
    }
    if (count === 0) setStatus("No messages selected. Tick at least one turn on the right to build the document.");
  }

  function bindPicker() {
    for (const button of document.querySelectorAll("[data-select]")) {
      button.addEventListener("click", () => {
        const wanted = button.dataset.select;
        included.clear();
        chat.messages.forEach((message, index) => {
          if (wanted === "all") included.add(index);
          else if (wanted === "assistant" && message.role === "assistant") included.add(index);
          else if (wanted === "user" && message.role === "user") included.add(index);
        });
        for (const box of pickerList.querySelectorAll("input")) {
          box.checked = included.has(Number(box.dataset.index));
        }
        updateSelectionUi();
        render(true);
        if (included.size) {
          setStatus(`${included.size} of ${chat.messages.length} messages selected.`, "ok");
        }
      });
    }
  }

  /* ---------------------------------------------------------------- downloads */

  function download(format) {
    if (!chat || !included.size) return;
    setStatus(`Preparing ${exporter.FORMAT_LABELS[format] || format}...`, "busy");
    exporter
      .build(exportChat(), format, options)
      .then((result) => {
        const blob = result.blob || new Blob([result.text], { type: `${result.mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        return new Promise((resolve, reject) => {
          chrome.downloads.download(
            { url, filename: result.filename, saveAs: false, conflictAction: "uniquify" },
            (downloadId) => {
              setTimeout(() => URL.revokeObjectURL(url), 30000);
              const error = chrome.runtime.lastError;
              if (error || downloadId === undefined) reject(new Error(error ? error.message : "Download failed."));
              else resolve(result.filename);
            }
          );
        });
      })
      .then((filename) => {
        persistSettings();
        setStatus(`Saved ${filename} to your Downloads folder.`, "ok");
      })
      .catch((error) => setStatus(error && error.message ? error.message : "Export failed.", "error"));
  }

  function printPdf() {
    if (!chat || !included.size) return;
    setStatus("Opening the print dialog - destination 'Save as PDF', and untick 'Headers and footers'.", "busy");
    try {
      preview.contentWindow.focus();
      preview.contentWindow.print();
    } catch {
      setStatus("This browser blocked the print dialog. Use 'Open in tab' and print from that page instead.", "error");
      return;
    }
    setTimeout(() => {
      // Chrome draws its own date/title/URL lines in the page margins and only
      // the user can turn them off, so say it here instead of shipping a
      // document with the extension URL stamped on every page.
      setStatus(
        options.theme === "dark"
          ? "Print dialog open. Destination 'Save as PDF', paper A4 - untick 'Headers and footers', and keep 'Background graphics' on for the dark theme."
          : options.theme === "print"
            ? "Print dialog open. Destination 'Save as PDF', paper A4 - untick 'Headers and footers'. The printable theme is built for black-and-white printing."
            : "Print dialog open. Destination 'Save as PDF', paper A4 - untick 'Headers and footers' to drop the browser's date and URL lines.",
        ""
      );
    }, 600);
  }

  function openDocument() {
    if (!chat || !included.size) return;
    const blob = new Blob([exporter.documentHtml(exportChat(), options)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url }).catch(() => setStatus("Could not open a new tab for the document.", "error"));
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setStatus("Document opened in a new tab - use Ctrl/Cmd+P there if the print dialog does not appear here.");
  }

  /* ------------------------------------------------------------------- wiring */

  function bind() {
    byId("theme").addEventListener("change", (event) => {
      options.theme = event.target.value;
      persistSettings();
      render(true);
    });

    byId("doc-mode").addEventListener("change", (event) => {
      // The Word mode only affects the DOC download, so the preview stays put.
      options.docMode = event.target.value === "bw" ? "bw" : "color";
      persistSettings();
      setStatus(
        options.docMode === "bw"
          ? "Word downloads will be black and white, for clean printing."
          : "Word downloads will be light and colourful.",
        "ok"
      );
    });

    byId("zoom").addEventListener("change", applyScale);

    byId("timestamps").addEventListener("change", (event) => {
      options.timestamps = event.target.checked;
      persistSettings();
      render(true);
    });

    byId("highlight").addEventListener("change", (event) => {
      options.highlight = event.target.checked;
      persistSettings();
      render(true);
    });

    byId("print").addEventListener("click", printPdf);
    byId("open-doc").addEventListener("click", openDocument);

    for (const button of document.querySelectorAll("[data-format]")) {
      button.addEventListener("click", () => download(button.dataset.format));
    }

    bindPicker();
  }

  function showEmpty(message) {
    document.body.classList.add("is-empty");
    byId("doc-title").textContent = "No conversation loaded";
    byId("doc-meta").textContent = "Waiting for an export";
    setStatus(message, "error");
  }

  async function init() {
    bind();
    let stored;
    try {
      stored = await chrome.storage.session.get(["pendingExport", "pendingExportOptions"]);
      await chrome.storage.session.remove(["pendingExport", "pendingExportOptions"]);
    } catch {
      stored = {};
    }

    chat = stored.pendingExport || null;
    if (stored.pendingExportOptions) Object.assign(options, stored.pendingExportOptions);

    if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
      showEmpty("No conversation was handed over. Start an export from the popup, the selection bar or the right-click menu.");
      return;
    }

    byId("theme").value = options.theme === "dark" ? "dark" : options.theme === "print" ? "print" : "light";
    byId("doc-mode").value = options.docMode === "bw" ? "bw" : "color";
    byId("timestamps").checked = Boolean(options.timestamps);
    byId("highlight").checked = options.highlight !== false;

    chat.messages.forEach((_message, index) => included.add(index));

    const count = chat.messages.length;
    document.title = `Export - ${chat.title || "AI conversation"}`;
    byId("doc-title").textContent = chat.title || "AI conversation";
    byId("doc-meta").textContent = `Full transcript - ${count} message${count === 1 ? "" : "s"} - ${
      chat.platformLabel || "unknown site"
    }${chat.model ? ` - ${chat.model}` : ""}`;

    buildPicker();
    updateSelectionUi();
    render(true);

    if (options.format && options.format !== "pdf") {
      setStatus(`Preview ready. Downloading ${exporter.FORMAT_LABELS[options.format] || options.format}...`);
      download(options.format);
    } else if (options.format === "pdf") {
      setStatus("Preview ready. Untick anything you do not want, then choose 'Save as PDF'.");
    } else {
      setStatus("Preview ready. Untick anything you do not want, then save as PDF or download another format.");
    }
  }

  init();
})();
