#!/usr/bin/env python3
"""Paint assets/modes.png - the three document modes side by side.

The palettes are read straight out of utils/exporter.js, so the README art can
never drift from what the exporter actually renders. Only Pillow is needed.

    python tools/make-modes-preview.py
"""

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
EXPORTER = ROOT / "utils" / "exporter.js"
OUT = ROOT / "assets" / "modes.png"

MODES = [
    ("light", "1 \u00b7 Light (Polished & Colorful)"),
    ("dark", "2 \u00b7 Dark Theme"),
    ("print", "3 \u00b7 Light (Printable \u2013 Black & White)"),
]

FONTS = {
    "title": ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"],
    "body": ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"],
    "mono": ["consola.ttf", "cour.ttf", "DejaVuSansMono.ttf"],
}
FONT_DIRS = [Path("C:/Windows/Fonts"), Path("/System/Library/Fonts"), Path("/usr/share/fonts/truetype/dejavu")]

PANEL_W, PANEL_H = 452, 610
GAP, MARGIN, FOOT = 26, 26, 84


def load_font(role, size):
    for directory in FONT_DIRS:
        for name in FONTS[role]:
            path = directory / name
            if path.exists():
                try:
                    return ImageFont.truetype(str(path), size)
                except OSError:
                    pass
    return ImageFont.load_default(size)


def hex_to_rgb(value):
    value = value.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(char * 2 for char in value)
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def read_palettes():
    """Pull the three --name: #hex blocks out of DOCUMENT_CSS."""
    css = EXPORTER.read_text(encoding="utf-8")
    palettes = {}
    for name in ("light", "dark", "print"):
        block = re.search(r'html\[data-theme="%s"\]\s*\{(.*?)\n\}' % name, css, re.S)
        if not block:
            sys.exit("could not find the %s palette in %s" % (name, EXPORTER))
        palettes[name] = dict(re.findall(r"(--[a-z-]+):\s*([^;]+);", block.group(1)))
    # The CSS comments carry stray colons, so tidy the values up.
    for palette in palettes.values():
        for key, value in palette.items():
            palette[key] = value.strip().split()[0]
    return palettes


def wrap(draw, text, font, width):
    lines, line = [], ""
    for word in text.split():
        candidate = "%s %s" % (line, word) if line else word
        if draw.textlength(candidate, font=font) <= width or not line:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


class Panel:
    def __init__(self, draw, palette, x, y):
        self.d = draw
        self.p = palette
        self.x = x
        self.y = y
        self.w = PANEL_W

    def rgb(self, key):
        return hex_to_rgb(self.p[key])

    def rounded(self, box, radius, fill=None, outline=None, width=1):
        self.d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

    def text(self, xy, value, font, fill):
        self.d.text(xy, value, font=font, fill=fill)

    def code_glyph(self, x, y, colour):
        """A tiny </> mark, drawn rather than typed so it is always sharp."""
        for offset, flip in ((0, 1), (13, -1)):
            self.d.line(
                [(x + (9 if flip > 0 else 0) + offset, y), (x + offset, y + 6), (x + (9 if flip > 0 else 0) + offset, y + 12)],
                fill=colour,
                width=2,
            )
        self.d.line([(x + 6, y + 1), (x + 1, y + 11)], fill=colour, width=2)

    def paint(self):
        p, d = self.p, self.d
        x, y, w = self.x, self.y, self.w
        pad = 20
        inner = w - pad * 2

        # the sheet
        self.rounded((x, y, x + w, y + PANEL_H), 14, fill=hex_to_rgb(p["--paper"]),
                     outline=hex_to_rgb(p["--line-strong"]), width=2)

        ty = y + pad

        # heading bar: tinted, rounded, with a topic icon
        head = (x + pad, ty, x + w - pad, ty + 46)
        self.rounded(head, 9, fill=hex_to_rgb(p["--head-bg"]))
        cx, cy = x + pad + 17, ty + 23
        icon = hex_to_rgb(p["--head-icon"])
        d.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), outline=icon, width=2)
        for dx, dy in ((-9, 0), (9, 0), (0, -9), (0, 9)):
            d.ellipse((cx + dx - 2, cy + dy - 2, cx + dx + 2, cy + dy + 2), fill=icon)
        self.text((x + pad + 38, ty + 13), "Exception Types", load_font("title", 20), hex_to_rgb(p["--head-ink"]))
        ty += 62

        # paragraph, with the highlighted inline term following the last line.
        # The wrap is a little narrow so the term lands inline on line two.
        body = load_font("body", 14)
        lines = wrap(d, "Java groups exceptions as checked and unchecked, for example", body, inner - 60)
        for line in lines:
            self.text((x + pad, ty), line, body, hex_to_rgb(p["--ink"]))
            ty += 20
        line_top = ty - 20
        chip = "NumberFormatException"
        chip_w = d.textlength(chip, font=body) + 12
        chip_x = x + pad + d.textlength(lines[-1], font=body) + 5
        self.rounded((chip_x - 6, line_top - 2, chip_x - 6 + chip_w, line_top + 18), 5,
                     fill=hex_to_rgb(p["--accent-soft"]))
        self.text((chip_x, line_top), chip, body, hex_to_rgb(p["--accent-ink"]))
        ty += 6

        # NOTE callout: tinted panel with a coloured bar on the left
        note = load_font("body", 14)
        note_lines = wrap(d, "An exception is an event that disrupts the normal flow of a program.", note, inner - 44)
        note_h = 26 + 20 * len(note_lines) + 10
        self.rounded((x + pad, ty, x + w - pad, ty + note_h), 9, fill=hex_to_rgb(p["--note-bg"]))
        self.rounded((x + pad, ty, x + pad + 7, ty + note_h), 3, fill=hex_to_rgb(p["--note-line"]))
        self.text((x + pad + 20, ty + 9), "NOTE", load_font("title", 12), hex_to_rgb(p["--note-chip"]))
        ny = ty + 27
        for line in note_lines:
            self.text((x + pad + 20, ny), line, note, hex_to_rgb(p["--ink"]))
            ny += 20
        ty += note_h + 16

        # bullets, alternating dot colour
        for index, value in enumerate(("Prevents abnormal termination of the program.", "Provides meaningful error messages.")):
            d.ellipse((x + pad + 2, ty + 6, x + pad + 10, ty + 14),
                      fill=hex_to_rgb(p["--bullet-a"] if index == 0 else p["--bullet-b"]))
            self.text((x + pad + 20, ty), value, body, hex_to_rgb(p["--ink"]))
            ty += 22
        ty += 8

        # code panel: tinted header over the code body
        mono = load_font("mono", 13)
        code = [
            ("class Student {", "kw"),
            ("  private int marks;", "kw"),
            ("  void setMarks(int marks) {", "kw"),
            ("    if (marks < 0) throw new", "fn"),
            ("      IllegalArgumentException(\"negative\");", "str"),
        ]
        code_h = 34 + 18 * len(code) + 12
        self.rounded((x + pad, ty, x + w - pad, ty + code_h), 9, fill=hex_to_rgb(p["--code-bg"]),
                     outline=hex_to_rgb(p["--code-line"]), width=1)
        self.rounded((x + pad, ty, x + w - pad, ty + 32), 9, fill=hex_to_rgb(p["--code-head-bg"]))
        d.rectangle((x + pad, ty + 22, x + w - pad, ty + 32), fill=hex_to_rgb(p["--code-head-bg"]))
        head_ink = hex_to_rgb(p["--code-head-ink"])
        self.code_glyph(x + pad + 14, ty + 10, head_ink)
        self.text((x + pad + 40, ty + 8), "JAVA", load_font("title", 13), head_ink)
        cy = ty + 42
        for line, kind in code:
            colour = hex_to_rgb(p["--tok-%s" % kind]) if kind in ("kw", "fn", "str") else hex_to_rgb(p["--code-ink"])
            self.text((x + pad + 16, cy), line, mono, colour)
            cy += 18
        ty += code_h + 14

        # OUTPUT panel: a lighter tint, so it reads apart from the code
        out_lines = ["Exception in thread \"main\"", "java.lang.IllegalArgumentException: negative"]
        out_h = 28 + 19 * len(out_lines) + 10
        self.rounded((x + pad, ty, x + w - pad, ty + out_h), 9, fill=hex_to_rgb(p["--out-bg"]),
                     outline=hex_to_rgb(p["--code-line"]), width=1)
        self.rounded((x + pad, ty, x + w - pad, ty + 26), 9, fill=hex_to_rgb(p["--out-head-bg"]))
        d.rectangle((x + pad, ty + 18, x + w - pad, ty + 26), fill=hex_to_rgb(p["--out-head-bg"]))
        self.text((x + pad + 16, ty + 5), "OUTPUT", load_font("title", 12), hex_to_rgb(p["--out-head-ink"]))
        oy = ty + 36
        for line in out_lines:
            self.text((x + pad + 16, oy), line, mono, hex_to_rgb(p["--ink"]))
            oy += 19
        ty += out_h + 14

        # table with a tinted header row
        rows = [("NumberFormatException", "a string is not a number"), ("NullPointerException", "a null reference is used")]
        row_h, head_row = 24, 26
        table_h = head_row + row_h * len(rows)
        self.rounded((x + pad, ty, x + w - pad, ty + table_h), 8, outline=hex_to_rgb(p["--line-strong"]), width=1)
        d.rectangle((x + pad + 1, ty + 1, x + w - pad - 1, ty + head_row), fill=hex_to_rgb(p["--table-head"]))
        for cx2, value in ((x + pad + 12, "Exception"), (x + pad + 224, "When it is thrown")):
            self.text((cx2, ty + 6), value, load_font("title", 13), hex_to_rgb(p["--table-head-ink"]))
        for index, (left, right) in enumerate(rows):
            ry = ty + head_row + row_h * index
            d.line([(x + pad, ry), (x + w - pad, ry)], fill=hex_to_rgb(p["--line"]), width=1)
            self.text((x + pad + 12, ry + 5), left, body, hex_to_rgb(p["--ink"]))
            self.text((x + pad + 224, ry + 5), right, body, hex_to_rgb(p["--ink"]))


def main():
    palettes = read_palettes()
    width = MARGIN * 2 + PANEL_W * 3 + GAP * 2
    height = MARGIN * 2 + PANEL_H + FOOT
    image = Image.new("RGB", (width, height), hex_to_rgb("#eef0f4"))
    draw = ImageDraw.Draw(image)

    for index, (name, label) in enumerate(MODES):
        x = MARGIN + index * (PANEL_W + GAP)
        Panel(draw, palettes[name], x, MARGIN).paint()

        # caption pill, tinted like the mode it belongs to
        tint = {"light": ("#eef2ff", "#1e1b4b"), "dark": ("#0f172a", "#e5e7eb"), "print": ("#f1f5f9", "#111827")}[name]
        font = load_font("title", 17)
        pill_w = draw.textlength(label, font=font) + 48
        pill_x = x + (PANEL_W - pill_w) / 2
        pill_y = MARGIN + PANEL_H + 18
        draw.rounded_rectangle((pill_x, pill_y, pill_x + pill_w, pill_y + 38), radius=19, fill=hex_to_rgb(tint[0]))
        draw.text((pill_x + 24, pill_y + 10), label, font=font, fill=hex_to_rgb(tint[1]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, "PNG", optimize=True)
    print("wrote %s  %dx%d  %d bytes" % (OUT.name, image.width, image.height, OUT.stat().st_size))


if __name__ == "__main__":
    main()
