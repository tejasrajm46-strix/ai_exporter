# REGRESSION_TESTS.md — AI Exporter v1.0

Every defect fixed in this release has at least one automated check that fails on
the old code and passes on the new. Checks live in `selftest.js` (unit level,
real modules in headless Chrome) and `tools/generate-artifacts.js` (byte level,
over the generated files).

Run:

```bash
npm test           # 96/96 browser checks
npm run artifacts  # 31/31 artifact checks, regenerates tests/output
```

---

## REG-1 — Currency next to inline mathematics

**Defect.** `$5 for $x^2$` was read as the formula `5for`; the price and the
expression were both damaged.

**Check.** `selftest.js` → *A price beside inline maths keeps both*

```js
const prose = "It costs $5 for $x^2$ units, and $10 for the rest.";
```

Assertions:

* exactly one `<math>` element (`$x^2$` and nothing else is mathematics);
* that element contains `msup`;
* the document text still contains `$5 for` and `$10 for the rest`;
* the text does not contain `5for`;
* TXT contains `$5 for` and `x^2`;
* Markdown contains `$x^2$` and `$5 for`;
* a second fixture, `From $5 to $10 per seat.`, produces no `<math>` at all.

**Byte-level check.** `generate-artifacts.js` → *A price beside inline maths
keeps both in every format*: `conversation.html`, `conversation.txt`,
`conversation.md` and `word/document.xml` from `conversation.docx` each contain
`it costs $5 for `, TXT keeps `x^2 units`, Markdown keeps `$x^2$`.

**Old behaviour.** HTML produced `<mn>5</mn><mi>f</mi><mi>o</mi><mi>r</mi>` and
TXT produced `costs 5 forx$ units.`; Word produced maths `5 for` and prose
`x^2`.

---

## REG-2 — Word shares the exporter's inline token

**Defect.** `utils/docx.js` had its own `\$[^$\n]+\$` scanner, so Word and HTML
disagreed about where a formula starts.

**Check.** Covered by REG-1's DOCX assertion (the artifact check reads
`word/document.xml`), and by *The twelve required expressions compile in every
engine*, which asserts an `m:oMath` element per expression.

**Old behaviour.** Runs `["…it costs ", "x^2", "10 for the rest."]` with `x^2`
outside mathematics.

---

## REG-3 — Escaped dollar

**Defect.** `\$` printed its backslash; after a naive fix `\$5 … \$10` paired into
an equation.

**Check.** `selftest.js` → *An escaped price prints as a price*

```js
const prose = String.raw`Price \$5 and \$10, plus \$x.`;
```

Assertions: no `\$` in the rendered text, TXT or Markdown; `$5 and $10` present.

**Byte-level check.** *An escaped price and an empty formula damage nothing*
asserts `$10 for the rest` survives in both HTML and TXT.

**Old behaviour.** `Escaped \$5 and \$10 stay literal.`

---

## REG-4 — Empty formula

**Defect.** `$$ $$` produced a visible `[data-tex-error]` badge and a warning in
the PDF status line.

**Check.** `selftest.js` → *An empty formula is dropped instead of reported as a
failure*

```js
{ type: "paragraph", text: "Before $$ $$ after." }
```

Assertions: no `data-tex-error`, no `<math>`, and both `Before` and `after` still
present.

**Byte-level check.** *An escaped price and an empty formula damage nothing*
requires no `data-tex-error` anywhere in `conversation.html`, with the fixture
sentence `An empty formula $$ $$ is not a failure.`

**Old behaviour.** `<span class="tex tex--error" data-tex-error="1" …></span>`

---

## REG-5 — Word integrals as n-ary objects

**Defect.** `\int` reached Word as a glyph with `m:sSubSup`; only `\sum` became
`m:nary`.

**Check.** `selftest.js` → *The twelve required expressions compile in every
engine* asserts `m:nary` for `\int_0^1 x^2\,dx` (and still for
`\sum_{i=1}^{n} i`), with `m:deg` for `\sqrt[3]{x}`, `m:m` for the matrix,
`m:limLow` for the limit and `m:f` for both fractions.

**Old behaviour.** `<m:sSubSup><m:e><m:r><m:t>∫</m:t>…`

---

## REG-6 — The twelve-expression matrix (cross-engine guarantee)

One check, twelve expressions, six assertions each: expected MathML element,
no backslash in the MathML, XML well-formedness, expected OMML element, plain
fallback free of TeX, TeX preserved in Markdown. This is the regression net for
any future change to the tokeniser, the MathML serialiser or the OMML writer.

The same twelve expressions are also present in the artifact fixture, so every
release produces a PDF, DOCX, HTML, Markdown, TXT, PNG and JSON that contain
them, and the artifact run asserts the aggregates (32 `<math>` elements,
32 `m:oMath` equations, no TeX in TXT).

---

## Manual regression spots (not automated, documented for review)

| Spot | Why manual |
| --- | --- |
| Print dialog: paper/margins applied by the dialog | Requires a user to confirm in the OS dialog |
| Word/LibreOffice opening the .docx | No office suite on the build machine |
| Extension loaded as `chrome-extension://` | Not launched in this pass (see TEST_REPORT §7) |
