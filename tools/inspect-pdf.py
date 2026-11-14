"""Inspect generated PDFs with pypdf and print a JSON report.

This is verification tooling, not part of the extension. It answers the
questions a byte check cannot: how many pages, what paper size, which fonts,
whether every page has text, and whether a table header repeated.
"""
import json
import sys

from pypdf import PdfReader


def fonts_on(page):
    resources = page.get("/Resources")
    if resources is None:
        return set()
    resources = resources.get_object()
    font = resources.get("/Font")
    if font is None:
        return set()
    names = set()
    for _key, reference in font.get_object().items():
        try:
            item = reference.get_object()
            base = item.get("/BaseFont") or item.get("/Name")
            if base:
                names.add(str(base))
        except Exception:
            continue
    return names


def inspect(path):
    reader = PdfReader(path)
    pages = []
    all_fonts = set()
    for index, page in enumerate(reader.pages):
        box = page.mediabox
        width_mm = round(float(box.width) * 25.4 / 72, 1)
        height_mm = round(float(box.height) * 25.4 / 72, 1)
        try:
            text = page.extract_text() or ""
        except Exception as error:  # a broken content stream must be reported
            text = ""
            pages.append({
                "page": index + 1,
                "width_mm": width_mm,
                "height_mm": height_mm,
                "chars": 0,
                "blank": True,
                "error": str(error),
                "text": "",
                "fonts": [],
            })
            continue
        fonts = fonts_on(page)
        all_fonts |= fonts
        pages.append({
            "page": index + 1,
            "width_mm": width_mm,
            "height_mm": height_mm,
            "chars": len(text),
            "blank": len(text.strip()) == 0,
            "text": text,
            "fonts": sorted(fonts)[:12],
        })
    return {
        "path": path,
        "pages": len(pages),
        "fonts": sorted(all_fonts),
        "page_details": pages,
        "blank_pages": [page["page"] for page in pages if page["blank"]],
        "text_chars": sum(page["chars"] for page in pages),
    }


def main():
    report = [inspect(path) for path in sys.argv[1:]]
    print(json.dumps(report))


if __name__ == "__main__":
    main()
