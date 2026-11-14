<p align="center">
  <img src="./assets/hero.svg" width="100%" alt="AI Exporter — export AI conversations as real documents">
</p>

<h1 align="center">AI Exporter</h1>

<p align="center">
  <b>Your best AI answer should not die in a chat tab.</b><br>
  A Manifest V3 Chrome extension that turns a ChatGPT, Claude, Gemini or DeepSeek conversation<br>
  into a document you own — parsed from the page, previewed first, saved locally.
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-FF5100?style=flat-square&labelColor=000000">
  <img alt="Version 1.0.0" src="https://img.shields.io/badge/version-1.0.0-FF5100?style=flat-square&labelColor=000000">
  <img alt="101 checks passing" src="https://img.shields.io/badge/checks-101%20passing-FF5100?style=flat-square&labelColor=000000">
  <img alt="Seven formats" src="https://img.shields.io/badge/formats-7-FF5100?style=flat-square&labelColor=000000">
  <img alt="Local by default" src="https://img.shields.io/badge/local-by%20default-FF5100?style=flat-square&labelColor=000000">
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-FF5100?style=flat-square&labelColor=000000">
</p>

<p align="center">
  <a href="#install"><b>Install</b></a> ·
  <a href="#formats">Formats</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#verification">Verification</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <video src="https://github.com/tejasrajm46-strix/ai_exporter/raw/main/assets/AI_EXPORTER_INTRO.mp4" width="100%" controls muted playsinline poster="./assets/screenshots/studio.png">
    Picking Word as the format, switching the document to dark and exporting from the preview workspace.
  </video>
</p>

<p align="center"><sub>60-second walkthrough: choose a format, restyle the page, export from the preview · <a href="./assets/AI_EXPORTER_INTRO.mp4">watch the mp4</a> (no audio, 26 MB)</sub></p>

---

## The problem

A useful AI answer usually dies in a chat tab. Copying it into a document loses
the headings, the table, the mathematics and the code block; screenshotting it
loses the text; "print to PDF" gives you the sidebar, the buttons and the scroll
container.

## The approach

1. **Read the page you already have open.** No API key, no account, no export
   endpoint. Four small site adapters turn the rendered DOM into typed blocks.
2. **Rebuild the structure, not the text.** Headings, nested lists, tables,
   quotes, notes, figures, language-tagged code and real equations become
   document blocks — one model, seven renderers.
3. **Show the document before writing it.** The preview *is* the file: the same
   HTML, the same pagination, the same figures. Nothing is exported unseen.

No account. No server. No telemetry. Nothing about your conversation leaves the browser.

## Features

| | Feature | What it does |
| --- | --- | --- |
| 🗂 | **Seven formats** | PDF through the browser print dialog, a real `.docx`, standalone HTML with embedded images, Markdown, plain text, a **paginated PNG** and structured JSON for scripts. |
| 🎚 | **Choose the scope** | Export the whole conversation or review first: search messages, keep answers only, keep prompts only, or tick individual messages on the page itself. |
| 🎨 | **Three document styles** | Light paper, dark paper or a print theme, plus a separate black-and-white palette for Word. The interface theme never restyles a document. |
| 🧱 | **Structure survives** | Headings, nested lists, tables, quotes, notes, dividers, language-tagged code and syntax colouring are rebuilt as blocks instead of flattened text. |
| ∑ | **Mathematics that reads** | KaTeX and MathML become real inline and display equations with correct spacing; a boxed answer stays boxed. Word gets editable **OMML**, not TeX pasted as text. |
| 🖼 | **Visual assets** | Images, diagrams and charts land in an asset drawer: include or exclude them, choose inline / centred / fit-to-page, keep captions and alt text. |
| 📐 | **Typesetting controls** | A4 or Letter, portrait or landscape, margins, page-break policy, body and code font, type size, line spacing, paragraph spacing — applied to preview and download together. |
| 📄 | **Word that behaves like Word** | Real page size and margins, repeating table headers, a genuine `PAGE` field in the footer, optional header/footer text, and opt-in section breaks between messages. |
| 🖼 | **Long conversations become pages** | A PNG export that outgrows one canvas is split into A4-proportion pages with matching margins, breaking only between blocks — never through a table, figure or equation. |
| 🩹 | **Recovers on its own** | A tab that was open before install, reload or update has no content script; the popup and the right-click action repair the page on demand instead of asking you to reload. |
| 🔍 | **Honest about failure** | An unreadable message container, a blocked image or a thread walk that hit its step limit is reported with counts — never exported quietly as if it were complete. |

## Supported sites

| Platform | Hosts | Notes |
| --- | --- | --- |
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` | Both the classic turn markup and the newer per-account layout. |
| **Claude** | `claude.ai` | Current and previous response containers. |
| **Gemini** | `gemini.google.com` | `user-query` / `model-response` custom elements. |
| **DeepSeek** | `deepseek.com` | Hashed class names, so the adapter leans on the stable answer body plus a structural fallback. |

These sites change their DOM without notice. Each is a small selector adapter;
the parser de-duplicates candidates, prefers a container that can name its own
role, orders everything by document position, and counts anything it could not
read.

## Install

Nothing is built and nothing is fetched at runtime: the folder *is* the extension.

1. **Get the folder** — clone this repository, or download the release archive and unzip it. You should end up with a folder containing `manifest.json`.
2. **Open `chrome://extensions`** in Chrome, Edge, Brave or any Chromium browser.
3. **Turn on Developer mode** (top right).
4. **Choose “Load unpacked”** and select the folder that contains `manifest.json`.
5. **Pin the toolbar icon** so the popup is one click away.

Open a conversation on a supported site and click the icon. After pulling new
code, press the reload arrow on the extension card — an open tab repairs itself
on the next click.

### What each permission is for

| Permission | Why it is requested |
| --- | --- |
| `activeTab` | Read the tab you clicked the icon on, without standing access to every site. |
| `scripting` | Inject the parser into a tab opened before install or update. |
| `storage` | Remember format and style choices; carry the parsed chat to the export tab. |
| `downloads` | Save the generated file (or every page of a paginated PNG). |
| `contextMenus` | Add **Export this AI chat** to the right-click menu. |
| Host permissions | The four supported chat hosts. Without them the page cannot be read or repaired. |

## Formats

| Format | What you get | How it is produced |
| --- | --- | --- |
| **PDF** | Paged document, A4 or Letter, portrait or landscape | The preview document is printed; final pagination comes from the print engine. |
| **Word `.docx`** | Editable headings, lists, tables, code, images, notes, **OMML equations**, page numbers | OOXML written in the browser from the same blocks and page geometry. |
| **HTML** | One standalone page, images embedded, CSP locked down | The exported document with inline styles. |
| **Markdown** | Headings, lists, tables, fenced code, image references | Serialised from the same blocks as the preview. |
| **TXT** | Reading copy without markup | Plain serialisation. |
| **PNG** | One poster, or **several A4-proportion pages** for a long conversation | Rendered at 1.5× or 2× detail; pages break only between blocks. |
| **JSON** | The parsed conversation, structured | Messages, roles, blocks, code and formulas. |

## How it works

<p align="center">
  <img src="./assets/architecture.svg" width="100%" alt="Four stages: chat page, content-script parser, service worker router, export studio renderers, then local files.">
</p>

| Stage | File | Responsibility |
| --- | --- | --- |
| 1 · Source | — | The conversation as rendered on the page you already have open. |
| 2 · Content script | `utils/parser.js`, `content/content.js` | Site adapters, block collection, maths normalisation, selection bar, in-page toast. |
| 3 · Service worker | `background/service_worker.js` | Context menu, on-demand injection, opening the export tab. |
| 4 · Export studio | `export/`, `utils/exporter.js`, `utils/docx.js`, `utils/document-theme.js` | Document model, HTML/print/PNG renderers, OOXML writer, preview, downloads. |

1. **Detect.** The popup asks the active tab for its state. The content script
   picks the adapter for the hostname, collects candidate message containers,
   removes nested duplicates, sorts by document position and resolves the speaker.
2. **Read.** Each message is walked once into typed blocks — heading, paragraph,
   list, quote, table, code, image, formula, divider — with inline emphasis and
   maths kept as markers. KaTeX annotations become `$…$`; display maths is lifted
   out of the paragraph that carried it. Nothing is re-parsed later, so every
   renderer sees the same structure.
3. **Hand off.** The parsed chat goes into `chrome.storage.session`; the workspace
   reads it and deletes it, so closing the popup can never interrupt an export.
   The record carries its own coverage — message count, whether the walk
   completed, whether it hit its step limit.
4. **Render.** The document is built once per change inside a sandboxed frame.
   PDF prints that document; Word writes OOXML from the same blocks and the same
   page geometry; HTML embeds its images; Markdown and text serialise the blocks;
   PNG rasterises the layout into pages; JSON hands the structure over untouched.
5. **Explain.** Progress names the real stages, the success state names the real
   file (and how many pages, for a paginated PNG), and a browser refusal becomes a
   visible error with a retry action instead of a silent failure.

### Two palettes, one boundary

The interface is jet black, soft white and flame orange. An exported document is
paper: white or charcoal, near-black ink, hairline rules, colour only where it
carries meaning. `utils/document-theme.js` owns the document palette and nothing
in the interface can restyle a page; no interface colour or logo reaches a file.

## Document design

Documents open on the conversation, not a cover: the title page is available in
**Advanced → Document layout** and is off by default. Headings are navy on light
paper, body text is charcoal, mathematics is body ink, rules are hairlines and
tables keep minimal borders.

<p align="center">
  <img src="./assets/screenshots/document-dark.png" width="49%" alt="A dark document page with an equation, a table and a highlighted code block.">
  <img src="./assets/screenshots/document-print.png" width="49%" alt="The printable document theme with black-and-white typography.">
</p>

## Screenshots

<p align="center">
  <img src="./assets/screenshots/studio.png" width="100%" alt="The export workspace: control panel on the left, live document preview on the right.">
</p>

<p align="center">
  <img src="./assets/screenshots/popup.png" width="30%" alt="The popup with a detected conversation, scope, format and document style.">
  <img src="./assets/screenshots/studio-messages.png" width="34%" alt="The message picker with search and quick selection actions.">
  <img src="./assets/screenshots/studio-settings.png" width="34%" alt="Advanced settings for page layout, typography and code output.">
</p>

## Verification

Exports are checked against generated files, not just against source code.

```bash
npm run check       # 11 scripts parse, 9 manifest paths resolve
npm test            # 101 checks in a headless Chromium
npm run artifacts   # 34 checks over seven generated artifacts
```

* **101 browser checks** drive the real parser, exporter, document builder and
  OOXML writer against synthetic fixtures — inline and display maths, escaped
  delimiters, nested lists, tables, code, images, themes, selection rules, the
  popup flow and the download path.
* **34 artifact checks** write PDF, DOCX, HTML, Markdown, TXT, PNG and JSON to
  `tests/output/`, then inspect the bytes: page geometry, embedded fonts,
  searchable text, repeated table headers, image presence, OMML counts, PNG page
  files, and the Word package read back by `python-docx`.
* **Evidence** lives in `TEST_REPORT.md`, `tests/output/verification.md` and
  `POST_IMPLEMENTATION_REVIEW.md`, with rendered page images under `tests/visual/`.

What is *not* covered: signed-in parsing on the four live sites (fixtures
reproduce their structure), and Word page numbering has been verified as a real
`PAGE` field, footer part and relationship — but not watched in a Word window,
because no office renderer is installed here.

## Privacy

- No analytics, no telemetry, no remote fonts. Every typeface is a bundled WOFF2.
- The conversation is parsed and rendered inside the extension; there is no upload
  path in the code.
- Remote images are blocked unless you enable them for that preview. The workspace
  says that the image host can then see your IP address, and the choice is never
  saved.
- The parsed conversation lives in `chrome.storage.session`, expires after ten
  minutes, and is deleted when the export view reads it.

## Development

```bash
npm run check      # node --check every script + verify manifest paths
npm run package    # build dist/AI_exported_1.0.zip (extension files only)
```

The self-check page exercises the real parser, exporter, document generator and
Word writer against synthetic fixtures — no real conversation and no network.
Serve the extension folder itself (the directory containing `manifest.json`),
because the interactive sample loads `export/` and `ui/` by relative path:

```bash
npx --yes serve -l 8080 .
# open http://localhost:8080/selftest.html
```

It must be served over HTTP rather than opened as a file, because the sample
fetches `export/export.html` to boot the real controller. The page reports
**101 checks, 0 failures**; `npm test` runs the same page headlessly through
`tools/cdp.js`.

The artwork and diagrams in this README are generated from the extension's own
stylesheets, so they cannot drift from the shipped interface.

```text
STRIX_AI_Exporter/
├── manifest.json            MV3 manifest: permissions, hosts, entry points
├── background/service_worker.js   context menu, injection, tab opening
├── content/                 message protocol, selection bar, thread walk
├── popup/                   detection screen: scope, format, style
├── export/                  export workspace: preview, settings, downloads
├── utils/
│   ├── parser.js            site adapters → typed blocks
│   ├── exporter.js          document model, HTML/print/PNG pagination, maths fitting
│   ├── docx.js              OOXML writer: OMML, page fields, sections
│   ├── document-theme.js    the document palette
│   ├── limits.js            shared numeric limits
│   └── mcq.js               multi-choice grouping across renderers
├── ui/                      tokens, shared components, icons, WOFF2 fonts
├── assets/                  README artwork, screenshots and the walkthrough video
├── tools/                   check, tests via CDP, artifacts, packaging
├── selftest.html            browser regression page
└── selftest.js              the checks themselves
```

## Limitations

- **PDF** is produced by the browser print dialog; the final page count and
  pagination are applied there.
- **Word cannot wrap an equation.** Equations are real OMML and render in Cambria
  Math, but an expression wider than the text column runs past the margin; HTML
  and PDF wrap it at top-level operators instead.
- **A PNG page must be rasterisable.** A conversation is split into pages, but a
  *single* block taller than the canvas limit (for example a 6000-line code
  block) is refused with an explicit reason rather than cropped.
- **The supported sites change their markup regularly.** A redesigned layout can
  reduce what is parsed; the extension reports missing messages instead of
  exporting a partial conversation quietly.
- **Live signed-in parsing is not automated.** The fixtures reproduce each site's
  document structure; the extension was not driven against four signed-in accounts
  in CI.

## Contributing

Issues and pull requests are welcome. Before opening a PR, run `npm run check`,
`npm test` and `npm run artifacts` and paste the counts — every change to a
renderer is expected to arrive with a check that would have failed before it.

## License

MIT — see [LICENSE](./LICENSE).
