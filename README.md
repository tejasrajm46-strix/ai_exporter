<h1 align="center">AI Exporter</h1>

<p align="center">
  <b>Your best AI answer should not die in a chat tab.</b><br>
  A Manifest V3 Chrome extension that turns a ChatGPT, Claude, Gemini or DeepSeek conversation<br>
  into a document you own — parsed from the page, previewed first, saved locally.
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-FF5100?style=flat-square&labelColor=000000">
  <img alt="Version 1.0.0" src="https://img.shields.io/badge/version-1.0.0-FF5100?style=flat-square&labelColor=000000">
  <img alt="Seven formats" src="https://img.shields.io/badge/formats-7-FF5100?style=flat-square&labelColor=000000">
  <img alt="Local by default" src="https://img.shields.io/badge/local-by%20default-FF5100?style=flat-square&labelColor=000000">
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-FF5100?style=flat-square&labelColor=000000">
</p>

---

No account. No API key. No server. No telemetry. Nothing about your conversation leaves the browser.

## Install

The folder *is* the extension — nothing is built and nothing is fetched at runtime.

1. Clone this repository, or download it as an archive and unzip it. You end up with a folder containing `manifest.json`.
2. Open `chrome://extensions` in Chrome, Edge, Brave or any Chromium browser.
3. Turn on **Developer mode** (top right).
4. Choose **Load unpacked** and select the folder that contains `manifest.json`.
5. Pin the toolbar icon so the popup is one click away.

Open a conversation on a supported site and click the icon. After updating the code, press the reload
arrow on the extension card — an open tab repairs itself on the next click.

## Formats

| Format | What you get |
| --- | --- |
| **PDF** | Paged document, A4 or Letter, portrait or landscape, via the browser print dialog |
| **Word `.docx`** | Editable headings, lists, tables, code, images, notes, real OMML equations, page numbers |
| **HTML** | One standalone page with its images embedded |
| **Markdown** | Headings, lists, tables, fenced code, image references |
| **TXT** | Reading copy without markup |
| **PNG** | One poster, or several A4-proportion pages for a long conversation |
| **JSON** | The parsed conversation, structured: messages, roles, blocks, code and formulas |

Scope, document style (light / dark / printable), page size, orientation, margins, type size, line and
paragraph spacing, code highlighting, image placement and the file name are all chosen next to the live
preview, and the preview is the same document that gets downloaded.

## Supported sites

| Platform | Hosts |
| --- | --- |
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` |
| **Claude** | `claude.ai` |
| **Gemini** | `gemini.google.com` |
| **DeepSeek** | `deepseek.com` |

These sites change their markup without notice. Each is a small selector adapter; when a layout changes,
messages that cannot be read are reported instead of being exported quietly as if the conversation were complete.

## How it works

| Stage | Files | Responsibility |
| --- | --- | --- |
| 1 · Read the page | `utils/parser.js`, `content/content.js` | Site adapters, block collection, maths normalisation, selection bar |
| 2 · Hand off | `background/service_worker.js` | Validates the parsed chat, stores it in `chrome.storage.session`, opens the studio |
| 3 · Render | `utils/exporter.js`, `utils/docx.js`, `utils/document-theme.js` | Document model, HTML/print/PNG renderers, OOXML writer |
| 4 · Save | `export/export.js` | Preview, settings, `chrome.downloads` |

The conversation is parsed once into typed blocks (heading, paragraph, list, quote, table, code, image,
formula, divider) and every renderer consumes that same model, so Word, PDF, HTML, Markdown, text, PNG and
JSON cannot disagree about structure.

## Permissions

| Permission | Why it is requested |
| --- | --- |
| `activeTab` | Read the tab you clicked the icon on |
| `scripting` | Inject the parser into a tab opened before install or update |
| `storage` | Remember format and style choices; carry the parsed chat to the export tab |
| `downloads` | Save the generated file (or every page of a paginated PNG) |
| `contextMenus` | Add **Export this AI chat** to the right-click menu |
| Host permissions | The four supported chat hosts; without them the page cannot be read or repaired |

## Privacy

- No analytics, no telemetry, no remote fonts — every typeface is a bundled WOFF2.
- The conversation is parsed and rendered inside the extension; there is no upload path in the code.
- Remote images are blocked unless you enable them for that one preview, and the choice is never saved.
- The handoff record expires after ten minutes and is deleted when the export view reads it.

## Project structure

```text
manifest.json              MV3 manifest: permissions, hosts, entry points
background/                service worker: validation, handoff, context menu
content/                   message protocol, in-page selection bar, thread walk
popup/                     detection screen: scope, format, document style
export/                    export studio: preview, settings, downloads
utils/                     parser, document model, renderers, Word writer, limits
ui/                        design tokens, shared components, logo, WOFF2 fonts
icons/                     toolbar icons
```

## Known limitations

- **PDF** is produced by the browser print dialog; final pagination is applied there.
- **Word cannot wrap an equation.** Equations are real OMML, but an expression wider than the text
  column runs past the margin; HTML and PDF wrap it at top-level operators instead.
- **A PNG page must be rasterisable.** A single block taller than the canvas limit (for example a
  6000-line code block) is refused with an explicit reason rather than cropped.
- **Live signed-in parsing is not automated.** The parser and renderers were exercised in headless
  Chromium against fixtures that reproduce each site's document structure, and every format was checked
  by inspecting the generated bytes — but not by driving four signed-in accounts.

## License

MIT — see [LICENSE](./LICENSE).
