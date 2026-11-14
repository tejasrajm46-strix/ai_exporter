# IMPLEMENTATION_REPORT.md — AI Exporter v1.0

Every change below was made in this pass and verified by an executed check.
Nothing in this file is a proposal.

## Summary

| Change | File | Verified by |
| --- | --- | --- |
| One shared inline-maths token for all renderers | `utils/exporter.js` | 96 browser checks, 31 artifact checks |
| Escaped dollar parked on a sentinel, restored after formatting | `utils/exporter.js` | selftest "An escaped price prints as a price", artifact check |
| Empty formula dropped instead of flagged | `utils/exporter.js` | selftest "An empty formula is dropped …" |
| Word consumes the exporter's token instead of its own | `utils/docx.js` | selftest matrix check, DOCX run extraction probe |
| Word integrals become `m:nary` | `utils/docx.js` | selftest "The twelve required expressions …" (`m:nary`) |
| Four structural regression checks | `selftest.js` | `npm test` → 96/96 |
| Regression fixture + two byte-level assertions | `tools/artifact-page.js`, `tools/generate-artifacts.js` | `npm run artifacts` → 31/31 |
| PDF page rasteriser for visual evidence | `tools/render-pdf-pages.py` | produced `tests/visual/pdf/*.png` |

## 1. `utils/exporter.js` — a single inline-maths token

Before, the `$...$` scanner existed three times with the same permissive rule
(`\$[^$\n]+?\$(?![0-9])`), which allowed a closing `$` that followed a space.
`It costs $5 for $x^2$ units` therefore matched `$5 for $` as one formula.

The token is now defined once:

```js
const INLINE_MATH_SOURCE =
  "\\$\\$[\\s\\S]+?\\$\\$|\\\\\\[[\\s\\S]+?\\\\\\]|\\\\\\([\\s\\S]+?\\\\\\)" +
  "|\\$\\\\{1,2}[A-Za-z][\\s\\S]*?\\$|\\$(?=\\S)[^$\\n]*?\\S\\$(?![0-9])";
const INLINE_MATH_PATTERN = new RegExp(`(${INLINE_MATH_SOURCE})`, "g");
```

The final branch is Pandoc's rule: a formula opens on a non-space and closes on
a non-space. `$...$` still requires no trailing digit, so `$5 and $10` stays
prose. `plainInline` (TXT/PNG), `formatInline` (HTML/PDF) and `markdownInline`
all build their scanner from it, and it is exported as
`AIExporter.INLINE_MATH_SOURCE` so `utils/docx.js` consumes the same rule.

## 2. `utils/exporter.js` — escaped dollars

`hideEscapedDollars()` replaces `\$` with a private-use sentinel before scanning
and `restoreEscapedDollars()` puts the `$` back afterwards. Hiding happens
*before* the maths scan, because `\$5 and \$10` otherwise paired the first
`\$` with the second one's `$` and ate the sentence. Applied to `plainInline`,
`formatInline` and `markdownInline`; `formatPlain` and `stripInlineMarkers` also
strip a stray `\$` as a safety net for paths that never see the sentinel.

## 3. `utils/exporter.js` — empty formulas

`$$ $$` and `$$$$` compile to no MathML nodes. They are now skipped
(`if (!tex.trim()) continue`) instead of producing `[data-tex-error]` badges,
status warnings and a minus-one count in the "N expressions could not be
rendered" line.

## 4. `utils/docx.js` — shared token, escaped dollars

`inline()` builds its pattern as

```js
new RegExp(`(\\*\\*[^*]+\\*\\*|${AIExporter.INLINE_MATH_SOURCE}|` + "`[^`]+`|\\*[^*\\n]+\\*)", "g")
```

falling back to its old pattern only if the exporter module is absent. Bracketed
and parenthesised delimiters are normalised to `$…$` first, `\$` is parked on the
same sentinel, and the sentinel is restored on the finished run XML. Bold,
italic and inline-code handling is unchanged.

## 5. `utils/docx.js` — n-ary integrals

`bigOperator()` previously required `__under || __over`, which only `\limits`
operators (`\sum`, `\prod`, `\lim`-style) have. An integral carries plain
`_`/`^`, so it was never recognised. It now accepts an integral with `__sub` or
`__sup` as well, and `naryXml()` reads `__under || __sub` and `__over || __sup`.
`\int`, `\iint`, `\oint` therefore become `m:nary` with `m:limLoc="subSup"`,
while sums keep `undOvr`. `\int` with no limits stays a plain glyph, which is
correct.

## 6. Test surface added

`selftest.js` (runs against the real modules in headless Chrome):

1. **A price beside inline maths keeps both** — exactly one `<math>`, the price
   stays prose in HTML, TXT and Markdown, and `From $5 to $10` stays prose.
2. **An escaped price prints as a price** — no `\$` in HTML, TXT or Markdown,
   both prices intact.
3. **An empty formula is dropped instead of reported as a failure** — no
   `[data-tex-error]`, no empty `<math>`, surrounding prose whole.
4. **The twelve required expressions compile in every engine** — for each of the
   brief's twelve expressions: the expected MathML element, no TeX leakage,
   XML well-formedness, the expected OMML element in Word, a readable plain-text
   fallback with no backslashes, and identical TeX in Markdown.

`tools/artifact-page.js` gained a regression paragraph
(`Prices beside mathematics: it costs $5 for $x^2$ units and \$10 for the rest.`
and `An empty formula $$ $$ is not a failure.`) so the generated PDF, DOCX, HTML,
Markdown and TXT prove the fix in bytes, and `tools/generate-artifacts.js` gained
two checks over those bytes.

## 7. Not changed

Parser, MCQ folding, document model, PNG canvas, image pipeline, print CSS,
workspace UI, cancellation, downloads and security posture were audited and left
alone: they already satisfy the brief and rewriting them would have risked
working behaviour without adding capability.
