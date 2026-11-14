# RELEASE_NOTES.md — AI Exporter v1.0

## v1.0 — 2026-11-14

This release closes the document-quality gaps found in the v0.9.5 line and proves
the result with generated files rather than with intentions. Seven formats,
mathematics across four engines, and a release gate of 96 browser checks plus
31 artifact checks were exercised on this machine.

### Fixed

**Mathematics next to prices (high).** `It costs $5 for $x^2$ units` used to
export as the formula `5for` in HTML/PDF, TXT and Markdown, destroying both the
price and the expression. Inline mathematics now follows Pandoc's delimiter rule
(opens and closes on a non-space) and, crucially, every renderer uses the *same*
token, so the four formats cannot disagree about where a formula begins.

**Word used its own delimiter scanner (high).** The same sentence reached
`word/document.xml` as maths `5 for`, with the real `x^2` demoted to prose and
` units and \` turned into an equation. `utils/docx.js` now consumes
`AIExporter.INLINE_MATH_SOURCE`.

**Escaped prices (low).** `\$5` printed its backslash in HTML, TXT and Markdown.
Escaped dollars are now parked on a sentinel before the maths scan and restored
after formatting.

**Empty formulas (low).** `$$ $$` raised a visible maths-error badge and a
"N expressions could not be rendered" warning. An empty formula is now dropped
silently; the surrounding sentence is untouched.

**Word integrals (medium).** `\int_0^1 x^2 dx` arrived in Word as a bare `∫`
glyph with ordinary scripts, because only `\limits` operators were recognised as
n-ary. Intended as `m:nary` with `limLoc="subSup"`, it now stretches to its
integrand like it does in the PDF.

### Added

* Four browser regression checks, including the brief's twelve expressions
  asserted structurally per engine (MathML element, OMML element, plain
  fallback, Markdown fidelity).
* Two byte-level artifact checks over the generated HTML, DOCX, Markdown and TXT.
* A regression paragraph in the artifact fixture, so every future artifact run
  proves the currency/escape/empty-formula behaviour.
* `tools/render-pdf-pages.py` for reproducible page rasterisation of the PDFs.
* Documentation set: `AUDIT_REPORT.md`, `IMPLEMENTATION_REPORT.md`,
  `BUG_FIX_REPORT.md`, `EXPORT_COMPATIBILITY.md`, `TEST_REPORT.md`,
  `REGRESSION_TESTS.md`, `RELEASE_NOTES.md`, `KNOWN_LIMITATIONS.md`.

### Unchanged on purpose

Parser, document model, MCQ folding, PNG canvas, image pipeline, print CSS,
workspace UI, cancellation, download confirmation and security posture. They were
audited, exercised by the suites and left alone: rewriting working renderers
would have added risk without adding capability.

### Verification at release

```
npm run check      10 scripts parse and 9 manifest paths resolve.
npm test           96/96 browser checks passed.
npm run artifacts  31/31 artifact checks passed.
```

Artifacts regenerated in `tests/output/` (7 formats, 5 print variants,
`verification.json`/`.md`) and inspected in `tests/visual/` (PDF page rasters,
400 dpi maths crops, PNG poster crops).

### Compatibility

No API, storage-schema or manifest change. Exports produced by v0.9.5 open in
v1.0 unchanged; the JSON schema version remains 1.
