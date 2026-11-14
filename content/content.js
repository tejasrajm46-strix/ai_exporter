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

  /* The popup can inject this file on demand into a tab that was already open
     when the extension loaded, so evaluating it twice has to be harmless:
     a second copy would answer every message twice and duplicate the selection
     state. */
  if (globalThis.__AIExporterContentLoaded) return;
  globalThis.__AIExporterContentLoaded = true;

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
    { value: "docx", label: "Word (.docx)" },
    { value: "image", label: "Image (.png)" },
    { value: "json", label: "JSON (.json)" },
    { value: "html", label: "HTML (.html)" }
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

  /* --------------------------------------------------------------- whole thread */

  /* Long conversations are virtualised: the site keeps only the turns around
     the viewport in the document, so "every message on the page" was really
     the two on screen. Walking the thread mounts the missing turns, each step
     is parsed and merged, and the reader's position is put back afterwards.

     A walk that runs out of steps before it runs out of thread is reported as
     incomplete; the export never presents a partial conversation as whole. */
  const THREAD_STEPS = 80;
  const THREAD_SETTLE_MS = 180;
  /* Three steps with nothing new means the thread is not going to mount more. */
  const THREAD_STALLS = 3;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** The element that actually scrolls the conversation, if it is not the page. */
  function scrollerFor(element) {
    for (let node = element && element.parentElement; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if (/(auto|scroll|overlay)/.test(overflow) && node.scrollHeight > node.clientHeight + 40) return node;
    }
    const page = document.scrollingElement;
    return page && page.scrollHeight > page.clientHeight + 40 ? page : null;
  }

  /* One walk, used for both directions. "earlier" climbs towards the start of
     the conversation, "later" drops towards its end; merging is positional, so
     the direction only decides where each parsed batch is spliced in. */
  async function walkThread(scroller, entries, direction) {
    const distance = Math.max(160, Math.round(scroller.clientHeight * 0.85));
    const atEdge = () => (direction === "earlier"
      ? scroller.scrollTop <= 0
      : scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1);
    let steps = 0;
    let stalls = 0;
    while (steps < THREAD_STEPS && !atEdge()) {
      const before = entries.length;
      const next = direction === "earlier"
        ? Math.max(0, scroller.scrollTop - distance)
        : Math.min(scroller.scrollHeight, scroller.scrollTop + distance);
      if (next === scroller.scrollTop) break; // nothing left in this direction
      scroller.scrollTop = next;
      await wait(THREAD_SETTLE_MS);
      parser.mergeEntries(entries, parser.findMessages(document, location), direction === "earlier" ? "start" : "end");
      steps += 1;
      if (entries.length !== before) {
        stalls = 0;
        continue;
      }
      /* A step that mounted nothing is not a failure yet: the site may still be
         fetching. Give it one more settle, and only three such steps in a row
         count as the end of the thread. */
      stalls += 1;
      if (atEdge() || stalls >= THREAD_STALLS) break;
    }
    return { steps, limitReached: steps >= THREAD_STEPS && !atEdge() };
  }

  /* The whole thread, as far as it can be mounted, plus an honest account of
     how far that was. `complete` is false only when the step budget ran out
     while the thread still had somewhere to scroll. */
  async function collectThread() {
    const entries = parser.findMessages(document, location);
    if (!entries.length) return { entries, complete: true, limitReached: false, steps: 0 };
    const scroller = scrollerFor(entries[entries.length - 1].element);
    if (!scroller) return { entries, complete: true, limitReached: false, steps: 0 };

    const original = scroller.scrollTop;
    /* The reader is usually at the bottom, so the turns that have not been read
       are above; somebody parked at the very top needs the newer turns instead. */
    const direction = original > 0 ? "earlier" : "later";
    let result = { steps: 0, limitReached: false };
    try {
      result = await walkThread(scroller, entries, direction);
    } finally {
      scroller.scrollTop = original;
    }
    return { entries, complete: !result.limitReached, limitReached: result.limitReached, steps: result.steps };
  }

  async function openExport(format, ids, view = "") {
    /* A whole-conversation export reads the thread as far as it can be
       mounted; a selection already names its own messages. */
    const collected = ids ? null : await collectThread();
    const chat = collected && collected.entries.length
      ? parser.chatFrom(collected.entries, document, location)
      : parser.parsePage(document, location, ids ? { only: ids } : undefined);
    /* How much of the thread this export actually saw travels with the chat, so
       the workspace can warn before anything is downloaded. */
    if (collected) {
      chat.coverage = {
        ...(chat.coverage || {}),
        complete: collected.complete,
        limitReached: collected.limitReached,
        steps: collected.steps,
        collected: chat.messages.length
      };
    }
    const unreadable = chat.coverage && chat.coverage.unreadable ? chat.coverage.unreadable : 0;
    if (!chat.messages.length) {
      showToast("Could not detect chat on this page. Please refresh and try again.", true);
      return { ok: false, error: "No conversation detected." };
    }

    const options = { ...(await exportOptions(format)), view: view === "messages" ? "messages" : "" };
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
    if (unreadable > 0) {
      showToast(
        `${unreadable} message${unreadable === 1 ? "" : "s"} could not be read from this page. Check the preview before exporting.`,
        true
      );
    }
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
    count.setAttribute("role", "status");
    count.setAttribute("aria-live", "polite");

    /* Bulk actions: ticking twenty messages one by one was the slowest part
       of exporting a selection, so both directions are one click away. */
    const bulk = document.createElement("span");
    bulk.className = "aix-bar__bulk";

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "aix-bar__bulk-button";
    allButton.textContent = "All";
    allButton.title = "Select every message";
    allButton.addEventListener("click", () => setAllSelected(true));

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "aix-bar__bulk-button";
    clearButton.textContent = "Clear";
    clearButton.title = "Clear the selection";
    clearButton.addEventListener("click", () => setAllSelected(false));

    bulk.append(allButton, clearButton);

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

    bar.append(count, bulk, select, exportButton, exitButton);
    document.body.appendChild(bar);

    bar.dataset.count = "0";
    state.bar = bar;
    updateBar();
    return bar;
  }

  /** Select or clear every message currently on the page. */
  function setAllSelected(selected) {
    for (const entry of state.entries) {
      if (selected) state.selected.add(entry.id);
      else state.selected.delete(entry.id);
      entry.element.classList.toggle("aix-host--selected", selected);
      const input = entry.element.querySelector(":scope > .aix-select .aix-select__input");
      if (input) input.checked = selected;
    }
    updateBar();
    showToast(selected ? `${state.selected.size} messages selected.` : "Selection cleared.");
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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only this extension's own pages and worker can address a content-script
    // listener, but this script runs inside an untrusted page, so the contract
    // is checked here as well instead of being taken on trust.
    if (!sender || sender.id !== chrome.runtime.id) return false;
    const type = message && message.type;

    // The popup uses this to find out whether it is talking to a live content
    // script before it decides to inject one.
    if (type === "PING") {
      sendResponse({ ok: true, injected: true });
      return false;
    }

    if (type === "GET_PAGE_STATE") {
      const chat = parser.parsePage(document, location);
      /* A page the parser cannot read is the one case worth explaining: these
         sites redesign their DOM without notice, so the popup is told which
         selectors missed instead of only "nothing parsed". */
      const diagnostics = chat.messages.length ? null : parser.diagnose(document, location);
      sendResponse({ ok: true, chat, diagnostics, selection: selectionState() });
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
      const format = typeof message.format === "string" ? message.format : null;
      if (message.onlySelected && !state.selected.size) {
        // Silently exporting the whole conversation would contradict the popup.
        sendResponse({ ok: false, error: "No messages are selected. Tick at least one message on the page, or choose Entire conversation." });
        return false;
      }
      const ids = state.selected.size ? [...state.selected] : null;
      // review=true opens the studio on its message list, where the real
      // message content can be read and chosen.
      const view = message.review === true && !ids ? "messages" : "";
      openExport(format, ids, view).then(sendResponse, () => sendResponse({ ok: false, error: "Export failed." }));
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
