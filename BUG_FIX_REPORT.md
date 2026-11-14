# BUG_FIX_REPORT.md — AI Exporter v1.0

Five defects were confirmed by execution, fixed at the root, and covered by a
regression check. "Confirmed" means reproduced in the real exporter, not
suspected from reading code.

---

## BUG-1 — A price beside a formula was typeset as mathematics (High)

**Symptom.** `It costs $5 for $x^2$ units.` exported as mathematics `5for`, with
`$5` swallowed by the formula and `x$` left as text.

```
HTML before: costs <math><mn>5</mn><mi>f</mi><mi>o</mi><mi>r</mi></math>x$ units.
TXT  before: costs 5 forx$ units.
```

**Root cause.** The inline scanner's single-dollar branch was

```js
/\$[^$\n]+?\$(?![0-9])/
```

The trailing guard only rejected a digit after the closing `$`, so the closing
delimiter was allowed to follow a space. In `… $5 for $x^2$ …` the first `$`
paired with the `$` that ends `for `, and the real expression was orphaned.

**Fix.** One token, defined once and shared by every renderer
(`INLINE_MATH_SOURCE` in `utils/exporter.js`). Its `$...$` branch follows
Pandoc's rule — opens on a non-space, closes on a non-space — while keeping the
`(?![0-9])` guard that protects `$5 and $10`.

**Regression test.** selftest *"A price beside inline maths keeps both"*
(HTML, TXT, Markdown, and the `From $5 to $10` prose case), plus artifact check
*"A price beside inline maths keeps both in every format"*.

---

## BUG-2 — Word had its own inline scanner with the same defect (High)

**Symptom.** The same sentence reached `word/document.xml` as equation `5 for`,
with `x^2` demoted to ordinary text and ` units and \` turned into an equation.

```
runs before: ["…it costs ", "x^2", "10 for the rest."]
             (mathematics: "5 for", " units and \")
```

**Root cause.** `utils/docx.js` carried `\$[^$\n]+\$`, a second hand-rolled
scanner that disagreed with the document renderer about where a formula starts.

**Fix.** `inline()` now builds its pattern from
`globalThis.AIExporter.INLINE_MATH_SOURCE` (with the old pattern only as a
fallback when the exporter is absent). Word and HTML can no longer disagree.

```
runs after: ["Assistant", "Prices beside mathematics: it costs $5 for ",
             " units and $10 for the rest."]   with x² as a real m:oMath
```

**Regression test.** same selftest check (HTML/TXT/Markdown) plus the DOCX
assertion inside artifact check *"A price beside inline maths keeps both in
every format"*, which reads `word/document.xml`.

---

## BUG-3 — An escaped dollar printed its backslash (Low)

**Symptom.** `Price \$5 and \$10, plus \$x.` exported as `Price \$5 and \$10 …`
in HTML/PDF and TXT. A naive unescape then made `\$5 … \$10` pair into an
equation, losing text again.

**Root cause.** `\$` was neither unescaped nor protected from the maths scan, so
the demonstration that a dollar is literal changed meaning depending on how many
dollars the sentence contained.

**Fix.** `hideEscapedDollars()` parks every `\$` on a private-use sentinel before
the scan; `restoreEscapedDollars()` writes the `$` back after formatting. Applied
in `formatInline`, `plainInline`, `markdownInline` and `docx.inline`.

**Regression test.** selftest *"An escaped price prints as a price"* (HTML, TXT,
Markdown) and artifact check *"An escaped price and an empty formula damage
nothing"*.

---

## BUG-4 — An empty formula was reported as a rendering failure (Low)

**Symptom.** `Before $$ $$ after.` produced
`<span class="tex tex--error" data-tex-error="1" title="This expression could not
be rendered…"></span>`, counted towards the "N expressions could not be
rendered" warning in the PDF status line.

**Root cause.** `texToMathML("")` legitimately returns no nodes, and the caller
treated "no nodes" as the same thing as "compile failed".

**Fix.** `formatInline` skips a token whose TeX is empty before compiling.

**Regression test.** selftest *"An empty formula is dropped instead of reported
as a failure"* and the second artifact check.

---

## BUG-5 — Word integrals were plain glyphs, not n-ary objects (Medium)

**Symptom.** `\int_0^1 x^2\,dx` reached Word as `∫` with `m:sSubSup`, while
`\sum` became `m:nary`. A glyph does not stretch to the height of its integrand
and prints its limits as ordinary scripts.

**Root cause.** `bigOperator()` recognised an n-ary operator only when the node
carried `__under || __over`, which the compiler sets for `\limits` operators.
An integral carries `_`/`^` (`__sub`/`__sup`), so it never qualified.

**Fix.** Exponential detection widened: an integral with `__sub` or `__sup` is an
n-ary operator, and `naryXml()` feeds `__under || __sub` into `m:sub` and
`__over || __sup` into `m:sup`, with `limLoc="subSup"` for integrals (unchanged
from the existing integral branch). Sums keep `undOvr`. An integral with no
limits still renders as a glyph.

**Regression test.** selftest *"The twelve required expressions compile in every
engine"* asserts `m:nary` for both `\sum_{i=1}^{n} i` and `\int_0^1 x^2\,dx`.

---

## Defects found and deliberately not "fixed"

* **Unclosed delimiter.** `Unclosed $\frac{a}{b}` stays literal text. There is no
  formula to compile; guessing that the author meant maths would corrupt prose.
  Documented in `KNOWN_LIMITATIONS.md`.
* **A lone `$20` next to a `$$ $$` block.** With an unbalanced `$` in the same
  run, the remaining dollars are genuinely ambiguous. The token now requires a
  non-space on both sides, which resolves the everyday currency cases; the
  pathological mix is documented rather than guessed.
* **Markdown escapes `[` and `]` in prose.** Harmless and correct for Markdown
  (they would otherwise open a link); left as is.
* **Word converts tabs to four spaces.** Deliberate: tab stops depend on the
  document's tab settings, spaces survive every viewer.
