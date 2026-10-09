<div align="center">

<img src="assets/hero.png" alt="AI Exporter — conversation in, document out" width="100%">

# AI Exporter

**Your best AI conversations. Beautifully saved.**

ChatGPT · Claude · Gemini · DeepSeek

**PDF · Markdown · Text · Word · PNG · JSON**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest_V3-a80033?style=flat-square)](manifest.json)
[![Local export](https://img.shields.io/badge/Export-On_your_device-067034?style=flat-square)](#privacy)
[![No build required](https://img.shields.io/badge/Setup-No_build_step-d9a73f?style=flat-square)](#get-started)

[Get started](#get-started) · [Features](#features) · [PDF samples](#document-styles)

</div>

## Features

- **Keep the conversation** — prompts and answers, in order, with message selection and one-click All / Answers / Prompts controls.
- **Preserve the structure** — headings, lists, quotes, tables, images, code blocks and formula source.
- **Make code readable** — syntax highlighting, language labels and distinct output panels.
- **Choose your look** — colourful light, dark or clean black-and-white document themes.
- **Preview before saving** — review your selection, adjust zoom and toggle timestamps or code highlighting.
- **Export your way** — polished documents, plain reading copies or structured data.

## Formats

| Format | What you get |
| :--- | :--- |
| **PDF** | Styled A4 pages with selectable text, saved through the browser print dialog. |
| **Markdown** | Fenced code, tables and formula source for notes and documentation. |
| **Text** | A simple reading copy with role headings and code. |
| **Word (.doc)** | Word-compatible HTML with independent colour or black-and-white styling. |
| **PNG** | A tall conversation poster. |
| **JSON** | Structured messages and content blocks for your own tools. |

## Document styles

<img src="assets/modes.png" alt="AI Exporter document styles: colourful light, dark and black-and-white" width="100%">

[Light PDF](assets/sample-light.pdf) · [Dark PDF](assets/sample-dark.pdf) · [Black-and-white PDF](assets/sample-print.pdf)

## Get started

1. [Download the repository](https://github.com/tejasrajm46-strix/ai_exporter/archive/refs/heads/main.zip) and unzip it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Open a supported conversation and click **AI Exporter** in your toolbar.

**Pick a format → review the preview → save what you need.**

You can also right-click a supported chat and choose **Export this AI chat**.

> **PDF tip:** choose **Save as PDF**, use A4 paper and turn off **Headers and footers**. Enable **Background graphics** for dark documents.

## Privacy

**No account. No analytics. No conversation uploads.** Parsing and document generation happen in your browser. Export preferences are saved locally; the temporary conversation handoff is cleared after the preview opens. Remote images may still contact their original hosts.

<details>
<summary><strong>A few useful details</strong></summary>

- AI sites change their layouts; detection can vary by platform. Refresh the chat tab after installing or updating.
- Word export is `.doc`, not OOXML `.docx`. Formulas retain their source rather than using a full mathematical typesetter.
- To run the browser checks, serve the repository with `python -m http.server 8765`, then open `http://localhost:8765/selftest.html`.

</details>
