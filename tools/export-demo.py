"""Create a self-contained ChartTropy demo that opens from a local file."""

from base64 import b64encode
from functools import cache
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demo"
OUTPUT = ROOT / "dist" / "ChartTropy.html"
LOCAL_IMPORT = re.compile(r"^(import [^\n]+? from ')(\.{1,2}/[\w/-]+\.mjs)(')", re.MULTILINE)


@cache
def module_url(path: Path) -> str:
    if not path.is_relative_to(ROOT):
        raise ValueError(f"El módulo debe estar dentro de ChartTropy: {path}")
    source = path.read_text(encoding="utf-8")
    source = LOCAL_IMPORT.sub(
        lambda match: f"{match[1]}{module_url((path.parent / match[2]).resolve())}{match[3]}", source
    )
    return "data:text/javascript;base64," + b64encode(source.encode("utf-8")).decode("ascii")


def main() -> None:
    html = (DEMO / "index.html").read_text(encoding="utf-8")
    css = (DEMO / "lab.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="./lab.css">', f"<style>\n{css}</style>")
    html = html.replace('<script defer src="./bootstrap.js"></script>',
                        f'<script type="module" src="{module_url(DEMO / "lab.mjs")}"></script>')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
