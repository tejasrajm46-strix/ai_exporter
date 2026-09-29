/**
 * AI Exporter - popup controller.
 *
 * The popup only detects and asks; all parsing happens in the content script
 * and all file generation happens in the export view, so nothing here has to
 * survive the popup closing (which Chrome does as soon as the user clicks the
 * page).
 */
(() => {
  "use strict";

  const SUPPORTED_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|deepseek\.com)\//i;

  const DEFAULT_SETTINGS = {
    includeTimestamps: false,
    preserveCodeHighlighting: true,
    darkPdf: false
  };

  const settingControls = {
    includeTimestamps: document.querySelector("#include-timestamps"),
    preserveCodeHighlighting: document.querySelector("#code-highlighting"),
    darkPdf: document.querySelector("#dark-pdf")
  };

  const ui = {
    name: document.querySelector("#conversation-name"),
    meta: document.querySelector("#conversation-meta"),
    status: document.querySelector("#status-message"),
    indicator: document.querySelector("#site-indicator"),
    scope: document.querySelector("#scope-note"),
    selection: document.querySelector("#custom-export"),
    selectionIcon: document.querySelector("#custom-export-icon use"),
    selectionLabel: document.querySelector("#custom-export-label"),
    formatButtons: [...document.querySelectorAll(".format-button")]
  };

  const state = { tabId: null, chat: null, selection: { active: false, count: 0, selected: [] } };

  function setStatus(message, tone = "") {
    ui.status.textContent = message;
    ui.status.classList.toggle("is-error", tone === "error");
    ui.status.classList.toggle("is-success", tone === "success");
  }

  function setFormatsEnabled(enabled) {
    for (const button of ui.formatButtons) button.disabled = !enabled;
  }

  function renderSelection() {
    const { active, count, selected } = state.selection;
    const chosen = selected.length;
    const scope = selected.length ? `${selected.length} selected of ${count}` : "Whole conversation";

    ui.selection.disabled = !state.chat || !state.chat.messages.length;
    ui.selection.setAttribute("aria-pressed", String(active));
    ui.selectionIcon.setAttribute("href", active ? "#i-stop" : "#i-select");
    ui.selectionLabel.textContent = active ? "Exit selection mode" : "Select messages";
    ui.scope.textContent = active ? scope : "Whole conversation";
  }

  function renderChat() {
    if (!state.chat || !state.chat.messages.length) {
      setFormatsEnabled(false);
      renderSelection();
      return;
    }
    ui.name.textContent = state.chat.title || "AI conversation";
    ui.meta.textContent = `${state.chat.messages.length} message${state.chat.messages.length === 1 ? "" : "s"} - ${
      state.chat.platformLabel || "unknown site"
    }${state.chat.model ? ` - ${state.chat.model}` : ""}`;
    setFormatsEnabled(true);
    renderSelection();

    const selected = state.selection.selected.length;
    if (selected) setStatus(`${selected} messages selected. Exports will use your selection.`, "success");
    else if (state.selection.active) setStatus("Selection mode is on. Tick messages on the page, then use the bar at the bottom.");
    else setStatus("Conversation detected. Pick a format to export.", "success");
  }

  async function send(tabId, message) {
    return chrome.tabs.sendMessage(tabId, message);
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
      ui.name.textContent = "Unsupported page";
      ui.meta.textContent = "ChatGPT, Claude, Gemini or DeepSeek required";
      setStatus("AI Exporter works on ChatGPT, Claude, Gemini and DeepSeek conversations.", "error");
      setFormatsEnabled(false);
      ui.selection.disabled = true;
      return;
    }

    ui.indicator.classList.add("is-supported");
    const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
    for (const [key, control] of Object.entries(settingControls)) control.checked = Boolean(settings[key]);

    try {
      const response = await send(tab.id, { type: "GET_PAGE_STATE" });
      if (!response || !response.ok || !response.chat || !response.chat.messages.length) {
        ui.name.textContent = "No conversation detected";
        ui.meta.textContent = "Nothing parsed on this page";
        setStatus("Could not detect chat on this page. Please refresh and try again.", "error");
        setFormatsEnabled(false);
        ui.selection.disabled = true;
        return;
      }
      state.chat = response.chat;
      state.selection = response.selection || state.selection;
      renderChat();
    } catch {
      ui.name.textContent = "Page not ready";
      ui.meta.textContent = "Content script unavailable";
      setStatus("Could not reach the page. Refresh the tab and open AI Exporter again.", "error");
      setFormatsEnabled(false);
      ui.selection.disabled = true;
    }
  }

  function bindSettings() {
    for (const [key, control] of Object.entries(settingControls)) {
      control.addEventListener("change", () => {
        chrome.storage.local.set({ [key]: control.checked }).catch(() => setStatus("Could not save that setting.", "error"));
      });
    }
  }

  function bindSelection() {
    ui.selection.addEventListener("click", async () => {
      if (!state.tabId) return;
      const starting = !state.selection.active;
      ui.selection.disabled = true;
      try {
        const response = await send(state.tabId, {
          type: starting ? "START_CUSTOM_SELECTION" : "STOP_CUSTOM_SELECTION"
        });
        if (!response || !response.ok) {
          setStatus((response && response.error) || "Could not start selection mode.", "error");
          return;
        }
        state.selection = {
          active: starting,
          count: response.count || (state.chat ? state.chat.messages.length : 0),
          selected: []
        };
        if (starting) {
          setStatus("Selection mode is on. Tick messages on the page, then use the bar at the bottom.");
        } else {
          setStatus("Selection mode closed. Exports will use the whole conversation.", "success");
        }
        renderSelection();
      } catch {
        setStatus("Lost the connection to the page. Refresh the tab and try again.", "error");
      } finally {
        ui.selection.disabled = false;
      }
    });
  }

  function bindFormats() {
    for (const button of ui.formatButtons) {
      button.addEventListener("click", async () => {
        if (!state.tabId || !state.chat) return;
        const format = button.dataset.format;
        const useSelection = state.selection.active && state.selection.selected.length > 0;
        setStatus(`Preparing ${button.textContent.trim()} export...`);
        button.disabled = true;
        try {
          const response = await send(state.tabId, { type: "EXPORT", format, onlySelected: useSelection });
          if (!response || !response.ok) {
            setStatus((response && response.error) || "Export failed.", "error");
            return;
          }
          setStatus("Export view opened in a new tab.", "success");
          window.close();
        } catch {
          setStatus("Could not start the export. Refresh the tab and try again.", "error");
        } finally {
          button.disabled = false;
        }
      });
    }
  }

  bindSettings();
  bindSelection();
  bindFormats();
  refresh().catch(() => setStatus("Could not read this tab.", "error"));
})();
