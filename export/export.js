/**
 * AI Exporter Studio - workspace controller.
 *
 * The popup, the in-page selection bar and the context menu all funnel here:
 * the background worker stashes the parsed chat in chrome.storage.session and
 * opens this tab. Everything below runs in one long-lived extension page, so
 * scrolling, theme switching and repeated downloads never race a closing popup.
 *
 * The workspace shows the format that will be produced: a paged document for
 * PDF/Word/HTML, the real source for Markdown/Text/JSON, and the rendered
 * poster for PNG. One primary action exports exactly what the preview shows.
 *
 * This page reads the chat once and then forgets the stashed copy, so no
 * conversation content is left in storage.
 */
(() => {
  "use strict";

  const exporter = globalThis.AIExporter;
  if (!exporter) return;

  const byId = (id) => document.getElementById(id);
  const ui = {
    preview: byId("preview"),
    stage: byId("stage"),
    stageInner: byId("stage-inner"),
    stageScroll: byId("stage-scroll"),
    stageNote: byId("stage-note"),
    stageSub: byId("stage-sub"),
    sourceView: byId("source"),
    imageFigure: byId("image-preview"),
    imageView: byId("image"),
    imageNote: byId("image-note"),
    formatList: byId("format-list"),
    formatHint: byId("format-hint"),
    pickerList: byId("pick-list"),
    pickFilter: byId("pick-filter"),
    pickEmpty: byId("pick-empty"),
    pickCount: byId("pick-count"),
    pageEst: byId("page-est"),
    pageControls: byId("page-controls"),
    zoomControls: byId("zoom-controls"),
    zoomLevel: byId("zoom-level"),
    prevPage: byId("prev-page"),
    nextPage: byId("next-page"),
    zoomIn: byId("zoom-in"),
    zoomOut: byId("zoom-out"),
    fitWidth: byId("fit-width"),
    primary: byId("primary"),
    primaryLabel: byId("primary").querySelector("span"),
    openDoc: byId("open-doc"),
    statusAction: byId("status-action"),
    search: byId("pick-search"),
    themesGroup: document.querySelector(".themes"),
    wordPalette: byId("doc-mode"),
    filenameInput: byId("filename"),
    timestampsToggle: byId("timestamps"),
    highlightToggle: byId("highlight"),
    remoteToggle: byId("remote-images"),
    imageNotice: byId("image-notice"),
    coverageNote: byId("coverage-note"),
    includeImages: byId("include-images"),
    includeDiagrams: byId("include-diagrams"),
    keepImagePositions: byId("keep-image-positions"),
    includeCaptions: byId("include-captions"),
    includeImageSources: byId("include-image-sources"),
    imageLayout: byId("image-layout"),
    imageQuality: byId("image-quality"),
    qualityNote: byId("quality-note"),
    includeCover: byId("include-cover"),
    pageSize: byId("page-size"),
    orientation: byId("orientation"),
    margin: byId("margin"),
    keepBlocks: byId("keep-blocks"),
    bodyFont: byId("body-font"),
    monoFont: byId("mono-font"),
    fontSize: byId("font-size"),
    lineSpacing: byId("line-spacing"),
    paraSpacing: byId("para-spacing"),
    advancedSummary: byId("advanced-summary"),
    formatBadge: byId("format-badge"),
    themeBadge: byId("theme-badge"),
    visualBadge: byId("visual-badge"),
    countImages: byId("count-images"),
    countDiagrams: byId("count-diagrams"),
    countCharts: byId("count-charts"),
    scopeCount: byId("scope-count"),
    scopeVisuals: byId("scope-visuals"),
    visualSummary: byId("visual-summary"),
    moreFormatList: byId("more-format-list"),
    appSource: byId("app-source"),
    appScope: byId("app-scope"),
    sourceTitle: byId("source-title"),
    sourceMeta: byId("source-meta"),
    openSource: byId("open-source"),
    drawer: byId("asset-drawer"),
    drawerList: byId("asset-list"),
    drawerCount: byId("drawer-count"),
    drawerEmpty: byId("drawer-empty"),
    drawerScrim: byId("drawer-scrim"),
    assetsAll: byId("assets-all"),
    assetsNone: byId("assets-none"),
    modalScrim: byId("modal-scrim"),
    modalProgress: byId("modal-progress"),
    modalSuccess: byId("modal-success"),
    modalError: byId("modal-error"),
    modalInfo: byId("modal-info"),
    progressStages: byId("progress-stages"),
    modalFile: byId("modal-file"),
    modalStats: byId("modal-stats"),
    modalErrorMessage: byId("modal-error-message"),
    modalInfoMessage: byId("modal-info-message"),
    modalOpenFolder: byId("modal-open-folder"),
    cancelProgress: byId("modal-cancel"),
    empty: byId("empty")
  };

  const ZOOM_MIN = 0.35;
  const ZOOM_MAX = 1.6;
  const DEFAULT_ZOOM = 0.65;
  const MM_PER_INCH = 25.4;
  const PX_PER_INCH = 96;

  const DEFAULT_OPTIONS = {
    theme: "light", docMode: "color", timestamps: false, highlight: true, remoteImages: false,
    includeImages: true, includeDiagrams: true, keepImagePositions: true,
    includeCaptions: true, includeImageSources: false, imageLayout: "center", imageQuality: "standard",
    pageSize: "a4", orientation: "portrait", margin: "normal", keepBlocks: true,
    bodyFont: "sans", monoFont: "jetbrains", fontSize: "comfortable", lineHeight: "normal", paragraphSpacing: "normal",
    includeCover: false,
    format: null, filename: "", excludedAssets: []
  };

  /* Saved preferences. Asset opt-outs are deliberately not stored: their ids
     belong to one conversation and must never filter the next one. */
  const SETTING_DEFAULTS = {
    includeTimestamps: false, preserveCodeHighlighting: true, docTheme: "light", docMode: "color",
    includeImages: true, includeDiagrams: true, keepImagePositions: true,
    includeCaptions: true, includeImageSources: false, imageLayout: "center", imageQuality: "standard",
    pageSize: "a4", orientation: "portrait", margin: "normal", keepBlocks: true,
    includeCover: false,
    bodyFont: "sans", monoFont: "jetbrains", fontSize: "comfortable", lineHeight: "normal", paragraphSpacing: "normal"
  };

  const THEME_LABELS = { light: "Light", dark: "Dark", print: "Printable" };
  const KIND_LABELS = { image: "Image", diagram: "Diagram", chart: "Chart", infographic: "Infographic" };
  const FORMAT_META = {
    pdf: "Print dialog", docx: ".docx", markdown: ".md", txt: ".txt", json: ".json", html: ".html", image: ".png"
  };
  const PRIMARY_LABELS = {
    pdf: "Export PDF", docx: "Export Word", markdown: "Export MD", txt: "Export TXT",
    json: "Export JSON", html: "Export HTML", image: "Export PNG"
  };

  const FORMATS = exporter.FORMATS;
  const PRIMARY_FORMATS = new Set(["pdf", "docx", "markdown"]);
  const options = { ...DEFAULT_OPTIONS };
  const excludedAssets = new Set();
  const included = new Set(); // indexes of chat.messages that stay in the export
  let chat = null;
  let selectedFormat = "pdf";
  let zoom = DEFAULT_ZOOM;
  let renderTimer = null;
  let revision = 0;
  let renderedRevision = -1;
  let loadedRevision = -1;
  let busy = false;
  /* Cancellation is cooperative: the build itself cannot be interrupted, so the
     token is checked at every stage boundary and before anything is downloaded. */
  let cancelRequested = false;
  let noSelectionNotice = false;
  let auditNotice = "";
  let imageUrl = null;
  let imageTimer = null;
  let imageRevision = 0;
  let lastAttempt = null;
  let previewObserver = null;

  const svgIcon = (name, className = "icon") => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${name}`);
    svg.append(use);
    return svg;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  /** Saved preferences -> export options. One mapping, used by every entry point. */
  function optionsFromSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    return {
      timestamps: Boolean(source.includeTimestamps),
      highlight: source.preserveCodeHighlighting !== false,
      docMode: source.docMode === "bw" ? "bw" : "color",
      theme: source.docTheme === "dark" || source.docTheme === "print" ? source.docTheme : "light",
      includeImages: source.includeImages !== false,
      includeDiagrams: source.includeDiagrams !== false,
      keepImagePositions: source.keepImagePositions !== false,
      includeCaptions: source.includeCaptions !== false,
      includeImageSources: source.includeImageSources === true,
      imageLayout: ["inline", "center", "fit"].includes(source.imageLayout) ? source.imageLayout : "center",
      imageQuality: source.imageQuality === "high" ? "high" : "standard",
      pageSize: exporter.PAGE_SIZES[source.pageSize] ? source.pageSize : "a4",
      orientation: source.orientation === "landscape" ? "landscape" : "portrait",
      margin: exporter.PAGE_MARGINS[source.margin] ? source.margin : "normal",
      keepBlocks: source.keepBlocks !== false,
      includeCover: source.includeCover === true,
      bodyFont: exporter.BODY_FONTS[source.bodyFont] ? source.bodyFont : "sans",
      monoFont: exporter.MONO_FONTS[source.monoFont] ? source.monoFont : "jetbrains",
      fontSize: ["compact", "comfortable", "large"].includes(source.fontSize) ? source.fontSize : "comfortable",
      lineHeight: ["compact", "normal", "relaxed"].includes(source.lineHeight) ? source.lineHeight : "normal",
      paragraphSpacing: ["compact", "normal", "relaxed"].includes(source.paragraphSpacing) ? source.paragraphSpacing : "normal"
    };
  }

  /** Merge option sources in precedence order and drop anything not supported. */
  function normalizeOptions(...sources) {
    const merged = { ...DEFAULT_OPTIONS };
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      if (["light", "dark", "print"].includes(source.theme)) merged.theme = source.theme;
      if (["color", "bw"].includes(source.docMode)) merged.docMode = source.docMode;
      for (const key of ["timestamps", "highlight", "includeImages", "includeDiagrams", "keepImagePositions", "includeCaptions", "includeImageSources", "keepBlocks", "includeCover"]) {
        if (typeof source[key] === "boolean") merged[key] = source[key];
      }
      for (const key of ["format", "filename"]) {
        if (typeof source[key] === "string") merged[key] = source[key];
      }
      if (["inline", "center", "fit"].includes(source.imageLayout)) merged.imageLayout = source.imageLayout;
      if (["standard", "high"].includes(source.imageQuality)) merged.imageQuality = source.imageQuality;
      if (exporter.PAGE_SIZES[source.pageSize]) merged.pageSize = source.pageSize;
      if (["portrait", "landscape"].includes(source.orientation)) merged.orientation = source.orientation;
      if (exporter.PAGE_MARGINS[source.margin]) merged.margin = source.margin;
      if (exporter.BODY_FONTS[source.bodyFont]) merged.bodyFont = source.bodyFont;
      if (exporter.MONO_FONTS[source.monoFont]) merged.monoFont = source.monoFont;
      if (["compact", "comfortable", "large"].includes(source.fontSize)) merged.fontSize = source.fontSize;
      if (["compact", "normal", "relaxed"].includes(source.lineHeight)) merged.lineHeight = source.lineHeight;
      if (["compact", "normal", "relaxed"].includes(source.paragraphSpacing)) merged.paragraphSpacing = source.paragraphSpacing;
    }
    // Remote images are opt-in per preview, never a stored preference.
    merged.remoteImages = false;
    return merged;
  }

  /** Status line with an optional recovery action, so an error is never a dead end. */
  function setStatus(message, state = "", action = null) {
    const status = byId("status");
    status.classList.remove("is-error", "is-ok", "is-warn", "is-busy");
    if (state) status.classList.add(`is-${state}`);
    status.textContent = message;
    ui.statusAction.hidden = !action;
    ui.statusAction.textContent = action ? action.label : "";
    ui.statusAction.onclick = action ? () => action.run() : null;
  }

  /** Yield one task before a heavy build so the progress state is painted.
      MessageChannel, not setTimeout/rAF: a background tab throttles those to
      once a second, which would make every export stage look frozen. */
  function nextFrame() {
    return new Promise((resolve) => {
      if (typeof MessageChannel !== "function") {
        setTimeout(resolve, 0);
        return;
      }
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(0);
    });
  }

  function persistSettings() {
    chrome.storage.local
      .set({
        includeTimestamps: options.timestamps,
        preserveCodeHighlighting: options.highlight,
        docTheme: options.theme,
        docMode: options.docMode,
        darkPdf: options.theme === "dark",
        includeImages: options.includeImages,
        includeDiagrams: options.includeDiagrams,
        keepImagePositions: options.keepImagePositions,
        includeCaptions: options.includeCaptions,
        includeImageSources: options.includeImageSources,
        imageLayout: options.imageLayout,
        imageQuality: options.imageQuality,
        pageSize: options.pageSize,
        orientation: options.orientation,
        margin: options.margin,
        keepBlocks: options.keepBlocks,
        includeCover: options.includeCover,
        bodyFont: options.bodyFont,
        monoFont: options.monoFont,
        fontSize: options.fontSize,
        lineHeight: options.lineHeight,
        paragraphSpacing: options.paragraphSpacing
      })
      .catch(() => {});
  }

  function formatView(format = selectedFormat) {
    return FORMATS[format] || FORMATS.pdf;
  }

  function formatSettings(format = selectedFormat) {
    return formatView(format).settings || {};
  }

  /**
   * The options this exact file will be built with. The preview and the
   * download both read this object, so a control that a format cannot honour
   * (Word's themes, Markdown's syntax colour) cannot change one and not the
   * other.
   */
  function formatOptions(format = selectedFormat) {
    const settings = formatSettings(format);
    return {
      ...options,
      format,
      theme: settings.theme ? options.theme : options.docMode === "bw" ? "print" : "light",
      highlight: settings.highlight === true && options.highlight !== false,
      remoteImages: settings.remoteImages === true,
      excludedAssets: [...excludedAssets]
    };
  }

  function pageContext() {
    return exporter.pageOptions(options);
  }

  function pageWidthPx() {
    return (pageContext().width / MM_PER_INCH) * PX_PER_INCH;
  }

  function pageHeightPx() {
    return (pageContext().height / MM_PER_INCH) * PX_PER_INCH;
  }

  /* ------------------------------------------------------------------- assets */

  /** Stable ids for this conversation only. They never leave the session. */
  function tagAssets() {
    if (!chat) return;
    chat.messages.forEach((message, messageIndex) => {
      (message.blocks || []).forEach((block, blockIndex) => {
        if (block && block.type === "image") block.assetId = `a${messageIndex}-${blockIndex}`;
      });
    });
  }

  function assetsForSelectedMessages() {
    if (!chat) return [];
    const list = [];
    chat.messages.forEach((message, messageIndex) => {
      if (!included.has(messageIndex)) return;
      const blocks = message.blocks || [];
      const images = blocks.filter((block) => block && block.type === "image");
      images.forEach((block) => {
        list.push({
          id: block.assetId || `a${messageIndex}-0`,
          block,
          messageIndex,
          blockIndex: blocks.indexOf(block),
          position: images.indexOf(block) + 1,
          total: images.length,
          kind: block.kind && KIND_LABELS[block.kind] ? block.kind : "image"
        });
      });
    });
    return list;
  }

  function assetKindLabel(asset) {
    return KIND_LABELS[asset.kind] || "Image";
  }

  function assetLabel(asset) {
    return String(asset.block.alt || asset.block.caption || "Untitled visual").trim() || "Untitled visual";
  }

  function assetCounts() {
    const counts = { image: 0, diagram: 0, chart: 0, total: 0 };
    for (const asset of assetsForSelectedMessages()) {
      counts.total += 1;
      if (asset.kind === "image") counts.image += 1;
      else if (asset.kind === "diagram") counts.diagram += 1;
      else counts.chart += 1; // charts and infographics share the chart tile
    }
    return counts;
  }

  function imageReport() {
    if (!chat) return { message: "", included: 0 };
    return exporter.analyzeImages(exportChat(), formatOptions(), selectedFormat);
  }

  /* ---------------------------------------------------------------- formats UI */

  function buildFormatCards() {
    const fragment = document.createDocumentFragment();
    const more = document.createDocumentFragment();
    for (const [id, meta] of Object.entries(FORMATS)) {
      const card = document.createElement("label");
      card.className = "format-card";
      card.dataset.format = id;

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "format";
      input.value = id;
      input.checked = id === selectedFormat;

      const icon = document.createElement("span");
      icon.className = "format-icon";
      icon.append(svgIcon(meta.icon));

      const text = document.createElement("span");
      text.className = "format-text";
      const name = document.createElement("span");
      name.className = "format-name";
      name.textContent = meta.label;
      const description = document.createElement("span");
      description.className = "format-desc";
      description.textContent = meta.description;
      const detail = document.createElement("span");
      detail.className = "format-meta";
      detail.textContent = FORMAT_META[id] || "";
      text.append(name, description, detail);

      card.append(input, icon, text);
      (PRIMARY_FORMATS.has(id) ? fragment : more).append(card);
    }
    ui.formatList.append(fragment);
    ui.moreFormatList.append(more);
    ui.formatHint.textContent = "PDF, Word, Markdown";
  }

  function setControlDisabled(input, disabled, reason = "") {
    if (!input) return;
    input.disabled = disabled;
    input.title = disabled ? reason : "";
    const row = input.closest(".field, .switch-row, .theme-chip");
    if (row) row.classList.toggle("is-disabled", disabled);
  }

  function applyFormatUi() {
    const view = formatView();
    const settings = view.settings || {};
    const note = {
      docx: "The preview uses the Word page layout and palette. The download is a real .docx with editable headings, lists, tables, code and embedded images. Remote images are fetched only when enabled in Advanced.",
      html: "This is the standalone HTML file that will be downloaded. Remote images can be embedded by enabling retrieval in Advanced.",
      image: "The preview is rendered by the same canvas code as the downloaded PNG. Standard detail is 1.5x, high detail is 2x.",
      markdown: "The download is exactly this Markdown source.",
      txt: "The download is exactly this plain-text source. TXT cannot carry images or page geometry.",
      json: "The download is exactly this JSON document. JSON cannot carry images or page geometry.",
      pdf: "PDF is produced by the browser's print dialog. The preview is the exact document sent to it; paper size, margins and final page count are applied there."
    }[selectedFormat] || "";
    ui.stageNote.textContent = note;
    ui.stageNote.hidden = !note;

    ui.primaryLabel.textContent = selectedFormat === "pdf" ? "Print / Save as PDF" : (PRIMARY_LABELS[selectedFormat] || "Export");
    ui.primary.title = selectedFormat === "pdf"
      ? "Print the current selection to PDF. Choose 'Save as PDF' in the browser print dialog."
      : `Download this selection as ${view.label}.`;

    for (const input of ui.themesGroup.querySelectorAll("input")) {
      setControlDisabled(input, !settings.theme, "This format has no document theme.");
      input.closest(".theme-chip").classList.toggle("is-disabled", !settings.theme);
    }
    drawSelectedTheme();

    setControlDisabled(ui.wordPalette, !settings.docMode, "Only Word has its own palette choice.");
    setControlDisabled(ui.timestampsToggle, !settings.timestamps, "This format has no message timestamps.");
    setControlDisabled(ui.highlightToggle, !settings.highlight, "This format cannot colour code tokens.");
    setControlDisabled(ui.remoteToggle, !settings.remoteImages, "This format never loads remote images.");
    setControlDisabled(ui.filenameInput, !settings.filename, "The print dialog chooses the PDF file name.");
    setControlDisabled(ui.includeImages, !settings.images, "This format cannot carry images.");
    /* The model has always supported diagrams as their own switch; leaving the
       control permanently disabled made that promise unreachable. */
    setControlDisabled(ui.includeDiagrams, !settings.diagrams, "This format cannot carry diagrams.");
    setControlDisabled(ui.keepImagePositions, !settings.positions, "This format flows images with the text.");
    setControlDisabled(ui.includeCaptions, !settings.captions, "This format has no captions.");
    setControlDisabled(ui.includeImageSources, !settings.sources, "This format has no image sources.");
    setControlDisabled(ui.imageLayout, !settings.layout, "This format has no image placement.");
    setControlDisabled(ui.imageQuality, !settings.imageQuality, "PNG detail only applies to the PNG export.");
    ui.qualityNote.textContent = settings.imageQuality
      ? "PNG detail applies to the PNG raster export. Every other format embeds each original asset at full resolution."
      : "PNG detail only applies to the PNG export.";

    setControlDisabled(ui.includeCover, !settings.page, "This format has no title page.");
    const pageFields = [ui.pageSize, ui.orientation, ui.margin, ui.keepBlocks];
    for (const field of pageFields) setControlDisabled(field, !settings.page, "This format has no page geometry.");
    const typeFields = [ui.bodyFont, ui.monoFont, ui.fontSize, ui.lineSpacing, ui.paraSpacing];
    for (const field of typeFields) setControlDisabled(field, !settings.typography, "This format has fixed typography.");

    const page = pageContext();
    ui.advancedSummary.textContent = `${page.sizeLabel} \u00b7 ${page.orientation === "landscape" ? "Landscape" : "Portrait"}`;
    ui.formatBadge.textContent = view.label.replace(/\s*\(.*\)$/, "").toUpperCase();
    ui.themeBadge.textContent = settings.theme ? THEME_LABELS[options.theme] : settings.docMode ? "Word palette" : "Format default";
    const documentPane = view.pane === "document";
    ui.pageControls.classList.toggle("is-disabled", !documentPane);
    ui.zoomControls.classList.toggle("is-disabled", !documentPane);
    ui.zoomIn.disabled = !documentPane || busy;
    ui.zoomOut.disabled = !documentPane || busy;
    ui.fitWidth.disabled = !documentPane || busy;
    ui.openDoc.disabled = view.pane !== "document" || !chat || !included.size || busy;
    ui.openDoc.title = view.pane === "document"
      ? "Open the generated document in a new tab, for example to print from there."
      : "This format has no page view to open.";
    syncImageUi();
    syncStageSub();
  }

  function drawSelectedTheme() {
    const input = document.querySelector(`input[name="theme"][value="${options.theme}"]`);
    if (input) input.checked = true;
  }

  function syncStageSub() {
    const view = formatView();
    if (view.pane === "document") {
      const page = pageContext();
      ui.stageSub.textContent = `${page.sizeLabel} ${page.orientation} \u00b7 ${included.size} message${included.size === 1 ? "" : "s"}`;
    } else if (view.pane === "source") {
      ui.stageSub.textContent = `${view.label} source`;
    } else {
      ui.stageSub.textContent = "Raster preview";
    }
  }

  function reportVisualSummary(total) {
    return `${total} visual${total === 1 ? "" : "s"}`;
  }

  function syncImageUi() {
    const counts = assetCounts();
    ui.countImages.textContent = String(counts.image);
    ui.countDiagrams.textContent = String(counts.diagram);
    ui.countCharts.textContent = String(counts.chart);
    ui.scopeVisuals.textContent = `${counts.total} visual${counts.total === 1 ? "" : "s"}`;
    ui.visualSummary.textContent = `${reportVisualSummary(counts.total)} available · ${options.includeImages === false ? "images off" : options.includeDiagrams === false ? "diagrams off" : "included"}`;
    ui.scopeCount.textContent = String(included.size);
    ui.appScope.textContent = `${included.size} message${included.size === 1 ? "" : "s"}`;

    const report = imageReport();
    const pane = formatView().pane;
    const showVisuals = report.included > 0 && pane !== "source";
    ui.visualBadge.hidden = !showVisuals;
    ui.visualBadge.textContent = `${report.included} visual${report.included === 1 ? "" : "s"}`;
    ui.imageNotice.textContent = report.message || "";
    ui.imageNotice.hidden = !report.message;

    if (!ui.drawer.hidden) buildDrawer();
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
    ui.stageScroll.scrollTop = 0;
  }

  function updatePageIndicator() {
    const view = formatView();
    if (view.pane !== "document" || !chat) {
      ui.pageEst.textContent = view.pane === "image" ? "Raster" : "Source";
      ui.prevPage.disabled = true;
      ui.nextPage.disabled = true;
      return;
    }
    const context = pageContext();
    const pageH = pageHeightPx() * zoom;
    const pages = estimatePages();
    const current = clamp(Math.floor((ui.stageScroll.scrollTop + pageH * 0.35) / Math.max(1, pageH)) + 1, 1, pages);
    ui.pageEst.textContent = pages > 1 ? `Page ${current} of ~${pages}` : "1 page";
    ui.pageEst.title = `Estimated from the rendered height at the selected ${context.sizeLabel} geometry. The print dialog decides the real page count.`;
    ui.prevPage.disabled = current <= 1;
    ui.nextPage.disabled = current >= pages;
  }

  function estimatePages() {
    if (formatView().pane !== "document") return 1;
    try {
      const doc = ui.preview.contentDocument;
      if (!doc || !doc.documentElement) return 1;
      const height = Math.max(pageHeightPx(), doc.documentElement.scrollHeight);
      return Math.max(1, Math.ceil(height / pageHeightPx()));
    } catch {
      return 1;
    }
  }

  function setZoom(next) {
    zoom = clamp(Math.round(next * 100) / 100, ZOOM_MIN, ZOOM_MAX);
    ui.zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    applyScale();
    updatePageIndicator();
  }

  /** Page width, measured content height and zoom all live on the wrapper, so
      the iframe paints once and only its scale changes. */
  function applyScale() {
    const view = formatView();
    ui.stageInner.style.setProperty("--doc-zoom", String(zoom));
    ui.stageInner.style.setProperty("--doc-width", `${Math.round(pageWidthPx())}px`);
    ui.zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    if (view.pane !== "document") {
      updatePageIndicator();
      return;
    }
    let height = pageHeightPx();
    try {
      const doc = ui.preview.contentDocument;
      if (doc && doc.documentElement && doc.body) {
        height = Math.max(pageHeightPx(), doc.documentElement.scrollHeight);
      }
    } catch {
      height = pageHeightPx(); // the frame is still on its previous document
    }
    ui.preview.style.height = `${Math.round(height)}px`;
    syncStageSub();
    updatePageIndicator();
  }

  function scrollToPage(delta) {
    const pageH = pageHeightPx() * zoom;
    const pages = estimatePages();
    const current = clamp(Math.floor((ui.stageScroll.scrollTop + pageH * 0.35) / Math.max(1, pageH)) + 1, 1, pages);
    const target = clamp(current + delta, 1, pages);
    ui.stageScroll.scrollTo({ top: (target - 1) * pageH + ui.stageInner.offsetTop, behavior: "smooth" });
  }

  function fitToWidth() {
    if (formatView().pane !== "document") return;
    const available = ui.stageScroll.clientWidth - 44;
    if (available > 0) setZoom(available / pageWidthPx());
  }

  /** Never open wider than the pane can show. The desktop default stays 65%;
      a Chrome side panel gets the largest scale that still fits. */
  function fitInitialZoom() {
    if (formatView().pane !== "document") return;
    const available = ui.stageScroll.clientWidth - 44;
    if (available <= 0) return;
    const fit = clamp(available / pageWidthPx(), ZOOM_MIN, ZOOM_MAX);
    zoom = Math.min(DEFAULT_ZOOM, fit);
  }

  function showPane(name) {
    if (name !== "image") clearImage();
    ui.stageInner.hidden = name !== "document";
    ui.sourceView.hidden = name !== "source";
    ui.imageFigure.hidden = name !== "image";
    ui.stageScroll.classList.toggle("is-source", name === "source");
  }

  function clearImage() {
    clearTimeout(imageTimer);
    imageTimer = null;
    imageRevision += 1;
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      imageUrl = null;
    }
    ui.imageView.removeAttribute("src");
    ui.imageView.hidden = true;
  }

  function renderDocument(immediate = false) {
    if (!chat) return;
    clearTimeout(renderTimer);
    revision += 1;
    const paint = () => {
      renderTimer = null;
      renderedRevision = revision;
      loadedRevision = -1;
      ui.preview.srcdoc = exporter.documentHtml(exportChat(), formatOptions()).replace(
        '<meta charset="utf-8">', `<meta charset="utf-8"><meta name="export-revision" content="${renderedRevision}">`
      );
    };
    if (immediate) paint();
    else renderTimer = setTimeout(paint, 140); // ticking boxes should not thrash the frame
  }

  function renderSource() {
    const live = formatOptions();
    if (selectedFormat === "markdown") ui.sourceView.textContent = exporter.markdownFor(exportChat(), live);
    else if (selectedFormat === "txt") ui.sourceView.textContent = exporter.textFor(exportChat(), live);
    else ui.sourceView.textContent = exporter.jsonFor(exportChat(), live);
  }

  function renderImage(immediate = false) {
    clearTimeout(imageTimer);
    const run = async () => {
      imageTimer = null;
      const runRevision = ++imageRevision;
      ui.imageNote.textContent = "Rendering the PNG preview...";
      ui.imageView.hidden = true;
      await nextFrame();
      try {
        const blob = await exporter.pngFor(exportChat(), formatOptions());
        if (runRevision !== imageRevision) return;
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = URL.createObjectURL(blob);
        ui.imageView.src = imageUrl;
        ui.imageView.hidden = false;
        const detail = options.imageQuality === "high" ? "2x" : "1.5x";
        ui.imageNote.textContent = `PNG preview at ${detail}. Every image in the poster is drawn from the conversation; nothing is generated.`;
      } catch (error) {
        if (runRevision !== imageRevision) return;
        ui.imageNote.textContent = error && error.message ? error.message : "The PNG preview could not be rendered.";
      }
    };
    if (immediate) run();
    else imageTimer = setTimeout(run, 350);
  }

  /** Route a state change to the pane the selected format actually uses. */
  function render(immediate = false) {
    if (!chat) return;
    const pane = formatView().pane;
    showPane(pane);
    syncImageUi();
    if (pane === "document") {
      renderDocument(immediate);
    } else if (pane === "source") {
      renderSource();
      resetStage();
    } else {
      renderImage(immediate);
      resetStage();
    }
    updatePageIndicator();
  }

  function watchPreviewLayout() {
    try {
      const win = ui.preview.contentWindow;
      const doc = ui.preview.contentDocument;
      if (!win || !doc || !doc.body) return;
      // A remote image or a late webfont changes the page height after load;
      // the frame height must follow, or the bottom of the document is clipped.
      for (const image of doc.querySelectorAll("img")) {
        if (image.complete) continue;
        image.addEventListener("load", applyScale, { once: true });
        image.addEventListener("error", applyScale, { once: true });
      }
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => applyScale()).catch(() => {});
      if (previewObserver) previewObserver.disconnect();
      if (typeof win.ResizeObserver === "function") {
        previewObserver = new win.ResizeObserver(() => applyScale());
        previewObserver.observe(doc.body);
      }
    } catch {
      // The frame was replaced before it could be measured; the next load retries.
    }
  }

  /* Fitting is document behaviour, so it lives in utils/exporter.js where a
     test can call it on a plain DOM; the workspace only decides when it runs
     (after every preview load and before printing). */
  function fitDisplayMath() {
    if (!ui.preview.contentDocument) return;
    exporter.fitDisplayMathBlocks(ui.preview.contentDocument);
  }

  /**
   * Copy buttons live in the preview chrome only. The generated file stays a
   * static document with no script, so what you download is what the preview
   * shows minus these buttons.
   */
  function decorateCodePanels() {
    const doc = ui.preview.contentDocument;
    if (!doc || !doc.querySelector(".code")) return;
    if (!doc.querySelector(".code-copy-style")) {
      const style = doc.createElement("style");
      style.className = "code-copy-style";
      /* Preview chrome, so it carries its own literal colours: it must not
         read the document's theme tokens, which belong to the file itself. */
      style.textContent = `.code-head { position: relative; }
.code-copy { margin-left: auto; appearance: none; border: 1px solid #d1d5db;
  background: #ffffff; color: #24292f;
  font: 600 8.5pt/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  border-radius: 4px; padding: 3px 7px; cursor: pointer; }
.code-copy:hover { background: #f7e6ec; border-color: #e0b4c4; color: #44174e; }
.code-copy:focus-visible { outline: 2px solid #44174e; outline-offset: 2px; }
@media print { .code-copy { display: none; } }`;
      doc.head.append(style);
    }
    for (const panel of doc.querySelectorAll(".code")) {
      const head = panel.querySelector(".code-head");
      if (!head || head.querySelector(".code-copy")) continue;
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "code-copy";
      button.textContent = "Copy";
      const label = head.querySelector(".code-lang");
      button.setAttribute("aria-label", `Copy ${label ? label.textContent : "code"} to the clipboard`);
      button.title = "Copy this panel (preview only)";
      button.addEventListener("click", async () => {
        const code = panel.querySelector("pre code");
        try {
          await navigator.clipboard.writeText(code ? code.textContent : "");
          button.textContent = "Copied";
        } catch {
          button.textContent = "Copy failed";
        }
        setTimeout(() => { button.textContent = "Copy"; }, 1600);
      });
      head.append(button);
    }
  }

  ui.preview.addEventListener("load", () => {
    // Ignore a load event from a document superseded by a newer srcdoc.
    const marker = ui.preview.contentDocument && ui.preview.contentDocument.querySelector('meta[name="export-revision"]');
    if (marker && Number(marker.content) === renderedRevision) loadedRevision = renderedRevision;
    fitDisplayMath();
    decorateCodePanels();
    applyScale();
    watchPreviewLayout();
    requestAnimationFrame(() => resetStage());
  });
  ui.stageScroll.addEventListener("scroll", updatePageIndicator, { passive: true });
  window.addEventListener("resize", () => {
    // A narrower window must not crop the page it is already showing. Only
    // shrink automatically; a user-chosen larger zoom is left alone otherwise.
    if (formatView().pane === "document") {
      const available = ui.stageScroll.clientWidth - 44;
      if (available > 0 && pageWidthPx() * zoom > available) zoom = clamp(available / pageWidthPx(), ZOOM_MIN, ZOOM_MAX);
    }
    applyScale();
    updatePageIndicator();
  });
  window.addEventListener("pagehide", () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  });

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
    ].filter(Boolean).join(" · ");
  }

  /** Everything a search should look at, without touching the visible UI. */
  function searchTextFor(message) {
    const role = message.role === "assistant" ? "ai assistant" : message.role === "user" ? "user prompt" : String(message.role || "");
    const blocks = (message.blocks || []).map((block) =>
      [block.type, block.text, block.language, block.code, block.tex, (block.items || []).join(" ")].filter(Boolean).join(" ")
    );
    return `${role} ${String(message.text || "")} ${blocks.join(" ")}`.toLowerCase();
  }

  function buildPicker() {
    ui.pickerList.textContent = "";
    const fragment = document.createDocumentFragment();
    chat.messages.forEach((message, index) => {
      const row = document.createElement("li");
      row.dataset.search = searchTextFor(message);
      row.dataset.role = message.role || "message";

      const label = document.createElement("label");
      label.className = "pick";
      label.dataset.role = message.role || "message";

      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "pick-box";
      box.dataset.index = String(index);
      box.checked = included.has(index);
      box.setAttribute("aria-label", `Include message ${index + 1}`);

      const main = document.createElement("span");
      main.className = "pick-main";

      const head = document.createElement("span");
      head.className = "pick-top";
      const number = document.createElement("span");
      number.className = "pick-num";
      number.textContent = String(index + 1);
      const role = document.createElement("span");
      role.className = "role";
      // User/AI keeps the same words as the export itself.
      role.textContent = message.role === "assistant" ? "AI" : message.role === "user" ? "User" : message.role || "Message";
      head.append(number, role);
      const tags = tagsFor(message);
      if (tags) {
        const tag = document.createElement("span");
        tag.className = "pick-when";
        tag.textContent = tags;
        head.append(tag);
      }

      const text = document.createElement("span");
      text.className = "pick-text";
      text.textContent = snippetFor(message);

      main.append(head, text);
      label.append(box, main);
      row.append(label);

      /* The full text is one disclosure away and sits outside the label, so
         opening it never toggles the checkbox. */
      const full = String(message.text || "").trim();
      if (full.length > 180) {
        const more = document.createElement("details");
        more.className = "pick-more";
        const summary = document.createElement("summary");
        summary.textContent = "Show full message";
        const body = document.createElement("p");
        body.textContent = full.length > 6000 ? `${full.slice(0, 6000)}\n\n(Preview truncated)` : full;
        more.append(summary, body);
        row.append(more);
      }

      fragment.append(row);
    });
    ui.pickerList.append(fragment);
  }

  function applySearch() {
    if (!chat) return;
    const query = ui.search.value.trim().toLowerCase();
    let shown = 0;
    for (const row of ui.pickerList.children) {
      const match = !query || String(row.dataset.search || "").includes(query);
      row.hidden = !match;
      if (match) shown += 1;
    }
    ui.pickFilter.hidden = !query;
    ui.pickFilter.textContent = query ? `${shown} of ${chat.messages.length} messages match the search.` : "";
    ui.pickEmpty.hidden = !(query && shown === 0);
  }

  function refreshActions() {
    const none = !chat || included.size === 0;
    ui.primary.disabled = none || busy;
    const pane = formatView().pane;
    ui.openDoc.disabled = none || busy || pane !== "document";
  }

  /* Freeze everything that would change the document while a build or print is
     in flight, so the file that arrives is exactly the preview on screen. */
  function setExportBusy(value) {
    busy = value;
    for (const input of document.querySelectorAll(
      '.format-card input, .theme-chip input, #pick-list input, #doc-mode, #filename,' +
      '#include-images, #include-diagrams, #keep-image-positions, #include-captions, #include-image-sources, #image-layout,' +
      '#image-quality, #include-cover, #page-size, #orientation, #margin, #body-font, #mono-font, #font-size, #line-spacing, #para-spacing,' +
      '#timestamps, #highlight, #remote-images, #pick-search'
    )) {
      input.disabled = value;
    }
    for (const button of document.querySelectorAll("[data-select], #assets-all, #assets-none, #zoom-in, #zoom-out, #fit-width, #prev-page, #next-page")) {
      button.disabled = value;
    }
    document.body.classList.toggle("is-exporting", value);
    if (!value) {
      applyFormatUi();
      applyScale();
    }
    refreshActions();
  }

  function updateSelectionUi() {
    const total = chat ? chat.messages.length : 0;
    const count = included.size;
    ui.pickCount.textContent = count === total ? `all ${total}` : `${count} of ${total}`;
    refreshActions();
    syncImageUi();
    if (count === 0) {
      noSelectionNotice = true;
      setStatus(
        "No messages selected. Open Messages and tick at least one turn to build the document.",
        "error",
        { label: "Open messages", run: () => switchTab("messages") }
      );
    } else if (noSelectionNotice) {
      noSelectionNotice = false;
      setStatus(`${count} of ${total} messages selected.`, "ok");
    } else {
      setStatus(`${count} of ${total} messages selected.`, "ok");
    }
  }

  function setAll(wanted) {
    included.clear();
    chat.messages.forEach((message, index) => {
      if (wanted === "all") included.add(index);
      else if (wanted === "assistant" && message.role === "assistant") included.add(index);
      else if (wanted === "user" && message.role === "user") included.add(index);
    });
    for (const box of ui.pickerList.querySelectorAll("input")) {
      box.checked = included.has(Number(box.dataset.index));
    }
    updateSelectionUi();
    render(true);
  }

  function bindPicker() {
    // One delegated listener keeps a 500-turn conversation from creating 500
    // redundant handlers when the list is rebuilt or filtered.
    ui.pickerList.addEventListener("change", (event) => {
      const box = event.target.closest(".pick-box");
      if (!box) return;
      const index = Number(box.dataset.index);
      if (box.checked) included.add(index);
      else included.delete(index);
      updateSelectionUi();
      render();
    });

    for (const button of document.querySelectorAll("[data-select]")) {
      button.addEventListener("click", () => setAll(button.dataset.select));
    }
  }

  /* ------------------------------------------------------------------ drawer */

  function openDrawer() {
    if (!chat) return;
    buildDrawer();
    ui.drawer.hidden = false;
    ui.drawerScrim.hidden = false;
  }

  function closeDrawer() {
    ui.drawer.hidden = true;
    ui.drawerScrim.hidden = true;
  }

  function buildDrawer() {
    const assets = assetsForSelectedMessages();
    const settings = formatSettings();
    const report = imageReport();
    ui.drawerCount.textContent = `${assets.length} asset${assets.length === 1 ? "" : "s"} · ${report.included} included`;
    ui.drawerList.textContent = "";
    ui.drawerEmpty.hidden = assets.length > 0;
    ui.assetsAll.disabled = assets.length === 0;
    ui.assetsNone.disabled = assets.length === 0;

    const fragment = document.createDocumentFragment();
    for (const asset of assets) {
      const available = settings.images !== false;
      const isExcluded = excludedAssets.has(asset.id);

      const item = document.createElement("li");
      item.className = "asset";
      item.classList.toggle("is-excluded", !available || isExcluded);

      const thumb = document.createElement("span");
      thumb.className = "asset-thumb";
      const src = String(asset.block.src || "");
      const canShow = /^data:image\//i.test(src);
      if (canShow) {
        const img = document.createElement("img");
        img.alt = "";
        img.src = src;
        img.addEventListener("error", () => {
          img.remove();
          thumb.append(svgIcon("i-image"));
        }, { once: true });
        thumb.append(img);
      } else {
        thumb.append(svgIcon("i-image"));
      }

      const main = document.createElement("span");
      main.className = "asset-main";

      const line = document.createElement("span");
      line.className = "asset-line";
      const name = document.createElement("strong");
      name.textContent = assetLabel(asset);
      const tag = document.createElement("span");
      tag.className = `tag tag--${asset.kind === "image" ? "image" : asset.kind === "diagram" ? "diagram" : "chart"}`;
      tag.textContent = assetKindLabel(asset);
      line.append(name, tag);

      const caption = document.createElement("p");
      caption.className = "asset-caption";
      const captionText = String(asset.block.caption || "").trim();
      caption.textContent = captionText && captionText !== assetLabel(asset) ? captionText : "No caption in the source conversation.";

      const meta = document.createElement("p");
      meta.className = "asset-meta";
      const dimensions = asset.block.width > 0 && asset.block.height > 0 ? ` · ${Math.round(asset.block.width)}×${Math.round(asset.block.height)} px` : "";
      const remote = /^https:\/\//i.test(src) ? " · remote" : " · embedded";
      meta.textContent = `Message ${asset.messageIndex + 1} · visual ${asset.position} of ${asset.total}${dimensions}${remote}`;

      main.append(line, caption, meta);

      if (formatView().pane === "document" && available && !isExcluded) {
        const jump = document.createElement("button");
        jump.type = "button";
        jump.className = "link asset-jump";
        jump.textContent = "Show in preview";
        jump.addEventListener("click", () => jumpToAsset(asset.id));
        main.append(jump);
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = available && !isExcluded;
      checkbox.disabled = !available;
      checkbox.setAttribute("aria-label", `Include ${assetKindLabel(asset).toLowerCase()}: ${assetLabel(asset)}`);
      checkbox.title = !available
        ? (settings.images === false ? "Images are turned off for this export." : "Diagrams are turned off for this export.")
        : isExcluded ? "Excluded from the export." : "Included in the export.";
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) excludedAssets.delete(asset.id);
        else excludedAssets.add(asset.id);
        options.excludedAssets = [...excludedAssets];
        render(true);
      });

      item.append(thumb, main, checkbox);
      fragment.append(item);
    }
    ui.drawerList.append(fragment);

    ui.imageLayout.value = options.imageLayout;
    ui.includeCaptions.checked = options.includeCaptions;
    ui.includeImageSources.checked = options.includeImageSources;
    ui.imageQuality.value = options.imageQuality;
    setControlDisabled(ui.imageLayout, !formatSettings().layout);
    setControlDisabled(ui.includeCaptions, !formatSettings().captions);
    setControlDisabled(ui.includeImageSources, !formatSettings().sources);
    setControlDisabled(ui.imageQuality, !formatSettings().imageQuality);
  }

  function jumpToAsset(assetId) {
    if (formatView().pane !== "document") {
      setStatus("Switch to PDF, Word or HTML to inspect asset placement in the document.");
      return;
    }
    let element = null;
    try {
      element = ui.preview.contentDocument.getElementById(`asset-${assetId}`);
    } catch {
      element = null;
    }
    if (!element) {
      setStatus("That asset is not on the rendered page. It may be excluded or waiting for the preview to finish.");
      return;
    }
    closeDrawer();
    const top = ui.stageInner.offsetTop + element.getBoundingClientRect().top * zoom - 16;
    ui.stageScroll.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    setStatus(`Showing ${assetId ? "the selected visual" : "the visual"} in the preview.`);
  }

  /* -------------------------------------------------------------------- tabs */

  function switchTab(name) {
    const messages = name === "messages";
    byId("tab-export").classList.toggle("is-active", !messages);
    byId("tab-messages").classList.toggle("is-active", messages);
    byId("tab-export").setAttribute("aria-selected", String(!messages));
    byId("tab-messages").setAttribute("aria-selected", String(messages));
    byId("view-export").hidden = messages;
    byId("view-messages").hidden = !messages;
    if (messages) ui.search.focus({ preventScroll: true });
  }

  /* --------------------------------------------------------------- downloads */

  /* Object URLs are revoked when Chrome reports a terminal download state, not
     on a fixed timer: a timer can revoke a URL the browser is still reading,
     and forgetting to revoke one keeps the blob alive for the whole tab. The
     timeout is only the fallback for a missing event. */
  const pendingDownloads = new Map();
  let latestDownloadId = null;

  function releaseDownload(downloadId) {
    const entry = pendingDownloads.get(downloadId);
    if (!entry) return null;
    pendingDownloads.delete(downloadId);
    clearTimeout(entry.timer);
    URL.revokeObjectURL(entry.url);
    return entry;
  }

  /** Chrome reports an absolute path; the notification names the file, not the
      sandbox path. Backslashes and slashes both appear across platforms. */
  function baseNameOf(value) {
    const parts = String(value || "").split(/[\\/]/);
    return parts[parts.length - 1] || "";
  }

  if (chrome.downloads && chrome.downloads.onChanged) {
    chrome.downloads.onChanged.addListener((delta) => {
      if (!delta || !delta.state) return;
      const state = delta.state.current;
      if (state !== "complete" && state !== "interrupted") return;
      const entry = releaseDownload(delta.id);
      // A completion from an older export must not overwrite the status of a
      // newer one, and a download interrupted by the browser is not success.
      if (!entry || delta.id !== latestDownloadId) return;
      latestDownloadId = null;
      if (state === "complete") {
        /* Success is reported only after Chrome confirms the file exists. The
           search result carries the name actually used after "uniquify", which
           is the only file name that can honestly be shown. */
        const finish = (savedName) => {
          const name = savedName || entry.filename;
          const label = entry.fileCount > 1 ? `${entry.fileCount} files (${entry.filename})` : name;
          hideModal();
          showSuccess({
            filename: label,
            size: entry.size,
            format: entry.format,
            pages: entry.pages,
            visuals: entry.visuals,
            warnings: entry.warnings
          });
          setStatus(
            `Export complete: ${label}.${auditNotice ? ` Note: ${auditNotice}` : ""}`,
            "ok",
            chrome.downloads && typeof chrome.downloads.showDefaultFolder === "function"
              ? { label: "Show folder", run: () => chrome.downloads.showDefaultFolder() }
              : null
          );
        };
        if (chrome.downloads && typeof chrome.downloads.search === "function") {
          let answered = false;
          try {
            chrome.downloads.search({ id: delta.id }, (items) => {
              if (answered) return;
              answered = true;
              // Reading lastError here keeps a missing item from surfacing as an
              // unchecked runtime error; the queued name is the fallback.
              void chrome.runtime.lastError;
              const item = Array.isArray(items) ? items.find((candidate) => candidate && candidate.id === delta.id) : null;
              finish(item && item.filename ? baseNameOf(item.filename) : entry.filename);
            });
          } catch {
            finish(entry.filename);
          }
        } else {
          finish(entry.filename);
        }
      } else {
        hideModal();
        showError(`Download interrupted: ${entry.filename}. Your selection and settings are unchanged.`, entry.format);
        setStatus(`Download interrupted: ${entry.filename}.`, "error", { label: "Try again", run: () => runExport() });
      }
    });
  }

  function saveBlob(blob, filename, format, details = {}) {
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (message) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        reject(new Error(message));
      };
      try {
        if (!chrome.downloads || typeof chrome.downloads.download !== "function") {
          fail("The downloads API is unavailable in this browser context.");
          return;
        }
        chrome.downloads.download(
          { url, filename, saveAs: false, conflictAction: "uniquify" },
          (downloadId) => {
            if (settled) return;
            const error = chrome.runtime.lastError;
            if (error || downloadId === undefined) {
              fail(error ? error.message : "The browser refused the download.");
              return;
            }
            settled = true;
            latestDownloadId = downloadId;
            pendingDownloads.set(downloadId, {
              url,
              filename,
              format,
              size: details.size || blob.size,
              pages: details.pages || 0,
              fileCount: details.fileCount || 1,
              visuals: details.visuals || 0,
              warnings: details.warnings || [],
              timer: setTimeout(() => releaseDownload(downloadId), 600000)
            });
            resolve({ filename, downloadId });
          }
        );
      } catch (error) {
        fail(error && error.message ? error.message : "The browser refused the download.");
      }
    });
  }

  /* ------------------------------------------------------------- export state */

  const MODAL_STATES = () => ({
    progress: ui.modalProgress,
    success: ui.modalSuccess,
    error: ui.modalError,
    info: ui.modalInfo
  });

  /* The completion notification is the one state that clears itself: a file
     that already downloaded needs no acknowledgement, and leaving the card up
     asks the reader to dismiss something that has finished. Any interaction
     with the card cancels the timer, so it never vanishes mid-read. */
  const SUCCESS_DISMISS_MS = 7000;
  let successTimer = null;

  function clearSuccessTimer() {
    if (successTimer === null) return;
    clearTimeout(successTimer);
    successTimer = null;
  }

  function showModal(state) {
    // One notification at a time: a new state retires the previous timer. An
    // export still in progress is never dismissed - only its own completion is.
    clearSuccessTimer();
    for (const [name, node] of Object.entries(MODAL_STATES())) node.hidden = name !== state;
    ui.modalScrim.hidden = false;
  }

  function hideModal() {
    clearSuccessTimer();
    ui.modalScrim.hidden = true;
  }

  function resetStages() {
    for (const item of ui.progressStages.children) item.className = "";
  }

  /** Thrown only when the reader asked to stop; it is not an export failure. */
  class ExportCancelled extends Error {
    constructor() {
      super("Export cancelled.");
      this.name = "ExportCancelled";
    }
  }

  function ensureActive() {
    if (cancelRequested) throw new ExportCancelled();
  }

  function requestCancel() {
    if (!busy || cancelRequested) return;
    cancelRequested = true;
    ui.cancelProgress.disabled = true;
    ui.cancelProgress.textContent = "Cancelling...";
    setStatus("Cancelling at the next completed stage...", "busy");
    // A download that was already accepted can still be withdrawn.
    if (latestDownloadId !== null && chrome.downloads && typeof chrome.downloads.cancel === "function") {
      try {
        chrome.downloads.cancel(latestDownloadId, () => void chrome.runtime.lastError);
      } catch {
        // The file already finished; the completion event reports it instead.
      }
    }
  }

  function cancelOrClose() {
    if (busy) requestCancel();
    else if (!ui.modalProgress.hidden) hideModal();
  }

  function reportCancelled(stage) {
    // The progress card stays up long enough to show where the work stopped;
    // its only remaining action is to close it.
    if (typeof stage === "number") markStage(stage, "cancelled");
    ui.cancelProgress.textContent = "Close";
    ui.cancelProgress.disabled = false;
    const title = ui.modalProgress.querySelector("h2");
    if (title) title.textContent = "Export cancelled";
    setStatus("Export cancelled. Nothing was downloaded; your selection and settings are unchanged.", "warn");
  }

  function markStage(index, state) {
    const item = ui.progressStages.querySelector(`[data-stage="${index}"]`);
    if (!item) return;
    item.classList.remove("is-active", "is-done");
    if (state) item.classList.add(`is-${state}`);
  }

  function showProgress() {
    resetStages();
    const title = ui.modalProgress.querySelector("h2");
    if (title) title.textContent = "Exporting document...";
    ui.cancelProgress.textContent = "Cancel export";
    ui.cancelProgress.disabled = false;
    showModal("progress");
  }

  function showSuccess(details) {
    const view = formatView(details.format);
    ui.modalFile.textContent = details.filename;
    ui.modalStats.textContent = "";
    const rows = [
      ["Format", view.label],
      ["File size", formatBytes(details.size)]
    ];
    if (details.visuals > 0) rows.push(["Visuals", `${details.visuals} included`]);
    if (details.pages > 0) rows.push(["Pages", `~${details.pages} (estimated)`]);
    if (details.warnings && details.warnings.length) rows.push(["Visual issues", details.warnings.map((item) => `${item.asset}: ${item.reason}`).join("\n")]);
    for (const [label, value] of rows) {
      const cell = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      cell.append(dt, dd);
      ui.modalStats.append(cell);
    }
    ui.modalOpenFolder.hidden = !(chrome.downloads && typeof chrome.downloads.showDefaultFolder === "function");
    showModal("success");
    successTimer = setTimeout(() => {
      successTimer = null;
      // A success that has already been replaced must not close its successor.
      if (!ui.modalSuccess.hidden) hideModal();
    }, SUCCESS_DISMISS_MS);
  }

  function showError(message, format = selectedFormat) {
    lastAttempt = format;
    ui.modalErrorMessage.textContent = message;
    showModal("error");
  }

  function showInfo(message) {
    ui.modalInfoMessage.textContent = message;
    showModal("info");
  }

  function waitForRender(timeout = 6000) {
    if (loadedRevision === revision) return Promise.resolve(true);
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (loadedRevision === revision) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > timeout) {
          clearInterval(timer);
          resolve(false);
        }
      }, 60);
    });
  }

  /** PDF is the browser's print destination, so it has its own path: render,
      validate the rendered document, then hand it to the print dialog. */
  async function exportPdf() {
    if (!chat || !included.size || busy) return;
    lastAttempt = "pdf";
    cancelRequested = false;
    setExportBusy(true);
    setStatus("Preparing the current selection for printing...", "busy");
    showProgress();
    let stage = 0;
    try {
      markStage(0, "active");
      await nextFrame();
      ensureActive();
      markStage(0, "done");

      stage = 1;
      markStage(1, "active");
      const report = imageReport();
      await nextFrame();
      ensureActive();
      markStage(1, "done");

      stage = 2;
      markStage(2, "active");
      renderDocument(true);
      const ready = await waitForRender();
      ensureActive();
      if (!ready) throw new Error("The document preview did not finish rendering. Retry the export, or open the document in a tab.");
      markStage(2, "done");

      stage = 3;
      markStage(3, "active");
      await nextFrame();
      ensureActive();
      const doc = ui.preview.contentDocument;
      if (!doc || !doc.body || !String(doc.body.textContent || "").trim()) {
        throw new Error("The rendered document is empty, so it was not sent to the print dialog.");
      }
      /* MathML is static, but the text faces still load asynchronously. Printing
         before they settle can reflow the page under the dialog. */
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready.catch(() => {});
      ensureActive();
      // The faces have settled, so the column can be measured for real.
      fitDisplayMath();
      const unrenderedMath = doc.querySelectorAll("[data-tex-error]").length;
      const mathWarning = unrenderedMath
        ? ` ${unrenderedMath} mathematical expression${unrenderedMath === 1 ? "" : "s"} could not be rendered; the original source is shown in the document.`
        : "";
      markStage(3, "done");

      const pages = estimatePages();
      const page = pageContext();
      const name = exporter.baseName(chat, formatOptions("pdf"));
      hideModal();
      try {
        ui.preview.contentWindow.focus();
        ui.preview.contentWindow.print();
      } catch {
        throw new Error("This browser blocked the print dialog. Open the document in a tab and print from there.");
      }
      setStatus(`Print dialog open. Choose 'Save as PDF', keep 'Background graphics' on, and untick 'Headers and footers'.${mathWarning}`, unrenderedMath ? "warning" : "ok");
      showInfo(
        `Suggested file name: ${name}.pdf\n` +
        `Paper: ${page.sizeLabel} ${page.orientation}, ${pages > 1 ? `~${pages} pages` : "1 page"} estimated.\n` +
        (report.message ? `${report.message}\n` : "") +
        (mathWarning ? `${mathWarning.trim()}\n` : "") +
        "The print dialog chooses the final file name and page count. If it did not appear, open the document in a tab and print from there."
      );
    } catch (error) {
      if (error && error.name === "ExportCancelled") {
        reportCancelled(stage);
      } else {
        const message = error && error.message ? error.message : "The PDF export failed.";
        showError(message, "pdf");
        setStatus(message, "error", { label: "Open in tab", run: openDocument });
      }
    } finally {
      setExportBusy(false);
    }
  }

  /** Every download runs the same four real stages, then reports the actual
      bytes that were generated - never a fabricated percentage. */
  async function performExport(format) {
    if (!chat || !included.size || busy) return;
    lastAttempt = format;
    cancelRequested = false;
    latestDownloadId = null; // an older completion must not replace this status
    setExportBusy(true);
    setStatus(`Building ${FORMATS[format] ? FORMATS[format].label : format}...`, "busy");
    showProgress();
    let stage = 0;
    let report = { included: 0, message: "" };
    let warnings = [];
    try {
      markStage(0, "active");
      await nextFrame();
      ensureActive();
      markStage(0, "done");

      stage = 1;
      markStage(1, "active");
      const live = formatOptions(format);
      report = exporter.analyzeImages(exportChat(), live, format);
      await nextFrame();
      ensureActive();
      markStage(1, "done");

      stage = 2;
      markStage(2, "active");
      await nextFrame();
      ensureActive();
      const result = await exporter.build(exportChat(), format, live);
      ensureActive();
      warnings = result.warnings || [];
      const blob = result.blob || new Blob([result.text], { type: `${result.mime};charset=utf-8` });
      if (!blob || !blob.size) throw new Error("The generated file was empty, so it was not downloaded.");
      markStage(2, "done");

      stage = 3;
      markStage(3, "active");
      await nextFrame();
      ensureActive();
      const pages = formatView(format).pane === "document" ? estimatePages() : 0;
      /* A paginated PNG export is several files. They are handed to the browser
         one at a time, in page order, and every one of them is still checked for
         cancellation; the success card waits for the last completion event. */
      const parts = Array.isArray(result.files) && result.files.length > 1 ? result.files : null;
      const totalSize = parts
        ? parts.reduce((sum, part) => sum + part.blob.size, 0)
        : blob.size;
      const details = { size: totalSize, pages, visuals: report.included, warnings, fileCount: parts ? parts.length : 1 };
      let saved;
      if (parts) {
        for (const part of parts) {
          saved = await saveBlob(part.blob, part.filename, format, { ...details, size: part.blob.size });
          if (cancelRequested) {
            if (chrome.downloads && typeof chrome.downloads.cancel === "function") {
              try {
                chrome.downloads.cancel(saved.downloadId, () => void chrome.runtime.lastError);
              } catch {
                // Already complete; nothing left to withdraw.
              }
            }
            releaseDownload(saved.downloadId);
            latestDownloadId = null;
            throw new ExportCancelled();
          }
        }
        saved = {
          filename: `${parts.length} PNG pages (${parts[0].filename} … ${parts[parts.length - 1].filename})`,
          downloadId: saved.downloadId
        };
      } else {
        saved = await saveBlob(blob, result.filename, format, details);
        if (cancelRequested) {
          // The reader cancelled while the download was being handed over.
          if (chrome.downloads && typeof chrome.downloads.cancel === "function") {
            try {
              chrome.downloads.cancel(saved.downloadId, () => void chrome.runtime.lastError);
            } catch {
              // Already complete; nothing left to withdraw.
            }
          }
          releaseDownload(saved.downloadId);
          latestDownloadId = null;
          throw new ExportCancelled();
        }
      }
      markStage(3, "done");
      persistSettings();

      /* The progress card closes when the browser accepts the file; the
         success card appears only once Chrome reports it complete. Claiming
         success at this point would be a guess about the download state. */
      hideModal();
      const notes = [auditNotice, report.message, warnings.length ? `${warnings.length} visual(s) could not be fetched; see details.` : ""].filter(Boolean).join(" ");
      setStatus(`Download started: ${saved.filename}.${notes ? ` ${notes}` : ""}`, warnings.length ? "warn" : "busy");
    } catch (error) {
      if (error && error.name === "ExportCancelled") {
        reportCancelled(stage);
      } else {
        const message = error && error.message ? error.message : "Export failed.";
        const retry = format === "image"
          ? { label: "Switch to PDF", run: () => chooseFormat("pdf") }
          : { label: "Try again", run: () => performExport(format) };
        showError(message, format);
        setStatus(message, "error", retry);
      }
    } finally {
      setExportBusy(false);
    }
  }

  function runExport() {
    if (selectedFormat === "pdf") exportPdf();
    else performExport(selectedFormat);
  }

  function retryExport() {
    if (lastAttempt === "pdf") exportPdf();
    else performExport(lastAttempt && FORMATS[lastAttempt] ? lastAttempt : selectedFormat);
  }

  function openDocument() {
    if (!chat || !included.size || busy) return;
    const blob = new Blob([exporter.documentHtml(exportChat(), formatOptions())], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url }).catch(() => setStatus("Could not open a new tab for the document.", "error"));
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    hideModal();
    setStatus("Document opened in a new tab - use Ctrl/Cmd+P there if the print dialog did not appear here.");
  }

  /* ------------------------------------------------------------------- wiring */

  function chooseFormat(format) {
    if (!FORMATS[format] || busy) return;
    selectedFormat = format;
    const input = document.querySelector(`input[name="format"][value="${format}"]`);
    if (input) input.checked = true;
    applyFormatUi();
    render(true);
    resetStage();
  }

  function updateSetting(key, value) {
    options[key] = key === "keepBlocks" ? value !== "auto" : value;
    persistSettings();
    applyFormatUi();
    render(true);
  }

  function bind() {
    for (const input of document.querySelectorAll('input[name="format"]')) {
      input.addEventListener("change", () => {
        if (input.checked) chooseFormat(input.value);
      });
    }

    for (const input of document.querySelectorAll('input[name="theme"]')) {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        options.theme = input.value;
        persistSettings();
        applyFormatUi();
        render(true);
        setStatus(`${THEME_LABELS[options.theme]} document theme applied to the preview and the download.`);
      });
    }

    ui.wordPalette.addEventListener("change", (event) => {
      options.docMode = event.target.value === "bw" ? "bw" : "color";
      persistSettings();
      applyFormatUi();
      if (selectedFormat === "docx") render(true);
      setStatus(
        options.docMode === "bw" ? "Word downloads will be black and white, for clean printing." : "Word downloads will be light and colourful.",
        "ok"
      );
    });

    ui.filenameInput.addEventListener("input", () => {
      options.filename = ui.filenameInput.value;
    });

    ui.remoteToggle.addEventListener("change", (event) => {
      options.remoteImages = event.target.checked;
      render(true);
      applyFormatUi();
      setStatus(options.remoteImages
        ? "Remote images enabled for this preview. Their hosts can receive your IP address and request timing."
        : "Remote images blocked. No remote image requests will be made by newly generated documents.");
    });

    for (const [input, key] of [
      [ui.timestampsToggle, "timestamps"],
      [ui.highlightToggle, "highlight"]
    ]) {
      input.addEventListener("change", () => {
        options[key] = input.checked;
        persistSettings();
        render(true);
      });
    }

    for (const [input, key] of [
      [ui.includeImages, "includeImages"],
      [ui.includeDiagrams, "includeDiagrams"],
      [ui.keepImagePositions, "keepImagePositions"],
      [ui.includeCover, "includeCover"]
    ]) {
      input.addEventListener("change", () => {
        options[key] = input.checked;
        persistSettings();
        applyFormatUi();
        render(true);
      });
    }

    for (const [input, key] of [
      [ui.includeCaptions, "includeCaptions"],
      [ui.includeImageSources, "includeImageSources"]
    ]) {
      input.addEventListener("change", () => {
        options[key] = input.checked;
        persistSettings();
        render(true);
      });
    }

    ui.imageLayout.addEventListener("change", () => {
      options.imageLayout = ["inline", "center", "fit"].includes(ui.imageLayout.value) ? ui.imageLayout.value : "center";
      persistSettings();
      render(true);
    });

    ui.imageQuality.addEventListener("change", () => {
      options.imageQuality = ui.imageQuality.value === "high" ? "high" : "standard";
      persistSettings();
      applyFormatUi();
      if (selectedFormat === "image") renderImage(true);
      setStatus(`PNG detail set to ${options.imageQuality === "high" ? "2x" : "1.5x"}.`);
    });

    for (const [input, key] of [
      [ui.pageSize, "pageSize"],
      [ui.orientation, "orientation"],
      [ui.margin, "margin"],
      [ui.keepBlocks, "keepBlocks"],
      [ui.bodyFont, "bodyFont"],
      [ui.monoFont, "monoFont"],
      [ui.fontSize, "fontSize"],
      [ui.lineSpacing, "lineHeight"],
      [ui.paraSpacing, "paragraphSpacing"]
    ]) {
      input.addEventListener("change", () => updateSetting(key, input.value));
    }

    byId("tab-export").addEventListener("click", () => switchTab("export"));
    byId("tab-messages").addEventListener("click", () => switchTab("messages"));
    byId("choose-messages").addEventListener("click", () => switchTab("messages"));
    byId("back-settings").addEventListener("click", () => {
      switchTab("export");
      document.querySelector(".panel").scrollIntoView({ behavior: "smooth", block: "start" });
      const first = ui.formatList.querySelector("input");
      if (first) first.focus({ preventScroll: true });
    });

    for (const button of [byId("manage-assets"), byId("open-assets"), byId("open-assets-stage")]) {
      button.addEventListener("click", openDrawer);
    }
    byId("close-assets").addEventListener("click", closeDrawer);
    byId("done-assets").addEventListener("click", closeDrawer);
    ui.drawerScrim.addEventListener("click", closeDrawer);

    ui.assetsAll.addEventListener("click", () => {
      excludedAssets.clear();
      options.excludedAssets = [];
      render(true);
      buildDrawer();
      setStatus("All available visuals are included.", "ok");
    });
    ui.assetsNone.addEventListener("click", () => {
      for (const asset of assetsForSelectedMessages()) excludedAssets.add(asset.id);
      options.excludedAssets = [...excludedAssets];
      render(true);
      buildDrawer();
      setStatus("All visuals excluded. Your images stay available if you change your mind.", "ok");
    });

    ui.primary.addEventListener("click", runExport);
    ui.openDoc.addEventListener("click", openDocument);
    ui.search.addEventListener("input", applySearch);
    bindPicker();

    ui.zoomIn.addEventListener("click", () => setZoom(zoom + 0.1));
    ui.zoomOut.addEventListener("click", () => setZoom(zoom - 0.1));
    ui.fitWidth.addEventListener("click", fitToWidth);
    ui.prevPage.addEventListener("click", () => scrollToPage(-1));
    ui.nextPage.addEventListener("click", () => scrollToPage(1));

    byId("modal-open-folder").addEventListener("click", () => {
      hideModal();
      if (chrome.downloads && typeof chrome.downloads.showDefaultFolder === "function") chrome.downloads.showDefaultFolder();
    });
    byId("modal-export-again").addEventListener("click", () => {
      hideModal();
      runExport();
    });
    byId("modal-retry").addEventListener("click", () => {
      hideModal();
      retryExport();
    });
    byId("modal-close").addEventListener("click", hideModal);
    byId("modal-success-close").addEventListener("click", hideModal);
    /* Reading or operating the notification cancels its dismissal: the timer
       only runs while the card is untouched. */
    for (const type of ["pointerenter", "pointerdown", "focusin", "keydown"]) {
      ui.modalSuccess.addEventListener(type, clearSuccessTimer);
    }
    byId("modal-info-close").addEventListener("click", hideModal);
    byId("modal-info-tab").addEventListener("click", openDocument);
    ui.cancelProgress.addEventListener("click", cancelOrClose);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!ui.drawer.hidden) {
        closeDrawer();
        return;
      }
      if (ui.modalScrim.hidden) return;
      // Escape stops an in-flight build; once it has stopped, it closes the card.
      if (!ui.modalProgress.hidden) cancelOrClose();
      else hideModal();
    });
  }

  function paintSettings() {
    drawSelectedTheme();
    ui.wordPalette.value = options.docMode;
    ui.timestampsToggle.checked = Boolean(options.timestamps);
    ui.highlightToggle.checked = options.highlight !== false;
    ui.remoteToggle.checked = false;
    ui.includeImages.checked = options.includeImages !== false;
    ui.includeCover.checked = options.includeCover === true;
    ui.includeDiagrams.checked = options.includeDiagrams !== false;
    ui.keepImagePositions.checked = options.keepImagePositions !== false;
    ui.includeCaptions.checked = options.includeCaptions !== false;
    ui.includeImageSources.checked = options.includeImageSources === true;
    ui.imageLayout.value = options.imageLayout;
    ui.imageQuality.value = options.imageQuality;
    ui.pageSize.value = options.pageSize;
    ui.orientation.value = options.orientation;
    ui.margin.value = options.margin;
    ui.keepBlocks.value = options.keepBlocks === false ? "auto" : "keep";
    ui.bodyFont.value = options.bodyFont;
    ui.monoFont.value = options.monoFont;
    ui.fontSize.value = options.fontSize;
    ui.lineSpacing.value = options.lineHeight;
    ui.paraSpacing.value = options.paragraphSpacing;
    ui.filenameInput.value = options.filename || "";
  }

  function showEmpty(message) {
    document.body.classList.add("is-empty");
    ui.empty.hidden = false;
    ui.drawer.hidden = true;
    ui.drawerScrim.hidden = true;
    byId("doc-title").textContent = "No conversation loaded";
    byId("doc-meta").textContent = "Waiting for an export";
    ui.primary.disabled = true;
    ui.openDoc.disabled = true;
    ui.stageNote.hidden = true;
    setStatus(message, "error");
  }

  async function init() {
    buildFormatCards();
    bind();
    let handoff = null;
    try {
      const id = new URLSearchParams(location.search).get("export");
      if (!id || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Missing export handoff.");
      const key = `export:${id}`;
      const handoffs = await chrome.storage.session.get(key);
      const stored = handoffs[key];
      await chrome.storage.session.remove(key);
      if (stored && Date.now() - stored.createdAt < 10 * 60 * 1000) {
        handoff = { chat: stored.chat, options: stored.options };
      }
    } catch {
      handoff = null;
    }

    /* One explicit settings flow: saved preferences, then the handoff that
       opened this tab, then normalisation. Preview and every download read the
       result, so how the export was started cannot change the output. */
    let saved = {};
    try {
      saved = await chrome.storage.local.get(SETTING_DEFAULTS);
    } catch {
      saved = {};
    }
    Object.assign(options, normalizeOptions(optionsFromSettings(saved), handoff && handoff.options));
    chat = handoff && handoff.chat ? handoff.chat : null;

    if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
      showEmpty("No conversation was handed over. Start an export from the popup, the selection bar or the right-click menu.");
      return;
    }

    ui.empty.hidden = true;
    tagAssets();
    paintSettings();

    /* The parser counts message containers it recognised but could not read.
       Saying so here is the difference between an incomplete export and an
       export the reader was warned about. */
    const coverage = chat.coverage || null;
    if (coverage && (coverage.unreadable > 0 || coverage.limitReached || coverage.complete === false)) {
      ui.coverageNote.hidden = false;
      const parts = [];
      if (coverage.unreadable > 0) {
        parts.push(`${coverage.unreadable} message container${coverage.unreadable === 1 ? "" : "s"} could not be extracted`);
      }
      if (coverage.limitReached || coverage.complete === false) {
        parts.push(`the thread walk stopped after ${coverage.steps || 0} step${coverage.steps === 1 ? "" : "s"}, so older turns may still be unmounted`);
      }
      ui.coverageNote.hidden = false;
      ui.coverageNote.textContent = `This export is incomplete: ${chat.messages.length} message${
        chat.messages.length === 1 ? "" : "s"
      } were collected, and ${parts.join("; ")}. Check the preview before exporting.`;
    }

    selectedFormat = FORMATS[options.format] ? options.format : "pdf";
    const formatInput = document.querySelector(`input[name="format"][value="${selectedFormat}"]`);
    if (formatInput) formatInput.checked = true;

    chat.messages.forEach((_message, index) => included.add(index));

    const audit = exporter.validateChat(chat);
    auditNotice = audit.ok ? "" : audit.summary;

    const count = chat.messages.length;
    const platform = chat.platformLabel || "AI conversation";
    document.title = `Export - ${chat.title || "AI conversation"}`;
    byId("doc-title").textContent = chat.title || "AI conversation";
    byId("doc-meta").textContent = `${count} message${count === 1 ? "" : "s"} · ${platform}${chat.model ? ` · ${chat.model}` : ""}`;
    ui.sourceTitle.textContent = chat.title || "AI conversation";
    ui.sourceMeta.textContent = `${platform}${chat.model ? ` · ${chat.model}` : ""}${chat.url ? ` · ${hostOf(chat.url)}` : ""}`;
    const platformSpan = ui.appSource.querySelector("span");
    if (platformSpan) platformSpan.textContent = platform;

    if (chat.url && /^https?:\/\//i.test(chat.url)) {
      ui.openSource.href = chat.url;
      ui.openSource.target = "_blank";
      ui.openSource.rel = "noopener noreferrer";
      ui.openSource.hidden = false;
    } else {
      ui.openSource.hidden = true;
    }

    buildPicker();
    updateSelectionUi();
    applyFormatUi();
    // "Review messages" in the popup opens this tab with ?tab=messages.
    if (new URLSearchParams(location.search).get("tab") === "messages") switchTab("messages");
    fitInitialZoom();
    applyScale();
    render(true);

    const note = auditNotice ? ` ${auditNotice}` : "";
    if (options.format && FORMATS[options.format]) {
      setStatus(`Preview ready for ${FORMATS[selectedFormat].label}. Check the document, then use ${PRIMARY_LABELS[selectedFormat] || "Export"}.${note}`);
    } else {
      setStatus(`Preview ready. Pick a format and theme, review the document, then export.${note}`);
    }
  }

  function hostOf(value) {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return "source";
    }
  }

  init();
})();
