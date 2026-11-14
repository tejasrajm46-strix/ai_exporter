# Artifact verification

Generated 2026-11-14T07:14:20.784Z from the real exporter in headless Chrome.

| File | Format | Size | Warnings |
| --- | --- | ---: | ---: |
| `conversation.html` | html | 131.5 KB | 0 |
| `conversation.md` | markdown | 85.5 KB | 0 |
| `conversation.txt` | txt | 6.3 KB | 0 |
| `conversation.docx` | docx | 252.8 KB | 0 |
| `conversation.png` | image | 476.0 KB | 0 |
| `conversation-02.png` | image | 601.4 KB | 0 |
| `conversation-03.png` | image | 620.1 KB | 0 |
| `conversation-04.png` | image | 498.4 KB | 0 |
| `conversation-05.png` | image | 509.7 KB | 0 |
| `conversation-06.png` | image | 542.8 KB | 0 |
| `conversation-07.png` | image | 470.3 KB | 0 |
| `conversation.json` | json | 93.4 KB | 0 |
| `table-headers.docx` | docx | 82.2 KB | 0 |

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| All seven formats produced a non-empty file | PASS | 13 files |
| The test conversation validates against the document schema | PASS | 4 messages detected. |
| HTML is standalone, script-free and carries a CSP | PASS | 131.5 KB |
| HTML carries MathML for every formula | PASS | 32 math elements for 19 formulas |
| HTML escapes page text instead of activating it | PASS | literal HTML remains text |
| HTML print styles define paper, margins and repeated table headers | PASS | A4 rule and thead repeat present |
| The long table keeps a real header row | PASS | HTML thead, Word tblHeader |
| Markdown preserves TeX, including matrix alignment | PASS | raw & and $$ blocks kept |
| Markdown keeps nested list indentation | PASS | children indented two spaces and numbered |
| TXT reduces mathematics to readable words | PASS | inline and display TeX both reduced |
| A price beside inline maths keeps both in every format | PASS | price stays prose, formula stays maths |
| An escaped price and an empty formula damage nothing | PASS | no stray backslash, no error badge for an empty formula |
| JSON is versioned and complete | PASS | 4 messages |
| DOCX is a valid package with every required part | PASS | 12 entries |
| Every DOCX XML part is well-formed | PASS | 16 parts |
| DOCX carries real OMML equations, not TeX text | PASS | 32 equations |
| DOCX embeds every valid image and reports broken bytes | PASS | 4 media parts, broken source is a placeholder |
| DOCX code keeps indentation and syntax colours | PASS | spaces, keyword and number runs |
| DOCX numbering declares all nine levels | PASS | bullet + decimal × 9 |
| DOCX table header repeats across pages | PASS | 71 rows, one repeating header |
| Word opens in an independent reader with a real page-number field | PASS | 1 section(s), footer PAGE field read by python-docx |
| Word page setup survives a third-party read | PASS | 210×297 mm, 3 tables |
| PNG pages are separate, complete images | PASS | 7 page files, 487441 bytes the first |
| PNG has the reported dimensions and real DPI | PASS | 2480×3390 at 192 DPI |
| PDF inspection ran | PASS | 5 files |
| PDF keeps A4 portrait geometry | PASS | 209.9×297 mm, 10 pages |
| PDF honours Letter landscape and narrow margins | PASS | 279.4×215.9 mm |
| PDF honours A4 wide margins | PASS | 10 pages |
| PDF cover option adds a title page | PASS | 11 vs 10 pages |
| No PDF page is blank | PASS | all pages carry text |
| PDF embeds real fonts | PASS | /AAAAAA+PalatinoLinotype-Bold, /DAAAAA+CambriaMath, /IAAAAA+Consolas, /JAAAAA+Consolas-Italic |
| PDF text is searchable | PASS | 6621 extracted characters |
| PDF repeats the table header on later pages | PASS | 4 pages contain the header |
| PDF spans more than one page without clipping | PASS | 10, 14, 10 |

**All artefact checks passed.**
