<div align="center">

<img src="assets/hero.png" alt="AI Exporter — conversation in, document out" width="100%">

# AI Exporter

**Turn any AI chat into a document you can keep. Locally.**

ChatGPT · Claude · Gemini · DeepSeek → **PDF · Markdown · TXT · DOC · PNG · JSON**

[![Manifest V3](https://img.shields.io/badge/manifest-v3-a80033?style=flat-square)](#)
[![No build step](https://img.shields.io/badge/build-none-38bd5d?style=flat-square)](#install)
[![No tracking](https://img.shields.io/badge/telemetry-none-067034?style=flat-square)](#privacy)
[![Self-check](https://img.shields.io/badge/self--check-53%2F53-d9a73f?style=flat-square)](#verify-it-yourself)
[![License](https://img.shields.io/badge/license-not%20chosen%20yet-6f5f63?style=flat-square)](#license)

<img src="assets/logo.svg" alt="AI Exporter mark" width="88">

</div>

A Chrome extension (Manifest V3, no build step, no dependencies) that reads the
conversation you are looking at and writes it out as a polished A4 document or a
clean data file. Nothing is uploaded anywhere: the parsing, the rendering and the
downloads all happen inside your browser.

---

## Why it exists

Copy-pasting a chat into a document loses the structure — code blocks arrive as
plain text, tables collapse, headings disappear. Screenshotting it loses the
text. AI Exporter keeps the structure it found on the page and rebuilds it as a
document: **headings, lists, quotes, tables, figures, LaTeX and syntax-coloured
code panels**, in order, with an A4 print layout that actually paginates.

|  |  |
| --- | --- |
| **PDF** | The styled A4 document through the browser's print pipeline: vector text, real page breaks, selectable, no rasterising. |
| **Markdown** | Fenced code, GFM tables and `$tex$` math, generated from the parsed block model. |
| **Text** | Plain reading copy: role headings, bullets, verbatim code. |
| **DOC** | The same styled document wrapped in a Word-compatible HTML header. |
| **PNG** | A single tall poster rendered on a canvas. |
| **JSON** | The parsed conversation object, verbatim. |

<a href="assets/sample-export.pdf"><img src="assets/document-preview.jpg" alt="A page of an exported conversation: cover, role chips, a table and a light code panel" width="420" align="right"></a>

**A real export is committed at [`assets/sample-export.pdf`](assets/sample-export.pdf)**
(39 pages, straight out of the print pipeline). The page on the right is the same
document layout rendered at preview scale.

Every exported document is the **full transcript** — every prompt and every
answer, in order. A turn can only be left out because you unticked it.

<br clear="right">

---

## Install

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Choose **Load unpacked** and select this folder.
3. Open a supported chat and click the AI Exporter button in the toolbar.

> If the popup says it cannot detect a chat, reload the extension **and** refresh
> the chat tab. A content script only runs in tabs that load after it.

## Use

Four ways in, one export surface out:

| Route | What it does |
| --- | --- |
| **Quick export** | Popup → check the detected conversation → pick a format. The export view opens and the file downloads from there. |
| **Custom selection** | Popup → **Select messages** → tick turns on the page. A floating bar opens the export view for exactly those turns. `Esc` exits. |
| **Right-click** | *Export this AI chat* on any supported page. |
| **Export view** | The preview itself: tick or untick any turn, switch theme and zoom, then save. |

### The export view

- **Messages panel** — every turn starts ticked, with role chips, code/table
  tags and a one-line snippet. `Everything` / `Answers` / `Prompts` / `None` set
  the whole set in one click, and whatever is ticked is what the preview, the
  print job and every download use. Nothing ticked disables the save buttons
  instead of writing an empty file.
- **Light theme is the paper theme** — code and output panels are light with
  dark ink, and page margins come from `@page`, so *every* printed page gets a
  real margin rather than only the first one. The dark theme is for reading on
  screen and keeps its dark panels.
- **A live page estimate** in the status bar, so you know what you are about to
  print.
- **Printing tip:** in the print dialog, untick **Headers and footers** — that
  is Chrome's own date/title/URL strip in the margins, not part of the document.

## Privacy

- No server, no account, no telemetry, no analytics, no Notion.
- Conversation text is read only after you ask for it, and the export view reads
  the hand-off once and then deletes it from `chrome.storage.session`. Nothing
  else is stored: `chrome.storage.local` holds your three preferences and
  nothing else.
- The only permissions requested are the ones the flow uses, and the host
  matches are limited to the four supported sites.

## How it fits together

```mermaid
flowchart LR
  P[popup] -->|"GET_PAGE_STATE / EXPORT"| C[content script]
  M[context menu] --> C
  C -->|parsed chat + options| SW[service worker]
  SW -->|"validated, stashed, then deleted"| V[export view]
  V --> D[PDF · Markdown · TXT · DOC · PNG · JSON]
```

```
manifest.json                 MV3 wiring, permissions, icons, content-script matches
background/service_worker.js  context menu, payload validation, opens the export view
content/content.js            page state, in-page selection mode, export requests
content/content.css           injected checkbox + floating action bar
popup/popup.{html,js,css}     detection, quick export grid, settings
export/export.{html,js,css}   preview tab: message picker, options, downloads, print
utils/parser.js               site-aware DOM extraction into the message schema
utils/exporter.js             markdown, txt, json, doc, html document, png
selftest.html                 53 runnable parser + exporter checks
tools/make-logo.py            generates assets/ and icons/ from one geometry spec
```

**One export surface.** The popup, the selection bar and the context menu only
build a chat payload; the service worker validates it, stashes it and opens the
export view. That way no export logic ever runs in a context that can be closed
mid-flight, and the popup never has to survive being dismissed.

**One content model.** `sectionsFor()` turns messages into turns, and the
printed document and the PNG poster both render from it — there is no second
content mode to keep in sync.

## The mark

The mark is a tile and a four-point spark: a conversation read *at a glance*.
Crimson tile, gold spark, both built from one geometry spec, so the SVG in this
repo and the PNGs in `icons/` can never drift apart.

```bash
python tools/make-logo.py          # regenerate assets/ and icons/
python tools/make-logo.py --concepts scratch/   # + the three concept drawings
```

| Token | Hex | Where it lives |
| --- | --- | --- |
| Wine | `#850027` | the document's ink accent — headings, chips, note callouts |
| Crimson | `#a80033` | the brand mark and the light-surface actions |
| Gold | `#d9a73f` | the spark, focus rings, the primary action on dark chrome |
| Green | `#38bd5d` | "answered" and success states |
| Deep green | `#067034` | tip callouts in the printed document |

## Supported sites

- **ChatGPT** — verified against a real logged-in conversation.
- **Claude** — `[data-testid="user-message"]`, `.font-claude-response`.
- **Gemini** — `user-query-content` / `model-response`.
- **DeepSeek** — `.ds-markdown`; user turns use hashed class names, so that part
  is best-effort.

Each site lives behind one small selector adapter in `utils/parser.js`. When a
site ships a redesign, that adapter is the only thing that needs updating.

## Verify it yourself

`selftest.html` runs **53 checks** over the parser and the export engine. Its
fixture is copied from a **live ChatGPT conversation** (September 2026), with the
awkward parts kept: turns are `<section data-testid="conversation-turn-N">`, the
role attribute sits on a descendant, code lives inside an inline CodeMirror
viewer (`<pre>` → `.cm-editor` → `<pre class="cm-content">` → `<code>`), the
language label is a `<div>` *inside* the `<pre>`, and tables are wrapped in
`div.TyagGW_tableContainer`.

Open it as an extension page (`chrome-extension://<id>/selftest.html`) or through
any static server:

```bash
python -m http.server 8000     # then visit http://127.0.0.1:8000/selftest.html
```

It prints `PASS n/n` and exposes `window.__selftest` with per-check detail.

## Deliberate limits

- **No vendored libraries.** Manifest V3 forbids remotely hosted code, so
  Turndown, Prism, KaTeX and html2pdf are not used: Markdown is generated from
  the block model, highlighting is a compact tokenizer, math is kept as TeX and
  PDF comes from the browser's own print pipeline.
- **No page numbers and no table of contents in the document.** Page breaks land
  where the content lands, so a printed number would be a guess; use the print
  dialog's own page numbers.
- **Embedded images** are referenced by URL (`data:` or `https:` only). Signed
  page URLs can expire, in which case the export shows a captioned placeholder.
- **The PNG poster** reports images as labelled placeholders.
- **Site DOMs change.** Claude, Gemini and DeepSeek adapters were written from
  documented markup and have not been re-verified against a live logged-in
  session.

## License

No license file yet — that is a decision for the author, and without one the
code is "all rights reserved" by default. MIT or Apache-2.0 are the usual picks
for an extension like this.
