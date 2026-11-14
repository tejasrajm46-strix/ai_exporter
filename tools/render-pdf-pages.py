"""Render PDF pages to PNG for visual inspection (temporary helper)."""
import pathlib
import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "visual" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

JOBS = [
    ("tests/output/conversation-a4-portrait-normal.pdf", "a4-page{}.png", 3),
    ("tests/output/conversation-letter-landscape-narrow.pdf", "landscape-page{}.png", 1),
    ("tests/output/table-headers.pdf", "table-page{}.png", 2),
]

for source, pattern, pages in JOBS:
    doc = pymupdf.open(ROOT / source)
    for index in range(min(pages, doc.page_count)):
        pixmap = doc[index].get_pixmap(dpi=110)
        pixmap.save(OUT / pattern.format(index + 1))
        print("wrote", pattern.format(index + 1), pixmap.width, "x", pixmap.height)
    doc.close()
