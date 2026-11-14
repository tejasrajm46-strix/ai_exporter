# KNOWN_LIMITATIONS.md — AI Exporter v1.0

These are real, current limitations. Each was reached while testing or is inherent
to the browser platform; none is hidden from the user at export time.

## PDF

1. **PDF is produced by the browser's print pipeline.** The application cannot
   generate a PDF byte stream itself (no PDF library is bundled: it would add
   megabytes, and MathML/font fidelity would drop). Consequently:
   * the app cannot confirm that the user pressed "Save as PDF";
   * the UI says "Print dialog open" and never claims a file exists;
   * the final file name and page count are chosen in the dialog.
2. **Page numbers and running headers** come from the browser's print options,
   not from the document. The app tells the user to keep "Background graphics"
   on and turn "Headers and footers" off.
3. **The print dialog must be interactive.** If a browser blocks the call, the
   error offers "Open in tab" as the fallback.

## Word / DOCX

4. **No office suite was available on the build machine.** The package is
   validated structurally (ZIP signature, 14 well-formed XML parts, content
   types, relationships, valid OMML, `tblHeader`, nine numbering levels), but it
   has not been opened in Microsoft Word or LibreOffice here.
5. **Tabs in code become four spaces.** Tab stops are document settings; spaces
   survive every viewer and keep the indentation visible.
6. **Nested lists clamp at nine levels**, which is Word's own numbering limit.
   A tenth level continues at level nine.
7. **Syntax highlighting is a compact tokeniser**, not a full grammar. Strings,
   numbers, keywords and comments are coloured; exotic language constructs fall
   back to plain text inside a correctly coloured block.
8. **Word images are PNG/JPEG/GIF.** WebP and AVIF data URIs are transcoded to
   PNG so they are embedded rather than replaced by a placeholder.

## HTML / Markdown / TXT

9. **A `\$`-escaped dollar is unescaped** in output; a literal backslash-dollar
   cannot be expressed in these formats.
10. **An unclosed delimiter stays literal.** `Unclosed $\frac{a}{b}` is treated as
    prose: there is no formula to compile, and compiling part of a sentence would
    corrupt text. The TeX source is therefore visible in that sentence.
11. **A lone `$20` in the same run as an unbalanced `$`** can still be read as the
    start of a formula. Balanced input cannot hit this; it is inherent ambiguity
    in the source text.
12. **Markdown escapes `[` and `]` in prose** so they cannot open a link; a
    consumer that wants literal brackets sees `\[` `\]`.

## PNG

13. **One raster for the whole document**, so a very long conversation either
    degrades in scale (1.5× → 1.25× → 1× → 0.75× → 0.5× → 0.35×) or is refused
    with an explanation. It is never cropped.
14. **Mathematics in PNG uses the plain-text renderer** (`a/b`, `√(x+1)`),
    because a canvas cannot typeset MathML. The PDF/Word/HTML exports carry the
    real typeset form.
15. **Remote images are opt-in.** By default they are replaced by a labelled
    placeholder and reported in the export summary.

## Platform

16. **Only supported chat sites are parsed** (ChatGPT, Claude, Gemini, DeepSeek).
    An unsupported page produces no conversation rather than a guessed one.
17. **Exports run in the extension page, not the service worker**, so the tab must
    stay open for the duration of an export. Closing it aborts the export.
18. **Cancellation is cooperative between stages.** It aborts at every stage
    boundary, stops the download if it has not started, and releases object URLs;
    a large canvas rasterisation inside a single stage cannot be interrupted
    mid-draw (the browser gives no hook for that).

## Verification gaps (see TEST_REPORT §7)

19. The extension was not loaded as an unpacked extension and clicked through in
    this pass; the workspace controller was driven inside a DOM harness instead.
20. No accessibility, Lighthouse or cross-browser audit was performed (Chromium
    only).
