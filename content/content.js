/**
 * AI Exporter - content script.
 *
 * Responsibilities:
 *  - answer page-state / parse requests from the popup and service worker
 *  - inject the custom-selection checkboxes and the floating action bar
 *  - hand a parsed chat to the background worker, which opens the export view
 *
 * It never downloads and never writes chat content to storage: the export view
 * holds the parsed chat in a local variable for the life of its tab.
 */
(() => {
  "use strict";

  const parser = globalThis.AIExporterParser;
  if (!parser) return;

  const DEFAULT_SETTINGS = {
    includeTimestamps: false,
    preserveCodeHighlighting: true,
    docTheme: "light",
    docMode: "color",
    darkPdf: false
  };

  const FORMATS = [
    { value: "pdf", label: "PDF (print / save)" },
    { value: "markdown", label: "Markdown (.md)" },
    { value: "txt", label: "Text (.txt)" },
    { value: "docx", label: "Word (.doc)" },
    { value: "image", label: "Image (.png)" },
    { value: "json", label: "JSON (.json)" }
  ];

  const state = {
    active: false,
    entries: [],
    selected: new Set(),
    bar: null,
    toast: null,
    observer: null,
    resyncTimer: null,
    toggling: false
  };

  /* ------------------------------------------------------------------- utils */

  async function readSettings() {
    try {
      const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function exportOptions(format) {
    const settings = await readSettings();
    return {
      format: format || null,
      theme: settings.docTheme === "dark" || settings.docTheme === "print" ? settings.docTheme : settings.darkPdf ? "dark" : "light",
      docMode: settings.docMode === "bw" ? "bw" : "color",
      timestamps: Boolean(settings.includeTimestamps),
      highlight: settings.preserveCodeHighlighting !== false
    };
  }

  function showToast(message, isError = false) {
    if (!state.toast) {
      const toast = document.createElement("div");
      toast.className = "aix-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
      state.toast = toast;
    }
    state.toast.textContent = message;
    state.toast.classList.toggle("aix-toast--error", isError);
    state.toast.classList.add("aix-toast--visible");
    clearTimeout(state.toast.timer);
    state.toast.timer = setTimeout(() => state.toast.classList.remove("aix-toast--visible"), 4000);
  }

  async function openExport(format, ids) {
    const chat = parser.parsePage(document, location, ids ? { only: ids } : undefined);
    if (!chat.messages.length) {
      showToast("Could not detect chat on this page. Please refresh and try again.", true);
      return { ok: false, error: "No conversation detected." };
    }

    const options = await exportOptions(format);
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "OPEN_EXPORT_VIEW", chat, options });
    } catch {
      showToast("AI Exporter lost its connection. Reload the page and try again.", true);
      return { ok: false, error: "Extension connection lost." };
    }

    if (!response || !response.ok) {
      showToast((response && response.error) || "Could not open the export view.", true);
      return { ok: false, error: (response && response.error) || "Export view failed." };
    }

    if (format && format !== "pdf") showToast("Export view opened - your download is starting there.");
    else showToast("Export view opened. Use Save as PDF to download.");
    return { ok: true };
  }

  /* --------------------------------------------------------- selection mode */

  function buildCheckbox(entry, position) {
    const label = document.createElement("label");
    label.className = "aix-select";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "aix-select__input";
    input.checked = state.selected.has(entry.id);
    input.addEventListener("change", () => {
      if (input.checked) state.selected.add(entry.id);
      else state.selected.delete(entry.id);
      entry.element.classList.toggle("aix-host--selected", input.checked);
      updateBar();
    });

    const text = document.createElement("span");
    text.className = "aix-sr";
    text.textContent = `Select message ${position} (${entry.role})`;

    label.append(input, text);
    return label;
  }

  function attachEntries(entries) {
    entries.forEach((entry, position) => {
      const element = entry.element;
      element.classList.add("aix-host", "aix-host--selectable");
      if (state.selected.has(entry.id)) element.classList.add("aix-host--selected");
      if (element.querySelector(":scope > .aix-select")) return;
      element.insertBefore(buildCheckbox(entry, position + 1), element.firstChild);
    });
  }

  function ensureBar() {
    if (state.bar && state.bar.isConnected) return state.bar;

    const bar = document.createElement("div");
    bar.className = "aix-bar aix-bar--idle";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "AI Exporter message selection");

    const count = document.createElement("span");
    count.className = "aix-bar__count";
    count.setAttribute("aria-live", "polite");

    const select = document.createElement("select");
    select.className = "aix-bar__format";
    select.setAttribute("aria-label", "Export format");
    for (const format of FORMATS) {
      const option = document.createElement("option");
      option.value = format.value;
      option.textContent = format.label;
      select.appendChild(option);
    }

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "aix-bar__go";
    exportButton.textContent = "Export selected";
    exportButton.addEventListener("click", async () => {
      const ids = [...state.selected];
      if (!ids.length) return;
      exportButton.disabled = true;
      await openExport(select.value, ids);
      exportButton.disabled = false;
    });

    const exitButton = document.createElement("button");
    exitButton.type = "button";
    exitButton.className = "aix-bar__exit";
    exitButton.textContent = "Exit selection";
    exitButton.addEventListener("click", () => stopSelection());

    bar.append(count, select, exportButton, exitButton);
    document.body.appendChild(bar);

    bar.dataset.count = "0";
    state.bar = bar;
    updateBar();
    return bar;
  }

  function updateBar() {
    if (!state.bar) return;
    const total = state.selected.size;
    state.bar.classList.toggle("aix-bar--idle", total === 0);
    state.bar.querySelector(".aix-bar__count").textContent =
      total === 0 ? "Select messages to export" : `${total} message${total === 1 ? "" : "s"} selected`;
    const go = state.bar.querySelector(".aix-bar__go");
    go.textContent = total ? `Export ${total} selected` : "Export selected";
    go.disabled = total === 0;
    state.bar.querySelector(".aix-bar__format").disabled = total === 0;
  }

  function syncControls() {
    if (!state.active || state.toggling) return;
    state.toggling = true;
    try {
      const entries = parser.findMessages(document, location);
      const live = new Set(entries.map((entry) => entry.element));
      for (const entry of state.entries) {
        if (!live.has(entry.element)) state.selected.delete(entry.id);
      }
      state.entries = entries;
      attachEntries(entries);
      updateBar();
    } finally {
      state.toggling = false;
    }
  }

  function observe() {
    if (state.observer) return;
    state.observer = new MutationObserver((mutations) => {
      const onlyOurs = mutations.every((mutation) =>
        [...mutation.addedNodes].every(
          (node) => node.nodeType === 1 && (node.classList.contains("aix-select") || node.classList.contains("aix-bar"))
        ) || mutation.target === state.bar
      );
      if (onlyOurs) return;
      clearTimeout(state.resyncTimer);
      state.resyncTimer = setTimeout(syncControls, 400);
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function handleEscape(event) {
    if (event.key === "Escape") stopSelection();
  }

  function startSelection() {
    const entries = parser.findMessages(document, location);
    if (!entries.length) {
      return { ok: false, error: "Could not detect chat on this page. Please refresh and try again." };
    }
    if (!state.active) {
      state.active = true;
      state.selected = new Set();
      state.entries = entries;
      attachEntries(entries);
      ensureBar();
      observe();
      document.addEventListener("keydown", handleEscape, true);
    } else {
      syncControls();
    }
    ensureBar();
    updateBar();
    return { ok: true, count: state.entries.length, selected: state.selected.size };
  }

  function stopSelection({ silent = false } = {}) {
    const wasActive = state.active || Boolean(state.bar);
    state.active = false;
    state.selected = new Set();
    document.removeEventListener("keydown", handleEscape, true);
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    clearTimeout(state.resyncTimer);
    for (const element of document.querySelectorAll(".aix-select")) element.remove();
    for (const element of document.querySelectorAll(".aix-host")) {
      element.classList.remove("aix-host", "aix-host--selectable", "aix-host--selected");
    }
    if (state.bar) {
      state.bar.remove();
      state.bar = null;
    }
    state.entries = [];
    if (wasActive && !silent) showToast("Selection mode closed.");
    return { ok: true };
  }

  function selectionState() {
    return {
      active: state.active,
      count: state.entries.length,
      selected: [...state.selected]
    };
  }

  /* --------------------------------------------------------------- messaging */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = message && message.type;

    if (type === "GET_PAGE_STATE") {
      const chat = parser.parsePage(document, location);
      sendResponse({ ok: true, chat, selection: selectionState() });
      return false;
    }

    if (type === "START_CUSTOM_SELECTION") {
      sendResponse(startSelection());
      return false;
    }

    if (type === "STOP_CUSTOM_SELECTION") {
      sendResponse(stopSelection());
      return false;
    }

    if (type === "EXPORT") {
      const ids = message.onlySelected && state.selected.size ? [...state.selected] : null;
      const format = typeof message.format === "string" ? message.format : null;
      openExport(format, ids).then(sendResponse, () => sendResponse({ ok: false, error: "Export failed." }));
      return true;
    }

    if (type === "CONTEXT_EXPORT") {
      const format = typeof message.format === "string" ? message.format : "pdf";
      openExport(format, null).then(sendResponse, () => sendResponse({ ok: false, error: "Export failed." }));
      return true;
    }

    return false;
  });
})();
