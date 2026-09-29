#!/usr/bin/env python3
"""Generate AI Exporter's mark, icon set and README banner.

The SVG files and the PNG rasters are both emitted from the geometry at the
bottom of this file, so the vector and the bitmap can never drift apart. Pure
standard library: no cairosvg, no Pillow, no headless browser.

    python tools/make-logo.py            # write assets/ and icons/
    python tools/make-logo.py --concepts scratch/   # + the three concept svgs

Design notes (logo-design skill, fast track):
  * The mark is a tile + a four-point spark. The spark is the one idea: a
    conversation is read *at a glance*, which is what a spark says, and it is
    the mark the extension UI already used, so the icon and the toolbar agree.
  * Construction: 256 unit canvas, tile inset 10 with radius 58, spark radius
    74 with 45-degree arms pinched to a quarter radius. Every number is a round
    value on a 2-unit grid so it stays sharp at 16 px.
  * Small sizes get a simplified drawing (no secondary spark): at 16 px the
    satellite turns into noise, which is exactly the size the toolbar uses.
  * No text in any mark. The README banner keeps its own words as words.
"""

import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The palette, taken from the reference board the brand was matched to:
#   Upsdell  #850027   wine, the brand's deep tone
#   crimson  #a80033   brand bright (tile gradient)
#   Harvest  #d9a73f   gold, the spark and the primary action on dark chrome
#   Green    #38bd5d   positive / "AI answered" accent
#   Amazon   #067034   deep green, used for tips in the printed document
WINE = (0x6E, 0x00, 0x21)
CRIMSON = (0xB3, 0x00, 0x36)
GOLD = (0xE8, 0xBE, 0x62)
CREAM = (0xFF, 0xF3, 0xDC)
GREEN = (0x38, 0xBD, 0x5D)
INK = (0x14, 0x03, 0x0B)

CANVAS = 256
TILE_INSET = 10
TILE_RADIUS = 58
SPARK = (118, 116, 74)  # cx, cy, radius of the four arms
SPARK_SMALL = (182, 188, 29)

# ------------------------------------------------------------------ geometry


def mix(a, b, t):
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def tile_gradient(x, y):
    """160deg crimson -> wine, the ramp the extension UI uses for its mark."""
    return mix(CRIMSON, WINE, ((x - 10) / 236.0 + (y - 8) / 240.0) / 2.0)


def square_tile(x0, y0, x1, y1, r):
    """Rounded rectangle as an exact signed distance (inside when d <= 0)."""
    half_w = (x1 - x0) / 2.0
    half_h = (y1 - y0) / 2.0
    cx, cy = x0 + half_w, y0 + half_h

    def inside(x, y):
        dx = abs(x - cx) - (half_w - r)
        dy = abs(y - cy) - (half_h - r)
        d = math.hypot(max(dx, 0.0), max(dy, 0.0)) + min(max(dx, dy), 0.0) - r
        return d <= 0.0

    return inside


def spark(cx, cy, r, exponent=0.5):
    """Four-point star: |x/r|^e + |y/r|^e <= 1.

    At the default e = 0.5 the curve satisfies sqrt(|x|/r) + sqrt(|y|/r) = 1,
    which is exactly what the SVG's quadratic path draws, so the PNG and the
    SVG are the same shape. A larger exponent fattens the arms, which is what
    the 16 and 32 px toolbar drawings need -- a true sparkle thins to mush once
    the arms are barely one pixel wide. Skip past 1.0 and it becomes a diamond.
    """

    def inside(x, y):
        return abs(x - cx) ** exponent + abs(y - cy) ** exponent <= r ** exponent

    return inside


def bar(x0, y0, x1, y1, r):
    return square_tile(x0, y0, x1, y1, min(r, (y1 - y0) / 2.0))


# ------------------------------------------------------------------- raster


def write_png(path, width, height, rows):
    """rows: bytes of RGBA scanlines, already filtered with type 0."""
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw += rows[y * stride:(y + 1) * stride]

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)
    return len(png)


def render(width, height, layers, scale, supersample=4):
    """Composite layers into RGBA bytes.

    A layer is (color, inside, bbox, opacity). `color` is an RGB triple or a
    callable of canvas coordinates; `inside` and the coordinates are all in
    canvas units, so one scene renders at any output size.
    """
    out = bytearray()
    inv = 1.0 / supersample
    norm = 1.0 / (supersample * supersample)

    for py in range(height):
        cy0 = py / scale
        row = bytearray()
        for px in range(width):
            cx0 = px / scale
            r = g = b = a = 0.0
            for color, inside, bbox, opacity in layers:
                if bbox:
                    bx0, by0, bx1, by1 = bbox
                    if cx0 > bx1 or cy0 > by1 or cx0 + 1.0 / scale < bx0 or cy0 + 1.0 / scale < by0:
                        continue
                hits = 0
                for sy in range(supersample):
                    y = cy0 + (sy + 0.5) * inv / scale
                    for sx in range(supersample):
                        if inside(cx0 + (sx + 0.5) * inv / scale, y):
                            hits += 1
                if not hits:
                    continue
                cov = hits * norm * opacity
                cr, cg, cb = color(cx0 + 0.5 / scale, cy0 + 0.5 / scale) if callable(color) else color
                # straight-alpha "over": source weighted by its own coverage
                na = cov + a * (1.0 - cov)
                if na > 0:
                    keep = a * (1.0 - cov)
                    r = (cr * cov + r * keep) / na
                    g = (cg * cov + g * keep) / na
                    b = (cb * cov + b * keep) / na
                a = na
            row += bytes((round(r), round(g), round(b), round(a * 255)))
        out += row
    return out


# --------------------------------------------------------------------- scenes


def mark_layers(small=False):
    """The tile mark. `small` is the toolbar drawing: no satellite, fatter arms."""
    cx, cy, r = SPARK
    layers = [
        (tile_gradient, square_tile(TILE_INSET, TILE_INSET, CANVAS - TILE_INSET, CANVAS - TILE_INSET, TILE_RADIUS),
         (TILE_INSET, TILE_INSET, CANVAS - TILE_INSET, CANVAS - TILE_INSET), 1.0),
        (GOLD, spark(cx, cy, r + 3, 0.62) if small else spark(cx, cy, r), None, 1.0),
    ]
    if not small:
        layers.append((CREAM, spark(*SPARK_SMALL), None, 0.92))
    return layers


def hero_layers(width=1280, height=400):
    """README banner: the mark plus a code panel and export rules. No text."""
    def backdrop(x, y):
        base = mix((0x46, 0x02, 0x18), (0x1B, 0x01, 0x0A), min(1.0, x / float(width * 0.9)))
        glow = max(0.0, 1.0 - math.hypot(x - 240.0, y - 200.0) / 420.0) ** 2
        return mix(base, (0xC4, 0x00, 0x3E), glow * 0.34)

    layers = [(backdrop, lambda x, y: True, None, 1.0)]

    # the mark, 224 units tall, optically centred on the left third
    scale, ox, oy = 0.875, 108, 88

    def place(fn):
        return lambda x, y: fn((x - ox) / scale, (y - oy) / scale)

    for color, inside, _bbox, opacity in mark_layers():
        layers.append((color, place(inside), None, opacity))

    # a transcript: four rules that shorten, the last one the brand green
    rules = ((468, 112, 706), (468, 158, 640), (468, 204, 604), (468, 250, 522))
    for index, (x0, y, x1) in enumerate(rules):
        tint = GREEN if index == 3 else (0xF6, 0xE9, 0xE2)
        layers.append((tint, bar(x0, y, x1, y + 15, 7), (x0, y, x1, y + 15), 1.0))

    # a code panel: window chrome plus indented code lines
    layers.append((mix(WINE, (0x0A, 0x00, 0x04), 0.62), square_tile(792, 78, 1184, 322, 20), (792, 78, 1184, 322), 1.0))
    layers.append((mix(WINE, (0x0A, 0x00, 0x04), 0.4), square_tile(792, 78, 1184, 124, 20), (792, 78, 1184, 124), 1.0))
    layers.append((GOLD, bar(792, 122, 1184, 124, 1), (792, 122, 1184, 124), 0.5))
    layers.append((CREAM, bar(820, 94, 900, 106, 6), (820, 94, 900, 106), 0.85))
    code = ((846, 148, 1120), (872, 182, 1046), (872, 216, 1132), (846, 250, 1000), (872, 284, 1078))
    for index, (x0, y, x1) in enumerate(code):
        tint = GOLD if index == 1 else (0xE8, 0xDA, 0xD2)
        layers.append((tint, bar(x0, y, x1, y + 13, 6), (x0, y, x1, y + 13), 0.9))

    return layers


# ------------------------------------------------------------------------ svg

SPARK_PATH = (
    "M {cx} {top} Q {cx} {cy} {right} {cy} Q {cx} {cy} {cx} {bottom} "
    "Q {cx} {cy} {left} {cy} Q {cx} {cy} {cx} {top} Z"
)


def spark_path(cx, cy, r):
    return SPARK_PATH.format(cx=cx, cy=cy, top=cy - r, bottom=cy + r, left=cx - r, right=cx + r)


def mark_svg(paint_tile=True, tile="url(#tile)", spark_fill="#e8be62", satellite="#fff3dc"):
    defs = ""
    if paint_tile and tile == "url(#tile)":
        defs = (
            "  <defs>\n"
            "    <linearGradient id=\"tile\" x1=\"0.1\" y1=\"0\" x2=\"0.9\" y2=\"1\">\n"
            "      <stop offset=\"0\" stop-color=\"#b30036\"/>\n"
            "      <stop offset=\"1\" stop-color=\"#6e0021\"/>\n"
            "    </linearGradient>\n"
            "  </defs>\n"
        )
    body = ""
    if paint_tile:
        body += (
            "  <rect x=\"%d\" y=\"%d\" width=\"%d\" height=\"%d\" rx=\"%d\" fill=\"%s\"/>\n"
            % (TILE_INSET, TILE_INSET, CANVAS - 2 * TILE_INSET, CANVAS - 2 * TILE_INSET, TILE_RADIUS, tile)
        )
    body += "  <path d=\"%s\" fill=\"%s\"/>\n" % (spark_path(*SPARK), spark_fill)
    body += (
        "  <path d=\"%s\" fill=\"%s\" opacity=\"0.92\"/>\n"
        % (spark_path(*SPARK_SMALL), satellite)
    )
    return (
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" width=\"256\" height=\"256\" "
        "role=\"img\" aria-label=\"AI Exporter\">\n" + defs + body + "</svg>\n"
    )


# ----------------------------------------------------------------------- main


def main(argv):
    out_assets = os.path.join(ROOT, "assets")
    out_icons = os.path.join(ROOT, "icons")
    os.makedirs(out_assets, exist_ok=True)
    os.makedirs(out_icons, exist_ok=True)

    written = []

    def note(path, size=None):
        written.append(
            "%s%s" % (os.path.relpath(path, ROOT), "" if size is None else " (%d KB)" % (size // 1024))
        )

    for name, svg in (
        ("logo.svg", mark_svg()),
        ("logo-mark.svg", mark_svg(paint_tile=False, spark_fill="#a80033", satellite="#850027")),
        ("logo-mono.svg", mark_svg(tile="#141414", spark_fill="#ffffff", satellite="#ffffff")),
        ("logo-reversed.svg", mark_svg(tile="#ffffff", spark_fill="#a80033", satellite="#850027")),
    ):
        path = os.path.join(out_assets, name)
        with open(path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(svg)
        note(path)

    mono = (
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" width=\"256\" height=\"256\" "
        "role=\"img\" aria-label=\"AI Exporter\">\n"
        "  <path d=\"%s\" fill=\"currentColor\"/>\n"
        "  <path d=\"%s\" fill=\"currentColor\" opacity=\"0.92\"/>\n</svg>\n"
        % (spark_path(*SPARK), spark_path(*SPARK_SMALL))
    )
    path = os.path.join(out_assets, "logo-spark-mono.svg")
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(mono)
    note(path)

    # icon set: the toolbar sizes get the simplified drawing
    for size in (16, 32, 48, 128):
        rows = render(size, size, mark_layers(small=size <= 32), size / float(CANVAS),
                      supersample=4 if size >= 48 else 8)
        png = os.path.join(out_icons, "icon%d.png" % size)
        note(png, write_png(png, size, size, rows))

    rows = render(512, 512, mark_layers(), 512 / float(CANVAS), supersample=3)
    png = os.path.join(out_assets, "logo-512.png")
    note(png, write_png(png, 512, 512, rows))

    rows = render(1280, 400, hero_layers(), 1.0, supersample=3)
    png = os.path.join(out_assets, "hero.png")
    note(png, write_png(png, 1280, 400, rows))

    if "--concepts" in argv:
        target = argv[argv.index("--concepts") + 1]
        os.makedirs(target, exist_ok=True)
        concepts = {
            "concept-a-spark.svg": mark_svg(),
            "concept-b-export.svg": concept_export_svg(),
            "concept-c-lines.svg": concept_lines_svg(),
        }
        for name, svg in concepts.items():
            with open(os.path.join(target, name), "w", encoding="utf-8", newline="\n") as handle:
                handle.write(svg)

    for line in written:
        print(line)


def concept_export_svg():
    """Concept B: a page whose bottom half is cut away by an outbound arrow."""
    return (
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" width=\"256\" height=\"256\">\n"
        "  <defs><linearGradient id=\"tile\" x1=\"0.1\" y1=\"0\" x2=\"0.9\" y2=\"1\">"
        "<stop offset=\"0\" stop-color=\"#b30036\"/><stop offset=\"1\" stop-color=\"#6e0021\"/></linearGradient></defs>\n"
        "  <rect x=\"10\" y=\"10\" width=\"236\" height=\"236\" rx=\"58\" fill=\"url(#tile)\"/>\n"
        "  <path fill=\"#e8be62\" fill-rule=\"evenodd\" d=\"M74 62h108v100l-30-30h-78z\"/>\n"
        "  <path fill=\"#e8be62\" d=\"M118 150h20v56h-20zM100 168l28-28 28 28z\"/>\n"
        "  <path fill=\"#e8be62\" d=\"M170 196l14-14 24 24-14 14z\"/>\n"
        "</svg>\n"
    )


def concept_lines_svg():
    """Concept C: transcript rules that shorten, with the spark closing the set."""
    return (
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" width=\"256\" height=\"256\">\n"
        "  <defs><linearGradient id=\"tile\" x1=\"0.1\" y1=\"0\" x2=\"0.9\" y2=\"1\">"
        "<stop offset=\"0\" stop-color=\"#b30036\"/><stop offset=\"1\" stop-color=\"#6e0021\"/></linearGradient></defs>\n"
        "  <rect x=\"10\" y=\"10\" width=\"236\" height=\"236\" rx=\"58\" fill=\"url(#tile)\"/>\n"
        "  <rect x=\"52\" y=\"66\" width=\"152\" height=\"18\" rx=\"9\" fill=\"#fff3dc\"/>\n"
        "  <rect x=\"52\" y=\"104\" width=\"112\" height=\"18\" rx=\"9\" fill=\"#fff3dc\" opacity=\"0.82\"/>\n"
        "  <rect x=\"52\" y=\"142\" width=\"134\" height=\"18\" rx=\"9\" fill=\"#fff3dc\" opacity=\"0.82\"/>\n"
        "  <path d=\"%s\" fill=\"#e8be62\"/>\n"
        "</svg>\n" % spark_path(178, 186, 34)
    )


if __name__ == "__main__":
    main(sys.argv[1:])
