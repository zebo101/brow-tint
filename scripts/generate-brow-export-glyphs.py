"""Regenerate server image lettering: python scripts/generate-brow-export-glyphs.py.

Requires fonttools[woff] for development only. Production imports the generated
outlines, so neither installed fonts nor a font parser are required at runtime.
Source font is already shipped by the site; its SIL OFL is copied alongside.
"""
import json
from pathlib import Path
from shutil import copyfile

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
font = TTFont(ROOT / "public/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2")
glyph_set = font.getGlyphSet()
cmap = font.getBestCmap()
glyphs = {}
for char in (chr(code) for code in sorted(cmap)):
    pen = SVGPathPen(glyph_set)
    glyph_set[cmap[ord(char)]].draw(pen)
    glyphs[char] = {
        "advance": font["hmtx"][cmap[ord(char)]][0],
        "path": pen.getCommands(),
    }
destination = ROOT / "src/shared/lib/brow-lettering"
destination.mkdir(exist_ok=True)
(destination / "glyphs.json").write_text(
    json.dumps({"unitsPerEm": font["head"].unitsPerEm, "glyphs": glyphs},
               ensure_ascii=True, separators=(",", ":")) + "\n",
    encoding="utf-8",
)
copyfile(ROOT / "node_modules/@fontsource/jetbrains-mono/LICENSE", destination / "LICENSE")
