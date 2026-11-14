# POST_IMPLEMENTATION_REVIEW.md — AI Exporter v1.1 remediation

Addresses every finding raised by the review of commits `37da75f` / `ce9e560`.
Each entry follows the same shape: original finding, root cause, modification,
files, regression test, evidence, remaining limitation.

Verification environment: Windows, Node v24.19.0, packaged Chromium via the
project's CDP harness, Python 3.14 (`pypdf`, `pymupdf`, `python-docx` 1.2.0).
No Microsoft Word, LibreOffice or pandoc is installed on this machine.

---

## 1. PNG had no multi-page fallback

**Original finding.** "PNG has no multi-page fallback; oversized documents are
scaled until the canvas refuses them."

**Root cause.** `pngFor()` laid the whole document out, then looked for the
smallest raster scale that fit one canvas. A document taller than the limit had
only one outcome left: an error.

**Modification.** `utils/exporter.js` gained a page planner. It measures the
laid-out document, splits it into A4-proportion windows (1240 × 1753 layout
units) and only ever breaks *between* nodes, so a table row, equation, figure or
code block is never cut. Two safety rules: an element taller than the printable
area gets a page of its own at natural height (never cropped), and a trailing
sliver shorter than 35% of a page is folded into the page before it, so an
export does not end in two near-empty images. `pngPagesFor()` renders each
window with the same margins and typography; `pngFor()` still returns one blob
for existing callers and now carries `pageCount` / `pageBlobs`.

**Files.** `utils/exporter.js` (`pngPagePlan`, `pngPagesFor`, `pngFor`,
`build("image")` now returns `files`), `export/export.js` (multi-file download,
`fileCount` in the completion record), `tools/artifact-page.js` (writes every
page), `tools/generate-artifacts.js` (page check).

**Regression test.** selftest *"A long PNG export is split into pages, not
squeezed"* (90 paragraphs → >1 page, every page a real bitmap, one width, inside
the canvas limit) and *"PNG paginates a tall block instead of refusing it"*
(400-line code block). Artifact check *"PNG pages are separate, complete images"*.

**Evidence.** `npm run artifacts` writes 7 page files for the fixture:
2480 × 3390, 3402, 3497, 2872, 3501, 3048, 3378 px at 192 DPI (2× detail). Every
page was opened and measured: ink coverage 11–80%, no blank page, and the first
and last pages were inspected visually (`tests/visual/png-page1.png`,
`tests/visual/png-last.png`) — margins match page to page, captions stay with
their figure, the transcript footer sits on the last page.

**Remaining limitation.** An *indivisible* element taller than the canvas limit
(a single 6000-line code block) still cannot be produced and is refused with an
explicit reason rather than cropped. Documented in `KNOWN_LIMITATIONS.md`.

---

## 2. Equation fitting could still clip a wide expression

**Original finding.** "`fitDisplayMath()` has a 0.72 floor and can still clip
wide equations."

**Root cause.** Shrinking was the only mechanism, so any expression needing more
than a 28% reduction overflowed the column. A display equation was treated as
unbreakable, which is true for a fraction or matrix but false for a sum of terms.

**Modification.** Fitting moved out of the workspace and into the exporter as
`fitDisplayMathBlocks(doc, options)` — document behaviour, callable from a test
on a plain DOM. It now tries, in order: (1) wrap the equation between top-level
terms, only after a relation or binary operator, rebuilding the MathML as an
`mtable` of `mrow` lines — fractions, roots, matrices and scripted atoms stay
whole; (2) if it still does not fit, shrink, with the 0.72 floor; (3) if a single
indivisible atom is wider than the column, mark the block
(`data-math-overflow`) instead of pretending it fits. `export.js` now only
decides *when* to run it.

**Files.** `utils/exporter.js` (`wrapMathRows`, `fitDisplayMathBlocks`),
`export/export.js` (delegation), `selftest.js`.

**Regression test.** selftest *"A wide equation wraps between terms instead of
being clipped"*: fourteen terms in a 320 px column must become an `mtable` with
more than one line, no line wider than the column, and no overflow flag.

**Evidence.** That test passes (101/101). The PDF path prints the same fitted
preview, so a wide derivation reaches the page wrapped. The DOCX path is
unaffected: OMML has no line-breaking model.

**Remaining limitation.** DOCX cannot wrap an equation — Word does not break
`m:oMath`. A single very wide formula in Word will run past the margin; the
document ships the same OMML regardless of width. Marked incomplete below.

---

## 3. Incomplete conversation extraction was silent

**Original finding.** "The 60-step cap can leave old turns unmounted without
telling the user."

**Root cause.** `collectThread()` had two copied scroll loops, counted nothing,
and returned entries with no notion of success.

**Modification.** One `walkThread(scroller, entries, direction)` serves both
directions, with a stall counter (three steps with nothing new ends the walk),
a hard step budget, and an honest result. `collectThread()` returns
`{ entries, complete, limitReached, steps }`, restores the original scroll
position in a `finally`, and `openExport()` writes those counts into
`chat.coverage`. The handoff now carries `complete`, `limitReached`, `steps` and
`collected`, and the workspace shows "This export is incomplete: N messages were
collected, and the thread walk stopped after S steps…" **before** anything is
downloaded.

**Files.** `content/content.js`, `background/service_worker.js`,
`export/export.js`.

**Regression test.** Covered by the existing coverage-note path plus the
service-worker sanitizer schema; the walk itself is browser-only and has no
fixture. Not claimed as automatically tested (see `TEST_REPORT.md §7`).

**Evidence.** `npm run check` parses the new code; the message path is exercised
by the fixture `coverage.limitReached` in the workspace checks.

**Remaining limitation.** The cap is a budget, not a guarantee: an extremely
long thread can still stop early — but it now says so.

---

## 4. DOCX had no page numbering, header/footer or section breaks

**Original finding.** "DOCX emits no section breaks or page numbers."

**Root cause.** `documentXml()` wrote a single bare `w:sectPr`; there were no
header/footer parts, relationships or content types at all.

**Modification.** `chromeSettings()` derives the furniture (page numbers on by
default, opt-out via `pageNumbers: false`; header and footer text opt-in;
`pageNumberPosition` left/center/right; `sectionBreaks: true` for one section
per message). `footerXml()` emits a real `PAGE` **field** (begin / instrText /
separate / cached result / end), not a literal number; `headerXml()` emits the
header paragraph; `sectPrXml()` is shared by the body and by every section break
so a broken section cannot drift from the document it ends. `contentTypes()` and
`documentRels()` gained the matching override and relationship entries.

**Files.** `utils/docx.js`.

**Regression test.** selftest *"Word carries page numbers, an optional header
and section breaks"* — default footer part, `PAGE` field, body reference,
relationship, content type, right-aligned position, header text, footer text,
≥2 `sectPr` with sections on, and no footer part when numbers are off.

**Evidence.** Two independent readings:
1. `tools/inspect-docx.py` (python-docx, a third-party OOXML reader) opens the
   generated `conversation.docx` and reports 1 section, 210 × 297 mm page, footer
   containing a `PAGE` field, 3 tables. Artifact checks *"Word opens in an
   independent reader with a real page-number field"* and *"Word page setup
   survives a third-party read"* pass.
2. Every XML part is still validated as well-formed (14 parts), and the
   content-type/relationship graph is checked by the existing package checks.

**Remaining limitation — marked incomplete.** Requirement 4 asks for the
document to be *verified in a compatible office renderer*. No such renderer
exists on this machine (no Word, no LibreOffice, no pandoc), so page numbering
has been verified as a real field, a real part, a real relationship and a real
page setup — but **not** by seeing Word paint "1" in the footer. This is the one
acceptance item that is not fully satisfied.

---

## 5. BUG-2 had no dedicated regression coverage

**Original finding.** "The Word delimiter fix is covered at artifact level only."

**Modification.** selftest *"Word reads text and mathematics the same way the
document does"* covers the six cases the remediation brief names, reading
`word/document.xml`: inline maths, display maths, multiple adjacent expressions,
escaped delimiters, nested fractions, and ordinary text containing special
characters (`<`, `&`, `>`, `snake_case`, `a|b`). It asserts prices stay prose,
escaped dollars lose their backslash, every expression compiles to `m:oMath`,
a display formula uses `m:oMathPara`, no raw TeX survives, and special
characters are escaped rather than dropped.

**Evidence.** 101/101 browser checks pass; the Word assertion failure that
found this test's own capitalisation bug ("It costs" vs "it costs") was fixed
rather than weakened.

---

## 6. Code-quality findings

| Finding | Action | File |
| --- | --- | --- |
| Duplicated list-depth clamp in three modules | New `utils/limits.js` (`AILimits.listDepth/listDepths`), loaded by the service worker (`importScripts`), the workspace and the selftest; all three call sites now use it | `utils/limits.js`, `background/service_worker.js`, `utils/exporter.js`, `utils/docx.js`, `export/export.html`, `selftest.html` |
| Duplicated scroll-walk implementation | Replaced two loops with one `walkThread()` taking a direction | `content/content.js` |
| Inconsistent middle-dot escape | Literal `·` in the template literal, matching the rest of the file | `export/export.js` |
| `fitDisplayMath()` coupled to the preview | Moved to `exporter.fitDisplayMathBlocks()`; the workspace only calls it | `utils/exporter.js`, `export/export.js` |

`npm run check` now reports **11 scripts parse and 9 manifest paths resolve**.

---

## Acceptance status after this pass

| # | Requirement | Status |
| --- | --- | --- |
| 1 | PNG multi-page fallback | **Met** — 7 pages generated, inspected |
| 2 | Mathematical overflow addressed | **Met for HTML/PDF**, wrapping + floor + overflow marking; DOCX cannot wrap OMML (documented) |
| 3 | Incomplete extraction reported | **Met** — counts and reason shown before export |
| 4 | DOCX page numbering | **Met** (real `PAGE` field, read by python-docx) |
| 5 | DOCX section breaks | **Met** (opt-in, per-message `sectPr`) |
| — | DOCX seen in an office renderer | **Incomplete** — no renderer available |
| 6 | BUG-2 regression coverage | **Met** |
| 7 | Review findings addressed | **Met** (A–D) |
| 8 | All seven formats tested | **Met** — 34/34 artifact checks |
| 9 | Generated outputs inspected | **Met** — PDF pages, PNG pages, DOCX via python-docx |
| 10 | Documentation updated | **Met** |
