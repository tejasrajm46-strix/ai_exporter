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
