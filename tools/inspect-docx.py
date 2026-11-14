"""Read a generated .docx with python-docx, independently of the writer.

Usage: python tools/inspect-docx.py file.docx [...]
Prints JSON: one object per file with sections, page geometry, header/footer
text and the footer's page-number field. This is a third-party reader, not our
own XML: it proves the package opens and that Word-visible parts are reachable.
"""
import json
import sys

from docx import Document
from docx.shared import Mm


def mm(value):
    return round(value / Mm(1), 1) if value is not None else None


def inspect(path):
    document = Document(path)
    sections = []
    for section in document.sections:
        footer = section.footer
        header = section.header
        footer_xml = footer._element.xml
        sections.append({
            "page_width_mm": mm(section.page_width),
            "page_height_mm": mm(section.page_height),
            "orientation": str(section.orientation),
            "margins_mm": {
                "top": mm(section.top_margin),
                "right": mm(section.right_margin),
                "bottom": mm(section.bottom_margin),
                "left": mm(section.left_margin),
            },
            "header_text": "\n".join(p.text for p in header.paragraphs).strip(),
            "footer_text": "\n".join(p.text for p in footer.paragraphs).strip(),
            "footer_has_page_field": "PAGE" in footer_xml and "fldChar" in footer_xml,
            "footer_alignment": (footer.paragraphs[0].alignment if footer.paragraphs else None)
            and str(footer.paragraphs[0].alignment).split(" ")[0],
        })
    body_xml = document.element.body.xml
    return {
        "path": path,
        "sections": len(sections),
        "detail": sections,
        "page_number_references": body_xml.count("footerReference"),
        "header_references": body_xml.count("headerReference"),
        "section_breaks": body_xml.count("<w:sectPr"),
        "paragraphs": len(document.paragraphs),
        "tables": len(document.tables),
        "inline_shapes": len(document.inline_shapes),
    }


if __name__ == "__main__":
    print(json.dumps([inspect(path) for path in sys.argv[1:]]))
