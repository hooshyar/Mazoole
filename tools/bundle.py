"""Bundle the game into one self-contained HTML file (CSS + JS inlined).

Handy for sharing a single file, or hosting where only one page is allowed.
Usage: python3 tools/bundle.py [output.html] [--fragment]
  --fragment  leave out the <html>/<head>/<body> wrapper (for hosts that add their own)
"""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text()

html = html.replace('<link rel="stylesheet" href="style.css">',
                    "<style>\n" + (root / "style.css").read_text() + "\n</style>")
def inline(m):
    code = (root / m.group(1)).read_text().replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if "--fragment" in sys.argv:
    html = re.sub(r"<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*", "", html, flags=re.I)
    html = re.sub(r'<meta (charset|name="viewport")[^>]*>\s*', "", html)

out = pathlib.Path(args[0]) if args else root / "mazoole.html"
out.write_text(html)
print(f"wrote {out} ({len(html) // 1024} KB)")
