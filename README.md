<div align="center">

<img src="assets/hero.png" alt="AI Exporter — conversation in, document out" width="100%">

# AI Exporter

**Save your best AI conversations as beautifully formatted documents — on your own device.**

ChatGPT · Claude · Gemini · DeepSeek

**PDF · Markdown · Text · Word · PNG · JSON**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest_V3-a80033?style=flat-square)](manifest.json)
[![Local export](https://img.shields.io/badge/Export-On_your_device-067034?style=flat-square)](#privacy)
[![No build required](https://img.shields.io/badge/Setup-No_build_step-d9a73f?style=flat-square)](#get-started)

[Features](#features) · [Examples](#examples) · [Formats](#formats) · [Get started](#get-started) · [Privacy](#privacy)

</div>

## Features

- **Full transcript, in order** — every prompt and answer, with a cover page showing the platform, model, message count and export date.
- **Pick what to keep** — select messages on the page or in the export view, with one-click *Everything / Answers / Prompts / None* selectors.
- **Structure survives** — headings, lists, quotes, tables, images, code blocks and formula source are all kept.
- **Readable code** — language labels, syntax highlighting (toggle on or off), and separate panels for program output.
- **Three document looks** — colourful light, dark, or a black-and-white design that prints cleanly on a mono printer.
- **Preview before you save** — check the selection, zoom in, and toggle timestamps and highlighting before exporting.
- **Local and private** — parsing and document building run in your browser. No account, no analytics, no uploads.

## Formats

| Format | What you get |
| :--- | :--- |
| **PDF** | Styled A4 pages with selectable text. Saved through the browser's print dialog. |
| **Markdown** | Fenced code, tables and formula source, ready for notes and documentation. |
| **Text** | A simple reading copy with role headings and code. |
| **Word (.doc)** | Word-compatible document in colour or black-and-white. Ignores the PDF theme. |
| **PNG** | A tall conversation poster for sharing. |
| **JSON** | Structured messages and content blocks for your own tools. |

## Examples

### Three document looks

<img src="assets/modes.png" alt="AI Exporter document styles: colourful light, dark and black-and-white" width="100%">

Each look uses the same layout; only the colours change.

### Sample PDFs

Each sample is a full export of the same conversation, one per theme:

- [Light PDF](assets/sample-light.pdf) — colourful, for everyday reading
- [Dark PDF](assets/sample-dark.pdf) — dark reading theme
- [Black-and-white PDF](assets/sample-print.pdf) — for printing

### Common workflows

**Quick export.** Open a supported chat, click the **AI Exporter** toolbar icon, pick a format (for example PDF) and save.

**Custom selection.** Choose *Custom Export* or *Select messages* on the page. Tick the turns you want, click **Export selected**, then choose a format. Unticked turns are left out of that export.

**Right-click.** On a supported chat, right-click and choose **Export this AI chat**.

**Word for editing.** Choose Word (.doc) when you want to edit the document in Word. Pick colour or black-and-white in the export view.

**Code-heavy chats.** Keep *Highlight code* on for colour. Turn it off when printing on a mono printer.

## Get started

1. [Download the repository](https://github.com/tejasrajm46-strix/ai_exporter/archive/refs/heads/main.zip) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Open a supported conversation and click **AI Exporter** in the toolbar.

> **PDF tip:** in the print dialog choose **Save as PDF**, set paper to **A4**, and untick **Headers and footers**. Turn on **Background graphics** for the dark theme.

Refresh a chat tab after installing or updating, so the page picks up the extension.

## Supported sites

| Site | Status |
| :--- | :--- |
| ChatGPT | Checked on a live conversation. |
| Claude, Gemini, DeepSeek | Parsers are included but not yet checked on live pages. Please report any problems. |

AI sites change their layouts often. If detection fails, refresh the page and try again.

## Privacy

**No account. No analytics. No conversation uploads.** Parsing and document building happen in your browser. Your export settings are saved locally. The conversation is handed to the export page and removed from storage once that page opens. Remote images may still load from their original hosts.

## Limits

- Word export is `.doc` (Word-compatible HTML), not `.docx`.
- Formulas keep their source text rather than being typeset.
- Chrome's print dialog adds its own date and URL strip unless you untick **Headers and footers**. No CSS can remove it.

## For developers

Load the unpacked folder as above. No build step is needed.

Run the browser checks against a local server:

```bash
python -m http.server 8765
```

Then open `http://localhost:8765/selftest.html`. It checks the parser and the export engine, with no extension needed.

Project layout:

- `manifest.json` — permissions, supported sites, and the popup
- `utils/parser.js` — reads each site's conversation into one shared message format
- `utils/exporter.js` — builds the Markdown, text, JSON, Word, PNG and PDF documents
- `export/` — the export page: message picker, preview, downloads and print
- `popup/` — the toolbar popup
- `content/` — the on-page selection controls
- `assets/` — README artwork and sample PDFs
- `tools/` — scripts that regenerate the logo and the document-styles image
