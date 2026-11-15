"""Create a reading PDF from the filled DOCX, with the same text and field order.

Uses lxml and the Playwright installation in prototype/. This is an HTML print
layout, not a Microsoft Word rendering. No external content is loaded.
"""
from __future__ import annotations

import argparse
import html
from pathlib import Path
import re
import subprocess
import tempfile
from zipfile import ZipFile

from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"w": W, "r": R}


def make_html(path: Path) -> str:
    with ZipFile(path) as archive:
        root = etree.fromstring(archive.read("word/document.xml"))
        relationships = etree.fromstring(archive.read("word/_rels/document.xml.rels"))
    links = {element.get("Id"): element.get("Target", "") for element in relationships}

    def children(node):
        return "".join(render(child) for child in node)

    def render(node):
        name = etree.QName(node).localname
        if name == "t":
            return html.escape(node.text or "")
        if name == "br":
            return "" if node.get(f"{{{W}}}type") == "page" else "<br>"
        if name == "tab":
            return " &nbsp; "
        if name in {"pPr", "rPr", "sdtPr", "tcPr", "trPr", "tblPr", "tblGrid", "sectPr"}:
            return ""
        if name == "hyperlink":
            target = links.get(node.get(f"{{{R}}}id"), "")
            return '<a href="' + html.escape(target, quote=True) + '">' + children(node) + "</a>"
        if name == "r":
            value = children(node)
            bold = node.find("w:rPr/w:b", NS)
            if bold is not None and bold.get(f"{{{W}}}val", "1") not in {"0", "false"}:
                value = "<strong>" + value + "</strong>"
            return value
        if name == "p":
            text = "".join(node.xpath(".//w:t/text()", namespaces=NS)).strip()
            if not text:
                return ""
            value = children(node)
            if node.find("w:sdt", NS) is not None:
                return '<p class="answer">' + value + "</p>"
            if re.match(r"^0[1-4]\s", text):
                kind = "first-section" if text.startswith("01") else "new-section"
                return '<h1 class="' + kind + '">' + value + "</h1>"
            if re.match(r"^[1-8]\. ", text):
                return '<h2>' + value + "</h2>"
            return "<p>" + value + "</p>"
        if name == "tbl":
            kind = "answer-table" if node.find(".//w:sdt", NS) is not None else "registration-table"
            return '<table class="' + kind + '">' + children(node) + "</table>"
        if name == "tr":
            return "<tr>" + children(node) + "</tr>"
        if name == "tc":
            span = node.find("w:tcPr/w:gridSpan", NS)
            attribute = '' if span is None else ' colspan="' + span.get(f"{{{W}}}val", "1") + '"'
            return '<td' + attribute + '>' + children(node) + '</td>'
        return children(node)

    body = root.find("w:body", NS)
    fragments = ['<section class="registration">']
    in_registration = True
    for child in body:
        text = ''.join(child.xpath('.//w:t/text()', namespaces=NS)).strip()
        if in_registration and text.startswith('02  '):
            fragments.append('</section>')
            in_registration = False
        fragments.append(render(child))
    if in_registration:
        fragments.append('</section>')
    body_markup = ''.join(fragments)
    css = """
    @page { size: A4; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172639; font: 10.5pt/1.65 'Malgun Gothic', 'Noto Sans KR', sans-serif; }
    h1 { color: #002c5f; font-size: 18pt; margin: 0 0 14pt; padding-bottom: 8pt; border-bottom: 2pt solid #002c5f; }
    h1.new-section { break-before: page; }
    h2 { font-size: 12pt; line-height: 1.5; color: #002c5f; margin: 14pt 0 5pt; break-after: avoid; }
    p { margin: 0 0 7pt; overflow-wrap: anywhere; }
    a { color: #002c5f; text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; margin: 4pt 0 13pt; }
    td { border: 0.7pt solid #c7d2df; padding: 7pt 8pt; vertical-align: top; }
    td p:last-child { margin-bottom: 0; }
    table.answer-table { break-inside: auto; }
    table.answer-table td { border-color: #c7d2df; }
    table.registration-table tr { break-inside: avoid; }
    strong { font-weight: 700; }
    .registration { font-size: 10pt; line-height: 1.4; }
    .registration p { margin-bottom: 5pt; }
    .registration td { padding: 5pt 7pt; }
    p.answer { orphans: 3; widows: 3; }
    """
    return '<!doctype html><html lang="ko"><meta charset="utf-8"><title>SHIFT 기획서 열람용</title><style>' + css + '</style><body>' + body_markup + '</body></html>'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "docs/SHIFT_application_draft.docx")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/SHIFT_application_preview.pdf")
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    javascript = r"""
    import {createRequire} from 'node:module';
    const require = createRequire(process.argv[1]);
    const {chromium} = require('playwright');
    const browser = await chromium.launch({headless:true});
    try {
      const page = await browser.newPage();
      await page.goto(process.argv[2], {waitUntil:'load'});
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({path:process.argv[3], format:'A4', printBackground:true,
        margin:{top:'15mm',bottom:'17mm',left:'16mm',right:'16mm'}, displayHeaderFooter:true,
        headerTemplate:'<span></span>',
        footerTemplate:'<div style="width:100%;padding:0 16mm;font:9px sans-serif;color:#68778b;display:flex;justify-content:space-between"><span>SHIFT · 기획서 열람용</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'});
    } finally {await browser.close();}
    """
    with tempfile.TemporaryDirectory(prefix="shift-docx-preview-") as folder:
        source = Path(folder) / "preview.html"
        source.write_text(make_html(args.input), encoding="utf-8")
        subprocess.run(["node", "--input-type=module", "-e", javascript,
                        str(ROOT / "prototype/package.json"), source.as_uri(), str(args.output.resolve())], check=True)
    print(f"Created reading PDF: {args.output.resolve()}")
    print("Content and order follow the DOCX; page layout is an HTML print preview.")


if __name__ == "__main__":
    main()
