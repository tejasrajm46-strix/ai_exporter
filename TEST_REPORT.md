# TEST_REPORT.md — AI Exporter v1.0

All results below are from commands executed on 2026-11-14 on this machine
(Windows, Node v24.19.0, packaged Chromium via the project's CDP harness).
Nothing here is projected or assumed.

## 1. Static check — `npm run check`

```
ok    background\service_worker.js
ok    content\content.js
ok    export\export.js
ok    popup\popup.js
ok    selftest.js
ok    utils\document-theme.js
ok    utils\docx.js
ok    utils\exporter.js
ok    utils\mcq.js
ok    utils\parser.js
ok    (9 manifest paths resolve)
10 scripts parse and 9 manifest paths resolve.
```

Exit status 0. Re-run after every edit in this pass.

## 2. Browser check suite — `npm test`

```
96/96 browser checks passed.
```

The suite boots `selftest.html` in headless Chrome against the real modules
(`utils/parser.js`, `utils/exporter.js`, `utils/docx.js`, `utils/mcq.js`,
`export/export.js`) and asserts DOM, canvas, MathML, OOXML and controller
behaviour. 92 checks existed; 4 were added in this pass (§4).

Console noise during the run is expected: the fixture references remote images
that cannot resolve offline (`ERR_NAME_NOT_RESOLVED`) and one deliberately
missing local image (404). They exercise the broken-image path.

## 3. Artifact verification — `npm run artifacts`

```
31/31 artifact checks passed.
```

This is real output, not a simulation: every format is generated in the browser
from the fixture conversation, written to `tests/output/`, and then inspected.
PDFs are produced with `Page.printToPDF` at each paper preset and read back with
`pypdf`.

| # | Check | Result |
| --- | --- | --- |
| 1 | All seven formats produced a non-empty file | 7 files |
| 2 | The test conversation validates against the document schema | 4 messages |
| 3 | HTML is standalone, script-free and carries a CSP | 131.5 KB |
| 4 | HTML carries MathML for every formula | 32 elements / 19 formulas |
| 5 | HTML escapes page text instead of activating it | literal HTML stays text |
| 6 | HTML print styles define paper, margins, repeated headers | A4 rule + thead |
| 7 | The long table keeps a real header row | HTML thead, Word tblHeader |
| 8 | Markdown preserves TeX, including matrix alignment | raw `&`, `$$` kept |
| 9 | Markdown keeps nested list indentation | 2 spaces, numbered |
| 10 | TXT reduces mathematics to readable words | no command names |
| 11 | **A price beside inline maths keeps both in every format** | new |
| 12 | **An escaped price and an empty formula damage nothing** | new |
| 13 | JSON is versioned and complete | 4 messages |
| 14 | DOCX is a valid package with every required part | 11 entries |
| 15 | Every DOCX XML part is well-formed | 14 parts |
| 16 | DOCX carries real OMML, not TeX text | 32 equations |
| 17 | DOCX embeds every valid image, reports broken bytes | 4 media + placeholder |
| 18 | DOCX code keeps indentation and syntax colours | spaces + colour runs |
| 19 | DOCX numbering declares all nine levels | bullet + decimal × 9 |
| 20 | DOCX table header repeats across pages | 71 rows, 1 repeating header |
| 21 | PNG has the reported dimensions and real DPI | 1240 × 10452 @ 96 DPI |
| 22 | PDF inspection ran | 5 files |
| 23 | PDF keeps A4 portrait geometry | 209.9 × 297 mm, 10 pages |
| 24 | PDF honours Letter landscape and narrow margins | 279.4 × 215.9 mm |
| 25 | PDF honours A4 wide margins | 10 pages |
| 26 | PDF cover option adds a title page | 11 vs 10 pages |
| 27 | No PDF page is blank | all pages carry text |
| 28 | PDF embeds real fonts | Palatino, Cambria Math, Consolas ×2 |
| 29 | PDF text is searchable | 6621 characters |
| 30 | PDF repeats the table header on later pages | 4 pages |
| 31 | PDF spans more than one page without clipping | 10, 14, 10 |

## 4. Tests added in this pass

`selftest.js` (browser, real modules):

1. `A price beside inline maths keeps both`
2. `An escaped price prints as a price`
3. `An empty formula is dropped instead of reported as a failure`
4. `The twelve required expressions compile in every engine`

`tools/generate-artifacts.js` (byte level, generated files):

5. `A price beside inline maths keeps both in every format`
6. `An escaped price and an empty formula damage nothing`

## 5. Structural maths matrix (check 4 detail)

For each of the brief's twelve expressions the check asserts the expected MathML
element, absence of TeX in the MathML, XML well-formedness, the expected OMML
element in `word/document.xml`, a plain-text fallback with no backslashes, and
identical TeX in Markdown. Measured engines:

| Expression | MathML | OMML | Plain |
| --- | --- | --- | --- |
| `\frac{a}{b}` | `mfrac` | `m:f` | `a/b` |
| `\frac{1}{\frac{a}{b}}` | nested `mfrac` | nested `m:f` | `1/(a/b)` |
| `\sqrt{x+1}` | `msqrt` | `m:rad` | `√(x+1)` |
| `\sqrt[3]{x}` | `mroot` | `m:rad` + `m:deg` | `√[3](x)` |
| `x^{n+1}` | `msup` | `m:sSup` | `x^(n+1)` |
| `a_{ij}` | `msub` | `m:sSub` | `a_(ij)` |
| `\frac{x^2+1}{x-1}` | `mfrac` + `msup` | `m:f` + `m:sSup` | `(x^2+1)/(x-1)` |
| `\sum_{i=1}^{n} i` | `munderover` | `m:nary` (`undOvr`) | `Σ_(i = 1)^(n) i` |
| `\int_0^1 x^2\,dx` | `msubsup` | `m:nary` (`subSup`) | `∫_0^1 x^2 dx` |
| `\begin{bmatrix}a&b\\c&d\end{bmatrix}` | `mtable` | `m:m` | `[a, b; c, d]` |
| `a+H=\{a+h:h\in H\}` | `mo` braces, `∈` | `m:oMath` runs | `a+H = {a+h:h ∈ H}` |
| `\lim_{x\to 0}\frac{\sin x}{x}` | `munder` + `mfrac` | `m:limLow` + `m:f` | `lim_(x → 0)(sin x)/(x)` |

## 6. Visual inspection performed

| Evidence | What was checked |
| --- | --- |
| `tests/visual/pdf/a4-page1.png`, `a4-page2.png`, `a4-page3.png` | rendering of the whole A4 document, geometry, margins |
| `tests/visual/pdf/landscape-page1.png` | Letter landscape with narrow margins |
| `tests/visual/pdf/table-page1.png`, `table-page2.png` | header repetition and long-table wrapping |
| `tests/visual/pdf/crop-sinx.png`, `crop-sqrt.png` | 400 dpi crops: fraction bar extent, radical overline extent |
| `tests/visual/png-top.png`, `png-bottom.png` | PNG poster header, maths fallback, no clipping at the end |
| `tests/visual/math-detail.png`, `html-print-a4.png`, `table-header.png` | regenerated by the artifact run |

Page rasterisation is reproducible with `python tools/render-pdf-pages.py`
(PyMuPDF). The PDF crops were also cross-checked numerically: on page 1 the
fraction bar of `\lim … \frac{\sin x}{x}` spans x = 297.8–324.8 pt at y = 730,
between its numerator (y ≈ 714) and denominator (y ≈ 733); the radical overline
for `\sqrt{x+1}` spans x = 286.5–317.2 pt, covering `x+1`, and the `\sqrt[3]{x}`
index sits at the top-left of its radical. No glyph was missing or clipped.

## 7. Not executed (stated plainly)

* The unpacked extension was **not** loaded into a Chrome profile and clicked
  through. The workspace controller was exercised inside the DOM harness
  (`selftest.html` loads `export/export.js` and drives progress, cancel, error
  and download paths), but not as `chrome-extension://…/export/export.html`.
* The interactive print dialog was **not** opened. PDFs were produced with
  headless `Page.printToPDF` from the same print stylesheet, which is what the
  dialog prints. The "dialog opened vs file saved" wording is verified by reading
  the code path, not by a user clicking Save.
* Microsoft Word and LibreOffice are **not installed** on this machine, so the
  .docx was not opened in an office application. Validity is established
  structurally (ZIP signature, 14 well-formed XML parts, relationships, content
  types, valid OMML).
* No accessibility or performance audit (Lighthouse) was run.

---

## 8. Remediation pass — results (v1.1)

```
npm run check      11 scripts parse and 9 manifest paths resolve.
npm test           101/101 browser checks passed.
npm run artifacts  34/34 artifact checks passed.
```

Checks added in this pass:

| Level | Check | What it proves |
| --- | --- | --- |
| selftest | Word reads text and mathematics the same way the document does | BUG-2: six cases over `word/document.xml` |
| selftest | Word carries page numbers, an optional header and section breaks | footer part, PAGE field, body reference, rel, content type, alignment, header/footer text, ≥2 `sectPr`, opt-out |
| selftest | A wide equation wraps between terms instead of being clipped | `mtable` wrapping, every line inside a 320 px column |
| selftest | A long PNG export is split into pages, not squeezed | 90 paragraphs → several pages, real bitmaps, one width, inside the canvas limit |
| selftest | PNG paginates a tall block instead of refusing it | 400-line code block still exports |
| selftest | PNG refuses an indivisible block taller than the canvas, with a reason | 6000-line block refused explicitly, never cropped |
| artifact | PNG pages are separate, complete images | 7 page files, identical width, non-empty |
| artifact | Word opens in an independent reader with a real page-number field | python-docx reads the PAGE field and the section |
| artifact | Word page setup survives a third-party read | 210 × 297 mm, 3 tables, read by python-docx |

Two checks were replaced rather than deleted: "PNG beyond every safe scale is
rejected before drawing" became "PNG paginates a tall block instead of refusing
it" and "PNG refuses an indivisible block…", because pagination is now the
correct behaviour for the case it described.

### Generated output inspected in this pass

* **PNG** — 7 pages: 2480 × 3390, 3402, 3497, 2872, 3501, 3048, 3378 px at
  192 DPI. Ink coverage measured per page (11–80%): no blank page. First and last
  pages viewed (`tests/visual/png-page1.png`, `tests/visual/png-last.png`):
  consistent margins, figures with their captions, transcript footer on the last
  page only, no clipping.
* **DOCX** — read by `python-docx`: opens, 1 section, 210 × 297 mm, footer with a
  real `PAGE` field, 3 tables. All 16 XML parts well-formed.
* **PDF** — unchanged in layout; 5 variants re-printed and re-inspected (A4
  portrait 10 pages, Letter landscape 14, wide margins 10, cover 11, table
  headers 4 pages). Text still searchable, fonts still embedded.
* **HTML / Markdown / TXT / JSON** — regenerated; all previous checks still pass.

### Still not executed

* No office renderer exists here, so DOCX page numbering has **not** been seen
  painted by Word/LibreOffice. It is verified as a real field, part,
  relationship and content type, read back by a third-party parser.
* The extension was not loaded as an unpacked extension; the controller runs in
  the DOM harness.
* The thread-walk completeness path has no browser fixture; it is verified by
  reading the code and by `npm run check`, not by driving a virtualised thread.
