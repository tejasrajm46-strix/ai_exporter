# EXPORT_COMPATIBILITY.md — AI Exporter v1.0

Measured from the artifacts generated on 2026-11-14 by `npm run artifacts`
(`tests/output/`, evidence table in `tests/output/verification.md`).

## Format matrix

| Feature | HTML | PDF (print) | DOCX | Markdown | TXT | PNG | JSON |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Headings / subheadings | H1–H6 | yes | Heading1–3 | `#`…`######` | underlined | canvas | block type |
| Paragraphs, bold, italic, inline code | yes | yes | yes | yes | plain | canvas | raw text |
| Links | `<a href>` | yes | hyperlink rels | `[text](url)` | URL as text | text | text |
| Ordered / unordered / nested lists | yes | yes | 9 numbering levels | 2-space nesting | indented | canvas | depths/orders |
| Tables | `thead` + wrap | `thead` repeats | `tblHeader` repeat | GFM, `\|` escaped | pipe-aligned | canvas | rows |
| Code blocks | highlighted, `pre` scroll | wraps, keeps indent | monospace runs, colour, shading | fenced + language | indented | plain mono | code + language |
| Blockquotes / callouts | yes | yes | shaded panel | `>` quote | indented | canvas | quote block |
| Images | inline/remote opt-in | yes | embedded media | `![](src)` | "[image]" note | drawn | src/alt |
| Captions / alt text | yes | yes | yes | caption line | caption line | yes | fields |
| Broken image | placeholder + report | placeholder | "Image not embedded" | alt text | note | placeholder | flagged |
| Display maths | MathML | MathML (fonts embedded) | OMML | `$$…$$` verbatim | plain words | plain words | TeX source |
| Inline maths | MathML | MathML | OMML | `$…$` verbatim | plain words | plain words | TeX source |
| Matrices / cases / aligned | MathML `mtable` | yes | `m:m` / `m:eqArr` | TeX verbatim | rows joined | grid text | TeX |
| Cover page | yes | yes (`includeCover`) | title block | front matter | header lines | header | metadata |
| Page size / orientation / margins | print CSS | A4/Letter × portrait/landscape × 3 margins | section properties | n/a | n/a | single canvas | n/a |
| Page numbers | browser dialog | browser dialog | not emitted | n/a | n/a | n/a | n/a |
| Syntax colour | CSS | yes | run colours | fences (no colour) | no | no | n/a |
| Unicode / emoji / CJK | yes | yes (embedded fonts) | yes (Cambria/Consolas fallback) | yes | yes | yes | yes |
| Long content | scrolls/paginates | paginates, no clipping | paginates | continuous | continuous | scale degrades, never crops | complete |

## Verified measurements

| Artifact | Value |
| --- | --- |
| `conversation-a4-portrait-normal.pdf` | 209.9 × 297 mm, 10 pages, 6621 extractable characters |
| `conversation-letter-landscape-narrow.pdf` | 279.4 × 215.9 mm, 14 pages |
| `conversation-a4-portrait-wide.pdf` | 210 × 297 mm, 10 pages |
| `conversation-a4-cover.pdf` | 11 pages (one extra title page) |
| `table-headers.pdf` | header row repeats on 4 pages |
| PDF fonts | Palatino Linotype (body/bold), Cambria Math, Consolas, Consolas Italic — all embedded, no missing glyphs observed |
| `conversation.docx` | 11 package entries, 14 XML parts, all well-formed, 32 OMML equations, 4 media parts |
| `conversation.html` | 131.5 KB standalone, script-free, CSP present, 32 `<math>` elements |
| `conversation.md` | 85.5 KB, TeX and `&` alignment preserved |
| `conversation.txt` | 6.3 KB, no TeX command names |
| `conversation.png` | 1240 × 10452 px, pHYs 96 DPI |
| `conversation.json` | schema version 1, 4 messages, all blocks |

## Format-specific notes

**PDF.** Produced by the browser's print pipeline, so the document is searchable,
fonts are embedded and `thead` repeats. The application reports "Print dialog
open", the estimated page count and a suggested file name; it cannot know whether
the user saved, so it never claims a file exists. Page numbers and headers live
in the browser's print options, not in the document.

**DOCX.** A hand-built OPC package (no library). `word/numbering.xml` declares
nine levels for bullets and nine for decimals; deeper nesting clamps to level 9,
which is Word's own limit. Tables set `w:tblHeader` so headers repeat. Images are
PNG/JPEG/GIF; WebP/AVIF data URIs are transcoded to PNG before packaging.

**HTML.** One file, no scripts, no external requests except images the user
explicitly opted into. A CSP meta element states that. Print styles define
`@page` size/margins and `thead { table-header-group }`.

**Markdown.** Mathematics is emitted as TeX, never converted, so any
maths-capable viewer renders it and a plain viewer still shows the source.

**TXT.** Mathematics is reduced to readable notation (`a/b`, `√(x+1)`,
`Σ_(i = 1)^(n) i`, `∫_0^1 x^2 dx`), and table cells are padded to a common
width. Nothing is truncated: a 60-word cell keeps all 60 words.

**PNG.** A single raster of the whole document; text is crisp at 1.5× (2× at
"high"). Mathematics uses the plain-text renderer because a canvas cannot typeset
MathML. Above the canvas limit the renderer lowers the scale and reports it.

**JSON.** Complete, schema-versioned normalised document; the source of truth for
any downstream tool.
