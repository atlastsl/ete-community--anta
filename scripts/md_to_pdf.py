#!/usr/bin/env python3
"""
Convertit des guides Markdown (_docs/*.md) en PDF.

Usage:
  python scripts/md_to_pdf.py                          # tous les guide-admin*.md
  python scripts/md_to_pdf.py _docs/guide-admin.md     # fichier(s) précis
  python scripts/md_to_pdf.py --all-guides             # idem défaut
  python scripts/md_to_pdf.py --output-dir _docs/pdf   # dossier de sortie
  python scripts/md_to_pdf.py --backend xhtml2pdf      # moteur PDF (défaut auto)

Prérequis:
  pip install -r scripts/requirements-pdf.txt
  node + playwright (déjà dans le projet via npm install) pour les diagrammes Mermaid

Moteurs PDF :
  - xhtml2pdf (défaut sur Windows) — pur Python, sans dépendances système
  - weasyprint (optionnel) — meilleur rendu CSS ; nécessite GTK/Pango (Linux/macOS)

Diagrammes Mermaid :
  - Rendu PNG embarqué (base64) via scripts/render_mermaid.mjs (Playwright + Chrome/Edge)
  - Repli optionnel : @mermaid-js/mermaid-cli si installé (npm install -D @mermaid-js/mermaid-cli)
"""

from __future__ import annotations

import argparse
import base64
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable

import markdown
from markdown.extensions.codehilite import CodeHiliteExtension
from markdown.extensions.fenced_code import FencedCodeExtension
from markdown.extensions.tables import TableExtension

ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "_docs"
DEFAULT_OUTPUT = DOCS_DIR / "pdf"
DEFAULT_GLOB = "guide-admin*.md"
RENDER_MERMAID_SCRIPT = ROOT / "scripts" / "render_mermaid.mjs"

MERMAID_RE = re.compile(r"```mermaid\s*\n(.*?)```", re.DOTALL | re.IGNORECASE)

# CSS compatible xhtml2pdf (ReportLab) — pas de @page nested rules avancées.
PDF_CSS = """
@page {
  size: a4;
  margin: 2cm;
}
body {
  font-family: Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.45;
  color: #1c1917;
}
h1 {
  font-size: 18pt;
  color: #15803d;
  border-bottom: 2px solid #15803d;
  padding-bottom: 0.3em;
}
h2 {
  font-size: 13pt;
  color: #166534;
  margin-top: 1.2em;
}
h3 {
  font-size: 11pt;
  color: #44403c;
  margin-top: 1em;
}
blockquote {
  margin: 0.8em 0;
  padding: 0.5em 0.8em;
  border-left: 4px solid #15803d;
  background-color: #f5f5f4;
  color: #44403c;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8em 0;
  font-size: 9pt;
}
th, td {
  border: 1px solid #d6d3d1;
  padding: 0.35em 0.5em;
  vertical-align: top;
}
th {
  background-color: #ecfdf5;
  color: #166534;
}
code {
  font-family: Courier, monospace;
  font-size: 9pt;
  background-color: #f5f5f4;
}
pre {
  background-color: #292524;
  color: #fafaf9;
  padding: 0.6em 0.8em;
  font-size: 8pt;
}
pre code {
  background-color: transparent;
  color: #fafaf9;
}
a { color: #15803d; }
hr {
  border: none;
  border-top: 1px solid #e7e5e4;
  margin: 1.2em 0;
}
.mermaid-diagram {
  text-align: center;
  margin: 1em 0;
  page-break-inside: avoid;
}
.mermaid-diagram img {
  max-width: 100%;
  height: auto;
}
.mermaid-placeholder {
  border: 1px dashed #a8a29e;
  background-color: #fafaf9;
  padding: 0.6em 0.8em;
  margin: 0.8em 0;
  font-size: 9pt;
  color: #57534e;
}
"""

HTML_SHELL = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>{title}</title>
  <style>{css}</style>
</head>
<body>
{body}
</body>
</html>
"""


def _mmdc_command() -> list[str] | None:
    """Retourne la commande mmdc si @mermaid-js/mermaid-cli est installé."""
    win = sys.platform == "win32"
    candidates = [
        ROOT / "node_modules" / ".bin" / ("mmdc.cmd" if win else "mmdc"),
        ROOT / "node_modules" / ".bin" / "mmdc",
    ]
    for path in candidates:
        if path.exists():
            return [str(path)]
    return None


def _render_mermaid_mmdc(code: str, png_path: Path) -> None:
    mmdc = _mmdc_command()
    if not mmdc:
        raise RuntimeError("mmdc introuvable")

    png_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".mmd", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(code.strip())
        mmd_path = Path(tmp.name)

    try:
        subprocess.run(
            [*mmdc, "-i", str(mmd_path), "-o", str(png_path), "-b", "white", "-s", "2"],
            check=True,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        raise RuntimeError(f"mmdc a échoué : {detail}") from exc
    finally:
        mmd_path.unlink(missing_ok=True)


def _render_mermaid_playwright(code: str, png_path: Path) -> None:
    if not RENDER_MERMAID_SCRIPT.exists():
        raise RuntimeError(f"Script introuvable : {RENDER_MERMAID_SCRIPT}")

    png_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".mmd", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(code.strip())
        mmd_path = Path(tmp.name)

    try:
        subprocess.run(
            ["node", str(RENDER_MERMAID_SCRIPT), str(mmd_path), str(png_path)],
            check=True,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        raise RuntimeError(f"render_mermaid.mjs a échoué : {detail}") from exc
    finally:
        mmd_path.unlink(missing_ok=True)


def render_mermaid_png(code: str, png_path: Path) -> None:
    """Rend un diagramme Mermaid en PNG (mmdc si dispo, sinon Playwright)."""
    errors: list[str] = []

    if _mmdc_command():
        try:
            _render_mermaid_mmdc(code, png_path)
            return
        except RuntimeError as exc:
            errors.append(f"mmdc: {exc}")

    try:
        _render_mermaid_playwright(code, png_path)
        return
    except RuntimeError as exc:
        errors.append(f"playwright: {exc}")

    raise RuntimeError(
        "Rendu Mermaid impossible. "
        + " ; ".join(errors)
        + " — Vérifiez npm install, Chrome/Edge installé, et l'accès réseau (CDN mermaid.js)."
    )


def png_to_img_tag(png_path: Path, alt: str) -> str:
    data = base64.b64encode(png_path.read_bytes()).decode("ascii")
    return (
        f'<div class="mermaid-diagram">'
        f'<img src="data:image/png;base64,{data}" alt="{alt}" />'
        f"</div>"
    )


def embed_mermaid_diagrams(source: str, assets_dir: Path, md_stem: str) -> tuple[str, int]:
    """Remplace les blocs mermaid par des images PNG embarquées."""
    diagram_index = 0

    def replacer(match: re.Match[str]) -> str:
        nonlocal diagram_index
        code = match.group(1)
        png_path = assets_dir / f"{md_stem}-mermaid-{diagram_index}.png"
        alt = f"Diagramme {diagram_index + 1}"

        try:
            render_mermaid_png(code, png_path)
            html = png_to_img_tag(png_path, alt)
        except RuntimeError as exc:
            html = (
                f'<div class="mermaid-placeholder">'
                f"<strong>Diagramme non rendu</strong> — {exc}"
                f"</div>"
            )

        diagram_index += 1
        return html

    return MERMAID_RE.sub(replacer, source), diagram_index


def extract_title(source: str, fallback: str) -> str:
    for line in source.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def md_to_html(source: str, title: str) -> str:
    body = markdown.markdown(
        source,
        extensions=[
            "extra",
            "nl2br",
            "sane_lists",
            TableExtension(),
            FencedCodeExtension(),
            CodeHiliteExtension(css_class="highlight", guess_lang=False),
        ],
        output_format="html5",
    )
    return HTML_SHELL.format(title=title, css=PDF_CSS, body=body)


def write_pdf_xhtml2pdf(html: str, pdf_path: Path) -> None:
    from xhtml2pdf import pisa

    with pdf_path.open("wb") as pdf_file:
        status = pisa.CreatePDF(html, dest=pdf_file, encoding="utf-8")
    if status.err:
        raise RuntimeError(f"xhtml2pdf a échoué (code {status.err})")


def write_pdf_weasyprint(html: str, pdf_path: Path, base_url: str) -> None:
    from weasyprint import HTML

    HTML(string=html, base_url=base_url).write_pdf(str(pdf_path))


def resolve_backend(name: str) -> tuple[str, Callable[[str, Path, str], None]]:
    if name == "auto":
        try:
            import weasyprint  # noqa: F401

            return "weasyprint", lambda h, p, b: write_pdf_weasyprint(h, p, b)
        except (ImportError, OSError):
            return "xhtml2pdf", lambda h, p, _b: write_pdf_xhtml2pdf(h, p)

    if name == "weasyprint":
        return "weasyprint", lambda h, p, b: write_pdf_weasyprint(h, p, b)

    if name == "xhtml2pdf":
        return "xhtml2pdf", lambda h, p, _b: write_pdf_xhtml2pdf(h, p)

    raise ValueError(f"Moteur inconnu : {name} (auto, xhtml2pdf, weasyprint)")


def convert_file(
    md_path: Path,
    output_dir: Path,
    writer: Callable[[str, Path, str], None],
) -> tuple[Path, int]:
    source = md_path.read_text(encoding="utf-8")
    assets_dir = output_dir / "assets"
    source, diagram_count = embed_mermaid_diagrams(source, assets_dir, md_path.stem)
    title = extract_title(source, md_path.stem)
    html = md_to_html(source, title)

    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"{md_path.stem}.pdf"
    writer(html, pdf_path, str(md_path.parent.resolve()))

    return pdf_path, diagram_count


def resolve_inputs(paths: list[str] | None, all_guides: bool) -> list[Path]:
    if paths:
        resolved: list[Path] = []
        for raw in paths:
            p = Path(raw)
            if not p.is_absolute():
                p = ROOT / p
            if not p.exists():
                raise FileNotFoundError(f"Fichier introuvable : {p}")
            resolved.append(p.resolve())
        return resolved

    if all_guides or not paths:
        matches = sorted(DOCS_DIR.glob(DEFAULT_GLOB))
        if not matches:
            raise FileNotFoundError(
                f"Aucun guide trouvé ({DOCS_DIR / DEFAULT_GLOB}). "
                "Passez des chemins .md en argument."
            )
        return matches

    return []


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convertit des guides Markdown Anta en PDF."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Fichiers .md à convertir (défaut : _docs/guide-admin*.md)",
    )
    parser.add_argument(
        "--all-guides",
        action="store_true",
        help="Convertir tous les guides admin (_docs/guide-admin*.md)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Dossier de sortie PDF (défaut : {DEFAULT_OUTPUT.relative_to(ROOT)})",
    )
    parser.add_argument(
        "--backend",
        choices=["auto", "xhtml2pdf", "weasyprint"],
        default="auto",
        help="Moteur PDF (auto = weasyprint si dispo, sinon xhtml2pdf)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args(argv or sys.argv[1:])

    output_dir = args.output_dir
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir

    backend_name, writer = resolve_backend(args.backend)

    try:
        inputs = resolve_inputs(args.paths or None, args.all_guides or not args.paths)
    except FileNotFoundError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1

    print(f"Moteur PDF : {backend_name}")
    print(f"Conversion de {len(inputs)} fichier(s) -> {output_dir}")
    errors: list[str] = []

    for md_path in inputs:
        try:
            pdf_path, diagram_count = convert_file(md_path, output_dir, writer)
            rel_md = md_path.relative_to(ROOT)
            rel_pdf = pdf_path.relative_to(ROOT)
            extra = f" ({diagram_count} Mermaid)" if diagram_count else ""
            print(f"  OK  {rel_md} -> {rel_pdf}{extra}")
        except Exception as exc:  # noqa: BLE001 — rapport CLI
            errors.append(f"{md_path.name}: {exc}")
            print(f"  ERR {md_path.name} — {exc}", file=sys.stderr)

    if errors:
        print(f"\n{len(errors)} echec(s).", file=sys.stderr)
        return 1

    print("\nTermine.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
