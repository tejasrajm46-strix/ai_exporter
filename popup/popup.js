/**
 * AI Exporter - popup controller.
 *
 * The popup detects the conversation, records three choices (what to export,
 * which format, which appearance) and hands the work to the export view. It
 * never parses or generates anything itself, so closing it cannot interrupt an
 * export.
 *
 * Message selection lives in the export view, where the real message content
 * can be shown; this screen only links to it. Whole-conversation export starts
 * here directly.
 */
(() => {
  "use strict";

  const SUPPORTED_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|deepseek\.com)\//i;

  const FORMAT_NAMES = {
    pdf: "PDF", markdown: "Markdown", txt: "text", docx: "Word (.docx)",
    image: "PNG", json: "JSON", html: "HTML"
  };

  const DEFAULT_SETTINGS = {
    includeTimestamps: false,
    preserveCodeHighlighting: true,
    includeImages: true,
    darkPdf: false,
    docTheme: "light",
    docMode: "color",
    exportFormat: "pdf"
  };

  const ui = {
    name: document.querySelector("#conversation-name"),
    meta: document.querySelector("#conversation-meta"),
    status: document.querySelector("#status-message"),
    indicator: document.querySelector("#site-indicator"),
    scopeRadios: [...document.querySelectorAll('input[name="scope"]')],
    scopeActions: document.querySelector("#scope-actions"),
    scopeSelectedNote: document.querySelector("#scope-selected-note"),
    scopeEntireNote: document.querySelector("#scope-entire-note"),
    reviewMessages: document.querySelector("#review-messages"),
    selectOnPage: document.querySelector("#select-on-page"),
    themeRadios: [...document.querySelectorAll('input[name="theme"]')],
    formatButtons: [...document.querySelectorAll("[data-format]")],
    timestamps: document.querySelector("#include-timestamps"),
    highlighting: document.querySelector("#code-highlighting"),
    includeImages: document.querySelector("#include-images"),
    docMode: document.querySelector("#doc-mode"),
    primary: document.querySelector("#primary-action"),
    primaryLabel: document.querySelector("#primary-label")
  };

  const state = {
    tabId: null,
    chat: null,
    scope: "entire",
    format: "pdf"
  };

  function setStatus(message, tone = "") {
    ui.status.textContent = message;
    ui.status.classList.toggle("is-error", tone === "error");
    ui.status.classList.toggle("is-success", tone === "success");
  }

  function setFormatsEnabled(enabled) {
    for (const button of ui.formatButtons) button.disabled = !enabled;
    ui.primary.disabled = !enabled;
  }

  /** One rendering of the scope, with the count stated once. */
  function renderScope() {
    const total = state.chat ? state.chat.messages.length : 0;
    for (const radio of ui.scopeRadios) {
      radio.checked = radio.value === state.scope;
      radio.disabled = radio.value === "selected" ? !state.chat : false;
    }
    const selectedScope = state.scope === "selected";
    ui.scopeActions.hidden = !selectedScope;
    ui.scopeEntireNote.textContent = total ? `Every message · ${total}` : "Every message on the page";
    ui.scopeSelectedNote.textContent = selectedScope
      ? "Review the messages in the export studio"
      : "Review the messages before exporting";
    ui.primaryLabel.textContent = selectedScope ? "Review & Export" : "Preview & Export";
  }

  function renderFormats() {
    for (const button of ui.formatButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.format === state.format));
    }
  }

  function renderChat() {
    if (!state.chat || !state.chat.messages.length) {
      setFormatsEnabled(false);
      renderScope();
      return;
    }
    ui.name.textContent = state.chat.title || "AI conversation";
    ui.name.title = ui.name.textContent;
    ui.meta.textContent = `${state.chat.messages.length} message${state.chat.messages.length === 1 ? "" : "s"} detected · ${
      state.chat.platformLabel || "unknown site"
    }${state.chat.model ? ` · ${state.chat.model}` : ""}`;
    setFormatsEnabled(true);
    renderScope();
    renderFormats();
    setStatus("Conversation detected. Pick a format, then preview it.", "success");
  }

  function applySettings(settings) {
    ui.timestamps.checked = Boolean(settings.includeTimestamps);
    ui.highlighting.checked = settings.preserveCodeHighlighting !== false;
    ui.includeImages.checked = settings.includeImages !== false;
    ui.docMode.value = settings.docMode === "bw" ? "bw" : "color";
    const theme = settings.docTheme === "dark" || settings.docTheme === "print"
      ? settings.docTheme
      : settings.darkPdf ? "dark" : "light";
    for (const radio of ui.themeRadios) radio.checked = radio.value === theme;
    if (Object.prototype.hasOwnProperty.call(FORMAT_NAMES, settings.exportFormat)) {
      state.format = settings.exportFormat;
    }
  }

  async function send(tabId, message) {
    return chrome.tabs.sendMessage(tabId, message);
  }

  /**
   * A tab that was already open when the extension was installed, reloaded or
   * updated has no content script in it, and chrome.tabs.sendMessage then fails
   * with "Could not establish connection". The manifest asks for the scripting
   * permission, so the popup injects the same two files on demand: the first
   * click on the toolbar icon works, instead of only telling the user to reload
   * the tab and try again.
   */
  async function ensureContentScript(tabId) {
    try {
      const response = await send(tabId, { type: "PING" });
      if (response && response.injected) return true;
    } catch {
      // nothing listening yet - inject below
    }
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["content/content.css"] });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["utils/parser.js", "content/content.js"]
      });
      const response = await send(tabId, { type: "PING" });
      return Boolean(response && response.injected);
    } catch {
      // pages outside the host permissions refuse injection, and that is fine
      return false;
    }
  }

  function showUnavailable(name, meta, message) {
    ui.name.textContent = name;
    ui.meta.textContent = meta;
    setStatus(message, "error");
    setFormatsEnabled(false);
    for (const radio of ui.scopeRadios) radio.disabled = true;
  }

  async function refresh() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined || !tab.url) {
      setStatus("No active tab found.", "error");
      return;
    }
    state.tabId = tab.id;

    if (!SUPPORTED_HOSTS.test(tab.url)) {
      ui.indicator.classList.remove("is-supported");
      showUnavailable(
        "Unsupported page",
        "ChatGPT, Claude, Gemini or DeepSeek required",
        "AI Exporter works on ChatGPT, Claude, Gemini and DeepSeek conversations."
      );
      return;
    }

    ui.indicator.classList.add("is-supported");
    applySettings(await chrome.storage.local.get(DEFAULT_SETTINGS));
    renderFormats();

    if (!(await ensureContentScript(tab.id))) {
      showUnavailable(
        "Page not ready",
        "Content script unavailable",
        "This page does not let AI Exporter run. Reload the tab and try again."
      );
      return;
    }

    try {
      const response = await send(tab.id, { type: "GET_PAGE_STATE" });
      if (!response || !response.ok || !response.chat || !response.chat.messages.length) {
        const diagnostics = response && response.diagnostics;
        showUnavailable(
          "No conversation detected",
          "Nothing parsed on this page",
          diagnostics
            ? `Could not read this conversation: ${diagnostics.matched} of ${diagnostics.tried.length} ` +
              `${diagnostics.platform} selectors matched. Refresh the tab and try again; if it stays like ` +
              `this, ${diagnostics.platform === "unknown" ? "this site" : diagnostics.platform} has changed its page layout.`
            : "Could not detect chat on this page. Please refresh and try again."
        );
        return;
      }
      state.chat = response.chat;
      renderChat();
    } catch {
      showUnavailable(
        "Page not ready",
        "Content script unavailable",
        "Could not reach the page. Refresh the tab and open AI Exporter again."
      );
    }
  }

  async function openExport({ format = state.format, view = "" } = {}) {
    if (!state.tabId || !state.chat) return;
    ui.primary.disabled = true;
    try {
      const response = await send(state.tabId, {
        type: "EXPORT",
        format,
        onlySelected: false,
        review: view === "messages"
      });
      if (!response || !response.ok) {
        setStatus((response && response.error) || "Export failed.", "error");
        return;
      }
      window.close();
    } catch {
      setStatus("Could not start the export. Refresh the tab and try again.", "error");
    } finally {
      ui.primary.disabled = false;
    }
  }

  function bindScope() {
    for (const radio of ui.scopeRadios) {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        state.scope = radio.value === "selected" ? "selected" : "entire";
        renderScope();
        setStatus(
          state.scope === "selected"
            ? "Review the messages in the export studio, then export from there."
            : "Exports will use the whole conversation.",
          state.scope === "selected" ? "" : "success"
        );
      });
    }
  }

  function bindSettings() {
    const save = (write) => chrome.storage.local.set(write).catch(() => setStatus("Could not save that setting.", "error"));

    for (const button of ui.formatButtons) {
      button.addEventListener("click", () => {
        state.format = button.dataset.format;
        renderFormats();
        setStatus(`${FORMAT_NAMES[state.format] || state.format} selected. Use ${ui.primaryLabel.textContent}.`);
        save({ exportFormat: state.format });
      });
    }

    ui.primary.addEventListener("click", () => {
      if (state.scope === "selected") {
        openExport({ view: "messages" });
        return;
      }
      openExport();
    });

    ui.reviewMessages.addEventListener("click", () => openExport({ view: "messages" }));

    // The on-page bar still exists for people who prefer ticking in situ.
    ui.selectOnPage.addEventListener("click", async () => {
      if (!state.tabId) return;
      ui.selectOnPage.disabled = true;
      try {
        const response = await send(state.tabId, { type: "START_CUSTOM_SELECTION" });
        if (!response || !response.ok) {
          setStatus((response && response.error) || "Could not start selection mode.", "error");
          return;
        }
        setStatus("Selection mode is on. Tick messages on the page, then use the bar at the bottom.");
        window.close();
      } catch {
        setStatus("Lost the connection to the page. Refresh the tab and try again.", "error");
      } finally {
        ui.selectOnPage.disabled = false;
      }
    });

    ui.timestamps.addEventListener("change", () => save({ includeTimestamps: ui.timestamps.checked }));
    ui.highlighting.addEventListener("change", () => save({ preserveCodeHighlighting: ui.highlighting.checked }));
    ui.includeImages.addEventListener("change", () => save({ includeImages: ui.includeImages.checked }));
    ui.docMode.addEventListener("change", () => save({ docMode: ui.docMode.value === "bw" ? "bw" : "color" }));
    for (const radio of ui.themeRadios) {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        // docTheme is the real setting; darkPdf stays in sync for older reads.
        save({ docTheme: radio.value, darkPdf: radio.value === "dark" });
      });
    }
  }

  bindScope();
  bindSettings();
  renderFormats();
  refresh().catch(() => setStatus("Could not read this tab.", "error"));
})();
